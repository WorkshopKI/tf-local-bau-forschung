/**
 * Die persönliche Ebene eines Skills — sichtbar für JEDEN Nutzer, auch ohne
 * Kurator-Schreibrecht.
 *
 * Grundsatz: was PL/Kurator/dev im Reiter „Team" ändert, gilt für alle; was hier
 * geändert wird, gilt nur für den Nutzer und landet in seinem persönlichen
 * Ordner (`ZAH/skill-tweaks.json`, gespiegelt aus dem IDB-Cache). Die
 * persönliche Ebene kann eine Kurator-Vorgabe VERSCHIEBEN, aber nie aufheben:
 * Zahlen nur dort, wo der Kurator sie freigegeben hat; Schweregrade und
 * Struktur-Vorgaben bleiben unangetastet.
 *
 * Die Stil-Felder sind dieselben wie im `TweakEditor` am Gutachten (gleicher
 * Record, gleiche Persistenz) — hier nur an dem Ort, an dem der Nutzer den Skill
 * ohnehin ansieht.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  buildTweakBlock,
  buildPromptVorgaben,
  resolveRegeln,
  TWEAK_FELD_MAX,
  type PersoenlicheVorgaben,
  type SkillRecord,
  type SkillRegistryFile,
  type SkillTweak,
} from '@/core/services/skills';
import { VorgabenEditor } from './VorgabenEditor';
import { leererTweak } from './useSkillTweak';

interface Props {
  file: SkillRegistryFile;
  skill: SkillRecord;
  tweak: SkillTweak | null;
  loading: boolean;
  onSave: (next: SkillTweak) => Promise<void>;
  onRemove: () => Promise<void>;
}

const TA =
  'w-full resize-y block text-[12.5px] leading-[1.6] text-[var(--tf-text)] bg-transparent '
  + 'border-[0.5px] border-[var(--tf-border)] rounded-[8px] px-[11px] py-2 outline-none '
  + 'focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)]';

export function PersoenlichePanel({ file, skill, tweak, loading, onSave, onRemove }: Props): React.ReactElement {
  const [draft, setDraft] = useState<SkillTweak>(tweak ?? leererTweak(skill.id, skill.version));

  const save = useAsyncAction(async () => {
    await onSave({
      ...draft,
      skillId: skill.id,
      angelegtFuerSkillVersion: skill.version,
      geaendert_am: new Date().toISOString(),
    });
  });
  const remove = useAsyncAction(async () => {
    await onRemove();
    setDraft(leererTweak(skill.id, skill.version));
  });

  // Vorschau aus DERSELBEN Quelle wie der Lauf: aufgelöste Regeln inkl. Override.
  const regeln = resolveRegeln(file, skill, { vorgabenOverride: draft.vorgabenOverride });
  const vorgaben = buildPromptVorgaben(regeln);
  const stilBlock = draft.aktiv ? buildTweakBlock(draft.stilHinweise, draft.beispielFormulierungen) : '';

  if (loading) {
    return <p className="text-[12.5px] text-[var(--tf-text-secondary)] py-2">Laden…</p>;
  }

  return (
    <div className="rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] p-[24px]">
      <div className="rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] px-[14px] py-3 mb-6">
        <p className="text-[12px] leading-[1.55] text-[var(--tf-text-secondary)] m-0">
          Diese Einstellungen gelten <strong className="font-medium text-[var(--tf-text)]">nur für Sie</strong> und
          werden in Ihrem persönlichen Ordner gespeichert. Die Vorgaben des Kurators bleiben wirksam — Sie können
          freigegebene Werte verschieben, nicht abschalten.
        </p>
      </div>

      <Section>Umfang &amp; Form</Section>
      <p className="text-[11.5px] leading-[1.5] text-[var(--tf-text-tertiary)] m-0 mb-2.5">
        Nur vom Kurator freigegebene Werte sind änderbar. Ihr Wert wird auch geprüft — Prompt und Prüfung
        bleiben deckungsgleich.
      </p>
      <VorgabenEditor
        modus="persoenlich"
        vorgaben={skill.vorgaben}
        override={draft.vorgabenOverride}
        canEdit
        onChangeOverride={(v: PersoenlicheVorgaben) =>
          setDraft(d => ({ ...d, vorgabenOverride: Object.keys(v).length > 0 ? v : undefined }))}
      />

      <div className="mt-7">
        <Section>Persönlicher Stil</Section>
        <label className="flex items-center gap-2 text-[12px] text-[var(--tf-text)] mb-3">
          <input
            type="checkbox"
            checked={draft.aktiv}
            onChange={e => setDraft(d => ({ ...d, aktiv: e.target.checked }))}
            className="accent-[var(--tf-primary)]"
          />
          Stil-Hinweise an die KI mitgeben
        </label>
        <div className="flex flex-col gap-3">
          <Feld
            label="Stil-Hinweise"
            value={draft.stilHinweise}
            placeholder="z. B. Sachlich und zurückhaltend formulieren. Keine Superlative."
            onChange={v => setDraft(d => ({ ...d, stilHinweise: v }))}
          />
          <Feld
            label="Beispiel-Formulierungen"
            value={draft.beispielFormulierungen}
            placeholder="Formulierungen, an denen sich die KI orientieren soll…"
            onChange={v => setDraft(d => ({ ...d, beispielFormulierungen: v }))}
          />
        </div>
      </div>

      <div className="mt-7">
        <Section>So wird kombiniert</Section>
        <div className="border-l-2 border-[var(--tf-border-hover)] bg-[var(--tf-bg-secondary)] rounded-r-[8px] px-4 py-3.5">
          <div className="text-[11px] uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)] mb-1.5">Ihr Stil</div>
          <div className="font-mono text-[12px] leading-[1.5] whitespace-pre-wrap text-[var(--tf-text-secondary)]">
            {stilBlock || '— keine Angaben —'}
          </div>
          <div className="text-[11px] uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)] mt-3.5 mb-1.5">
            Formale Vorgaben (mit Ihren Werten)
          </div>
          <div className="font-mono text-[12px] leading-[1.5] whitespace-pre-wrap text-[var(--tf-text-secondary)]">
            {vorgaben || '— keine aktiven Vorgaben —'}
          </div>
        </div>
      </div>

      {(save.error ?? remove.error) && (
        <div className="rounded p-2.5 text-[12px] mt-5" style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}>
          ⚠ {save.error ?? remove.error}
        </div>
      )}

      <div className="mt-6 pt-4 border-t-[0.5px] border-[var(--tf-border)] flex items-center gap-2.5">
        <Button variant="primary" onClick={() => { void save.run(); }} loading={save.busy}>Speichern</Button>
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">gilt nur für Sie</span>
        <span className="flex-1" />
        {tweak && (
          <Button variant="ghost" onClick={() => { void remove.run(); }} loading={remove.busy}>
            Persönliche Einstellungen entfernen
          </Button>
        )}
      </div>
    </div>
  );
}

function Feld({ label, value, placeholder, onChange }: {
  label: string; value: string; placeholder: string; onChange: (v: string) => void;
}): React.ReactElement {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[12px] font-medium text-[var(--tf-text)]">{label}</span>
        <span className="text-[11px] text-[var(--tf-text-tertiary)]">{value.length}/{TWEAK_FELD_MAX}</span>
      </div>
      <textarea
        rows={3}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value.slice(0, TWEAK_FELD_MAX))}
        className={TA}
      />
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">{children}</span>
      <span className="flex-1 h-[0.5px] bg-[var(--tf-border)]" />
    </div>
  );
}
