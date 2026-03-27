from django.urls import path

from .views import discount_optimizer, home

urlpatterns = [
    path('', home, name='home'),
    path('discount-optimizer/', discount_optimizer, name='discount_optimizer'),
]
