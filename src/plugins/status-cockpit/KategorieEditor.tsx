/**
 * Der Ordner-Editor des Statusbaums — die zugesagte Erweiterbarkeit.
 *
 * Seit v2.351 ein **echter Baum** statt einer Liste mit Einrückung: Zweige
 * klappen zu, Unterordner hängen an einer Führungslinie, umgehängt wird per
 * Ziehen. Das ist das Vokabular, das jeder aus dem Datei-Explorer kennt — bei
 * 19 Ordnern liest sich das deutlich schneller als 19 Elternknoten-Selects
 * untereinander.
 *
 * Der Name ist im Ruhezustand Text und wird erst auf Klick zum Eingabefeld;
 * ohne das bestünde die Seite aus lauter Formularkästen und die Struktur ginge
 * darin unter.
 *
 * Rein darstellend: jede Änderung geht über `api.setKategorie`/`addKategorie`/
 * `removeKategorie` in den Entwurf und wird erst mit dem Speichern zur
 * Team-Fassung.
 */
import { useState } from 'react';
import { ChevronRight, Folder, FolderInput, FolderOpen, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { baumVon, type KategorieKnoten, type StatusKategorie } from '@/core/status';
import type { StatusCockpitApi } from './useStatusCockpit';
import { EBENE_LABEL, feldKlasse, feldStil } from './labels';
import { darfAblegen, naechsteReihenfolge } from './ordnerDrag';

/** Id aus dem Label ableiten: kleingeschrieben, ohne Sonderzeichen, Ebene voran. */
function baueId(
  ebene: 'verbund' | 'tv', label: string, vergeben: ReadonlySet<string>,
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

/** Alles, was eine Zeile über den Rest des Baums wissen muss. */
interface Ctx {
  api: StatusCockpitApi;
  alle: readonly StatusKategorie[];
  zu: ReadonlySet<string>;
  toggleZu: (id: string) => void;
  ziehId: string | null;
  setZiehId: (id: string | null) => void;
  ueber: string | null;
  setUeber: (id: string | null) => void;
  editId: string | null;
  setEditId: (id: string | null) => void;
  umhaengenId: string | null;
  setUmhaengenId: (id: string | null) => void;
  ablegen: (zielId: string | null) => void;
}

function OrdnerZeile({ knoten, ctx }: { knoten: KategorieKnoten; ctx: Ctx }): React.ReactElement {
  const k = knoten.kategorie;
  const offen = !ctx.zu.has(k.id);
  const hatKinder = knoten.kinder.length > 0;
  const belegt = (ctx.api.entwurf?.felder ?? []).filter(f => f.kategorieId === k.id).length;
  const gezogen = ctx.ziehId === k.id;
  const zielAktiv = ctx.ueber === k.id;
  const kannHier = ctx.ziehId !== null && darfAblegen(ctx.alle, ctx.ziehId, k.id);

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-1 rounded ${gezogen ? 'opacity-40' : ''}`}
        style={zielAktiv
          ? { background: 'var(--tf-bg-secondary)', boxShadow: 'inset 0 0 0 1.5px var(--tf-primary)' }
          : undefined}
        onDragOver={e => {
          if (!kannHier) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          ctx.setUeber(k.id);
        }}
        onDragLeave={() => { if (zielAktiv) ctx.setUeber(null); }}
        onDrop={e => {
          if (!kannHier) return;
          e.preventDefault();
          ctx.ablegen(k.id);
        }}
      >
        <span
          draggable
          className="shrink-0 cursor-grab active:cursor-grabbing text-[var(--tf-text-tertiary)]"
          title="Ziehen und auf einem Ordner ablegen, um umzuhängen"
          onDragStart={e => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', k.id);   // Firefox startet sonst keinen Drag
            ctx.setZiehId(k.id);
          }}
          onDragEnd={() => { ctx.setZiehId(null); ctx.setUeber(null); }}
        >
          <GripVertical size={13} />
        </span>

        {hatKinder ? (
          <button
            type="button" aria-expanded={offen} title={offen ? 'Zuklappen' : 'Aufklappen'}
            className="shrink-0 cursor-pointer text-[var(--tf-text-tertiary)]"
            onClick={() => ctx.toggleZu(k.id)}
          >
            <ChevronRight
              size={14} className="transition-transform duration-200"
              style={{ transform: offen ? 'rotate(90deg)' : 'rotate(0deg)' }}
            />
          </button>
        ) : <span className="w-[14px] shrink-0" />}

        {hatKinder && offen
          ? <FolderOpen size={14} className="shrink-0 text-[var(--tf-text-tertiary)]" />
          : <Folder size={14} className="shrink-0 text-[var(--tf-text-tertiary)]" />}

        {ctx.editId === k.id ? (
          <input
            autoFocus
            value={k.label}
            className={`${feldKlasse} max-w-[280px]`}
            style={feldStil}
            onChange={e => ctx.api.setKategorie(k.id, { label: e.target.value })}
            onBlur={() => ctx.setEditId(null)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') ctx.setEditId(null); }}
          />
        ) : (
          <button
            type="button"
            title="Klicken zum Umbenennen"
            className={`text-[13px] text-left truncate rounded px-1 py-0.5 cursor-pointer
              hover:bg-[var(--tf-hover)]
              ${k.aktiv ? 'text-[var(--tf-text)]' : 'text-[var(--tf-text-tertiary)]'}`}
            onClick={() => ctx.setEditId(k.id)}
          >
            {k.label}
          </button>
        )}

        <span
          className="ml-auto shrink-0 text-[11px] font-mono text-[var(--tf-text-tertiary)]"
          title={k.id}
        >
          {belegt} Felder
        </span>
        <input
          type="number"
          value={k.reihenfolge}
          className={`${feldKlasse} w-[64px] shrink-0`}
          style={feldStil}
          title="Reihenfolge unter demselben Ordner"
          onChange={e => ctx.api.setKategorie(k.id, {
            reihenfolge: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 0,
          })}
        />
        <label className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] text-[var(--tf-text-secondary)]">
          <input
            type="checkbox"
            className="accent-[var(--tf-primary)] cursor-pointer"
            checked={k.aktiv}
            onChange={e => ctx.api.setKategorie(k.id, { aktiv: e.target.checked })}
          />
          aktiv
        </label>
        <button
          type="button"
          className="shrink-0 cursor-pointer rounded p-1 text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]"
          title="Umhängen ohne Ziehen — Elternordner auswählen"
          aria-expanded={ctx.umhaengenId === k.id}
          onClick={() => ctx.setUmhaengenId(ctx.umhaengenId === k.id ? null : k.id)}
        >
          <FolderInput size={14} />
        </button>
        <button
          type="button"
          className="shrink-0 cursor-pointer rounded p-1 text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-danger-text)]"
          title="Ordner entfernen — Unterordner rücken nach, Felder verlieren die Zuordnung"
          onClick={() => ctx.api.removeKategorie(k.id)}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {ctx.umhaengenId === k.id && (
        <div className="flex items-center gap-2 py-1 pl-[30px]">
          <span className="text-[12px] text-[var(--tf-text-secondary)]">Übergeordnet:</span>
          <select
            value={k.elternId ?? ''}
            className={`${feldKlasse} max-w-[240px]`}
            style={feldStil}
            onChange={e => {
              const elternId = e.target.value || null;
              ctx.api.setKategorie(k.id, {
                elternId,
                reihenfolge: naechsteReihenfolge(ctx.alle, k.ebene, elternId),
              });
              ctx.setUmhaengenId(null);
            }}
          >
            <option value="">(oberste Ebene)</option>
            {ctx.alle
              // Der aktuelle Elternknoten muss in der Liste stehen, sonst zeigte
              // das Select einen leeren Wert an; alles andere filtert `darfAblegen`.
              .filter(z => z.ebene === k.ebene
                && (z.id === k.elternId || darfAblegen(ctx.alle, k.id, z.id)))
              .map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
          </select>
        </div>
      )}

      {hatKinder && offen && (
        <div className="ml-[6px] border-l border-[var(--tf-border)] pl-[12px]">
          {knoten.kinder.map(kind => (
            <OrdnerZeile key={kind.kategorie.id} knoten={kind} ctx={ctx} />
          ))}
        </div>
      )}
    </div>
  );
}

export function KategorieEditor({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  const [neuLabel, setNeuLabel] = useState('');
  const [neuEbene, setNeuEbene] = useState<'verbund' | 'tv'>('tv');
  const [neuEltern, setNeuEltern] = useState('');
  const [zu, setZu] = useState<ReadonlySet<string>>(new Set());
  const [ziehId, setZiehId] = useState<string | null>(null);
  const [ueber, setUeber] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [umhaengenId, setUmhaengenId] = useState<string | null>(null);
  const entwurf = api.entwurf;
  if (!entwurf) return null;

  const alle = entwurf.kategorien ?? [];

  const ablegen = (zielId: string | null): void => {
    if (ziehId && darfAblegen(alle, ziehId, zielId)) {
      const kat = alle.find(k => k.id === ziehId);
      if (kat) {
        api.setKategorie(ziehId, {
          elternId: zielId,
          reihenfolge: naechsteReihenfolge(alle, kat.ebene, zielId),
        });
      }
      // Das Ziel aufklappen — sonst verschwindet der Ordner scheinbar spurlos.
      if (zielId) setZu(s => { const n = new Set(s); n.delete(zielId); return n; });
    }
    setZiehId(null);
    setUeber(null);
  };

  const ctx: Ctx = {
    api, alle, zu, ziehId, ueber, editId, umhaengenId, ablegen,
    toggleZu: id => setZu(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    }),
    setZiehId, setUeber, setEditId, setUmhaengenId,
  };

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
    if (elternId) setZu(s => { const n = new Set(s); n.delete(elternId); return n; });
  };

  const gezogeneEbene = ziehId ? alle.find(k => k.id === ziehId)?.ebene : undefined;

  return (
    <section className="flex flex-col gap-2">
      <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
        Der Ordnerbaum des Fachsystems. Verbund und Teilvorhaben haben eigene Bäume — „Kommunikation"
        gibt es auf beiden Ebenen mit verschiedenen Codes. Ordner am Griff ziehen und auf einem
        anderen Ordner ablegen hängt sie um; auf den Namen klicken benennt um. Ein stillgelegter
        Ordner verschwindet aus der Anzeige, behält aber seine Felder.
      </p>

      {(['verbund', 'tv'] as const).map(ebene => {
        const wurzelZiel = ziehId !== null && gezogeneEbene === ebene
          && darfAblegen(alle, ziehId, null);
        const baum = baumVon(alle, ebene);
        return (
          <div key={ebene} className="flex flex-col">
            <h4
              className="mt-2 mb-1 rounded px-1 py-0.5 text-[12px] font-medium uppercase tracking-wide text-[var(--tf-text-secondary)]"
              style={ueber === `wurzel:${ebene}`
                ? { background: 'var(--tf-bg-secondary)', boxShadow: 'inset 0 0 0 1.5px var(--tf-primary)' }
                : undefined}
              onDragOver={e => {
                if (!wurzelZiel) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setUeber(`wurzel:${ebene}`);
              }}
              onDragLeave={() => { if (ueber === `wurzel:${ebene}`) setUeber(null); }}
              onDrop={e => {
                if (!wurzelZiel) return;
                e.preventDefault();
                ablegen(null);
              }}
            >
              {EBENE_LABEL[ebene]}
              {wurzelZiel && (
                <span className="ml-2 normal-case font-normal text-[var(--tf-text-tertiary)]">
                  hierhin ablegen = oberste Ebene
                </span>
              )}
            </h4>
            {baum.map(knoten => (
              <OrdnerZeile key={knoten.kategorie.id} knoten={knoten} ctx={ctx} />
            ))}
            {baum.length === 0 && (
              <p className="py-2 text-[12.5px] text-[var(--tf-text-tertiary)]">
                Noch keine Ordner auf dieser Ebene.
              </p>
            )}
          </div>
        );
      })}

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
            setNeuEbene(e.target.value as 'verbund' | 'tv');
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
