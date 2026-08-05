/**
 * Der Ordner-Editor des Statusbaums — die zugesagte Erweiterbarkeit.
 *
 * Seit v2.351 ein echter Baum statt einer Liste mit Einrückung; seit dem
 * Tree-Umbau läuft er auf der gemeinsamen `TfTree`-Basis. Damit verschwinden
 * fünf Zustandsstücke (Zuklapp-Set, zwei Drag-Merker, Umbenenn-Merker und der
 * Umhängen-Fallback) samt hand-geschriebenem HTML5-Drag; dafür gibt es
 * Pfeiltasten, Home/End und ein Kontextmenü.
 *
 * **Gezogen wird am Griff, nicht an der Zeile** — die Zeile trägt ein
 * Zahlenfeld, und der Versuch, eine Zahl zu markieren, darf keinen Drag
 * starten.
 *
 * Rein darstellend: jede Änderung geht über `api.setKategorie`/`addKategorie`/
 * `removeKategorie` in den Entwurf und wird erst mit dem Speichern zur
 * Team-Fassung.
 */
import { useMemo, useState } from 'react';
import { Folder, FolderOpen, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContextMenuItem, ContextMenuLabel, ContextMenuSeparator } from '@/components/ui/context-menu';
import { TfTree, type TfTreeNodeRenderProps } from '@/components/tree';
import type { StatusKategorie } from '@/core/status';
import type { StatusCockpitApi } from './useStatusCockpit';
import { zaehlwort } from '@/core/utils/zaehlwort';
import { EBENE_LABEL, feldKlasse, feldKlasseSchmal, feldStil } from './labels';
import { darfAblegen, naechsteReihenfolge } from './ordnerDrag';
import {
  baueKategorieBaum, belegungJeOrdner, wurzelId,
  type Ebene, type KategorieBaumKnoten,
} from './kategorieBaum';

/** Id aus dem Label ableiten: kleingeschrieben, ohne Sonderzeichen, Ebene voran. */
function baueId(
  ebene: Ebene, label: string, vergeben: ReadonlySet<string>,
): string {
  const stamm = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'ordner';
  const basis = `${ebene === 'verbund' ? 'vb' : 'tv'}.${stamm}`;
  if (!vergeben.has(basis)) return basis;
  for (let i = 2; ; i++) {
    const kandidat = `${basis}-${i}`;
    if (!vergeben.has(kandidat)) return kandidat;
  }
}

