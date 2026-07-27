/**
 * Felder-Tab — der Statuskatalog des Fachsystems kuratieren.
 *
 * Gezeigt wird der Ordnerbaum (Verbund und Teilvorhaben getrennt), darin je Feld
 * eine Zeile mit allem, was die PL entscheidet: Name, Ordner, Zuständigkeit
 * AB/FB, Prominenz und — der wirksame Teil — Spine-Phase, Rang und terminal.
 * **Ohne Rang trägt ein Feld nicht zur Statusableitung bei**; so ist der ganze
 * Code-Katalog ausgeliefert.
 *
 * Darüber zwei Übernahme-Blöcke: was die Auslieferung mitbringt und was in den
 * CSV-Quellen gefunden wurde. Rein darstellend — jede Änderung geht über die
 * `api`-Setter in den Entwurf.
 */
import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleChip } from '@/components/ui/ToggleChip';
import {
  flacheBaumListe, NICHT_ZUGEORDNET_ID,
  type Prominenz, type SpinePhase, type StatusFeldEintrag, type Zustaendigkeit,
} from '@/core/status';
import type { StatusCockpitApi } from './useStatusCockpit';
import {
  EBENE_LABEL, PROMINENZ_LABEL, PROMINENZ_WERTE, SPINE_LABEL, SPINE_WERTE, TYP_LABEL,
  ZUSTAENDIGKEIT_LABEL, ZUSTAENDIGKEIT_WERTE, feldKlasse, feldStil,
} from './labels';
import { KategorieEditor } from './KategorieEditor';

const thKlasse = 'text-left font-medium text-[11px] text-[var(--tf-text-tertiary)] px-2 py-1.5 whitespace-nowrap';
const tdKlasse = 'px-2 py-1.5 align-middle';

/** Ohne Zuordnung sichtbar bleiben: Felder ohne Ordner landen im Sammelordner. */
function ordnerVon(feld: StatusFeldEintrag): string {
  return feld.kategorieId ?? NICHT_ZUGEORDNET_ID[feld.ebene];
}

