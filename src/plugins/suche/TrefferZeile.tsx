/**
 * Eine Zeile der Trefferliste.
 *
 * Der Unterschied zur Tabelle ist nicht die Optik, sondern die Frage, die sie
 * beantwortet: die Tabelle zeigt Metadaten zum Vergleichen und Exportieren, die
 * Liste zeigt die FUNDSTELLE — den Satz, in dem das Suchwort steht, und wo er
 * herkommt. Beides nebeneinander wäre in einer Tabellenzelle unlesbar.
 *
 * „Warum?" klappt die KI-Begründung unter der Zeile auf. Bewusst je Zeile statt
 * global: der Zweifel entsteht an einem Treffer, nicht an der Liste.
 */
import { Sparkles, ChevronDown, ExternalLink, Search, ThumbsDown } from 'lucide-react';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import {
  TREFFERFELD_LABEL,
  RELEVANZ_LABEL,
  zaehleVorkommen,
  type Trefferfeld,
} from '@/core/services/search/trefferstelle';
import { StufenBalken } from '@/components/ui/StufenBalken';
import { SuchMarkierung } from './SuchMarkierung';

/** Welche Felder überhaupt eine Vorkommens-Zahl tragen können. Für Akronym,
 *  Aktenzeichen und Ähnlichkeit wäre „1" keine Information. */
const ZAEHLBAR: ReadonlySet<Trefferfeld> = new Set<Trefferfeld>([
  'titel', 'kurzbeschreibung', 'dokument', 'deskriptoren', 'organisation',
]);

