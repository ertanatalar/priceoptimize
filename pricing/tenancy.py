from django.utils.text import slugify

from .models import Organization, OrganizationMembership, PricingAuditLog


def get_user_organizations(user):
    if not user.is_authenticated:
        return Organization.objects.none()
    return Organization.objects.filter(memberships__user=user).distinct()


def get_or_create_default_organization(user):
    existing = get_user_organizations(user).first()
    if existing:
        return existing

    base_slug = slugify(user.get_username() or f"user-{user.pk}") or f"user-{user.pk}"
    slug = base_slug
    counter = 1
    while Organization.objects.filter(slug=slug).exists():
        counter += 1
        slug = f"{base_slug}-{counter}"

    organization = Organization.objects.create(
        name=f"{user.get_username()} organization",
        slug=slug,
        owner=user,
    )
    OrganizationMembership.objects.create(
        organization=organization,
        user=user,
        role=OrganizationMembership.ROLE_OWNER,
    )
    return organization


def log_pricing_action(organization, user, action, entity, old_values=None, new_values=None, metadata=None):
    PricingAuditLog.objects.create(
        organization=organization,
        user=user if getattr(user, "is_authenticated", False) else None,
        action=action,
        entity_type=entity.__class__.__name__,
        entity_id=str(entity.pk),
        old_values=old_values or {},
        new_values=new_values or {},
        metadata=metadata or {},
    )
