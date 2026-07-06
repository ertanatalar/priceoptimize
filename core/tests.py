import os
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, override_settings
from django.test import TestCase
from django.urls import reverse

from config.settings import database_config_from_url
from core.models import UserSubscription


class PublicPageTests(SimpleTestCase):
    public_pages = [
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
            "smart_pricing",
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
        for route_name in ("portal", "home", "discount_optimizer", "smart_pricing", "ai_overview"):
            with self.subTest(route_name=route_name):
                response = self.client.get(reverse(route_name))
                self.assertEqual(response.status_code, 200)
                self.assertContains(response, 'type="application/ld+json"')
                self.assertContains(response, "PriceOptimize AI")

    def test_policy_pages_are_substantive_and_transparent(self):
        expected_terms = {
            "privacy_policy": (
                "Topladığımız bilgiler",
                "Analitik, reklam ve çerez teknolojileri",
                "Google AdSense",
                "admin@priceoptimize.ai",
            ),
            "terms_of_use": (
                "Hizmetin amacı",
                "Sonuçların niteliği",
                "Finansal, hukuki ve ticari tavsiye değildir",
                "Kullanıcı sorumlulukları",
            ),
            "cookies_policy": (
                "Zorunlu çerezler",
                "Analitik çerezleri",
                "Reklam çerezleri",
                "Çerezleri yönetme",
            ),
        }
        for route_name, terms in expected_terms.items():
            with self.subTest(route_name=route_name):
                response = self.client.get(reverse(route_name))
                self.assertEqual(response.status_code, 200)
                self.assertGreater(len(response.content.decode()), 2500)
                self.assertContains(response, 'rel="canonical"')
                self.assertContains(response, '<meta name="description"')
                for term in terms:
                    self.assertContains(response, term)

    def test_smart_pricing_returns_recommendation(self):
        response = self.client.post(
            reverse("smart_pricing"),
            {
                "product_name": "Test Product",
                "current_price": "899",
                "unit_cost": "690",
                "competitor_price": "835",
                "previous_sales": "120",
                "current_sales": "98",
                "target_margin": "18",
                "currency": "TRY",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Fiyat Guncelleme Onerisi")
        self.assertContains(response, "Onerilen Satis Fiyati")


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


class DatabaseConfigurationTests(SimpleTestCase):
    def test_mysql_database_url_builds_mysql_config(self):
        config = database_config_from_url(
            "mysql://price_user:secret%40pass@mysql.example.com:3307/price_db"
        )

        self.assertEqual(config["ENGINE"], "django.db.backends.mysql")
        self.assertEqual(config["NAME"], "price_db")
        self.assertEqual(config["USER"], "price_user")
        self.assertEqual(config["PASSWORD"], "secret@pass")
        self.assertEqual(config["HOST"], "mysql.example.com")
        self.assertEqual(config["PORT"], "3307")
        self.assertEqual(config["OPTIONS"]["charset"], "utf8mb4")


class BillingTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username="owner@example.com",
            email="owner@example.com",
            password="safe-password-123",
        )

    def test_authenticated_user_can_open_upgrade_page(self):
        self.client.login(username="owner@example.com", password="safe-password-123")
        response = self.client.get(reverse("upgrade"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "PriceOptimize AI Pro")
        self.assertContains(response, "LEMON_SQUEEZY_CHECKOUT_URL")

    @override_settings(DEBUG=True, LEMON_SQUEEZY_WEBHOOK_SECRET="")
    def test_local_webhook_can_activate_matching_user(self):
        payload = {
            "meta": {"event_name": "subscription_created"},
            "data": {
                "id": "sub_123",
                "type": "subscriptions",
                "attributes": {
                    "status": "active",
                    "user_email": "owner@example.com",
                    "customer_id": 456,
                    "variant_id": 789,
                    "product_id": 111,
                    "renews_at": "2026-08-01T00:00:00Z",
                },
            },
        }

        response = self.client.post(
            reverse("lemon_squeezy_webhook"),
            data=payload,
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        subscription = UserSubscription.objects.get(user=self.user)
        self.assertTrue(subscription.is_pro)
        self.assertEqual(subscription.subscription_id, "sub_123")
        self.assertEqual(subscription.variant_id, "789")

    @override_settings(DEBUG=False, LEMON_SQUEEZY_WEBHOOK_SECRET="")
    def test_production_webhook_without_secret_fails_loudly(self):
        response = self.client.post(
            reverse("lemon_squeezy_webhook"),
            data={"meta": {"event_name": "subscription_created"}},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 503)
