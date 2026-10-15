import type { Metadata } from 'next';
import { Shell } from '@/components/shell';
import './globals.css';
export const metadata: Metadata = { title: { default: 'مدیتو | یک قدم به حال بهتر', template: '%s | مدیتو' }, description: 'پیدا کردن روان‌شناس و تراپیست، رزرو نوبت و مشاوره صوتی در مدیتو.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fa" dir="rtl"><body><Shell>{children}</Shell></body></html>;
}
