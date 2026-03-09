from django.contrib import admin
from django.urls import include, path
from django.views.i18n import set_language

from core.views import portal

urlpatterns = [
    path('admin/', admin.site.urls),
    path('i18n/setlang/', set_language, name='set_language'),
    path('', portal, name='portal'),
    path('price-demand/', include('core.urls')),
]
