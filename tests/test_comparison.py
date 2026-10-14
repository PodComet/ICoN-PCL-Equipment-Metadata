import json
from pathlib import Path

import pytest
from openpyxl import Workbook

from equipment_compare import compare, normalize, read_lists


def test_normalization_preserves_model_identity():
    assert normalize("  Ｐump\u00a0 20\n") == "pump 20"
    assert normalize("Pump-20") != normalize("Pump20")
    assert normalize("AM400") != normalize("AM500")


def test_duplicates_unmatched_and_determinism(tmp_path):
    source = tmp_path / "lists.csv"
    source.write_text('A,B\nPump,PUMP\nPump,Furnace\nFan,\n,Scanner\n,\n', encoding="utf-8")
    first, second = tmp_path / "first", tmp_path / "second"
    result = compare(source, first, header=True)
    assert result["summary"]["counts"] == dict(rows_a=3, rows_b=3, unique_a=2, unique_b=3,
        both=1, only_a=1, only_b=2, duplicate_keys_a=1, duplicate_keys_b=0)
    assert next(r for r in result["machines"] if r["key"] == "pump")["a"] == [
        {"row": 2, "value": "Pump"}, {"row": 3, "value": "Pump"}]
    compare(source, second, header=True)
    assert {p.name: p.read_bytes() for p in first.iterdir()} == {p.name: p.read_bytes() for p in second.iterdir()}


def test_xlsx_first_row_sheet_blanks_numbers_and_errors(tmp_path):
    source = tmp_path / "input.xlsx"
    book = Workbook()
    ws = book.active
    ws.title = "Machines"
    ws.append(["First", "FIRST"])
    ws.append([0, 0])
    ws.append([None, "\t"])
    book.create_sheet("Other").append(["Other", "Other"])
    book.save(source)
    lists, selected = read_lists(source)
    assert selected == "Machines"
    assert set(lists[0]) == {"first", "0"}
    assert set(read_lists(source, "Other")[0][0]) == {"other"}
    with pytest.raises(KeyError):
        read_lists(source, "Missing")
    ws.append(["=1+1", None])
    book.save(source)
    with pytest.raises(ValueError, match="Formula/error"):
        read_lists(source)


def test_empty_and_unsupported(tmp_path):
    source = tmp_path / "empty.csv"
    source.write_text("", encoding="utf-8")
    assert compare(source, tmp_path / "out")["summary"]["counts"]["both"] == 0
    with pytest.raises(ValueError):
        read_lists(tmp_path / "input.txt")


def test_example_report_is_current(tmp_path):
    root = Path(__file__).resolve().parents[1]
    compare(root / "data/examples/equipment_lists.csv", tmp_path, header=True)
    for expected in (root / "reports/example").iterdir():
        assert expected.read_bytes() == (tmp_path / expected.name).read_bytes()
