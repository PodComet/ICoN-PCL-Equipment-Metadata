import json
from collections import Counter

from catalog_tools import ROOT, load_csv


def catalog(name):
    return load_csv(ROOT / "catalog" / f"{name}.csv")


def test_metals_review_reconciles_equipment_io_and_public_installations():
    review = json.loads((ROOT / "catalog/mmrl_metals_review_2026-11-15.json").read_text(encoding="utf-8"))
    equipment = {r["equipment_id"]: r for r in catalog("equipment")}
    profiles = {r["equipment_id"]: r for r in catalog("equipment_io")}
    records = review["records"]
    assert len({r["equipment_id"] for r in records}) == len(records)
    assert sum(not r["existing_record"] for r in records) == review["new_equipment_records"]
    counts = Counter(r["class_reviewed"] for r in records)
    for mid, status in review["class_coverage"].items():
        assert 1 <= counts[mid] <= 10
        assert status["documented_candidates"] == counts[mid]
        assert status["shortfall_to_ten"] == 10 - counts[mid]
    for row in records:
        equipment_id = row["equipment_id"]
        item, profile = equipment[equipment_id], profiles[equipment_id]
        assert profile["model_name"] == row["model"] == item["model_name"]
        assert profile["equipment_io_spec_url"] == row["source_url"]
        assert profile["inputs_and_states"] and profile["outputs_and_states"] and profile["units_of_measure"]
        if row["installation_url"]:
            assert item["access_evidence_url"] == row["installation_url"]
        if not row["existing_record"]:
            assert item["purdue_list"] == "false" and not item["requested_ids"]
    assert equipment["REQ-EQ-005"]["purdue_list"] == "true"
    assert equipment["M37-10"]["category_id"] == "M37"


def test_metals_steps_have_documented_eligible_models_and_explicit_dependencies():
    steps = [r for r in catalog("route_steps") if r["route_id"].startswith("P") and 48 <= int(r["route_id"][1:]) <= 71]
    equipment = catalog("equipment")
    assert {r["route_id"] for r in steps} == {f"P{i}" for i in range(48, 72)}
    for step in steps:
        req = json.loads(step["requirements_json"])
        assert all(int(p) < int(step["step_order"]) for p in req["prerequisite_source_step_orders"])
        assert not req["unresolved_required_equipment"]
        for mid in set(sum(req["required_branches"], []) + req["optional_category_ids"]):
            subtypes = req["allowed_subtypes_by_category"].get(mid, [])
            assert any(r["category_id"] == mid and (not subtypes or r["equipment_subtype"] in subtypes) for r in equipment)
