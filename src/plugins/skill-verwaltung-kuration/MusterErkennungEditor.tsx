import { useState } from 'react';
import {
  eingabeModusOf,
  kompiliereGruppe,
  erkennungsEintraege,
  type EingabeModus,
  type SynonymGruppe,
  type ErkennungsEintrag,
} from '@/core/services/skills';

/**
 * Editor des `verbotenes_muster`-Blocks: drei Eingabe-Modi (Phrasen / Synonym-
 * Gruppen / Regex), Synonym-Builder mit Varianten-Chips, ein modusunabhängiger
 * Live-Tester und die zwei KI-Hinweis-Felder. Die Match-Logik kommt AUSSCHLIESS-
 * LICH aus `erkennungsEintraege` (dieselbe Quelle wie die Check-Engine) — hier
 * gibt es keinen zweiten Matcher. Reine Konfiguration, kein API-Call.
 */

const FIELD_LABEL = 'block text-[10.5px] font-medium uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)] mb-2';
const INPUT_BASE = 'text-[13px] px-2.5 py-2 rounded-[8px] border-[0.5px] border-[var(--tf-border-hover)] bg-[var(--tf-bg)] text-[var(--tf-text)] outline-none focus:border-[var(--tf-primary)] disabled:opacity-70';
const TEXTAREA_BASE = 'w-full font-mono text-[12.5px] px-2.5 py-2 rounded-[8px] border-[0.5px] border-[var(--tf-border-hover)] bg-[var(--tf-bg)] text-[var(--tf-text)] outline-none focus:border-[var(--tf-primary)] disabled:opacity-70';

const MODI: { key: EingabeModus; label: string; hint: string }[] = [
  { key: 'phrasen', label: 'Phrasen', hint: 'Wörtliche Formulierungen (eine pro Zeile). Sonderzeichen werden automatisch entwertet — kein Regex nötig.' },
  { key: 'synonym', label: 'Synonym-Gruppen', hint: 'Ein Stamm + austauschbare Varianten — die App baut das Suchmuster daraus.' },
  { key: 'regex', label: 'Regex', hint: 'Für Experten: ein regulärer Ausdruck pro Zeile.' },
];

/* -------------------------------------------------------------------------- */
/* Reine Helfer (testbar, kein Render-Zustand)                                 */
/* -------------------------------------------------------------------------- */

/** `true`, wenn `quelle` ein gültiger regulärer Ausdruck ist (Silent-Fail-Schutz). */
export function istGueltigesRegex(quelle: string): boolean {
  try {
    new RegExp(quelle);
    return true;
  } catch {
    return false;
  }
}

export interface TrefferSegment {
  text: string;
  treffer: boolean;
}

/**
 * Markiert Treffer eines Beispieltexts gegen die Erkennungs-Einträge. Liefert
 * Segmente (Treffer/Nicht-Treffer, lückenlos = `text`) und die Anzahl
 * zusammengefasster Treffer-Spans. Nutzt die Regexe AUS `erkennungsEintraege`
 * (eine Quelle); zero-width-Matches werden übersprungen (kein Endlos-Loop).
 */
export function markiereTreffer(text: string, eintraege: ErkennungsEintrag[]): { segmente: TrefferSegment[]; anzahl: number } {
  if (!text) return { segmente: [], anzahl: 0 };
  const ranges: Array<[number, number]> = [];
  for (const e of eintraege) {
    const global = new RegExp(e.regex.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = global.exec(text)) !== null) {
      if (m[0] === '') {
        global.lastIndex++;
        continue;
      }
      ranges.push([m.index, m.index + m[0].length]);
    }
  }
  if (ranges.length === 0) return { segmente: [{ text, treffer: false }], anzahl: 0 };
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [];
  for (const [start, end] of ranges) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  const segmente: TrefferSegment[] = [];
  let pos = 0;
  for (const [start, end] of merged) {
    if (start > pos) segmente.push({ text: text.slice(pos, start), treffer: false });
    segmente.push({ text: text.slice(start, end), treffer: true });
    pos = end;
  }
  if (pos < text.length) segmente.push({ text: text.slice(pos), treffer: false });
  return { segmente, anzahl: merged.length };
}

