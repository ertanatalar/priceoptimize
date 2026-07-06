from django.contrib import admin

from .models import UserSubscription


@admin.register(UserSubscription)
class UserSubscriptionAdmin(admin.ModelAdmin):
    list_display = ("user", "plan", "status", "provider", "subscription_id", "updated_at")
    list_filter = ("plan", "status", "provider")
    search_fields = ("user__username", "user__email", "user_email", "subscription_id", "customer_id")
    readonly_fields = ("created_at", "updated_at")
