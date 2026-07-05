import json
from datetime import date, datetime, time, timedelta
from decimal import Decimal, InvalidOperation

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import Http404, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_http_methods, require_POST

from .models import (
    CompetitorPriceSnapshot,
    PriceRecommendation,
    Product,
    ProductPricingProfile,
    SalesSnapshot,
)
from .services.recommendation_engine import build_recommendation
from .tenancy import get_or_create_default_organization, get_user_organizations, log_pricing_action


def _json_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        raise ValidationError("Invalid JSON body.")


def _decimal_value(data, key, required=True):
    value = data.get(key)
    if value in (None, ""):
        if required:
            raise ValidationError({key: "This field is required."})
        return None
    try:
        return Decimal(str(value).replace(",", "."))
    except (InvalidOperation, ValueError):
        raise ValidationError({key: "Enter a valid decimal number."})


def _int_value(data, key, default=0):
    value = data.get(key, default)
    if value in (None, ""):
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValidationError({key: "Enter a valid integer."})


def _date_value(data, key, default=None):
    value = data.get(key)
    if not value:
        return default
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError({key: "Use YYYY-MM-DD format."})


def _datetime_value(data, key, default=None):
    parsed_date = _date_value(data, key, None)
    if parsed_date is None:
        return default
    return timezone.make_aware(datetime.combine(parsed_date, time.min))


def _validation_response(error):
    if hasattr(error, "message_dict"):
        return JsonResponse({"errors": error.message_dict}, status=400)
    return JsonResponse({"errors": error.messages}, status=400)


def _product_for_user(user, product_id):
    organizations = get_user_organizations(user)
    return get_object_or_404(Product.objects.filter(organization__in=organizations), pk=product_id)


def _recommendation_for_user(user, recommendation_id):
    organizations = get_user_organizations(user)
    return get_object_or_404(PriceRecommendation.objects.filter(organization__in=organizations), pk=recommendation_id)


def _profile_payload(profile):
    return {
        "product_id": profile.product_id,
        "product_name": profile.product.name,
        "currency": profile.currency,
        "cost_price": str(profile.cost_price),
        "current_price": str(profile.current_price),
        "minimum_margin_percent": str(profile.minimum_margin_percent),
        "stock_quantity": profile.stock_quantity,
        "target_stock_quantity": profile.target_stock_quantity,
        "is_pricing_active": profile.is_pricing_active,
        "updated_at": profile.updated_at.isoformat(),
    }


def _competitor_payload(item):
    return {
        "id": item.id,
        "competitor_name": item.competitor_name,
        "source_name": item.source_name,
        "source_url": item.source_url,
        "price": str(item.price),
        "currency": item.currency,
        "captured_at": item.captured_at.isoformat(),
    }


def _recommendation_payload(item):
    return {
        "id": item.id,
        "product_id": item.product_id,
        "product_name": item.product.name,
        "current_price": str(item.current_price),
        "recommended_price": str(item.recommended_price),
        "minimum_allowed_price": str(item.minimum_allowed_price),
        "competitor_median_price": str(item.competitor_median_price) if item.competitor_median_price is not None else None,
        "expected_gross_profit": str(item.expected_gross_profit),
        "expected_margin_percent": str(item.expected_margin_percent),
        "confidence_score": item.confidence_score,
        "confidence_level": item.confidence_level,
        "reason_code": item.reason_code,
        "explanation": item.explanation,
        "status": item.status,
        "created_at": item.created_at.isoformat(),
        "decided_at": item.decided_at.isoformat() if item.decided_at else None,
        "decided_by": item.decided_by.get_username() if item.decided_by else None,
    }


def _create_recommendation(profile, user):
    result = build_recommendation(
        profile,
        profile.product.competitor_price_snapshots.all(),
        profile.product.sales_snapshots.all(),
    )
    recommendation = PriceRecommendation(
        organization=profile.organization,
        product=profile.product,
        current_price=result.current_price,
        recommended_price=result.recommended_price,
        minimum_allowed_price=result.minimum_allowed_price,
        competitor_median_price=result.competitor_median_price,
        expected_gross_profit=result.expected_gross_profit,
        expected_margin_percent=result.expected_margin_percent,
        confidence_score=result.confidence_score,
        confidence_level=result.confidence_level,
        reason_code=result.primary_reason_code,
        explanation=result.explanation,
        input_snapshot=result.input_snapshot,
    )
    recommendation.full_clean()
    recommendation.save()
    log_pricing_action(profile.organization, user, "recommendation_created", recommendation, new_values=_recommendation_payload(recommendation))
    return recommendation


