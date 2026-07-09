from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from .validators import (
    validate_margin_percent,
    validate_non_negative_decimal,
    validate_non_negative_int,
    validate_positive_decimal,
)


class Organization(models.Model):
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=180, unique=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_pricing_organizations",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class OrganizationMembership(models.Model):
    ROLE_OWNER = "owner"
    ROLE_MEMBER = "member"
    ROLE_CHOICES = ((ROLE_OWNER, "Owner"), (ROLE_MEMBER, "Member"))

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pricing_memberships")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_MEMBER)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("organization", "user")

    def __str__(self):
        return f"{self.user} @ {self.organization}"


class Product(models.Model):
    LIFECYCLE_DRAFT = "draft"
    LIFECYCLE_ACTIVE = "active"
    LIFECYCLE_PAUSED = "paused"
    LIFECYCLE_DISCONTINUED = "discontinued"
    LIFECYCLE_CHOICES = (
        (LIFECYCLE_DRAFT, "Draft"),
        (LIFECYCLE_ACTIVE, "Active"),
        (LIFECYCLE_PAUSED, "Paused"),
        (LIFECYCLE_DISCONTINUED, "Discontinued"),
    )

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="products")
    product_id = models.CharField(max_length=120, blank=True, db_index=True)
    name = models.CharField(max_length=220)
    title = models.CharField(max_length=240, blank=True)
    sku = models.CharField(max_length=80, blank=True)
    brand = models.CharField(max_length=160, blank=True)
    category = models.CharField(max_length=160, blank=True)
    uom = models.CharField(max_length=40, blank=True, default="unit")
    tax_class = models.CharField(max_length=60, blank=True)
    lifecycle_stage = models.CharField(max_length=24, choices=LIFECYCLE_CHOICES, default=LIFECYCLE_ACTIVE)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "sku"],
                condition=~models.Q(sku=""),
                name="unique_pricing_product_sku_per_org",
            ),
            models.UniqueConstraint(
                fields=["organization", "product_id"],
                condition=~models.Q(product_id=""),
                name="unique_pricing_product_id_per_org",
            )
        ]

    def __str__(self):
        return self.name


class ProductPricingProfile(models.Model):
    CURRENCY_CHOICES = (("TRY", "TRY"), ("USD", "USD"), ("EUR", "EUR"))

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="pricing_profiles")
    product = models.OneToOneField(Product, on_delete=models.CASCADE, related_name="pricing_profile")
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default="TRY")
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, validators=[validate_positive_decimal])
    landed_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[validate_non_negative_decimal],
    )
    cogs = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[validate_non_negative_decimal],
    )
    shipping_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[validate_non_negative_decimal],
    )
    current_price = models.DecimalField(max_digits=12, decimal_places=2, validators=[validate_positive_decimal])
    msrp = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[validate_non_negative_decimal],
    )
    map_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[validate_non_negative_decimal],
        help_text="Minimum advertised price.",
    )
    minimum_margin_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=20,
        validators=[validate_margin_percent],
    )
    stock_quantity = models.PositiveIntegerField(default=0, validators=[validate_non_negative_int])
    target_stock_quantity = models.PositiveIntegerField(default=0, validators=[validate_non_negative_int])
    is_pricing_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        if self.product_id and self.organization_id and self.product.organization_id != self.organization_id:
            raise ValidationError("Product and pricing profile must belong to the same organization.")

    def __str__(self):
        return f"{self.product} pricing profile"


class CompetitorPriceSnapshot(models.Model):
    STOCK_UNKNOWN = "unknown"
    STOCK_IN_STOCK = "in_stock"
    STOCK_OUT_OF_STOCK = "out_of_stock"
    STOCK_LIMITED = "limited"
    STOCK_CHOICES = (
        (STOCK_UNKNOWN, "Unknown"),
        (STOCK_IN_STOCK, "In stock"),
        (STOCK_OUT_OF_STOCK, "Out of stock"),
        (STOCK_LIMITED, "Limited"),
    )

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="competitor_price_snapshots")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="competitor_price_snapshots")
    competitor_id = models.CharField(max_length=120, blank=True, db_index=True)
    competitor_name = models.CharField(max_length=160)
    source_name = models.CharField(max_length=160, blank=True)
    source_url = models.URLField(blank=True)
    matched_url = models.URLField(blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2, validators=[validate_positive_decimal])
    currency = models.CharField(max_length=3, default="TRY")
    stock_status = models.CharField(max_length=24, choices=STOCK_CHOICES, default=STOCK_UNKNOWN)
    captured_at = models.DateTimeField(default=timezone.now)
    crawl_ts = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-captured_at", "-created_at"]

    def clean(self):
        if self.product_id and self.organization_id and self.product.organization_id != self.organization_id:
            raise ValidationError("Product and competitor price must belong to the same organization.")

    def __str__(self):
        return f"{self.competitor_name}: {self.price} {self.currency}"


