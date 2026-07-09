import json
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from .models import (
    ChannelMetadata,
    CompetitorPriceSnapshot,
    CustomerAccountSignal,
    ExperimentObservation,
    ExternalSignal,
    Organization,
    OrganizationMembership,
    PriceRecommendation,
    Product,
    ProductPricingProfile,
    Promotion,
    SalesSnapshot,
    StockSnapshot,
    TransactionRecord,
)
from .services.recommendation_engine import build_recommendation, minimum_allowed_price


class PricingFixtureMixin:
    def create_pricing_fixture(self, username="owner", product_name="Test Product"):
        user = get_user_model().objects.create_user(username=username, password="test-pass-123")
        organization = Organization.objects.create(name=f"{username} Org", slug=f"{username}-org", owner=user)
        OrganizationMembership.objects.create(
            organization=organization,
            user=user,
            role=OrganizationMembership.ROLE_OWNER,
        )
        product = Product.objects.create(organization=organization, name=product_name)
        profile = ProductPricingProfile.objects.create(
            organization=organization,
            product=product,
            currency="TRY",
            cost_price=Decimal("700.00"),
            current_price=Decimal("1000.00"),
            minimum_margin_percent=Decimal("20.00"),
            stock_quantity=120,
            target_stock_quantity=80,
        )
        return user, organization, product, profile


class RecommendationEngineTests(PricingFixtureMixin, TestCase):
    def test_minimum_allowed_price_respects_margin(self):
        self.assertEqual(minimum_allowed_price(Decimal("700"), Decimal("20")), Decimal("875.00"))

    def test_margin_validator_rejects_unsafe_margin(self):
        user, organization, product, _profile = self.create_pricing_fixture()
        other_product = Product.objects.create(organization=organization, name="Unsafe Product")
        profile = ProductPricingProfile(
            organization=organization,
            product=other_product,
            cost_price=Decimal("100.00"),
            current_price=Decimal("120.00"),
            minimum_margin_percent=Decimal("99.00"),
        )
        with self.assertRaises(ValidationError):
            profile.full_clean()

    @override_settings(PRICING_MAX_CHANGE_PERCENT="5")
    def test_price_change_is_limited_when_market_gap_is_large(self):
        _user, organization, product, profile = self.create_pricing_fixture()
        CompetitorPriceSnapshot.objects.create(organization=organization, product=product, competitor_name="A", price=Decimal("500.00"))
        result = build_recommendation(profile, product.competitor_price_snapshots.all(), [])
        self.assertEqual(result.recommended_price, Decimal("950.00"))
        self.assertIn("CHANGE_LIMIT_APPLIED", result.reason_codes)

    @override_settings(PRICING_MAX_CHANGE_PERCENT="5")
    def test_safety_floor_overrides_change_limit(self):
        _user, organization, product, profile = self.create_pricing_fixture()
        profile.cost_price = Decimal("900.00")
        profile.minimum_margin_percent = Decimal("20.00")
        profile.save()
        CompetitorPriceSnapshot.objects.create(organization=organization, product=product, competitor_name="A", price=Decimal("700.00"))
        result = build_recommendation(profile, product.competitor_price_snapshots.all(), [])
        self.assertEqual(result.minimum_allowed_price, Decimal("1125.00"))
        self.assertEqual(result.recommended_price, Decimal("1125.00"))
        self.assertIn("SAFETY_FLOOR_APPLIED", result.reason_codes)

    def test_confidence_increases_with_competitor_and_sales_data(self):
        _user, organization, product, profile = self.create_pricing_fixture()
        for index, price in enumerate(("940.00", "960.00", "980.00"), start=1):
            CompetitorPriceSnapshot.objects.create(
                organization=organization,
                product=product,
                competitor_name=f"Rakip {index}",
                price=Decimal(price),
            )
        today = timezone.localdate()
        SalesSnapshot.objects.create(
            organization=organization,
            product=product,
            period_start=today - timedelta(days=14),
            period_end=today - timedelta(days=8),
            units_sold=100,
            revenue=Decimal("100000.00"),
        )
        SalesSnapshot.objects.create(
            organization=organization,
            product=product,
            period_start=today - timedelta(days=7),
            period_end=today,
            units_sold=85,
            revenue=Decimal("85000.00"),
        )
        result = build_recommendation(profile, product.competitor_price_snapshots.all(), product.sales_snapshots.all())
        self.assertEqual(result.competitor_median_price, Decimal("960.00"))
        self.assertGreaterEqual(result.confidence_score, 80)
        self.assertEqual(result.confidence_level, "high")

    def test_competitor_median_uses_median_not_average(self):
        _user, organization, product, profile = self.create_pricing_fixture()
        for index, price in enumerate(("900.00", "920.00", "2000.00"), start=1):
            CompetitorPriceSnapshot.objects.create(
                organization=organization,
                product=product,
                competitor_name=f"Rakip {index}",
                price=Decimal(price),
            )
        result = build_recommendation(profile, product.competitor_price_snapshots.all(), [])
        self.assertEqual(result.competitor_median_price, Decimal("920.00"))

    def test_missing_competitor_data_keeps_recommendation_conservative(self):
        _user, _organization, product, profile = self.create_pricing_fixture()
        result = build_recommendation(profile, product.competitor_price_snapshots.all(), [])
        self.assertEqual(result.recommended_price, Decimal("1000.00"))
        self.assertIn("INSUFFICIENT_DATA", result.reason_codes)
        self.assertIn("STABLE_PRICE", result.reason_codes)

    def test_money_values_are_rounded_to_two_decimals(self):
        self.assertEqual(minimum_allowed_price(Decimal("333.33"), Decimal("17.5")), Decimal("404.04"))


