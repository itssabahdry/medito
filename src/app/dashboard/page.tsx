'use client';
import Link from 'next/link';
import { useAuth } from '@/components/shell';
import { ProviderDashboard } from '@/components/provider-dashboard';
import { AdminDashboard } from '@/components/admin-dashboard';
import { Appointments, Availability } from '@/components/appointments';
export default function Dashboard(){const {user,loading}=useAuth();if(loading)return <div className="loading">در حال بارگذاری…</div>;if(!user)return <div className="page container"><div className="empty">برای دیدن پنل وارد حساب خود شوید.<Link href="/login">ورود به حساب</Link></div></div>;return <div className="page container"><div className="dashboard-header"><div><div className="eyebrow">فضای شخصی شما</div><h1>سلام {user.name}</h1></div><span className="status">{user.role==='admin'?'مدیریت':user.role==='therapist'?'پنل متخصص':'پنل کاربر'}</span></div>{user.role==='therapist'?<><Appointments provider/><Availability/><ProviderDashboard/></>:user.role==='admin'?<AdminDashboard/>:<Appointments/>}</div>;}
