/**
 * Verwaltungs-Tab „Textbausteine" (NF/RNE/ABL). Master-Liste mit Filtern links,
 * Editor rechts; „Aus Word importieren" öffnet den Import-Assistenten. Sichtbar
 * überall, wo `isSkillVerwaltungEnabled()` gilt (dev + pl + kurator), kein eigenes
 * Varianten-Gate.
 *
 * Selbst-verwaltend statt in die Skill-`DetailZustand`-Union eingehängt: der Katalog
 * hat eine eigene Sidecar, eigene Persistenz und einen eigenen Lebenszyklus — er teilt
 * mit Skills/Regeln nur die Seite, nicht den Zustand.
 */
import { useMemo, useState } from 'react';
import { Search, Upload, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog } from '@/components/ui/dialog';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import {
  bearbeiteBaustein, rollbackBaustein, setzeBausteinStatus,
  type AenderungsKontext, type BausteinArtefaktTyp, type BausteinStatus,
  type TextbausteinRecord, type TextbausteinSnapshot,
} from '@/core/services/skills';
import { PRUEF_ASPEKTE } from '@/plugins/antraege/aufbereitung/aspekt-katalog';
import { useTextbausteinKatalog } from './useTextbausteinKatalog';
import { TextbausteinBaum } from './TextbausteinBaum';
import { findeBaustein, neuerBaustein, scopeAusId, upsertBaustein } from './textbausteinKatalogOps';
import { filterBausteine, LEERER_FILTER, zaehleStatus, type BausteinFilter } from './textbausteinFilter';
import { TextbausteinEditor, type BausteinEntwurf } from './TextbausteinEditor';
import { TextbausteinImportDialog } from './TextbausteinImportDialog';
import { ARTEFAKT_TYPEN, STATUS_LABEL, TYP_KURZ } from './textbausteinLabels';

