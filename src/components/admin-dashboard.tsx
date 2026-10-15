'use client';
import { useEffect, useState } from 'react';
import { api } from './shell';
import { statuses } from '@/lib/constants';
type Provider = {
  user_id: string;
  name: string;
  email: string;
  title: string;
  specialty: string;
  city: string;
  bio: string;
  license_number: string;
  status: string;
  feedback: string;
  identity_checked: boolean;
  license_checked: boolean;
  interview_completed: boolean;
  official_reference: string;
  documents: { id: string; kind: string; filename: string }[];
};
export function AdminDashboard() {
  const [items, setItems] = useState<Provider[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    setItems((await api('admin/providers')).providers);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  return (
    <div className="panel">
      <h2>بررسی هویت و صلاحیت متخصصان</h2>
      <p className="subtle">
        نتیجه بررسی مرجع رسمی و مصاحبه را ثبت کنید. نمایش مدارک به‌تنهایی به
        معنی تأیید اصالت آن‌ها نیست.
      </p>
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
      {!items.length && (
        <div className="empty">پرونده‌ای برای بررسی وجود ندارد.</div>
      )}
      {items.map((p) => (
        <details className="admin-card" key={p.user_id}>
          <summary>
            {p.name}
            <span className={'status ' + p.status}>{statuses[p.status]}</span>
          </summary>
          <p className="subtle">
            {p.title} · {p.specialty} · {p.city} · مجوز: {p.license_number}
          </p>
          <p className="bio">{p.bio}</p>
          <div className="card-tags">
            {p.documents.map((d) => (
              <a
                className="button small secondary"
                href={'/api/documents/' + d.id}
                key={d.id}
              >
                {
                  (
                    {
                      identity: 'مدرک هویتی',
                      license: 'مجوز فعالیت',
                      degree: 'مدرک تحصیلی',
                    } as Record<string, string>
                  )[d.kind]
                }
              </a>
            ))}
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              setMessage('');
              setBusy(true);
              const f = new FormData(e.currentTarget);
              try {
                await api('admin/providers/' + p.user_id, {
                  method: 'PUT',
                  body: JSON.stringify({
                    status: f.get('status'),
                    feedback: f.get('feedback'),
                    official_reference: f.get('official_reference'),
                    identity_checked: f.get('identity_checked') === 'on',
                    license_checked: f.get('license_checked') === 'on',
                    interview_completed: f.get('interview_completed') === 'on',
                  }),
                });
                await load();
                setMessage('نتیجه بررسی و سابقه اقدام ذخیره شد.');
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-grid">
              <label className="field">
                نتیجه بررسی
                <select
                  name="status"
                  defaultValue={
                    p.status === 'pending' ? 'changes_requested' : p.status
                  }
                >
                  <option value="changes_requested">نیازمند اصلاح</option>
                  <option value="approved">تأیید</option>
                  <option value="rejected">رد</option>
                </select>
              </label>
              <label className="field">
                مرجع و شماره پیگیری استعلام رسمی
                <input
                  name="official_reference"
                  defaultValue={p.official_reference}
                  maxLength={500}
                  placeholder="نام مرجع، تاریخ و شماره پیگیری"
                />
              </label>
              <label className="field full">
                توضیح برای متخصص
                <textarea
                  name="feedback"
                  maxLength={2000}
                  defaultValue={p.feedback}
                />
              </label>
            </div>
            <label className="check-row">
              <input
                name="identity_checked"
                type="checkbox"
                defaultChecked={p.identity_checked}
              />
              هویت با منبع معتبر تطبیق داده شد
            </label>
            <label className="check-row">
              <input
                name="license_checked"
                type="checkbox"
                defaultChecked={p.license_checked}
              />
              صلاحیت حرفه‌ای از مرجع مربوطه استعلام شد
            </label>
            <label className="check-row">
              <input
                name="interview_completed"
                type="checkbox"
                defaultChecked={p.interview_completed}
              />
              تماس و مصاحبه انسانی انجام شد
            </label>
            <button className="button small" disabled={busy}>
              ثبت نتیجه بررسی
            </button>
          </form>
        </details>
      ))}
    </div>
  );
}
