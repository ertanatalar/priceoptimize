from decimal import Decimal

from django.core.exceptions import ValidationError


def validate_positive_decimal(value):
    if value is None or Decimal(value) <= Decimal("0"):
        raise ValidationError("Value must be greater than zero.")


def validate_non_negative_decimal(value):
    if value is None or Decimal(value) < Decimal("0"):
        raise ValidationError("Value cannot be negative.")


def validate_non_negative_int(value):
    if value is None or int(value) < 0:
        raise ValidationError("Value cannot be negative.")


def validate_margin_percent(value):
    value = Decimal(value)
    if value < Decimal("0") or value >= Decimal("99"):
        raise ValidationError("Minimum margin must be between 0 and 99.")
