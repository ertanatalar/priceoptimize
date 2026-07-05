from django.contrib import admin

from .models import (
    CompetitorPriceSnapshot,
    Organization,
    OrganizationMembership,
    PriceRecommendation,
    PricingAuditLog,
    Product,
    ProductPricingProfile,
    SalesSnapshot,
)


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "owner", "created_at")
    search_fields = ("name", "slug", "owner__username")


@admin.register(OrganizationMembership)
class OrganizationMembershipAdmin(admin.ModelAdmin):
    list_display = ("organization", "user", "role", "created_at")
    list_filter = ("role",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "sku", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name", "sku", "organization__name")


@admin.register(ProductPricingProfile)
class ProductPricingProfileAdmin(admin.ModelAdmin):
    list_display = ("product", "organization", "currency", "cost_price", "current_price", "minimum_margin_percent", "is_pricing_active")
    list_filter = ("currency", "is_pricing_active")


@admin.register(CompetitorPriceSnapshot)
class CompetitorPriceSnapshotAdmin(admin.ModelAdmin):
    list_display = ("product", "competitor_name", "price", "currency", "captured_at")
    list_filter = ("currency", "captured_at")


@admin.register(SalesSnapshot)
class SalesSnapshotAdmin(admin.ModelAdmin):
    list_display = ("product", "period_start", "period_end", "units_sold", "revenue")


@admin.register(PriceRecommendation)
class PriceRecommendationAdmin(admin.ModelAdmin):
    list_display = ("product", "recommended_price", "confidence_level", "status", "created_at", "decided_by")
    list_filter = ("status", "confidence_level", "reason_code")


@admin.register(PricingAuditLog)
class PricingAuditLogAdmin(admin.ModelAdmin):
    list_display = ("organization", "action", "entity_type", "entity_id", "user", "created_at")
    list_filter = ("action", "entity_type")
    readonly_fields = ("created_at",)
