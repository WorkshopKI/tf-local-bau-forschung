/**
 * Tweak-Editor (User-Tweaks v2) — zentrierter Dialog nach Design-Handoff
 * `workflow-mit-bearbeiten` (Stil-Modal): Master-Toggle, Preset-Chips, zwei
 * Freitextfelder, visuelle „So wird kombiniert"-Schichtung (Ihr Stil → gesperrte
 * Kurator-Vorgaben) und eine ausklappbare „Technische Ansicht" (Roh-Prompt).
 *
 * Der Nutzer ergänzt den Skill um eine persönliche Stil-Schicht; die formalen
 * Vorgaben des Kurators bleiben unverändert wirksam und werden weiter geprüft.
 * Die Rangfolge (Tweak VOR Vorgaben) ist fix; Quelle der Vorschau ist
 * `buildTweakBlock` + `buildPromptVorgaben` (eine Quelle, keine Drift).
 */
import { useMemo, useState } from 'react';
import { Lock, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { buildTweakBlock, buildPromptVorgaben, TWEAK_FELD_MAX, type QualitaetsRegel, type SkillTweak } from '@/core/services/skills';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import type { TweakEingabe } from './useKurzfassung';

interface Props {
  skillVersion: number;
  /** Abschnitts-Label für den Kopf-Pill (z.B. „C — Technische Risiken"). Optional. */
  sektionLabel?: string;
  regeln: QualitaetsRegel[];
  tweak: SkillTweak | null;
  onClose: () => void;
  onSave: (eingabe: TweakEingabe) => Promise<void>;
  onRemove: () => Promise<void>;
}

const TA = 'w-full resize-none block text-[13px] leading-[1.6] text-[var(--tf-text)] bg-transparent border-[0.5px] border-[var(--tf-border)] rounded-[9px] px-3 py-2.5 outline-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)]';
const PRESETS = ['Sachlich & zurückhaltend', 'Keine Superlative', 'Mehr Konjunktiv', 'Kürzere Sätze'];

export function TweakEditor({ skillVersion, sektionLabel, regeln, tweak, onClose, onSave, onRemove }: Props): React.ReactElement {
  const [stilHinweise, setStilHinweise] = useState(tweak?.stilHinweise ?? '');
  const [beispiele, setBeispiele] = useState(tweak?.beispielFormulierungen ?? '');
  const [aktiv, setAktiv] = useState(tweak?.aktiv ?? true);
  const [techOpen, setTechOpen] = useState(false);

  const tweakBlock = useMemo(() => buildTweakBlock(stilHinweise, beispiele), [stilHinweise, beispiele]);
  const vorgaben = useMemo(() => buildPromptVorgaben(regeln), [regeln]);
  const hatAngaben = aktiv && (stilHinweise.trim().length > 0 || beispiele.trim().length > 0);

  const save = useAsyncAction(
    async () => { await onSave({ stilHinweise, beispielFormulierungen: beispiele, aktiv }); },
    { onSuccess: onClose },
  );
  const remove = useAsyncAction(async () => { await onRemove(); }, { onSuccess: onClose });

  // Preset-Chip → Punkt-getrennt in die Stil-Hinweise einfügen (Logik aus dem Handoff-Prototyp).
  const addPreset = (t: string): void => {
    setStilHinweise(h => (!h.trim() ? `${t}.` : `${h.replace(/\s*$/, '').replace(/\.?$/, '. ')}${t}.`));
  };

  const techRaw = [
    aktiv && tweakBlock ? tweakBlock : '# Persönlicher Stil (optional)\n— keine Angaben —',
    `# Formale Vorgaben des Kurators (unveränderlich, werden geprüft)\n${vorgaben || '— keine aktiven Qualitätsregeln —'}`,
  ].join('\n\n');

  const title = (
    <span className="flex items-center gap-2.5 flex-wrap">
      Persönlicher Stil
      {sektionLabel && (
        <span className="h-[22px] inline-flex items-center px-2.5 rounded-full bg-[var(--tf-bg-secondary)] border-[0.5px] border-[var(--tf-border)] text-[11.5px] font-medium text-[var(--tf-text-secondary)]">
          {sektionLabel}
        </span>
      )}
    </span>
  );

  const footer = (
    <>
      <span className="mr-auto text-[11px] font-mono text-[var(--tf-text-tertiary)]">Skill-Version {skillVersion} · gespeichert lokal</span>
      {tweak && (
        <Button
          variant="ghost"
          onClick={() => remove.run()}
          loading={remove.busy}
          disabled={save.busy}
          className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] mr-1"
        >
          Entfernen
        </Button>
      )}
      <Button variant="ghost" onClick={onClose}>
        Abbrechen
      </Button>
      <Button
        variant="primary"
        onClick={() => save.run()}
        loading={save.busy}
        disabled={remove.busy}
      >
        Speichern
      </Button>
    </>
  );

  return (
    <Dialog open onClose={onClose} title={title} footer={footer} size="lg" className="max-w-[560px]" dismissOnOverlayClick={false}>
      {/* Master-Toggle */}
      <div className="flex items-start gap-3 px-3.5 py-3.5 bg-[var(--tf-bg-secondary)] rounded-[10px]">
        <Switch on={aktiv} onChange={setAktiv} label="Persönlichen Stil verwenden" />
        <span className="flex flex-col gap-1">
          <b className="text-[13.5px] font-medium leading-[1.3] text-[var(--tf-text)]">Persönlichen Stil verwenden</b>
          <span className="text-[12.5px] leading-[1.5] text-[var(--tf-text-tertiary)]">Ergänzt den Skill. Die formalen Vorgaben des Kurators bleiben aktiv und werden weiterhin geprüft.</span>
        </span>
      </div>

      {/* Felder */}
      <div className={`flex flex-col gap-[18px] mt-[18px] transition-opacity ${aktiv ? '' : 'opacity-40 pointer-events-none'}`}>
        <div>
          <div className="text-[13px] font-medium text-[var(--tf-text)] mb-1.5">Tonalität &amp; Hinweise</div>
          <div className="flex gap-1.5 flex-wrap mb-2">
            {PRESETS.map(t => (
              <button
                key={t}
                type="button"
                disabled={!aktiv}
                onClick={() => addPreset(t)}
                className="h-[26px] px-2.5 rounded-full border-[0.5px] border-[var(--tf-border-hover)] bg-[var(--tf-bg)] text-[12px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-primary-light)] hover:text-[var(--tf-primary)] hover:border-transparent disabled:opacity-60"
              >
                + {t}
              </button>
            ))}
          </div>
          <textarea
            rows={4}
            maxLength={TWEAK_FELD_MAX}
            disabled={!aktiv}
            className={TA}
            value={stilHinweise}
            onChange={e => setStilHinweise(e.target.value)}
            placeholder="z. B. sachlich und zurückhaltend formulieren, keine Superlative aus dem Antrag übernehmen."
          />
          <Counter value={stilHinweise} />
        </div>

        <div>
          <div className="text-[13px] font-medium text-[var(--tf-text)] mb-1">Eigene Beispiel-Formulierungen</div>
          <p className="text-[12px] leading-[1.45] text-[var(--tf-text-tertiary)] mt-0 mb-2">
            Typische Satzanfänge oder Textbausteine. Werden der KI als Stil-Beispiel mitgegeben, nicht wörtlich übernommen.
          </p>
          <textarea
            rows={4}
            maxLength={TWEAK_FELD_MAX}
            disabled={!aktiv}
            className={TA}
            value={beispiele}
            onChange={e => setBeispiele(e.target.value)}
            placeholder={'z. B. „Eine wesentliche Herausforderung des Vorhabens besteht …"'}
          />
          <Counter value={beispiele} />
        </div>
      </div>

      {/* So wird kombiniert */}
      <div className="mt-[18px] pt-[15px] border-t-[0.5px] border-[var(--tf-border)]">
        <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] mb-3">So wird kombiniert</div>

        <div className="flex items-center gap-3 px-3.5 py-3 rounded-[10px] bg-[var(--tf-primary-light)]">
          <span className="w-6 h-6 flex-shrink-0 rounded-full bg-[var(--tf-bg)] inline-flex items-center justify-center text-[12px] font-medium text-[var(--tf-text)]">1</span>
          <span className="flex flex-col gap-0.5">
            <b className="text-[13px] font-medium leading-[1.3] text-[var(--tf-text)]">Ihr persönlicher Stil</b>
            <span className="text-[11.5px] leading-[1.3] text-[var(--tf-text-tertiary)]">{hatAngaben ? 'Ihre Hinweise & Beispiele' : 'noch keine Angaben'}</span>
          </span>
        </div>

        <div className="flex justify-center text-[var(--tf-text-tertiary)] py-1"><ArrowDown size={16} /></div>

        <div className="flex items-center gap-3 px-3.5 py-3 rounded-[10px] bg-[var(--tf-bg-secondary)]">
          <span className="w-6 h-6 flex-shrink-0 rounded-full bg-[var(--tf-text)] text-[var(--tf-bg)] inline-flex items-center justify-center">
            <Lock size={12} />
          </span>
          <span className="flex flex-col gap-0.5">
            <b className="text-[13px] font-medium leading-[1.3] text-[var(--tf-text)]">Formale Vorgaben des Kurators</b>
            <span className="text-[11.5px] leading-[1.3] text-[var(--tf-text-tertiary)]">unveränderlich · wird geprüft</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setTechOpen(o => !o)}
          className="mt-3 text-[12px] text-[var(--tf-primary)] underline underline-offset-2 hover:opacity-80"
        >
          {techOpen ? 'Technische Ansicht ausblenden' : 'Technische Ansicht anzeigen'}
        </button>
        {techOpen && (
          <pre className="mt-2.5 p-3 bg-[var(--tf-bg-secondary)] border-[0.5px] border-[var(--tf-border)] rounded-[9px] font-mono text-[11.5px] leading-[1.6] text-[var(--tf-text-secondary)] whitespace-pre-wrap">{techRaw}</pre>
        )}
      </div>

      {(save.error || remove.error) && (
        <div className="mt-3 rounded-[8px] px-3 py-2 text-[12px] text-[var(--tf-danger-text)] bg-[var(--tf-danger-bg)]">
          {save.error ?? remove.error}
        </div>
      )}
    </Dialog>
  );
}

/** Toggle-Switch (38×22) — grün bei „an", Knopf gleitet nach rechts. */
function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative flex-shrink-0 w-[38px] h-[22px] rounded-full transition-colors ${on ? 'bg-[var(--tf-success-text)]' : 'bg-[var(--tf-border-hover)]'}`}
    >
      <span className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-[left] ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}

function Counter({ value }: { value: string }): React.ReactElement {
  const atMax = value.length >= TWEAK_FELD_MAX;
  return (
    <div className={`mt-1 text-right text-[11px] font-mono ${atMax ? 'text-[var(--tf-warning-text)]' : 'text-[var(--tf-text-tertiary)]'}`}>
      {value.length.toLocaleString('de-DE')} / {TWEAK_FELD_MAX.toLocaleString('de-DE')}
    </div>
  );
}
