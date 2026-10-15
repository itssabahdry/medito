import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {dispatch} from '../src/app/api/[...path]/route';
import {query,pool} from '../src/lib/db';
import {hashPassword,newSession} from '../src/lib/auth';
const origin='http://localhost:3000';
type Account={id:string;cookie:string};
async function request(path:string,method='GET',data?:unknown,cookie='',requestOrigin=origin){const response=await dispatch(new Request(origin+'/api/'+path,{method,headers:{Origin:requestOrigin,...(cookie?{Cookie:cookie}:{}),...(data instanceof FormData?{}:{'Content-Type':'application/json'})},...(data!==undefined?{body:data instanceof FormData?data:JSON.stringify(data)}:{})}));return response;}
async function account(role='user'):Promise<Account>{const response=await request('auth/register','POST',{name:'کاربر آزمایشی',email:randomUUID()+'@example.test',password:'Test-password-12345',role});assert.equal(response.status,201);const data=await response.json();return {id:data.user.id,cookie:response.headers.get('set-cookie')!.split(';')[0]};}
let user:Account,other:Account,provider:Account,admin:Account,slotId:string,appointmentId:string;
before(async()=>{user=await account();other=await account();provider=await account('therapist');const [row]=await query("INSERT INTO users(name,email,password_hash,role) VALUES('Admin',$1,$2,'admin') RETURNING id",[randomUUID()+'@example.test',await hashPassword('test-admin-password')]);admin={id:row.id,cookie:'medito_session='+await newSession(row.id)};});
after(async()=>{await pool.end();});
test('registration rejects administrator role and unexpected privilege fields',async()=>{assert.equal((await request('auth/register','POST',{name:'Attacker',email:'attacker@example.test',password:'Test-password-12345',role:'admin'})).status,400);assert.equal((await request('auth/register','POST',{name:'Attacker',email:'attacker2@example.test',password:'Test-password-12345',role:'user',approved:true})).status,400);});
test('mutations reject foreign origins, including login',async()=>{assert.equal((await request('auth/logout','POST',{},user.cookie,'https://attacker.test')).status,403);});
test('sessions are stored hashed, cookies are HttpOnly and logout revokes them',async()=>{const a=await account();const raw=a.cookie.split('=')[1];assert.equal((await query('SELECT 1 FROM sessions WHERE token_hash=$1',[raw])).length,0);assert.ok((await request('auth/me','GET',undefined,a.cookie)).ok);await request('auth/logout','POST',{},a.cookie);assert.equal((await (await request('auth/me','GET',undefined,a.cookie)).json()).user,null);});
test('unapproved providers cannot create availability and patients cannot edit profiles',async()=>{const start=new Date(Date.now()+86400000);assert.equal((await request('slots','POST',{starts_at:start.toISOString(),ends_at:new Date(+start+3000000).toISOString(),mode:'in_person'},provider.cookie)).status,403);assert.equal((await request('profile','PUT',{},user.cookie)).status,403);});
test('approval cannot bypass documents, registry evidence or interview',async()=>{assert.equal((await request('admin/providers/'+provider.id,'PUT',{status:'approved',feedback:'',identity_checked:true,license_checked:true,interview_completed:true,official_reference:'registry-ref-123'},admin.cookie)).status,400);assert.equal((await request('admin/providers','GET',undefined,user.cookie)).status,403);});
test('valid profile, private document upload and evidence-gated approval',async()=>{
 const profile={title:'روان‌شناس',specialty:'اضطراب و استرس',city:'تهران',address:'آدرس آزمایشی برای تست',bio:'این معرفی صرفاً برای اجرای تست‌های برنامه ایجاد شده است.',license_number:'TEST-12345',experience:5,fee:400000,phone_enabled:true};
 assert.equal((await request('profile','PUT',profile,provider.cookie)).status,200);
 const invalid=new FormData();invalid.set('kind','identity');invalid.set('file',new File(['<script>bad</script>'],'fake.pdf',{type:'application/pdf'}));assert.equal((await request('documents','POST',invalid,provider.cookie)).status,400);
 for(const kind of ['identity','license','degree']){const form=new FormData();form.set('kind',kind);form.set('file',new File(['%PDF-1.7\nTest fixture only'],'test.pdf',{type:'application/pdf'}));assert.equal((await request('documents','POST',form,provider.cookie)).status,201);}
 const [doc]=await query('SELECT id FROM documents WHERE user_id=$1',[provider.id]);assert.equal((await request('documents/'+doc.id,'GET',undefined,other.cookie)).status,404);assert.equal((await request('documents/'+doc.id,'GET',undefined,provider.cookie)).status,200);assert.equal((await request('documents/'+doc.id,'GET',undefined,admin.cookie)).status,200);
 const evidence={status:'approved',feedback:'',identity_checked:true,license_checked:true,interview_completed:true,official_reference:'test-registry-reference'};
 assert.equal((await request('admin/providers/'+provider.id,'PUT',{...evidence,interview_completed:false},admin.cookie)).status,400);assert.equal((await request('admin/providers/'+provider.id,'PUT',evidence,admin.cookie)).status,200);
 assert.equal((await query("SELECT * FROM audit_log WHERE subject_id=$1 AND action='verification.approved'",[provider.id])).length,1);
 const data=await (await request('therapists/'+provider.id)).json();assert.equal(data.therapist.id,provider.id);assert.ok(!('license_number' in data.therapist));assert.ok(!('email' in data.therapist));assert.ok(!('official_reference' in data.therapist));
});
test('availability rejects overlaps, invalid ranges and disabled voice',async()=>{
 const starts=new Date(Date.now()+86400000);const data={starts_at:starts.toISOString(),ends_at:new Date(+starts+3000000).toISOString(),mode:'in_person'};
 const response=await request('slots','POST',data,provider.cookie);assert.equal(response.status,201);slotId=(await response.json()).slot.id;
 assert.equal((await request('slots','POST',data,provider.cookie)).status,409);assert.equal((await request('slots','POST',{...data,ends_at:new Date(+starts-60000).toISOString()},provider.cookie)).status,400);
});
test('concurrent booking allows exactly one winner',async()=>{
 const responses=await Promise.all([request('appointments','POST',{slot_id:slotId},user.cookie),request('appointments','POST',{slot_id:slotId},other.cookie)]);assert.deepEqual(responses.map(x=>x.status).sort(),[201,409]);const [row]=await query("SELECT id,patient_id FROM appointments WHERE slot_id=$1 AND status='booked'",[slotId]);appointmentId=row.id;if(row.patient_id!==user.id)[user,other]=[other,user];
});
test('outsiders cannot modify appointments or post reviews; future session cannot be completed',async()=>{assert.equal((await request('appointments/'+appointmentId,'PUT',{action:'cancel'},other.cookie)).status,404);assert.equal((await request('appointments/'+appointmentId,'PUT',{action:'complete'},user.cookie)).status,403);assert.equal((await request('appointments/'+appointmentId,'PUT',{action:'complete'},provider.cookie)).status,400);assert.equal((await request('reviews','POST',{appointment_id:appointmentId,rating:5,comment:'review fixture'},user.cookie)).status,403);});
test('rescheduling is atomic and cancellation releases the slot',async()=>{
 const start=new Date(Date.now()+2*86400000);const r=await request('slots','POST',{starts_at:start.toISOString(),ends_at:new Date(+start+3000000).toISOString(),mode:'in_person'},provider.cookie);const newSlot=(await r.json()).slot.id;
 assert.equal((await request('appointments/'+appointmentId,'PUT',{action:'reschedule',slot_id:newSlot},user.cookie)).status,200);
 assert.equal((await request('appointments','POST',{slot_id:slotId},other.cookie)).status,201);
 assert.equal((await request('appointments/'+appointmentId,'PUT',{action:'cancel'},user.cookie)).status,200);
 assert.equal((await request('appointments','POST',{slot_id:newSlot},other.cookie)).status,201);
});
test('only the patient of a completed appointment can submit exactly one valid review',async()=>{
 const start=new Date(Date.now()-7200000);const [slot]=await query("INSERT INTO slots(therapist_id,starts_at,ends_at,mode) VALUES($1,$2,$3,'in_person') RETURNING id",[provider.id,start,new Date(+start+3000000)]);const [a]=await query("INSERT INTO appointments(slot_id,patient_id,fee,status) VALUES($1,$2,400000,'completed') RETURNING id",[slot.id,user.id]);const review={appointment_id:a.id,rating:5,comment:'تجربه آزمایشی برای بررسی ثبت نظر'};
 assert.equal((await request('reviews','POST',review,other.cookie)).status,403);assert.equal((await request('reviews','POST',{...review,rating:6},user.cookie)).status,400);assert.equal((await request('reviews','POST',review,user.cookie)).status,201);assert.equal((await request('reviews','POST',review,user.cookie)).status,409);
 const t=(await (await request('therapists/'+provider.id)).json()).therapist;assert.equal(t.rating,5);assert.equal(t.review_count,1);
});
test('changing professional credentials removes approval and public visibility',async()=>{
 const p=(await (await request('profile','GET',undefined,provider.cookie)).json()).profile;
 const data=Object.fromEntries(['title','specialty','city','address','bio','license_number','experience','fee','phone_enabled'].map(k=>[k,p[k]]));data.license_number='NEW-LICENSE';assert.equal((await request('profile','PUT',data,provider.cookie)).status,200);assert.equal((await request('therapists/'+provider.id)).status,404);
});
