import copy
import json
import shutil
import sqlite3
import subprocess
import sys

import pytest

from reference_tools import ROOT, REFERENCE_FIELDS, AFFILIATION_FIELDS, build, exports, normalize_doi, read_database, sort_references, validate_database, write_csv, coverage


def test_article_only_import_deduplicates_work_and_retains_copies():
    data=read_database()
    assert validate_database(data)
    initial=json.loads((ROOT/'catalog/reference_import_2026-10-15.json').read_text(encoding='utf-8'))
    initial_ids={r['reference_id'] for r in initial['metadata_checks']}
    assert len(initial_ids)==17
    assert len([f for f in data['reference_files'] if f['reference_id'] in initial_ids])==18
    ontology=next(r for r in data['references'] if r['doi']=='10.3390/app142411683')
    copies=[f for f in data['reference_files'] if f['reference_id']==ontology['reference_id']]
    assert len(copies)==2 and len({f['sha256'] for f in copies})==1
    assert ontology['publication_year']=='2024'
    assert all(r['reference_type'] in {'journal_article','conference_paper','preprint'} for r in data['references'])
    assert not any('Manuals' in f['source_filename'] for f in data['reference_files'])
    assert not any(l['relation']=='supports_claim' for l in data['reference_links'] if l['reference_id'] in initial_ids)


def test_publication_dates_and_metadata_caveats_remain_distinct():
    refs={r['doi']:r for r in read_database()['references']}
    assert refs['10.3390/ma17051088']['publication_year']=='2024'
    assert refs['10.3390/ma17051088']['article_number']=='1088' and not refs['10.3390/ma17051088']['pages']
    assert refs['10.1186/s12989-021-00442-x']['publication_year']=='2022'
    assert refs['10.22034/ijism.2026.2022500.1393']['metadata_status']=='pdf_checked'
    assert refs['10.48550/arxiv.2609.01740']['publication_status']=='preprint'
    assert refs['10.48550/arxiv.2609.01740']['peer_review_status']=='not_asserted'
    assert 'prepublication manuscript' in refs['10.1021/acs.nanolett.4c01850']['notes']


def test_chronological_order_and_full_author_exports():
    refs=read_database()['references'];ordered=sort_references(refs)
    assert [int(r['publication_year']) for r in ordered]==sorted(int(r['publication_year']) for r in refs)
    missing={**refs[0],'reference_id':'UNDATED','publication_year':'','publication_date':''}
    assert sort_references([missing,*refs])[-1]['reference_id']=='UNDATED'
    result=exports(refs);csl=json.loads(result['csl_json'])
    ghiringhelli=next(r for r in csl if r['DOI']=='10.1038/s41597-023-02501-8')
    assert len(ghiringhelli['author'])==35
    assert 'Gomes Souza, Jr., Fernando' in result['bibtex']
    assert 'AU  - Gomes Souza, Fernando, Jr.' in result['ris']
    assert 'TY  - UNPB' in result['ris'] and 'genre' in next(r for r in csl if 'arxiv' in r['DOI'])
    assert len([line for line in result['ris'].splitlines() if line=='ER  -'])==len(refs)


@pytest.mark.parametrize('change,message',[
    ('duplicate_doi','duplicate DOI'),('orphan_reference','missing reference'),('orphan_target','catalog target'),('unchecked_claim','checked claim'),('private_path','basenames only'),('manufacturer_document','Academic articles only'),('unsafe_url','Invalid reference url')
])
def test_validation_rejects_misleading_or_broken_updates(change,message):
    data=copy.deepcopy(read_database())
    if change=='duplicate_doi':data['references'][1]['doi']='https://doi.org/'+data['references'][0]['doi'].upper()
    elif change=='orphan_reference':data['reference_links'][0]['reference_id']='MISSING'
    elif change=='orphan_target':data['reference_links'][0].update(target_type='equipment',target_id='MISSING')
    elif change=='unchecked_claim':data['reference_links'][0]['relation']='supports_claim'
    elif change=='private_path':data['reference_files'][0]['source_filename']='C:/private/article.pdf'
    elif change=='manufacturer_document':data['references'][0]['reference_type']='manufacturer_document'
    elif change=='unsafe_url':data['references'][0]['url']='javascript:alert(1)'
    with pytest.raises(ValueError,match=message):validate_database(data)


def test_generation_is_reproducible_and_sqlite_links_have_foreign_keys(tmp_path):
    shutil.copytree(ROOT/'catalog',tmp_path/'catalog')
    database=tmp_path/'references.sqlite'
    build(tmp_path,database)
    for filename in ['bibliography.bib','bibliography.ris','bibliography.csl.json','reference_coverage.json']:
        assert (tmp_path/'catalog'/filename).read_bytes()==(ROOT/'catalog'/filename).read_bytes()
    assert (tmp_path/'webapp/app/data/references.json').read_bytes()==(ROOT/'webapp/app/data/references.json').read_bytes()
    with sqlite3.connect(database) as db:
        assert db.execute('SELECT COUNT(*) FROM "references"').fetchone()[0]==len(read_database()['references'])
        assert db.execute('PRAGMA foreign_key_check').fetchall()==[]
        db.execute('PRAGMA foreign_keys=ON')
        with pytest.raises(sqlite3.IntegrityError):db.execute("UPDATE reference_files SET reference_id='unknown'")


