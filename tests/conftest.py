import json

from catalog_tools import ROOT, load_csv


def before_metals(name):
    """Reconstruct the public catalog immediately before the MMRL expansion."""
    rows = load_csv(ROOT / "catalog" / f"{name}.csv")
    for filename, scope in [
        ("academic_workflow_review_2026-11-15.json", "academic_workflow_expansion"),
        ("mmrl_metals_review_2026-11-15.json", "mmrl_metals_expansion"),
    ]:
        review = json.loads((ROOT / "catalog" / filename).read_text(encoding="utf-8"))
        if name == "equipment":
            previous = review["equipment_before"]
            rows = [previous.get(r["equipment_id"], r) for r in rows if r["catalog_scope"] != scope]
        if name == "manufacturers":
            previous = review["manufacturer_before"]
            added = set(review["new_manufacturers"])
            rows = [previous.get(r["manufacturer"], r) for r in rows if r["manufacturer"] not in added]
    return rows
