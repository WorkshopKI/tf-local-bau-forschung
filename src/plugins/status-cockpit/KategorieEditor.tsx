/**
 * Der Ordner-Editor des Statusbaums — die zugesagte Erweiterbarkeit.
 *
 * Die PL legt Ordner an, benennt sie um, hängt sie um und legt sie still, ohne
 * dass ein Build nötig wäre. Rein darstellend: jede Änderung geht über
 * `api.setKategorie`/`addKategorie`/`removeKategorie` in den Entwurf und wird
 * erst mit dem Speichern zur Team-Fassung.
 */
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { flacheBaumListe, type StatusKategorie } from '@/core/status';
import type { StatusCockpitApi } from './useStatusCockpit';
import { EBENE_LABEL, feldKlasse, feldStil } from './labels';

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

function OrdnerZeile({ kategorie, tiefe, api, alle }: {
  kategorie: StatusKategorie;
  tiefe: number;
  api: StatusCockpitApi;
  alle: readonly StatusKategorie[];
}): React.ReactElement {
  const belegt = (api.entwurf?.felder ?? []).filter(f => f.kategorieId === kategorie.id).length;
  // Als Elternknoten kommen nur Ordner derselben Ebene in Frage — und nicht der
  // Ordner selbst oder einer seiner Nachfahren (das verwirft `aendereKategorie`
  // ohnehin, aber es gar nicht erst anzubieten ist ehrlicher).
  const nachfahren = new Set<string>([kategorie.id]);
  for (const { kategorie: k } of flacheBaumListe(alle, kategorie.ebene)) {
    if (k.elternId && nachfahren.has(k.elternId)) nachfahren.add(k.id);
  }

  return (
    <div
      className="flex items-center gap-2 py-1 border-b border-[var(--tf-border)]"
      style={{ paddingLeft: tiefe * 18 }}
    >
      <input
        value={kategorie.label}
        className={`${feldKlasse} max-w-[280px]`}
        style={feldStil}
        onChange={e => api.setKategorie(kategorie.id, { label: e.target.value })}
      />
      <select
        value={kategorie.elternId ?? ''}
        className={`${feldKlasse} max-w-[220px]`}
        style={feldStil}
        onChange={e => api.setKategorie(kategorie.id, { elternId: e.target.value || null })}
      >
        <option value="">(oberste Ebene)</option>
        {alle
          .filter(k => k.ebene === kategorie.ebene && !nachfahren.has(k.id))
          .map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
      </select>
      <input
        type="number"
        value={kategorie.reihenfolge}
        className={`${feldKlasse} w-[72px]`}
        style={feldStil}
        title="Reihenfolge unter demselben Elternknoten"
        onChange={e => api.setKategorie(kategorie.id, {
          reihenfolge: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 0,
        })}
      />
      <label className="flex items-center gap-1 text-[12px] text-[var(--tf-text-secondary)] whitespace-nowrap">
        <input
          type="checkbox"
          className="accent-[var(--tf-primary)] cursor-pointer"
          checked={kategorie.aktiv}
          onChange={e => api.setKategorie(kategorie.id, { aktiv: e.target.checked })}
        />
        aktiv
      </label>
      <span className="text-[11px] text-[var(--tf-text-tertiary)] font-mono whitespace-nowrap" title={kategorie.id}>
        {belegt} Felder
      </span>
      <button
        type="button"
        className="p-1 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] hover:bg-[var(--tf-hover)] cursor-pointer"
        title="Ordner entfernen — Unterordner rücken nach, Felder verlieren die Zuordnung"
        onClick={() => api.removeKategorie(kategorie.id)}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function KategorieEditor({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  const [neuLabel, setNeuLabel] = useState('');
  const [neuEbene, setNeuEbene] = useState<'verbund' | 'tv'>('tv');
  const entwurf = api.entwurf;
  if (!entwurf) return null;

  const alle = entwurf.kategorien ?? [];
  const anlegen = (): void => {
    const label = neuLabel.trim();
    if (!label) return;
    api.addKategorie({
      id: baueId(neuEbene, label, new Set(alle.map(k => k.id))),
      elternId: null,
      label,
      ebene: neuEbene,
      // Ans Ende, aber vor „Nicht zugeordnet" (999).
      reihenfolge: 900,
      aktiv: true,
    });
    setNeuLabel('');
  };

  return (
    <section className="flex flex-col gap-2">
      <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
        Der Ordnerbaum des Fachsystems. Verbund und Teilvorhaben haben eigene Bäume — „Kommunikation"
        gibt es auf beiden Ebenen mit verschiedenen Codes. Ein stillgelegter Ordner verschwindet aus
        der Anzeige, behält aber seine Felder.
      </p>

      {(['verbund', 'tv'] as const).map(ebene => (
        <div key={ebene} className="flex flex-col">
          <h4 className="text-[12px] font-medium text-[var(--tf-text-secondary)] uppercase tracking-wide mt-2 mb-1">
            {EBENE_LABEL[ebene]}
          </h4>
          {flacheBaumListe(alle, ebene).map(({ kategorie, tiefe }) => (
            <OrdnerZeile key={kategorie.id} kategorie={kategorie} tiefe={tiefe} api={api} alle={alle} />
          ))}
          {flacheBaumListe(alle, ebene).length === 0 && (
            <p className="text-[12.5px] text-[var(--tf-text-tertiary)] py-2">
              Noch keine Ordner auf dieser Ebene.
            </p>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2 mt-2">
        <input
          value={neuLabel}
          placeholder="Neuer Ordner …"
          className={`${feldKlasse} max-w-[280px]`}
          style={feldStil}
          onChange={e => setNeuLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') anlegen(); }}
        />
        <select
          value={neuEbene}
          className={`${feldKlasse} max-w-[160px]`}
          style={feldStil}
          onChange={e => setNeuEbene(e.target.value as 'verbund' | 'tv')}
        >
          <option value="tv">{EBENE_LABEL.tv}</option>
          <option value="verbund">{EBENE_LABEL.verbund}</option>
        </select>
        <Button variant="secondary" size="sm" onClick={anlegen} disabled={!neuLabel.trim()}>
          <Plus size={14} /> Anlegen
        </Button>
      </div>
    </section>
  );
}
