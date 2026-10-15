'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Headphones, Mic, MicOff, PhoneOff } from 'lucide-react';
import { api } from './shell';
import { dateText } from '@/lib/constants';
type Info = {
  appointment: { peer_name: string; starts_at: string; ends_at: string };
  initiator: boolean;
  iceServers: RTCIceServer[];
};
type Signal = {
  id: number;
  sender_client: string;
  payload:
    | { type: 'offer' | 'answer'; sdp: string }
    | { type: 'candidate'; candidate: RTCIceCandidateInit };
};
export function CallRoom({ id }: { id: string }) {
  const [info, setInfo] = useState<Info | null>(null),
    [status, setStatus] = useState('آماده ورود به جلسه'),
    [error, setError] = useState(''),
    [joined, setJoined] = useState(false),
    [busy, setBusy] = useState(false),
    [muted, setMuted] = useState(false);
  const audio = useRef<HTMLAudioElement>(null),
    stream = useRef<MediaStream | null>(null),
    pc = useRef<RTCPeerConnection | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    client = useRef(''),
    peerId = useRef(''),
    cursor = useRef(0),
    running = useRef(false),
    pendingICE = useRef<RTCIceCandidateInit[]>([]),
    generation = useRef(0);
  const roomPath = 'calls/' + id;
  useEffect(() => {
    api(roomPath)
      .then(setInfo)
      .catch((e) => setError(e.message));
    return () => {
      running.current = false;
      generation.current++;
      if (timer.current) clearTimeout(timer.current);
      pc.current?.close();
      stream.current?.getTracks().forEach((t) => t.stop());
      if (client.current)
        void api(roomPath, {
          method: 'POST',
          keepalive: true,
          body: JSON.stringify({ action: 'leave', client_id: client.current }),
        }).catch(() => {});
    };
  }, [roomPath]);
  async function send(payload: unknown) {
    await api(roomPath, {
      method: 'POST',
      body: JSON.stringify({
        action: 'signal',
        client_id: client.current,
        recipient_client: peerId.current,
        payload,
      }),
    });
  }
  function createConnection() {
    pc.current?.close();
    pendingICE.current = [];
    const connection = new RTCPeerConnection({
      iceServers: info?.iceServers || [],
    });
    pc.current = connection;
    for (const track of stream.current!.getTracks())
      connection.addTrack(track, stream.current!);
    connection.onicecandidate = (e) => {
      if (e.candidate && running.current)
        void send({ type: 'candidate', candidate: e.candidate.toJSON() }).catch(
          (e) => setError(e.message),
        );
    };
    connection.ontrack = (e) => {
      if (audio.current) {
        audio.current.srcObject = e.streams[0];
        void audio.current
          .play()
          .catch(() =>
            setError('برای پخش صدای طرف مقابل روی «پخش صدا» بزنید.'),
          );
      }
    };
    connection.onconnectionstatechange = () => {
      if (connection !== pc.current) return;
      const state = connection.connectionState;
      setStatus(
        (
          {
            connected: 'تماس برقرار است',
            connecting: 'در حال برقراری ارتباط…',
            disconnected: 'ارتباط قطع شد؛ در حال تلاش برای اتصال…',
            failed: 'اتصال برقرار نشد؛ از جلسه خارج شوید و دوباره وارد شوید.',
            closed: 'تماس پایان یافت',
            new: 'در حال آماده‌سازی اتصال…',
          } as Record<string, string>
        )[state],
      );
    };
    return connection;
  }
  async function stop(notify = true) {
    running.current = false;
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    pc.current?.close();
    pc.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setJoined(false);
    setBusy(false);
    setMuted(false);
    setStatus('از تماس خارج شدید');
    if (notify && client.current)
      await api(roomPath, {
        method: 'POST',
        body: JSON.stringify({ action: 'leave', client_id: client.current }),
      }).catch(() => {});
    client.current = '';
    peerId.current = '';
  }
  async function poll(epoch: number) {
    if (!running.current || generation.current !== epoch) return;
    try {
      const data = await api(roomPath, {
        method: 'POST',
        body: JSON.stringify({
          action: 'poll',
          client_id: client.current,
          after: cursor.current,
        }),
      });
      if (!running.current || generation.current !== epoch) return;
      const remote = data.peer?.client_id || '';
      if (remote !== peerId.current) {
        peerId.current = remote;
        pc.current?.close();
        pc.current = null;
        pendingICE.current = [];
        if (remote) {
          const connection = createConnection();
          if (info?.initiator) {
            const offer = await connection.createOffer();
            await connection.setLocalDescription(offer);
            await send({ type: 'offer', sdp: offer.sdp });
          }
        } else setStatus('در انتظار ورود طرف دیگر…');
      }
      for (const signal of data.signals as Signal[]) {
        cursor.current = Math.max(cursor.current, signal.id);
        if (signal.sender_client !== peerId.current || !pc.current) continue;
        const p = signal.payload,
          connection = pc.current;
        if (p.type === 'candidate') {
          if (connection.remoteDescription)
            await connection.addIceCandidate(p.candidate);
          else pendingICE.current.push(p.candidate);
        } else {
          if (
            p.type === 'answer' &&
            connection.signalingState !== 'have-local-offer'
          )
            continue;
          await connection.setRemoteDescription({ type: p.type, sdp: p.sdp });
          for (const ice of pendingICE.current)
            await connection.addIceCandidate(ice);
          pendingICE.current = [];
          if (p.type === 'offer') {
            const answer = await connection.createAnswer();
            await connection.setLocalDescription(answer);
            await send({ type: 'answer', sdp: answer.sdp });
          }
        }
      }
      if (running.current && generation.current === epoch)
        timer.current = setTimeout(() => void poll(epoch), 1000);
    } catch (e) {
      setError((e as Error).message);
      await stop();
    }
  }
  async function join() {
    setBusy(true);
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          'برای تماس از مرورگر پشتیبانی‌شده و اتصال HTTPS یا localhost استفاده کنید.',
        );
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      client.current = crypto.randomUUID();
      cursor.current = 0;
      peerId.current = '';
      await api(roomPath, {
        method: 'POST',
        body: JSON.stringify({ action: 'join', client_id: client.current }),
      });
      running.current = true;
      setJoined(true);
      setStatus('در انتظار ورود طرف دیگر…');
      const epoch = ++generation.current;
      void poll(epoch);
    } catch (e) {
      setError(
        (e as Error).name === 'NotAllowedError'
          ? 'دسترسی میکروفون را در مرورگر فعال کنید.'
          : (e as Error).message,
      );
      await stop();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page container">
      <div className="panel call-panel">
        <div className="call-icon">
          <Headphones size={42} />
        </div>
        <h1>اتاق گفت‌وگو</h1>
        {info && (
          <>
            <p>جلسه با {info.appointment.peer_name}</p>
            <p className="subtle">{dateText(info.appointment.starts_at)}</p>
          </>
        )}
        <p role="status">{status}</p>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <audio ref={audio} autoPlay controls={false} />
        <div className="form-actions">
          {!joined ? (
            <button
              className="button"
              disabled={!info || busy}
              onClick={() => void join()}
            >
              <Headphones size={17} />
              {busy ? 'در حال ورود…' : 'ورود به تماس'}
            </button>
          ) : (
            <>
              <button
                className="button secondary"
                onClick={() => {
                  const enabled = muted;
                  stream.current?.getAudioTracks().forEach((t) => {
                    t.enabled = enabled;
                  });
                  setMuted(!muted);
                }}
              >
                {muted ? <MicOff size={17} /> : <Mic size={17} />}{' '}
                {muted ? 'روشن کردن میکروفون' : 'بی‌صدا'}
              </button>
              <button className="button danger" onClick={() => void stop()}>
                <PhoneOff size={17} />
                خروج از تماس
              </button>
              <button
                className="text-button"
                onClick={() =>
                  void audio.current
                    ?.play()
                    .then(() => setError(''))
                    .catch(() => setError('پخش صدا در مرورگر مجاز نیست.'))
                }
              >
                پخش صدا
              </button>
            </>
          )}
        </div>
        <p className="subtle">
          صدای جلسه در برنامه ضبط نمی‌شود. برای اتصال روی شبکه‌های مختلف باید
          سرویس TURN پیکربندی شده باشد.
        </p>
        <Link className="text-link" href="/dashboard">
          بازگشت به نوبت‌ها ←
        </Link>
      </div>
    </div>
  );
}
