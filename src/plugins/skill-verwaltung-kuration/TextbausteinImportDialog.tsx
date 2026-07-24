/**
 * Word-Import-Assistent für Textbausteine. Eine `.docx` wird über mammoth eingelesen,
 * in Block-Kandidaten zerlegt und je Kandidat MIT dem Nutzer kategorisiert:
 * Artefakt-Typ, ID, Thema, Aspekte, Scope. Der Text ist **read-only** (verbatim —
 * Pitfall #34); Auffälligkeiten werden nur angezeigt.
 *
 * Übernahme erzeugt ausschliesslich **Entwürfe** (`uebernehmeKandidat`); eine
 * ID-Kollision landet als neue Version des bestehenden Bausteins, nicht als Duplikat.
 * Am Ende steht ein Import-Protokoll (n erkannt / übernommen / verworfen).
 */
import { useMemo, useState } from 'react';
import { Upload, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  extractPlatzhalter,
  type BausteinArtefaktTyp, type TextbausteinKatalog,
} from '@/core/services/skills';
import { AspektChips } from './AspektChips';
import { bausteinKandidaten, mammothZuHtml, type KandidatEntwurf } from './wordImport';
import { findeBaustein, scopeAusId, uebernehmeKandidat } from './textbausteinKatalogOps';
import { ARTEFAKT_TYPEN, TYP_KURZ } from './textbausteinLabels';

interface Props {
  katalog: TextbausteinKatalog;
  meinKuerzel?: string;
  onClose: () => void;
  persist: (next: TextbausteinKatalog) => Promise<void>;
  onFertig: () => void;
}

/** Kandidat + die im Durchgang bearbeiteten Felder + „verworfen"-Flag. */
interface Zeile extends KandidatEntwurf {
  verworfen: boolean;
}

