import os


def analytics_settings(request):
    adsense_client_id = os.getenv("ADSENSE_CLIENT_ID", "").strip()
    return {
        "ga_measurement_id": os.getenv("GA_MEASUREMENT_ID", "").strip(),
        "adsense_client_id": adsense_client_id,
        "adsense_script_enabled": adsense_client_id.startswith("ca-pub-"),
    }


def billing_settings(request):
    subscription = None
    is_pro_user = False
    if getattr(request, "user", None) is not None and request.user.is_authenticated:
        try:
            subscription = request.user.subscription
            is_pro_user = subscription.is_pro
        except Exception:
            subscription = None

    return {
        "current_subscription": subscription,
        "is_pro_user": is_pro_user,
        "lemon_checkout_configured": bool(os.getenv("LEMON_SQUEEZY_CHECKOUT_URL", "").strip()),
    }
