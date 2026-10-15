import { test, expect, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { query, pool } from '../../src/lib/db';
import { hashPassword, newSession } from '../../src/lib/auth';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
const ids: string[] = [];
let patient: string,
  therapist: string,
  outsider: string,
  admin: string,
  slot: string,
  voiceAppointment: string;
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
test.beforeAll(async () => {
  if (process.env.E2E_ALLOW_DATABASE_WRITES !== 'true')
    throw new Error(
      'Use a local test database and set E2E_ALLOW_DATABASE_WRITES=true.',
    );
  for (const role of ['user', 'therapist', 'user', 'admin']) {
    const [row] = await query(
      'INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id',
      [
        role === 'therapist' ? 'متخصص تست مرورگر' : 'مراجع تست مرورگر',
        randomUUID() + '@browser.test',
        await hashPassword('Browser-test-password-123'),
        role,
      ],
    );
    ids.push(row.id);
  }
  [patient, therapist, outsider, admin] = ids;
  await query(
    "INSERT INTO profiles(user_id,specialty,city,bio,address,fee,experience,license_number,status,phone_enabled,is_demo) VALUES($1,'اضطراب و استرس','شهر تست مرورگر','این پروفایل صرفاً برای تست خودکار رابط کاربری ایجاد شده است.','آدرس تست',123456,5,'TEST-ONLY','approved',true,true)",
    [therapist],
  );
  const starts = new Date(Date.now() + 3 * 86400000);
  const [s] = await query(
    "INSERT INTO slots(therapist_id,starts_at,ends_at,mode) VALUES($1,$2,$3,'in_person') RETURNING id",
    [therapist, starts, new Date(+starts + 3000000)],
  );
  slot = s.id;
  const now = new Date(Date.now() - 3 * 60000);
  const [v] = await query(
    "INSERT INTO slots(therapist_id,starts_at,ends_at,mode) VALUES($1,$2,$3,'voice') RETURNING id",
    [therapist, now, new Date(+now + 3000000)],
  );
  const [a] = await query(
    'INSERT INTO appointments(slot_id,patient_id,fee) VALUES($1,$2,123456) RETURNING id',
    [v.id, patient],
  );
  voiceAppointment = a.id;
});
test.afterAll(async () => {
  if (ids.length) {
    const docs = await query(
      'SELECT storage_key FROM documents WHERE user_id=ANY($1::uuid[])',
      [ids],
    );
    for (const d of docs)
      if (/^[a-f0-9-]{36}$/.test(d.storage_key))
        await unlink(
          path.resolve(
            process.env.UPLOAD_DIR || 'data/documents',
            d.storage_key,
          ),
        ).catch(() => {});
    await query('DELETE FROM call_signals WHERE sender_id=ANY($1::uuid[])', [
      ids,
    ]);
    await query('DELETE FROM call_peers WHERE user_id=ANY($1::uuid[])', [ids]);
    await query(
      'DELETE FROM reviews WHERE appointment_id IN(SELECT id FROM appointments WHERE patient_id=ANY($1::uuid[]))',
      [ids],
    );
    await query('DELETE FROM appointments WHERE patient_id=ANY($1::uuid[])', [
      ids,
    ]);
    await query('DELETE FROM slots WHERE therapist_id=ANY($1::uuid[])', [ids]);
    await query(
      'DELETE FROM audit_log WHERE actor_id=ANY($1::uuid[]) OR subject_id=ANY($1::uuid[])',
      [ids],
    );
    await query('DELETE FROM documents WHERE user_id=ANY($1::uuid[])', [ids]);
    await query('DELETE FROM profiles WHERE user_id=ANY($1::uuid[])', [ids]);
    await query('DELETE FROM users WHERE id=ANY($1::uuid[])', [ids]);
  }
  await pool.end();
});
async function login(context: BrowserContext, id: string) {
  await context.addCookies([
    {
      name: 'medito_session',
      value: await newSession(id),
      url: baseURL,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}
test('Persian home, specialist navigation and mobile layout work', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /حال بهتر/ })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.screenshot({ path: 'data/preview-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: 'data/preview-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'باز کردن فهرست' }).click();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'پیدا کردن تراپیست' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'جست‌وجوی متخصصان' }),
  ).toBeVisible();
});
test('patient can book from a public profile and see the appointment in their dashboard', async ({
  page,
  context,
}) => {
  await login(context, patient);
  await page.goto('/therapists/' + therapist);
  await expect(
    page.getByRole('heading', { name: 'متخصص تست مرورگر' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'رزرو', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('نوبت شما ثبت شد');
  await page.goto('/dashboard');
  await expect(page.getByText('متخصص تست مرورگر', { exact: true })).toHaveCount(
    2,
  );
  expect(
    (
      await query(
        "SELECT count(*)::int AS n FROM appointments WHERE slot_id=$1 AND status='booked'",
        [slot],
      )
    )[0].n,
  ).toBe(1);
});
test('guided matching honors the requested city and explains its configuration', async ({
  page,
  context,
}) => {
  await login(context, patient);
  await page.goto('/assistant');
  await page
    .getByLabel('این روزها چه چیزی ذهنت رو درگیر کرده؟')
    .fill('برای اضطراب و استرس به کمک یک متخصص نیاز دارم');
  await page.getByLabel('شهر (اختیاری)').fill('شهر تست مرورگر');
  await page.getByRole('button', { name: 'پیشنهاد متخصصان' }).click();
  await expect(
    page.getByRole('heading', { name: 'متخصص تست مرورگر' }),
  ).toBeVisible();
  await expect(page.getByText(/روش پیشنهاد:/)).toContainText(
    'جست‌وجوی هدایت‌شده',
  );
});
test('an unrelated account cannot enter another appointment audio room', async ({
  page,
  context,
}) => {
  await login(context, outsider);
  await page.goto('/call/' + voiceAppointment);
  await expect(page.locator('main [role="alert"]')).toContainText(
    'جلسه پیدا نشد',
  );
  await expect(
    page.getByRole('button', { name: 'ورود به تماس', exact: true }),
  ).toBeDisabled();
});
test('registration, logout and password login work through the user interface', async ({
  page,
}) => {
  const email = randomUUID() + '@browser.test';
  await page.goto('/register');
  await page.getByLabel('نام و نام خانوادگی').fill('کاربر ثبت‌نام مرورگر');
  await page.getByLabel('ایمیل', { exact: true }).fill(email);
  await page
    .getByLabel('رمز عبور', { exact: true })
    .fill('Browser-register-password-123');
  await page.getByRole('button', { name: 'ساخت حساب' }).click();
  await expect(
    page.getByRole('heading', { name: 'سلام کاربر ثبت‌نام مرورگر' }),
  ).toBeVisible();
  ids.push((await query('SELECT id FROM users WHERE email=$1', [email]))[0].id);
  await page.getByRole('button', { name: 'خروج', exact: true }).click();
  await page.waitForURL(baseURL + '/');
  await page.goto('/login');
  await page.getByLabel('ایمیل', { exact: true }).fill(email);
  await page
    .getByLabel('رمز عبور', { exact: true })
    .fill('Browser-register-password-123');
  await page.getByRole('button', { name: 'ورود به حساب', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'سلام کاربر ثبت‌نام مرورگر' }),
  ).toBeVisible();
});
test('practitioner documents and administrator evidence workflow work through the interface', async ({
  page,
  context,
  browser,
}) => {
  await login(context, therapist);
  await page.goto('/dashboard');
  for (const label of ['مدرک هویتی', 'مجوز فعالیت', 'مدرک تحصیلی']) {
    const form = page
      .locator('form.document-row')
      .filter({ has: page.getByText(label, { exact: true }) });
    await form
      .getByLabel(label, { exact: true })
      .setInputFiles({
        name: 'test.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.7\nBrowser test document'),
      });
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/documents') && r.request().method() === 'POST',
    );
    await form.getByRole('button', { name: 'بارگذاری', exact: true }).click();
    expect((await response).status()).toBe(201);
    await expect(
      form.getByRole('link', { name: 'دریافت مدرک ثبت‌شده' }),
    ).toBeVisible();
  }
  const adminContext = await browser.newContext();
  try {
    await login(adminContext, admin);
    const adminPage = await adminContext.newPage();
    await adminPage.goto(baseURL + '/dashboard');
    const card = adminPage
      .locator('details')
      .filter({ hasText: 'متخصص تست مرورگر' });
    await card.locator('summary').click();
    await card
      .getByLabel('نتیجه بررسی')
      .selectOption('approved');
    await card
      .getByLabel('مرجع و شماره پیگیری استعلام رسمی')
      .fill('Browser-test registry reference');
    for (const label of [
      'هویت با منبع معتبر تطبیق داده شد',
      'صلاحیت حرفه‌ای از مرجع مربوطه استعلام شد',
      'تماس و مصاحبه انسانی انجام شد',
    ])
      await card.getByLabel(label, { exact: true }).check();
    await card.getByRole('button', { name: 'ثبت نتیجه بررسی' }).click();
    await expect(adminPage.getByRole('status')).toContainText(
      'نتیجه بررسی و سابقه اقدام ذخیره شد',
    );
    expect(
      (
        await query('SELECT status FROM profiles WHERE user_id=$1', [therapist])
      )[0].status,
    ).toBe('approved');
  } finally {
    await adminContext.close();
  }
});
test('two authenticated participants establish real WebRTC audio and release their microphones', async ({
  browser,
}) => {
  const a = await browser.newContext({ permissions: ['microphone'] }),
    b = await browser.newContext({ permissions: ['microphone'] });
  try {
    await login(a, patient);
    await login(b, therapist);
    const pa = await a.newPage(),
      pb = await b.newPage();
    await Promise.all([
      pa.goto(baseURL + '/call/' + voiceAppointment),
      pb.goto(baseURL + '/call/' + voiceAppointment),
    ]);
    await Promise.all([
      pa.getByRole('button', { name: 'ورود به تماس', exact: true }).click(),
      pb.getByRole('button', { name: 'ورود به تماس', exact: true }).click(),
    ]);
    await expect(pa.getByRole('status')).toHaveText('تماس برقرار است', {
      timeout: 25000,
    });
    await expect(pb.getByRole('status')).toHaveText('تماس برقرار است', {
      timeout: 25000,
    });
    await pa.getByRole('button', { name: 'بی‌صدا', exact: true }).click();
    await expect(
      pa.getByRole('button', { name: 'روشن کردن میکروفون' }),
    ).toBeVisible();
    await pa.getByRole('button', { name: 'خروج از تماس' }).click();
    await expect(pa.getByRole('status')).toHaveText('از تماس خارج شدید');
    await pb.getByRole('button', { name: 'خروج از تماس' }).click();
  } finally {
    await a.close();
    await b.close();
  }
});
