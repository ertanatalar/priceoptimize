import os

from django.contrib import admin
from django.urls import include, path
from django.views.i18n import set_language

from core.views import portal

admin_path = os.getenv("DJANGO_ADMIN_PATH", "admin/").lstrip("/")
if not admin_path.endswith("/"):
    admin_path += "/"

urlpatterns = [
    path(admin_path, admin.site.urls),
    path('i18n/setlang/', set_language, name='set_language'),
    path('', portal, name='portal'),
    path('price-demand/', include('core.urls')),
]
