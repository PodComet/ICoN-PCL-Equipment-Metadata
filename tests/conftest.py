import json

from catalog_tools import ROOT, load_csv


def before_metals(name):
    """Reconstruct the public catalog immediately before the MMRL expansion."""
    rows = load_csv(ROOT / "catalog" / f"{name}.csv")
    # Keep these historical snapshot checks at the catalog state they describe.
    expansion = json.loads((ROOT / "catalog" / "cnc_computational_review_2026-11-17.json").read_text(encoding="utf-8"))
    if name == "equipment":
        rows = [r for r in rows if r["equipment_id"] not in expansion["new_equipment_ids"]]
    if name == "manufacturers":
        rows = [r for r in rows if r["manufacturer"] not in expansion["new_manufacturers"]]
    scattering = json.loads((ROOT / "catalog" / "light_scattering_review_2026-11-17.json").read_text(encoding="utf-8"))
    if name == "equipment":
        rows = [r for r in rows if r["equipment_id"] not in scattering["new_equipment_ids"]]
    if name == "manufacturers":
        rows = [scattering["manufacturer_before"].get(r["manufacturer"], r) for r in rows
                if r["manufacturer"] not in scattering["new_manufacturers"]]
    wyatt = json.loads((ROOT / "catalog" / "wyatt_dynapro_review_2026-11-17.json").read_text(encoding="utf-8"))
    if name == "equipment":
        rows = [r for r in rows if r["equipment_id"] not in wyatt["new_equipment_ids"]]
    if name == "manufacturers":
        rows = [wyatt["manufacturer_before"].get(r["manufacturer"], r) for r in rows
                if r["manufacturer"] not in wyatt["new_manufacturers"]]
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
