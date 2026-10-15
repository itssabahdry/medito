'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from './shell';
import { specialties } from '@/lib/constants';
import { TherapistCard, type Therapist } from './therapists';
export function Directory() {
  const params = useSearchParams();
  const router = useRouter();
  const search = params.toString();
  const [items, setItems] = useState<Therapist[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api('therapists?' + search)
      .then((d) => {
        if (active) {
          setItems(d.therapists);
          setCities(d.cities);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [search]);
  return (
    <div className="page container">
      <div className="page-title">
        <div className="eyebrow">همراه مناسب خودت رو پیدا کن</div>
        <h1>جست‌وجوی متخصصان</h1>
        <p>
          تخصص، شهر و شیوه جلسه را انتخاب کن و با اطمینان قدم بعدی را بردار.
        </p>
      </div>
      <form
        key={search}
        className="panel filters"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const p = new URLSearchParams();
          for (const [k, v] of f) if (v) p.set(k, String(v));
          router.push('/therapists?' + p);
        }}
      >
        <label className="field">
          نام یا عبارت جست‌وجو
          <input
            name="q"
            defaultValue={params.get('q') || ''}
            placeholder="نام متخصص یا دغدغه شما"
            maxLength={100}
          />
        </label>
        <label className="field">
          شهر
          <select name="city" defaultValue={params.get('city') || ''}>
            <option value="">همه شهرها</option>
            {cities.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="field">
          حوزه تخصص
          <select name="specialty" defaultValue={params.get('specialty') || ''}>
            <option value="">همه تخصص‌ها</option>
            {specialties.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="field">
          نوع جلسه
          <select name="mode" defaultValue={params.get('mode') || ''}>
            <option value="">همه جلسات</option>
            <option value="in_person">حضوری</option>
            <option value="voice">صوتی</option>
          </select>
        </label>
        <button className="button">
          <Search size={17} />
          جست‌وجو
        </button>
      </form>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="loading">در حال جست‌وجو…</div>
      ) : (
        <>
          <p className="results-count">
            {items.length.toLocaleString('fa-IR')} متخصص · مرتب‌شده بر اساس
            امتیاز و تعداد نظرات معتبر
          </p>
          {items.length ? (
            <div className="therapist-grid">
              {items.map((t, i) => (
                <TherapistCard therapist={t} index={i} key={t.id} />
              ))}
            </div>
          ) : (
            <div className="empty">
              متخصصی با این شرایط پیدا نشد. فیلترها را تغییر دهید.
            </div>
          )}
        </>
      )}
    </div>
  );
}
