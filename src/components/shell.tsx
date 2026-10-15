'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HeartHandshake, ArrowUpLeft, Menu, X } from 'lucide-react';
import { createContext, useContext, useEffect, useState } from 'react';
export type User = { id: string; name: string; role: 'user' | 'therapist' | 'admin'; email: string };
const AuthContext = createContext<{user: User | null; loading: boolean; refresh: () => Promise<void>}>({ user: null, loading: true, refresh: async () => {} });
export const useAuth = () => useContext(AuthContext);
export async function api(path: string, options: RequestInit = {}) {
  const response = await fetch('/api/' + path, { ...options, headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'خطایی رخ داد. دوباره تلاش کنید.');
  return data;
}
export function Shell({children}: {children: React.ReactNode}) {
  const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true); const [menu, setMenu] = useState(false); const pathname = usePathname();
  async function refresh() { try { const data = await api('auth/me'); setUser(data.user); } catch { setUser(null); } finally { setLoading(false); } }
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { setMenu(false); }, [pathname]);
  return <AuthContext.Provider value={{user, loading, refresh}}><div className="announcement">فضایی برای شنیده شدن؛ مسیری برای بهتر شدن.</div><header className="header"><Link className="brand" href="/"><HeartHandshake size={31}/><span>مدیتو<small>medito</small></span></Link><button className="icon-button mobile-menu" aria-label="باز کردن فهرست" onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</button><nav className={menu ? 'nav open' : 'nav'}><Link className={pathname === '/' ? 'active' : ''} href="/">خانه</Link><Link className={pathname.startsWith('/therapists') ? 'active' : ''} href="/therapists">پیدا کردن تراپیست</Link><Link className={pathname === '/assistant' ? 'active' : ''} href="/assistant">راهنمای هوشمند <span className="tiny-tag">جدید</span></Link>{user && <Link href="/dashboard">پنل من</Link>}</nav><div className="header-actions">{user ? <><Link href="/dashboard" className="account-name">{user.name}</Link><button className="text-button" onClick={async () => { await api('auth/logout', {method: 'POST'}); await refresh(); location.href = '/'; }}>خروج</button></> : <><Link className="join-link" href="/register?role=therapist">عضویت متخصصان</Link><Link className="button small" href="/login">ورود / ثبت‌نام <ArrowUpLeft size={16}/></Link></>}</div></header><main>{children}</main><footer><Link className="brand" href="/"><HeartHandshake/><strong>مدیتو</strong></Link><p>همراه شما، در مسیر حال بهتر.</p><div><Link href="/therapists">متخصصان</Link><Link href="/register?role=therapist">همکاری با مدیتو</Link><Link href="/assistant">راهنمای انتخاب</Link></div><small>مدیتو بستری برای انتخاب متخصص و دریافت نوبت است.</small></footer></AuthContext.Provider>;
}
