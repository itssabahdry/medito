import { Suspense } from 'react';
import { Directory } from '@/components/directory';
export default function Therapists() {
  return (
    <Suspense fallback={<div className="loading">در حال بارگذاری…</div>}>
      <Directory />
    </Suspense>
  );
}