@login_required(login_url="/signin/")
@require_http_methods(["GET", "POST"])
def pricing_assistant(request):
    organization = get_or_create_default_organization(request.user)
    products = Product.objects.filter(organization=organization).select_related("pricing_profile")
    selected_product = products.first()
    latest_recommendation = None

    if request.method == "POST":
        try:
            with transaction.atomic():
                product_name = request.POST.get("product_name", "").strip() or "Yeni Urun"
                product = Product.objects.create(organization=organization, name=product_name)
                profile = ProductPricingProfile(
                    organization=organization,
                    product=product,
                    currency=request.POST.get("currency", "TRY"),
                    cost_price=_decimal_value(request.POST, "cost_price"),
                    current_price=_decimal_value(request.POST, "current_price"),
                    minimum_margin_percent=_decimal_value(request.POST, "minimum_margin_percent"),
                    stock_quantity=_int_value(request.POST, "stock_quantity"),
                    target_stock_quantity=_int_value(request.POST, "target_stock_quantity"),
                )
                profile.full_clean()
                profile.save()
                log_pricing_action(organization, request.user, "pricing_profile_created", profile, new_values=_profile_payload(profile))

                for raw in request.POST.get("competitor_prices", "").replace(";", "\n").splitlines():
                    raw = raw.strip()
                    if not raw:
                        continue
                    snapshot = CompetitorPriceSnapshot(
                        organization=organization,
                        product=product,
                        competitor_name="Rakip",
                        source_name="Manual",
                        price=Decimal(raw.replace(",", ".")),
                        currency=profile.currency,
                    )
                    snapshot.full_clean()
                    snapshot.save()
                    log_pricing_action(organization, request.user, "competitor_price_added", snapshot, new_values=_competitor_payload(snapshot))

                today = timezone.localdate()
                previous_units = _int_value(request.POST, "previous_units_sold")
                latest_units = _int_value(request.POST, "latest_units_sold")
                if previous_units or latest_units:
                    previous = SalesSnapshot(
                        organization=organization,
                        product=product,
                        period_start=today - timedelta(days=14),
                        period_end=today - timedelta(days=8),
                        units_sold=previous_units,
                        revenue=profile.current_price * previous_units,
                    )
                    previous.full_clean()
                    previous.save()
                    latest = SalesSnapshot(
                        organization=organization,
                        product=product,
                        period_start=today - timedelta(days=7),
                        period_end=today,
                        units_sold=latest_units,
                        revenue=profile.current_price * latest_units,
                    )
                    latest.full_clean()
                    latest.save()

                latest_recommendation = _create_recommendation(profile, request.user)
                selected_product = product
            messages.success(request, "Fiyat onerisi olusturuldu. Bu surum magaza fiyatini otomatik degistirmez.")
        except (ValidationError, InvalidOperation, ValueError) as exc:
            messages.error(request, f"Verileri kontrol edin: {exc}")

    if selected_product:
        latest_recommendation = latest_recommendation or selected_product.price_recommendations.first()

    return render(
        request,
        "pricing/assistant.html",
        {
            "organization": organization,
            "products": products,
            "selected_product": selected_product,
            "latest_recommendation": latest_recommendation,
            "recommendations": PriceRecommendation.objects.filter(organization=organization).select_related("product", "decided_by")[:20],
            "competitors": selected_product.competitor_price_snapshots.all()[:10] if selected_product else [],
        },
    )


@login_required(login_url="/signin/")
@require_http_methods(["GET", "PATCH"])
def pricing_profile_api(request, product_id):
    product = _product_for_user(request.user, product_id)
    profile = get_object_or_404(ProductPricingProfile, product=product, organization=product.organization)
    if request.method == "GET":
        return JsonResponse(_profile_payload(profile))

    try:
        data = _json_body(request)
        old_values = _profile_payload(profile)
        for field in ("currency", "is_pricing_active"):
            if field in data:
                setattr(profile, field, data[field])
        for field in ("cost_price", "current_price", "minimum_margin_percent"):
            if field in data:
                setattr(profile, field, _decimal_value(data, field))
        for field in ("stock_quantity", "target_stock_quantity"):
            if field in data:
                setattr(profile, field, _int_value(data, field))
        profile.full_clean()
        profile.save()
        log_pricing_action(product.organization, request.user, "pricing_profile_updated", profile, old_values=old_values, new_values=_profile_payload(profile))
        return JsonResponse(_profile_payload(profile))
    except ValidationError as exc:
        return _validation_response(exc)


