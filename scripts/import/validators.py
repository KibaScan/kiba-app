"""
M3 Import Pipeline — Record Validation

Validates each JSON record before insertion into Supabase.
Invalid records are collected with error reasons for import_errors.json.
"""

from typing import Optional

VALID_CATEGORIES = {"daily_food", "treat", "supplement"}
VALID_SPECIES = {"dog", "cat"}


def validate_record(record: dict, index: int) -> Optional[dict]:
    """Validate a single JSON record.

    Returns an error dict if validation fails, None if valid.
    Error dict: {"index": int, "product_name": str, "errors": list[str]}
    """
    errors: list[str] = []

    # Required fields
    if not record.get("brand"):
        errors.append("missing required field: brand")
    if not record.get("product_name"):
        errors.append("missing required field: product_name")

    category = record.get("category")
    if not category:
        errors.append("missing required field: category")
    elif category not in VALID_CATEGORIES:
        errors.append(f"invalid category: '{category}' (must be one of {VALID_CATEGORIES})")

    species = record.get("target_species")
    if not species:
        errors.append("missing required field: target_species")
    elif species not in VALID_SPECIES:
        errors.append(f"invalid target_species: '{species}' (must be 'dog' or 'cat')")

    if errors:
        return {
            "index": index,
            "product_name": record.get("product_name", "<unknown>"),
            "brand": record.get("brand", "<unknown>"),
            "errors": errors,
        }

    return None
