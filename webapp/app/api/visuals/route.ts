import science from '../../data/process-science.json';
import components from '../../data/components.json';

// Public, reviewed reference metadata only. Saved plans retain their existing
// authenticated /api/processes boundary; inventory and research uploads are absent.
export async function GET(){
 return Response.json({science,components:{checked_date:components.checked_date,formulations:components.formulations,offers:[]}},
  {headers:{'Cache-Control':'no-store'}});
}