class PricingDataModelTests(PricingFixtureMixin, TestCase):
    def test_extended_product_master_data_can_be_saved(self):
        _user, organization, product, profile = self.create_pricing_fixture()
        product.product_id = "ERP-1001"
        product.title = "Noise Cancelling Headphones"
        product.brand = "Acme"
        product.category = "Electronics"
        product.uom = "piece"
        product.tax_class = "standard-vat"
        product.lifecycle_stage = Product.LIFECYCLE_ACTIVE
        product.full_clean()
        product.save()

        profile.landed_cost = Decimal("720.00")
        profile.cogs = Decimal("690.00")
        profile.shipping_cost = Decimal("30.00")
        profile.msrp = Decimal("1299.00")
        profile.map_price = Decimal("999.00")
        profile.full_clean()
        profile.save()

        product.refresh_from_db()
        self.assertEqual(product.product_id, "ERP-1001")
        self.assertEqual(product.brand, "Acme")
        self.assertEqual(organization.products.filter(product_id="ERP-1001").count(), 1)

    def test_operational_pricing_inputs_can_be_saved(self):
        _user, organization, product, _profile = self.create_pricing_fixture()
        now = timezone.now()

        transaction = TransactionRecord.objects.create(
            organization=organization,
            product=product,
            timestamp=now,
            sku="SKU-1",
            channel="web",
            qty=3,
            net_price=Decimal("999.00"),
            discount=Decimal("50.00"),
            order_id="ORDER-1",
        )
        stock = StockSnapshot.objects.create(
            organization=organization,
            product=product,
            on_hand=50,
            reserved=5,
            lead_time_days=7,
            stockout_flag=False,
            warehouse_id="IST-1",
        )
        promotion = Promotion.objects.create(
            organization=organization,
            product=product,
            promo_id="PROMO-1",
            promo_type=Promotion.TYPE_AMOUNT,
            discount_depth=Decimal("50.00"),
            start_at=now,
            end_at=now + timedelta(days=7),
            media_support=True,
        )
        channel = ChannelMetadata.objects.create(
            organization=organization,
            channel_name="marketplace",
            vat_mode=ChannelMetadata.VAT_INCLUDED,
            min_price=Decimal("800.00"),
            max_price=Decimal("1400.00"),
            update_limit=20,
            currency="TRY",
        )
        customer_signal = CustomerAccountSignal.objects.create(
            organization=organization,
            account_hash="hash-123",
            segment="b2b",
            region="TR",
            contract_flag=True,
        )
        external_signal = ExternalSignal.objects.create(
            organization=organization,
            signal_type=ExternalSignal.SIGNAL_FX,
            name="USDTRY",
            region="TR",
            numeric_value=Decimal("32.5000"),
        )
        experiment = ExperimentObservation.objects.create(
            organization=organization,
            product=product,
            variant="price-999",
            assignment_ts=now,
            holdout_group=False,
            reason_code="price_elasticity_test",
        )

        self.assertEqual(transaction.qty, 3)
        self.assertEqual(stock.warehouse_id, "IST-1")
        self.assertEqual(promotion.promo_id, "PROMO-1")
        self.assertEqual(channel.channel_name, "marketplace")
        self.assertEqual(customer_signal.account_hash, "hash-123")
        self.assertEqual(external_signal.signal_type, ExternalSignal.SIGNAL_FX)
        self.assertEqual(experiment.reason_code, "price_elasticity_test")

    def test_channel_price_guardrail_rejects_invalid_range(self):
        _user, organization, _product, _profile = self.create_pricing_fixture()
        channel = ChannelMetadata(
            organization=organization,
            channel_name="bad-channel",
            min_price=Decimal("1200.00"),
            max_price=Decimal("1000.00"),
        )
        with self.assertRaises(ValidationError):
            channel.full_clean()