export function TextbausteineTab(): React.ReactElement {
  const ctl = useTextbausteinKatalog();
  const meinKuerzel = useMeinKuerzel();
  const [filter, setFilter] = useState<BausteinFilter>(LEERER_FILTER);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [neuOffen, setNeuOffen] = useState(false);
  const save = useAsyncAction(async (next: Parameters<typeof ctl.persist>[0]) => { await ctl.persist(next); });

  const katalog = ctl.katalog;
  const gefiltert = useMemo(
    () => (katalog ? filterBausteine(katalog.bausteine, filter) : []),
    [katalog, filter],
  );
  const zaehler = useMemo(() => (katalog ? zaehleStatus(katalog.bausteine) : null), [katalog]);
  const selected = katalog?.bausteine.find(b => b.id === selectedId) ?? null;

  if (ctl.loading || !katalog) {
    return <div className="py-10 text-[13.5px] text-[var(--tf-text-secondary)]">Katalog wird geladen …</div>;
  }

  const kontext = (begruendung?: string): AenderungsKontext => ({
    zeitpunkt: new Date().toISOString(),
    ...(meinKuerzel ? { userId: meinKuerzel } : {}),
    ...(begruendung ? { begruendung } : {}),
  });

  const speichern = (e: BausteinEntwurf): void => {
    if (!selected) return;
    const neu = bearbeiteBaustein(selected, e, kontext());
    void save.run(upsertBaustein(katalog, neu));
  };
  const statusWechsel = (status: BausteinStatus, grund: string): void => {
    if (!selected) return;
    const neu = setzeBausteinStatus(selected, status, kontext(grund));
    void save.run(upsertBaustein(katalog, neu));
  };
  /**
   * Thema mehrerer Bausteine setzen (Umbenennen eines Thema-Knotens bzw.
   * Verschieben). **Ein** `setState`/`persist` für alle Betroffenen — der
   * Save-Lock verwirft parallele Schreibvorgänge (Pitfall #16/#20).
   */
  const themaSetzen = (bausteine: readonly TextbausteinRecord[], thema: string): void => {
    const k = kontext();
    const naechster = bausteine.reduce(
      (acc, b) => upsertBaustein(acc, bearbeiteBaustein(b, { thema }, k)),
      katalog,
    );
    void save.run(naechster);
  };
  const rollback = (snap: TextbausteinSnapshot): void => {
    if (!selected) return;
    const neu = rollbackBaustein(selected, snap.version, kontext());
    void save.run(upsertBaustein(katalog, neu));
  };
  const anlegen = async (eingabe: { id: string; artefaktTyp: BausteinArtefaktTyp; thema: string; kategorie: string; text: string }): Promise<void> => {
    const rec = neuerBaustein({
      ...eingabe,
      ...(eingabe.artefaktTyp === 'nf' ? { scope: scopeAusId(eingabe.id) } : {}),
      aspekte: [], stichworte: [],
    }, kontext());
    await save.run(upsertBaustein(katalog, rec));
    setSelectedId(rec.id);
    setNeuOffen(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {!ctl.canEdit && (
        <Hinweis text="Kurator-Modus nicht aktiv — Textbausteine sind nur lesbar." variant="info" />
      )}
      {ctl.stale && (
        <Hinweis text="Offline — angezeigter Stand stammt aus dem lokalen Zwischenspeicher." variant="warning" />
      )}
      {ctl.ergaenzt.length > 0 && ctl.canEdit && (
        <Hinweis text={`${ctl.ergaenzt.length} Baustein(e) aus dem Katalog-Seed übernommen — die erste Speicherung sichert sie auf dem Share.`} variant="info" />
      )}
      {save.error && <Hinweis text={save.error} variant="danger" />}

      {/* Filterleiste */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-[420px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)] pointer-events-none" />
          <Input value={filter.suche} onChange={e => setFilter(f => ({ ...f, suche: e.target.value }))} placeholder="ID, Thema, Stichwort, Text …" className="pl-7 h-8 text-[12.5px]" />
        </div>
        <PillGruppe
          werte={['alle', ...ARTEFAKT_TYPEN] as const}
          aktiv={filter.typ}
          label={v => (v === 'alle' ? 'Alle' : TYP_KURZ[v])}
          onChange={v => setFilter(f => ({ ...f, typ: v }))}
        />
        <PillGruppe
          werte={['alle', 'entwurf', 'freigegeben', 'stillgelegt'] as const}
          aktiv={filter.status}
          label={v => (v === 'alle' ? 'Alle' : STATUS_LABEL[v])}
          onChange={v => setFilter(f => ({ ...f, status: v }))}
        />
        <select
          value={filter.aspekt}
          onChange={e => setFilter(f => ({ ...f, aspekt: e.target.value }))}
          className="h-8 text-[12px] rounded-[7px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] px-2 text-[var(--tf-text-secondary)]"
        >
          <option value="alle">Aspekt: alle</option>
          {PRUEF_ASPEKTE.map(a => <option key={a.id} value={a.id}>{a.id} — {a.name}</option>)}
        </select>
        <span className="flex-1" />
        {ctl.canEdit && (
          <>
            <Button variant="outline" size="sm" onClick={() => setNeuOffen(true)} className="h-8 whitespace-nowrap">
              <Plus size={13} className="mr-1" /> Neuer Baustein
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImporting(true)} className="h-8 whitespace-nowrap">
              <Upload size={13} className="mr-1" /> Aus Word importieren
            </Button>
          </>
        )}
      </div>

      {zaehler && (
        <div className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {katalog.bausteine.length} Bausteine · {zaehler.freigegeben} freigegeben · {zaehler.entwurf} Entwurf · {zaehler.stillgelegt} stillgelegt · {gefiltert.length} sichtbar
        </div>
      )}

      {/* Split: Baum | Editor */}
      <div className="flex gap-5 items-start">
        <TextbausteinBaum
          gefiltert={gefiltert}
          alle={katalog.bausteine}
          selectedId={selectedId}
          onSelect={setSelectedId}
          canEdit={ctl.canEdit}
          busy={save.busy}
          onThemaSetzen={themaSetzen}
          onStatus={(b, status, grund) => { void save.run(upsertBaustein(katalog, setzeBausteinStatus(b, status, kontext(grund)))); }}
        />
        <div className="flex-1 min-w-0 rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] px-5 py-4">
          {selected ? (
            <TextbausteinEditor
              baustein={selected}
              canEdit={ctl.canEdit}
              busy={save.busy}
              onSpeichern={speichern}
              onStatus={statusWechsel}
              onRollback={rollback}
            />
          ) : (
            <div className="py-16 text-center text-[13px] text-[var(--tf-text-tertiary)]">
              Wählen Sie links einen Baustein, um ihn zu bearbeiten.
            </div>
          )}
        </div>
      </div>

      {importing && (
        <TextbausteinImportDialog
          katalog={katalog}
          meinKuerzel={meinKuerzel}
          onClose={() => setImporting(false)}
          persist={ctl.persist}
          onFertig={() => setImporting(false)}
        />
      )}
      {neuOffen && (
        <NeuerBausteinDialog
          existiert={id => !!findeBaustein(katalog, id)}
          busy={save.busy}
          onClose={() => setNeuOffen(false)}
          onAnlegen={anlegen}
        />
      )}
    </div>
  );
}

