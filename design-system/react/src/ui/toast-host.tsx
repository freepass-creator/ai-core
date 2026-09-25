'use client';
/** 전역 토스트 렌더러 — 'jpk:toast' 이벤트를 우상단 스택으로. 자동 소멸(3.8초)·클릭 닫기. */
import { useEffect, useState } from 'react';
import { ELEV, TOAST_TONE } from './tokens';
import { AlertCircle, CheckCircle, Info, type LucideIcon } from 'lucide-react';

type T = { id: string; message: string; kind: 'success' | 'error' | 'info' };

/** 토스트는 항상 어두운 칩(테마 무관 대비). C.* 로 바꾸면 라이트/다크에서 대비가 깨짐 — 의도된 예외. */
const STYLE: Record<T['kind'], { bg: string; fg: string; Icon: LucideIcon }> = {
  success: { ...TOAST_TONE.success, Icon: CheckCircle },
  error: { ...TOAST_TONE.error, Icon: AlertCircle },
  info: { ...TOAST_TONE.info, Icon: Info },
};

export default function ToastHost() {
  const [toasts, setToasts] = useState<T[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail as T;
      if (!d?.message) return;
      setToasts((ts) => [...ts.slice(-4), d]);
      setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== d.id)), 3800);
    };
    window.addEventListener('jpk:toast', on);
    return () => window.removeEventListener('jpk:toast', on);
  }, []);
  const dismiss = (id: string) => setToasts((ts) => ts.filter((t) => t.id !== id));

  return (
    <div style={{ position: 'fixed', top: 58, right: 16, zIndex: 300, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none', maxWidth: '92vw' }}>
      {toasts.map((t) => {
        const s = STYLE[t.kind] || STYLE.info;
        const Icon = s.Icon;
        return (
          <div key={t.id} onClick={() => dismiss(t.id)} role="status"
            style={{ pointerEvents: 'auto', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, background: s.bg, color: s.fg,
              padding: '11px 15px', borderRadius: 9, boxShadow: ELEV.toast, fontSize: 13.5, fontWeight: 600, maxWidth: 400,
              animation: 'toastIn .18s ease-out' }}>
            <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', background: TOAST_TONE.iconBg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={12} strokeWidth={2.4} aria-hidden />
            </span>
            <span style={{ lineHeight: 1.4 }}>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
