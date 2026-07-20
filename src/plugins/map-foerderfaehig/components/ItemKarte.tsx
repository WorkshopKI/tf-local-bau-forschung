/**
 * Eine Kriteriums-Karte im Prüf-Stepper.
 *
 * Rein darstellend: Anwendbarkeit, Pflicht-Bemerkung und die zugehörigen
 * Rechenbefunde kommen fertig aus `checkliste/bewertung.ts`. Die Bewertung
 * bleibt ausdrücklich beim Menschen — ein Rechenbefund wird als Vorbelegung
 * angezeigt, nie automatisch übernommen.
 */
import { Button } from '@/components/ui/button';
import { AlertTriangle, Info } from 'lucide-react';
import type { MapItemZustand } from '../checkliste/bewertung';
import { BEMERKUNG_PFLICHT } from '../checkliste/bewertung';
import type { MapItemStatus } from '../checkliste/typen';

const STATUS_LABEL: Record<Exclude<MapItemStatus, 'offen'>, string> = {
  'erfuellt': 'erfüllt',
  'nicht-erfuellt': 'nicht erfüllt',
  'nicht-zutreffend': 'n. z.',
  'nf-notwendig': 'NF notw.',
  'nf-erfuellt': 'NF erfüllt',
};

const STATUS_FARBE: Record<Exclude<MapItemStatus, 'offen'>, string> = {
  'erfuellt': 'var(--tf-success, #16a34a)',
  'nicht-erfuellt': 'var(--tf-danger, #dc2626)',
  'nicht-zutreffend': 'var(--tf-text-tertiary)',
  'nf-notwendig': 'var(--tf-warning, #f59e0b)',
  'nf-erfuellt': 'var(--tf-success, #16a34a)',
};

const REIHENFOLGE = Object.keys(STATUS_LABEL) as Array<Exclude<MapItemStatus, 'offen'>>;

export function ItemKarte({
  zustand, onBewerte, onBedingung,
}: {
  zustand: MapItemZustand;
  onBewerte: (status: MapItemStatus, bemerkung?: string) => void;
  onBedingung: (wert: boolean) => void;
}): React.ReactElement {
  const { item, status, bewertung, befunde, bemerkungFehlt, anwendbar } = zustand;
  const bemerkungNoetig = BEMERKUNG_PFLICHT.includes(status);

  // Nicht anwendbar: der Block entfällt für diese Prüfung. Bei einer manuellen
  // Bedingung bleibt der Umschalter sichtbar, sonst nur der Grund.
  if (!anwendbar) {
    return (
      <div className="rounded-[var(--tf-radius-md,8px)] px-3 py-2.5 opacity-60"
        style={{ border: '0.5px dashed var(--tf-border)' }}>
        <p className="text-[12.5px] text-[var(--tf-text-secondary)]">{item.kriterium}</p>
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-1">
          {item.bedingung?.art === 'manuell'
            ? item.bedingung.frage
            : item.bedingung?.art === 'innoScoreUnter'
              ? `Entfällt — der Innovationsgrad erreicht den Kurzpfad (ab ${item.bedingung.schwelle} Punkten).`
              : 'Entfällt — es sind keine Kosten für Aufträge an Dritte geplant.'}
        </p>
        {item.bedingung?.art === 'manuell' && (
          <Button variant="ghost" size="sm" className="mt-1.5" onClick={() => onBedingung(true)}>
            Trifft zu — Kriterium einblenden
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-[var(--tf-radius-md,8px)] px-3 py-3"
      style={{
        border: '0.5px solid var(--tf-border)',
        borderLeft: `3px solid ${status === 'offen' ? 'transparent' : STATUS_FARBE[status]}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] text-[var(--tf-text)] leading-snug">{item.kriterium}</p>
        <span className="text-[10.5px] text-[var(--tf-text-tertiary)] shrink-0 mt-0.5 font-mono">
          {item.klasse}
        </span>
      </div>

      {item.hinweis != null && (
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-1.5 flex items-start gap-1">
          <Info size={12} className="shrink-0 mt-0.5" />
          {item.hinweis}
        </p>
      )}
      {item.fundstelle != null && (
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-1">Quelle: {item.fundstelle}</p>
      )}

      {befunde.length > 0 && (
        <div
          className="mt-2 rounded px-2.5 py-2"
          style={{ background: 'color-mix(in srgb, var(--tf-warning, #f59e0b) 10%, var(--tf-bg))' }}
        >
          <p className="text-[11.5px] font-medium flex items-center gap-1.5"
            style={{ color: 'var(--tf-warning, #f59e0b)' }}>
            <AlertTriangle size={12} />
            Rechencheck-Befund
          </p>
          {befunde.map(b => (
            <p key={b.id} className="text-[11.5px] text-[var(--tf-text-secondary)] mt-1">
              {b.titel} — erwartet {b.erwartet}, gefunden {b.gefunden}
            </p>
          ))}
          <Button
            variant="ghost" size="sm" className="mt-1.5"
            onClick={() => onBewerte(
              'nf-notwendig',
              befunde.map(b => `${b.titel}: erwartet ${b.erwartet}, gefunden ${b.gefunden}`).join(' · '),
            )}
          >
            Befund übernehmen
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {REIHENFOLGE.map(s => {
          const aktiv = status === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onBewerte(s, bewertung?.bemerkung)}
              className="text-[11.5px] px-2 py-1 rounded cursor-pointer transition"
              style={{
                border: `0.5px solid ${aktiv ? STATUS_FARBE[s] : 'var(--tf-border)'}`,
                color: aktiv ? STATUS_FARBE[s] : 'var(--tf-text-secondary)',
                background: aktiv
                  ? `color-mix(in srgb, ${STATUS_FARBE[s]} 12%, var(--tf-bg))`
                  : 'transparent',
              }}
            >
              {STATUS_LABEL[s]}
            </button>
          );
        })}
      </div>

      {bemerkungNoetig && (
        <div className="mt-2">
          <textarea
            value={bewertung?.bemerkung ?? ''}
            onChange={e => onBewerte(status, e.target.value)}
            placeholder="Bemerkung (Pflicht bei diesem Status)"
            rows={2}
            className="w-full text-[12.5px] rounded px-2 py-1.5 bg-[var(--tf-bg)] text-[var(--tf-text)]"
            style={{
              border: `0.5px solid ${bemerkungFehlt ? 'var(--tf-danger, #dc2626)' : 'var(--tf-border)'}`,
            }}
          />
          {bemerkungFehlt && (
            <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--tf-danger, #dc2626)' }}>
              Dieser Status verlangt eine Bemerkung.
            </p>
          )}
        </div>
      )}

      {bewertung?.autor != null && !bemerkungNoetig && (
        <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-1.5">
          {bewertung.autor} · {bewertung.geaendertAm.slice(0, 10)}
        </p>
      )}
    </div>
  );
}