/** Anlegen eines neuen Bausteins (immer als Entwurf). ID-Kollision wird geblockt. */
function NeuerBausteinDialog({ existiert, busy, onClose, onAnlegen }: {
  existiert: (id: string) => boolean;
  busy: boolean;
  onClose: () => void;
  onAnlegen: (e: { id: string; artefaktTyp: BausteinArtefaktTyp; thema: string; kategorie: string; text: string }) => Promise<void>;
}): React.ReactElement {
  const [id, setId] = useState('');
  const [artefaktTyp, setArtefaktTyp] = useState<BausteinArtefaktTyp>('nf');
  const [thema, setThema] = useState('');
  const [kategorie, setKategorie] = useState('');
  const [text, setText] = useState('');
  const kollision = id.trim() !== '' && existiert(id.trim());
  const bereit = id.trim() !== '' && thema.trim() !== '' && text.trim() !== '' && !kollision;
  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title="Neuer Textbaustein"
      description="Legt einen Baustein als Entwurf an — Freigabe erfolgt danach. Platzhalter im Text werden automatisch erkannt."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" disabled={!bereit} loading={busy} onClick={() => { void onAnlegen({ id: id.trim(), artefaktTyp, thema: thema.trim(), kategorie: kategorie.trim(), text }); }}>
            Anlegen
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <PillGruppe werte={ARTEFAKT_TYPEN} aktiv={artefaktTyp} label={v => TYP_KURZ[v]} onChange={setArtefaktTyp} />
          <Input value={id} onChange={e => setId(e.target.value)} placeholder="ID (z. B. G1.1)" className="w-[150px] h-8 font-mono text-[12px]" />
        </div>
        {kollision && <div className="text-[11.5px] text-[var(--tf-warning-text)]">Diese ID existiert bereits — bitte eine andere wählen.</div>}
        <Input value={thema} onChange={e => setThema(e.target.value)} placeholder="Thema" className="h-8 text-[12.5px]" />
        <Input value={kategorie} onChange={e => setKategorie(e.target.value)} placeholder="Überkategorie (optional)" className="h-8 text-[12.5px]" />
        <Textarea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder="Rechtstext, mit {Platzhaltern} …" className="font-mono text-[12.5px] leading-[1.6]" />
      </div>
    </Dialog>
  );
}

function PillGruppe<T extends string>({ werte, aktiv, label, onChange }: {
  werte: readonly T[]; aktiv: T; label: (v: T) => string; onChange: (v: T) => void;
}): React.ReactElement {
  return (
    <span className="inline-flex rounded-[7px] border-[0.5px] border-[var(--tf-border)] overflow-hidden">
      {werte.map(v => (
        <button
          key={v}
          type="button"
          aria-pressed={aktiv === v}
          onClick={() => onChange(v)}
          className={`text-[11.5px] px-2.5 py-1 transition-colors cursor-pointer ${
            aktiv === v ? 'bg-[var(--tf-primary)] text-white' : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
          }`}
        >
          {label(v)}
        </button>
      ))}
    </span>
  );
}

function Hinweis({ text, variant }: { text: string; variant: 'info' | 'warning' | 'danger' }): React.ReactElement {
  const style = variant === 'danger'
    ? { background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }
    : variant === 'warning'
      ? { background: 'var(--tf-warning-bg)', color: 'var(--tf-warning-text)' }
      : undefined;
  return (
    <div className="text-[12.5px] rounded-[8px] px-3.5 py-2.5 border-[0.5px] border-[var(--tf-border)]" style={style}>
      {variant === 'danger' ? '⚠ ' : ''}{text}
    </div>
  );
}
