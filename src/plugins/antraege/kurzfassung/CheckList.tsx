/**
 * Prüf-Ergebnis-Checkliste. Zwei Modi:
 *  - OHNE `aktion` (Default): rein typografische Zeilen (Glyph + Label + Detail) —
 *    byte-identisch zum Bestand. Genutzt von ReviewCard/VersionVerlauf/QsHinweisList.
 *  - MIT `aktion` (nur Gutachten-Prüfpanel, KontextPanel): Mockup-Schweregrad-
 *    Darstellung — `ok` grüner Haken, `hinweis` amber Punkt, `fehler` als zarte
 *    Karte mit Messwert/Limit + Inline-KI-Korrektur-Button (`regelKorrekturAnweisung`).
 */
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  regelKorrekturAnweisung, regelLimit,
  type CheckResult, type QualitaetsRegel, type RegelKorrektur,
} from '@/core/services/skills';
import { zyklischerIndex } from '../gutachten/satzSegmente';

/**
 * Aktions-Bündel des Prüfpanels (opt-in). Nur der Gutachten-`KontextPanel` reicht
 * es durch; ohne `aktion` bleibt das Rendering unverändert.
 */
export interface CheckListAktion {
  /** Löst die zum Check gehörende Regel auf (Titel + Korrektur-Ableitung). */
  regelFor: (c: CheckResult) => QualitaetsRegel | null;
  /** Regel-gebundenen KI-Korrektur-Lauf starten. */
  onKorrektur: (c: CheckResult, korrektur: RegelKorrektur) => void;
  /** KI derzeit nicht möglich (offline/busy) → Button disabled. */
  genDisabled: boolean;
  /** Ein Lauf läuft → Button Spinner + disabled. */
  busy: boolean;
  /** Sprung zum beanstandeten Satz im Entwurf (nur bei lokalisierbaren Befunden). */
  onFundstelle?: (satzIndex: number) => void;
}

/** „Anzeigen"-Link — springt zyklisch durch die Fundstellen eines Befunds. */
function AnzeigenLink({ fundstellen, onFundstelle, className = '' }: {
  fundstellen: NonNullable<CheckResult['fundstellen']>;
  onFundstelle: (satzIndex: number) => void;
  className?: string;
}): React.ReactElement {
  const [cursor, setCursor] = useState(0);
  const n = fundstellen.length;
  return (
    <button
      type="button"
      className={`shrink-0 text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:underline ${className}`}
      onClick={() => { onFundstelle(fundstellen[zyklischerIndex(cursor, n)]!.satzIndex); setCursor(c => c + 1); }}
    >
      {n > 1 ? `Anzeigen (${n})` : 'Anzeigen'}
    </button>
  );
}

function glyph(level: CheckResult['level']): { char: string; cls: string } {
  if (level === 'ok') return { char: '✓', cls: 'text-[var(--tf-success-text)]' };
  if (level === 'hinweis') return { char: '!', cls: 'text-[var(--tf-warning-text)]' };
  return { char: '!', cls: 'text-[var(--tf-danger-text)]' };
}

/** Plain-Zeile (Bestandsdarstellung) — Glyph + Label + optionales Detail. */
function PlainZeile({ c }: { c: CheckResult }): React.ReactElement {
  const g = glyph(c.level);
  return (
    <div>
      <div className="flex items-baseline gap-2.5 text-[13px] text-[var(--tf-text)]">
        <span className={`w-3.5 shrink-0 text-center ${g.cls}`}>{g.char}</span>
        <span>{c.label}</span>
      </div>
      {c.detail && (
        <div className="ml-[23px] mt-0.5 text-[12px] text-[var(--tf-text-secondary)]">{c.detail}</div>
      )}
    </div>
  );
}

