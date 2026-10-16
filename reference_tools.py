"""Validate, update and export the curated academic reference database (offline)."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sqlite3
from datetime import date
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
REFERENCE_FIELDS = ['reference_id', 'reference_type', 'title', 'authors_json', 'publication_year', 'publication_date', 'container_title', 'volume', 'issue', 'pages', 'article_number', 'doi', 'url', 'publication_status', 'peer_review_status', 'metadata_status', 'metadata_source_url', 'checked_date', 'topics', 'notes']
LINK_FIELDS = ['link_id', 'reference_id', 'target_type', 'target_id', 'relation', 'claim', 'locator', 'review_status', 'scope', 'review_date']
FILE_FIELDS = ['file_id', 'reference_id', 'source_filename', 'sha256', 'page_count', 'local_version']
TABLES = {'references': REFERENCE_FIELDS, 'reference_links': LINK_FIELDS, 'reference_files': FILE_FIELDS}


def load_csv(path):
    with Path(path).open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        if not reader.fieldnames or len(set(reader.fieldnames)) != len(reader.fieldnames):
            raise ValueError(f'{Path(path).name}: missing or duplicate column names')
        rows = list(reader)
        if any(None in row or any(value is None for value in row.values()) for row in rows):
            raise ValueError(f'{Path(path).name}: inconsistent CSV row width')
        return rows


def write_csv(path, rows, fields):
    with Path(path).open('w', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)


def normalize_doi(value):
    return unquote(re.sub(r'^(?:https?://(?:dx\.)?doi\.org/|doi:\s*)', '', value.strip(), flags=re.I)).lower()


def reference_id(doi):
    return 'REF-' + hashlib.sha256(normalize_doi(doi).encode()).hexdigest()[:12].upper()


def authors(record):
    return json.loads(record['authors_json'])


def sort_references(records):
    return sorted(records, key=lambda r: (int(r['publication_year']) if r['publication_year'] else 9999, r['publication_date'] or r['publication_year'], (authors(r)[0].get('family') or authors(r)[0].get('literal', '')).casefold(), r['title'].casefold(), r['reference_id']))


def read_database(root=ROOT):
    return {name: load_csv(Path(root) / 'catalog' / (name + '.csv')) for name in TABLES}


def validate_database(data, root=ROOT):
    root = Path(root)
    for name, fields in TABLES.items():
        rows = data[name]
        for row in rows:
            if set(row) != set(fields):
                raise ValueError(f'{name}: columns must match the template')
        ids = [r[fields[0]] for r in rows]
        if len(set(ids)) != len(ids) or any(not re.fullmatch(r'[A-Za-z0-9_-]+', x) for x in ids):
            raise ValueError(f'{name}: invalid or duplicate IDs')
    known = {r['reference_id'] for r in data['references']}
    dois = set()
    for row in data['references']:
        if row['reference_type'] not in {'journal_article', 'conference_paper', 'preprint'}:
            raise ValueError('Academic articles only: invalid reference type')
        if not row['title'].strip() or not authors(row) or any(not isinstance(a, dict) or not (a.get('family') or a.get('literal')) or any(not isinstance(v, str) for v in a.values()) for a in authors(row)):
            raise ValueError('Each reference needs a title and structured authors')
        if row['publication_year'] and not re.fullmatch(r'[12]\d{3}', row['publication_year']):
            raise ValueError('Invalid publication year')
        if row['publication_date']:
            try:
                parts = row['publication_date'].split('-')
                date(*[int(p) for p in parts], *([1] * (3-len(parts))))
            except (ValueError, TypeError):
                raise ValueError('Invalid publication date') from None
            if not row['publication_year'] or not row['publication_date'].startswith(row['publication_year']):
                raise ValueError('Publication date and year differ')
        doi = normalize_doi(row['doi'])
        if doi and (not re.fullmatch(r'10\.\d{4,9}/\S+', doi) or doi in dois):
            raise ValueError('Invalid or duplicate DOI')
        if doi: dois.add(doi)
        for field in ['url', 'metadata_source_url']:
            if row[field] and (urlsplit(row[field]).scheme not in {'http', 'https'} or not urlsplit(row[field]).netloc):
                raise ValueError(f'Invalid reference {field}')
        if row['publication_status'] not in {'published', 'preprint'} or row['metadata_status'] not in {'pdf_and_registry_checked', 'pdf_and_repository_checked', 'pdf_checked', 'full_text_and_registry_checked', 'needs_review'} or row['peer_review_status'] not in {'not_independently_checked', 'not_asserted', 'verified'}:
            raise ValueError('Invalid reference status')
        date.fromisoformat(row['checked_date'])
        if row['reference_type'] == 'preprint' and (row['publication_status'] != 'preprint' or row['peer_review_status'] == 'verified'):
            raise ValueError('A preprint must remain visibly distinct from a reviewed publication')
    targets = {
        'project': {'ICoN-PCL'},
        'equipment': {r['equipment_id'] for r in load_csv(root / 'catalog/equipment.csv')},
        'category': {r['category_id'] for r in load_csv(root / 'catalog/categories.csv')},
        'route': {r['route_id'] for r in load_csv(root / 'catalog/routes.csv')},
    }
    for link in data['reference_links']:
        if link['reference_id'] not in known or link['target_type'] not in targets or link['target_id'] not in targets[link['target_type']]:
            raise ValueError('Reference link has a missing reference or catalog target')
        if link['relation'] not in {'background', 'supports_claim'} or link['review_status'] not in {'context_reviewed', 'claim_checked', 'needs_review'}:
            raise ValueError('Invalid claim relationship or review status')
        if not all(link[k].strip() for k in ['claim', 'locator', 'scope']):
            raise ValueError('Reference links need a claim, page/section locator and scope')
        if link['relation'] == 'supports_claim' and link['review_status'] != 'claim_checked':
            raise ValueError('Claim support requires a checked claim')
        date.fromisoformat(link['review_date'])
    for item in data['reference_files']:
        if item['reference_id'] not in known or not re.fullmatch(r'[a-f0-9]{64}', item['sha256']):
            raise ValueError('Invalid file provenance')
        if '/' in item['source_filename'] or '\\' in item['source_filename'] or ':' in item['source_filename'] or not item['source_filename'].endswith('.pdf'):
            raise ValueError('File provenance uses article basenames only; no absolute paths')
        if not item['page_count'].isdigit() or int(item['page_count']) < 1:
            raise ValueError('Invalid PDF page count')
    return True


def citation_text(r):
    names = [' '.join(filter(None, [a.get('given'), a.get('family'), a.get('suffix')])) if not a.get('literal') else a['literal'] for a in authors(r)]
    volume = r['volume'] + (f"({r['issue']})" if r['issue'] else '')
    return '. '.join(x for x in ['; '.join(names), f"({r['publication_year'] or 'n.d.'})", r['title'], ', '.join(filter(None, [r['container_title'], volume, r['pages'] or r['article_number']])), r['url']] if x)


def exports(records):
    records = sort_references(records)
    bib, ris, csl = [], [], []
    def tex(value):
        replacements = {'\\': r'\textbackslash{}', '{': r'\{', '}': r'\}', '&': r'\&', '%': r'\%', '_': r'\_', '#': r'\#', '$': r'\$'}
        return ''.join(replacements.get(c, c) for c in value.replace('\n', ' '))
    for r in records:
        names = [a.get('literal') or ', '.join(filter(None, [a.get('family'), a.get('suffix'), a.get('given')])) for a in authors(r)]
        kind = {'journal_article': 'article', 'conference_paper': 'inproceedings', 'preprint': 'misc'}[r['reference_type']]
        fields = [('author', ' and '.join(names)), ('title', r['title']), ('year', r['publication_year']), ('booktitle' if kind == 'inproceedings' else 'journal' if kind == 'article' else 'howpublished', r['container_title']), ('volume', r['volume']), ('number', r['issue']), ('pages', r['pages'].replace('-', '--')), ('eid', r['article_number']), ('doi', r['doi']), ('url', r['url']), ('urldate', r['checked_date'])]
        if kind == 'misc': fields.append(('note', 'Preprint; peer review not asserted'))
        bib.append('@'+kind+'{'+r['reference_id']+',\n'+',\n'.join('  '+k+' = {'+tex(v)+'}' for k,v in fields if v)+'\n}')
        ris_names = [a.get('literal') or ', '.join(filter(None, [a.get('family'), a.get('given'), a.get('suffix')])) for a in authors(r)]
        lines = [('TY', {'journal_article': 'JOUR', 'conference_paper': 'CPAPER', 'preprint': 'UNPB'}[r['reference_type']]), ('ID', r['reference_id'])] + [('AU', n) for n in ris_names] + [('TI', r['title']), ('PY', r['publication_year']), ('JO' if kind == 'article' else 'T2', r['container_title']), ('VL', r['volume']), ('IS', r['issue'])]
        page_parts = r['pages'].split('-', 1)
        lines += [('SP', page_parts[0] if r['pages'] else r['article_number']), ('EP', page_parts[1] if len(page_parts) > 1 else ''), ('DO', r['doi']), ('UR', r['url']), ('Y2', r['checked_date']), ('N1', r['notes'])]
        ris.append('\n'.join(k+'  - '+v.replace('\n',' ') for k,v in lines if v)+'\nER  -')
        item = {'id': r['reference_id'], 'type': {'journal_article': 'article-journal', 'conference_paper': 'paper-conference', 'preprint': 'article'}[r['reference_type']], 'title': r['title'], 'author': authors(r)}
        for key, field in [('container-title','container_title'),('volume','volume'),('issue','issue'),('page','pages'),('article-number','article_number'),('DOI','doi'),('URL','url')]:
            if r[field]: item[key]=r[field]
        if r['article_number'] and not r['pages']:item['page']=r['article_number']
        if r['publication_year']: item['issued']={'date-parts': [[int(x) for x in (r['publication_date'] or r['publication_year']).split('-')]]}
        if r['publication_status']=='preprint':item['genre']='Preprint'
        csl.append(item)
    return {'bibtex': '\n\n'.join(bib)+'\n', 'ris': '\n\n'.join(ris)+'\n', 'csl_json': json.dumps(csl, ensure_ascii=False, indent=2)+'\n'}


def coverage(data):
    records=data['references']
    return {'references': len(records), 'local_article_files': len(data['reference_files']), 'duplicate_file_copies': len(data['reference_files'])-len({x['reference_id'] for x in data['reference_files']}), 'published_articles': sum(r['publication_status']=='published' for r in records), 'preprints': sum(r['publication_status']=='preprint' for r in records), 'metadata_needs_review': sum(r['metadata_status'] in {'pdf_checked','needs_review'} for r in records), 'context_links': sum(l['relation']=='background' for l in data['reference_links']), 'checked_claim_links': sum(l['relation']=='supports_claim' for l in data['reference_links']), 'default_order': 'publication_year_ascending'}


def build(root=ROOT, sqlite_path=None):
    root=Path(root);data=read_database(root);validate_database(data,root)
    data['references']=sort_references(data['references'])
    data['coverage']=coverage(data);data['exports']=exports(data['references'])
    for key,suffix in [('bibtex','bib'),('ris','ris'),('csl_json','csl.json')]:
        (root/'catalog'/('bibliography.'+suffix)).write_text(data['exports'][key],encoding='utf-8')
    (root/'catalog/reference_coverage.json').write_text(json.dumps(data['coverage'],indent=2)+'\n',encoding='utf-8')
    output=root/'webapp/app/data/references.json';output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    if sqlite_path:
        with sqlite3.connect(sqlite_path) as db:
            db.execute('PRAGMA foreign_keys=ON')
            for table in reversed(TABLES):db.execute(f'DROP TABLE IF EXISTS "{table}"')
            for table,fields in TABLES.items():
                columns=[f'"{f}" TEXT NOT NULL'+(' PRIMARY KEY' if i==0 else '') for i,f in enumerate(fields)]
                if table!='references':columns+=['FOREIGN KEY(reference_id) REFERENCES "references"(reference_id)']
                db.execute(f'CREATE TABLE "{table}" ('+', '.join(columns)+')')
                db.executemany(f'INSERT INTO "{table}" VALUES ('+','.join('?' for f in fields)+')', [[r[f] for f in fields] for r in data[table]])
            db.execute('CREATE INDEX reference_links_target ON reference_links(target_type,target_id)')
    return data['coverage']


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['check','build','update'])
    parser.add_argument('--root',type=Path,default=ROOT)
    parser.add_argument('--sqlite',type=Path)
    for name in TABLES:parser.add_argument('--'+name.replace('_','-'),type=Path)
    parser.add_argument('--apply',action='store_true',help='Write validated CSV upserts; default is preview only')
    args=parser.parse_args();data=read_database(args.root)
    if args.command=='update':
        for table,fields in TABLES.items():
            path=getattr(args,table)
            if path:
                incoming=load_csv(path)
                if any(set(row)!=set(fields) for row in incoming):raise ValueError(f'{table}: columns must match the template')
                merged={r[fields[0]]:r for r in data[table]}
                if len({r[fields[0]] for r in incoming})!=len(incoming):raise ValueError('Duplicate incoming IDs')
                merged.update({r[fields[0]]:r for r in incoming});data[table]=list(merged.values())
        validate_database(data,args.root)
        if args.apply:
            for table,fields in TABLES.items():write_csv(args.root/'catalog'/(table+'.csv'),sort_references(data[table]) if table=='references' else data[table],fields)
        print(json.dumps({'applied':args.apply,**coverage(data)}));return
    validate_database(data,args.root)
    print(json.dumps(build(args.root,args.sqlite) if args.command=='build' else coverage(data)))


if __name__=='__main__':main()