export function TrefferZeile({
  treffer,
  woerter,
  varianten,
  kompakt,
  ausgeklappt,
  gewaehlt,
  onOeffnen,
  onWarum,
  onAehnliche,
  onUnpassend,
  onWaehlen,
  begruendungLaeuft,
}: {
  treffer: UnifiedSearchResult;
  woerter: readonly string[];
  varianten: readonly string[];
  kompakt: boolean;
  ausgeklappt: boolean;
  gewaehlt: boolean;
  onOeffnen: () => void;
  onWarum: () => void;
  onAehnliche: () => void;
  onUnpassend: () => void;
  onWaehlen: () => void;
  begruendungLaeuft: boolean;
}): React.ReactElement {
  const felder = treffer.trefferfelder ?? [];
  const stufe = treffer.relevanzStufe ?? 1;

  return (
    <li
      className="group px-3 py-2.5 transition-colors hover:bg-[var(--tf-hover)]"
      style={{ borderBottom: '0.5px solid var(--tf-border)' }}
    >
      <div className="flex gap-2.5">
        <input
          type="checkbox"
          checked={gewaehlt}
          onChange={onWaehlen}
          aria-label={`${treffer.title} auswählen`}
          className="mt-1 h-3.5 w-3.5 shrink-0 cursor-pointer accent-[var(--tf-primary)]"
        />

        <div className="min-w-0 flex-1">
          {/* Kopfzeile: Kennung und Einordnung. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {treffer.fkz && (
              <span className="font-mono text-[11.5px] text-[var(--tf-text-secondary)]">
                <SuchMarkierung text={treffer.fkz} wortlaut={woerter} />
              </span>
            )}
            {treffer.status && (
              <span className="rounded-full px-1.5 py-px text-[11px] text-[var(--tf-text-secondary)]"
                style={{ border: '0.5px solid var(--tf-border)' }}
              >
                {treffer.status}
              </span>
            )}
            {treffer.bewilligungsdatum && (
              <span className="text-[11px] text-[var(--tf-text-tertiary)]">
                bewilligt {treffer.bewilligungsdatum}
              </span>
            )}
            {treffer.ausserhalbBereich && (
              <span
                className="rounded-full px-1.5 py-px text-[10.5px] text-[var(--tf-text-tertiary)]"
                style={{ border: '0.5px solid var(--tf-border)' }}
                title="Dieser Treffer liegt außerhalb des eingestellten Betrachtungsbereichs — die Suche steht bewusst am Vollbestand."
              >
                außerhalb des Bereichs
              </span>
            )}
          </div>

          {/* Titel — die Klickfläche in den Antrag. */}
          <button
            type="button"
            onClick={onOeffnen}
            className="mt-0.5 block text-left text-[13.5px] leading-snug text-[var(--tf-text)] hover:underline cursor-pointer"
          >
            <SuchMarkierung text={treffer.title} wortlaut={woerter} aehnlich={varianten} />
          </button>

          {!kompakt && (
            <>
              {/* Die Fundstelle: Quelle klein und gesperrt, dann der Satz. */}
              {treffer.textstelle
                ? (
                  <p className="mt-1 text-[12px] leading-relaxed text-[var(--tf-text-secondary)]">
                    <span className="mr-1.5 text-[10px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">
                      {treffer.textstelle.quelle}
                    </span>
                    <SuchMarkierung
                      text={treffer.textstelle.text}
                      wortlaut={woerter}
                      aehnlich={varianten}
                    />
                  </p>
                )
                : treffer.snippet && (
                  <p className="mt-1 text-[12px] leading-relaxed text-[var(--tf-text-secondary)]">
                    <SuchMarkierung text={treffer.snippet} wortlaut={woerter} aehnlich={varianten} />
                  </p>
                )}

              {/* Trefferstellen-Tags. */}
              {felder.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {felder.map(f => (
                    <span
                      key={f}
                      className="inline-flex items-center gap-1 rounded-[5px] px-1.5 py-px text-[10.5px] text-[var(--tf-text-secondary)]"
                      style={{ border: '0.5px solid var(--tf-border)' }}
                    >
                      {TREFFERFELD_LABEL[f]}
                      {ZAEHLBAR.has(f) && (
                        <ZaehlungFuerFeld feld={f} treffer={treffer} woerter={woerter} />
                      )}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Begründung — klappt unter der Zeile auf. */}
          {ausgeklappt && (
            <div
              className="mt-2 rounded-[8px] px-2.5 py-2"
              style={{ background: 'var(--tf-desk)', border: '0.5px solid var(--tf-border)' }}
            >
              <div className="flex items-start gap-1.5">
                <Sparkles size={12} className="mt-0.5 shrink-0 text-[var(--tf-primary)]" aria-hidden />
                <p className="text-[12px] leading-relaxed text-[var(--tf-text-secondary)]">
                  {treffer.begruendung
                    ?? (begruendungLaeuft ? 'Begründung wird erzeugt …' : 'Noch keine Begründung.')}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <ZeilenAktion label="Antrag öffnen" icon={<ExternalLink size={11} />} onClick={onOeffnen} />
                <ZeilenAktion label="Ähnliche Anträge" icon={<Search size={11} />} onClick={onAehnliche} />
                <ZeilenAktion
                  label="Als unpassend melden"
                  icon={<ThumbsDown size={11} />}
                  onClick={onUnpassend}
                  title="Schickt eine Rückmeldung an das Feedback-Board. Das Ranking ändert sich dadurch nicht."
                />
              </div>
            </div>
          )}
        </div>

        {/* Rechte Spalte: Relevanz und „Warum?". */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StufenBalken
            stufe={stufe}
            label={RELEVANZ_LABEL[stufe]}
            title="Relevanz aus Fundstelle, Anzahl der Felder und Wort-Abdeckung"
          />
          <button
            type="button"
            onClick={onWarum}
            aria-expanded={ausgeklappt}
            className="inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[11px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <Sparkles size={11} aria-hidden />
            Warum?
            <ChevronDown
              size={11}
              aria-hidden
              className={ausgeklappt ? 'rotate-180 transition-transform' : 'transition-transform'}
            />
          </button>
        </div>
      </div>
    </li>
  );
}

/**
 * Die Zahl hinter einem Trefferstellen-Tag.
 *
 * Wird NUR für sichtbare Zeilen gerechnet — über 14 000 Einträge wäre das
 * Zählen der teuerste Teil der Suche, während die Feld-Zuordnung ohnehin
 * anfällt. Zeigt nichts, wenn der Text zur Fundstelle nicht vorliegt: eine
 * erfundene „1" wäre schlechter als keine Zahl.
 */
function ZaehlungFuerFeld({ feld, treffer, woerter }: {
  feld: Trefferfeld;
  treffer: UnifiedSearchResult;
  woerter: readonly string[];
}): React.ReactElement | null {
  const text = feld === 'titel' ? treffer.title
    : feld === 'dokument' ? (treffer.textstelle?.text ?? '')
      : feld === 'organisation' ? (treffer.antragsteller ?? '')
        : '';
  if (text.length === 0) return null;
  const n = zaehleVorkommen(text, woerter.map(w => w.toLowerCase()));
  if (n === 0) return null;
  return <span className="font-mono text-[10px] text-[var(--tf-text-tertiary)]">{n}</span>;
}

function ZeilenAktion({ label, icon, onClick, title }: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  title?: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1 rounded-[6px] px-2 py-1 text-[11.5px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
      style={{ background: 'var(--tf-sheet)', border: '0.5px solid var(--tf-border)' }}
    >
      {icon}
      {label}
    </button>
  );
}