@login_required(login_url="/signin/")
@require_http_methods(["GET", "POST"])
def competitor_prices_api(request, product_id):
    product = _product_for_user(request.user, product_id)
    if request.method == "GET":
        return JsonResponse({"results": [_competitor_payload(item) for item in product.competitor_price_snapshots.all()]})

    try:
        data = _json_body(request)
        item = CompetitorPriceSnapshot(
            organization=product.organization,
            product=product,
            competitor_name=data.get("competitor_name") or "Competitor",
            source_name=data.get("source_name", "Manual"),
            source_url=data.get("source_url", ""),
            price=_decimal_value(data, "price"),
            currency=data.get("currency") or getattr(product.pricing_profile, "currency", "TRY"),
            captured_at=_datetime_value(data, "captured_at", timezone.now()),
        )
        item.full_clean()
        item.save()
        log_pricing_action(product.organization, request.user, "competitor_price_added", item, new_values=_competitor_payload(item))
        return JsonResponse(_competitor_payload(item), status=201)
    except ValidationError as exc:
        return _validation_response(exc)


@login_required(login_url="/signin/")
@require_POST
def sales_snapshots_api(request, product_id):
    product = _product_for_user(request.user, product_id)
    try:
        data = _json_body(request)
        item = SalesSnapshot(
            organization=product.organization,
            product=product,
            period_start=_date_value(data, "period_start"),
            period_end=_date_value(data, "period_end"),
            units_sold=_int_value(data, "units_sold"),
            revenue=_decimal_value(data, "revenue"),
        )
        item.full_clean()
        item.save()
        log_pricing_action(product.organization, request.user, "sales_snapshot_added", item, new_values={"units_sold": item.units_sold, "revenue": str(item.revenue)})
        return JsonResponse({"id": item.id, "units_sold": item.units_sold, "revenue": str(item.revenue)}, status=201)
    except ValidationError as exc:
        return _validation_response(exc)


@login_required(login_url="/signin/")
@require_http_methods(["GET", "POST"])
def recommendations_api(request, product_id):
    product = _product_for_user(request.user, product_id)
    if request.method == "GET":
        return JsonResponse({"results": [_recommendation_payload(item) for item in product.price_recommendations.all()]})
    profile = get_object_or_404(ProductPricingProfile, product=product, organization=product.organization)
    try:
        recommendation = _create_recommendation(profile, request.user)
        return JsonResponse(_recommendation_payload(recommendation), status=201)
    except ValidationError as exc:
        return _validation_response(exc)


@login_required(login_url="/signin/")
def recommendation_detail_api(request, recommendation_id):
    item = _recommendation_for_user(request.user, recommendation_id)
    return JsonResponse(_recommendation_payload(item) | {"input_snapshot": item.input_snapshot})


def _decide_recommendation(request, recommendation_id, status):
    item = _recommendation_for_user(request.user, recommendation_id)
    if item.status != status:
        old_values = {"status": item.status}
        item.status = status
        item.decided_at = timezone.now()
        item.decided_by = request.user
        item.save(update_fields=["status", "decided_at", "decided_by"])
        action = "recommendation_accepted" if status == PriceRecommendation.STATUS_ACCEPTED else "recommendation_rejected"
        log_pricing_action(item.organization, request.user, action, item, old_values=old_values, new_values={"status": status})
    return JsonResponse(_recommendation_payload(item))


@login_required(login_url="/signin/")
@require_POST
def accept_recommendation_api(request, recommendation_id):
    return _decide_recommendation(request, recommendation_id, PriceRecommendation.STATUS_ACCEPTED)


@login_required(login_url="/signin/")
@require_POST
def reject_recommendation_api(request, recommendation_id):
    return _decide_recommendation(request, recommendation_id, PriceRecommendation.STATUS_REJECTED)


@login_required(login_url="/signin/")
@require_POST
def accept_recommendation_html(request, recommendation_id):
    _decide_recommendation(request, recommendation_id, PriceRecommendation.STATUS_ACCEPTED)
    messages.success(request, "Oneri kabul edildi. Bu surumde magaza fiyati otomatik olarak degistirilmemektedir.")
    return redirect(reverse("pricing_assistant"))


@login_required(login_url="/signin/")
@require_POST
def reject_recommendation_html(request, recommendation_id):
    _decide_recommendation(request, recommendation_id, PriceRecommendation.STATUS_REJECTED)
    messages.info(request, "Oneri reddedildi ve karar gecmise kaydedildi.")
    return redirect(reverse("pricing_assistant"))
