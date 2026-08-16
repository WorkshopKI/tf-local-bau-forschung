/**
 * Die Bauteile, aus denen die Reiter des Startzustands bestehen.
 *
 * Bis v4.72 waren `Spalte` und `Zeile` private Helfer der einen Datei
 * `SucheStartzustand.tsx`. Seit die Reiter je eine eigene Datei haben, stehen
 * sie hier — geteilt, nicht dreimal nachgebaut.
 */
import { X } from 'lucide-react';

/** Die Überschrift über einer Gruppe von Zeilen. */
export function GruppenTitel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <h3 className="mb-1 px-2 text-[10.5px] uppercase tracking-[0.1em] text-[var(--tf-text-tertiary)]">
      {children}
    </h3>
  );
}

/** Ein benannter Block mit Zeilen — oder mit einem Satz, wenn nichts da ist. */
export function Spalte({ titel, leer, children }: {
  titel: string;
  leer?: string;
  children?: React.ReactNode;
}): React.ReactElement {
  const hatInhalt = Array.isArray(children) ? children.length > 0 : children !== undefined;
  return (
    <section>
      <GruppenTitel>{titel}</GruppenTitel>
      {hatInhalt
        ? <div className="flex flex-col">{children}</div>
        : <p className="px-2 py-1.5 text-[12.5px] text-[var(--tf-text-tertiary)]">{leer}</p>}
    </section>
  );
}

/** Eine ausführbare Zeile: links Symbol und Text, rechts die Zahl, ganz rechts das ✕. */
export function Zeile({ icon, text, rechts, onClick, onEntfernen, titel }: {
  icon: React.ReactNode;
  text: React.ReactNode;
  rechts?: React.ReactNode;
  onClick: () => void;
  onEntfernen?: () => void;
  titel?: string;
}): React.ReactElement {
  return (
    <div className="group flex items-center gap-2 rounded-[6px] hover:bg-[var(--tf-hover)]">
      <button
        type="button"
        onClick={onClick}
        title={titel}
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left cursor-pointer"
      >
        <span className="shrink-0 text-[var(--tf-text-tertiary)]">{icon}</span>
        <span className="truncate text-[13px] text-[var(--tf-text)]">{text}</span>
      </button>
      {rechts !== undefined && (
        <span className="shrink-0 pr-1 text-[11.5px] tabular-nums text-[var(--tf-text-tertiary)]">
          {rechts}
        </span>
      )}
      {onEntfernen && (
        <button
          type="button"
          onClick={onEntfernen}
          title="Aus der Liste entfernen"
          className="mr-1 rounded p-0.5 text-[var(--tf-text-tertiary)] opacity-0 transition-opacity hover:text-[var(--tf-text)] group-hover:opacity-100 cursor-pointer"
        >
          <X size={12} aria-hidden />
        </button>
      )}
    </div>
  );
}

/**
 * „alle 9 ansehen →" — der Weg vom Kurzformat des Reiters „Alle" in den Reiter
 * selbst. Steht nur da, wo tatsächlich mehr wartet.
 */
export function MehrZeile({ text, onClick }: {
  text: string;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-0.5 self-start rounded-[6px] px-2 py-1 text-left text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-hover)] cursor-pointer"
    >
      {text} →
    </button>
  );
}

/** Der Fußsatz eines Reiters — ein Satz, keine Erklärseite. */
export function FussSatz({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <p className="mt-3 px-2 text-[11.5px] leading-relaxed text-[var(--tf-text-tertiary)]">
      {children}
    </p>
  );
}

/** „6 Treffer" — oder gar nichts, solange die Zahl nicht feststeht. Ein
 *  Platzhalter wie „—" liest sich wie „null Treffer". */
export function trefferText(n: number | null): React.ReactNode {
  return n === null ? undefined : `${n.toLocaleString('de-DE')} Treffer`;
}