class SalesSnapshot(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="sales_snapshots")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="sales_snapshots")
    period_start = models.DateField()
    period_end = models.DateField()
    units_sold = models.PositiveIntegerField(default=0, validators=[validate_non_negative_int])
    revenue = models.DecimalField(max_digits=14, decimal_places=2, default=0, validators=[validate_non_negative_decimal])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-period_end", "-created_at"]

    def clean(self):
        if self.period_start and self.period_end and self.period_end < self.period_start:
            raise ValidationError("Period end cannot be before period start.")
        if self.product_id and self.organization_id and self.product.organization_id != self.organization_id:
            raise ValidationError("Product and sales snapshot must belong to the same organization.")

    def __str__(self):
        return f"{self.product}: {self.units_sold} units"


class TransactionRecord(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="transaction_records")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="transaction_records")
    timestamp = models.DateTimeField(default=timezone.now)
    sku = models.CharField(max_length=80, blank=True)
    channel = models.CharField(max_length=80, blank=True)
    qty = models.PositiveIntegerField(default=1, validators=[validate_non_negative_int])
    net_price = models.DecimalField(max_digits=12, decimal_places=2, validators=[validate_non_negative_decimal])
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[validate_non_negative_decimal])
    order_id = models.CharField(max_length=120, blank=True, db_index=True)
    currency = models.CharField(max_length=3, default="TRY")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp", "-created_at"]
        indexes = [
            models.Index(fields=["organization", "sku", "timestamp"]),
            models.Index(fields=["organization", "channel", "timestamp"]),
        ]

    def clean(self):
        if self.product_id and self.organization_id and self.product.organization_id != self.organization_id:
            raise ValidationError("Product and transaction must belong to the same organization.")

    def __str__(self):
        return f"{self.sku or self.product}: {self.qty} @ {self.net_price}"


class StockSnapshot(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="stock_snapshots")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stock_snapshots")
    on_hand = models.PositiveIntegerField(default=0, validators=[validate_non_negative_int])
    reserved = models.PositiveIntegerField(default=0, validators=[validate_non_negative_int])
    lead_time_days = models.PositiveIntegerField(default=0, validators=[validate_non_negative_int])
    stockout_flag = models.BooleanField(default=False)
    warehouse_id = models.CharField(max_length=120, blank=True)
    captured_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-captured_at", "-created_at"]
        indexes = [models.Index(fields=["organization", "warehouse_id", "captured_at"])]

    def clean(self):
        if self.product_id and self.organization_id and self.product.organization_id != self.organization_id:
            raise ValidationError("Product and stock snapshot must belong to the same organization.")

    def __str__(self):
        return f"{self.product}: {self.on_hand} on hand"


class Promotion(models.Model):
    TYPE_PERCENT = "percent"
    TYPE_AMOUNT = "amount"
    TYPE_BUNDLE = "bundle"
    TYPE_FREE_SHIPPING = "free_shipping"
    TYPE_OTHER = "other"
    PROMO_TYPE_CHOICES = (
        (TYPE_PERCENT, "Percent discount"),
        (TYPE_AMOUNT, "Fixed amount discount"),
        (TYPE_BUNDLE, "Bundle"),
        (TYPE_FREE_SHIPPING, "Free shipping"),
        (TYPE_OTHER, "Other"),
    )

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="promotions")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="promotions", null=True, blank=True)
    promo_id = models.CharField(max_length=120, blank=True, db_index=True)
    promo_type = models.CharField(max_length=24, choices=PROMO_TYPE_CHOICES, default=TYPE_AMOUNT)
    discount_depth = models.DecimalField(max_digits=12, decimal_places=2, validators=[validate_non_negative_decimal])
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    media_support = models.BooleanField(default=False)
    media_support_note = models.CharField(max_length=240, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "promo_id"],
                condition=~models.Q(promo_id=""),
                name="unique_pricing_promo_id_per_org",
            )
        ]

    def clean(self):
        if self.end_at and self.start_at and self.end_at < self.start_at:
            raise ValidationError("Promotion end date cannot be before start date.")
        if self.product_id and self.organization_id and self.product.organization_id != self.organization_id:
            raise ValidationError("Product and promotion must belong to the same organization.")

    def __str__(self):
        return self.promo_id or f"{self.get_promo_type_display()} promotion"


class ChannelMetadata(models.Model):
    VAT_INCLUDED = "included"
    VAT_EXCLUDED = "excluded"
    VAT_EXEMPT = "exempt"
    VAT_MODE_CHOICES = (
        (VAT_INCLUDED, "VAT included"),
        (VAT_EXCLUDED, "VAT excluded"),
        (VAT_EXEMPT, "VAT exempt"),
    )

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="channel_metadata")
    channel_name = models.CharField(max_length=120)
    vat_mode = models.CharField(max_length=24, choices=VAT_MODE_CHOICES, default=VAT_INCLUDED)
    min_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[validate_non_negative_decimal],
    )
    max_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[validate_non_negative_decimal],
    )
    update_limit = models.PositiveIntegerField(default=0, validators=[validate_non_negative_int])
    currency = models.CharField(max_length=3, default="TRY")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["channel_name"]
        constraints = [
            models.UniqueConstraint(fields=["organization", "channel_name"], name="unique_pricing_channel_per_org")
        ]

    def clean(self):
        if self.min_price is not None and self.max_price is not None and self.max_price < self.min_price:
            raise ValidationError("Maximum channel price cannot be below minimum channel price.")

    def __str__(self):
        return self.channel_name


