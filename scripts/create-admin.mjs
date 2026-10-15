import pg from 'pg';
import { randomBytes, scryptSync } from 'node:crypto';
const email=process.env.ADMIN_EMAIL?.trim().toLowerCase(); const password=process.env.ADMIN_PASSWORD;
if(!email || !password || password.length<12 || password.startsWith('replace-')) throw new Error('Set ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 12 characters.');
const salt=randomBytes(16).toString('hex'); const hash=salt+':'+scryptSync(password,salt,64).toString('hex');
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
try {await client.connect(); const result=await client.query("INSERT INTO users(name,email,password_hash,role) VALUES('مدیر مدیتو',$1,$2,'admin') ON CONFLICT(email) DO NOTHING RETURNING id",[email,hash]);console.log(result.rowCount?'Administrator created.':'Account already exists; credentials and role were not changed.');}finally{await client.end();}
