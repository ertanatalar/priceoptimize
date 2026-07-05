from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
from statistics import median

from django.conf import settings
from django.utils import timezone

MONEY = Decimal("0.01")
PERCENT = Decimal("0.01")
FRESH_COMPETITOR_DAYS = 30


@dataclass(frozen=True)
class RecommendationResult:
    current_price: Decimal
    recommended_price: Decimal
    minimum_allowed_price: Decimal
    competitor_median_price: Decimal | None
    expected_gross_profit: Decimal
    expected_margin_percent: Decimal
    confidence_score: int
    confidence_level: str
    reason_codes: list[str]
    explanation: str
    input_snapshot: dict

    @property
    def primary_reason_code(self):
        return self.reason_codes[0] if self.reason_codes else "STABLE_PRICE"


def money(value):
    return Decimal(value).quantize(MONEY, rounding=ROUND_HALF_UP)


def pct(value):
    return Decimal(value).quantize(PERCENT, rounding=ROUND_HALF_UP)


def minimum_allowed_price(cost_price, minimum_margin_percent):
    margin = Decimal(minimum_margin_percent) / Decimal("100")
    denominator = Decimal("1") - margin
    if denominator <= 0:
        raise ValueError("minimum_margin_percent must be below 100")
    return money(Decimal(cost_price) / denominator)


def confidence_level(score):
    if score <= 39:
        return "low"
    if score <= 69:
        return "medium"
    return "high"


def _fresh_competitors(competitor_prices, currency):
    cutoff = timezone.now() - timedelta(days=FRESH_COMPETITOR_DAYS)
    return [
        price
        for price in competitor_prices
        if price.currency == currency and price.captured_at >= cutoff and price.price > 0
    ]


def _sales_trend(sales_snapshots):
    ordered = sorted(sales_snapshots, key=lambda item: (item.period_end, item.created_at), reverse=True)
    latest = ordered[0] if ordered else None
    previous = ordered[1] if len(ordered) > 1 else None
    if not latest or not previous or previous.units_sold == 0:
        return "unknown", latest.units_sold if latest else 0, None
    ratio = Decimal(latest.units_sold) / Decimal(previous.units_sold)
    if ratio < Decimal("0.90"):
        return "declining", latest.units_sold, previous.units_sold
    if ratio > Decimal("1.10"):
        return "growing", latest.units_sold, previous.units_sold
    return "stable", latest.units_sold, previous.units_sold


def _confidence_score(profile, fresh_competitors, sales_snapshots):
    score = 0
    if profile.cost_price and profile.current_price and profile.minimum_margin_percent is not None:
        score += 25
    if len(fresh_competitors) >= 3:
        score += 25
    elif len(fresh_competitors) >= 1:
        score += 10
    if sales_snapshots:
        score += 20
    if profile.stock_quantity is not None and profile.target_stock_quantity is not None:
        score += 15
    if fresh_competitors and max(item.captured_at for item in fresh_competitors) >= timezone.now() - timedelta(days=7):
        score += 15
    return min(score, 100)


