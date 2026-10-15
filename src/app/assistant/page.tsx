'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Sparkles, ArrowUpLeft } from 'lucide-react';
import { api, useAuth } from '@/components/shell';
import { specialties } from '@/lib/constants';
import { TherapistCard, type Therapist } from '@/components/therapists';
type Result = {
  therapists: Therapist[];
  source: string;
  specialty?: string;
  message: string;
  needs_human_support?: boolean;
};
export default function Assistant() {
  const { user, loading } = useAuth();
  const [configured, setConfigured] = useState(false),
    [message, setMessage] = useState(''),
    [result, setResult] = useState<Result | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api('assistant')
      .then((d) => setConfigured(d.configured))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="page container">
      <div className="assistant-layout">
        <div className="assistant-intro">
          <Sparkles size={38} />
          <div className="eyebrow" style={{ justifyContent: 'center' }}>
            یک شروع روشن‌تر
          </div>
          <h1>تراپیست مناسب من کیه؟</h1>
          <p>
            کمی از دغدغه‌ات بگو و ترجیحاتت رو مشخص کن تا گزینه‌های مرتبط رو پیدا
            کنیم.
          </p>
        </div>
        <div className="panel">
          {!loading && !user && (
            <div className="notice info">
              <Link href="/login">برای دریافت پیشنهاد وارد حساب خودت شو ←</Link>
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              setResult(null);
              const f = new FormData(e.currentTarget);
              try {
                const data = await api('assistant', {
                  method: 'POST',
                  body: JSON.stringify({
                    message,
                    consent: f.get('consent') === 'on',
                    ...(f.get('city') ? { city: f.get('city') } : {}),
                    ...(f.get('specialty')
                      ? { specialty: f.get('specialty') }
                      : {}),
                    ...(f.get('mode') ? { mode: f.get('mode') } : {}),
                    ...(f.get('max_fee')
                      ? { max_fee: Number(f.get('max_fee')) }
                      : {}),
                  }),
                });
                setResult(data);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              این روزها چه چیزی ذهنت رو درگیر کرده؟
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                minLength={10}
                maxLength={2000}
                placeholder="مثلاً برای مدیریت استرس کارم دنبال یک متخصص هستم…"
              />
              <small>
                نیازی به نوشتن نام، شماره تماس یا جزئیات خصوصی نیست.
              </small>
            </label>
            <div className="suggestions">
              {[
                'برای مدیریت اضطراب و استرس کمک می‌خواهم.',
                'برای بهبود رابطه با همسرم دنبال مشاورم.',
                'می‌خواهم روی رشد فردی و خودشناسی کار کنم.',
              ].map((x) => (
                <button type="button" key={x} onClick={() => setMessage(x)}>
                  {x}
                </button>
              ))}
            </div>
            <div className="form-grid">
              <label className="field">
                حوزه موردنظر (اختیاری)
                <select name="specialty">
                  <option value="">از توضیح من مشخص شود</option>
                  {specialties.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                شهر (اختیاری)
                <input name="city" maxLength={80} placeholder="مثلاً تهران" />
              </label>
              <label className="field">
                شیوه جلسه
                <select name="mode">
                  <option value="">فرقی ندارد</option>
                  <option value="in_person">حضوری</option>
                  <option value="voice">صوتی</option>
                </select>
              </label>
              <label className="field">
                حداکثر هزینه جلسه (تومان)
                <input
                  name="max_fee"
                  type="number"
                  min={0}
                  max={100000000}
                  placeholder="اختیاری"
                />
              </label>
            </div>
            {configured ? (
              <label className="check-row">
                <input type="checkbox" name="consent" />
                موافقم متن توضیحم برای تشخیص حوزه موردنظر به سرویس OpenAI ارسال
                شود.
              </label>
            ) : (
              <p className="notice info">
                سرویس AI هنوز پیکربندی نشده است. فعلاً راهنمای مبتنی بر کلمات
                کلیدی و فیلترها فعال است؛ توضیح شما به سرویس خارجی ارسال
                نمی‌شود.
              </p>
            )}
            <p className="subtle">
              این ابزار برای انتخاب متخصص است و تشخیص یا درمان ارائه نمی‌کند.
              متن این فرم در دیتابیس مدیتو ذخیره نمی‌شود.
            </p>
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            <button
              className="button"
              disabled={!user || user.role !== 'user' || busy}
            >
              {busy ? 'در حال بررسی…' : 'پیشنهاد متخصصان'}
              <ArrowUpLeft size={17} />
            </button>
          </form>
        </div>
      </div>
      {result && (
        <section className="section" style={{ paddingTop: 20 }}>
          <div
            className={'notice ' + (result.needs_human_support ? 'error' : '')}
          >
            {result.message}
          </div>
          <p className="subtle">
            روش پیشنهاد:{' '}
            {result.source === 'ai'
              ? 'تفسیر هوشمند توضیح + جست‌وجو در متخصصان تأییدشده'
              : 'جست‌وجوی هدایت‌شده بر اساس کلمات کلیدی و فیلترها'}
          </p>
          <div className="therapist-grid">
            {result.therapists.map((t, i) => (
              <TherapistCard therapist={t} index={i} key={t.id} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
