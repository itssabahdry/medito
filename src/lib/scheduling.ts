import { z } from 'zod';
import { query,transaction } from './db';
import { rateLimit,requireUser } from './auth';
import { assert,body,json } from './http';
import type { PoolClient } from 'pg';
const uuid=z.uuid();
async function patientAvailable(c:PoolClient,patientId:string,starts:Date,ends:Date,exclude?:string){
  const {rowCount}=await c.query("SELECT 1 FROM appointments a JOIN slots s ON s.id=a.slot_id WHERE a.patient_id=$1 AND a.status='booked' AND tstzrange(s.starts_at,s.ends_at,'[)') && tstzrange($2::timestamptz,$3::timestamptz,'[)') AND ($4::uuid IS NULL OR a.id<>$4)",[patientId,starts,ends,exclude||null]);
  assert(!rowCount,409,'در این بازه زمانی نوبت دیگری دارید.');
}
export async function slotsRoute(request:Request,id?:string){
  const user=await requireUser(request,'therapist');
  if(request.method==='GET')return json({slots:await query("SELECT s.*,EXISTS(SELECT 1 FROM appointments a WHERE a.slot_id=s.id AND a.status!='cancelled') AS booked FROM slots s WHERE therapist_id=$1 AND starts_at>now() ORDER BY starts_at LIMIT 100",[user.id])});
  if(request.method==='DELETE' && id){uuid.parse(id);const deleted=await query('DELETE FROM slots WHERE id=$1 AND therapist_id=$2 AND NOT EXISTS(SELECT 1 FROM appointments WHERE slot_id=$1) RETURNING id',[id,user.id]);assert(deleted.length,409,'این زمان قابل حذف نیست یا سابقه رزرو دارد.');return json({ok:true});}
  if(request.method!=='POST')return null;
  await rateLimit('slots:'+user.id,100,3600);
  const data=z.object({starts_at:z.iso.datetime({offset:true}),ends_at:z.iso.datetime({offset:true}),mode:z.enum(['in_person','voice'])}).strict().parse(await body(request));
  const starts=new Date(data.starts_at),ends=new Date(data.ends_at);const duration=+ends-+starts;
  assert(+starts>Date.now() && +starts<Date.now()+90*86400000 && duration>=15*60000 && duration<=180*60000,400,'زمان باید در ۹۰ روز آینده و مدت جلسه بین ۱۵ تا ۱۸۰ دقیقه باشد.');
  const slot=await transaction(async c=>{const {rows:[p]}=await c.query('SELECT status,phone_enabled FROM profiles WHERE user_id=$1 FOR UPDATE',[user.id]);assert(p?.status==='approved',403,'ابتدا باید صلاحیت حرفه‌ای شما تأیید شود.');assert(data.mode!=='voice'||p.phone_enabled,400,'مشاوره صوتی را در پروفایل فعال کنید.');return (await c.query('INSERT INTO slots(therapist_id,starts_at,ends_at,mode) VALUES($1,$2,$3,$4) RETURNING *',[user.id,starts,ends,data.mode])).rows[0];});return json({slot},201);
}
export async function appointmentsRoute(request:Request,id?:string){
  const user=await requireUser(request);
  if(request.method==='GET')return json({appointments:await query(`SELECT a.id,a.status,a.fee,a.created_at,s.starts_at,s.ends_at,s.mode,s.therapist_id,p.name AS therapist_name,u.name AS patient_name,EXISTS(SELECT 1 FROM reviews r WHERE r.appointment_id=a.id) AS reviewed FROM appointments a JOIN slots s ON s.id=a.slot_id JOIN users p ON p.id=s.therapist_id JOIN users u ON u.id=a.patient_id WHERE ${user.role==='therapist'?'s.therapist_id':'a.patient_id'}=$1 ORDER BY s.starts_at DESC LIMIT 100`,[user.id])});
  if(request.method==='POST'){
    assert(user.role==='user',403,'رزرو نوبت با حساب کاربری مراجع انجام می‌شود.');await rateLimit('book:'+user.id,30,3600);
    const data=z.object({slot_id:uuid}).strict().parse(await body(request));
    const appointment=await transaction(async c=>{
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[user.id]);
      const {rows:[ref]}=await c.query('SELECT therapist_id FROM slots WHERE id=$1',[data.slot_id]);assert(ref,404,'زمان انتخابی پیدا نشد.');
      const {rows:[p]}=await c.query('SELECT * FROM profiles WHERE user_id=$1 FOR UPDATE',[ref.therapist_id]);assert(p.status==='approved',409,'این متخصص فعلاً امکان دریافت نوبت ندارد.');
      const {rows:[s]}=await c.query('SELECT * FROM slots WHERE id=$1 FOR UPDATE',[data.slot_id]);assert(s && +new Date(s.starts_at)>Date.now(),409,'زمان انتخابی گذشته یا حذف شده است.');assert(s.mode!=='voice'||p.phone_enabled,409,'مشاوره صوتی این متخصص غیرفعال است.');
      await patientAvailable(c,user.id,s.starts_at,s.ends_at);
      return (await c.query('INSERT INTO appointments(slot_id,patient_id,fee) VALUES($1,$2,$3) RETURNING id',[s.id,user.id,p.fee])).rows[0];
    });return json({appointment},201);
  }
  if(request.method==='PUT' && id){
    uuid.parse(id);const data=z.object({action:z.enum(['cancel','complete','reschedule']),slot_id:uuid.optional()}).strict().parse(await body(request));
    const [ref]=await query('SELECT a.patient_id,s.therapist_id FROM appointments a JOIN slots s ON s.id=a.slot_id WHERE a.id=$1',[id]);assert(ref && (ref.patient_id===user.id||ref.therapist_id===user.id),404,'نوبت پیدا نشد.');
    await transaction(async c=>{
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[ref.patient_id]);
      const {rows:[profile]}=await c.query('SELECT * FROM profiles WHERE user_id=$1 FOR UPDATE',[ref.therapist_id]);
      const {rows:[a]}=await c.query('SELECT a.*,s.starts_at,s.ends_at FROM appointments a JOIN slots s ON s.id=a.slot_id WHERE a.id=$1 FOR UPDATE OF a',[id]);assert(a.status==='booked',409,'این نوبت دیگر قابل تغییر نیست.');
      if(data.action==='complete'){assert(user.id===ref.therapist_id,403,'فقط متخصص می‌تواند پایان جلسه را ثبت کند.');assert(+new Date(a.ends_at)<=Date.now(),400,'زمان پایان جلسه هنوز نرسیده است.');await c.query("UPDATE appointments SET status='completed' WHERE id=$1",[id]);}
      else{
        assert(+new Date(a.starts_at)>Date.now(),400,'زمان تغییر یا لغو نوبت گذشته است.');
        if(data.action==='cancel')await c.query("UPDATE appointments SET status='cancelled' WHERE id=$1",[id]);
        else{
          assert(user.id===ref.patient_id,403,'جابه‌جایی نوبت توسط مراجع انجام می‌شود.');assert(data.slot_id && data.slot_id!==a.slot_id,400,'زمان جدید را انتخاب کنید.');
          const {rows:[s]}=await c.query('SELECT * FROM slots WHERE id=$1 FOR UPDATE',[data.slot_id]);
          assert(s && s.therapist_id===ref.therapist_id && +new Date(s.starts_at)>Date.now() && profile.status==='approved',400,'زمان جدید برای این متخصص معتبر نیست.');assert(s.mode!=='voice'||profile.phone_enabled,400,'مشاوره صوتی فعال نیست.');
          await patientAvailable(c,ref.patient_id,s.starts_at,s.ends_at,id);
          await c.query('UPDATE appointments SET slot_id=$2,fee=$3 WHERE id=$1',[id,s.id,profile.fee]);
        }
      }
      await c.query('INSERT INTO audit_log(actor_id,subject_id,action,details) VALUES($1,$2,$3,$4)',[user.id,ref.therapist_id,'appointment.'+data.action,JSON.stringify({appointment_id:id})]);
    });return json({ok:true});
  }return null;
}
export async function reviewsRoute(request:Request){
  const user=await requireUser(request,'user');if(request.method!=='POST')return null;
  const data=z.object({appointment_id:uuid,rating:z.number().int().min(1).max(5),comment:z.string().trim().min(5).max(1500)}).strict().parse(await body(request));
  const rows=await query("INSERT INTO reviews(appointment_id,rating,comment) SELECT id,$3,$4 FROM appointments WHERE id=$1 AND patient_id=$2 AND status='completed' RETURNING id",[data.appointment_id,user.id,data.rating,data.comment]);assert(rows.length,403,'نظر فقط برای جلسه انجام‌شده خودتان قابل ثبت است.');return json({ok:true},201);
}
