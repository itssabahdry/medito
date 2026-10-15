import {z} from 'zod';
import {query,transaction} from './db';
import {requireUser,rateLimit} from './auth';
import {assert,body,json} from './http';
const description=z.object({type:z.enum(['offer','answer']),sdp:z.string().min(1).max(12000)}).strict();
const candidate=z.object({type:z.literal('candidate'),candidate:z.object({candidate:z.string().max(1500),sdpMid:z.string().max(40).nullable().optional(),sdpMLineIndex:z.number().int().min(0).max(100).nullable().optional(),usernameFragment:z.string().max(200).nullable().optional()}).strict()}).strict();
const payload=z.union([description,candidate]);
const command=z.discriminatedUnion('action',[
 z.object({action:z.literal('join'),client_id:z.uuid()}),
 z.object({action:z.literal('poll'),client_id:z.uuid(),after:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)}),
 z.object({action:z.literal('leave'),client_id:z.uuid()}),
 z.object({action:z.literal('signal'),client_id:z.uuid(),recipient_client:z.uuid(),payload})
]);
export async function callsRoute(request:Request,id:string){
 z.uuid().parse(id);const user=await requireUser(request);
 const [a]=await query('SELECT a.*,s.mode,s.starts_at,s.ends_at,s.therapist_id,p.status AS provider_status,u.name AS therapist_name,v.name AS patient_name FROM appointments a JOIN slots s ON s.id=a.slot_id JOIN profiles p ON p.user_id=s.therapist_id JOIN users u ON u.id=s.therapist_id JOIN users v ON v.id=a.patient_id WHERE a.id=$1',[id]);
 assert(a && (a.patient_id===user.id||a.therapist_id===user.id),404,'جلسه پیدا نشد.');
 assert(a.status==='booked' && a.mode==='voice' && a.provider_status==='approved',403,'تماس برای این نوبت فعال نیست.');
 assert(Date.now()>=+new Date(a.starts_at)-10*60000 && Date.now()<=+new Date(a.ends_at)+15*60000,403,'ورود از ۱۰ دقیقه قبل تا ۱۵ دقیقه بعد از پایان جلسه امکان‌پذیر است.');
 const peerUser=user.id===a.patient_id?a.therapist_id:a.patient_id;
 if(request.method==='GET'){
   const iceServers:RTCIceServer[]=[];
   if(process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL)iceServers.push({urls:process.env.TURN_URL,username:process.env.TURN_USERNAME,credential:process.env.TURN_CREDENTIAL});
   return json({appointment:{id:a.id,starts_at:a.starts_at,ends_at:a.ends_at,peer_name:user.id===a.patient_id?a.therapist_name:a.patient_name},initiator:user.id===a.patient_id,iceServers});
 }
 if(request.method!=='POST')return null;
 const data=command.parse(await body(request));
 if(data.action==='join'){
   await rateLimit('call-join:'+user.id,30,3600);
   const rows=await query("INSERT INTO call_peers(appointment_id,user_id,client_id) VALUES($1,$2,$3) ON CONFLICT(appointment_id,user_id) DO UPDATE SET client_id=$3,last_seen=now() WHERE call_peers.last_seen<now()-interval '20 seconds' OR call_peers.client_id=$3 RETURNING client_id",[id,user.id,data.client_id]);
   assert(rows.length,409,'این جلسه در پنجره دیگری باز است. آن را ببندید و ۲۰ ثانیه صبر کنید.');
   await query("DELETE FROM call_signals WHERE created_at<now()-interval '3 hours'");return json({ok:true});
 }
 if(data.action==='leave'){await query('DELETE FROM call_peers WHERE appointment_id=$1 AND user_id=$2 AND client_id=$3',[id,user.id,data.client_id]);await query('DELETE FROM call_signals WHERE appointment_id=$1 AND (recipient_client=$2 OR sender_client=$2)',[id,data.client_id]);return json({ok:true});}
 const own=await query("UPDATE call_peers SET last_seen=now() WHERE appointment_id=$1 AND user_id=$2 AND client_id=$3 AND last_seen>now()-interval '20 seconds' RETURNING client_id",[id,user.id,data.client_id]);assert(own.length,403,'اتصال جلسه منقضی شده است. دوباره وارد شوید.');
 const [peer]=await query("SELECT client_id FROM call_peers WHERE appointment_id=$1 AND user_id=$2 AND last_seen>now()-interval '15 seconds'",[id,peerUser]);
 if(data.action==='poll')return json({peer:peer||null,signals:await query('SELECT id::int,sender_client,payload FROM call_signals WHERE appointment_id=$1 AND recipient_client=$2 AND id>$3 ORDER BY id LIMIT 100',[id,data.client_id,data.after])});
 await rateLimit('call-signal:'+user.id,500,60);
 assert(peer && peer.client_id===data.recipient_client,409,'طرف دیگر هنوز به جلسه وارد نشده است.');
 // Recheck the appointment while holding its row lock so cancellation cannot race a signal insert.
 await transaction(async c=>{const {rows:[live]}=await c.query('SELECT status FROM appointments WHERE id=$1 FOR SHARE',[id]);assert(live.status==='booked',403,'این جلسه بسته شده است.');await c.query('INSERT INTO call_signals(appointment_id,sender_id,recipient_client,sender_client,payload) VALUES($1,$2,$3,$4,$5)',[id,user.id,data.recipient_client,data.client_id,JSON.stringify(data.payload)]);});return json({ok:true},201);
}
