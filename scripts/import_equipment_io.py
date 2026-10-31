"""Import model-bound spreadsheet columns C/D/E without redistributing its workbook.

Usage: python scripts/import_equipment_io.py /path/to/EquipmentIO.xlsx
Only exact normalized manufacturer/model names match. Duplicate category records
receive the same model data. Product families and other generations never match.
"""
from __future__ import annotations
import argparse
from collections import Counter
import csv
from datetime import date
import hashlib
import json
from pathlib import Path
import re
import unicodedata
import xml.etree.ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
FIELDS = ['equipment_id', 'manufacturer', 'model_name', 'inputs_and_states',
          'outputs_and_states', 'units_of_measure', 'equipment_io_source_workbook',
          'equipment_io_source_sha256', 'equipment_io_source_sheet',
          'equipment_io_source_row', 'equipment_io_source_model',
          'equipment_io_manual_url', 'equipment_io_spec_url', 'equipment_io_imported_date']

def identity(value: str) -> str:
    return re.sub(r'[^a-z0-9+]', '', unicodedata.normalize('NFKD', value).casefold())

def display(record: dict) -> str:
    maker, model = record['manufacturer'], record['model_name']
    return model if model.casefold().startswith(maker.casefold()) else maker + ' ' + model

def read_workbook(path: Path) -> list[dict]:
    with ZipFile(path) as archive:
        strings = [''.join(n.itertext()) for n in ET.fromstring(archive.read('xl/sharedStrings.xml'))] if 'xl/sharedStrings.xml' in archive.namelist() else []
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        first = workbook.find('s:sheets', NS)[0]
        relationship_id = first.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        relationships = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
        target = next(r.get('Target') for r in relationships if r.get('Id') == relationship_id)
        target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
        rows = []
        for row in ET.fromstring(archive.read(target)).findall('s:sheetData/s:row', NS):
            values = {'row': int(row.get('r')), 'sheet': first.get('name')}
            for cell in row.findall('s:c', NS):
                if cell.find('s:f', NS) is not None:
                    raise ValueError('Formula found in source row ' + str(values['row']) + '; use an evaluated text export.')
                value = cell.findtext('s:v', default='', namespaces=NS)
                if cell.get('t') == 's':
                    value = strings[int(value)]
                elif cell.get('t') == 'inlineStr':
                    value = ''.join(cell.find('s:is', NS).itertext())
                values[re.sub(r'\d', '', cell.get('r'))] = value
            if values.get('A'):
                rows.append(values)
    expected = {'A': 'machine_manufacturer_model', 'C': 'inputs_and_states',
                'D': 'outputs_and_states', 'E': 'units_of_measure'}
    if not rows or any(rows[0].get(k) != v for k, v in expected.items()):
        raise ValueError('Expected EquipmentIO column headers A/C/D/E were not found.')
    return rows[1:]

def build(path: Path, imported_date: str):
    source_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    rows = read_workbook(path)
    by_identity = {}
    for row in rows:
        key = identity(row['A'])
        if key in by_identity:
            raise ValueError('Ambiguous source model identity: ' + row['A'])
        by_identity[key] = row
    with (ROOT / 'catalog/equipment.csv').open(encoding='utf-8-sig', newline='') as handle:
        records = list(csv.DictReader(handle))
    # Review the Purdue records first while retaining canonical order in the output.
    imported = {}
    used = set()
    unmatched = []
    for record in sorted(records, key=lambda r: r.get('purdue_list') != 'true'):
        source = by_identity.get(identity(display(record)))
        if source is None:
            unmatched.append({k: record.get(k, '') for k in ['equipment_id', 'manufacturer', 'model_name', 'purdue_list']})
            continue
        used.add(source['row'])
        imported[record['equipment_id']] = {
            **{k: record[k] for k in ['equipment_id', 'manufacturer', 'model_name']},
            'inputs_and_states': source.get('C', ''),
            'outputs_and_states': source.get('D', ''),
            'units_of_measure': source.get('E', ''),
            'equipment_io_source_workbook': path.name,
            'equipment_io_source_sha256': source_hash,
            'equipment_io_source_sheet': source['sheet'],
            'equipment_io_source_row': str(source['row']),
            'equipment_io_source_model': source['A'],
            'equipment_io_manual_url': source.get('H', ''),
            'equipment_io_spec_url': source.get('I', ''),
            'equipment_io_imported_date': imported_date,
        }
    output = [imported[r['equipment_id']] for r in records if r['equipment_id'] in imported]
    report = {'source_workbook': path.name, 'source_sha256': source_hash,
              'imported_date': imported_date, 'source_rows': len(rows),
              'matched_source_rows': len(used), 'catalog_records': len(records),
              'matched_catalog_records': len(output),
              'purdue_records': sum(r.get('purdue_list') == 'true' for r in records),
              'matched_purdue_records': sum(r.get('purdue_list') == 'true' and r['equipment_id'] in imported for r in records),
              'field_nonempty_counts': dict(Counter(k for r in output for k in ['inputs_and_states', 'outputs_and_states', 'units_of_measure'] if r[k])),
              'unmatched_catalog_records': unmatched,
              'unmatched_source_rows': [{'row': r['row'], 'model': r['A']} for r in rows if r['row'] not in used],
              'matching_policy': 'Exact normalized manufacturer/model display identity only. No positional, fuzzy, family or cross-generation matching. Source text and qualification notes retained verbatim. Original workbook, inventory identifiers and source documents are not redistributed.'}
    with (ROOT / 'catalog/equipment_io.csv').open('w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(output)
    target = ROOT / 'webapp/app/data/equipment-io.json'
    target.write_text(json.dumps({'schema': 'iconpcl-equipment-io/v1', 'records': output,
                                 'source': {k: report[k] for k in ['source_workbook', 'source_sha256', 'imported_date']}}, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    (ROOT / 'catalog/equipment_io_import_review.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: report[k] for k in ['source_rows', 'matched_source_rows', 'catalog_records', 'matched_catalog_records', 'purdue_records', 'matched_purdue_records']}, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workbook', type=Path)
    parser.add_argument('--date', default=date.today().isoformat())
    args = parser.parse_args()
    build(args.workbook, args.date)
