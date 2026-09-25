'use client';

import { X } from 'lucide-react';
import { IconBtn } from './controls';
import { ICON } from './tokens';

/** 닫기(×) 1규격 — lucide X. 본사 `IconBtn` 위에 선다(높이·테두리·진동을 그쪽이 정한다). */
export function CloseBtn({
  onClick,
  title = '닫기',
  disabled,
}: {
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <IconBtn onClick={onClick} title={title} disabled={disabled}>
      <X size={ICON.lg} strokeWidth={2.25} aria-hidden />
    </IconBtn>
  );
}
