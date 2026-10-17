"""Review new model identities against the owner-designated Purdue model list."""
import csv,json,re,unicodedata
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def normalized(value):
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKC',value).casefold())

def model_key(row):
    maker=normalized(row.get('manufacturer',''))
    model=normalized(row.get('model_name',''))
    if maker and model.startswith(maker):model=model[len(maker):]
    return maker,model

def matches_purdue(row,designated):
    key=model_key(row)
    return [known for known in designated if all(key) and key==model_key(known)]

def review(root=ROOT):
    path=root/'catalog/equipment.csv'
    with path.open(encoding='utf-8',newline='') as f:r=csv.DictReader(f);fields=r.fieldnames;records=list(r)
    designated=[r for r in records if r['purdue_list']=='true' and r['institution_basis']=='user_designated_list']
    additions=[r for r in records if r['catalog_scope'] in {'market_expansion','process_slot_gap_expansion'}]
    results=[]
    for row in additions:
        matches=matches_purdue(row,designated)
        results.append({'equipment_id':row['equipment_id'],'manufacturer':row['manufacturer'],'model_name':row['model_name'],'category_id':row['category_id'],'status':'exact_make_model_match' if matches else 'no_exact_make_model_match','matched_equipment_ids':[r['equipment_id'] for r in matches],'requested_ids':sorted({v for r in matches for v in r['requested_ids'].split(';') if v}),'method':'Exact normalized manufacturer and model identity; punctuation/case and a repeated manufacturer prefix are ignored. Category/family/brand matches and unspecified planned-purchase models are insufficient.'})
        if matches:
            row.update(purdue_list='true',highlight_requested='true',institution_label='Purdue University',institution_basis='make_model_match_to_user_designated_list',institution_logo_url=matches[0]['institution_logo_url'],requested_ids=';'.join(results[-1]['requested_ids']))
    with path.open('w',encoding='utf-8',newline='') as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(records)
    report={'checked_date':'2026-10-16','designated_model_profiles':len(designated),'reviewed_new_profiles':len(results),'exact_matches':sum(r['status']=='exact_make_model_match' for r in results),'scope':'Purdue P means this make/model appears on the user-designated Purdue list. It does not assign an inventory unit, serial number, ownership or purchasing status to a new model profile.','records':results}
    (root/'catalog/purdue_new_model_review_2026-10-16.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return report

if __name__=='__main__':
    report=review();print(json.dumps({k:v for k,v in report.items() if k!='records'}))
