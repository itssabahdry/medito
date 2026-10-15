import { z } from 'zod';
import { query } from './db';
import { assert, json } from './http';
import { specialties } from './constants';
const summary=`SELECT u.id,u.name,p.title,p.specialty,p.city,p.address,p.bio,p.experience,p.fee,p.phone_enabled,p.is_demo,
 COALESCE(r.rating,0)::float AS rating,COALESCE(r.review_count,0)::int AS review_count,
 ((COALESCE(r.rating,0)*COALESCE(r.review_count,0)+3.5*5)/(COALESCE(r.review_count,0)+5)) AS score
 FROM profiles p JOIN users u ON u.id=p.user_id
 LEFT JOIN (SELECT s.therapist_id,AVG(r.rating) AS rating,COUNT(*) AS review_count FROM reviews r JOIN appointments a ON a.id=r.appointment_id JOIN slots s ON s.id=a.slot_id GROUP BY s.therapist_id) r ON r.therapist_id=p.user_id`;
export async function findTherapists(filters:{q?:string;city?:string;specialty?:string;mode?:string;maxFee?:number;limit?:number}={}) {
  const conditions=["p.status='approved'"];const values:unknown[]=[];
  const add=(condition:string,value:unknown)=>{values.push(value);conditions.push(condition.replace('?', '$'+values.length));};
  if(filters.q) add("(u.name || ' ' || p.bio) ILIKE ?",'%'+filters.q+'%');
  if(filters.city) add('p.city=?',filters.city);
  if(filters.specialty) add('p.specialty=?',filters.specialty);
  if(filters.mode==='voice') conditions.push('p.phone_enabled=true');
  if(filters.maxFee!==undefined) add('p.fee<=?',filters.maxFee);
  values.push(filters.limit||30);
  return query(summary+' WHERE '+conditions.join(' AND ')+' ORDER BY score DESC,review_count DESC,u.name ASC LIMIT $'+values.length,values);
}
export async function directoryRoute(request:Request,id?:string) {
  if(request.method!=='GET') return null;
  if(id) {
    z.uuid().parse(id);const [therapist]=await query(summary+" WHERE p.status='approved' AND u.id=$1",[id]);assert(therapist,404,'متخصص پیدا نشد.');
    const slots=await query("SELECT s.id,s.starts_at,s.ends_at,s.mode FROM slots s WHERE s.therapist_id=$1 AND s.starts_at>now() AND (s.mode='in_person' OR $2::boolean) AND NOT EXISTS(SELECT 1 FROM appointments a WHERE a.slot_id=s.id AND a.status!='cancelled') ORDER BY s.starts_at LIMIT 60",[id,therapist.phone_enabled]);
    const reviews=await query("SELECT r.id,r.rating,r.comment,r.created_at,split_part(u.name,' ',1) AS author FROM reviews r JOIN appointments a ON a.id=r.appointment_id JOIN slots s ON s.id=a.slot_id JOIN users u ON u.id=a.patient_id WHERE s.therapist_id=$1 ORDER BY r.created_at DESC LIMIT 50",[id]);return json({therapist,slots,reviews});
  }
  const params=new URL(request.url).searchParams;
  const filters=z.object({q:z.string().max(100).optional(),city:z.string().max(80).optional(),specialty:z.enum(specialties).optional(),mode:z.enum(['voice','in_person']).optional(),limit:z.coerce.number().int().min(1).max(30).optional()}).parse(Object.fromEntries([...params].filter(([,v])=>v!=='')));
  return json({therapists:await findTherapists(filters),cities:(await query("SELECT DISTINCT city FROM profiles WHERE status='approved' ORDER BY city")).map(x=>x.city)});
}
