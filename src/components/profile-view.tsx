'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  MapPin,
  ShieldCheck,
  Star,
  Headphones,
  ArrowRight,
} from 'lucide-react';
import { api, useAuth } from './shell';
import type { Therapist } from './therapists';
import { dateText, money } from '@/lib/constants';
type Detail = {
  therapist: Therapist;
  slots: { id: string; starts_at: string; ends_at: string; mode: string }[];
  reviews: {
    id: string;
    rating: number;
    comment: string;
    created_at: string;
    author: string;
  }[];
};
export function ProfileView({ id }: { id: string }) {
  const { user } = useAuth();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  async function load() {
    setData(await api('therapists/' + id));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [id]);
  if (!data)
    return (
      <div className="page container">
        <div className={error ? 'notice error' : 'loading'}>
          {error || 'در حال دریافت پروفایل…'}
        </div>
      </div>
    );
  const t = data.therapist;
  return (
    <div className="page container">
      <Link className="text-link" href="/therapists">
        <ArrowRight size={16} />
        همه متخصصان
      </Link>
      {t.is_demo && (
        <p className="notice info">
          این پروفایل و زمان‌های آن نمایشی هستند و خدمات واقعی ارائه نمی‌دهند.
        </p>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      <div className="profile-grid" style={{ marginTop: 20 }}>
        <div>
          <div className="panel">
            <div className="profile-head">
              <div className="avatar">
                {t.name
                  .split(' ')
                  .slice(0, 2)
                  .map((s) => s[0])
                  .join('')}
              </div>
              <div>
                <span className="verified">
                  <ShieldCheck size={14} />
                  {t.is_demo ? 'پروفایل نمایشی' : 'هویت و صلاحیت بررسی شده'}
                </span>
                <h1>{t.name}</h1>
                <p className="profession">
                  {t.title} · {t.specialty}
                </p>
                <div className="rating">
                  <Star size={15} fill="currentColor" />
                  <strong>
                    {Number(t.rating).toLocaleString('fa-IR', {
                      maximumFractionDigits: 1,
                    })}
                  </strong>
                  <span>
                    از {Number(t.review_count).toLocaleString('fa-IR')} نظر
                  </span>
                </div>
              </div>
            </div>
            <p className="detail-line">
              <MapPin size={17} />
              {t.city} · {t.address}
            </p>
            <p className="detail-line">
              <Headphones size={17} />
              {t.phone_enabled ? 'جلسه حضوری و صوتی' : 'جلسه حضوری'} ·{' '}
              {t.experience.toLocaleString('fa-IR')} سال تجربه
            </p>
          </div>
          <div className="panel">
            <h2>درباره متخصص</h2>
            <p className="bio">{t.bio}</p>
          </div>
          <div className="panel">
            <h2>تجربه مراجعان</h2>
            <p className="subtle">نظرها پس از جلسه انجام‌شده ثبت می‌شوند.</p>
            {data.reviews.length ? (
              data.reviews.map((r) => (
                <article className="review" key={r.id}>
                  <strong>{r.author}</strong>
                  <span className="rating">
                    <Star size={13} fill="currentColor" />
                    {r.rating.toLocaleString('fa-IR')}
                  </span>
                  <p>{r.comment}</p>
                  <small>{dateText(r.created_at)}</small>
                </article>
              ))
            ) : (
              <p className="subtle">هنوز نظری ثبت نشده است.</p>
            )}
          </div>
        </div>
        <aside className="panel sticky">
          <h2>یک زمان برای خودت</h2>
          <p className="subtle">
            هزینه هر جلسه: <strong>{money(t.fee)}</strong>
          </p>
          {!user && (
            <div className="notice info">
              <Link href="/login">برای رزرو ابتدا وارد حساب خود شوید ←</Link>
            </div>
          )}
          <div className="slot-list">
            {data.slots.length ? (
              data.slots.map((s) => (
                <div className="slot-item" key={s.id}>
                  <span>
                    {dateText(s.starts_at)}
                    <small style={{ display: 'block', color: '#87957b' }}>
                      {s.mode === 'voice' ? 'مشاوره صوتی' : 'مراجعه حضوری'}
                    </small>
                  </span>
                  <button
                    className="button small"
                    disabled={!user || user.role !== 'user' || !!busy}
                    onClick={async () => {
                      setBusy(s.id);
                      setError('');
                      setMessage('');
                      try {
                        await api('appointments', {
                          method: 'POST',
                          body: JSON.stringify({ slot_id: s.id }),
                        });
                        setMessage(
                          'نوبت شما ثبت شد. جزئیات در پنل شما قابل مشاهده است.',
                        );
                        await load();
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy('');
                      }
                    }}
                  >
                    {busy === s.id ? '…' : 'رزرو'}
                  </button>
                </div>
              ))
            ) : (
              <div className="empty">زمان آزادی ثبت نشده است.</div>
            )}
          </div>
          {message && (
            <Link className="text-link" href="/dashboard">
              مشاهده نوبت‌های من ←
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
