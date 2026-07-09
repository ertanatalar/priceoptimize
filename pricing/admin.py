from django.contrib import admin

from .models import (
    ChannelMetadata,
    CompetitorPriceSnapshot,
    CustomerAccountSignal,
    ExperimentObservation,
    ExternalSignal,
    Organization,
    OrganizationMembership,
    PriceRecommendation,
    PricingAuditLog,
    Product,
    ProductPricingProfile,
    Promotion,
    SalesSnapshot,
    StockSnapshot,
    TransactionRecord,
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
    list_display = ("name", "organization", "sku", "brand", "category", "lifecycle_stage", "is_active", "updated_at")
    list_filter = ("is_active", "lifecycle_stage", "category")
    search_fields = ("name", "title", "sku", "product_id", "brand", "organization__name")


@admin.register(ProductPricingProfile)
class ProductPricingProfileAdmin(admin.ModelAdmin):
    list_display = ("product", "organization", "currency", "cost_price", "current_price", "minimum_margin_percent", "is_pricing_active")
    list_filter = ("currency", "is_pricing_active")


@admin.register(CompetitorPriceSnapshot)
class CompetitorPriceSnapshotAdmin(admin.ModelAdmin):
    list_display = ("product", "competitor_name", "price", "currency", "stock_status", "captured_at")
    list_filter = ("currency", "stock_status", "captured_at")
    search_fields = ("competitor_name", "competitor_id", "source_url", "matched_url", "product__name")


@admin.register(SalesSnapshot)
class SalesSnapshotAdmin(admin.ModelAdmin):
    list_display = ("product", "period_start", "period_end", "units_sold", "revenue")


@admin.register(TransactionRecord)
class TransactionRecordAdmin(admin.ModelAdmin):
    list_display = ("product", "sku", "channel", "qty", "net_price", "discount", "timestamp")
    list_filter = ("channel", "currency", "timestamp")
    search_fields = ("sku", "order_id", "product__name", "organization__name")


@admin.register(StockSnapshot)
class StockSnapshotAdmin(admin.ModelAdmin):
    list_display = ("product", "warehouse_id", "on_hand", "reserved", "lead_time_days", "stockout_flag", "captured_at")
    list_filter = ("stockout_flag", "warehouse_id", "captured_at")
    search_fields = ("warehouse_id", "product__name", "organization__name")


@admin.register(Promotion)
class PromotionAdmin(admin.ModelAdmin):
    list_display = ("promo_id", "organization", "product", "promo_type", "discount_depth", "start_at", "end_at", "media_support")
    list_filter = ("promo_type", "media_support", "start_at")
    search_fields = ("promo_id", "product__name", "organization__name")


@admin.register(ChannelMetadata)
class ChannelMetadataAdmin(admin.ModelAdmin):
    list_display = ("channel_name", "organization", "vat_mode", "min_price", "max_price", "update_limit", "currency")
    list_filter = ("vat_mode", "currency")
    search_fields = ("channel_name", "organization__name")


@admin.register(CustomerAccountSignal)
class CustomerAccountSignalAdmin(admin.ModelAdmin):
    list_display = ("account_hash", "organization", "segment", "region", "contract_flag", "created_at")
    list_filter = ("segment", "region", "contract_flag")
    search_fields = ("account_hash", "segment", "region", "organization__name")


@admin.register(ExternalSignal)
class ExternalSignalAdmin(admin.ModelAdmin):
    list_display = ("signal_type", "name", "organization", "region", "observed_at", "numeric_value")
    list_filter = ("signal_type", "region", "observed_at")
    search_fields = ("name", "region", "organization__name")


@admin.register(ExperimentObservation)
class ExperimentObservationAdmin(admin.ModelAdmin):
    list_display = ("variant", "organization", "product", "holdout_group", "reason_code", "assignment_ts")
    list_filter = ("holdout_group", "variant", "assignment_ts")
    search_fields = ("variant", "reason_code", "product__name", "organization__name")


@admin.register(PriceRecommendation)
class PriceRecommendationAdmin(admin.ModelAdmin):
    list_display = ("product", "recommended_price", "confidence_level", "status", "created_at", "decided_by")
    list_filter = ("status", "confidence_level", "reason_code")


@admin.register(PricingAuditLog)
class PricingAuditLogAdmin(admin.ModelAdmin):
    list_display = ("organization", "action", "entity_type", "entity_id", "user", "created_at")
    list_filter = ("action", "entity_type")
    readonly_fields = ("created_at",)
