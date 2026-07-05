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
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="products")
    name = models.CharField(max_length=220)
    sku = models.CharField(max_length=80, blank=True)
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
    current_price = models.DecimalField(max_digits=12, decimal_places=2, validators=[validate_positive_decimal])
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
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="competitor_price_snapshots")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="competitor_price_snapshots")
    competitor_name = models.CharField(max_length=160)
    source_name = models.CharField(max_length=160, blank=True)
    source_url = models.URLField(blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2, validators=[validate_positive_decimal])
    currency = models.CharField(max_length=3, default="TRY")
    captured_at = models.DateTimeField(default=timezone.now)
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
