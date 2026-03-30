"""
Product size parser — converts scraped size strings to weight in kg.

Shared by import_products.py, add_products.py, and backfill_price_size.py.

Conservative: returns None for anything ambiguous (count/pack items, bundles,
variety packs). NULL is better than wrong for price-per-kg calculations.
"""

import re
from typing import Optional


def parse_size_to_kg(size_str: Optional[str]) -> Optional[float]:
    """Parse product size string to weight in kg.

    Handles common patterns from Chewy/Amazon/Walmart scrapes:
      '44-lb'   → 19.958      '32-oz'   → 0.907
      '3.5 oz'  → 0.099       '12.7oz'  → 0.360
      '4lb'     → 1.814       '26LB'    → 11.793
      '60-g'    → 0.060       '180g'    → 0.180
      '12 kg'   → 12.0        '22 -lb'  → 9.979

    Returns None for:
      '30 count', '6-Pack', '2 Pack', '60 ct'  (count/pack items)
      '', None                                   (missing data)
    """
    if not size_str or not isinstance(size_str, str):
        return None

    s = size_str.strip()

    m = re.match(
        r'^([\d.]+)\s*-?\s*(lb|lbs|oz|kg|g)\s*$',
        s,
        re.IGNORECASE
    )
    if not m:
        return None

    val = float(m.group(1))
    if val <= 0:
        return None

    unit = m.group(2).lower()
    if unit in ('lb', 'lbs'):
        return round(val * 0.453592, 3)
    elif unit == 'oz':
        return round(val * 0.0283495, 3)
    elif unit == 'kg':
        return round(val, 3)
    elif unit == 'g':
        return round(val / 1000, 3)

    return None
