import { CallRoom } from '@/components/call-room';
export default async function Call({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CallRoom id={id} />;
}
