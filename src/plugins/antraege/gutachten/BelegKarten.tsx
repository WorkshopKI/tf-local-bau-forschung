/**
 * Antragsbezug als Beleg-Karten (Journey-Paket 4, Phase 6): jedes Quellen-Zitat mit
 * Abschnitts-Referenz und den gestützten Satz-Nummern. Hover verbindet flüchtig mit
 * dem Entwurf (amber Highlight, kein Layout-Shift), Klick pinnt über den bestehenden
 * `fundstelle`-Mechanismus (zyklisch bei mehreren Sätzen). Belege ohne (live-)gültige
 * Zuordnung — z.B. nach manueller Textbearbeitung oder aus Alt-Läufen — degradieren
 * zu „ohne Zuordnung" (Anzeige-Logik, keine Datenänderung).
 */
import { useRef } from 'react';
import { Quote, CornerDownRight } from 'lucide-react';
import type { QuellenBeleg } from '@/core/services/skills';
import { liveGueltigeIndizes, belegBetrifftSaetze } from './belege';

interface Props {
  belege: QuellenBeleg[];
  /** Aktuelle Satzzahl des (ggf. editierten) finalen Textes — für die Live-Gültigkeit. */
  satzAnzahl: number;
  /** Aktuell gehoverte Satz-Nummern (aus Karte ODER Satz-Span) — treibt das Karten-Highlight. */
  hoverSaetze: number[] | null;
  onHover: (saetze: number[] | null) => void;
  /** Pin: einen Satz in die Sicht scrollen + highlighten (bestehender fundstelle-Pfad). */
  onPin: (satzIndex: number) => void;
}

/**
 * „stützt Satz 2" / „stützt Sätze 2, 5" (1-basiert) bzw. „ohne Zuordnung".
 * Abgeleitete (heuristische) Belege tragen ein `≈` und die weichere Formulierung
 * „möglicher Bezug", damit sie klar vom präzisen Modell-Beleg unterscheidbar sind.
 */
function satzLabel(liveIdx: number[], abgeleitet: boolean): string {
  if (liveIdx.length === 0) return 'ohne Zuordnung';
  const n = liveIdx.map(i => i + 1);
  const kern = n.length === 1 ? `Satz ${n[0]}` : `Sätze ${n.join(', ')}`;
  return abgeleitet ? `≈ möglicher Bezug: ${kern}` : `stützt ${kern}`;
}

export function BelegKarten({ belege, satzAnzahl, hoverSaetze, onHover, onPin }: Props): React.ReactElement {
  // Pin-Zyklus je Karte: wiederholter Klick springt zyklisch durch die Sätze (wie „Anzeigen").
  const cursor = useRef<number[]>([]);
  return (
    <div className="g-belege">
      {belege.map((b, i) => {
        const live = liveGueltigeIndizes(b, satzAnzahl);
        const ohne = live.length === 0;
        const auto = b.abgeleitet === true;
        const hl = hoverSaetze != null && belegBetrifftSaetze(b, hoverSaetze, satzAnzahl);
        const pin = (): void => {
          if (ohne) return;
          const c = (cursor.current[i] ?? 0) % live.length;
          cursor.current[i] = c + 1;
          onPin(live[c]!);
        };
        return (
          <div
            key={i}
            className={`g-beleg${hl ? ' hl' : ''}${ohne ? ' none' : ''}${auto ? ' auto' : ''}`}
            onMouseEnter={() => onHover(live)}
            onMouseLeave={() => onHover(null)}
            {...(ohne ? {} : {
              role: 'button',
              tabIndex: 0,
              onClick: pin,
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pin(); }
              },
            })}
            title={ohne
              ? (auto
                ? 'Automatisch geprüft — kein hinreichend passender Satz gefunden'
                : 'Aus einem älteren Lauf — keine Satz-Zuordnung vorhanden')
              : (auto
                ? 'Automatisch aus Wortüberlappung zugeordnet (kein Modell-Beleg) — Klick springt zum Satz'
                : 'Klick springt zum gestützten Satz')}
          >
            <div className="g-beleg-quote"><Quote className="g-qci" />{b.zitat}</div>
            <div className="g-beleg-foot">
              <span className="g-beleg-ref">{b.abschnittRef ? `Abschn. ${b.abschnittRef}` : ''}</span>
              <span className={`g-beleg-satz${ohne ? ' none' : ''}`}>
                {!ohne && <CornerDownRight size={11} aria-hidden />}
                {satzLabel(live, auto)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
