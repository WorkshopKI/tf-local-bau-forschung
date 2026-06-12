/**
 * Tweak-Editor (User-Tweaks v2) — Slide-Over rechts, nach
 * `_design/handoff/persoenlicher-stil/mockup-tweak-editor.html`.
 *
 * Der Nutzer ergänzt den Skill um eine persönliche Stil-Schicht (Stil-Hinweise +
 * eigene Beispiel-Formulierungen). Die schreibgeschützte Vorschau „So wird es
 * der KI mitgegeben" zeigt NUR die Schichtung — den eigenen Tweak-Block (live)
 * + die ausgegrauten formalen Vorgaben des Kurators — NICHT den vollen
 * Kurator-Prompt. Die Rangfolge (Tweak VOR Vorgaben) ist fix.
 */
import { useMemo, useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { buildTweakBlock } from '@/core/services/skills';
import { buildPromptVorgaben, type QualitaetsRegel } from '@/core/services/skill-registry';
import { TWEAK_FELD_MAX, type SkillTweak } from '@/core/services/skill-tweaks';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import type { TweakEingabe } from './useKurzfassung';

interface Props {
  skillVersion: number;
  regeln: QualitaetsRegel[];
  tweak: SkillTweak | null;
  onClose: () => void;
  onSave: (eingabe: TweakEingabe) => Promise<void>;
  onRemove: () => Promise<void>;
}

const TA = 'w-full resize-none block text-[13px] leading-[1.6] text-[var(--tf-text)] bg-transparent border-[0.5px] border-[var(--tf-border)] rounded-[8px] px-3 py-2.5 outline-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)]';

export function TweakEditor({ skillVersion, regeln, tweak, onClose, onSave, onRemove }: Props): React.ReactElement {
  const [stilHinweise, setStilHinweise] = useState(tweak?.stilHinweise ?? '');
  const [beispiele, setBeispiele] = useState(tweak?.beispielFormulierungen ?? '');
  const [aktiv, setAktiv] = useState(tweak?.aktiv ?? true);
  const [previewOpen, setPreviewOpen] = useState(true);

  const tweakBlock = useMemo(() => buildTweakBlock(stilHinweise, beispiele), [stilHinweise, beispiele]);
  const vorgaben = useMemo(() => buildPromptVorgaben(regeln), [regeln]);

  const save = useAsyncAction(
    async () => { await onSave({ stilHinweise, beispielFormulierungen: beispiele, aktiv }); },
    { onSuccess: onClose },
  );
  const remove = useAsyncAction(async () => { await onRemove(); }, { onSuccess: onClose });

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-label="Persönlicher Stil — Gutachten-Kurzfassung" // allow-raw-modal: Drawer-Pattern (rechtsbündig)
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.38)' }} onClick={onClose} />
      <aside
        className="relative h-full w-[520px] max-w-[94%] bg-[var(--tf-bg)] border-l-[0.5px] border-[var(--tf-border)] flex flex-col"
        style={{ boxShadow: '-8px 0 30px rgba(0,0,0,0.12)' }}
      >
        {/* Kopf */}
        <div className="px-[26px] pt-[22px] pb-[18px] border-b-[0.5px] border-[var(--tf-border)]">
          <div className="flex items-start gap-3">
            <h2 className="text-[16px] font-medium leading-[1.35] m-0 tracking-[-0.005em]">Persönlicher Stil — Gutachten-Kurzfassung</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Schließen"
              className="ml-auto flex-shrink-0 w-[26px] h-[26px] inline-flex items-center justify-center rounded-[6px] text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]"
            >
              <X size={15} />
            </button>
          </div>
          <p className="text-[13px] leading-[1.5] text-[var(--tf-text-secondary)] mt-2 mb-0">
            Ihre persönliche Ergänzung zum Skill. Die formalen Vorgaben des Kurators gelten weiterhin.
          </p>
        </div>

        {/* Körper (scrollbar) */}
        <div className="flex-1 overflow-y-auto px-[26px] py-[22px]">
          {/* Stil-Hinweise */}
          <div>
            <label htmlFor="tweak-stil" className="block text-[13px] font-medium text-[var(--tf-text)] mb-1.5">Stil-Hinweise</label>
            <textarea
              id="tweak-stil"
              rows={5}
              maxLength={TWEAK_FELD_MAX}
              className={TA}
              value={stilHinweise}
              onChange={e => setStilHinweise(e.target.value)}
              placeholder="z. B. Sachlich und zurückhaltend formulieren. Keine Superlative aus dem Antrag übernehmen."
            />
            <Counter value={stilHinweise} />
          </div>

          {/* Eigene Beispiel-Formulierungen */}
          <div className="mt-[22px]">
            <label htmlFor="tweak-bsp" className="block text-[13px] font-medium text-[var(--tf-text)] mb-1.5">Eigene Beispiel-Formulierungen</label>
            <p className="text-[11.5px] leading-[1.45] text-[var(--tf-text-tertiary)] mt-0 mb-2">
              Typische eigene Textbausteine, z. B. Satzanfänge. Werden der KI als Stil-Beispiele mitgegeben, nicht wörtlich übernommen.
            </p>
            <textarea
              id="tweak-bsp"
              rows={6}
              maxLength={TWEAK_FELD_MAX}
              className={TA}
              value={beispiele}
              onChange={e => setBeispiele(e.target.value)}
              placeholder={'z. B. „Eine wesentliche Herausforderung des Vorhabens besteht …"'}
            />
            <Counter value={beispiele} />
          </div>

          {/* So wird es der KI mitgegeben (schreibgeschützt) */}
          <div className="mt-[26px]">
            <button
              type="button"
              onClick={() => setPreviewOpen(o => !o)}
              className="flex items-center gap-2 py-1 select-none"
            >
              <ChevronDown size={12} className={`text-[var(--tf-text-tertiary)] transition-transform ${previewOpen ? '' : '-rotate-90'}`} />
              <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">So wird es der KI mitgegeben</span>
            </button>
            {previewOpen && (
              <>
                <p className="text-[11.5px] leading-[1.5] text-[var(--tf-text-tertiary)] mt-2 mb-2.5">
                  Ihre Angaben werden als eigener Abschnitt <em>vor</em> den formalen Vorgaben des Kurators eingefügt — diese bleiben unverändert wirksam und werden weiterhin geprüft.
                </p>
                <div className="bg-[var(--tf-bg-secondary)] border-[0.5px] border-[var(--tf-border)] rounded-[10px] px-4 py-3.5 font-mono text-[12px] leading-[1.7]">
                  {tweakBlock ? (
                    <div className="border-l-2 border-[var(--tf-primary)] pl-3 whitespace-pre-wrap text-[var(--tf-text)]">{tweakBlock}</div>
                  ) : (
                    <div className="border-l-2 border-[var(--tf-border)] pl-3 text-[var(--tf-text-tertiary)] italic">noch keine Stil-Angaben</div>
                  )}
                  <div className="mt-3.5 text-[var(--tf-text-tertiary)]"># danach — vom Kurator vorgegeben, unveränderlich:</div>
                  <div className="mt-2 border-l-2 border-[var(--tf-border)] pl-3 whitespace-pre-wrap text-[var(--tf-text-tertiary)]">
                    {vorgaben || '## Formale Vorgaben\n(keine aktiven Qualitätsregeln)'}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Aktiv-Toggle */}
          <div className="flex items-center gap-3 mt-7 pt-5 border-t-[0.5px] border-[var(--tf-border)]">
            <button
              type="button"
              role="switch"
              aria-checked={aktiv}
              onClick={() => setAktiv(a => !a)}
              className={`relative inline-block w-8 h-[18px] rounded-full flex-shrink-0 ${aktiv ? 'bg-[var(--tf-text)]' : 'bg-[var(--tf-border-hover)]'}`}
            >
              <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-[var(--tf-bg)] transition-[left] ${aktiv ? 'left-4' : 'left-0.5'}`} />
            </button>
            <span className="text-[13px] text-[var(--tf-text)]">Persönlichen Stil verwenden</span>
          </div>

          {(save.error || remove.error) && (
            <div className="mt-3 rounded-[8px] px-3 py-2 text-[12px] text-[var(--tf-danger-text)] bg-[var(--tf-danger-bg)]">
              {save.error ?? remove.error}
            </div>
          )}
        </div>

        {/* Fußleiste */}
        <div className="px-[26px] py-4 border-t-[0.5px] border-[var(--tf-border)]">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => save.run()}
              disabled={save.busy || remove.busy}
              className="text-[13px] px-4 py-2 rounded-[8px] bg-[var(--tf-text)] text-[var(--tf-bg)] hover:opacity-85 disabled:opacity-50"
            >
              {save.busy ? 'Speichern…' : 'Speichern'}
            </button>
            <button type="button" onClick={onClose} className="text-[13px] px-4 py-2 rounded-[8px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]">
              Abbrechen
            </button>
            <span className="flex-1" />
            {tweak && (
              <button
                type="button"
                onClick={() => remove.run()}
                disabled={save.busy || remove.busy}
                className="text-[12.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] disabled:opacity-50"
              >
                {remove.busy ? 'Entfernen…' : 'Entfernen'}
              </button>
            )}
          </div>
          <div className="mt-3 text-[11px] text-[var(--tf-text-tertiary)]">
            Angelegt für <span className="font-mono">Skill-Version {skillVersion}</span> · gespeichert lokal
          </div>
        </div>
      </aside>
    </div>
  );
}

function Counter({ value }: { value: string }): React.ReactElement {
  const atMax = value.length >= TWEAK_FELD_MAX;
  return (
    <div className={`mt-1 text-right text-[11px] ${atMax ? 'text-[var(--tf-warning-text)]' : 'text-[var(--tf-text-tertiary)]'}`}>
      {value.length.toLocaleString('de-DE')} / {TWEAK_FELD_MAX.toLocaleString('de-DE')}
    </div>
  );
}
