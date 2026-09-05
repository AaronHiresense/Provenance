# Sample paperwork for Provenance

Upload-ready files built from the bundled cases. Every set uses real registry
records and none casts a real company as a counterfeiter, so they are safe to
upload as raw text (raw uploads are not aliased).

## How to use them

- **Paperwork mode**: click *Upload files* and select all the `.txt` files in one
  folder (or drop them on the composer). They are joined with a `---` line, the
  way the composer expects. Or upload the single file from `combined/`.
- **Dossier JSON mode**: upload one file from `dossier-json/`.
- **Supplier lookup mode**: type an identifier from `supplier-lookups.txt`.

## What each set demonstrates

| Folder | Lot | Files | Expected verdict | Verified |
|---|---|---|---|---|
| `01-genuine-hsi-brake-calipers` | Brake caliper lot BC-2209 — HSI Automotives | 3 | GENUINE | yes |
| `02-genuine-long-haul-with-eway-bill` | Brake caliper lot BC-2209 — the lawful long haul | 3 | GENUINE | yes |
| `03-suspect-teleporting-consignment` | Brake caliper lot BC-3310 — the teleporting consignment | 3 | SUSPECT | yes |
| `04-suspect-cloned-paperwork-wrong-spec` | Brake caliper lot BC-2209 — cloned paperwork, wrong spec | 3 | SUSPECT | yes |
| `05-unverifiable-no-registry-record` | Brake pad lot BP-7754 — Ghostline Auto Parts (no registry record) | 3 | UNVERIFIABLE (missing) | yes |
| `06-genuine-llp-with-abstentions` | Cable harness lot CH-0912 — Norde Automa LLP (abstention showcase) | 2 | GENUINE | yes |

### Notes

- **01-genuine-hsi-brake-calipers**: A clean paper trail: certificate, invoice and dispatch note from a manufacturer the registry has known since 1997.
- **02-genuine-long-haul-with-eway-bill**: The same manufacturer shipping Chennai to Delhi with an e-way bill, so the logistics checks (validity vs distance, HSN) run too.
- **03-suspect-teleporting-consignment**: An e-way bill valid for one day on a 2,200 km route, and an HSN code that does not fit brake calipers.
- **04-suspect-cloned-paperwork-wrong-spec**: Genuine-looking paperwork cloned from a real supplier, certified to the wrong standard for the part.
- **05-unverifiable-no-registry-record**: A company whose CIN is not in the MCA registry snapshot: a gap, not proof, so the verdict names the one document that decides it.
- **06-genuine-llp-with-abstentions**: An LLP with only a certificate and a dispatch note: several checks abstain honestly and the verdict is still reachable.

Verified means the folder's files, joined the way the composer joins uploads,
produced the expected verdict through the offline pipeline when these samples were generated.
