import os

from django.contrib import admin
from django.urls import include, path
from django.views.i18n import set_language

from core.views import ads_txt, portal, privacy_policy

admin_path = os.getenv("DJANGO_ADMIN_PATH", "admin/").lstrip("/")
if not admin_path.endswith("/"):
    admin_path += "/"

urlpatterns = [
    path(admin_path, admin.site.urls),
    path('i18n/setlang/', set_language, name='set_language'),
    path("ads.txt", ads_txt, name="ads_txt"),
    path("privacy/", privacy_policy, name="privacy_policy"),
    path('', portal, name='portal'),
    path('price-demand/', include('core.urls')),
]
