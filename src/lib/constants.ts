export const specialties = ['اضطراب و استرس', 'افسردگی', 'روابط و زوج‌درمانی', 'کودک و نوجوان', 'رشد فردی', 'سوگ و فقدان'] as const;
export const titles = ['روان‌شناس', 'روان‌پزشک', 'مشاور'] as const;
export const statuses: Record<string, string> = { pending: 'در انتظار بررسی', changes_requested: 'نیازمند اصلاح', approved: 'تأیید شده', rejected: 'رد شده', booked: 'رزرو شده', cancelled: 'لغو شده', completed: 'انجام شده' };
export const dateText = (value: string | Date) => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(new Date(value));
export const money = (value: number) => new Intl.NumberFormat('fa-IR').format(value) + ' تومان';
