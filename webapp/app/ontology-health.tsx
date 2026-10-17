import {CheckCircle2,Download} from 'lucide-react';
import health from './data/ontology-health.json';

export default function OntologyHealth(){
 const c=health.counts;
 return <section className="ontology-health" aria-label="Ontology validation">
  <div className="ontology-health-heading"><div><p className="eyebrow">REUSABLE RESEARCH DATA</p><h3>Ontology validation &amp; downloads</h3></div><strong className="ontology-health-pass"><CheckCircle2 size={18}/>Structure checks passed</strong></div>
  <p>Reviewed catalog snapshot · {health.review_date} · {c.m_categories} M classes and {c.x_categories} Purdue-origin X classes. These checks cover data structure and relationships; scientific suitability and experimental results require their own evidence.</p>
  <dl className="ontology-health-counts"><div><dt>Equipment records</dt><dd>{c.equipment_records.toLocaleString('en-US')}</dd></div><div><dt>Unit definitions checked</dt><dd>{c.unit_definitions_checked}</dd></div><div><dt>Source sequences checked</dt><dd>{c.acyclic_source_sequences}</dd></div><div><dt>Source evidence entries</dt><dd>{c.source_evidence}</dd></div></dl>
  <p>{c.conditions} operating conditions and {c.reported_properties} reported properties retain their source links. {c.model_name_review_pairs-c.unreviewed_model_name_pairs} of {c.model_name_review_pairs} similar model-name pairs reviewed; distinct models and variants remain separate. N10, P13 and P14 have no source step sequence and remain explicit planning gaps.</p>
  <div className="ontology-health-downloads">{[['ontology.ttl','Knowledge graph · Turtle'],['ontology.jsonld','Knowledge graph · JSON-LD'],['audit.json','Validation & model review'],['normalized-conditions.json','Normalized conditions'],['schemas.json','Data schemas'],['shapes.ttl','Graph validation rules']].map(([file,label])=><a key={file} className="secondary-button" href={'/ontology/'+file} download><Download size={14}/>{label}</a>)}</div>
  <p className="fine-print">Downloads contain the committed public catalog, excluding private inventory, saved plans and live CSV imports. Published measurements remain separate from unvalidated property expectations.</p>
  <details><summary>How the checks work</summary><ul>{health.checks.map(check=><li key={check}>{check}</li>)}</ul><a href="https://github.com/PodComet/ICoN-PCL-Equipment-Metadata/blob/main/docs/ontology-validation.md" target="_blank" rel="noopener noreferrer">Methods, limitations and reproducible commands</a></details>
 </section>;
}
