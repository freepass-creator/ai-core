'use client';

import React from 'react';
import { C, FS, R } from './tokens';
import { Btn } from './controls';

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      marginTop: 12,
      padding: 20,
      textAlign: 'center',
      color: C.faint,
      border: `1px solid ${C.line}`,
      borderRadius: R,
      background: C.taupeBg,
      fontSize: FS.body,
    }}>
      {children}
    </div>
  );
}

/** 화면 전체 로딩 — 오래 걸리면 다시 불러오기를 보여 준다. 줄 안 스피너는 `Loading`(spinner). */
export function PageLoading({
  label = '불러오는 중…',
  minHeight = '100%',
  delayedAfterMs = 12_000,
}: {
  label?: React.ReactNode;
  minHeight?: string | number;
  /** 장시간 응답이 없을 때 무한 스피너 대신 사용자가 직접 복구할 수 있게 한다. */
  delayedAfterMs?: number;
}) {
  const [delayed, setDelayed] = React.useState(false);

  React.useEffect(() => {
    if (delayedAfterMs <= 0) return;
    const timer = window.setTimeout(() => setDelayed(true), delayedAfterMs);
    return () => window.clearTimeout(timer);
  }, [delayedAfterMs]);

  return (
    <div style={{
      minHeight,
      flex: 1,
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: '40px 16px',
      boxSizing: 'border-box',
    }}>
      <span
        aria-label="로딩"
        role="status"
        style={{
          width: 26,
          height: 26,
          border: `3px solid ${C.line}`,
          borderTopColor: C.brand,
          borderRadius: '50%',
          animation: 'fp-spin 0.7s linear infinite',
        }}
      />
      {/* 스피너 위 · 문구 아래 가운데정렬. 여러 줄로 접혀도 가운데 유지(textAlign 없으면 왼쪽으로 붙는다). */}
      {label != null && label !== '' && (
        <span style={{ fontSize: FS.sub, color: C.faint, textAlign: 'center', lineHeight: 1.45 }}>{label}</span>
      )}
      {delayed && (
        <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: FS.cap, color: C.mute, textAlign: 'center', lineHeight: 1.5 }}>
            평소보다 오래 걸리고 있습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.
          </span>
          <Btn size="sm" variant="ghost" onClick={() => window.location.reload()}>
            새로고침
          </Btn>
        </div>
      )}
    </div>
  );
}

/** 스켈레톤 박스 SSOT — shimmer. reduced-motion = .fp-skeleton 정적. */
export function Skeleton({
  width = '100%',
  height = 12,
  radius = R,
  style,
  className,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={className ? `fp-skeleton ${className}` : 'fp-skeleton'}
      style={{
        display: 'block',
        width,
        height,
        borderRadius: radius,
        background: 'var(--color-surface-sunken)',
        ...style,
      }}
    />
  );
}


/**
 * 빈 상태 문구 — 패널 본문 한가운데.
 * minHeight '100%' = **PaneBody 안**에서 스크롤 박스를 채워 세로 중앙에 놓이기 위한 값이다.
 * 그래서 두 가지를 지켜야 한다(안 지키면 문구가 위로 붙거나 뒤 형제가 화면 밖으로 밀린다).
 *   · PaneHead의 형제로 두지 말 것 — 헤더 높이까지 먹어 문구 중심이 헤더 절반만큼 내려간다.
 *   · 뒤에 형제를 두지 말 것 — 이게 열을 다 먹어 형제가 스크롤 밖으로 밀린다. 함께 보여야 하면
 *     children 안에 넣는다(app/members/page.tsx 관리자 도구가 그렇게 눌리지 않았다).
 */
export function CenterNote({
  children,
  minHeight = '100%',
}: {
  children: React.ReactNode;
  minHeight?: string | number;
}) {
  const fillPane = minHeight === '100%';
  return (
    <div style={{
      minHeight,
      flex: fillPane ? 1 : '0 0 auto',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: C.faint,
      fontSize: FS.body,
      textAlign: 'center',
      padding: fillPane ? '40px 16px' : '12px 16px',
      boxSizing: 'border-box',
    }}>
      {children}
    </div>
  );
}

export type MessageVariant = 'info' | 'success' | 'warning' | 'danger';

export function Message({
  variant = 'info',
  children,
}: {
  variant?: MessageVariant;
  children: React.ReactNode;
}) {
  const palette: Record<MessageVariant, { bg: string; border: string; color: string }> = {
    info: { bg: 'var(--color-info-surface)', border: 'var(--color-primary)', color: 'var(--color-primary)' },
    success: { bg: 'var(--color-ok-surface)', border: 'var(--color-success)', color: 'var(--color-success)' },
    warning: { bg: 'var(--color-warn-surface)', border: 'var(--color-warning)', color: 'var(--color-warning)' },
    danger: { bg: 'var(--color-error-surface)', border: 'var(--color-danger)', color: 'var(--color-danger)' },
  };
  const p = palette[variant];
  return (
    <div style={{
      marginTop: 12,
      padding: '12px 14px',
      borderRadius: R,
      border: `1px solid ${p.border}`,
      background: p.bg,
      color: p.color,
      fontSize: FS.body,
      lineHeight: 1.5,
    }}>
      {children}
    </div>
  );
}
