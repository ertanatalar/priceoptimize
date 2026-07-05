from django.urls import path

from .views import discount_optimizer, home, smart_pricing

urlpatterns = [
    path('', home, name='home'),
    path('discount-optimizer/', discount_optimizer, name='discount_optimizer'),
    path('smart-pricing/', smart_pricing, name='smart_pricing'),
]