export function KategorieEditor({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  const [neuLabel, setNeuLabel] = useState('');
  const [neuEbene, setNeuEbene] = useState<Ebene>('tv');
  const [neuEltern, setNeuEltern] = useState('');
  const [offen, setOffen] = useState<Record<Ebene, string[]>>({ verbund: [], tv: [] });
  const entwurf = api.entwurf;

  const alle = useMemo(() => entwurf?.kategorien ?? [], [entwurf]);
  const belegt = useMemo(() => belegungJeOrdner(entwurf?.felder ?? []), [entwurf]);

  if (!entwurf) return null;

  /** Umhängen — Ziel `null` heißt oberste Ebene. */
  const umhaengen = (id: string, zielId: string | null, ebene: Ebene): void => {
    if (!darfAblegen(alle, id, zielId)) return;
    const kat = alle.find(k => k.id === id);
    if (!kat) return;
    api.setKategorie(id, {
      elternId: zielId,
      reihenfolge: naechsteReihenfolge(alle, kat.ebene, zielId),
    });
    // Das Ziel aufklappen — sonst verschwindet der Ordner scheinbar spurlos.
    if (zielId) oeffne(ebene, zielId);
  };

  const oeffne = (ebene: Ebene, id: string): void =>
    setOffen(o => (o[ebene].includes(id) ? o : { ...o, [ebene]: [...o[ebene], id] }));

  const anlegen = (): void => {
    const label = neuLabel.trim();
    if (!label) return;
    const elternId = neuEltern || null;
    const id = baueId(neuEbene, label, new Set(alle.map(k => k.id)));
    api.addKategorie({
      id,
      elternId,
      label,
      ebene: neuEbene,
      reihenfolge: naechsteReihenfolge(alle, neuEbene, elternId),
      aktiv: true,
    });
    setNeuLabel('');
    if (elternId) oeffne(neuEbene, elternId);
  };

  return (
    <section className="flex flex-col gap-2">
      <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
        Der Ordnerbaum des Fachsystems. Verbund und Teilvorhaben haben eigene Bäume — „Kommunikation"
        gibt es auf beiden Ebenen mit verschiedenen Codes. Ordner am Griff ziehen und auf einem
        anderen Ordner ablegen hängt sie um; F2 oder Doppelklick benennt um. Ein stillgelegter
        Ordner verschwindet aus der Anzeige, behält aber seine Felder.
      </p>

      {(['verbund', 'tv'] as const).map(ebene => (
        <EbenenBaum
          key={ebene}
          ebene={ebene}
          alle={alle}
          belegt={belegt}
          offen={offen[ebene]}
          setOffen={ids => setOffen(o => ({ ...o, [ebene]: ids }))}
          api={api}
          onUmhaengen={(id, zielId) => umhaengen(id, zielId, ebene)}
        />
      ))}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={neuLabel}
          placeholder="Neuer Ordner …"
          className={`${feldKlasse} max-w-[240px]`}
          style={feldStil}
          onChange={e => setNeuLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') anlegen(); }}
        />
        <select
          value={neuEbene}
          className={`${feldKlasse} max-w-[150px]`}
          style={feldStil}
          onChange={e => {
            setNeuEbene(e.target.value as Ebene);
            setNeuEltern('');   // der bisherige Elternordner gehört zum anderen Baum
          }}
        >
          <option value="tv">{EBENE_LABEL.tv}</option>
          <option value="verbund">{EBENE_LABEL.verbund}</option>
        </select>
        <select
          value={neuEltern}
          className={`${feldKlasse} max-w-[220px]`}
          style={feldStil}
          onChange={e => setNeuEltern(e.target.value)}
        >
          <option value="">(oberste Ebene)</option>
          {alle.filter(k => k.ebene === neuEbene)
            .map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        <Button variant="secondary" size="sm" onClick={anlegen} disabled={!neuLabel.trim()}>
          <Plus size={14} /> Anlegen
        </Button>
      </div>
    </section>
  );
}

function EbenenBaum({ ebene, alle, belegt, offen, setOffen, api, onUmhaengen }: {
  ebene: Ebene;
  alle: readonly StatusKategorie[];
  belegt: ReadonlyMap<string, number>;
  offen: string[];
  setOffen: (ids: string[]) => void;
  api: StatusCockpitApi;
  onUmhaengen: (id: string, zielId: string | null) => void;
}): React.ReactElement {
  const { items, rootId } = useMemo(
    () => baueKategorieBaum(alle, ebene, belegt), [alle, ebene, belegt],
  );
  const leer = (items[rootId]?.children ?? []).length === 0;

  return (
    <div className="flex flex-col">
      <h4 className="mt-2 mb-1 px-1 py-0.5 text-[12px] font-medium uppercase tracking-wide text-[var(--tf-text-secondary)]">
        {EBENE_LABEL[ebene]}
      </h4>
      {leer ? (
        <p className="py-2 text-[12.5px] text-[var(--tf-text-tertiary)]">
          Noch keine Ordner auf dieser Ebene.
        </p>
      ) : (
        <TfTree<KategorieBaumKnoten>
          items={items}
          rootId={rootId}
          label={`Ordner ${EBENE_LABEL[ebene]}`}
          features={{ renaming: true, dnd: true, dragHandle: true }}
          expandedItems={offen}
          onExpandedChange={setOffen}
          canRename={(_, d) => d.art === 'ordner'}
          onRename={(id, wert) => {
            const label = wert.trim();
            if (label) api.setKategorie(id, { label });
          }}
          canDrag={ids => ids.every(i => i !== wurzelId(ebene))}
          canDrop={(quellen, ziel) => quellen.every(q =>
            darfAblegen(alle, q, ziel === wurzelId(ebene) ? null : ziel))}
          onDrop={(quellen, ziel) => {
            for (const q of quellen) onUmhaengen(q, ziel === wurzelId(ebene) ? null : ziel);
          }}
          slots={{
            leading: p => (p.dragHandleProps ? (
              <span
                {...p.dragHandleProps}
                className="shrink-0 cursor-grab text-[var(--tf-text-tertiary)] active:cursor-grabbing"
                title="Ziehen und auf einem Ordner ablegen, um umzuhängen"
              >
                <GripVertical size={13} />
              </span>
            ) : null),
            icon: p => (p.isExpanded
              ? <FolderOpen size={14} className="shrink-0 text-[var(--tf-text-tertiary)]" />
              : <Folder size={14} className="shrink-0 text-[var(--tf-text-tertiary)]" />),
            label: p => <Name p={p} />,
            trailing: p => <Steuerung p={p} api={api} />,
            contextMenu: p => <Menue p={p} onUmbenennen={p.starteUmbenennen} api={api} />,
          }}
        />
      )}
    </div>
  );
}

function Name({ p }: { p: TfTreeNodeRenderProps<KategorieBaumKnoten> }): React.ReactElement {
  const aktiv = p.data.art === 'ordner' ? p.data.kategorie.aktiv : true;
  return (
    <span
      title={p.data.art === 'ordner' ? p.data.kategorie.id : undefined}
      className={`min-w-0 flex-1 truncate text-[13px] ${
        aktiv ? 'text-[var(--tf-text)]' : 'text-[var(--tf-text-tertiary)]'
      }`}
    >
      {p.name}
    </span>
  );
}

/**
 * Belegung, Reihenfolge, Aktiv-Häkchen, Löschen. Der Klick darf NICHT bis zur
 * Zeile durchschlagen — dort klappt er den Zweig auf oder zu.
 */
function Steuerung({ p, api }: {
  p: TfTreeNodeRenderProps<KategorieBaumKnoten>; api: StatusCockpitApi;
}): React.ReactElement | null {
  if (p.data.art !== 'ordner') return null;
  const k = p.data.kategorie;
  return (
    <span
      className="flex shrink-0 items-center gap-2"
      onClick={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
    >
      <span className="text-[11px] font-mono text-[var(--tf-text-tertiary)]">
        {zaehlwort(p.data.belegt, 'Feld', 'Felder')}
      </span>
      <input
        type="number"
        value={k.reihenfolge}
        className={`${feldKlasseSchmal} w-[64px] shrink-0`}
        style={feldStil}
        title="Reihenfolge unter demselben Ordner"
        onChange={e => api.setKategorie(k.id, {
          reihenfolge: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 0,
        })}
      />
      <label className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] text-[var(--tf-text-secondary)]">
        <input
          type="checkbox"
          className="accent-[var(--tf-primary)] cursor-pointer"
          checked={k.aktiv}
          onChange={e => api.setKategorie(k.id, { aktiv: e.target.checked })}
        />
        aktiv
      </label>
      <button
        type="button"
        className="shrink-0 cursor-pointer rounded p-1 text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-danger-text)]"
        title="Ordner entfernen — Unterordner rücken nach, Felder verlieren die Zuordnung"
        onClick={() => api.removeKategorie(k.id)}
      >
        <Trash2 size={14} />
      </button>
    </span>
  );
}

function Menue({ p, onUmbenennen, api }: {
  p: TfTreeNodeRenderProps<KategorieBaumKnoten>;
  onUmbenennen: () => void;
  api: StatusCockpitApi;
}): React.ReactElement | null {
  if (p.data.art !== 'ordner') return null;
  const k = p.data.kategorie;
  return (
    <>
      <ContextMenuLabel>{k.id} · {zaehlwort(p.data.belegt, 'Feld', 'Felder')}</ContextMenuLabel>
      <ContextMenuItem onSelect={onUmbenennen}>Umbenennen …</ContextMenuItem>
      <ContextMenuItem onSelect={() => api.setKategorie(k.id, { aktiv: !k.aktiv })}>
        {k.aktiv ? 'Stilllegen' : 'Wieder aktivieren'}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="danger" onSelect={() => api.removeKategorie(k.id)}>
        Ordner entfernen
      </ContextMenuItem>
    </>
  );
}
