import { useMemo, useRef, useState } from 'react';
import { Info, Pencil, Sparkles } from 'lucide-react';
import type { EditorView } from '@codemirror/view';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import { MarkdownEditor } from '@/components/ui/MarkdownEditor';
import { markdownLivePreview } from '@/components/ui/markdownLivePreview';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import {
  appendHistorie,
  rollbackSkill,
  buildPromptVorgaben,
  findeUmfangKonflikte,
  findeUmfangDopplungen,
  findeVorgabenWidersprueche,
  resolveRegeln,
  describeRegelParams,
  skillKategorieLabel,
  SKILL_KATEGORIE_LABEL,
  type QualitaetsRegel,
  type Reifegrad,
  type SkillModifierKey,
  type SkillRecord,
  type SkillRegistryFile,
  type SkillVersionSnapshot,
} from '@/core/services/skills';
import { suggestReifegrad, type SkillAggregat, type SkillAggregatMap } from '@/core/services/skill-feedback';
import { skillEnthaeltDokumentInhalte, templateReferenziertInhaltsSlot } from '@/core/services/ai/transport-policy';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { SkillVersionen } from './SkillVersionen';
import { VorgabenEditor } from './VorgabenEditor';
import { groupRegelnByKategorie } from './regelGruppen';
import { pruefeSlotAenderung } from './promptSlotWarnung';
import { useReportGuardState, type EditorGuardState } from './editorGuard';
import { leiteQsKriterienAb } from './qsKriterienAbleitung';
import { useAIBridge } from '@/core/hooks/useAIBridge';

const SLOT_EXPL: Record<string, string> = {
  stammdaten: 'FKZ, Firmenname, Akronym und Antragstyp aus den TeamFlow-Stammdaten.',
  vbMarkdown: 'Volltext der Vorhabensbeschreibung (Markdown) aus dem DMS.',
};
const MOD_LABEL: Record<SkillModifierKey, string> = { neu: 'Neu', kuerzer: 'Kürzer', laenger: 'Länger' };
const REIFEGRAD_LABEL: Record<Reifegrad, string> = { entwurf: 'Entwurf', erprobt: 'Erprobt', empfohlen: 'Empfohlen' };
/** Vorschlagswerte des Kategorie-Setzers — ohne `sonstige` (das ist der Auffang-Default). */
const SKILL_KATEGORIE_KEYS = Object.keys(SKILL_KATEGORIE_LABEL).filter(k => k !== 'sonstige');
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
  /** Regel direkt hier bearbeiten, statt in die Bibliothek zu springen. Nur gesetzt,
   *  wo ein Regel-Editor daneben Platz hat (Inline-Werkstatt); fehlt auf der
   *  Verwaltungsseite — dort führt der Weg über die Regel-Liste. */
  onEditRegel?: (regel: QualitaetsRegel) => void;
  /** Neue Regel anlegen und direkt bearbeiten (Gegenstück zu `onEditRegel`). */
  onNeueRegel?: () => void;
  /** Neben den Prompt gerenderter Zusatz (Live-Vorschau des zusammengesetzten
   *  Prompts). Als Render-Prop, damit der Knoten aus dem AUFRUFENDEN Plugin
   *  kommt — sonst entstünde die Kante Kuration → Gutachten (Zyklus-Guard). */
  nebenPrompt?: (entwurf: SkillRecord) => React.ReactNode;
}

