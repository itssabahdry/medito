import { ZodError } from 'zod';
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function assert(condition: unknown, status: number, message: string): asserts condition { if (!condition) throw new HttpError(status, message); }
export function json(data: unknown, status = 200, headers: HeadersInit = {}) { return Response.json(data, {status, headers: { 'Cache-Control': 'no-store', ...headers }}); }
export async function body(request: Request) {
  const text = await readLimited(request, 16 * 1024);
  try { return JSON.parse(Buffer.from(text).toString('utf8')); } catch { throw new HttpError(400, 'ساختار درخواست معتبر نیست.'); }
}
export async function readLimited(request: Request, limit: number) {
  assert(Number(request.headers.get('content-length') || 0) <= limit, 413, 'حجم درخواست بیش از حد مجاز است.');
  const reader = request.body?.getReader(); assert(reader, 400, 'درخواست خالی است.');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const {done, value} = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); throw new HttpError(413, 'حجم درخواست بیش از حد مجاز است.'); } chunks.push(value); }
  return Buffer.concat(chunks);
}
export function checkOrigin(request: Request) {
  const expected = new URL(process.env.APP_URL || 'http://localhost:3000').origin;
  assert(request.headers.get('origin') === expected, 403, 'مبدأ درخواست معتبر نیست.');
}
export function handleError(error: unknown) {
  if (error instanceof HttpError) return json({error: error.message}, error.status);
  if (error instanceof ZodError) return json({error: 'اطلاعات واردشده معتبر نیست. لطفاً فیلدها را بررسی کنید.'}, 400);
  const code = (error as {code?: string})?.code;
  if (code === '23505' || code === '23P01') return json({error: 'این اطلاعات یا بازه زمانی قبلاً ثبت شده است.'}, 409);
  if (code === '22P02' || code === '22007') return json({error: 'شناسه یا تاریخ معتبر نیست.'}, 400);
  console.error('API failure:', error instanceof Error ? error.name : 'UnknownError', code || '');
  return json({error: 'ارتباط با سرویس برقرار نشد. لطفاً دوباره تلاش کنید.'}, 500);
}
