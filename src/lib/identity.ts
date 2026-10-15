import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { query, transaction } from './db';
import { assert, body, json, readLimited } from './http';
import { currentUser, hashPassword, newSession, rateLimit, requestToken, requireUser, sessionCookie, tokenHash, verifyPassword, type Actor } from './auth';
import { specialties, titles } from './constants';
const credentials = z.object({email: z.email().max(254).transform(s=>s.toLowerCase().trim()), password: z.string().min(10).max(128)});
const registration = credentials.extend({name: z.string().trim().min(2).max(100), role: z.enum(['user','therapist'])}).strict();
export const profileSchema = z.object({title:z.enum(titles), specialty:z.enum(specialties), city:z.string().trim().min(2).max(80), address:z.string().trim().min(5).max(500), bio:z.string().trim().min(20).max(2000), license_number:z.string().trim().min(3).max(80), experience:z.number().int().min(0).max(70), fee:z.number().int().min(0).max(100000000), phone_enabled:z.boolean()}).strict();
export async function authRoute(request: Request, action: string) {
  if (request.method === 'GET' && action === 'me') return json({user: await currentUser(request)});
  if (request.method !== 'POST') return null;
  if (action === 'register') {
    const data = registration.parse(await body(request)); await rateLimit('register:' + data.email, 5);
    await rateLimit('register:global', 100, 60);
    const user = await transaction(async c => {
      const {rows:[user]} = await c.query<Actor>('INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,name,email,role', [data.name,data.email,await hashPassword(data.password),data.role]);
      if (user.role === 'therapist') await c.query('INSERT INTO profiles(user_id) VALUES($1)', [user.id]); return user;
    });
    return json({user}, 201, {'Set-Cookie':sessionCookie(await newSession(user.id))});
  }
  if (action === 'login') {
    const data = credentials.parse(await body(request)); await rateLimit('login:' + data.email); await rateLimit('login:global', 100, 60);
    const [user] = await query('SELECT * FROM users WHERE email=$1', [data.email]);
    // Execute scrypt even for unknown accounts to reduce account-enumeration timing differences.
    const valid = await verifyPassword(data.password, user?.password_hash || '00000000000000000000000000000000:' + '00'.repeat(64));
    assert(user && valid, 401, 'ایمیل یا رمز عبور صحیح نیست.');
    return json({user:{id:user.id,name:user.name,email:user.email,role:user.role}}, 200, {'Set-Cookie':sessionCookie(await newSession(user.id))});
  }
  if (action === 'logout') { const token = requestToken(request); if(token) await query('DELETE FROM sessions WHERE token_hash=$1',[tokenHash(token)]); return json({ok:true},200,{'Set-Cookie':sessionCookie('',true)}); }
  return null;
}
export async function profileRoute(request: Request) {
  const user = await requireUser(request, 'therapist');
  if(request.method === 'GET') return json({profile:(await query('SELECT * FROM profiles WHERE user_id=$1',[user.id]))[0], documents:await query('SELECT id,kind,filename,created_at FROM documents WHERE user_id=$1',[user.id])});
  if(request.method !== 'PUT') return null;
  const data = profileSchema.parse(await body(request));
  await transaction(async c => {
    const {rows:[old]} = await c.query('SELECT * FROM profiles WHERE user_id=$1 FOR UPDATE',[user.id]);
    const changed = ['title','specialty','license_number','experience'].some(k=>old[k] !== data[k as keyof typeof data]);
    await c.query(`UPDATE profiles SET title=$2,specialty=$3,city=$4,address=$5,bio=$6,license_number=$7,experience=$8,fee=$9,phone_enabled=$10,status=CASE WHEN $11 THEN 'pending' ELSE status END,identity_checked=CASE WHEN $11 THEN false ELSE identity_checked END,license_checked=CASE WHEN $11 THEN false ELSE license_checked END,interview_completed=CASE WHEN $11 THEN false ELSE interview_completed END,official_reference=CASE WHEN $11 THEN '' ELSE official_reference END WHERE user_id=$1`,[user.id,data.title,data.specialty,data.city,data.address,data.bio,data.license_number,data.experience,data.fee,data.phone_enabled,changed]);
  }); return json({ok:true});
}
export function documentType(bytes: Uint8Array, mime: string) {
  const b=Buffer.from(bytes);
  return (mime==='application/pdf' && b.subarray(0,5).toString()==='%PDF-') || (mime==='image/png' && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) || (mime==='image/jpeg' && b[0]===255 && b[1]===216 && b[2]===255);
}
const uploadDir = () => path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || './data/documents');
export async function documentsRoute(request: Request, id?: string) {
  const user = await requireUser(request);
  if(request.method==='GET' && id) {
    z.uuid().parse(id); const [doc]=await query('SELECT * FROM documents WHERE id=$1',[id]); assert(doc && (doc.user_id===user.id || user.role==='admin'),404,'مدرک پیدا نشد.');
    const data=await readFile(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ uploadDir(),doc.storage_key));
    return new Response(data,{headers:{'Content-Type':doc.mime,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  assert(user.role==='therapist',403,'فقط متخصص می‌تواند مدرک بارگذاری کند.');
  if(request.method!=='POST') return null;
  await rateLimit('upload:'+user.id,20,3600);
  const bytes=await readLimited(request,5*1024*1024+65536);
  const form=await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();
  const kind=z.enum(['identity','license','degree']).parse(form.get('kind')); const file=form.get('file');
  assert(file instanceof File && file.size>0 && file.size<=5*1024*1024,400,'فایل باید حداکثر ۵ مگابایت باشد.');
  const contents=Buffer.from(await file.arrayBuffer()); assert(documentType(contents,file.type),400,'فقط فایل PDF، JPEG یا PNG معتبر پذیرفته می‌شود.');
  const key=randomUUID(); await mkdir(/* turbopackIgnore: true */ uploadDir(),{recursive:true}); await writeFile(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ uploadDir(),key),contents,{mode:0o600});
  let previous: string|undefined;
  try { await transaction(async c=>{
    await c.query('SELECT user_id FROM profiles WHERE user_id=$1 FOR UPDATE',[user.id]);
    previous=(await c.query('SELECT storage_key FROM documents WHERE user_id=$1 AND kind=$2',[user.id,kind])).rows[0]?.storage_key;
    await c.query('INSERT INTO documents(user_id,kind,filename,mime,storage_key) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,kind) DO UPDATE SET filename=$3,mime=$4,storage_key=$5,created_at=now()',[user.id,kind,path.basename(file.name).slice(0,200),file.type,key]);
    await c.query("UPDATE profiles SET status='pending',identity_checked=false,license_checked=false,interview_completed=false,official_reference='' WHERE user_id=$1",[user.id]);
  }); } catch(error) {await unlink(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ uploadDir(),key));throw error;}
  if(previous) await unlink(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ uploadDir(),previous)).catch(()=>{}); return json({ok:true},201);
}
const decisionSchema=z.object({status:z.enum(['approved','rejected','changes_requested']),feedback:z.string().trim().max(2000),identity_checked:z.boolean(),license_checked:z.boolean(),interview_completed:z.boolean(),official_reference:z.string().trim().max(500)}).strict();
export async function adminRoute(request: Request, id?: string) {
  const admin=await requireUser(request,'admin');
  if(request.method==='GET') return json({providers:await query(`SELECT p.*,u.name,u.email,COALESCE((SELECT json_agg(json_build_object('id',d.id,'kind',d.kind,'filename',d.filename)) FROM documents d WHERE d.user_id=p.user_id),'[]') AS documents FROM profiles p JOIN users u ON u.id=p.user_id ORDER BY CASE WHEN status='pending' THEN 0 ELSE 1 END,u.created_at DESC LIMIT 100`)});
  if(request.method!=='PUT' || !id) return null;
  z.uuid().parse(id); const data=decisionSchema.parse(await body(request));
  await transaction(async c=>{
    const {rows:[profile]}=await c.query('SELECT * FROM profiles WHERE user_id=$1 FOR UPDATE',[id]); assert(profile,404,'متخصص پیدا نشد.');
    if(data.status==='approved') {
      const count=(await c.query('SELECT count(DISTINCT kind)::int AS count FROM documents WHERE user_id=$1',[id])).rows[0].count;
      assert(count===3 && data.identity_checked && data.license_checked && data.interview_completed && data.official_reference.length>=5,400,'هر سه مدرک، بررسی هویت و صلاحیت، مرجع استعلام و مصاحبه برای تأیید ضروری است.');
      assert(profile.city && profile.address && profile.bio && profile.license_number,400,'پروفایل حرفه‌ای هنوز کامل نیست.');
    } else assert(data.feedback.length>=5,400,'دلیل رد یا درخواست اصلاح را بنویسید.');
    await c.query('UPDATE profiles SET status=$2,feedback=$3,identity_checked=$4,license_checked=$5,interview_completed=$6,official_reference=$7,reviewed_at=now(),reviewed_by=$8 WHERE user_id=$1',[id,data.status,data.feedback,data.identity_checked,data.license_checked,data.interview_completed,data.official_reference,admin.id]);
    await c.query('INSERT INTO audit_log(actor_id,subject_id,action,details) VALUES($1,$2,$3,$4)',[admin.id,id,'verification.'+data.status,JSON.stringify(data)]);
  });return json({ok:true});
}
