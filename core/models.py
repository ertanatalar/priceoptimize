from django.conf import settings
from django.db import models


class UserSubscription(models.Model):
    PLAN_FREE = "free"
    PLAN_PRO = "pro"

    STATUS_INACTIVE = "inactive"
    STATUS_ACTIVE = "active"
    STATUS_PAST_DUE = "past_due"
    STATUS_CANCELLED = "cancelled"
    STATUS_EXPIRED = "expired"

    PLAN_CHOICES = [
        (PLAN_FREE, "Free"),
        (PLAN_PRO, "Pro"),
    ]
    STATUS_CHOICES = [
        (STATUS_INACTIVE, "Inactive"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_PAST_DUE, "Past due"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_EXPIRED, "Expired"),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="subscription",
    )
    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default=PLAN_FREE)
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default=STATUS_INACTIVE)
    provider = models.CharField(max_length=40, default="lemon_squeezy")
    customer_id = models.CharField(max_length=80, blank=True)
    subscription_id = models.CharField(max_length=80, blank=True)
    order_id = models.CharField(max_length=80, blank=True)
    product_id = models.CharField(max_length=80, blank=True)
    variant_id = models.CharField(max_length=80, blank=True)
    user_email = models.EmailField(blank=True)
    renews_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    raw_payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["subscription_id"]),
            models.Index(fields=["customer_id"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.user} - {self.plan} ({self.status})"

    @property
    def is_pro(self) -> bool:
        return self.plan == self.PLAN_PRO and self.status == self.STATUS_ACTIVE
