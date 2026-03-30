import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

export function Tooltip({ text, children }: TooltipProps): React.ReactElement {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, above: true });
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (): void => {
    timerRef.current = setTimeout(() => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const above = rect.top > 100;
      setPos({
        x: rect.left + rect.width / 2,
        y: above ? rect.top - 8 : rect.bottom + 8,
        above,
      });
      setVisible(true);
    }, 150);
  };

  const hide = (): void => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Clamp to viewport edges
  useLayoutEffect(() => {
    if (!visible || !popupRef.current) return;
    const el = popupRef.current;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    if (rect.left < pad) {
      el.style.left = `${pad}px`;
      el.style.transform = pos.above ? 'translateY(-100%)' : '';
    } else if (rect.right > window.innerWidth - pad) {
      el.style.left = `${window.innerWidth - pad - rect.width}px`;
      el.style.transform = pos.above ? 'translateY(-100%)' : '';
    }
  }, [visible, pos]);

  return (
    <span
      ref={wrapperRef}
      className="inline-block"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {visible && createPortal(
        <div
          ref={popupRef}
          className="fixed z-[9999] px-3 py-2 rounded text-[12px] leading-[1.4] max-w-[300px] pointer-events-none"
          style={{
            left: `${pos.x}px`,
            top: `${pos.y}px`,
            transform: pos.above ? 'translate(-50%, -100%)' : 'translateX(-50%)',
            backgroundColor: 'var(--tf-bg-secondary)',
            color: 'var(--tf-text)',
            border: '0.5px solid var(--tf-border-hover)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        >
          {text}
        </div>,
        document.body,
      )}
    </span>
  );
}