function FeldZeile({ f, csvSpalte, api, ordnerWahl }: {
  f: StatusFeldEintrag;
  csvSpalte: string;
  api: StatusCockpitApi;
  ordnerWahl: { id: string; label: string }[];
}): React.ReactElement {
  const set = (patch: Partial<StatusFeldEintrag>): void => api.setFeld(f.feldId, patch);
  return (
    <tr className="border-b border-[var(--tf-border)] hover:bg-[var(--tf-hover)]">
      <td className={`${tdKlasse} text-[12px] text-[var(--tf-text-secondary)] font-mono whitespace-nowrap`} title={f.feldId}>
        <div className="flex items-center gap-1.5">
          <span>{f.code ?? f.feldId}</span>
          {f.unkuratiert && <Badge variant="warning">neu</Badge>}
        </div>
      </td>
      <td className={`${tdKlasse} text-[12px] text-[var(--tf-text-tertiary)] font-mono whitespace-nowrap`}>
        {csvSpalte}
      </td>
      <td className={`${tdKlasse} min-w-[240px]`}>
        <input value={f.label} placeholder={f.feldId} className={feldKlasse} style={feldStil}
          onChange={e => set({ label: e.target.value })} />
      </td>
      <td className={`${tdKlasse} text-[12px] text-[var(--tf-text-secondary)]`}>{TYP_LABEL[f.typ]}</td>
      <td className={`${tdKlasse} min-w-[190px]`}>
        <select value={ordnerVon(f)} className={feldKlasse} style={feldStil}
          onChange={e => set({ kategorieId: e.target.value })}>
          {ordnerWahl.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </td>
      <td className={`${tdKlasse} min-w-[104px]`}>
        <select value={f.zustaendigkeit ?? 'beide'} className={feldKlasse} style={feldStil}
          onChange={e => set({ zustaendigkeit: e.target.value as Zustaendigkeit })}>
          {ZUSTAENDIGKEIT_WERTE.map(z => <option key={z} value={z}>{ZUSTAENDIGKEIT_LABEL[z]}</option>)}
        </select>
      </td>
      <td className={`${tdKlasse} min-w-[124px]`}>
        <select value={f.prominenzDefault} className={feldKlasse} style={feldStil}
          onChange={e => set({ prominenzDefault: e.target.value as Prominenz })}>
          {PROMINENZ_WERTE.map(p => <option key={p} value={p}>{PROMINENZ_LABEL[p]}</option>)}
        </select>
      </td>
      {/* Wert-Felder holen Phase und Rang aus dem Wert, nicht aus dem Feld —
          dort wären die Eingaben wirkungslos und würden nur in die Irre führen. */}
      <td className={`${tdKlasse} min-w-[124px]`}>
        {f.typ === 'wert' ? <span className="text-[12px] text-[var(--tf-text-tertiary)]">je Wert</span> : (
          <select value={f.spinePhase ?? 'keine'} className={feldKlasse} style={feldStil}
            onChange={e => set({ spinePhase: e.target.value as SpinePhase })}>
            {SPINE_WERTE.map(p => <option key={p} value={p}>{SPINE_LABEL[p]}</option>)}
          </select>
        )}
      </td>
      <td className={`${tdKlasse} w-[64px]`}>
        {f.typ === 'wert' ? null : (
          <input type="number" value={f.rang ?? 0} className={feldKlasse} style={feldStil}
            title="0 = trägt nicht zur Statusableitung bei"
            onChange={e => set({ rang: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 0 })} />
        )}
      </td>
      <td className={`${tdKlasse} text-center`}>
        {f.typ === 'wert' ? null : (
          <input type="checkbox" className="accent-[var(--tf-primary)] cursor-pointer"
            checked={f.terminal === true} onChange={e => set({ terminal: e.target.checked })} />
        )}
      </td>
      <td className={`${tdKlasse} text-center`}>
        <input type="checkbox" className="accent-[var(--tf-primary)] cursor-pointer"
          checked={f.aktiv} onChange={e => set({ aktiv: e.target.checked })} />
      </td>
    </tr>
  );
}

export function FelderTab({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  const [suche, setSuche] = useState('');
  const [ebeneFilter, setEbeneFilter] = useState<'alle' | 'verbund' | 'tv'>('alle');
  const [zustFilter, setZustFilter] = useState<'alle' | Zustaendigkeit>('alle');
  const [nurMitRang, setNurMitRang] = useState(false);
  const [ordnerOffen, setOrdnerOffen] = useState(false);
  const [zu, setZu] = useState<ReadonlySet<string>>(() => new Set());

  const entwurf = api.entwurf;
  const kategorien = useMemo(() => entwurf?.kategorien ?? [], [entwurf]);

  /** Ordner-Auswahl je Ebene, in Baum-Reihenfolge und eingerückt beschriftet. */
  const ordnerWahl = useMemo(() => {
    const je: Record<'verbund' | 'tv', { id: string; label: string }[]> = { verbund: [], tv: [] };
    for (const ebene of ['verbund', 'tv'] as const) {
      je[ebene] = flacheBaumListe(kategorien, ebene)
        .map(({ kategorie, tiefe }) => ({ id: kategorie.id, label: `${'  '.repeat(tiefe)}${kategorie.label}` }));
    }
    return je;
  }, [kategorien]);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return (entwurf?.felder ?? []).filter(f => {
      if (ebeneFilter !== 'alle' && f.ebene !== ebeneFilter) return false;
      if (zustFilter !== 'alle' && (f.zustaendigkeit ?? 'beide') !== zustFilter) return false;
      if (nurMitRang && (f.rang ?? 0) === 0) return false;
      if (!q) return true;
      const spalten = api.csvSpalten.get(f.feldId)?.join(' ') ?? '';
      return `${f.code ?? ''} ${f.feldId} ${f.label} ${spalten}`.toLowerCase().includes(q);
    });
  }, [entwurf, suche, ebeneFilter, zustFilter, nurMitRang, api.csvSpalten]);

  if (!entwurf) return null;

  const proOrdner = new Map<string, StatusFeldEintrag[]>();
  for (const f of gefiltert) {
    const id = ordnerVon(f);
    const liste = proOrdner.get(id);
    if (liste) liste.push(f); else proOrdner.set(id, [f]);
  }

  const mitRang = entwurf.felder.filter(f => (f.rang ?? 0) > 0).length;

  return (
    <div className="flex flex-col gap-3 pt-3">
      <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
        {entwurf.felder.length} Felder in {kategorien.length} Ordnern · {mitRang} davon wirken auf die
        Statusableitung. Ein Feld ohne Rang wird erfasst und angezeigt, hebt aber keine Phase.
      </p>

      {api.seedLuecke.felder > 0 && (
        <div className="flex items-center justify-between gap-2 rounded px-2.5 py-2" style={feldStil}>
          <span className="text-[12.5px] text-[var(--tf-text)]">
            Die Auslieferung führt {api.seedLuecke.felder} Statusfelder
            {api.seedLuecke.kategorien > 0 ? ` und ${api.seedLuecke.kategorien} Ordner` : ''}, die dieser
            Fassung fehlen.
          </span>
          <Button variant="secondary" size="sm" onClick={api.seedNachziehen}>Nachziehen</Button>
        </div>
      )}

      {api.unkuratierteFelder.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h3 className="text-[12px] font-medium text-[var(--tf-text-secondary)] uppercase tracking-wide">
            In den CSV-Quellen gefunden — noch nicht im Katalog
          </h3>
          {api.unkuratierteFelder.map(f => (
            <div key={f.feldId} className="flex items-center justify-between gap-2 rounded px-2.5 py-2" style={feldStil}>
              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                <Badge variant="warning">neu</Badge>
                <span className="text-[11px] font-mono text-[var(--tf-text-tertiary)]">{f.feldId}</span>
                <span className="text-[12.5px] text-[var(--tf-text)]">{f.label}</span>
                <span className="text-[11px] text-[var(--tf-text-tertiary)]">{EBENE_LABEL[f.ebene]}</span>
              </div>
              <Button
                variant="secondary" size="sm"
                onClick={() => api.uebernehmeFeld(f, NICHT_ZUGEORDNET_ID[f.ebene])}
              >
                Übernehmen
              </Button>
            </div>
          ))}
        </section>
      )}

      <div className="flex flex-col gap-2">
        <input
          value={suche} placeholder="Code, Spalte oder Bezeichnung suchen …"
          className="w-full max-w-[360px] text-[12.5px] rounded px-2.5 py-1.5 bg-[var(--tf-bg)] text-[var(--tf-text)]"
          style={feldStil} onChange={e => setSuche(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {(['alle', 'verbund', 'tv'] as const).map(e => (
            <ToggleChip
              key={e} label={e === 'alle' ? 'Alle Ebenen' : EBENE_LABEL[e]}
              selected={ebeneFilter === e} onToggle={() => setEbeneFilter(e)}
            />
          ))}
          <span className="w-2" />
          {(['alle', ...ZUSTAENDIGKEIT_WERTE] as const).map(z => (
            <ToggleChip
              key={z} label={z === 'alle' ? 'Alle Zuständigkeiten' : ZUSTAENDIGKEIT_LABEL[z]}
              selected={zustFilter === z} onToggle={() => setZustFilter(z)}
            />
          ))}
          <span className="w-2" />
          <ToggleChip label="nur mit Rang" selected={nurMitRang} onToggle={() => setNurMitRang(v => !v)} />
        </div>
      </div>

      <div>
        <button
          type="button" onClick={() => setOrdnerOffen(v => !v)} aria-expanded={ordnerOffen}
          className="flex items-center gap-1.5 cursor-pointer"
        >
          <ChevronRight
            size={14} className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0"
            style={{ transform: ordnerOffen ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
          <span className="text-[13px] font-medium text-[var(--tf-text)]">Ordner bearbeiten</span>
        </button>
        <div className={ordnerOffen ? 'mt-2' : 'hidden'}>
          <KategorieEditor api={api} />
        </div>
      </div>

      {(['verbund', 'tv'] as const)
        .filter(ebene => ebeneFilter === 'alle' || ebeneFilter === ebene)
        .map(ebene => (
          <section key={ebene} className="flex flex-col gap-1">
            <h3 className="text-[12px] font-medium text-[var(--tf-text-secondary)] uppercase tracking-wide">
              {EBENE_LABEL[ebene]}
            </h3>
            {flacheBaumListe(kategorien, ebene).map(({ kategorie, tiefe }) => {
              const felder = proOrdner.get(kategorie.id) ?? [];
              if (felder.length === 0) return null;
              const offen = !zu.has(kategorie.id);
              return (
                <div key={kategorie.id} style={{ marginLeft: tiefe * 14 }}>
                  <button
                    type="button" aria-expanded={offen}
                    className="flex items-center gap-1.5 py-1 cursor-pointer"
                    onClick={() => setZu(s => {
                      const next = new Set(s);
                      if (next.has(kategorie.id)) next.delete(kategorie.id); else next.add(kategorie.id);
                      return next;
                    })}
                  >
                    <ChevronRight
                      size={13} className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0"
                      style={{ transform: offen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                    />
                    <span className="text-[13px] font-medium text-[var(--tf-text)]">{kategorie.label}</span>
                    <span className="text-[11px] text-[var(--tf-text-tertiary)]">{felder.length}</span>
                    {!kategorie.aktiv && <Badge variant="default">stillgelegt</Badge>}
                  </button>
                  <div className={offen ? 'overflow-x-auto rounded' : 'hidden'} style={feldStil}>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-[var(--tf-border)] bg-[var(--tf-bg-secondary)]">
                          <th className={thKlasse}>Code</th>
                          <th className={thKlasse}>CSV-Spalte</th>
                          <th className={thKlasse}>Bezeichnung</th>
                          <th className={thKlasse}>Typ</th>
                          <th className={thKlasse}>Ordner</th>
                          <th className={thKlasse} title="Administrative bzw. fachliche Bearbeitung">Zuständig</th>
                          <th className={thKlasse}>Prominenz</th>
                          <th className={thKlasse}>Spine-Phase</th>
                          <th className={thKlasse}>Rang</th>
                          <th className={`${thKlasse} text-center`}>terminal</th>
                          <th className={`${thKlasse} text-center`}>aktiv</th>
                        </tr>
                      </thead>
                      <tbody>
                        {felder.map(f => (
                          <FeldZeile
                            key={f.feldId} f={f} api={api} ordnerWahl={ordnerWahl[f.ebene]}
                            csvSpalte={api.csvSpalten.get(f.feldId)?.join(', ') ?? '—'}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </section>
        ))}

      {gefiltert.length === 0 && (
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)] px-3 py-4">
          Keine Felder für die aktuellen Filter.
        </p>
      )}
    </div>
  );
}
