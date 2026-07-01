import os
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings
from django.urls import reverse


class PublicPageTests(SimpleTestCase):
    public_pages = [
        "portal",
        "home",
        "discount_optimizer",
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

    def test_public_pages_load_without_adsense_script(self):
        for route_name in self.public_pages:
            with self.subTest(route_name=route_name):
                response = self.client.get(reverse(route_name))
                self.assertEqual(response.status_code, 200)
                self.assertNotContains(response, "pagead2.googlesyndication.com")
                self.assertNotContains(response, "adsbygoogle")

    def test_sitemap_contains_editorial_pages(self):
        response = self.client.get(reverse("sitemap_xml"))
        self.assertEqual(response.status_code, 200)
        for route_name in (
            "about",
            "how_to",
            "faq",
            "contact",
            "ai_overview",
            "price_demand_guide",
            "discount_guide",
        ):
            self.assertContains(response, reverse(route_name))

    def test_ai_machine_readable_files_load(self):
        llms_response = self.client.get(reverse("llms_txt"))
        self.assertEqual(llms_response.status_code, 200)
        self.assertContains(llms_response, "PriceOptimize AI")
        self.assertContains(llms_response, "/price-demand/")
        self.assertContains(llms_response, "/ai-overview/")

        robots_response = self.client.get(reverse("robots_txt"))
        self.assertEqual(robots_response.status_code, 200)
        self.assertContains(robots_response, "/sitemap.xml")
        self.assertContains(robots_response, "/llms.txt")

    def test_core_pages_include_structured_data(self):
        for route_name in ("portal", "home", "discount_optimizer", "ai_overview"):
            with self.subTest(route_name=route_name):
                response = self.client.get(reverse(route_name))
                self.assertEqual(response.status_code, 200)
                self.assertContains(response, 'type="application/ld+json"')
                self.assertContains(response, "PriceOptimize AI")


class AdsTxtTests(SimpleTestCase):
    @patch.dict(os.environ, {"ADS_TXT_LINE": "google.com, pub-123, DIRECT, f08c47fec0942fa0"})
    def test_explicit_ads_txt_line(self):
        response = self.client.get(reverse("ads_txt"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.content.decode().strip(),
            "google.com, pub-123, DIRECT, f08c47fec0942fa0",
        )

    @override_settings(DEBUG=False)
    @patch.dict(os.environ, {}, clear=True)
    def test_missing_production_ads_configuration_fails_loudly(self):
        response = self.client.get(reverse("ads_txt"))
        self.assertEqual(response.status_code, 503)
        self.assertNotContains(response, "pub-0000000000000000", status_code=503)