def build_recommendation(profile, competitor_prices=None, sales_snapshots=None, max_change_percent=None):
    competitor_prices = list(competitor_prices or [])
    sales_snapshots = list(sales_snapshots or [])
    max_change_percent = Decimal(str(max_change_percent or getattr(settings, "PRICING_MAX_CHANGE_PERCENT", "5")))

    current_price = money(profile.current_price)
    cost_price = money(profile.cost_price)
    min_price = minimum_allowed_price(cost_price, profile.minimum_margin_percent)
    fresh_competitors = _fresh_competitors(competitor_prices, profile.currency)
    competitor_median = money(median([item.price for item in fresh_competitors])) if fresh_competitors else None
    sales_trend, latest_units, previous_units = _sales_trend(sales_snapshots)

    reason_codes = []
    recommended = current_price
    target_stock = Decimal(profile.target_stock_quantity or 0)
    stock = Decimal(profile.stock_quantity or 0)
    high_stock = target_stock > 0 and stock > target_stock * Decimal("1.20")
    low_stock = target_stock > 0 and stock < target_stock * Decimal("0.50")

    if competitor_median is None:
        reason_codes.append("INSUFFICIENT_DATA")
    else:
        market_gap_percent = ((current_price - competitor_median) / competitor_median) * Decimal("100")
        if market_gap_percent > Decimal("5"):
            recommended = competitor_median * Decimal("1.02")
            reason_codes.append("ABOVE_MARKET")
        elif market_gap_percent < Decimal("-5") and low_stock:
            recommended = min(competitor_median, current_price * Decimal("1.03"))
            reason_codes.extend(["BELOW_MARKET", "LOW_STOCK"])

    if sales_trend == "declining" and high_stock:
        fallback = competitor_median if competitor_median is not None else current_price * Decimal("0.98")
        recommended = min(recommended, fallback)
        reason_codes.extend(["DECLINING_SALES", "HIGH_STOCK"])
    elif sales_trend == "growing" and low_stock:
        recommended = max(recommended, current_price * Decimal("1.03"))
        reason_codes.append("LOW_STOCK")

    if recommended < min_price:
        recommended = min_price
        reason_codes.append("SAFETY_FLOOR_APPLIED")

    limit = max_change_percent / Decimal("100")
    lower_bound = money(current_price * (Decimal("1") - limit))
    upper_bound = money(current_price * (Decimal("1") + limit))
    if recommended < lower_bound:
        recommended = lower_bound
        reason_codes.append("CHANGE_LIMIT_APPLIED")
    elif recommended > upper_bound:
        recommended = upper_bound
        reason_codes.append("CHANGE_LIMIT_APPLIED")

    if recommended < min_price:
        recommended = min_price
        if "SAFETY_FLOOR_APPLIED" not in reason_codes:
            reason_codes.append("SAFETY_FLOOR_APPLIED")

    recommended = money(recommended)
    if abs(recommended - current_price) < MONEY:
        reason_codes.append("STABLE_PRICE")

    expected_units = Decimal(latest_units or 1)
    expected_gross_profit = money((recommended - cost_price) * expected_units)
    expected_margin = pct(((recommended - cost_price) / recommended) * Decimal("100")) if recommended > 0 else Decimal("0.00")
    score = _confidence_score(profile, fresh_competitors, sales_snapshots)

    explanation = _build_explanation(
        current_price=current_price,
        recommended_price=recommended,
        min_price=min_price,
        competitor_median=competitor_median,
        margin_percent=profile.minimum_margin_percent,
        reason_codes=reason_codes,
    )

    return RecommendationResult(
        current_price=current_price,
        recommended_price=recommended,
        minimum_allowed_price=min_price,
        competitor_median_price=competitor_median,
        expected_gross_profit=expected_gross_profit,
        expected_margin_percent=expected_margin,
        confidence_score=score,
        confidence_level=confidence_level(score),
        reason_codes=list(dict.fromkeys(reason_codes)),
        explanation=explanation,
        input_snapshot={
            "currency": profile.currency,
            "cost_price": str(cost_price),
            "current_price": str(current_price),
            "minimum_margin_percent": str(profile.minimum_margin_percent),
            "stock_quantity": profile.stock_quantity,
            "target_stock_quantity": profile.target_stock_quantity,
            "fresh_competitor_prices": [str(item.price) for item in fresh_competitors],
            "competitor_median_price": str(competitor_median) if competitor_median is not None else None,
            "sales_trend": sales_trend,
            "latest_units_sold": int(latest_units or 0),
            "previous_units_sold": int(previous_units or 0) if previous_units is not None else None,
            "max_change_percent": str(max_change_percent),
        },
    )


def _build_explanation(current_price, recommended_price, min_price, competitor_median, margin_percent, reason_codes):
    if competitor_median is None:
        return (
            "Rakip fiyat verisi bulunmadigi icin agresif fiyat degisikligi onerilmedi. "
            f"Minimum %{margin_percent} brut kar marjini korumak icin fiyat {min_price} seviyesinin altina dusmemelidir."
        )

    gap = pct(((current_price - competitor_median) / competitor_median) * Decimal("100"))
    if "SAFETY_FLOOR_APPLIED" in reason_codes:
        return (
            f"Urun maliyeti ve minimum %{margin_percent} brut kar marji nedeniyle fiyat {min_price} seviyesinin altina inemez. "
            f"Rakip medyan fiyati {competitor_median}; onerilen guvenli fiyat {recommended_price}."
        )
    if "ABOVE_MARKET" in reason_codes:
        return (
            f"Mevcut fiyat rakip medyan fiyatindan yaklasik %{abs(gap)} daha yuksek. "
            f"Fiyat degisim siniri ve kar marji korunarak {recommended_price} oneriliyor."
        )
    if "LOW_STOCK" in reason_codes:
        return (
            f"Stok seviyesi dusuk ve rakip medyani {competitor_median}. "
            f"Kar marji korunarak sinirli fiyat artisi ile {recommended_price} oneriliyor."
        )
    if "DECLINING_SALES" in reason_codes:
        return (
            f"Satis egilimi zayif ve stok seviyesi yuksek gorunuyor. "
            f"Rakip medyanina yaklasan {recommended_price} fiyati oneriliyor."
        )
    return f"Veriler mevcut fiyata yakin kalmayi destekliyor. Onerilen fiyat {recommended_price}."
