'use client';
import React from 'react';
import { useIsMobile } from '../lib/use-mobile';
import { C, R, FW, FS, th, thR, td, tdR, EXCEL_PAD_X } from './tokens';

/* 표 — 데이터 그리드와 열 폭 도우미. 원본: freepasserp4 components/ui/table.tsx.
 * · 셀 스타일(th·td)은 본사 tokens 판을 쓴다. 업무 열 폭 표(제조사·연료·대여료)는 그 프로젝트에 남긴다.
 * · thPin / tdPin = 왼쪽 틀고정. pinRight = 오른쪽 틀고정.
 * · colW(px) = 칸 폭. fit(기본)=페이지에 맞춤 · tight=고정.
 */
const thPin: React.CSSProperties = { left: 0, zIndex: 4, position: 'sticky', boxShadow: `1px 0 0 ${C.line}` };
const tdPin: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 1, boxShadow: `1px 0 0 ${C.line}` };

/** colW — fit(기본)=페이지 폭에 늘어남 · tight=고정(핀·뱃지·가격) · loose=상한만 */
export function colW(px: number, mode: 'tight' | 'loose' | 'fit' = 'fit'): React.CSSProperties {
  if (mode === 'loose') return { minWidth: px, maxWidth: Math.round(px * 1.35), boxSizing: 'border-box' };
  const base: React.CSSProperties = { width: px, minWidth: px, boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
  if (mode === 'tight') return { ...base, maxWidth: px };
  return base;
}
/** 고정폭 칸 안 최대 2줄 — 옵션 등. 넘치면 … */
export const cellClamp2: React.CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  whiteSpace: 'normal',
  wordBreak: 'keep-all',
  lineHeight: 1.35,
  fontWeight: FW.body,
};
/** 우측 틀고정 — i=0이 블록 왼쪽(선). head면 top도 sticky(본문 스크롤용).
 * colPxOrSample: px 숫자 또는 샘플문자열(sampleW와 동일 폭으로 right 누적).
 * zIndex는 오른쪽(끝)일수록 높게 — 인접 sticky 열이 1px이라도 겹치면 왼쪽 칸(1개월)이
 * 오른쪽 칸에 덮여 “세로 줄/내용 더 있음”처럼 보이는 걸 막는다(사이드바 열림·가로스크롤 시).
 * 구분선 = inset(overflow:hidden 에 안 잘림). */
export function pinRight(i: number, colPxOrSample: number | string, total: number, head = false): React.CSSProperties {
  const n = total - 1 - i;
  let right: number | string = 0;
  if (n > 0) {
    if (typeof colPxOrSample === 'number') {
      right = n * colPxOrSample;
    } else {
      const inner = sampleW(colPxOrSample).replace(/^calc\((.*)\)$/, '$1');
      right = `calc(${n} * (${inner}))`;
    }
  }
  const edge = i === 0;
  return {
    position: 'sticky',
    right,
    // head 기본 th z=2·좌측핀 z=5 위 · 본문 좌측핀 z=1과 맞춤 후 i로 상승
    zIndex: (head ? 6 : 2) + i,
    ...(head ? { top: 0 } : {}),
    ...(edge ? { boxShadow: `inset 1px 0 0 ${C.line}` } : {}),
  };
}

