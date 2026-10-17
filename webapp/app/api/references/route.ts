import literature from '../../data/references.json';
import {csvText} from '../../catalog-lib';

export async function GET(request:Request){
 const format=new URL(request.url).searchParams.get('format')||'json';
 const outputs:Record<string,{body:string;type:string;name:string}>={
  bibtex:{body:literature.exports.bibtex,type:'application/x-bibtex',name:'icon-pcl-references.bib'},
  ris:{body:literature.exports.ris,type:'application/x-research-info-systems',name:'icon-pcl-references.ris'},
  csl_json:{body:literature.exports.csl_json,type:'application/vnd.citationstyles.csl+json',name:'icon-pcl-references.csl.json'},
  csv:{body:csvText(literature.references),type:'text/csv',name:'references.csv'},
  links_csv:{body:csvText(literature.reference_links),type:'text/csv',name:'reference_links.csv'},
  affiliations_csv:{body:csvText(literature.reference_affiliations),type:'text/csv',name:'reference_affiliations.csv'},
 };
 if(format==='json'){const {exports,...data}=literature;return Response.json(data)}
 const result=Object.hasOwn(outputs,format)?outputs[format]:null;if(!result)return Response.json({error:'Unknown bibliography format'}, {status:400});
 return new Response(result.body,{headers:{'Content-Type':result.type+'; charset=utf-8','Content-Disposition':'attachment; filename="'+result.name+'"','X-Content-Type-Options':'nosniff'}});
}
