import pg from 'pg';
import { randomBytes, scryptSync } from 'node:crypto';
if (process.env.DEMO_DATA !== 'true')
  throw new Error(
    'Seeding is opt-in. Set DEMO_DATA=true for clearly labeled fictitious profiles.',
  );
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12)
  throw new Error('Set a unique DEMO_PASSWORD of at least 12 characters.');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const people = [
  [
    'sahar',
    'سحر مهرآیین',
    'اضطراب و استرس',
    'تهران',
    9,
    650000,
    'گاهی برای عبور از روزهای پرتنش، به فضایی امن برای حرف زدن نیاز داریم. در این مسیر با توجه به تجربه و نیاز شما همراه می‌شوم.',
  ],
  [
    'arman',
    'آرمان نیک‌روش',
    'روابط و زوج‌درمانی',
    'تهران',
    12,
    750000,
    'گفت‌وگوی روشن‌تر و شناخت الگوهای ارتباطی می‌تواند شروعی برای رابطه‌ای بهتر باشد. تمرکز من بر روابط و مسائل زوج‌هاست.',
  ],
  [
    'niloufar',
    'نیلوفر آرام',
    'رشد فردی',
    'شیراز',
    7,
    550000,
    'شناخت خود، مرزهای شخصی و انتخاب‌های آگاهانه، محور گفت‌وگوهای ماست. مسیر رشد هر فرد، ریتم و داستان خودش را دارد.',
  ],
  [
    'mina',
    'مینا روشن',
    'کودک و نوجوان',
    'اصفهان',
    10,
    600000,
    'همراه کودکان، نوجوانان و خانواده‌ها برای شناخت بهتر احساسات و بهبود ارتباط. فضای جلسه متناسب با سن و نیاز هر فرد طراحی می‌شود.',
  ],
  [
    'reza',
    'رضا همدل',
    'افسردگی',
    'مشهد',
    8,
    500000,
    'برای روزهایی که انرژی و انگیزه کمتر می‌شود، گفت‌وگو می‌تواند نقطه شروع باشد. با احترام به تجربه شما مسیر را پیش می‌بریم.',
  ],
  [
    'ava',
    'آوا مهربان',
    'سوگ و فقدان',
    'رشت',
    6,
    450000,
    'در تجربه فقدان، هر فرد مسیر متفاوتی را طی می‌کند. فرصتی برای بیان احساسات و شنیده شدن، با ریتم و انتخاب خود شما.',
  ],
];
try {
  await client.connect();
  await client.query('BEGIN');
  for (const [slug, name, specialty, city, experience, fee, bio] of people) {
    const salt = randomBytes(16).toString('hex');
    const hash = salt + ':' + scryptSync(password, salt, 64).toString('hex');
    const result = await client.query(
      "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'therapist') ON CONFLICT(email) DO NOTHING RETURNING id",
      [name, slug + '@demo.medito.local', hash],
    );
    if (!result.rowCount) continue;
    const id = result.rows[0].id;
    await client.query(
      "INSERT INTO profiles(user_id,title,specialty,city,address,bio,license_number,experience,fee,phone_enabled,status,is_demo) VALUES($1,'روان‌شناس',$2,$3,'آدرس نمایشی؛ ارائه خدمات واقعی انجام نمی‌شود',$4,'DEMO-ONLY',$5,$6,true,'approved',true)",
      [id, specialty, city, bio, experience, fee],
    );
    for (let day = 1; day <= 5; day++) {
      const start = new Date();
      start.setUTCDate(start.getUTCDate() + day);
      start.setUTCHours(10, 0, 0, 0);
      await client.query(
        'INSERT INTO slots(therapist_id,starts_at,ends_at,mode) VALUES($1,$2,$3,$4)',
        [
          id,
          start,
          new Date(+start + 50 * 60000),
          day % 2 ? 'in_person' : 'voice',
        ],
      );
    }
  }
  await client.query('COMMIT');
  console.log(
    'Fictitious, labeled demo profiles created. No fabricated reviews were added.',
  );
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  await client.end();
}
