import json

from catalog_tools import ROOT, load_csv


def before_metals(name):
    """Reconstruct the public catalog immediately before the MMRL expansion."""
    review = json.loads((ROOT / "catalog/mmrl_metals_review_2026-11-15.json").read_text(encoding="utf-8"))
    rows = load_csv(ROOT / "catalog" / f"{name}.csv")
    if name == "equipment":
        previous = review["equipment_before"]
        return [previous.get(r["equipment_id"], r) for r in rows if r["catalog_scope"] != "mmrl_metals_expansion"]
    if name == "manufacturers":
        previous = review["manufacturer_before"]
        added = set(review["new_manufacturers"])
        return [previous.get(r["manufacturer"], r) for r in rows if r["manufacturer"] not in added]
    return rows
