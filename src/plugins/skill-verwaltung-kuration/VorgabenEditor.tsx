/**
 * Sektion „Umfang & Form" des Skill-Editors — die skill-eigenen Vorgaben, die
 * früher als Ein-Skill-Regeln in der geteilten Bibliothek lagen.
 *
 * Zwei Modi in EINER Komponente, weil beide dieselbe Zeile zeigen sollen:
 *  - `modus: 'team'`   — Kurator schaltet Vorgaben an/aus, setzt Werte,
 *                        Schweregrad und die Freigabe „persönlich anpassbar".
 *  - `modus: 'persoenlich'` — jeder Nutzer verschiebt die Zahlen der FREIGEGEBENEN
 *                        Vorgaben für sich; gesperrte Zeilen zeigen den Team-Wert
 *                        mit Schloss. Schweregrad und Freigabe sind hier tabu.
 *
 * Eigene Datei statt Einbau in `SkillEditor.tsx`: der Editor trägt bereits
 * Prompt, Slots, Transport-Policy, Modifikatoren, Regeln, Kategorie und Reifegrad.
 */
import { Lock } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  VORGABE_KEYS,
  VORGABE_NAME,
  istUeberschreibbar,
  type PersoenlicheVorgaben,
  type Schweregrad,
  type SkillVorgaben,
  type VorgabeKey,
} from '@/core/services/skills';

/** Zahlenfelder je Vorgabe: `[Param-Schlüssel, Label]`. Leer = kein Zahlenwert. */
const FELDER: Record<VorgabeKey, [string, string][]> = {
  wortanzahl: [['min', 'von'], ['max', 'bis']],
  satzanzahl: [['min', 'von'], ['max', 'bis']],
  zeichenMax: [['max', 'höchstens']],
  absatzMin: [['min', 'mindestens']],
  satzlaengeMax: [['maxWoerter', 'höchstens']],
  keineAufzaehlungen: [],
  pflichtAnfang: [],
};

/** Einheit hinter den Zahlenfeldern (reine Beschriftung). */
const EINHEIT: Record<VorgabeKey, string> = {
  wortanzahl: 'Wörter',
  satzanzahl: 'Sätze',
  zeichenMax: 'Zeichen',
  absatzMin: 'Absätze',
  satzlaengeMax: 'Wörter je Satz',
  keineAufzaehlungen: '',
  pflichtAnfang: '',
};

/** Startwerte beim Einschalten einer Vorgabe. */
const START: Record<VorgabeKey, SkillVorgaben[VorgabeKey]> = {
  wortanzahl: { schweregrad: 'fehler', min: 300, max: 350 },
  satzanzahl: { schweregrad: 'fehler', min: 8, max: 12 },
  zeichenMax: { schweregrad: 'fehler', max: 1000 },
  absatzMin: { schweregrad: 'fehler', min: 2 },
  satzlaengeMax: { schweregrad: 'hinweis', maxWoerter: 25 },
  keineAufzaehlungen: { schweregrad: 'fehler' },
  pflichtAnfang: { schweregrad: 'fehler', text: '' },
};

const ERKLAERUNG: Record<VorgabeKey, string> = {
  wortanzahl: 'Zielumfang des finalen Textes in Wörtern.',
  satzanzahl: 'Zielumfang des finalen Textes in Sätzen.',
  zeichenMax: 'Harte Obergrenze inklusive Leerzeichen.',
  absatzMin: 'Mindestzahl der durch Leerzeile getrennten Absätze.',
  satzlaengeMax: 'Obergrenze je einzelnem Satz — hält die Sätze lesbar.',
  keineAufzaehlungen: 'Der finale Text ist Fließtext; Spiegelstriche und Nummerierungen sind unzulässig.',
  pflichtAnfang: 'Wortlaut, mit dem der finale Text beginnen muss.',
};

const ZAHL_CLS =
  'w-[72px] rounded-[7px] border-[0.5px] border-[var(--tf-border)] bg-transparent px-2 py-1 '
  + 'text-[12.5px] text-[var(--tf-text)] outline-none focus:border-[var(--tf-primary)] disabled:opacity-60';

