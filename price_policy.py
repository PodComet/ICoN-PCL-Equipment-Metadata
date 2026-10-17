"""Reproducible MSRP estimates under the owner's rule; no FX or invented anchors."""
import json,re,unicodedata
from datetime import date
from decimal import Decimal,ROUND_HALF_UP
from urllib.parse import urlparse

def identity(maker,name):
    norm=lambda s:re.sub('[^a-z0-9]','',unicodedata.normalize('NFKC',s or '').lower())
    m,n=norm(maker),norm(name)
    return m+':'+(n[len(m):] if m and n.startswith(m) else n)

def amount(value):
    try:
        if value is None or not str(value).strip():return None
        n=Decimal(str(value))
        return n if n.is_finite() and n>=0 else None
    except Exception:return None

def rounded(n):return format(Decimal(str(n)).quantize(Decimal('.01'),rounding=ROUND_HALF_UP).normalize(),'f')
def valid_url(s):return urlparse(s or '').scheme in {'http','https'} and bool(urlparse(s).netloc)
def valid_date(s):
    try:return date.fromisoformat(s).isoformat()==s
    except Exception:return False

def benchmark(r,p):
    exact=amount(r.get('msrp_value'))
    if exact is not None and re.fullmatch('[A-Z]{3}',r.get('msrp_currency','')) and valid_url(r.get('price_source_url')) and valid_date(r.get('price_checked_date')):
        return dict(record=r,amount=exact,currency=r['msrp_currency'],source=r['price_source_url'],date=r['price_checked_date'],kind='MSRP')
    value=amount(r.get('manufacturer_price_value'))
    if p['benchmark_policy']=='msrp_and_official_list' and r.get('manufacturer_price_kind')=='list_price' and value is not None and re.fullmatch('[A-Z]{3}',r.get('manufacturer_price_currency','')) and valid_url(r.get('manufacturer_price_source_url')) and valid_date(r.get('manufacturer_price_checked_date')) and r.get('manufacturer_price_scope'):
        return dict(record=r,amount=value,currency=r['manufacturer_price_currency'],source=r['manufacturer_price_source_url'],date=r['manufacturer_price_checked_date'],kind='manufacturer list price')

def with_msrp_estimates(records,reviews,policy):
    anchors=[b for r in records if (b:=benchmark(r,policy))]
    by_id={r['equipment_id']:r for r in records};by_identity={};by_class={};older={}
    for b in anchors:
        by_identity.setdefault(identity(b['record']['manufacturer'],b['record']['model_name']),[]).append(b)
        by_class.setdefault(b['record']['category_id'],[]).append(b)
    for review in reviews:
        source=by_id.get(review['equipment_id'])
        if not source or identity(source['manufacturer'],source['model_name'])!=identity(review['manufacturer'],review['model_name']) or review['lifecycle_status']!='newer_model_confirmed' or review['successor_relationship'] not in {'direct_successor','newer_generation'} or not valid_url(review['successor_evidence_url']) or not valid_url(review['successor_product_url']):continue
        older.setdefault(identity(review['manufacturer'],review['successor_model_name']),[]).append(identity(review['manufacturer'],review['model_name']))
    output=[]
    for r in records:
        result={**r,'estimated_msrp_low':'','estimated_msrp_high':'','estimate_currency':'','estimate_method':'','estimate_status':'no_benchmarks','estimate_confidence':'not_estimated','estimate_subject':r.get('equipment_subtype') or r['category_name'],'estimate_basis':'No qualifying MSRP/list-price benchmark found for this category or a documented older model.','estimate_source_urls':'','estimate_checked_date':policy['checked_date'],'estimate_benchmark_ids':''}
        output.append(result)
        if amount(r.get('msrp_value')) is not None:
            result.update(estimate_status='explicit_msrp',estimate_basis='Explicit model MSRP is recorded; no inferred MSRP needed.');continue
        preferred=r.get('manufacturer_price_currency') or 'USD'
        def choose(values):
            currencies=list(dict.fromkeys(v['currency'] for v in values))
            currency=preferred if preferred in currencies else 'USD' if 'USD' in currencies else currencies[0] if len(currencies)==1 else ''
            return [v for v in values if v['currency']==currency]
        def finish(low,high,values,method,basis):
            result.update(estimated_msrp_low=rounded(low),estimated_msrp_high=rounded(high),estimate_currency=values[0]['currency'],estimate_method=method,estimate_status='calculated',estimate_confidence='formula_based',estimate_basis=basis+' Source labels remain MSRP or manufacturer list price; this result is an estimate, not an explicit model MSRP.',estimate_source_urls=';'.join(dict.fromkeys(v['source'] for v in values)),estimate_benchmark_ids=';'.join(dict.fromkeys(v['record']['equipment_id'] for v in values)))
        frontier=older.get(identity(r['manufacturer'],r['model_name']),[]);seen=set();found=False
        while frontier:
            level=[k for k in frontier if k not in seen]
            if not level:break
            seen.update(level);choices=choose([b for k in level for b in by_identity.get(k,[])])
            if choices:
                choices.sort(key=lambda b:b['record']['equipment_id']);choices.sort(key=lambda b:b['date'],reverse=True);choices.sort(key=lambda b:b['kind']!='MSRP')
                b=choices[0];mult=Decimal(str(policy['older_model_multiplier']))
                finish(b['amount']*mult,b['amount']*mult,[b],'older_model_plus_20',f"Closest documented older model: {b['record']['model_name']}; {b['kind']} {b['currency']} {rounded(b['amount'])} × {policy['older_model_multiplier']}.");found=True;break
            frontier=[k for source in level for k in older.get(source,[])]
        if found:continue
        values=choose(by_class.get(r['category_id'],[]))
        if not values:continue
        values.sort(key=lambda b:b['record']['equipment_id']);values.sort(key=lambda b:b['date'],reverse=True);values.sort(key=lambda b:b['kind']!='MSRP')
        unique={identity(v['record']['manufacturer'],v['record']['model_name']):v for v in reversed(values)}
        values=list(unique.values());low=min(v['amount'] for v in values);high=max(v['amount'] for v in values);a=next(v for v in values if v['amount']==low);b=next(v for v in values if v['amount']==high)
        lower=low*Decimal(str(policy['minimum_multiplier']));upper=high*Decimal(str(policy['maximum_multiplier']))
        if lower>upper:
            result.update(estimate_status='inverted_range',estimate_currency=a['currency'],estimate_source_urls=';'.join(dict.fromkeys([a['source'],b['source']])),estimate_benchmark_ids=';'.join(dict.fromkeys([a['record']['equipment_id'],b['record']['equipment_id']])),estimate_basis=f"Category rule would yield {a['currency']} {rounded(lower)}–{rounded(upper)} (lower exceeds upper). No interval is published; add a qualifying older-model price or a valid category spread.");continue
        finish(lower,upper,[a,b],'category_120_80',f"Category {r['category_id']}: {policy['minimum_multiplier']} × lowest benchmark {a['currency']} {rounded(low)} ({a['record']['model_name']}) through {policy['maximum_multiplier']} × highest benchmark {b['currency']} {rounded(high)} ({b['record']['model_name']}).")
    return output
