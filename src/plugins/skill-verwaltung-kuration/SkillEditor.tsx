import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import {
  appendHistorie,
  rollbackSkill,
  buildPromptVorgaben,
  resolveRegeln,
  describeRegelParams,
  type QualitaetsRegel,
  type Reifegrad,
  type SkillModifierKey,
  type SkillRecord,
  type SkillRegistryFile,
  type SkillVersionSnapshot,
} from '@/core/services/skills';
import { suggestReifegrad, type SkillAggregat, type SkillAggregatMap } from '@/core/services/skill-feedback';
import { skillEnthaeltDokumentInhalte, templateReferenziertInhaltsSlot } from '@/core/services/ai/transport-policy';
import { SkillVersionen } from './SkillVersionen';
import { useReportGuardState, type EditorGuardState } from './editorGuard';

const SLOT_EXPL: Record<string, string> = {
  stammdaten: 'FKZ, Firmenname, Akronym und Antragstyp aus den TeamFlow-Stammdaten.',
  vbMarkdown: 'Volltext der Vorhabensbeschreibung (Markdown) aus dem DMS.',
};
const MOD_LABEL: Record<SkillModifierKey, string> = { neu: 'Neu', kuerzer: 'Kürzer', laenger: 'Länger' };
const REIFEGRAD_LABEL: Record<Reifegrad, string> = { entwurf: 'Entwurf', erprobt: 'Erprobt', empfohlen: 'Empfohlen' };
const LEER_AGG: SkillAggregat = { nutzung: 0, up: 0, down: 0, letzteNutzung: null, kommentare: [] };

function upsertSkill(skills: SkillRecord[], s: SkillRecord): SkillRecord[] {
  const i = skills.findIndex(x => x.id === s.id);
  if (i < 0) return [...skills, s];
  const copy = [...skills];
  copy[i] = s;
  return copy;
}

interface SkillEditorProps {
  file: SkillRegistryFile;
  skill: SkillRecord;
  isNew: boolean;
  canEdit: boolean;
  /** S1-Aggregat (für den beratenden Reifegrad-Vorschlag); `null` solange ladend. */
  agg: SkillAggregatMap | null;
  /** Start-Reiter (Deep-Link aus dem Gutachten-Flow: `'versionen'`). Default `'bearbeiten'`. */
  initialView?: 'bearbeiten' | 'versionen';
  persist: (next: SkillRegistryFile) => Promise<void>;
  /** Nutzer-initiiertes Verlassen (Zurück-Link) — läuft durch die Leave-Guard-Nachfrage. */
  onBack: () => void;
  /** Schließt nach erfolgreichem In-Editor-Persist (Speichern/Rollback) — OHNE Guard, da bereits gespeichert. */
  onSaved: () => void;
  onManageRegeln: () => void;
  onTestlauf: (skill: SkillRecord, regeln: QualitaetsRegel[], hinweis: string) => void;
  /** Meldet `{ dirty, save }` an den Leave-Guard der Skill-Verwaltung. */
  onGuardStateChange?: (state: EditorGuardState | null) => void;
}

