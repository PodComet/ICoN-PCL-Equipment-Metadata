import json
from collections import Counter

from catalog_tools import ROOT, load_csv


def catalog(name):
    return load_csv(ROOT / "catalog" / f"{name}.csv")


def test_academic_equipment_has_documentation_io_and_public_purdue_evidence():
    review = json.loads((ROOT / "catalog/academic_workflow_review_2026-11-15.json").read_text(encoding="utf-8"))
    equipment = {r["equipment_id"]: r for r in catalog("equipment")}
    io = {r["equipment_id"]: r for r in catalog("equipment_io")}
    added = [r for r in review["records"] if not r["existing_record"]]
    assert len(added) == review["new_equipment_records"]
    counts = Counter(r["category_id"] for r in added)
    for mid, entry in review["classes"].items():
        assert 1 <= counts[mid] <= 10
        assert entry["documented_candidates"] == counts[mid]
    for row in added:
        record = equipment[row["equipment_id"]]
        profile = io[row["equipment_id"]]
        assert record["model_name"] == profile["model_name"] == row["model"]
        assert profile["equipment_io_spec_url"] == row["source_url"]
        assert all(profile[field] for field in ("inputs_and_states", "outputs_and_states", "units_of_measure"))
        assert record["purdue_list"] == "false" and not record["requested_ids"]
    for row in review["records"]:
        if row["installation_url"]:
            record = equipment[row["equipment_id"]]
            assert record["access_evidence_url"] == row["installation_url"]
            assert record["institution_label"] == "Purdue University"


def test_every_academic_workflow_step_has_a_valid_class_and_candidate():
    steps = [r for r in catalog("route_steps") if r["route_id"] in {f"P{i}" for i in range(72,90)}]
    equipment = catalog("equipment")
    assert {r["route_id"] for r in steps} == {f"P{i}" for i in range(72,90)}
    for step in steps:
        req = json.loads(step["requirements_json"])
        assert all(int(parent) < int(step["step_order"]) for parent in req["prerequisite_source_step_orders"])
        assert not req["unresolved_required_equipment"]
        for mid in set(sum(req["required_branches"], []) + req["optional_category_ids"]):
            types = req["allowed_subtypes_by_category"].get(mid, [])
            assert any(r["category_id"] == mid and (not types or set(types).intersection(r["equipment_subtype"].split(";"))) for r in equipment)
