#!/usr/bin/env python3
"""Run a local AdSense readiness smoke check for public pages."""

import os
import sys
from pathlib import Path

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import django  # noqa: E402
from django.test import Client  # noqa: E402
from django.test.utils import override_settings  # noqa: E402
from django.urls import reverse  # noqa: E402


PUBLIC_ROUTES = [
    "portal",
    "home",
    "discount_optimizer",
    "smart_pricing",
    "about",
    "how_to",
    "faq",
    "contact",
    "ai_overview",
    "price_demand_guide",
    "discount_guide",
    "privacy_policy",
    "terms_of_use",
    "cookies_policy",
]


def fail(message):
    print(f"FAIL: {message}")
    return False


def check_public_page(client, route_name):
    path = reverse(route_name)
    response = client.get(path)
    body = response.content.decode("utf-8", errors="replace")
    ok = True

    if response.status_code != 200:
        ok = fail(f"{path} returned {response.status_code}")
    if "<title>" not in body:
        ok = fail(f"{path} is missing a title tag")
    if '<meta name="description"' not in body:
        ok = fail(f"{path} is missing a meta description")
    if 'rel="canonical"' not in body:
        ok = fail(f"{path} is missing a canonical URL")
    if "pagead2.googlesyndication.com" in body or "adsbygoogle" in body:
        ok = fail(f"{path} contains an AdSense script before approval")

    if ok:
        print(f"OK: {path}")
    return ok


def check_static_endpoint(client, route_name, required_text):
    path = reverse(route_name)
    response = client.get(path)
    body = response.content.decode("utf-8", errors="replace")
    if response.status_code != 200:
        return fail(f"{path} returned {response.status_code}")
    if required_text not in body:
        return fail(f"{path} does not contain expected text: {required_text}")
    print(f"OK: {path}")
    return True


def main():
    django.setup()
    client = Client()
    checks = []

    with override_settings(
        ALLOWED_HOSTS=[
            "testserver",
            "localhost",
            "127.0.0.1",
            "priceoptimize.ai",
            "www.priceoptimize.ai",
            "priceoptimize.onrender.com",
        ]
    ):
        for route_name in PUBLIC_ROUTES:
            checks.append(check_public_page(client, route_name))

        checks.append(check_static_endpoint(client, "robots_txt", "Sitemap:"))
        checks.append(check_static_endpoint(client, "sitemap_xml", "<urlset"))
        checks.append(check_static_endpoint(client, "llms_txt", "PriceOptimize AI"))
        checks.append(check_static_endpoint(client, "ads_txt", "ads.txt"))

    if all(checks):
        print("\nAdSense readiness smoke check passed.")
        return 0
    print("\nAdSense readiness smoke check failed.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
