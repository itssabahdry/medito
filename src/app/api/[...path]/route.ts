import { authRoute, profileRoute, documentsRoute, adminRoute } from '@/lib/identity';
import { query } from '@/lib/db';
import { directoryRoute } from '@/lib/directory';
import { checkOrigin, handleError, json } from '@/lib/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function dispatch(request: Request): Promise<Response> {
  try {
    const parts=new URL(request.url).pathname.replace(/^\/api\//,'').split('/');
    const [resource,id,action]=parts;
    if(!['GET','HEAD'].includes(request.method)) checkOrigin(request);
    let response: Response|null=null;
    if(resource==='health' && request.method==='GET') {await query('SELECT 1');return json({ok:true});}
    if(resource==='auth') response=await authRoute(request,id);
    if(resource==='profile') response=await profileRoute(request);
    if(resource==='therapists') response=await directoryRoute(request,id);
    if(resource==='documents') response=await documentsRoute(request,id);
    if(resource==='admin' && id==='providers') response=await adminRoute(request,action);
    return response || json({error:'این مسیر وجود ندارد.'},404);
  } catch(error) {return handleError(error);}
}
export const GET=dispatch; export const POST=dispatch; export const PUT=dispatch; export const DELETE=dispatch;