/** Enriched ok/hinweis-Zeile — grüner Haken bzw. amber Punkt (Mockup). */
function AmpelZeile({ c, aktion }: { c: CheckResult; aktion: CheckListAktion }): React.ReactElement {
  const ok = c.level === 'ok';
  const fundstellen = c.fundstellen ?? [];
  const hatFund = !!aktion.onFundstelle && fundstellen.length > 0;
  // Lokalisierbarer Befund (z.B. Passiv-Floskel): Titel aus Regel-Name + Anzahl,
  // sonst das Engine-Label.
  const regel = hatFund ? aktion.regelFor(c) : null;
  const titel = hatFund && regel
    ? `${regel.name} — ${fundstellen.length} ${fundstellen.length === 1 ? 'Stelle' : 'Stellen'}`
    : c.label;
  return (
    <div>
      <div className="flex items-baseline gap-2.5 text-[13px] text-[var(--tf-text)]">
        <span className={`w-3.5 shrink-0 text-center ${ok ? 'text-[var(--tf-success-text)]' : 'text-[var(--tf-warning-text)]'}`}>
          {ok ? '✓' : '•'}
        </span>
        <span>{titel}</span>
        {hatFund && <AnzeigenLink fundstellen={fundstellen} onFundstelle={aktion.onFundstelle!} className="ml-auto" />}
      </div>
      {c.detail && (
        <div className="ml-[23px] mt-0.5 text-[12px] text-[var(--tf-text-secondary)]">{c.detail}</div>
      )}
    </div>
  );
}

/** Enriched Fehler-Karte — zarter roter Rahmen, Messwert/Limit mono, KI-Aktion. */
function FehlerKarte({ c, aktion }: { c: CheckResult; aktion: CheckListAktion }): React.ReactElement {
  const regel = aktion.regelFor(c);
  const korrektur = regel ? regelKorrekturAnweisung(c, regel) : null;
  const limit = regel ? regelLimit(regel, c.richtung) : null;
  const titel = regel?.name ?? c.label;
  const mono = c.messwert != null && limit != null ? `${c.messwert} / ${limit}` : null;
  const fundstellen = c.fundstellen ?? [];
  const hatFund = !!aktion.onFundstelle && fundstellen.length > 0;
  return (
    <div className="rounded-[8px] border-[0.5px] border-[var(--tf-danger-border)] bg-[var(--tf-danger-soft)] px-3 py-2.5">
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 font-semibold text-[var(--tf-danger-text)]">!</span>
        <span className="text-[13px] font-medium text-[var(--tf-text)]">{titel}</span>
        {mono && <span className="ml-auto shrink-0 font-mono text-[12px] text-[var(--tf-danger-text)]">{mono}</span>}
      </div>
      {c.detail && <div className="mt-1 text-[12px] text-[var(--tf-text-secondary)]">{c.detail}</div>}
      {(korrektur || hatFund) && (
        <div className="mt-2 flex items-center gap-3">
          {korrektur && (
            <button
              type="button"
              className="g-btn ghost sm"
              disabled={aktion.busy || aktion.genDisabled}
              onClick={() => aktion.onKorrektur(c, korrektur)}
              title={aktion.genDisabled ? 'KI nicht erreichbar' : korrektur.anweisung}
            >
              {aktion.busy
                ? <span className="w-3 h-3 rounded-full border-[1.5px] border-current border-t-transparent animate-spin" />
                : <Sparkles size={13} />}
              {korrektur.label}
            </button>
          )}
          {hatFund && (
            <AnzeigenLink
              fundstellen={fundstellen}
              onFundstelle={aktion.onFundstelle!}
              className={korrektur ? '' : 'ml-auto'}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function CheckList({ checks, aktion }: { checks: CheckResult[]; aktion?: CheckListAktion }): React.ReactElement | null {
  if (checks.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      {checks.map(c => {
        if (!aktion) return <PlainZeile key={c.id} c={c} />;
        return c.level === 'fehler'
          ? <FehlerKarte key={c.id} c={c} aktion={aktion} />
          : <AmpelZeile key={c.id} c={c} aktion={aktion} />;
      })}
    </div>
  );
}