class PricingApiTests(PricingFixtureMixin, TestCase):
    def test_pricing_assistant_requires_login(self):
        response = self.client.get(reverse("pricing_assistant"))
        self.assertEqual(response.status_code, 302)
        self.assertIn("/signin/", response["Location"])

    def test_generate_recommendation_api_creates_audit_log(self):
        user, organization, product, _profile = self.create_pricing_fixture()
        self.client.login(username=user.username, password="test-pass-123")
        response = self.client.post(reverse("pricing_api_generate_recommendation", args=[product.id]))
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["product_id"], product.id)
        self.assertEqual(PriceRecommendation.objects.filter(product=product).count(), 1)
        self.assertEqual(organization.pricing_audit_logs.filter(action="recommendation_created").count(), 1)

    def test_api_blocks_cross_tenant_product_access(self):
        user, _organization, _product, _profile = self.create_pricing_fixture()
        other_user, _other_org, other_product, _other_profile = self.create_pricing_fixture(username="other")
        self.client.login(username=user.username, password="test-pass-123")
        response = self.client.get(reverse("pricing_api_profile", args=[other_product.id]))
        self.assertEqual(response.status_code, 404)
        self.assertNotEqual(user.id, other_user.id)

    def test_competitor_api_validates_positive_price(self):
        user, _organization, product, _profile = self.create_pricing_fixture()
        self.client.login(username=user.username, password="test-pass-123")
        response = self.client.post(
            reverse("pricing_api_competitors", args=[product.id]),
            data=json.dumps({"price": "0", "competitor_name": "Rakip"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_accept_recommendation_is_idempotent_for_same_action(self):
        user, _organization, product, profile = self.create_pricing_fixture()
        self.client.login(username=user.username, password="test-pass-123")
        first = self.client.post(reverse("pricing_api_generate_recommendation", args=[product.id]))
        recommendation_id = first.json()["id"]
        first_accept = self.client.post(reverse("pricing_api_accept_recommendation", args=[recommendation_id]))
        second_accept = self.client.post(reverse("pricing_api_accept_recommendation", args=[recommendation_id]))
        self.assertEqual(first_accept.status_code, 200)
        self.assertEqual(second_accept.status_code, 200)
        profile.refresh_from_db()
        recommendation = PriceRecommendation.objects.get(id=recommendation_id)
        self.assertEqual(recommendation.status, PriceRecommendation.STATUS_ACCEPTED)

    def test_reject_recommendation_is_idempotent_for_same_action(self):
        user, organization, product, _profile = self.create_pricing_fixture()
        self.client.login(username=user.username, password="test-pass-123")
        first = self.client.post(reverse("pricing_api_generate_recommendation", args=[product.id]))
        recommendation_id = first.json()["id"]
        first_reject = self.client.post(reverse("pricing_api_reject_recommendation", args=[recommendation_id]))
        second_reject = self.client.post(reverse("pricing_api_reject_recommendation", args=[recommendation_id]))
        self.assertEqual(first_reject.status_code, 200)
        self.assertEqual(second_reject.status_code, 200)
        recommendation = PriceRecommendation.objects.get(id=recommendation_id)
        self.assertEqual(recommendation.status, PriceRecommendation.STATUS_REJECTED)
        self.assertEqual(organization.pricing_audit_logs.filter(action="recommendation_rejected").count(), 1)
