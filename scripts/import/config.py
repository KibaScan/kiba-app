"""
M3 Import Pipeline — Configuration & Supabase Client Setup

Environment variables loaded from .env file or shell environment.
Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS (data pipeline, not user code).
"""

import os
import sys
from pathlib import Path

# Load .env if python-dotenv available
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass

from supabase import create_client, Client


# ─── Required Environment Variables ────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
    print("Set them in .env or export them in your shell.")
    sys.exit(1)

# ─── Constants ─────────────────────────────────────────────────

BATCH_SIZE = 100
JSON_PATH = Path(__file__).resolve().parent.parent.parent / "dataset_kiba_v6_merged.json"
ERROR_LOG_PATH = Path(__file__).resolve().parent / "import_errors.json"

# ─── Supabase Client ──────────────────────────────────────────

def get_client() -> Client:
    """Create Supabase client with service role key (bypasses RLS)."""
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
