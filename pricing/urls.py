from django.urls import path

from . import views

urlpatterns = [
    path("", views.pricing_assistant, name="pricing_assistant"),
    path("recommendations/<int:recommendation_id>/accept/", views.accept_recommendation_html, name="pricing_recommendation_accept"),
    path("recommendations/<int:recommendation_id>/reject/", views.reject_recommendation_html, name="pricing_recommendation_reject"),
]