interface Props {
  modus: 'team' | 'persoenlich';
  /** Team-Stand (Kurator). Im persönlichen Modus die unveränderliche Referenz. */
  vorgaben: SkillVorgaben | undefined;
  /** Nur `modus: 'persoenlich'` — die eigenen Werte. */
  override?: PersoenlicheVorgaben;
  /** Im Team-Modus: Kurator-Schreibrecht. Im persönlichen Modus immer erlaubt. */
  canEdit: boolean;
  onChangeVorgaben?: (next: SkillVorgaben) => void;
  onChangeOverride?: (next: PersoenlicheVorgaben) => void;
}

export function VorgabenEditor({
  modus, vorgaben, override, canEdit, onChangeVorgaben, onChangeOverride,
}: Props): React.ReactElement {
  const team = vorgaben ?? {};

  const setzeVorgabe = (key: VorgabeKey, patch: Record<string, unknown> | null): void => {
    if (!onChangeVorgaben) return;
    const next: SkillVorgaben = { ...team };
    if (patch === null) delete next[key];
    else (next[key] as unknown) = { ...(next[key] ?? START[key]), ...patch };
    onChangeVorgaben(next);
  };

  const setzeOverride = (key: VorgabeKey, feld: string, wert: number | undefined): void => {
    if (!onChangeOverride) return;
    const aktuell = (override ?? {}) as Record<string, Record<string, unknown> | undefined>;
    const eintrag = { ...(aktuell[key] ?? {}) };
    if (wert === undefined) delete eintrag[feld];
    else eintrag[feld] = wert;
    const next = { ...aktuell };
    if (Object.keys(eintrag).length === 0) delete next[key];
    else next[key] = eintrag;
    onChangeOverride(next as PersoenlicheVorgaben);
  };

  // Im persönlichen Modus nur Zeilen zeigen, die es im Team-Stand gibt — der
  // Nutzer kann Vorgaben verschieben, aber keine erfinden.
  const zeilen = modus === 'team'
    ? VORGABE_KEYS
    : VORGABE_KEYS.filter(k => team[k] !== undefined);

  if (zeilen.length === 0) {
    return (
      <p className="text-[12.5px] text-[var(--tf-text-tertiary)] py-2">
        Für diesen Skill sind keine Umfangs-Vorgaben hinterlegt.
      </p>
    );
  }

  return (
    <div className="border-t-[0.5px] border-[var(--tf-border)]">
      {zeilen.map(key => {
        const wert = team[key];
        const an = wert !== undefined;
        const frei = wert?.persoenlichAnpassbar === true && istUeberschreibbar(key);
        const gesperrt = modus === 'persoenlich' && !frei;
        const eigen = (override ?? {})[key as keyof PersoenlicheVorgaben] as Record<string, number> | undefined;

        return (
          <div
            key={key}
            className="flex items-center gap-3 flex-wrap py-2.5 border-b-[0.5px] border-[var(--tf-border)]"
          >
            {modus === 'team' ? (
              <TogglePill
                an={an}
                label={VORGABE_NAME[key]}
                disabled={!canEdit}
                onClick={() => setzeVorgabe(key, an ? null : { ...START[key] })}
              />
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--tf-text)] min-w-[150px]">
                {gesperrt && <Lock size={12} className="text-[var(--tf-text-tertiary)]" />}
                {VORGABE_NAME[key]}
              </span>
            )}

            {an && FELDER[key].map(([feld, label]) => {
              const teamWert = (wert as unknown as Record<string, number | undefined>)[feld];
              const anzeige = modus === 'persoenlich' ? (eigen?.[feld] ?? teamWert) : teamWert;
              return (
                <label key={feld} className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--tf-text-tertiary)]">
                  {label}
                  <input
                    type="number"
                    className={ZAHL_CLS}
                    value={anzeige ?? ''}
                    disabled={modus === 'team' ? !canEdit : gesperrt}
                    onChange={e => {
                      const roh = e.target.value.trim();
                      const zahl = roh === '' ? undefined : Number(roh);
                      if (zahl !== undefined && !Number.isFinite(zahl)) return;
                      if (modus === 'team') setzeVorgabe(key, { [feld]: zahl });
                      else setzeOverride(key, feld, zahl);
                    }}
                  />
                </label>
              );
            })}
            {an && EINHEIT[key] && (
              <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">{EINHEIT[key]}</span>
            )}

            {an && key === 'pflichtAnfang' && modus === 'team' && (
              <input
                value={(wert as { text?: string }).text ?? ''}
                disabled={!canEdit}
                placeholder="Wortlaut, mit dem der finale Text beginnt…"
                onChange={e => setzeVorgabe(key, { text: e.target.value })}
                className="flex-1 min-w-[220px] rounded-[7px] border-[0.5px] border-[var(--tf-border)] bg-transparent px-2 py-1 text-[12.5px] text-[var(--tf-text)] outline-none focus:border-[var(--tf-primary)] disabled:opacity-60"
              />
            )}

            <span className="flex-1" />

            {an && modus === 'team' && (
              <>
                <SchweregradWahl
                  wert={wert!.schweregrad}
                  disabled={!canEdit}
                  onChange={s => setzeVorgabe(key, { schweregrad: s })}
                />
                {istUeberschreibbar(key) && (
                  <Tooltip
                    text="Freigegeben: jeder Nutzer darf diesen Wert für sich verschieben (gespeichert in seinem persönlichen Ordner). Der Schweregrad bleibt in jedem Fall Ihre Vorgabe."
                    maxWidth={340}
                  >
                    <label className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--tf-text-secondary)] cursor-help">
                      <input
                        type="checkbox"
                        checked={wert!.persoenlichAnpassbar === true}
                        disabled={!canEdit}
                        onChange={e => setzeVorgabe(key, { persoenlichAnpassbar: e.target.checked || undefined })}
                        className="accent-[var(--tf-primary)]"
                      />
                      persönlich anpassbar
                    </label>
                  </Tooltip>
                )}
              </>
            )}

            {modus === 'persoenlich' && gesperrt && (
              <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">vom Kurator festgelegt</span>
            )}
            {modus === 'persoenlich' && frei && eigen && Object.keys(eigen).length > 0 && (
              <button
                type="button"
                onClick={() => onChangeOverride?.(entferne(override, key))}
                className="text-[11.5px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]"
              >
                zurücksetzen
              </button>
            )}

            {modus === 'team' && !an && (
              <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">{ERKLAERUNG[key]}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Entfernt genau einen Eintrag aus dem Override (rein). */
function entferne(override: PersoenlicheVorgaben | undefined, key: VorgabeKey): PersoenlicheVorgaben {
  const next = { ...(override ?? {}) } as Record<string, unknown>;
  delete next[key];
  return next as PersoenlicheVorgaben;
}

/** An/Aus-Pille mit KONSTANTER Breite (Häkchen via `invisible`, siehe DESIGN_GUIDE Kap. 5). */
function TogglePill({ an, label, disabled, onClick }: {
  an: boolean; label: string; disabled: boolean; onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-pressed={an}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 min-w-[150px] text-[12.5px] px-[11px] py-[5px] rounded-[99px] border-[0.5px] transition-colors disabled:opacity-60 ${
        an
          ? 'border-transparent bg-[var(--tf-primary)] text-white'
          : 'border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:border-[var(--tf-border-hover)]'
      }`}
    >
      <span className={an ? '' : 'invisible'}>✓</span>
      {label}
    </button>
  );
}

/** Fehler/Hinweis als Zwei-Segment-Wahl (kein Dropdown für zwei Werte). */
function SchweregradWahl({ wert, disabled, onChange }: {
  wert: Schweregrad; disabled: boolean; onChange: (s: Schweregrad) => void;
}): React.ReactElement {
  return (
    <span className="inline-flex rounded-[7px] border-[0.5px] border-[var(--tf-border)] overflow-hidden">
      {(['fehler', 'hinweis'] as Schweregrad[]).map(s => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onChange(s)}
          className={`text-[11.5px] px-2.5 py-1 transition-colors disabled:opacity-60 ${
            wert === s
              ? 'bg-[var(--tf-primary)] text-white'
              : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
          }`}
        >
          {s === 'fehler' ? 'Fehler' : 'Hinweis'}
        </button>
      ))}
    </span>
  );
}
