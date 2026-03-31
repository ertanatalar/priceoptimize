import os


def analytics_settings(request):
    adsense_client_id = os.getenv("ADSENSE_CLIENT_ID", "").strip()
    return {
        "ga_measurement_id": os.getenv("GA_MEASUREMENT_ID", "").strip(),
        "adsense_client_id": adsense_client_id,
        "adsense_script_enabled": adsense_client_id.startswith("ca-pub-"),
    }
