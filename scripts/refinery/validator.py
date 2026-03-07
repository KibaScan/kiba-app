"""
M3 LLM Nutritional Refinery — GA Validation (D-043)

Validates Haiku-extracted Guaranteed Analysis values before DB insertion.
Values are as-fed (the scoring engine handles DMB conversion internally).

Range checks based on NUTRITIONAL_PROFILE_BUCKET_SPEC.md thresholds
and real-world pet food label ranges.
"""

from typing import Optional


# ─── Absolute bounds (reject if outside) ─────────────────────

RANGES = {
    "protein_min_pct":  (0.0, 80.0),
    "fat_min_pct":      (0.0, 50.0),
    "fiber_max_pct":    (0.0, 30.0),
    "moisture_max_pct": (0.0, 85.0),
    "kcal_per_cup":     (100, 7000),
    "kcal_per_kg":      (100, 7000),
}

# ─── Typical ranges (flag as suspicious but don't reject) ────

TYPICAL_RANGES = {
    "protein_min_pct":  (5.0, 55.0),
    "fat_min_pct":      (2.0, 30.0),
    "fiber_max_pct":    (0.5, 15.0),
    "moisture_max_pct": (5.0, 82.0),
    "kcal_per_cup":     (200, 600),
    "kcal_per_kg":      (2000, 5500),
}


def validate_ga_values(
    values: dict,
    product_form: Optional[str] = None,
) -> tuple[bool, list[str], list[str]]:
    """Validate extracted GA values.

    Args:
        values: Dict with keys matching RANGES (protein_min_pct, etc.)
        product_form: 'dry', 'wet', 'semi_moist', 'treat', or None

    Returns:
        (is_valid, errors, warnings)
        - is_valid: False if ANY value is out of absolute range → reject
        - errors: List of hard failures (out-of-range)
        - warnings: List of suspicious values (outside typical range)
    """
    errors: list[str] = []
    warnings: list[str] = []

    non_null_count = 0

    for field, (lo, hi) in RANGES.items():
        val = values.get(field)
        if val is None:
            continue

        non_null_count += 1

        # Type check
        if not isinstance(val, (int, float)):
            errors.append(f"{field}: not a number ({val!r})")
            continue

        # Absolute range check
        if val < lo or val > hi:
            errors.append(f"{field}: {val} out of range [{lo}, {hi}]")
            continue

        # Typical range check
        typ_lo, typ_hi = TYPICAL_RANGES[field]
        if val < typ_lo or val > typ_hi:
            warnings.append(f"{field}: {val} outside typical range [{typ_lo}, {typ_hi}]")

    # Cross-validation: moisture vs product_form
    moisture = values.get("moisture_max_pct")
    if moisture is not None and product_form:
        if product_form == "dry" and moisture > 60:
            errors.append(
                f"moisture {moisture}% for dry product — likely wrong extraction"
            )
        elif product_form == "wet" and moisture < 40:
            warnings.append(
                f"moisture {moisture}% for wet product — unusually low"
            )

    # Cross-validation: protein + fat + fiber + moisture should not exceed 100%
    prot = values.get("protein_min_pct")
    fat = values.get("fat_min_pct")
    fiber = values.get("fiber_max_pct")
    moist = values.get("moisture_max_pct")
    if all(v is not None for v in [prot, fat, fiber, moist]):
        total = prot + fat + fiber + moist
        if total > 100:
            errors.append(
                f"protein({prot}) + fat({fat}) + fiber({fiber}) + moisture({moist}) "
                f"= {total:.1f}% > 100% — impossible"
            )

    is_valid = len(errors) == 0 and non_null_count > 0
    return is_valid, errors, warnings