function readMuster(params: Record<string, unknown>): string[] {
  const v = params.muster;
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function readGruppen(params: Record<string, unknown>): SynonymGruppe[] {
  const v = params.gruppen;
  if (!Array.isArray(v)) return [];
  return v
    .filter((g): g is Record<string, unknown> => typeof g === 'object' && g !== null)
    .map(g => ({
      stamm: typeof g.stamm === 'string' ? g.stamm : '',
      varianten: Array.isArray(g.varianten) ? g.varianten.filter((x): x is string => typeof x === 'string') : [],
    }));
}

function strOf(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/* -------------------------------------------------------------------------- */
/* Synonym-Gruppe (Stamm + Varianten-Chips + generiertes Muster)               */
/* -------------------------------------------------------------------------- */

function GruppeRow({ gruppe, disabled, onChange, onRemove }: {
  gruppe: SynonymGruppe;
  disabled: boolean;
  onChange: (g: SynonymGruppe) => void;
  onRemove: () => void;
}): React.ReactElement {
  const [varInput, setVarInput] = useState('');
  const addVariant = (): void => {
    const v = varInput.trim();
    if (!v) return;
    onChange({ ...gruppe, varianten: [...gruppe.varianten, v] });
    setVarInput('');
  };
  const generated = kompiliereGruppe(gruppe);

  return (
    <div className="rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] p-3 mb-2">
      <div className="flex items-center gap-2">
        <input
          value={gruppe.stamm}
          disabled={disabled}
          placeholder={'Stamm (z. B. „Der Antragsteller")'}
          onChange={e => onChange({ ...gruppe, stamm: e.target.value })}
          className={`${INPUT_BASE} flex-1 min-w-[180px]`}
        />
        {!disabled && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Gruppe entfernen"
            className="text-[12.5px] px-2 py-1.5 rounded-[6px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)]"
          >
            Gruppe entfernen
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
        {gruppe.varianten.map((v, i) => (
          <span key={i} className="inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded-[99px] bg-[var(--tf-primary-soft)] text-[var(--tf-text-secondary)]">
            {v}
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange({ ...gruppe, varianten: gruppe.varianten.filter((_, idx) => idx !== i) })}
                aria-label={`Variante „${v}" entfernen`}
                className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)]"
              >
                ×
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            value={varInput}
            placeholder="Variante + Enter"
            onChange={e => setVarInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addVariant();
              }
            }}
            className={`${INPUT_BASE} w-[150px]`}
          />
        )}
      </div>

      <div className="mt-2.5 text-[11px] text-[var(--tf-text-tertiary)]">
        Generiertes Muster:{' '}
        <code className="font-mono text-[11.5px] text-[var(--tf-text-secondary)]">{generated || '(leer)'}</code>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Haupt-Editor                                                                */
/* -------------------------------------------------------------------------- */

export function MusterErkennungEditor({ params, setParam, setParams, disabled }: {
  params: Record<string, unknown>;
  setParam: (key: string, value: unknown) => void;
  setParams: (patch: Record<string, unknown>) => void;
  disabled: boolean;
}): React.ReactElement {
  const modus = eingabeModusOf(params);
  const muster = readMuster(params);
  const gruppen = readGruppen(params);

  // Roh-Buffer für die Zeilen-Textareas (Phrasen/Regex), damit Tippen flüssig
  // bleibt; bei Modus-Wechsel fällt er auf den persistierten `muster`-Stand zurück.
  const [buf, setBuf] = useState<{ modus: EingabeModus; text: string }>(() => ({ modus, text: muster.join('\n') }));
  const bufText = buf.modus === modus ? buf.text : muster.join('\n');
  const onLinesChange = (raw: string): void => {
    setBuf({ modus, text: raw });
    setParam('muster', raw.split('\n').map(s => s.trim()).filter(Boolean));
  };

  const setGruppen = (next: SynonymGruppe[]): void => setParam('gruppen', next);

  const ungueltigeRegexZeilen = bufText
    .split('\n')
    .map((z, i) => ({ z: z.trim(), nr: i + 1 }))
    .filter(x => x.z.length > 0 && !istGueltigesRegex(x.z));

  const [testText, setTestText] = useState('');
  const { segmente, anzahl } = markiereTreffer(testText, erkennungsEintraege(params));

  const aktiverHint = MODI.find(m => m.key === modus)?.hint ?? '';

  return (
    <div className="mt-5">
      <label className={FIELD_LABEL}>Erkennung — verbotene Formulierungen</label>

      {/* Modus-Umschalter */}
      <div className="inline-flex gap-1.5">
        {MODI.map(m => (
          <button
            key={m.key}
            type="button"
            aria-pressed={modus === m.key}
            disabled={disabled}
            onClick={() => setParams({ eingabeModus: m.key, istRegex: m.key === 'regex' })}
            className={`text-[12px] px-[13px] py-[6px] rounded-[99px] border-[0.5px] disabled:opacity-70 ${modus === m.key ? 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)] border-transparent' : 'bg-transparent text-[var(--tf-text-secondary)] border-[var(--tf-border)]'}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-2 mb-3">{aktiverHint}</p>

      {/* Modus-spezifischer Block */}
      {modus === 'phrasen' && (
        <textarea
          rows={3}
          disabled={disabled}
          value={bufText}
          placeholder={'Eine Formulierung pro Zeile, z. B.\nDer Antragsteller plant'}
          onChange={e => onLinesChange(e.target.value)}
          className={TEXTAREA_BASE}
        />
      )}

      {modus === 'synonym' && (
        <div>
          {gruppen.length === 0 && (
            <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-2">Noch keine Gruppe — eine Gruppe = ein Stamm mit austauschbaren Varianten.</p>
          )}
          {gruppen.map((g, i) => (
            <GruppeRow
              key={i}
              gruppe={g}
              disabled={disabled}
              onChange={ng => setGruppen(gruppen.map((old, idx) => (idx === i ? ng : old)))}
              onRemove={() => setGruppen(gruppen.filter((_, idx) => idx !== i))}
            />
          ))}
          {!disabled && (
            <button
              type="button"
              onClick={() => setGruppen([...gruppen, { stamm: '', varianten: [] }])}
              className="text-[12.5px] px-[13px] py-[7px] rounded-[99px] border-[0.5px] border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:border-[var(--tf-border-hover)]"
            >
              + Gruppe
            </button>
          )}
        </div>
      )}

      {modus === 'regex' && (
        <div>
          <textarea
            rows={3}
            disabled={disabled}
            value={bufText}
            placeholder={'Ein regulärer Ausdruck pro Zeile, z. B.\n\\bAP\\s?\\d+'}
            onChange={e => onLinesChange(e.target.value)}
            className={`${TEXTAREA_BASE} ${ungueltigeRegexZeilen.length ? 'border-[var(--tf-danger-border)]' : ''}`}
          />
          {ungueltigeRegexZeilen.length > 0 && (
            <p className="text-[11.5px] text-[var(--tf-danger-text)] mt-1.5">
              Ungültiger Ausdruck in {ungueltigeRegexZeilen.length === 1 ? 'Zeile' : 'Zeilen'}{' '}
              {ungueltigeRegexZeilen.map(x => x.nr).join(', ')} — wird nicht greifen.
            </p>
          )}
        </div>
      )}

      {/* Live-Tester (modusunabhängig, dieselbe Engine-Quelle) */}
      <div className="mt-4 rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] p-3">
        <label className={FIELD_LABEL}>Live-Test — Beispieltext</label>
        <textarea
          rows={2}
          value={testText}
          placeholder="Beispieltext einfügen — Treffer werden markiert."
          onChange={e => setTestText(e.target.value)}
          className={`${TEXTAREA_BASE} font-sans`}
        />
        {testText && (
          <>
            <p className="text-[12px] mt-2 mb-1.5 text-[var(--tf-text-secondary)]">
              {anzahl > 0 ? `${anzahl} ${anzahl === 1 ? 'Treffer' : 'Treffer'} → Regel würde anschlagen.` : 'Keine Treffer.'}
            </p>
            <div className="text-[12.5px] leading-[1.6] text-[var(--tf-text)] whitespace-pre-wrap">
              {segmente.map((s, i) =>
                s.treffer ? (
                  <span key={i} className="rounded-[3px] px-0.5 bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]">{s.text}</span>
                ) : (
                  <span key={i}>{s.text}</span>
                ),
              )}
            </div>
          </>
        )}
      </div>

      {/* KI-Hinweis — zweiseitig (vermeiden / stattdessen) */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={FIELD_LABEL}>KI-Hinweis · Vermeiden</label>
          <textarea
            rows={2}
            disabled={disabled}
            value={strOf(params.hinweisVermeiden)}
            placeholder="z. B. Passiv-Formulierungen und Floskeln"
            onChange={e => setParam('hinweisVermeiden', e.target.value)}
            className={`${TEXTAREA_BASE} font-sans`}
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>KI-Hinweis · Stattdessen</label>
          <textarea
            rows={2}
            disabled={disabled}
            value={strOf(params.hinweisStattdessen)}
            placeholder="z. B. aktiv und konkret"
            onChange={e => setParam('hinweisStattdessen', e.target.value)}
            className={`${TEXTAREA_BASE} font-sans`}
          />
        </div>
      </div>
    </div>
  );
}
