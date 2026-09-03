"""Read-only access to the MCA company registry (DuckDB) and the GSTIN
state-code table, including the historical-name aliases."""
from __future__ import annotations

import os
import re
import threading
from pathlib import Path
from typing import Optional

import duckdb

_DB_ENV = "PROVENANCE_DB"


def _find_db() -> str:
    cand = os.environ.get(_DB_ENV)
    if cand and Path(cand).exists():
        return cand
    here = Path(__file__).resolve().parent
    for p in (here / "mca.duckdb", here.parent / "mca.duckdb"):
        if p.exists():
            return str(p)
    raise FileNotFoundError(
        "mca.duckdb not found. Set PROVENANCE_DB or place the file next to "
        "the project folder."
    )


_conn = None
_lock = threading.RLock()


def _con() -> duckdb.DuckDBPyConnection:
    global _conn
    with _lock:
        if _conn is None:
            _conn = duckdb.connect(_find_db(), read_only=True)
        return _conn


COMPANY_COLS = (
    "cin name roc category company_class authorized_capital paidup_capital "
    "registration_date address listing_status status state_name "
    "indian_or_foreign nic_code industry"
).split()


def lookup_cin(cin: str) -> Optional[dict]:
    """Fetch the registry row for a CIN / LLPIN, or None if absent."""
    with _lock:
        row = _con().execute(
            "SELECT * FROM companies WHERE upper(cin) = upper(?)", [cin.strip()]
        ).fetchone()
    if row is None:
        return None
    d = dict(zip(COMPANY_COLS, row))
    if d.get("registration_date") is not None:
        d["registration_date"] = d["registration_date"].isoformat()
    return d


def search_name(name: str, limit: int = 5) -> list:
    """Loose name search, used when a dossier gives a name but no CIN."""
    with _lock:
        rows = _con().execute(
            "SELECT cin, name, state_name, registration_date, status, nic_code "
            "FROM companies WHERE name ILIKE ? LIMIT ?",
            [f"%{name.strip()}%", limit],
        ).fetchall()
    return [
        {
            "cin": r[0], "name": r[1], "state_name": r[2],
            "registration_date": r[3].isoformat() if r[3] else None,
            "status": r[4], "nic_code": r[5],
        }
        for r in rows
    ]


# -- GST state codes ---------------------------------------------------------

# Aliases: historical / variant state names -> the canonical name used in
# gst_state (or, for the merged UT, the code directly).
_NAME_ALIASES = {
    "orissa": "odisha",
    "pondicherry": "puducherry",
    "chattisgarh": "chhattisgarh",
    "jammu & kashmir": "jammu and kashmir",
    "dadra & nagar haveli": "dadra and nagar haveli and daman and diu",
    "dadra and nagar haveli": "dadra and nagar haveli and daman and diu",
    "daman and diu": "dadra and nagar haveli and daman and diu",
    "daman & diu": "dadra and nagar haveli and daman and diu",
}


def _norm(name: str) -> str:
    s = name.strip().lower().replace("&", "and")
    s = re.sub(r"[^a-z ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


_state_maps = None


def _load_states() -> tuple:
    global _state_maps
    if _state_maps is None:
        with _lock:
            rows = _con().execute("SELECT code, state_name FROM gst_state").fetchall()
        code_to_name = {c: n for c, n in rows}
        name_to_code = {_norm(n): c for c, n in rows}
        for alias, target in _NAME_ALIASES.items():
            canon = _norm(target)
            if canon in name_to_code:
                name_to_code[_norm(alias)] = name_to_code[canon]
        _state_maps = (code_to_name, name_to_code)
    return _state_maps


def state_name_for_code(code: str) -> Optional[str]:
    return _load_states()[0].get(code)


def code_for_state_name(name: str) -> Optional[str]:
    return _load_states()[1].get(_norm(name))


def states_equivalent(a: str, b: str) -> bool:
    """True when two state names refer to the same GST state (alias-aware)."""
    ca, cb = code_for_state_name(a), code_for_state_name(b)
    if ca is not None and cb is not None:
        return ca == cb
    return _norm(a) == _norm(b)
