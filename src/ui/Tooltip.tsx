import { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

export function Tooltip({ text, children }: TooltipProps): React.ReactElement {
  const [visible, setVisible] = useState(false);
  const [above, setAbove] = useState(true);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (): void => {
    timerRef.current = setTimeout(() => {
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        setAbove(rect.top > 80);
      }
      setVisible(true);
    }, 150);
  };

  const hide = (): void => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

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
          className={`absolute left-1/2 z-50 px-2.5 py-1.5 rounded text-[12px] leading-[1.4] max-w-[260px] w-max pointer-events-none transition-opacity duration-150 ${
            above ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
          style={{
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--tf-text)',
            color: 'var(--tf-bg)',
          }}
        >
          {text}
          <span
            className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 ${
              above
                ? 'top-full border-t-[5px] border-x-[5px] border-x-transparent'
                : 'bottom-full border-b-[5px] border-x-[5px] border-x-transparent'
            }`}
            style={{
              borderTopColor: above ? 'var(--tf-text)' : 'transparent',
              borderBottomColor: above ? 'transparent' : 'var(--tf-text)',
            }}
          />
        </span>
      )}
    </span>
  );
}