export function SkillEditor({ file, skill, isNew, canEdit, agg, initialView, persist, onBack, onSaved, onManageRegeln, onTestlauf, onGuardStateChange }: SkillEditorProps): React.ReactElement {
  const [draft, setDraft] = useState<SkillRecord>(skill);
  const [begruendung, setBegruendung] = useState('');
  const [view, setView] = useState<'bearbeiten' | 'versionen'>(initialView ?? 'bearbeiten');
  const meinKuerzel = useMeinKuerzel();
  const nextVersion = isNew ? draft.version : skill.version + 1;
  const dirty = JSON.stringify(draft) !== JSON.stringify(skill);

  const assignedRegeln = resolveRegeln(file, draft);
  const vorgaben = buildPromptVorgaben(assignedRegeln);
  const reifegrad: Reifegrad = draft.reifegrad ?? 'entwurf';
  const reifegradVorschlag = suggestReifegrad(agg?.get(skill.id) ?? LEER_AGG, reifegrad);
  const historieCount = skill.historie?.length ?? 0;
  // DSGVO-Transport-Policy: abgeleitete Klassifizierung (Ableitung schlägt Flag).
  const slotErzwingtIntern = templateReferenziertInhaltsSlot(draft.promptTemplate);
  const inhaltsTragend = skillEnthaeltDokumentInhalte(draft);

  // doSave = reiner Persist-Teil (Version-Bump + Historie, OHNE onBack) — wird vom
  // In-Editor-Button (mit Schließen) UND vom Leave-Guard (ohne Schließen) genutzt.
  const doSave = async (): Promise<void> => {
    const base: SkillRecord = { ...draft, version: nextVersion, geaendert_am: new Date().toISOString() };
    const updated: SkillRecord = { ...base, historie: appendHistorie(base, { userId: meinKuerzel, begruendung }) };
    await persist({ ...file, skills: upsertSkill(file.skills, updated) });
  };
  const save = useAsyncAction(doSave, { onSuccess: onSaved });

  useReportGuardState(onGuardStateChange, dirty, doSave);

  const rollback = useAsyncAction(async (snap: SkillVersionSnapshot) => {
    const next = rollbackSkill(skill, snap, new Date().toISOString(), { userId: meinKuerzel });
    await persist({ ...file, skills: upsertSkill(file.skills, next) });
  }, { onSuccess: onSaved });

  const toggleRegel = (id: string): void =>
    setDraft(d => ({ ...d, regelIds: d.regelIds.includes(id) ? d.regelIds.filter(x => x !== id) : [...d.regelIds, id] }));

  const ro = !canEdit;
  const inputCls = 'w-full rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-transparent outline-none focus:border-[var(--tf-primary)] disabled:opacity-70';

  return (
    <div className="max-w-[900px]">
      <button onClick={onBack} className="text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] mb-4">← Skill-Verwaltung</button>
      <div className="flex items-baseline gap-2.5">
        <input
          value={draft.name}
          disabled={ro}
          onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
          className="text-[20px] font-medium text-[var(--tf-text)] bg-transparent outline-none border-b border-transparent focus:border-[var(--tf-border-hover)] disabled:opacity-100"
        />
        <span className="text-[11px] px-2 py-0.5 rounded-[99px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">v{skill.version}</span>
        <span
          title="DSGVO-Transport-Policy: dokument-tragende Skills laufen ausschließlich über die interne KI. Abgeleitet aus den Inhalts-Slots des Templates (die Ableitung schlägt jeden Override)."
          className={`text-[11px] px-2 py-0.5 rounded-[99px] ${
            inhaltsTragend
              ? 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)]'
              : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]'
          }`}
        >
          {inhaltsTragend ? 'Dokumentinhalte → nur intern' : 'inhaltsfrei → extern möglich'}
        </span>
      </div>
      <input
        value={draft.beschreibung}
        disabled={ro}
        placeholder="Kurzbeschreibung…"
        onChange={e => setDraft(d => ({ ...d, beschreibung: e.target.value }))}
        className="text-[12px] text-[var(--tf-text-tertiary)] bg-transparent outline-none mt-1.5 mb-4 w-full"
      />

      {/* Reiter: Bearbeiten | Versionen */}
      <div className="flex items-end gap-5 mb-5 border-b-[0.5px] border-[var(--tf-border)]">
        {([['bearbeiten', 'Bearbeiten'], ['versionen', `Versionen (${historieCount})`]] as const).map(([v, label]) => {
          const active = view === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`pb-2.5 text-[13.5px] whitespace-nowrap transition-colors ${
                active
                  ? 'text-[var(--tf-primary)] font-medium border-b-2 border-[var(--tf-primary)] -mb-px'
                  : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {view === 'bearbeiten' && (
      <div className="rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] p-[24px]">
        {/* Prompt-Vorlage */}
        <Section>Prompt-Vorlage</Section>
        <textarea
          value={draft.promptTemplate}
          disabled={ro}
          rows={16}
          onChange={e => setDraft(d => ({ ...d, promptTemplate: e.target.value }))}
          className={`${inputCls} bg-[var(--tf-bg-secondary)] px-[18px] py-4 font-mono text-[12.5px] leading-[1.75] text-[var(--tf-text)] resize-y`}
        />
        <div className="mt-3 flex flex-col gap-1.5">
          {draft.slots.map(slot => (
            <div key={slot} className="flex items-baseline gap-2.5">
              <span className="font-mono text-[11.5px] bg-[var(--tf-primary-light)] text-[var(--tf-primary)] rounded-[5px] px-[7px] py-1 flex-shrink-0">{`{{${slot}}}`}</span>
              <span className="text-[11px] leading-[1.45] text-[var(--tf-text-tertiary)]">{SLOT_EXPL[slot] ?? 'Kontext-Slot.'}</span>
            </div>
          ))}
        </div>

        {/* DSGVO-Transport-Policy: abgeleitete Klassifizierung + optionaler Override */}
        <div className="mt-4 rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] px-[14px] py-3">
          <div className="text-[11.5px] leading-[1.5] text-[var(--tf-text-secondary)]">
            {slotErzwingtIntern
              ? 'Das Template referenziert einen Inhalts-Slot → der Skill verarbeitet Dokumentinhalte und läuft ausschließlich über die interne KI (DSGVO-Transport-Policy). Die Ableitung schlägt jeden Override.'
              : 'Das Template referenziert keinen Inhalts-Slot. Fail-safe-Standard: als inhalts-tragend behandeln (nur interne KI). Nur als inhaltsfrei markieren, wenn sicher kein Dokumentinhalt verarbeitet wird — dann ist auch ein externer Provider erlaubt.'}
          </div>
          <label className="mt-2.5 flex items-center gap-2 text-[12px] text-[var(--tf-text)]">
            <input
              type="checkbox"
              disabled={ro || slotErzwingtIntern}
              checked={inhaltsTragend}
              onChange={e => setDraft(d => ({ ...d, enthaeltDokumentInhalte: e.target.checked }))}
              className="accent-[var(--tf-primary)] disabled:opacity-60"
            />
            <span className={slotErzwingtIntern ? 'opacity-60' : ''}>Verarbeitet Dokumentinhalte (nur interne KI)</span>
          </label>
          {slotErzwingtIntern && (
            <div className="mt-1 text-[11px] text-[var(--tf-text-tertiary)]">Override deaktiviert — durch Inhalts-Slot im Template erzwungen.</div>
          )}
        </div>

        {/* Aktivierungs-Gate: Skill freischalten/sperren (z.B. nach bestandener Eval). */}
        <div className="mt-4 rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] px-[14px] py-3">
          <label className="flex items-center gap-2 text-[12px] text-[var(--tf-text)]">
            <input
              type="checkbox"
              disabled={ro}
              checked={draft.aktiv !== false}
              onChange={e => setDraft(d => ({ ...d, aktiv: e.target.checked }))}
              className="accent-[var(--tf-primary)] disabled:opacity-60"
            />
            <span>Skill aktiv (freigeschaltet)</span>
          </label>
          <div className="mt-1 text-[11px] text-[var(--tf-text-tertiary)]">
            Deaktiviert (Häkchen aus): Module, die das Gate respektieren (z.&nbsp;B. „Anfragen"), führen den Skill nicht aus.
            Standard: aktiv. Ein neuer, ungeprüfter Skill startet bewusst deaktiviert, bis seine Eval besteht.
          </div>
        </div>

        {/* Formale Vorgaben (automatisch) */}
        <div className="mt-7">
          <Section>Formale Vorgaben (automatisch)</Section>
          <p className="text-[11.5px] leading-[1.5] text-[var(--tf-text-tertiary)] m-0 mb-2.5">
            Wird aus den zugeordneten Qualitätsregeln erzeugt und dem Prompt automatisch angehängt.
          </p>
          <div className="border-l-2 border-[var(--tf-border-hover)] bg-[var(--tf-bg-secondary)] rounded-r-[8px] px-4 py-3.5">
            {vorgaben
              ? vorgaben.split('\n').filter(l => l.startsWith('- ')).map((l, i) => (
                  <div key={i} className="font-mono text-[12.5px] leading-[1.5] text-[var(--tf-text-secondary)] mb-2 last:mb-0">{l.slice(2)}</div>
                ))
              : <div className="text-[12.5px] text-[var(--tf-text-tertiary)]">Keine aktiven Regeln zugeordnet.</div>}
          </div>
        </div>

        {/* Modifikatoren */}
        <div className="mt-7">
          <Section>Modifikatoren</Section>
          <div className="flex flex-col gap-3">
            {(['neu', 'kuerzer', 'laenger'] as SkillModifierKey[]).map(k => (
              <div key={k} className="grid grid-cols-[76px_1fr] items-start gap-3.5">
                <span className="text-[13px] font-medium text-[var(--tf-text)] pt-2">{MOD_LABEL[k]}</span>
                <textarea
                  value={draft.modifiers[k]}
                  disabled={ro}
                  rows={2}
                  onChange={e => setDraft(d => ({ ...d, modifiers: { ...d.modifiers, [k]: e.target.value } }))}
                  className={`${inputCls} px-[11px] py-2 text-[12.5px] leading-[1.55] text-[var(--tf-text-secondary)] resize-y`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Zugeordnete Qualitätsregeln */}
        <div className="mt-7">
          <Section>Zugeordnete Qualitätsregeln</Section>
          <div className="flex flex-col">
            {file.regeln.map(r => {
              const checked = draft.regelIds.includes(r.id);
              return (
                <label key={r.id} className="flex items-center gap-3 py-[11px] border-t-[0.5px] border-[var(--tf-border)] first:border-t-0 cursor-pointer">
                  <input type="checkbox" checked={checked} disabled={ro} onChange={() => toggleRegel(r.id)} />
                  <span className="text-[13px] text-[var(--tf-text)]">{r.name}</span>
                  <span className="ml-auto font-mono text-[12px] text-[var(--tf-text-tertiary)]">{describeRegelParams(r)}</span>
                </label>
              );
            })}
            {file.regeln.length === 0 && <p className="text-[12.5px] text-[var(--tf-text-tertiary)] py-2">Noch keine Regeln in der Bibliothek.</p>}
          </div>
          <button onClick={onManageRegeln} className="text-[12.5px] text-[var(--tf-primary)] hover:underline mt-3.5">Regeln verwalten →</button>
        </div>

        {/* Reifegrad (Kurator setzt; S1-Vorschlag beratend) */}
        <div className="mt-7">
          <Section>Reifegrad</Section>
          {canEdit ? (
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={reifegrad}
                onChange={e => setDraft(d => ({ ...d, reifegrad: e.target.value as Reifegrad }))}
                className="text-[12.5px] rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-transparent px-2.5 py-1.5 text-[var(--tf-text)] outline-none focus:border-[var(--tf-primary)]"
              >
                {(['entwurf', 'erprobt', 'empfohlen'] as Reifegrad[]).map(r => (
                  <option key={r} value={r}>{REIFEGRAD_LABEL[r]}</option>
                ))}
              </select>
              {reifegradVorschlag && (
                <button
                  type="button"
                  onClick={() => setDraft(d => ({ ...d, reifegrad: reifegradVorschlag }))}
                  className="inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-primary)] hover:underline"
                >
                  <Sparkles size={12} />
                  Vorschlag: {REIFEGRAD_LABEL[reifegradVorschlag]} übernehmen
                </button>
              )}
            </div>
          ) : (
            <span className="text-[12.5px] text-[var(--tf-text-secondary)]">{REIFEGRAD_LABEL[reifegrad]}</span>
          )}
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-2">
            Vom Kurator gesetzt — der Vorschlag ist beratend (aus Nutzung/Feedback) und wird nie automatisch übernommen.
          </p>
        </div>

        {canEdit && (
          <div className="mt-7">
            <Section>Begründung (optional)</Section>
            <input
              value={begruendung}
              placeholder="Was wurde geändert und warum? — landet in der Versions-Historie."
              onChange={e => setBegruendung(e.target.value)}
              className={`${inputCls} px-[11px] py-2 text-[12.5px] text-[var(--tf-text-secondary)]`}
            />
          </div>
        )}

        {save.error && (
          <div className="rounded p-2.5 text-[12px] mt-5" style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}>⚠ {save.error}</div>
        )}

        {/* Fußleiste */}
        <div className="mt-6 pt-4 border-t-[0.5px] border-[var(--tf-border)] flex items-center gap-2.5">
          {canEdit && (
            <>
              <Button variant="primary" onClick={() => { void save.run(); }} loading={save.busy}>
                Speichern
              </Button>
              <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">erzeugt Version {nextVersion}</span>
            </>
          )}
          {!canEdit && <span className="text-[12px] text-[var(--tf-text-tertiary)]">Kurator-Modus nicht aktiv — nur lesbar.</span>}
          <span className="flex-1" />
          <Button
            variant="secondary"
            onClick={() => onTestlauf(draft, assignedRegeln, `v${draft.version}${dirty ? ' · ungespeicherte Änderungen' : ''}`)}
          >
            Testlauf
          </Button>
          <Button variant="ghost" onClick={onBack}>Abbrechen</Button>
        </div>
      </div>
      )}

      {view === 'versionen' && (
        <div className="rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] p-[24px]">
          <SkillVersionen skill={skill} canEdit={canEdit} onRollback={snap => { void rollback.run(snap); }} />
          {rollback.error && (
            <div className="rounded p-2.5 text-[12px] mt-4" style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}>⚠ {rollback.error}</div>
          )}
        </div>
      )}
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
