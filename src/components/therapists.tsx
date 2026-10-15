'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MapPin, Star, ArrowUpLeft, Headphones, BadgeCheck } from 'lucide-react';
import { api } from './shell';
import { money } from '@/lib/constants';
export type Therapist = { id: string; name: string; title: string; specialty: string; city: string; bio: string; address: string; experience: number; fee: number; phone_enabled: boolean; is_demo: boolean; rating: number; review_count: number };
export function TherapistCard({ therapist: t, index = 0 }: { therapist: Therapist; index?: number }) {
  return <article className="therapist-card"><div className="therapist-top"><div className={'avatar avatar-' + index % 4}>{t.name.split(' ').slice(0,2).map(x=>x[0]).join('')}</div><span className="verified"><BadgeCheck size={14}/>{t.is_demo ? 'پروفایل نمایشی' : 'بررسی صلاحیت'}</span></div><h3><Link href={'/therapists/' + t.id}>{t.name}</Link></h3><p className="profession">{t.title} · {t.specialty}</p><div className="rating"><Star size={15} fill="currentColor"/><strong>{Number(t.rating || 0).toLocaleString('fa-IR', {maximumFractionDigits:1})}</strong><span>({Number(t.review_count).toLocaleString('fa-IR')} نظر)</span><span className="card-city"><MapPin size={14}/>{t.city}</span></div><p className="card-bio">{t.bio || 'برای آشنایی با این متخصص، پروفایل را ببینید.'}</p><div className="card-tags"><span>حضوری</span>{t.phone_enabled && <span><Headphones size={12}/> صوتی</span>}<span>{Number(t.experience).toLocaleString('fa-IR')} سال تجربه</span></div><div className="card-bottom"><span>هزینه جلسه<strong>{money(t.fee)}</strong></span><Link className="button small secondary" href={'/therapists/' + t.id}>دریافت نوبت <ArrowUpLeft size={15}/></Link></div></article>;
}
export function FeaturedTherapists() {
  const [items, setItems] = useState<Therapist[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { api('therapists?limit=3').then(d=>setItems(d.therapists)).catch(e=>setError(e.message)).finally(()=>setLoading(false)); }, []);
  if (loading) return <div className="empty">در حال دریافت متخصصان…</div>;
  if (error) return <div className="notice error" role="alert">{error}</div>;
  if (!items.length) return <div className="empty">متخصصان پس از تکمیل بررسی صلاحیت در این بخش نمایش داده می‌شوند.<Link href="/register?role=therapist">عضویت به عنوان متخصص ←</Link></div>;
  return <div className="therapist-grid">{items.map((t,i)=><TherapistCard key={t.id} therapist={t} index={i}/>)}</div>;
}
