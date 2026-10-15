import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';
export default function Register(){return <Suspense fallback={<div className="loading">در حال بارگذاری…</div>}><AuthForm register/></Suspense>;}
