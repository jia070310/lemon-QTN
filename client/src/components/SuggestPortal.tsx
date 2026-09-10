import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  onClose?: () => void;
};

export function SuggestPortal({ open, anchorRef, children, onClose }: Props) {
  const listRef = useRef<HTMLUListElement>(null);
  const [style, setStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;

    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const maxH = 220;
      const gap = 4;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const openUp = spaceBelow < Math.min(maxH, 120) && rect.top > spaceBelow;
      const width = Math.max(rect.width, 148);
      const left = Math.min(rect.left, window.innerWidth - width - 8);

      setStyle({
        position: 'fixed',
        left: Math.max(8, left),
        width,
        maxHeight: Math.min(maxH, openUp ? rect.top - gap - 8 : spaceBelow),
        zIndex: 1200,
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + gap, top: 'auto' }
          : { top: rect.bottom + gap, bottom: 'auto' }),
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef]);

  useLayoutEffect(() => {
    if (!open || !onClose) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose, anchorRef]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <ul className="suggest-list suggest-list--portal" style={style} ref={listRef}>
      {children}
    </ul>,
    document.body,
  );
}
