import { useEffect, useState, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/ui';
import { useNavigation } from '@/core/hooks/useNavigation';
import type { TourStep } from './tourSteps';

interface TourOverlayProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onFinish: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;

export function TourOverlay({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onFinish,
}: TourOverlayProps): React.ReactElement | null {
  const { navigate } = useNavigation();
  const [targetRect, setTargetRect] = useState<Rect | null>(null);

  // Track the elevated element so cleanup always restores styles
  const elevatedRef = useRef<{ el: HTMLElement; origPosition: string; origZIndex: string } | null>(null);

  // Measure target + elevate z-index so it stays interactive above the overlay
  useEffect(() => {
    // Restore previous element styles on step change
    if (elevatedRef.current) {
      const { el: prev, origPosition, origZIndex } = elevatedRef.current;
      prev.style.position = origPosition;
      prev.style.zIndex = origZIndex;
      elevatedRef.current = null;
    }

    // Navigate to target page if step requires it (cross-page tour)
    if (step.navigateTo) {
      navigate(step.navigateTo);
    }

    const elevate = (el: HTMLElement): void => {
      const origPosition = el.style.position;
      const origZIndex = el.style.zIndex;
      const computed = window.getComputedStyle(el);
      if (computed.position === 'static') el.style.position = 'relative';
      el.style.zIndex = '102';
      elevatedRef.current = { el, origPosition, origZIndex };
    };

    const measureAndShow = (el: HTMLElement): void => {
      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      });
    };

    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);

    if (!el) {
      // Centered fallback so step is never skipped
      setTargetRect({
        top: window.innerHeight / 2 - 25,
        left: window.innerWidth / 2 - 100,
        width: 200,
        height: 50,
      });

      // Retry up to 3 times at 300ms intervals (useful after navigate())
      let attempts = 0;
      const retryInterval = setInterval(() => {
        attempts++;
        const retryEl = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
        if (retryEl) {
          clearInterval(retryInterval);
          elevate(retryEl);
          measureAndShow(retryEl);
          retryEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          // Re-measure after scroll
          setTimeout(() => measureAndShow(retryEl), 400);
        } else if (attempts >= 3) {
          clearInterval(retryInterval);
        }
      }, 300);

      return () => clearInterval(retryInterval);
    }

    // Element available immediately
    elevate(el);
    measureAndShow(el);
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const timer = setTimeout(() => measureAndShow(el), 400);

    const onResize = (): void => measureAndShow(el);
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.target]);

  // Final cleanup on unmount: restore last elevated element
  useEffect(() => {
    return () => {
      if (elevatedRef.current) {
        const { el, origPosition, origZIndex } = elevatedRef.current;
        el.style.position = origPosition;
        el.style.zIndex = origZIndex;
        elevatedRef.current = null;
      }
    };
  }, []);

  if (!targetRect) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  const getTooltipStyle = (): React.CSSProperties => {
    const pos = step.position || 'bottom';
    const base: React.CSSProperties = {
      position: 'fixed',
      zIndex: 110,
      maxWidth: 320,
      width: 320,
    };

    switch (pos) {
      case 'bottom':
        return {
          ...base,
          top: targetRect.top + targetRect.height + 12,
          left: Math.max(8, Math.min(targetRect.left, window.innerWidth - 336)),
        };
      case 'top':
        return {
          ...base,
          bottom: window.innerHeight - targetRect.top + 12,
          left: Math.max(8, Math.min(targetRect.left, window.innerWidth - 336)),
        };
      case 'right':
        return {
          ...base,
          top: Math.max(8, targetRect.top),
          left: Math.min(targetRect.left + targetRect.width + 12, window.innerWidth - 336),
        };
      case 'left':
        return {
          ...base,
          top: Math.max(8, targetRect.top),
          right: Math.max(8, window.innerWidth - targetRect.left + 12),
        };
      default:
        return {
          ...base,
          top: targetRect.top + targetRect.height + 12,
          left: Math.max(8, targetRect.left),
        };
    }
  };

  return (
    <>
      {/* Dark overlay with spotlight hole via clip-path */}
      <div
        className="fixed inset-0 transition-all duration-300"
        style={{
          zIndex: 100,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          clipPath: `polygon(
            0% 0%, 0% 100%,
            ${targetRect.left}px 100%,
            ${targetRect.left}px ${targetRect.top}px,
            ${targetRect.left + targetRect.width}px ${targetRect.top}px,
            ${targetRect.left + targetRect.width}px ${targetRect.top + targetRect.height}px,
            ${targetRect.left}px ${targetRect.top + targetRect.height}px,
            ${targetRect.left}px 100%,
            100% 100%, 100% 0%
          )`,
        }}
        onClick={onFinish}
      />

      {/* Spotlight ring around target */}
      <div
        className="fixed pointer-events-none transition-all duration-300"
        style={{
          zIndex: 105,
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
          border: '2px solid var(--tf-primary)',
          borderRadius: 'var(--tf-radius)',
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0)',
        }}
      />

      {/* Tooltip card */}
      <div
        className="bg-[var(--tf-bg)] rounded-[var(--tf-radius-lg)] shadow-2xl"
        style={{
          ...getTooltipStyle(),
          border: '0.5px solid var(--tf-border)',
          padding: '16px',
        }}
      >
        {/* Header with step counter and close */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10.5px] font-medium text-[var(--tf-text-tertiary)] uppercase tracking-[0.08em]">
            Schritt {stepIndex + 1} von {totalSteps}
          </span>
          <button
            onClick={onFinish}
            className="p-0.5 rounded-[var(--tf-radius)] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-hover)] cursor-pointer"
            aria-label="Tour schliessen"
          >
            <X size={14} />
          </button>
        </div>

        {/* Title + description */}
        <h4 className="text-[14px] font-medium text-[var(--tf-text)] mb-1.5">
          {step.title}
        </h4>
        <p className="text-[12.5px] text-[var(--tf-text-secondary)] leading-relaxed mb-4">
          {step.description}
        </p>

        {/* Navigation buttons */}
        <div className="flex items-center gap-2">
          {!isFirst && (
            <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={onPrev}>
              Zurueck
            </Button>
          )}
          <div className="flex-1" />
          {isLast ? (
            <Button variant="primary" size="sm" icon={Check} onClick={onFinish}>
              Fertig
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={onNext}>
              Weiter
              <ChevronRight size={14} />
            </Button>
          )}
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mt-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-colors"
              style={{
                backgroundColor:
                  i === stepIndex
                    ? 'var(--tf-primary)'
                    : i < stepIndex
                      ? 'var(--tf-primary-light)'
                      : 'var(--tf-border-hover)',
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
