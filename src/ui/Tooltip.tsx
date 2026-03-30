import { useState, useRef, useEffect, useLayoutEffect } from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

export function Tooltip({ text, children }: TooltipProps): React.ReactElement {
  const [visible, setVisible] = useState(false);
  const [above, setAbove] = useState(true);
  const [offsetX, setOffsetX] = useState(0);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (): void => {
    timerRef.current = setTimeout(() => {
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        setAbove(rect.top > 80);
      }
      setOffsetX(0);
      setVisible(true);
    }, 150);
  };

  const hide = (): void => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Clamp popup so it doesn't clip viewport edges
  useLayoutEffect(() => {
    if (!visible || !popupRef.current) return;
    const rect = popupRef.current.getBoundingClientRect();
    const pad = 8;
    if (rect.left < pad) {
      setOffsetX(pad - rect.left);
    } else if (rect.right > window.innerWidth - pad) {
      setOffsetX(window.innerWidth - pad - rect.right);
    }
  }, [visible]);

  return (
    <span
      ref={wrapperRef}
      className="relative inline-block"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {visible && (
        <span
          ref={popupRef}
          className={`absolute left-1/2 z-50 px-2.5 py-1.5 rounded text-[12px] leading-[1.4] max-w-[260px] w-max pointer-events-none transition-opacity duration-150 ${
            above ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
          style={{
            transform: `translateX(calc(-50% + ${offsetX}px))`,
            backgroundColor: 'var(--tf-bg-secondary)',
            color: 'var(--tf-text)',
            border: '0.5px solid var(--tf-border-hover)',
          }}
        >
          {text}
          {/* Arrow: stays centered on trigger, not on popup */}
          <span
            className={`absolute w-0 h-0 ${
              above
                ? 'top-full border-t-[5px] border-x-[5px] border-x-transparent'
                : 'bottom-full border-b-[5px] border-x-[5px] border-x-transparent'
            }`}
            style={{
              left: `calc(50% - ${offsetX}px)`,
              transform: 'translateX(-50%)',
              borderTopColor: above ? 'var(--tf-border-hover)' : 'transparent',
              borderBottomColor: above ? 'transparent' : 'var(--tf-border-hover)',
            }}
          />
        </span>
      )}
    </span>
  );
}
