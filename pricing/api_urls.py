from django.urls import path

from . import views

urlpatterns = [
    path("products/<int:product_id>/pricing-profile/", views.pricing_profile_api, name="pricing_api_profile"),
    path("products/<int:product_id>/competitor-prices/", views.competitor_prices_api, name="pricing_api_competitors"),
    path("products/<int:product_id>/sales-snapshots/", views.sales_snapshots_api, name="pricing_api_sales"),
    path("products/<int:product_id>/recommendations/generate/", views.recommendations_api, name="pricing_api_generate_recommendation"),
    path("products/<int:product_id>/recommendations/", views.recommendations_api, name="pricing_api_recommendations"),
    path("recommendations/<int:recommendation_id>/", views.recommendation_detail_api, name="pricing_api_recommendation_detail"),
    path("recommendations/<int:recommendation_id>/accept/", views.accept_recommendation_api, name="pricing_api_accept_recommendation"),
    path("recommendations/<int:recommendation_id>/reject/", views.reject_recommendation_api, name="pricing_api_reject_recommendation"),
]
