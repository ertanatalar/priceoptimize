import os

from django.contrib import admin
from django.urls import include, path
from django.views.i18n import set_language

from core.views import (
    ads_txt,
    cookies_policy,
    portal,
    privacy_policy,
    publisher_page,
    robots_txt,
    sign_in,
    sign_out,
    sign_up,
    sitemap_xml,
    terms_of_use,
)

admin_path = os.getenv("DJANGO_ADMIN_PATH", "admin/").lstrip("/")
if not admin_path.endswith("/"):
    admin_path += "/"

urlpatterns = [
    path(admin_path, admin.site.urls),
    path('i18n/setlang/', set_language, name='set_language'),
    path("ads.txt", ads_txt, name="ads_txt"),
    path("ads.txt/", ads_txt),
    path("sitemap.xml", sitemap_xml, name="sitemap_xml"),
    path("robots.txt", robots_txt, name="robots_txt"),
    path("privacy/", privacy_policy, name="privacy_policy"),
    path("terms/", terms_of_use, name="terms_of_use"),
    path("cookies/", cookies_policy, name="cookies_policy"),
    path("about/", publisher_page, {"slug": "about"}, name="about"),
    path("how-to/", publisher_page, {"slug": "how-to"}, name="how_to"),
    path("faq/", publisher_page, {"slug": "faq"}, name="faq"),
    path("contact/", publisher_page, {"slug": "contact"}, name="contact"),
    path("signin/", sign_in, name="sign_in"),
    path("signup/", sign_up, name="sign_up"),
    path("signout/", sign_out, name="sign_out"),
    path(
        "guides/price-demand/",
        publisher_page,
        {"slug": "price-demand-guide"},
        name="price_demand_guide",
    ),
    path(
        "guides/discount-optimizer/",
        publisher_page,
        {"slug": "discount-guide"},
        name="discount_guide",
    ),
    path('', portal, name='portal'),
    path('price-demand/', include('core.urls')),
]
