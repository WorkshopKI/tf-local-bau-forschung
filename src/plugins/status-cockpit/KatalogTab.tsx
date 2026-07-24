/**
 * Katalog-Tab — die Statuswerte kuratieren.
 *
 * Volle Tabelle der Wert-Einträge des Entwurfs mit Inline-Bearbeitung
 * (Label, Kategorie, Spine-Phase, Rang, Prominenz, terminal, aktiv), darüber
 * Filter-Chips + Suche, darunter die Übernahme neu entdeckter (unkuratierter)
 * Funde. Rein darstellend — jede Änderung geht über `api.setWert` in den Entwurf.
 */
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { wertId } from './useStatusCockpit';
import type { StatusCockpitApi } from './useStatusCockpit';
import type { StatusWertEintrag, StatusCategory, SpinePhase, Prominenz, UnkuratierterFund } from '@/core/status';
import {
  KATEGORIE_LABEL, KATEGORIE_WERTE, PROMINENZ_LABEL, PROMINENZ_WERTE,
  SPINE_LABEL, SPINE_WERTE, feldKlasse, feldStil, formatDatum,
} from './labels';

function toggleIn<T>(set: ReadonlySet<T>, val: T): Set<T> {
  const next = new Set(set);
  if (next.has(val)) next.delete(val);
  else next.add(val);
  return next;
}

const thKlasse = 'text-left font-medium text-[11px] text-[var(--tf-text-tertiary)] px-2 py-1.5 whitespace-nowrap';
const tdKlasse = 'px-2 py-1.5 align-middle';

function WertZeile({ w, api }: { w: StatusWertEintrag; api: StatusCockpitApi }): React.ReactElement {
  const key = wertId(w.feldId, w.wert);
  return (
    <tr className="border-b border-[var(--tf-border)] hover:bg-[var(--tf-hover)]">
      <td className={`${tdKlasse} text-[12px] text-[var(--tf-text-secondary)] font-mono whitespace-nowrap`}>{w.feldId}</td>
      <td className={`${tdKlasse} text-[12px] text-[var(--tf-text)]`}>
        <div className="flex items-center gap-1.5">
          <span>{w.wert}</span>
          {w.unkuratiert && <Badge variant="warning">unkuratiert</Badge>}
        </div>
      </td>
      <td className={`${tdKlasse} min-w-[130px]`}>
        <input
          value={w.label ?? ''} placeholder={w.wert} className={feldKlasse} style={feldStil}
          onChange={e => api.setWert(w.id, { label: e.target.value })}
        />
      </td>
      <td className={`${tdKlasse} min-w-[128px]`}>
        <select
          value={w.kategorie} className={feldKlasse} style={feldStil}
          onChange={e => api.setWert(w.id, { kategorie: e.target.value as StatusCategory })}
        >
          {KATEGORIE_WERTE.map(k => <option key={k} value={k}>{KATEGORIE_LABEL[k]}</option>)}
        </select>
      </td>
      <td className={`${tdKlasse} min-w-[124px]`}>
        <select
          value={w.spinePhase} className={feldKlasse} style={feldStil}
          onChange={e => api.setWert(w.id, { spinePhase: e.target.value as SpinePhase })}
        >
          {SPINE_WERTE.map(p => <option key={p} value={p}>{SPINE_LABEL[p]}</option>)}
        </select>
      </td>
      <td className={`${tdKlasse} w-[64px]`}>
        <input
          type="number" value={w.rang} className={feldKlasse} style={feldStil}
          onChange={e => api.setWert(w.id, { rang: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 0 })}
        />
      </td>
      <td className={`${tdKlasse} min-w-[124px]`}>
        <select
          value={w.prominenz} className={feldKlasse} style={feldStil}
          onChange={e => api.setWert(w.id, { prominenz: e.target.value as Prominenz })}
        >
          {PROMINENZ_WERTE.map(p => <option key={p} value={p}>{PROMINENZ_LABEL[p]}</option>)}
        </select>
      </td>
      <td className={`${tdKlasse} text-center`}>
        <input
          type="checkbox" className="accent-[var(--tf-primary)] cursor-pointer" checked={w.terminal}
          onChange={e => api.setWert(w.id, { terminal: e.target.checked })}
        />
      </td>
      <td className={`${tdKlasse} text-center`}>
        <input
          type="checkbox" className="accent-[var(--tf-primary)] cursor-pointer" checked={w.aktiv}
          onChange={e => api.setWert(w.id, { aktiv: e.target.checked })}
        />
      </td>
      <td className={`${tdKlasse} text-right text-[12px] text-[var(--tf-text-secondary)] font-mono`}>
        {api.vorkommen.get(key) ?? 0}
      </td>
      <td className={`${tdKlasse} text-right text-[12px] text-[var(--tf-text-tertiary)] whitespace-nowrap`}>
        {formatDatum(api.zuletzt.get(key))}
      </td>
    </tr>
  );
}