export function TextbausteinImportDialog({ katalog, meinKuerzel, onClose, persist, onFertig }: Props): React.ReactElement {
  const [dateiName, setDateiName] = useState<string | null>(null);
  const [zeilen, setZeilen] = useState<Zeile[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [defaultTyp, setDefaultTyp] = useState<BausteinArtefaktTyp>('nf');

  const onPick = async (f: File | undefined): Promise<void> => {
    if (!f) return;
    setDateiName(f.name);
    setParseError(null);
    setZeilen(null);
    try {
      const { html } = await mammothZuHtml(await f.arrayBuffer());
      const kandidaten = bausteinKandidaten(html, defaultTyp);
      if (kandidaten.length === 0) { setParseError('Keine Textblöcke erkannt — enthält die Datei Überschriften und Absätze?'); return; }
      setZeilen(kandidaten.map(k => ({ ...k, verworfen: false })));
    } catch (e) {
      setParseError(`Datei ließ sich nicht lesen: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const setZeile = (i: number, patch: Partial<Zeile>): void =>
    setZeilen(zs => zs?.map((z, j) => (j === i ? { ...z, ...patch } : z)) ?? null);

  const aktive = zeilen?.filter(z => !z.verworfen) ?? [];
  const uebernehmbar = aktive.filter(z => z.id.trim() && z.thema.trim());
  const fehlend = aktive.length - uebernehmbar.length;

  const doImport = useAsyncAction(async () => {
    if (!zeilen) return;
    const zeitpunkt = new Date().toISOString();
    let next = katalog;
    for (const z of uebernehmbar) {
      next = uebernehmeKandidat(next, {
        id: z.id, artefaktTyp: z.artefaktTyp,
        ...(z.artefaktTyp === 'nf' ? { scope: scopeAusId(z.id) } : z.scope ? { scope: z.scope } : {}),
        thema: z.thema, kategorie: '', aspekte: z.aspekte, stichworte: z.stichworte, text: z.text,
      }, { zeitpunkt, ...(meinKuerzel ? { userId: meinKuerzel } : {}), begruendung: `Word-Import (${dateiName ?? 'Datei'})` });
    }
    await persist(next);
    onFertig();
  }, { onSuccess: onClose });

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Textbausteine aus Word importieren"
      description="Liest eine .docx ein und legt je Textblock einen Baustein als Entwurf an. Der Wortlaut bleibt unverändert; Freigeben erfolgt danach einzeln."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button
            variant="primary"
            disabled={uebernehmbar.length === 0}
            loading={doImport.busy}
            onClick={() => { void doImport.run(); }}
          >
            {uebernehmbar.length > 0 ? `${uebernehmbar.length} als Entwurf übernehmen` : 'Übernehmen'}
          </Button>
        </>
      }
    >
      {!zeilen && (
        <>
          <div className="flex items-center gap-2 mb-3 text-[12.5px] text-[var(--tf-text-secondary)]">
            Vorbelegter Typ:
            <TypWahl wert={defaultTyp} onChange={setDefaultTyp} />
          </div>
          <label className="w-full flex items-center justify-center gap-2 text-[13px] px-4 py-3 rounded-[8px] border-[0.5px] border-dashed border-[var(--tf-border-hover)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer">
            <Upload size={14} /> {dateiName ?? 'Word-Datei wählen (.docx)'}
            <input type="file" accept=".docx" className="hidden" onChange={e => { void onPick(e.target.files?.[0]); }} />
          </label>
          {parseError && (
            <div className="rounded p-2.5 text-[12px] mt-3" style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}>⚠ {parseError}</div>
          )}
        </>
      )}

      {zeilen && (
        <div className="flex flex-col gap-3">
          <div className="text-[12px] text-[var(--tf-text-tertiary)]">
            {zeilen.length} Block(e) erkannt · {uebernehmbar.length} übernehmbar
            {fehlend > 0 ? ` · ${fehlend} ohne ID/Thema (übersprungen)` : ''}
          </div>
          <div className="flex flex-col gap-2.5 max-h-[52vh] overflow-y-auto pr-1">
            {zeilen.map((z, i) => (
              <KandidatKarte
                key={i}
                zeile={z}
                bestehendeId={z.id.trim() ? !!findeBaustein(katalog, z.id.trim()) : false}
                onChange={patch => setZeile(i, patch)}
              />
            ))}
          </div>
          {doImport.error && (
            <div className="rounded p-2.5 text-[12px]" style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}>⚠ {doImport.error}</div>
          )}
        </div>
      )}
    </Dialog>
  );
}

function TypWahl({ wert, onChange }: { wert: BausteinArtefaktTyp; onChange: (t: BausteinArtefaktTyp) => void }): React.ReactElement {
  return (
    <span className="inline-flex rounded-[7px] border-[0.5px] border-[var(--tf-border)] overflow-hidden">
      {ARTEFAKT_TYPEN.map(t => (
        <button
          key={t}
          type="button"
          aria-pressed={wert === t}
          onClick={() => onChange(t)}
          className={`text-[11.5px] px-2.5 py-1 transition-colors cursor-pointer ${
            wert === t ? 'bg-[var(--tf-primary)] text-white' : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
          }`}
        >
          {TYP_KURZ[t]}
        </button>
      ))}
    </span>
  );
}

function KandidatKarte({ zeile, bestehendeId, onChange }: {
  zeile: Zeile; bestehendeId: boolean; onChange: (patch: Partial<Zeile>) => void;
}): React.ReactElement {
  const platzhalter = useMemo(() => extractPlatzhalter(zeile.text), [zeile.text]);
  if (zeile.verworfen) {
    return (
      <div className="rounded-[10px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] px-3.5 py-2 flex items-center gap-3 opacity-70">
        <span className="text-[12px] text-[var(--tf-text-tertiary)] line-through flex-1">{zeile.thema || zeile.id || 'Block'}</span>
        <button type="button" className="text-[12px] text-[var(--tf-primary)] hover:underline" onClick={() => onChange({ verworfen: false })}>zurückholen</button>
      </div>
    );
  }
  return (
    <div className="rounded-[10px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] px-3.5 py-3 flex flex-col gap-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <TypWahl wert={zeile.artefaktTyp} onChange={t => onChange({ artefaktTyp: t, scope: t === 'nf' ? scopeAusId(zeile.id) : undefined })} />
        <Input value={zeile.id} onChange={e => onChange({ id: e.target.value, ...(zeile.artefaktTyp === 'nf' ? { scope: scopeAusId(e.target.value) } : {}) })} placeholder="ID (z. B. G1.1)" className="w-[130px] h-8 font-mono text-[12px]" />
        <Input value={zeile.thema} onChange={e => onChange({ thema: e.target.value })} placeholder="Thema" className="flex-1 min-w-[160px] h-8 text-[12px]" />
        <span className="flex-1" />
        <button type="button" className="text-[12px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)]" onClick={() => onChange({ verworfen: true })}>verwerfen</button>
      </div>
      {bestehendeId && (
        <div className="text-[11.5px] text-[var(--tf-warning-text)]">
          ID existiert bereits — Übernahme wird eine neue Version des bestehenden Bausteins.
        </div>
      )}
      <AspektChips gewaehlt={zeile.aspekte} onToggle={id => onChange({ aspekte: zeile.aspekte.includes(id) ? zeile.aspekte.filter(x => x !== id) : [...zeile.aspekte, id] })} />
      <div className="text-[12px] text-[var(--tf-text-secondary)] whitespace-pre-wrap leading-[1.5] max-h-[130px] overflow-auto rounded-[8px] bg-[var(--tf-bg-secondary)] px-3 py-2 font-mono text-[11.5px]">
        {zeile.text || '— kein Text —'}
      </div>
      <div className="flex items-center gap-2 flex-wrap text-[11px] text-[var(--tf-text-tertiary)]">
        <span>{platzhalter.length} Platzhalter</span>
        {zeile.warnungen.map((w, i) => (
          <span key={i} className="inline-flex items-center gap-1 text-[var(--tf-warning-text)]"><AlertTriangle size={11} /> {w}</span>
        ))}
      </div>
    </div>
  );
}