const cellClip: React.CSSProperties = {
  boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

function sampleW(sample: string, padX: number = EXCEL_PAD_X): string {
  let em = 0;
  let ch = 0;
  for (const c of sample) {
    if (/[0-9A-Za-z.,\s]/.test(c)) ch += 1;
    else em += 1;
  }
  return `calc(${em}em + ${ch}ch + ${padX * 2}px)`;
}

function charsW(n: number, ellipsis = true, padX: number = EXCEL_PAD_X): string {
  return sampleW(`${'가'.repeat(n)}${ellipsis ? '…' : ''}`, padX);
}

/** 필수 고정칸 — 샘플/px 밖으로 안 줄고 안 늘음. 문자열 샘플만 padX 반영(px 뱃지폭은 그대로). */
export function colLock(pxOrSample: number | string, padX: number = EXCEL_PAD_X): React.CSSProperties {
  const w = typeof pxOrSample === 'number' ? pxOrSample : sampleW(pxOrSample, padX);
  return { width: w, minWidth: w, maxWidth: w, ...cellClip };
}

/** 필수 고정칸 — n글자(+…) 폭. */
export function colLockChars(n: number, ellipsis = true, padX: number = EXCEL_PAD_X): React.CSSProperties {
  return colLock(`${'가'.repeat(n)}${ellipsis ? '…' : ''}`, padX);
}

/**
 * 글자 최소칸 — 옵션이 밀어낼 대상(세부모델·파워·트림).
 * squeeze=true: min=max. squeeze=false: 최소만(옵션 없을 때 살짝 늘어날 수 있음).
 */
export function colChars(n: number, squeeze: boolean, ellipsis = true, padX: number = EXCEL_PAD_X): React.CSSProperties {
  const w = charsW(n, ellipsis, padX);
  return {
    width: w,
    minWidth: w,
    ...(squeeze ? { maxWidth: w } : null),
    ...cellClip,
  };
}

/** px 최소칸 — 뱃지 등. 항상 tight(옵션에 양보). */
export function colSoft(px: number, _squeeze?: boolean): React.CSSProperties {
  return colLock(px);
}

/**
 * 가변칸 — min 이하로 안 줄고, prefer로 초폭.
 * max 있으면 그 이상 안 늘어남(짧은 칸이 옵션 자리를 안 뺏음).
 * 옵션처럼 max 없으면 남는 폭을 흡수.
 */
export function colFlex(minPx: number, preferPx?: number, maxPx?: number): React.CSSProperties {
  const w = preferPx ?? minPx;
  return {
    width: w,
    minWidth: minPx,
    ...(maxPx != null ? { maxWidth: maxPx } : null),
    ...cellClip,
  };
}


/** 최대 n글자, 넘치면 … */
export function clipN(raw: unknown, n: number): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  const chars = [...s];
  if (chars.length <= n) return s;
  return `${chars.slice(0, n).join('')}…`;
}

export function colFlexW(s: { readonly min: number; readonly prefer: number; readonly max?: number }): React.CSSProperties {
  return colFlex(s.min, s.prefer, s.max);
}

export type Col<T> = { key: string; label: string; align?: 'l' | 'r'; pin?: boolean; render: (row: T) => React.ReactNode };
/* 데이터 그리드 — 단일클릭=행 선택, 더블클릭=상세(onRow). 엑셀/ERP 관례. */
export function DataTable<T>({ cols, rows, onRow }: { cols: Col<T>[]; rows: T[]; onRow?: (row: T) => void }) {
  const [sel, setSel] = React.useState(-1);
  const mobile = useIsMobile();
  const bgOf = (i: number) => (sel === i ? C.selected : i % 2 ? C.zebra : C.taupeBg);
  // 좁은 화면 = 같은 객체를 카드로(엑셀 표 대신). 필드 정의(cols)는 동일 SSOT.
  if (mobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {rows.map((r, i) => (
          <div key={i} onClick={() => onRow && onRow(r)} tabIndex={onRow ? 0 : -1}
            onKeyDown={(e) => { if (onRow && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onRow(r); } }}
            style={{ border: `1px solid ${C.line}`, borderRadius: R, background: C.taupeBg, padding: '10px 12px', cursor: onRow ? 'pointer' : 'default', outline: 'none' }}>
            <div style={{ fontSize: FS.body, fontWeight: FW.head }}>{cols[0]?.render(r)}</div>
            {cols.slice(1).map((c) => (
              <div key={c.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '3px 0', fontSize: FS.sub, borderTop: `1px solid ${C.line2}`, marginTop: 3 }}>
                <span style={{ color: C.mute, flex: '0 0 auto' }}>{c.label}</span>
                <span style={{ textAlign: 'right', minWidth: 0, overflow: 'hidden' }}>{c.render(r)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ marginTop: 10, overflow: 'auto', maxWidth: '100%' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: FS.sub, width: '100%' }}>
        <thead><tr>{cols.map((c) => {
          const base = c.align === 'r' ? thR : th;
          return <th key={c.key} style={c.pin ? { ...base, ...thPin } : base}>{c.label}</th>;
        })}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}
              onClick={() => { setSel(i); if (onRow) onRow(r); }}
              onKeyDown={(e) => { if (onRow && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onRow(r); } }}
              tabIndex={onRow ? 0 : -1} role={onRow ? 'button' : undefined}
              style={{ borderTop: `1px solid ${C.line2}`, cursor: onRow ? 'pointer' : 'default', background: bgOf(i), userSelect: 'none', outline: 'none' }}
              onMouseEnter={(e) => { if (sel !== i) e.currentTarget.style.background = C.hover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = bgOf(i); }}>
              {cols.map((c) => {
                const base = c.align === 'r' ? tdR : td;
                return <td key={c.key} style={c.pin ? { ...base, ...tdPin, background: bgOf(i) } : base}>{c.render(r)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
