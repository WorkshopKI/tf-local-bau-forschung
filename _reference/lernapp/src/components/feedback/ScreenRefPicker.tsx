import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export interface ScreenRef {
  ref: string;
  label: string;
}

interface ElementRect {
  ref: string;
  label: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  onSelect: (ref: ScreenRef) => void;
  onCancel: () => void;
}

const PADDING = 6;

/**
 * Overlay-Picker der alle `data-feedback-ref` Elemente hervorhebt.
 * Basiert auf der gleichen Elevations-Technik wie TourOverlay:
 * Elemente werden per z-index über das Overlay gehoben.
 */
export function ScreenRefPicker({ onSelect, onCancel }: Props) {
  const [elements, setElements] = useState<ElementRect[]>([]);
  const [hoveredRef, setHoveredRef] = useState<string | null>(null);
  const elevatedRefs = useRef<Map<HTMLElement, { pos: string; z: string }>>(new Map());

  // Alle data-feedback-ref Elemente finden, messen und über das Overlay heben
  useEffect(() => {
    const measure = () => {
      const nodes = document.querySelectorAll<HTMLElement>("[data-feedback-ref]");
      const rects: ElementRect[] = [];

      nodes.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const ref = el.getAttribute("data-feedback-ref") ?? "";
        const label = el.getAttribute("data-feedback-label") ?? ref;

        rects.push({
          ref,
          label,
          top: rect.top - PADDING,
          left: rect.left - PADDING,
          width: rect.width + PADDING * 2,
          height: rect.height + PADDING * 2,
        });

        // Element über das Overlay heben (gleiche Technik wie TourOverlay)
        if (!elevatedRefs.current.has(el)) {
          const origPos = el.style.position;
          const origZ = el.style.zIndex;
          const computed = window.getComputedStyle(el);
          if (computed.position === "static") el.style.position = "relative";
          el.style.zIndex = "102";
          elevatedRefs.current.set(el, { pos: origPos, z: origZ });
        }
      });

      setElements(rects);
    };

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    // Escape zum Abbrechen
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      document.removeEventListener("keydown", onKey);

      // Alle Elemente zurücksetzen
      elevatedRefs.current.forEach(({ pos, z }, el) => {
        el.style.position = pos;
        el.style.zIndex = z;
      });
      elevatedRefs.current.clear();
    };
  }, [onCancel]);

  const handleClick = useCallback(
    (elem: ElementRect) => {
      onSelect({ ref: elem.ref, label: elem.label });
    },
    [onSelect],
  );

  return (
    <>
      {/* Dunkles Overlay — Elemente ragen per z-index (102) durch */}
      <div
        className="fixed inset-0 z-[100] transition-all duration-300"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.45)" }}
        onClick={onCancel}
      />

      {/* Klickbare Rahmen um jedes Element */}
      {elements.map((elem) => (
        <div
          key={elem.ref}
          onClick={() => handleClick(elem)}
          onMouseEnter={() => setHoveredRef(elem.ref)}
          onMouseLeave={() => setHoveredRef(null)}
          className="fixed z-[105] rounded-lg cursor-pointer transition-all duration-150"
          style={{
            top: elem.top,
            left: elem.left,
            width: elem.width,
            height: elem.height,
            outline:
              hoveredRef === elem.ref
                ? "2px solid hsl(var(--primary))"
                : "2px dashed hsl(var(--primary) / 0.4)",
            background:
              hoveredRef === elem.ref
                ? "hsl(var(--primary) / 0.08)"
                : "transparent",
          }}
        >
          {/* Label-Pill bei Hover */}
          {hoveredRef === elem.ref && (
            <div className="absolute -top-7 left-2 px-2 py-0.5 rounded text-[10px] font-semibold bg-primary text-primary-foreground whitespace-nowrap shadow-sm">
              {elem.label}
            </div>
          )}
        </div>
      ))}

      {/* Toolbar oben */}
      <div className="fixed top-0 inset-x-0 z-[110] flex items-center justify-between bg-card/95 backdrop-blur-sm border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-sm font-medium">Bereich markieren</span>
          <span className="text-xs text-muted-foreground">
            — Klicke auf den betroffenen Bereich
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={onCancel} className="text-xs h-7">
          <X className="mr-1 h-3 w-3" /> Abbrechen
        </Button>
      </div>
    </>
  );
}
