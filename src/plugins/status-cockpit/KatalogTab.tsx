/**
 * Katalog-Tab — die Statuswerte kuratieren.
 *
 * Volle Tabelle der Wert-Einträge des Entwurfs mit Inline-Bearbeitung (Label,
 * Kategorie, Prominenz, Zieltage, aktiv), darüber Filter-Chips + Suche, darunter
 * die Übernahme neu entdeckter (unkuratierter) Funde. Rein darstellend — jede
 * Änderung geht über `api.setWert` in den Entwurf.
 *
 * Spine-Phase, Rang und das Terminal-Häkchen sind mit v2.385 entfallen: sie
 * waren die Stellschrauben der alten Statusableitung. Kuratiert werden jetzt
 * Zieltage — eine Angabe ÜBER den amtlichen Status, keine, aus der einer
 * errechnet würde (Pitfall #44).
 *
 * **Zwei Sichten, ein Katalog** (seit v2.409). Der Verfahrensschritt wird im
 * BAUM kuratiert (`PhasenBaum.tsx`) — dort ist Umhängen ein Zug und keine
 * Auswahl in einem Dropdown, das man 30-mal öffnet. Diese Tabelle zeigt ihn nur;
 * dafür kann sie, was der Baum bewusst nicht kann: Filterchips, Feld- und
 * CSV-Spalten, alle Zeilen nebeneinander. Sie zu ersetzen wäre ein Rückschritt.
 *
 * Ein früherer Modulkopf schrieb hier „Die ZAH-Phase wird NICHT kuratiert" —
 * mit der Begründung, `prod` lade keine Fassung. Der Einwand gilt weiter und ist
 * am Modulkopf von `zah-phasen.ts` aufgelöst.
 */
import { useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { wertId } from './useStatusCockpit';
import type { StatusCockpitApi } from './useStatusCockpit';
import { PhasenBaum } from './PhasenBaum';
import { ZieltageUebernahmeDialog } from './ZieltageUebernahmeDialog';
import { isVorgangssystemEnabled } from '@/config/feature-flags';
import { feldLabel, zahPhaseLabel, ohneVerwaiste, SEED_CODE_ZU_ZAH_PHASE } from '@/core/status';
import type { StatusWertEintrag, StatusCategory, Prominenz, UnkuratierterFund } from '@/core/status';
import {
  KATEGORIE_LABEL, KATEGORIE_WERTE, PROMINENZ_LABEL, PROMINENZ_WERTE,
  feldKlasse, feldKlasseSchmal, feldStil, formatDatum,
} from './labels';

function toggleIn<T>(set: ReadonlySet<T>, val: T): Set<T> {
  const next = new Set(set);
  if (next.has(val)) next.delete(val);
  else next.add(val);
  return next;
}

const thKlasse = 'text-left font-medium text-[11px] text-[var(--tf-text-tertiary)] px-2 py-1.5 whitespace-nowrap';
const tdKlasse = 'px-2 py-1.5 align-middle';

/**
 * Die Phase eines Wert-Eintrags, wie die Fassung sie führt: kuratiert schlägt
 * Auslieferung, `null` heißt bewusst Marker. Dieselbe dreiwertige Lesung wie in
 * `schnittVon` und `baueHerleitung`.
 */
function phaseVon(w: StatusWertEintrag): string | null {
  if (w.zahPhaseId !== undefined) return w.zahPhaseId;
  return w.code !== undefined ? SEED_CODE_ZU_ZAH_PHASE.get(w.code) ?? null : null;
}

function WertZeile({ w, feldName, csvSpalte, api, zeigeZieltage, vorschlag }: {
  w: StatusWertEintrag; feldName: string; csvSpalte: string; api: StatusCockpitApi;
  /** Zieltage-Spalte nur im Vorgangssystem — sonst hätte sie keinen Konsumenten. */
  zeigeZieltage: boolean;
  /** Median-Liegezeit dieses Status aus dem Bestand, falls messbar. */
  vorschlag: { median: number; n: number } | undefined;
}): React.ReactElement {
  const key = wertId(w.feldId, w.wert);
  return (
    <tr className="border-b border-[var(--tf-border)] hover:bg-[var(--tf-hover)]">
      {/* Der kuratierte Feldname, nicht die technische feldId („status" ist der
          TV-Status). Die feldId bleibt im Tooltip — sie ist der Record-Key. */}
      <td className={`${tdKlasse} text-[12px] text-[var(--tf-text-secondary)] whitespace-nowrap`} title={w.feldId}>
        {feldName}
      </td>
      <td className={`${tdKlasse} text-[12px] text-[var(--tf-text-tertiary)] font-mono whitespace-nowrap`}>
        {csvSpalte}
      </td>
      <td className={`${tdKlasse} text-[12px] text-[var(--tf-text)]`}>
        <div className="flex items-center gap-1.5">
          <span>{w.wert}</span>
          {w.unkuratiert && <Badge variant="warning">unkuratiert</Badge>}
        </div>
      </td>
      <td className={`${tdKlasse} min-w-[130px]`}>
        {/* Leeres Label heißt: es gilt der Rohwert. Der Platzhalter sagt das,
            statt den Rohwert zu spiegeln — sonst sehen beide Spalten gleich aus
            und man hält das ungesetzte Label für einen gesetzten Wert. */}
        <input
          value={w.label ?? ''} placeholder="wie Rohwert" className={feldKlasse} style={feldStil}
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
          value={w.prominenz} className={feldKlasse} style={feldStil}
          onChange={e => api.setWert(w.id, { prominenz: e.target.value as Prominenz })}
        >
          {PROMINENZ_WERTE.map(p => <option key={p} value={p}>{PROMINENZ_LABEL[p]}</option>)}
        </select>
      </td>
      {zeigeZieltage && (
        // Read-only in DIESER Tabelle — kuratiert wird im Baum-Editor. Die Zelle
        // liest deshalb den Schnitt der FASSUNG und nicht mehr die rohe
        // Seed-Tabelle: sonst zeigte sie nach dem ersten Umhängen weiter die
        // ausgelieferte Phase und widerspräche dem Baum daneben.
        <td
          className={`${tdKlasse} text-[12px] text-[var(--tf-text-tertiary)] whitespace-nowrap w-[112px]`}
          title={'Verfahrensschritt dieses Status. Änderbar im Baum („Phasen und Zuordnung").'}
        >
          {w.code === undefined
            ? '—'
            : zahPhaseLabel(phaseVon(w), api.entwurf?.zahPhasen)}
        </td>
      )}
      {zeigeZieltage && (
        <td className={`${tdKlasse} w-[132px]`}>
          <div className="flex items-center gap-1">
            <input
              type="number" min={0} value={w.zieltage ?? ''} placeholder="—"
              className={`${feldKlasseSchmal} w-[58px]`} style={feldStil}
              title="Nach wie vielen Tagen ohne Aktivität gilt dieser Status als hängend? Leer = nicht bewertbar."
              onChange={e => api.setWert(w.id, {
                zieltage: e.target.value === '' ? null
                  : (Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : null),
              })}
            />
            {/* Der Vorschlag wird ZEILENWEISE übernommen, nie im Block: er ist
                eine Näherung aus dem Ist, kein Sollwert. */}
            {vorschlag !== undefined && w.zieltage !== vorschlag.median && (
              <button
                type="button"
                onClick={() => api.setWert(w.id, { zieltage: vorschlag.median })}
                title={`Median der Ist-Liegezeiten: ${vorschlag.median} Tage (n = ${vorschlag.n})`}
                className="text-[10.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer underline whitespace-nowrap"
              >
                ⌀{vorschlag.median}
              </button>
            )}
          </div>
        </td>
      )}
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

/**
 * Baum oder Tabelle — zwei Sichten auf denselben Katalog.
 *
 * Der Baum ist vorbelegt, weil er die Handlung abbildet, um die es geht:
 * umhängen. Die Tabelle bleibt vollständig daneben — sie kann Massen-
 * bearbeitung, Filterchips und die Feld-Spalten, die der Baum bewusst nicht
 * zeigt. Sie zu ersetzen wäre ein Rückschritt, kein Fortschritt.
 */
type Sicht = 'baum' | 'tabelle';

export function KatalogTab({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  const zeigeZieltage = isVorgangssystemEnabled();
  const [sicht, setSicht] = useState<Sicht>('baum');
  const [suche, setSuche] = useState('');
  const [katFilter, setKatFilter] = useState<ReadonlySet<StatusCategory>>(() => new Set());
  const [promFilter, setPromFilter] = useState<ReadonlySet<Prominenz>>(() => new Set());
  const [nurUnkuratiert, setNurUnkuratiert] = useState(false);
  const [zieltageOffen, setZieltageOffen] = useState(false);

  const entwurf = api.entwurf;
  const werte = entwurf?.werte ?? [];
  /** feldId → kuratierter Feldname (eine Quelle: `feldLabel`). */
  const feldName = useCallback(
    (feldId: string): string => (entwurf ? feldLabel(entwurf, feldId) : feldId),
    [entwurf],
  );
  /** feldId → CSV-Spalte(n); ungemappt → „—". */
  const csvSpalte = useCallback(
    (feldId: string): string => api.csvSpalten.get(feldId)?.join(', ') ?? '—',
    [api.csvSpalten],
  );

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return werte.filter(w => {
      if (katFilter.size > 0 && !katFilter.has(w.kategorie)) return false;
      if (promFilter.size > 0 && !promFilter.has(w.prominenz)) return false;
      if (nurUnkuratiert && !w.unkuratiert) return false;
      if (q) {
        // Suche greift auf alles, wonach man einen Status sucht: technischer
        // Key, Feldname, CSV-Spalte, Rohwert, Label.
        const hay = `${w.feldId} ${feldName(w.feldId)} ${csvSpalte(w.feldId)} ${w.wert} ${w.label ?? ''}`
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [werte, suche, katFilter, promFilter, nurUnkuratiert, feldName, csvSpalte]);

  if (!entwurf) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pt-3">
      {/* Die Umschaltung steht ganz oben: sie entscheidet, was darunter kommt. */}
      {zeigeZieltage && (
        <ScopeTabs
          variant="segmented"
          aria-label="Ansicht des Status-Katalogs"
          className="shrink-0 self-start"
          activeKey={sicht}
          onChange={k => setSicht(k as Sicht)}
          items={[
            { key: 'baum', label: 'Phasen und Zuordnung' },
            { key: 'tabelle', label: 'Tabelle', count: werte.length },
          ]}
        />
      )}

      {zeigeZieltage && sicht === 'baum' && <PhasenBaum api={api} />}

      {(!zeigeZieltage || sicht === 'tabelle') && (
      <>
      {api.unkuratiert.length > 0 && (
        <p className="text-[12.5px] text-[var(--tf-warning-text)]">
          {api.unkuratiert.length} neue Statuswerte seit letztem Import
        </p>
      )}

      {/* Verwaist heißt: die Zuordnung zeigt auf einen Verfahrensschritt, den es
          nicht mehr gibt. Gelesen wird sie wie „ohne Phase" — aber sie wird
          gezählt, sonst nähme ein gelöschter Schritt still Statuswerte aus
          Gruppierung, Zieltagen und Wächter. */}
      {!ohneVerwaiste(api.verwaiste) && (
        <p className="text-[12.5px] text-[var(--tf-warning-text)]">
          {api.verwaiste.werte > 0 && `${api.verwaiste.werte} Statuswerte`}
          {api.verwaiste.werte > 0 && api.verwaiste.felder > 0 && ' und '}
          {api.verwaiste.felder > 0 && `${api.verwaiste.felder} Datumsfelder`}
          {' '}zeigen auf einen Verfahrensschritt, den diese Fassung nicht mehr führt.
          Sie zählen bis auf Weiteres als „ohne Phase".
        </p>
      )}

      {/* Sammel-Weg neben dem zeilenweisen: 74 Werte einzeln zu setzen war der
          Grund, warum der Wächter für den halben Bestand schweigt. Was er setzt,
          steht vorher in der Vorschau — inklusive dessen, was er NICHT setzt. */}
      {zeigeZieltage && api.zieltageAuswahl.uebernehmen.length > 0 && (
        <div className="flex items-center justify-between gap-2 rounded px-2.5 py-2" style={feldStil}>
          <span className="text-[12.5px] text-[var(--tf-text)]">
            Für {api.zieltageAuswahl.uebernehmen.length} Statuswerte der Phasen Eingang bis
            Entscheidung liegt ein Zieltage-Vorschlag aus dem Ist vor
            {api.zieltageAuswahl.zuWenigDaten.length > 0
              && ` (${api.zieltageAuswahl.zuWenigDaten.length} weitere haben zu wenig Daten)`}.
          </span>
          <Button variant="secondary" size="sm" onClick={() => setZieltageOffen(true)}>
            Vorschläge ansehen
          </Button>
        </div>
      )}

      <ZieltageUebernahmeDialog
        auswahl={api.zieltageAuswahl}
        offen={zieltageOffen}
        darfSchreiben={api.darfSchreiben}
        phasen={entwurf?.zahPhasen}
        onSchliessen={() => setZieltageOffen(false)}
        onUebernehmen={api.zieltageUebernehmen}
      />

      <div className="flex flex-col gap-2">
        <input
          value={suche} placeholder="Feld, CSV-Spalte, Rohwert oder Label suchen …"
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
              <th className={thKlasse}>CSV-Spalte</th>
              <th className={thKlasse}>Rohwert</th>
              <th className={thKlasse}>Label</th>
              <th className={thKlasse}>Kategorie</th>
              <th className={thKlasse}>Prominenz</th>
              {zeigeZieltage && (
                <th
                  className={thKlasse}
                  title="Verfahrensschritt dieses Status. Hier nur zum Lesen — geändert wird er im Baum."
                >
                  ZAH-Phase
                </th>
              )}
              {zeigeZieltage && (
                <th
                  className={thKlasse}
                  title="Nach wie vielen Tagen ohne Vorgangs-Aktivität gilt dieser Status als hängend? Leer heißt: nicht bewertbar — nicht: unauffällig."
                >
                  Zieltage
                </th>
              )}
              <th className={`${thKlasse} text-center`}>aktiv</th>
              <th className={`${thKlasse} text-right`}>Vorkommen</th>
              <th className={`${thKlasse} text-right`}>zuletzt gesehen</th>
            </tr>
          </thead>
          <tbody>
            {gefiltert.map(w => (
              <WertZeile
                key={w.id} w={w} api={api}
                feldName={feldName(w.feldId)} csvSpalte={csvSpalte(w.feldId)}
                zeigeZieltage={zeigeZieltage}
                vorschlag={w.code !== undefined ? api.liegezeitVorschlag.get(w.code) : undefined}
              />
            ))}
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
                <span className="text-[12px] text-[var(--tf-text-secondary)]" title={fund.feldId}>
                  {feldName(fund.feldId)}
                </span>
                <span className="text-[11px] font-mono text-[var(--tf-text-tertiary)]">
                  {csvSpalte(fund.feldId)}
                </span>
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
      </>
      )}
    </div>
  );
}