def test_csv_updates_preview_then_apply_and_preserve_existing_links(tmp_path):
    shutil.copytree(ROOT/'catalog',tmp_path/'catalog')
    data=read_database(tmp_path);record={**data['references'][0],'notes':'Reviewed by curator'}
    incoming=tmp_path/'update.csv';write_csv(incoming,[record],REFERENCE_FIELDS)
    command=[sys.executable,str(ROOT/'reference_tools.py'),'update','--root',str(tmp_path),'--references',str(incoming)]
    original=(tmp_path/'catalog/references.csv').read_bytes()
    assert subprocess.run(command,capture_output=True,check=True).returncode==0
    assert (tmp_path/'catalog/references.csv').read_bytes()==original
    subprocess.run([*command,'--apply'],capture_output=True,check=True)
    updated=read_database(tmp_path)
    assert len(updated['references'])==len(data['references']) and updated['reference_links']==data['reference_links']
    assert next(r for r in updated['references'] if r['reference_id']==record['reference_id'])['notes']=='Reviewed by curator'
    record['reference_type']='manual';write_csv(incoming,[record],REFERENCE_FIELDS)
    before=(tmp_path/'catalog/references.csv').read_bytes()
    assert subprocess.run([*command,'--apply'],capture_output=True).returncode!=0
    assert (tmp_path/'catalog/references.csv').read_bytes()==before


def test_export_escapes_tex_and_doi_normalization():
    record={**read_database()['references'][0],'title':'An {example} & 50% _ # $ \\ test'}
    bib=exports([record])['bibtex']
    assert r'\{example\} \& 50\% \_ \# \$ \textbackslash{}' in bib
    assert normalize_doi(' https://DOI.org/10.3390%2FMA17051088 ')=='10.3390/ma17051088'


def test_affiliations_cover_every_author_entry_without_inventing_an_unstated_institution():
    data=read_database();new_ids={r['reference_id'] for r in data['references'] if any(topic in r['topics'] for topic in ['source_formulation','citation_sweep_2026_10_17','openbis_architecture_2026_10_17'])}
    historical={k:[r for r in rows if r.get('reference_id') not in new_ids] for k,rows in data.items()};stats=coverage(historical)
    assert coverage(data)['authors_affiliation_pending']==0
    assert stats['author_entries']==405 and stats['authors_with_affiliations']==401
    assert stats['authors_affiliation_not_stated']==4 and stats['authors_affiliation_pending']==0
    assert stats['references_with_affiliations']==52
    absent=next(a for a in data['reference_affiliations'] if a['affiliation_status']=='not_stated')
    assert absent['author_name']=='John Broome' and absent['institution']==''
    assert 'Ottawa' in absent['source_locator']
    assert all(a['source_url'] and a['source_locator'] and '@' not in a['institution'] for a in data['reference_affiliations'])
    ghiringhelli=next(r for r in data['references'] if r['doi']=='10.1038/s41597-023-02501-8')
    institutions=[a['institution'] for a in data['reference_affiliations'] if a['reference_id']==ghiringhelli['reference_id'] and a['author_index']=='0']
    assert len(institutions)==2 and not any('Friedrich' in i for i in institutions)


def test_openbis_architecture_article_is_background_with_publication_specific_affiliations():
    data=read_database();article=next(r for r in data['references'] if r['doi']=='10.1002/adem.202502882')
    assert article['publication_date']=='2026-04-04' and article['publication_year']=='2026'
    affiliations=[a for a in data['reference_affiliations'] if a['reference_id']==article['reference_id']]
    assert len(affiliations)==6 and {int(a['author_index']) for a in affiliations}==set(range(6))
    links=[l for l in data['reference_links'] if l['reference_id']==article['reference_id']]
    assert links and all(l['relation']=='background' and l['target_type']=='project' for l in links)
    assert not any(l['relation']=='supports_claim' for l in links)


@pytest.mark.parametrize('change,message',[
    ('index','existing reference and author index'),('name','does not match'),('url','safe source URL'),('duplicate','Duplicate author institution'),('contact','contact details'),('locator','source locator'),('status','Affiliation status'),('conflicting','both reported and not-stated')
])
def test_affiliation_validation_rejects_mismatched_authorship_and_unsourced_data(change,message):
    data=copy.deepcopy(read_database());item=data['reference_affiliations'][0]
    if change=='index':item['author_index']='999'
    elif change=='name':item['author_name']='A Different Author'
    elif change=='url':item['source_url']='javascript:alert(1)'
    elif change=='duplicate':data['reference_affiliations'].append({**item,'affiliation_id':'AFF-DUPLICATE'})
    elif change=='contact':item['institution']='contact@example.edu'
    elif change=='locator':item['source_locator']=''
    elif change=='status':item['affiliation_status']='not_stated'
    elif change=='conflicting':data['reference_affiliations'].append({**item,'affiliation_id':'AFF-CONFLICT','affiliation_status':'not_stated','institution':''})
    with pytest.raises(ValueError,match=message):validate_database(data)


def test_affiliation_updates_use_the_existing_validated_csv_importer(tmp_path):
    shutil.copytree(ROOT/'catalog',tmp_path/'catalog');data=read_database(tmp_path)
    original=data['reference_affiliations'][0];updated={**original,'source_locator':original['source_locator']+'; curator rechecked'}
    incoming=tmp_path/'affiliations.csv';write_csv(incoming,[updated],AFFILIATION_FIELDS)
    command=[sys.executable,str(ROOT/'reference_tools.py'),'update','--root',str(tmp_path),'--reference-affiliations',str(incoming)]
    before=(tmp_path/'catalog/reference_affiliations.csv').read_bytes()
    subprocess.run(command,capture_output=True,check=True)
    assert (tmp_path/'catalog/reference_affiliations.csv').read_bytes()==before
    subprocess.run([*command,'--apply'],capture_output=True,check=True)
    after=read_database(tmp_path)
    assert next(a for a in after['reference_affiliations'] if a['affiliation_id']==original['affiliation_id'])==updated
    assert after['references']==data['references'] and after['reference_links']==data['reference_links']