class CustomerAccountSignal(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="customer_account_signals")
    account_hash = models.CharField(max_length=128, blank=True, db_index=True)
    segment = models.CharField(max_length=120, blank=True)
    region = models.CharField(max_length=120, blank=True)
    contract_flag = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["segment", "region"]

    def __str__(self):
        return self.account_hash or f"{self.segment} {self.region}".strip()


class ExternalSignal(models.Model):
    SIGNAL_HOLIDAY = "holiday"
    SIGNAL_FX = "fx"
    SIGNAL_WEATHER = "weather"
    SIGNAL_SEASON = "season"
    SIGNAL_INFLATION = "inflation"
    SIGNAL_CAMPAIGN = "campaign"
    SIGNAL_OTHER = "other"
    SIGNAL_TYPE_CHOICES = (
        (SIGNAL_HOLIDAY, "Holiday"),
        (SIGNAL_FX, "Foreign exchange"),
        (SIGNAL_WEATHER, "Weather"),
        (SIGNAL_SEASON, "Season"),
        (SIGNAL_INFLATION, "Inflation"),
        (SIGNAL_CAMPAIGN, "Campaign"),
        (SIGNAL_OTHER, "Other"),
    )

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="external_signals")
    signal_type = models.CharField(max_length=24, choices=SIGNAL_TYPE_CHOICES)
    name = models.CharField(max_length=160)
    region = models.CharField(max_length=120, blank=True)
    observed_at = models.DateTimeField(default=timezone.now)
    numeric_value = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    text_value = models.CharField(max_length=240, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-observed_at", "signal_type"]
        indexes = [models.Index(fields=["organization", "signal_type", "observed_at"])]

    def __str__(self):
        return f"{self.get_signal_type_display()}: {self.name}"


class ExperimentObservation(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="experiment_observations")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="experiment_observations", null=True, blank=True)
    variant = models.CharField(max_length=80)
    assignment_ts = models.DateTimeField(default=timezone.now)
    holdout_group = models.BooleanField(default=False)
    reason_code = models.CharField(max_length=120, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-assignment_ts", "-created_at"]
        indexes = [models.Index(fields=["organization", "variant", "assignment_ts"])]

    def clean(self):
        if self.product_id and self.organization_id and self.product.organization_id != self.organization_id:
            raise ValidationError("Product and experiment observation must belong to the same organization.")

    def __str__(self):
        return f"{self.variant} ({'holdout' if self.holdout_group else 'test'})"


class PriceRecommendation(models.Model):
    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_REJECTED = "rejected"
    STATUS_APPLIED = "applied"
    STATUS_EXPIRED = "expired"
    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_APPLIED, "Applied"),
        (STATUS_EXPIRED, "Expired"),
    )

    CONFIDENCE_LOW = "low"
    CONFIDENCE_MEDIUM = "medium"
    CONFIDENCE_HIGH = "high"
    CONFIDENCE_CHOICES = (
        (CONFIDENCE_LOW, "Low"),
        (CONFIDENCE_MEDIUM, "Medium"),
        (CONFIDENCE_HIGH, "High"),
    )

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="price_recommendations")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="price_recommendations")
    current_price = models.DecimalField(max_digits=12, decimal_places=2)
    recommended_price = models.DecimalField(max_digits=12, decimal_places=2)
    minimum_allowed_price = models.DecimalField(max_digits=12, decimal_places=2)
    competitor_median_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    expected_gross_profit = models.DecimalField(max_digits=14, decimal_places=2)
    expected_margin_percent = models.DecimalField(max_digits=6, decimal_places=2)
    confidence_score = models.PositiveSmallIntegerField(default=0)
    confidence_level = models.CharField(max_length=10, choices=CONFIDENCE_CHOICES, default=CONFIDENCE_LOW)
    reason_code = models.CharField(max_length=80)
    explanation = models.TextField()
    input_snapshot = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pricing_recommendation_decisions",
    )

    class Meta:
        ordering = ["-created_at"]

    def clean(self):
        if self.recommended_price < self.minimum_allowed_price:
            raise ValidationError("Recommended price cannot be below minimum allowed price.")
        if self.product_id and self.organization_id and self.product.organization_id != self.organization_id:
            raise ValidationError("Product and recommendation must belong to the same organization.")

    def __str__(self):
        return f"{self.product}: {self.recommended_price} ({self.status})"


class PricingAuditLog(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="pricing_audit_logs")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=80)
    entity_type = models.CharField(max_length=80)
    entity_id = models.CharField(max_length=80)
    old_values = models.JSONField(default=dict, blank=True)
    new_values = models.JSONField(default=dict, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} {self.entity_type}:{self.entity_id}"
