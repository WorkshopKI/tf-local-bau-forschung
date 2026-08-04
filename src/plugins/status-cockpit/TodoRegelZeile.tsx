/**
 * Eine To-do-Regel als **schlanke Zeile** — die Gestalt für die Auswahl-Spalte,
 * solange rechts eine Regel bearbeitet wird.
 *
 * Nummer und Beschreibung, sonst nichts: Wer hier liest, sucht die nächste
 * Regel, nicht ihren Inhalt. Die Nummer trägt die Kaskaden-Position und bleibt
 * deshalb auch hier stehen.
 *
 * Die Zeile IST ein `<button>` — darin dürfen keine weiteren Knöpfe und keine
 * Checkbox stehen (ungültige Verschachtelung, kaputte Tastaturbedienung).
 * Genau darum wohnen Positions-Pfeile und aktiv-Haken im Detail-Kopf; die
 * Zustände erscheinen hier als reine Marker.
 */
import type { Rolle, TodoRegel } from '@/core/status';
import { zustandsMarker } from './todoRegelnAnsicht';

const MARKER = 'shrink-0 text-[10px] uppercase tracking-wide text-[var(--tf-text-tertiary)]';

export function TodoRegelZeile({ r, index, satz, unbekannte, aktiv, onWaehlen }: {
  r: TodoRegel;
  index: number;
  satz: Rolle;
  unbekannte: readonly string[];
  /** Ist das die gerade geöffnete Regel? */
  aktiv: boolean;
  onWaehlen: () => void;
}): React.ReactElement {
  const { istSperre, giltFuerAlle, stillgelegt } = zustandsMarker(r, satz, unbekannte);
  return (
    <button
      type="button"
      onClick={onWaehlen}
      title={r.beschreibung}
      aria-current={aktiv ? 'true' : undefined}
      // Der 2px-Balken liegt IMMER an (transparent, wenn inaktiv) — sonst
      // verschöbe die Auswahl die ganze Zeile um zwei Pixel.
      className={`flex items-center gap-2 w-full text-left py-[5px] pl-1.5 pr-2 border-l-2 rounded-r cursor-pointer transition-colors ${
        aktiv
          ? 'border-[var(--tf-primary)] bg-[var(--tf-primary-light)] text-[var(--tf-text)] font-medium'
          : 'border-transparent text-[var(--tf-text-secondary)] hover:bg-[var(--tf-bg-secondary)]'
      }`}
    >
      <span className="shrink-0 w-[22px] text-[11px] font-mono tabular-nums text-[var(--tf-text-tertiary)]">
        {index + 1}
      </span>
      <span className="flex-1 min-w-0 truncate text-[12.5px]">{r.beschreibung}</span>
      {istSperre && (
        <span className={MARKER} title={giltFuerAlle ? 'Sperre — gilt für alle Regelsätze' : 'Sperre'}>
          Sp
        </span>
      )}
      {/* Kein `opacity` für „stillgelegt": sie multiplizierte sich mit dem
          Auswahl-Tint, und die geöffnete Regel sähe halb abwesend aus. */}
      {stillgelegt && <span className={MARKER} title="stillgelegt">aus</span>}
      {unbekannte.length > 0 && (
        <span
          aria-hidden
          className="shrink-0 w-1.5 h-1.5 rounded-full"
          style={{ background: 'var(--tf-danger-text)' }}
          title={`trifft nie zu: ${unbekannte.join(', ')}`}
        />
      )}
    </button>
  );
}
