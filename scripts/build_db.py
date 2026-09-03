"""Build mca.duckdb from the MCA Company Master Data CSV.

The database is ~1.5 GB and is NOT committed to git — every clone rebuilds it
locally from the public dataset with this one script.

Where the data comes from
-------------------------
data.gov.in > "Company Master Data" (Ministry of Corporate Affairs).
Full national CSV, ~1.05 GB, ~3.67M companies (snapshot used: 2026-07-22).
Free download with a free API key / login. Direct portal search on mca.gov.in
is captcha-gated; the bulk CSV is the reliable route.

Usage
-----
    python scripts/build_db.py "path/to/mca_company_master_data.csv"
    python scripts/build_db.py "path/to/data.csv" --out ../mca.duckdb

By default the database is written to the project root (mca.duckdb), which
registry.py finds automatically (it checks, in order: the PROVENANCE_DB env
var, the project folder, then the project's parent folder). Use --out to
place it elsewhere and set PROVENANCE_DB accordingly.

What it does
------------
1. Loads the raw CSV (16 columns, header row expected — see EXPECTED_COLS).
2. Builds the `companies` table the app queries: renamed columns, UPPER'd
   names, lowercased state names, capitals cast to DOUBLE, and registration
   dates outside 1850..today set to NULL (the raw registry contains ~3,132
   rows with impossible dates like year 1111 or 9076 — we treat those as
   "date unknown" rather than trusting or rejecting the row).
3. Builds the `gst_state` table (GSTIN 2-digit state codes -> state names).
   Historical spellings (orissa, pondicherry, chattisgarh, jammu & kashmir,
   dadra & nagar haveli, daman and diu) are handled at query time by
   registry.py's alias map — the table stores canonical names only.
4. Indexes cin and name, drops the raw staging table, compacts the file.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import duckdb

EXPECTED_COLS = [
    "CIN", "CompanyName", "CompanyROCcode", "CompanyCategory",
    "CompanySubCategory", "CompanyClass", "AuthorizedCapital",
    "PaidupCapital", "CompanyRegistrationdate_date",
    "Registered_Office_Address", "Listingstatus", "CompanyStatus",
    "CompanyStateCode", "CompanyIndian/Foreign Company", "nic_code",
    "CompanyIndustrialClassification",
]

GST_STATES = [
    ("01", "jammu and kashmir"), ("02", "himachal pradesh"), ("03", "punjab"),
    ("04", "chandigarh"), ("05", "uttarakhand"), ("06", "haryana"),
    ("07", "delhi"), ("08", "rajasthan"), ("09", "uttar pradesh"),
    ("10", "bihar"), ("11", "sikkim"), ("12", "arunachal pradesh"),
    ("13", "nagaland"), ("14", "manipur"), ("15", "mizoram"),
    ("16", "tripura"), ("17", "meghalaya"), ("18", "assam"),
    ("19", "west bengal"), ("20", "jharkhand"), ("21", "odisha"),
    ("22", "chhattisgarh"), ("23", "madhya pradesh"), ("24", "gujarat"),
    ("26", "dadra and nagar haveli and daman and diu"), ("27", "maharashtra"),
    ("29", "karnataka"), ("30", "goa"), ("31", "lakshadweep"),
    ("32", "kerala"), ("33", "tamil nadu"), ("34", "puducherry"),
    ("35", "andaman and nicobar islands"), ("36", "telangana"),
    ("37", "andhra pradesh"), ("38", "ladakh"),
]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("csv", help="path to the MCA Company Master Data CSV")
    default_out = Path(__file__).resolve().parents[1] / "mca.duckdb"
    ap.add_argument("--out", default=str(default_out),
                    help=f"output database path (default: {default_out})")
    ap.add_argument("--snapshot-date", default=None,
                    help="the dataset's snapshot date (YYYY-MM-DD) as shown "
                         "on data.gov.in; stored as DB metadata and quoted "
                         "in registry findings")
    args = ap.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        print(f"CSV not found: {csv_path}")
        return 1
    print(f"[1] Loading {csv_path.name} "
          f"({csv_path.stat().st_size / 1e6:,.0f} MB)…")

    con = duckdb.connect(args.out)
    con.execute("DROP TABLE IF EXISTS mca_raw")
    con.execute(
        "CREATE TABLE mca_raw AS SELECT * FROM read_csv(?, header=true, "
        "all_varchar=true, ignore_errors=true)", [str(csv_path)])

    cols = [r[0] for r in con.execute("DESCRIBE mca_raw").fetchall()]
    missing = [c for c in EXPECTED_COLS if c not in cols]
    if missing:
        print(f"    WARNING: expected columns missing from CSV: {missing}")
        print("    (data.gov.in occasionally renames headers — adjust the "
              "SELECT below to match your snapshot)")
    n = con.execute("SELECT count(*) FROM mca_raw").fetchone()[0]
    print(f"    loaded {n:,} rows")
    if n < 3_000_000:
        print("    WARNING: well under 3M rows — you may have a partial or "
              "state-wise extract, not the full national dataset.")

    print("[2] Building `companies` (typed, cleaned)…")
    con.execute("DROP TABLE IF EXISTS companies")
    con.execute("""
        CREATE TABLE companies AS
        SELECT
            CIN                                   AS cin,
            upper(trim(CompanyName))              AS name,
            CompanyROCcode                        AS roc,
            CompanyCategory                       AS category,
            CompanyClass                          AS company_class,
            try_cast(AuthorizedCapital AS DOUBLE) AS authorized_capital,
            try_cast(PaidupCapital AS DOUBLE)     AS paidup_capital,
            CASE
                WHEN try_strptime(CompanyRegistrationdate_date, '%Y-%m-%d')
                     BETWEEN TIMESTAMP '1850-01-01' AND now()
                THEN CAST(try_strptime(CompanyRegistrationdate_date,
                                       '%Y-%m-%d') AS DATE)
                ELSE NULL
            END                                   AS registration_date,
            Registered_Office_Address             AS address,
            Listingstatus                         AS listing_status,
            CompanyStatus                         AS status,
            lower(trim(CompanyStateCode))         AS state_name,
            "CompanyIndian/Foreign Company"       AS indian_or_foreign,
            nic_code,
            CompanyIndustrialClassification       AS industry
        FROM mca_raw
    """)
    con.execute("CREATE INDEX IF NOT EXISTS idx_c_cin  ON companies(cin)")
    con.execute("CREATE INDEX IF NOT EXISTS idx_c_name ON companies(name)")
    nulls = con.execute("SELECT count(*) FROM companies "
                        "WHERE registration_date IS NULL").fetchone()[0]
    print(f"    {n:,} rows; impossible/missing registration dates -> NULL: "
          f"{nulls:,}")

    print("[3] Building `gst_state`…")
    con.execute("DROP TABLE IF EXISTS gst_state")
    con.execute("CREATE TABLE gst_state (code VARCHAR, state_name VARCHAR)")
    con.executemany("INSERT INTO gst_state VALUES (?, ?)", GST_STATES)

    print("[3b] Recording metadata…")
    con.execute("DROP TABLE IF EXISTS meta")
    con.execute("CREATE TABLE meta (key VARCHAR, value VARCHAR)")
    if args.snapshot_date:
        con.execute("INSERT INTO meta VALUES ('snapshot_date', ?)",
                    [args.snapshot_date])
        print(f"    snapshot_date = {args.snapshot_date}")
    else:
        print("    no --snapshot-date given; registry.py will use its "
              "documented fallback date")

    print("[4] Dropping the raw staging table and compacting…")
    con.execute("DROP TABLE mca_raw")
    con.execute("CHECKPOINT")
    con.close()

    out = Path(args.out)
    print(f"\nDONE — {out} ({out.stat().st_size / 1e6:,.0f} MB). "
          "Sanity check:")
    print('    python -c "import duckdb; '
          f"print(duckdb.connect(r'{out}', read_only=True)"
          ".execute('SELECT count(*) FROM companies').fetchone())\"")
    return 0


if __name__ == "__main__":
    sys.exit(main())