export function KatalogTab({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  const [suche, setSuche] = useState('');
  const [katFilter, setKatFilter] = useState<ReadonlySet<StatusCategory>>(() => new Set());
  const [promFilter, setPromFilter] = useState<ReadonlySet<Prominenz>>(() => new Set());
  const [nurUnkuratiert, setNurUnkuratiert] = useState(false);

  const werte = api.entwurf?.werte ?? [];
  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return werte.filter(w => {
      if (katFilter.size > 0 && !katFilter.has(w.kategorie)) return false;
      if (promFilter.size > 0 && !promFilter.has(w.prominenz)) return false;
      if (nurUnkuratiert && !w.unkuratiert) return false;
      if (q) {
        const hay = `${w.feldId} ${w.wert} ${w.label ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [werte, suche, katFilter, promFilter, nurUnkuratiert]);

  if (!api.entwurf) return null;

  return (
    <div className="flex flex-col gap-3 pt-3">
      {api.unkuratiert.length > 0 && (
        <p className="text-[12.5px] text-[var(--tf-warning-text)]">
          {api.unkuratiert.length} neue Statuswerte seit letztem Import
        </p>
      )}

      <div className="flex flex-col gap-2">
        <input
          value={suche} placeholder="Feld, Rohwert oder Label suchen …"
          className="w-full max-w-[360px] text-[12.5px] rounded px-2.5 py-1.5 bg-[var(--tf-bg)] text-[var(--tf-text)]"
          style={feldStil}
          onChange={e => setSuche(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5">
          {KATEGORIE_WERTE.map(k => (
            <ToggleChip
              key={k} label={KATEGORIE_LABEL[k]} selected={katFilter.has(k)}
              onToggle={() => setKatFilter(s => toggleIn(s, k))}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {PROMINENZ_WERTE.map(p => (
            <ToggleChip
              key={p} label={PROMINENZ_LABEL[p]} selected={promFilter.has(p)}
              onToggle={() => setPromFilter(s => toggleIn(s, p))}
            />
          ))}
          <ToggleChip
            label="nur unkuratiert" selected={nurUnkuratiert}
            onToggle={() => setNurUnkuratiert(v => !v)}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded" style={feldStil}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--tf-border)] bg-[var(--tf-bg-secondary)]">
              <th className={thKlasse}>Feld</th>
              <th className={thKlasse}>Rohwert</th>
              <th className={thKlasse}>Label</th>
              <th className={thKlasse}>Kategorie</th>
              <th className={thKlasse}>Spine-Phase</th>
              <th className={thKlasse}>Rang</th>
              <th className={thKlasse}>Prominenz</th>
              <th className={`${thKlasse} text-center`}>terminal</th>
              <th className={`${thKlasse} text-center`}>aktiv</th>
              <th className={`${thKlasse} text-right`}>Vorkommen</th>
              <th className={`${thKlasse} text-right`}>zuletzt gesehen</th>
            </tr>
          </thead>
          <tbody>
            {gefiltert.map(w => <WertZeile key={w.id} w={w} api={api} />)}
          </tbody>
        </table>
        {gefiltert.length === 0 && (
          <p className="text-[12.5px] text-[var(--tf-text-tertiary)] px-3 py-4">
            Keine Statuswerte für die aktuellen Filter.
          </p>
        )}
      </div>

      {api.unkuratiert.length > 0 && (
        <section className="flex flex-col gap-1.5 mt-2">
          <h3 className="text-[12px] font-medium text-[var(--tf-text-secondary)] uppercase tracking-wide">
            Unkuratiert — neu entdeckt
          </h3>
          {api.unkuratiert.map((fund: UnkuratierterFund) => (
            <div
              key={fund.id}
              className="flex items-center justify-between gap-2 rounded px-2.5 py-2"
              style={feldStil}
            >
              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                <Badge variant="warning">unkuratiert</Badge>
                <span className="text-[12px] font-mono text-[var(--tf-text-secondary)]">{fund.feldId}</span>
                <span className="text-[12.5px] text-[var(--tf-text)]">{fund.wert}</span>
                <span className="text-[11px] text-[var(--tf-text-tertiary)]">
                  seit {formatDatum(fund.erstmalsGesehen)}
                </span>
              </div>
              <Button variant="secondary" size="sm" onClick={() => api.uebernehmen(fund)}>Übernehmen</Button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
