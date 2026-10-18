import sources from './data/pricing-sources.json';

const repo='https://github.com/PodComet/ICoN-PCL-Equipment-Metadata';
const link=(url:string,label:string)=><a href={url} target="_blank" rel="noopener noreferrer">{label}</a>;

export default function PricingSources(){
 const review=sources.review_summary,coverage=sources.coverage;
 return <section className="brand-audit-panel">
  <h3>Purchase-price sources</h3>
  <p>Broad research review · {sources.checked_date}. Added prices for <b>{review.instrument_prices_added} previously unpriced models</b>: {review.new_condition_instrument_prices} new-equipment configurations and {review.secondary_or_unspecified_instrument_prices} secondary-market or condition-unconfirmed references. Added {review.unique_new_component_pack_quotes} distinct material/component pack quotes.</p>
  <p>{sources.scope}</p>
  {sources.focused_reviews.map(r=><p key={r.id}>{link(repo+'/blob/main/'+r.path,r.title)} · {r.checked_date}: {r.summary}</p>)}
  <p>The committed seed has {coverage.instrument_records} model records and {coverage.component_occurrences} component entries. Missing prices remain explicit; reference packs require grade, form and amount matching before they contribute to a process total.</p>
  <details><summary>Price lists, publication years and procurement context</summary>
   <div className="audit-table-scroll"><table><thead><tr><th>Price source</th><th>Publication year</th><th>Market</th><th>Scope</th></tr></thead><tbody>{sources.sources.map(s=><tr key={s.id}><th>{link(s.url,s.title)}<small className="audit-entity-note">{s.publisher}</small></th><td>{s.source_year}{s.effective_date&&<small className="audit-entity-note">Effective {s.effective_date}</small>}</td><td>{s.market}</td><td>{s.notes}</td></tr>)}</tbody></table></div>
   <p>A price observed in 2026 is only called a 2026 price list when the source states that year. Distributor list prices and seller offers remain separate from manufacturer MSRP and official list benchmarks.</p>
   {sources.institutional_context.map(c=><p key={c.institution}>{link(c.url,c.institution+' procurement guidance')}: {c.finding}</p>)}
  </details>
  <p>{link(repo+'/blob/main/'+sources.latest_review_path,'Review price evidence and remaining research gaps')} · {link(repo+'/blob/main/catalog/instrument_price_coverage.csv','Instrument price coverage CSV')} · {link(repo+'/blob/main/catalog/component_price_coverage.csv','Component price coverage CSV')}</p>
 </section>;
}