export function SkillEditor({ file, skill, isNew, canEdit, agg, initialView, persist, onBack, onSaved, onManageRegeln, onTestlauf, onGuardStateChange, onEditRegel, onNeueRegel, nebenPrompt }: SkillEditorProps): React.ReactElement {
  const [draft, setDraft] = useState<SkillRecord>(skill);
  const [begruendung, setBegruendung] = useState('');
  const [view, setView] = useState<'bearbeiten' | 'versionen'>(initialView ?? 'bearbeiten');
  const meinKuerzel = useMeinKuerzel();
  const nextVersion = isNew ? draft.version : skill.version + 1;
  const dirty = JSON.stringify(draft) !== JSON.stringify(skill);

  const assignedRegeln = resolveRegeln(file, draft);
  const vorgaben = buildPromptVorgaben(assignedRegeln);
  // Doppelquellen-Guard: nennt der Prompt-TEXT eine Umfangs-Zahl, die von der zugeordneten
  // Regel abweicht, lief bisher der Prompt mit dem alten Wert weiter. Reiner Hinweis.
  const umfangKonflikte = findeUmfangKonflikte(draft.promptTemplate, assignedRegeln);
  // Zwei weitere Prompt-Defekte, die keine Abweichung sind und daher oben durchfielen:
  // dieselbe Zahl zweimal (Doppelquelle, läuft beim nächsten Regel-Edit auseinander)
  // und Vorgaben, die einander rechnerisch ausschließen (Zeichenlimit vs. Satzbudget).
  const umfangDopplungen = findeUmfangDopplungen(draft.promptTemplate, assignedRegeln);
  const vorgabenWidersprueche = findeVorgabenWidersprueche(assignedRegeln);
  const reifegrad: Reifegrad = draft.reifegrad ?? 'entwurf';
  // Placeholder des Kategorie-Setzers: was ohne expliziten Wert gälte (Ableitung
  // aus id/Name) — daher bewusst OHNE `draft.kategorie`.
  const abgeleiteteKategorie = skillKategorieLabel({ id: draft.id, name: draft.name });
  const reifegradVorschlag = suggestReifegrad(agg?.get(skill.id) ?? LEER_AGG, reifegrad);
  const historieCount = skill.historie?.length ?? 0;
  // DSGVO-Transport-Policy: abgeleitete Klassifizierung (Ableitung schlägt Flag).
  const slotErzwingtIntern = templateReferenziertInhaltsSlot(draft.promptTemplate);
  const inhaltsTragend = skillEnthaeltDokumentInhalte(draft);
  // Gegen den GESPEICHERTEN Stand, nicht gegen `draft.slots` — sonst meldete jeder
  // Bestands-Skill mit abweichendem slots-Array sofort Alarm (Pitfall #35).
  const slotAenderung = pruefeSlotAenderung(skill.promptTemplate, draft.promptTemplate);

  // Prompt-Vorlage = Markdown-Live-Preview-Editor (wie Gutachten-Abschnitte).
  // MarkdownEditor.onChange ist 300 ms debounced → beim Speichern den Live-Doc-Wert
  // flushen, damit der letzte Tastendruck nicht verloren geht.
  const promptViewRef = useRef<EditorView | null>(null);
  const promptExtensions = useMemo(() => [markdownLivePreview()], []);

  // doSave = reiner Persist-Teil (Version-Bump + Historie, OHNE onBack) — wird vom
  // In-Editor-Button (mit Schließen) UND vom Leave-Guard (ohne Schließen) genutzt.
  const doSave = async (): Promise<void> => {
    const promptTemplate = promptViewRef.current?.state.doc.toString() ?? draft.promptTemplate;
    const base: SkillRecord = { ...draft, promptTemplate, version: nextVersion, geaendert_am: new Date().toISOString() };
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

  // Abnahme-Kriterien: eine Zeile = ein Kriterium. Der Rohpuffer hält das
  // Getippte (inkl. Leerzeile am Ende), der Draft die bereinigte Liste — sonst
  // würde jede Zwischen-Eingabe beim Tippen weggeputzt.
  const [kriterienBuf, setKriterienBuf] = useState<string>((skill.qsKriterien ?? []).join('\n'));
  const onKriterienChange = (raw: string): void => {
    setKriterienBuf(raw);
    const liste = raw.split('\n').map(k => k.trim()).filter(Boolean);
    setDraft(d => ({ ...d, qsKriterien: liste.length > 0 ? liste : undefined }));
  };
  const uebernimmVorschlag = (k: string): void => {
    const vorhanden = kriterienBuf.split('\n').map(z => z.trim().toLowerCase());
    if (vorhanden.includes(k.toLowerCase())) return;
    onKriterienChange(kriterienBuf.trim() ? `${kriterienBuf.replace(/\s+$/, '')}\n${k}` : k);
  };

  // Ableitung liefert nur VORSCHLÄGE — gespeichert wird nichts, bis der Mensch
  // klickt und danach regulär speichert (neue Skill-Version).
  const [vorschlaege, setVorschlaege] = useState<string[]>([]);
  const [vorschlaegeHinweis, setVorschlaegeHinweis] = useState('');
  const bridge = useAIBridge();
  const ableiten = useAsyncAction(async () => {
    setVorschlaege([]);
    setVorschlaegeHinweis('');
    const vorlage = promptViewRef.current?.state.doc.toString() ?? draft.promptTemplate;
    // `vorlage` ist der Prompt-Text des Skills aus dem Editor, also kuratierte
    // App-Daten — die Ableitung liest nur ihn, nie ein Antragsdokument.
    const gefunden = await leiteQsKriterienAb(bridge.getActiveTransport(), draft.name, vorlage); // allow-raw-active-transport: nur Skill-Prompt-Text, keine Antragsdaten
    if (!gefunden) {
      setVorschlaegeHinweis('Keine Vorschläge — interne KI nicht erreichbar oder Antwort unbrauchbar.');
      return;
    }
    setVorschlaege(gefunden);
  });

  const ro = !canEdit;
  const inputCls = 'w-full rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-transparent outline-none focus:border-[var(--tf-primary)] disabled:opacity-70';

  return (
    <div className="max-w-[900px]">
      {/* Kein Zurück-Link — das Schließen-X sitzt in der `DetailKopf`-Zeile der Seite. */}
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
        {/* Prompt-Vorlage — Markdown-Live-Preview (wie Gutachten-Abschnitte bearbeiten) */}
        <Section>Prompt-Vorlage</Section>
        <MarkdownEditor
          value={draft.promptTemplate}
          onChange={v => setDraft(d => ({ ...d, promptTemplate: v }))}
          readOnly={ro}
          minHeight="340px"
          extensions={promptExtensions}
          onCreateEditor={v => { promptViewRef.current = v; }}
          className="bg-[var(--tf-bg-secondary)]"
        />
        <div className="mt-3 flex flex-col gap-1.5">
          {draft.slots.map(slot => (
            <div key={slot} className="flex items-baseline gap-2.5">
              <span className="font-mono text-[11.5px] bg-[var(--tf-primary-light)] text-[var(--tf-primary)] rounded-[5px] px-[7px] py-1 flex-shrink-0">{`{{${slot}}}`}</span>
              <span className="text-[11px] leading-[1.45] text-[var(--tf-text-tertiary)]">{SLOT_EXPL[slot] ?? 'Kontext-Slot.'}</span>
            </div>
          ))}
        </div>

        {/* Entfernter Inhalts-Slot: der Lauf setzt den Antragstext dann nicht mehr
            ein — ohne Fehlermeldung. Vergleich gegen den GESPEICHERTEN Stand. */}
        {slotAenderung.entfernteSlots.length > 0 && (
          <div className="mt-3 rounded-[8px] border-[0.5px] border-[var(--tf-warning-border)] bg-[var(--tf-warning-soft)] p-3">
            <p className="text-[12px] font-medium text-[var(--tf-warning-text)] mb-1.5">
              ⚠ {slotAenderung.entfernteSlots.map(s => `{{${s}}}`).join(', ')} steht nicht mehr im Text
            </p>
            <p className="text-[11.5px] leading-[1.5] text-[var(--tf-warning-text)] m-0">
              {slotAenderung.vbVerloren
                ? 'Der nächste Lauf sieht die Vorhabensbeschreibung nicht mehr und schreibt den Abschnitt ohne den Antrag — ohne Fehlermeldung.'
                : 'Der nächste Lauf bekommt diesen Kontext nicht mehr mitgeliefert.'}
              {slotAenderung.kipptAufInhaltsfrei
                ? ' Zusätzlich ist das Häkchen „Verarbeitet Dokumentinhalte" jetzt bedienbar geworden: der Skill gilt nur noch durch den Fail-safe-Standard als intern-pflichtig.'
                : ''}
            </p>
          </div>
        )}

        {/* Was der Lauf aus dieser Vorlage macht — vom Aufrufer geliefert, weil die
            Eingabe (Antrag, Korpus, Ziel) nur dort bekannt ist. Die Vorlage IST nicht
            der Prompt: dahinter hängen bis zu neun Blöcke, die sie überstimmen können. */}
        {nebenPrompt && <div className="mt-4">{nebenPrompt(draft)}</div>}

        {/* DSGVO-Transport-Policy: abgeleitete Klassifizierung + optionaler Override.
            Erklärprosa hinter dem Info-Icon (zustandsabhängig). */}
        <div className="mt-4 rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] px-[14px] py-3">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-[12px] text-[var(--tf-text)]">
              <input
                type="checkbox"
                disabled={ro || slotErzwingtIntern}
                checked={inhaltsTragend}
                onChange={e => setDraft(d => ({ ...d, enthaeltDokumentInhalte: e.target.checked }))}
                className="accent-[var(--tf-primary)] disabled:opacity-60"
              />
              <span className={slotErzwingtIntern ? 'opacity-60' : ''}>Verarbeitet Dokumentinhalte (nur interne KI)</span>
            </label>
            <FeldInfo
              text={slotErzwingtIntern
                ? 'Das Template referenziert einen Inhalts-Slot → der Skill verarbeitet Dokumentinhalte und läuft ausschließlich über die interne KI (DSGVO-Transport-Policy). Die Ableitung schlägt jeden Override.'
                : 'Das Template referenziert keinen Inhalts-Slot. Fail-safe-Standard: als inhalts-tragend behandeln (nur interne KI). Nur als inhaltsfrei markieren, wenn sicher kein Dokumentinhalt verarbeitet wird — dann ist auch ein externer Provider erlaubt.'}
            />
          </div>
        </div>

        {/* Aktivierungs-Gate: Skill freischalten/sperren (z.B. nach bestandener Eval).
            Erklärprosa hinter dem Info-Icon. */}
        <div className="mt-4 rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] px-[14px] py-3">
          <div className="flex items-center gap-2">
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
            <FeldInfo text={'Deaktiviert (Häkchen aus): Module, die das Gate respektieren (z. B. „Anfragen"), führen den Skill nicht aus. Standard: aktiv. Ein neuer, ungeprüfter Skill startet bewusst deaktiviert, bis seine Eval besteht.'} />
          </div>
        </div>

        {/* Formale Vorgaben (automatisch) */}
        <div className="mt-7">
          <Section>Formale Vorgaben (automatisch)</Section>
          <p className="text-[11.5px] leading-[1.5] text-[var(--tf-text-tertiary)] m-0 mb-2.5">
            Wird aus den zugeordneten Qualitätsregeln erzeugt und dem Prompt automatisch angehängt.
          </p>
          {/* Den ganzen Block zeigen, nicht nur die „- "-Zeilen: mehrzeilige Hinweise
              (Pflicht-Anfang) stehen bewusst als eigener Absatz unter der Liste und
              fielen sonst still aus der Vorschau — der Prompt trug sie trotzdem. */}
          <div className="border-l-2 border-[var(--tf-border-hover)] bg-[var(--tf-bg-secondary)] rounded-r-[8px] px-4 py-3.5">
            {vorgaben
              ? <div className="font-mono text-[12.5px] leading-[1.6] whitespace-pre-wrap text-[var(--tf-text-secondary)]">{vorgaben}</div>
              : <div className="text-[12.5px] text-[var(--tf-text-tertiary)]">Keine aktiven Regeln zugeordnet.</div>}
          </div>
          {umfangKonflikte.length > 0 && (
            <div className="mt-2.5 rounded-[8px] border-[0.5px] border-[var(--tf-warning-border)] bg-[var(--tf-warning-soft)] p-3">
              <p className="text-[12px] font-medium text-[var(--tf-warning-text)] mb-1.5">⚠ Prompt-Text nennt eine andere Zahl als die Regel</p>
              {umfangKonflikte.map((msg, i) => (
                <p key={i} className="text-[11.5px] leading-[1.5] text-[var(--tf-warning-text)] mb-1 last:mb-0">{msg}</p>
              ))}
            </div>
          )}
          {vorgabenWidersprueche.length > 0 && (
            <div className="mt-2.5 rounded-[8px] border-[0.5px] border-[var(--tf-warning-border)] bg-[var(--tf-warning-soft)] p-3">
              <p className="text-[12px] font-medium text-[var(--tf-warning-text)] mb-1.5">⚠ Die Vorgaben schließen einander aus</p>
              {vorgabenWidersprueche.map((msg, i) => (
                <p key={i} className="text-[11.5px] leading-[1.5] text-[var(--tf-warning-text)] mb-1 last:mb-0">{msg}</p>
              ))}
            </div>
          )}
          {umfangDopplungen.length > 0 && (
            // Kein Warnton: eine Dopplung ist heute korrekt und wird erst beim nächsten
            // Regel-Edit zum Problem. Hinweis, nicht Alarm.
            <div className="mt-2.5 rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] p-3">
              <p className="text-[12px] font-medium text-[var(--tf-text-secondary)] mb-1.5">Doppelte Umfangs-Angabe</p>
              {umfangDopplungen.map((msg, i) => (
                <p key={i} className="text-[11.5px] leading-[1.5] text-[var(--tf-text-tertiary)] mb-1 last:mb-0">{msg}</p>
              ))}
            </div>
          )}
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

        {/* Umfang & Form — die skill-eigenen Vorgaben. Sie lagen bis v2.295 als
            Ein-Skill-Regeln in der geteilten Bibliothek und stehen jetzt hier. */}
        <div className="mt-7">
          <Section>Umfang &amp; Form</Section>
          <p className="text-[11.5px] leading-[1.5] text-[var(--tf-text-tertiary)] m-0 mb-2.5">
            Gilt nur für diesen Skill. Die Werte werden geprüft und der KI als Vorgabe mitgegeben.
          </p>
          <VorgabenEditor
            modus="team"
            vorgaben={draft.vorgaben}
            canEdit={canEdit}
            onChangeVorgaben={v => setDraft(d => ({ ...d, vorgaben: Object.keys(v).length > 0 ? v : undefined }))}
          />
        </div>

        {/* Zugeordnete Qualitätsregeln — nach Kategorie gruppiert, collapsible;
            Gruppen mit zugeordneter (angehakter) Regel klappen automatisch auf. */}
        <div className="mt-7">
          <Section>Zugeordnete Qualitätsregeln</Section>
          <p className="text-[11.5px] leading-[1.5] text-[var(--tf-text-tertiary)] m-0 mb-2.5">
            Wiederverwendbare Regeln aus der geteilten Bibliothek — sie gelten in mehreren Skills.
          </p>
          {file.regeln.length === 0 ? (
            <p className="text-[12.5px] text-[var(--tf-text-tertiary)] py-2">Noch keine Regeln in der Bibliothek.</p>
          ) : (
            <div className="border-t-[0.5px] border-[var(--tf-border)]">
              {groupRegelnByKategorie(file.regeln, draft.regelIds).map(gruppe => (
                <CollapsibleSection
                  key={gruppe.kategorie}
                  label={gruppe.label}
                  subtitle={`${gruppe.zugeordnet}/${gruppe.gesamt}`}
                  defaultOpen={gruppe.zugeordnet > 0}
                >
                  <div className="flex flex-col">
                    {gruppe.regeln.map(r => {
                      const checked = draft.regelIds.includes(r.id);
                      return (
                        // Zeile ist ein div, nicht das <label>: ein Stift INNERHALB des
                        // Labels würde beim Klick zusätzlich die Checkbox umschalten.
                        <div key={r.id} className="flex items-center gap-3 py-[9px] border-t-[0.5px] border-[var(--tf-border)] first:border-t-0">
                          <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                            <input type="checkbox" checked={checked} disabled={ro} onChange={() => toggleRegel(r.id)} className="accent-[var(--tf-primary)]" />
                            <span className="text-[13px] text-[var(--tf-text)]">{r.name}</span>
                            <span className="ml-auto font-mono text-[12px] text-[var(--tf-text-tertiary)]">{describeRegelParams(r)}</span>
                          </label>
                          {onEditRegel && (
                            <button
                              type="button"
                              onClick={() => onEditRegel(r)}
                              title={`Regel „${r.name}" bearbeiten`}
                              aria-label={`Regel „${r.name}" bearbeiten`}
                              className="flex-shrink-0 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-primary)] transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleSection>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 mt-3.5">
            {onNeueRegel && canEdit && (
              <button onClick={onNeueRegel} className="text-[12.5px] text-[var(--tf-primary)] hover:underline">+ Neue Regel</button>
            )}
            <button onClick={onManageRegeln} className="text-[12.5px] text-[var(--tf-primary)] hover:underline">Regeln verwalten →</button>
          </div>
        </div>

        {/* Abnahme-Kriterien für die beratende KI-QS. Eine Zeile = ein Kriterium
            (Rohpuffer, damit Tippen flüssig bleibt — Muster: MusterErkennungEditor).
            Leer ⇒ die QS bewertet unverändert die generischen Default-Dimensionen. */}
        <div className="mt-7">
          <Section>Abnahme-Kriterien (KI-QS)</Section>
          <p className="text-[11.5px] leading-[1.5] text-[var(--tf-text-tertiary)] m-0 mb-2.5">
            Ein prüfbarer Satz je Zeile — die KI-QS bewertet dann genau diese Punkte statt der
            generischen Dimensionen und darf die betroffenen Sätze benennen. Keine Zeichen- oder
            Wortzahlen (das prüfen die Regeln oben). Leer lassen = wie bisher.
          </p>
          <textarea
            value={kriterienBuf}
            disabled={ro}
            onChange={e => onKriterienChange(e.target.value)}
            rows={4}
            placeholder={'Aussagen durch den Antrag belegt\nRisiken auf den Lösungsweg bezogen, nicht allgemein'}
            className={`${inputCls} px-2.5 py-2 text-[13px] leading-[1.6] resize-y`}
          />
          {canEdit && (
            <div className="flex items-center gap-2.5 mt-2">
              <button
                type="button"
                disabled={ableiten.busy || !draft.promptTemplate.trim()}
                onClick={() => ableiten.run()}
                className="inline-flex items-center gap-1.5 text-[12.5px] px-[13px] py-[7px] rounded-[99px] border-[0.5px] border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:border-[var(--tf-border-hover)] disabled:opacity-50"
              >
                <Sparkles size={13} />
                {ableiten.busy ? 'Leite ab…' : 'Kriterien aus Prompt ableiten'}
              </button>
              {vorschlaegeHinweis && (
                <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">{vorschlaegeHinweis}</span>
              )}
            </div>
          )}
          {vorschlaege.length > 0 && (
            <div className="mt-2.5 rounded-[8px] border-[0.5px] border-[var(--tf-border)] p-2.5">
              <div className="text-[11.5px] text-[var(--tf-text-tertiary)] mb-1.5">
                Vorschläge der KI — noch nichts übernommen. Klick fügt ein Kriterium oben an.
              </div>
              <div className="flex flex-wrap gap-1.5">
                {vorschlaege.map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => uebernimmVorschlag(v)}
                    className="text-left text-[12px] px-2 py-1 rounded-[99px] bg-[var(--tf-primary-soft)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]"
                  >
                    + {v}
                  </button>
                ))}
              </div>
            </div>
          )}
          {ableiten.error && (
            <div className="mt-2 text-[12px] text-[var(--tf-danger-text)]">⚠ {ableiten.error}</div>
          )}
        </div>

        {/* Kategorie — ordnet den Skill fachlich ein (Liste/Tabelle gruppieren
            danach). Leer = aus id/Name abgeleitet; nur ein gesetzter Wert
            persistiert (der abgeleitete Default landet NIE in den Daten). */}
        <div className="mt-7">
          <Section>Kategorie</Section>
          <input
            list="skill-kategorie-optionen"
            value={draft.kategorie ?? ''}
            disabled={ro}
            placeholder={`${abgeleiteteKategorie} (abgeleitet)`}
            onChange={e => {
              const v = e.target.value.trim();
              setDraft(d => {
                const next = { ...d };
                if (v) next.kategorie = v;
                else delete next.kategorie;
                return next;
              });
            }}
            className={`${inputCls} w-[220px] px-[11px] py-2 text-[12.5px] text-[var(--tf-text)]`}
          />
          <datalist id="skill-kategorie-optionen">
            {SKILL_KATEGORIE_KEYS.map(k => (
              <option key={k} value={k}>{SKILL_KATEGORIE_LABEL[k]}</option>
            ))}
          </datalist>
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-2">
            Leer lassen = automatisch aus Skill-Kennung und Name abgeleitet. Ein eigener Wert schlägt die Ableitung.
          </p>
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

/** Kompaktes Info-Icon neben einem Label; zeigt die Erklärprosa als Tooltip. */
function FeldInfo({ text }: { text: string }): React.ReactElement {
  return (
    <Tooltip text={text} maxWidth={360}>
      <button
        type="button"
        aria-label="Info"
        className="shrink-0 inline-flex items-center justify-center text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-help outline-none focus-visible:text-[var(--tf-text)]"
      >
        <Info size={14} strokeWidth={1.5} />
      </button>
    </Tooltip>
  );
}
