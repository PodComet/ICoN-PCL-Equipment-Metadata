import json
from catalog_tools import ROOT,load_csv,inspect_catalog

def test_mit_catalog_review_preserves_scope_identity_and_provenance():
    audit=json.loads((ROOT/'catalog/mit_nano_review_2026-10-17.json').read_text(encoding='utf-8'))
    rows={r['equipment_id']:r for r in load_csv(ROOT/'catalog/equipment.csv')}
    assert len(audit['source_review']['inventory'])==49
    assert len(audit['source_review']['focus_facility_inventory'])==16
    assert len(audit['added_equipment_ids'])==28
    assert sum(r['catalog_scope']=='mit_nano_expansion' for r in rows.values())==28
    for eid in audit['added_equipment_ids']:
        row=rows[eid]
        assert row['related_process_ids'] and all(p.startswith('P') for p in row['related_process_ids'].split(';'))
        assert row['image_url'] and row['image_source_url'] and row['image_scope']
        assert row['technical_spec_url'] and row['model_evidence_url']
        assert not row['msrp_value'] and not row['manufacturer_price_value']
        assert row['purdue_list']=='false' and not row['requested_ids'] and not row['source_pdf']
    assert all(r['status']=='no_exact_make_model_match' for r in audit['purdue_checks'])
    assert not any('STELLARIS CRS' in r['model_name'] or r['manufacturer']=='Multiwire Laboratories' for r in rows.values() if r['catalog_scope']=='mit_nano_expansion')
    assert inspect_catalog()['highlighted_equipment_records']==44

def test_mit_enrichment_does_not_overwrite_conflicting_variant_photos_or_create_prices_from_usage_fees():
    audit=json.loads((ROOT/'catalog/mit_nano_review_2026-10-17.json').read_text(encoding='utf-8'))
    assert audit['summary']['new_numeric_purchase_prices']==0
    assert len(audit['enriched'])==6 and audit['summary']['new_photos']==34
    preserved={d['title'] for d in audit['decisions'] if d['decision']=='photo_not_overwritten'}
    assert {'Asylum Research Cypher S AFM','Bruker Dimension Icon SPM'}<=preserved
    rows=load_csv(ROOT/'catalog/equipment.csv')
    saxslab=next(r for r in load_csv(ROOT/'catalog/manufacturers.csv') if r['manufacturer']=='SAXSLAB')
    assert '2017' in saxslab['company_status_note'] and 'Xenocs' in saxslab['company_status_note']
    assert len({r['equipment_id'] for r in rows})==len(rows)
