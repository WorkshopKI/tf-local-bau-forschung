/**
 * Katalog-Tab — die Statuswerte kuratieren.
 *
 * Volle Tabelle der Wert-Einträge des Entwurfs mit Inline-Bearbeitung (Label,
 * Kategorie, Prominenz, Zieltage, aktiv), darüber Suche + Filter-Chips, darunter
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
 * dafür kann sie, was der Baum bewusst nicht kann: Filterchips, Sortierung,
 * Spaltenfilter, alle Zeilen nebeneinander. Sie zu ersetzen wäre ein Rückschritt.
 *
 * Die Tabelle selbst ist seit v2.411 der geteilte `SortableTable`; Zeilen-Modell
 * und Spalten liegen daneben (`katalogZeilen.ts`, `katalogSpalten.tsx`), der
 * Export in `katalogExport.ts`. Diese Datei hält nur noch Filterzustand und
 * Seitenaufbau.
 *
 * Ein früherer Modulkopf schrieb hier „Die ZAH-Phase wird NICHT kuratiert" —
 * mit der Begründung, `prod` lade keine Fassung. Der Einwand gilt weiter und ist
 * am Modulkopf von `zah-phasen.ts` aufgelöst.
 */
import { useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import {
  SortableTable, useTableSort, useColumnFilters, useColumnWidths,
} from '@/components/data-table';
import { zaehlwort } from '@/core/utils/zaehlwort';
import type { StatusCockpitApi } from './useStatusCockpit';
import { PhasenBaum } from './PhasenBaum';
import { ZieltageUebernahmeDialog } from './ZieltageUebernahmeDialog';
import { isVorgangssystemEnabled } from '@/config/feature-flags';
import { feldLabel, ohneVerwaiste, SEED_ZAH_PHASEN } from '@/core/status';
import type { StatusCategory, Prominenz, UnkuratierterFund } from '@/core/status';
import { KatalogDriftZeile } from './KatalogDriftZeile';
import { KurzLabelPflege } from './KurzLabelPflege';
import { baueKatalogZeilen, effektiveKategorieVon } from './katalogZeilen';
import { baueKatalogSpalten } from './katalogSpalten';
import { exportiereKatalogXlsx } from './katalogExport';
import {
  KATEGORIE_LABEL, KATEGORIE_WERTE, PROMINENZ_LABEL, PROMINENZ_WERTE,
  feldStil, formatDatum,
} from './labels';

/**
 * Die Phasen-Achse in beide Richtungen — **als Paar**.
 *
 * Der Import ist derselbe wie im Seitenkopf: eine Datei, eine Weiche, kein
 * zweiter Weg. Trotzdem steht er hier ein zweites Mal, und zwar aus dem Grund,
 * aus dem es diese Komponente überhaupt gibt: ein Knopf „Phasen exportieren"
 * ohne sichtbares Gegenstück schickt Monate später jemanden auf die Suche nach
 * einem „Phasen importieren", das es nur unter anderem Namen gibt. Die
 * Beschriftung gehört dorthin, wo gesucht wird — die Logik bleibt eine.
 */
function PhasenAustausch({ api }: { api: StatusCockpitApi }): React.ReactElement {
  const importieren = useAsyncAction(async () => { await api.importieren(); });
  return (
    <div className="ml-auto flex flex-wrap items-center gap-1.5">
      {importieren.error != null && (
        <span className="text-[11.5px] text-[var(--tf-danger-text)]">⚠ {importieren.error}</span>
      )}
      <Button
        variant="ghost" size="sm" icon={Download}
        disabled={!api.entwurf}
        title={'Nur den Verfahrensschnitt: Phasen, ihre Zuordnungen und die Zieltage. '
          + 'Die Kürzel sind nicht darin — die bleiben am Zielort, wie sie sind. '
          + 'Mitgenommen wird der Stand, den diese Seite zeigt; ist er noch nicht '
          + 'gespeichert, heißt die Datei „…-entwurf".'}
        onClick={() => api.phasenExportieren()}
      >
        Phasen exportieren
      </Button>
      <Button
        variant="ghost" size="sm" icon={Upload}
        disabled={importieren.busy}
        title={'Ein Phasen-Paket einlesen. Derselbe Dialog wie „Importieren" im '
          + 'Seitenkopf: ein ganzer Katalog wird ebenso erkannt. Übernommen wird in '
          + 'den Entwurf — für das Team gilt es erst nach dem Speichern.'}
        onClick={() => importieren.run()}
      >
        {importieren.busy ? 'Liest …' : 'Phasen importieren'}
      </Button>
    </div>
  );
}

function toggleIn<T>(set: ReadonlySet<T>, val: T): Set<T> {
  const next = new Set(set);
  if (next.has(val)) next.delete(val);
  else next.add(val);
  return next;
}

/**
 * Baum oder Tabelle — zwei Sichten auf denselben Katalog.
 *
 * Der Baum ist vorbelegt, weil er die Handlung abbildet, um die es geht:
 * umhängen. Die Tabelle bleibt vollständig daneben — sie kann Massen-
 * bearbeitung, Filter und Sortierung, die der Baum bewusst nicht zeigt.
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
  const werte = useMemo(() => entwurf?.werte ?? [], [entwurf]);
  const zahPhasen = entwurf?.zahPhasen;
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
      // Die WIRKSAME Arbeitsliste, nicht das gepflegte Feld — sonst filtert der
      // Chip nach einem anderen Vokabular, als die Zelle daneben anzeigt.
      if (katFilter.size > 0 && !katFilter.has(effektiveKategorieVon(w, zahPhasen))) return false;
      if (promFilter.size > 0 && !promFilter.has(w.prominenz)) return false;
      if (nurUnkuratiert && !w.unkuratiert) return false;
      if (q) {
        // Suche greift auf alles, wonach man einen Status sucht: technischer
        // Key, Feldname, CSV-Spalte, Rohwert, Label. Die CSV-Spalte steht seit
        // v2.411 nur noch im Tooltip — gesucht wird sie unverändert.
        const hay = `${w.feldId} ${feldName(w.feldId)} ${csvSpalte(w.feldId)} ${w.wert} ${w.label ?? ''}`
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [werte, suche, katFilter, promFilter, nurUnkuratiert, feldName, csvSpalte, zahPhasen]);

  const zeilen = useMemo(
    () => baueKatalogZeilen(gefiltert, {
      feldName,
      csvSpalte,
      phasen: zahPhasen,
      vorkommen: api.vorkommen,
      zuletzt: api.zuletzt,
      liegezeitVorschlag: api.liegezeitVorschlag,
    }),
    [gefiltert, feldName, csvSpalte, zahPhasen, api.vorkommen, api.zuletzt, api.liegezeitVorschlag],
  );

  const spalten = useMemo(
    () => baueKatalogSpalten({
      zeigeZieltage, setWert: api.setWert, setKurzLabel: api.setKurzLabel,
    }),
    [zeigeZieltage, api.setWert, api.setKurzLabel],
  );
  const standardBreiten = useMemo(
    () => Object.fromEntries(spalten.map(c => [c.key, c.width ?? 120])),
    [spalten],
  );
  const { widths, setWidth, resetWidth } = useColumnWidths('teamflow_status_katalog_col_widths', standardBreiten);
  const { columnFilters, setColumnFilter, filterCandidates, filteredRows, filterCounts } =
    useColumnFilters(zeilen, spalten);
  const { sortKey, sortDirection, toggleSort, sortedRows } = useTableSort(
    filteredRows, spalten, null, 'asc', 'teamflow_status_katalog_sort',
  );

  if (!entwurf) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pt-3">
      {/* Über dem Umschalter, weil die Bilanz für BEIDE Sichten gilt: der Baum
          zeigt die Phasen, die Tabelle die Werte, und der Abstand zur
          Auslieferung betrifft beides. Ohne Drift rendert die Zeile nicht. */}
      {zeigeZieltage && (
        <KatalogDriftZeile
          drift={api.katalogDrift}
          fassungPhasen={zahPhasen}
          seedPhasen={SEED_ZAH_PHASEN}
        />
      )}

      {/* Die Umschaltung steht ganz oben: sie entscheidet, was darunter kommt.
          Rechts daneben die Phasen-Achse in beide Richtungen — sie gehört
          dorthin, wo sie gepflegt wird, nicht in den Seitenkopf zum Voll-Export. */}
      {zeigeZieltage && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ScopeTabs
            variant="segmented"
            aria-label="Ansicht des Status-Katalogs"
            className="shrink-0"
            activeKey={sicht}
            onChange={k => setSicht(k as Sicht)}
            items={[
              { key: 'baum', label: 'Phasen und Zuordnung' },
              { key: 'tabelle', label: 'Tabelle', count: werte.length },
            ]}
          />
          <PhasenAustausch api={api} />
        </div>
      )}

      {zeigeZieltage && sicht === 'baum' && <PhasenBaum api={api} />}

      {(!zeigeZieltage || sicht === 'tabelle') && (
      <>
      {/* Suche und Filter stehen direkt unter dem Umschalter. Bis v2.410 lagen
          sie unter drei Hinweisblöcken — wer die Tabelle filtern wollte, musste
          erst an Meldungen vorbeiscrollen, die ihn nichts angingen. */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={suche} placeholder="Feld, CSV-Spalte, Rohwert oder Label suchen …"
            className="w-full max-w-[360px] text-[12.5px] rounded px-2.5 py-1.5 bg-[var(--tf-bg)] text-[var(--tf-text)]"
            style={feldStil}
            onChange={e => setSuche(e.target.value)}
          />
          <Button
            variant="secondary" size="sm" className="ml-auto"
            disabled={sortedRows.length === 0}
            title={`${zaehlwort(sortedRows.length, 'Zeile', 'Zeilen')} — genau diese Ansicht `
              + 'inklusive Filter und Sortierung, dazu die rohe CSV-Spalte als eigene Spalte.'}
            onClick={() => exportiereKatalogXlsx(sortedRows, spalten, entwurf.version)}
          >
            <Download size={13} /> Tabelle exportieren
          </Button>
        </div>
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

      {api.unkuratiert.length > 0 && (
        <p className="text-[12.5px] text-[var(--tf-warning-text)]">
          {zaehlwort(api.unkuratiert.length, 'neuer Statuswert', 'neue Statuswerte')}
          {' '}seit letztem Import
        </p>
      )}

      {/* Verwaist heißt: die Zuordnung zeigt auf einen Verfahrensschritt, den es
          nicht mehr gibt. Gelesen wird sie wie „ohne Phase" — aber sie wird
          gezählt, sonst nähme ein gelöschter Schritt still Statuswerte aus
          Gruppierung, Zieltagen und Wächter. */}
      {!ohneVerwaiste(api.verwaiste) && (
        <p className="text-[12.5px] text-[var(--tf-warning-text)]">
          Verwaiste Zuordnung bei{' '}
          {api.verwaiste.werte > 0 && zaehlwort(api.verwaiste.werte, 'Statuswert', 'Statuswerten')}
          {api.verwaiste.werte > 0 && api.verwaiste.felder > 0 && ' und '}
          {api.verwaiste.felder > 0 && zaehlwort(api.verwaiste.felder, 'Datumsfeld', 'Datumsfeldern')}
          {' '}— der Verfahrensschritt existiert in dieser Fassung nicht mehr.
          Bewertet wird bis auf Weiteres als „ohne Phase".
        </p>
      )}

      {/* Zwischen den Bestands-Meldungen und dem Zieltage-Sammelweg: dieselbe
          Zone „Bestands-Aussage, die zu einer Kuration führt". Die Liste
          sortiert nach Vorkommen, damit oben angefangen werden kann. */}
      <KurzLabelPflege api={api} />

      {/* Sammel-Weg neben dem zeilenweisen: 74 Werte einzeln zu setzen war der
          Grund, warum der Wächter für den halben Bestand schweigt. Was er setzt,
          steht vorher in der Vorschau — inklusive dessen, was er NICHT setzt. */}
      {zeigeZieltage && api.zieltageAuswahl.uebernehmen.length > 0 && (
        <div className="flex items-center justify-between gap-2 rounded px-2.5 py-2" style={feldStil}>
          <span className="text-[12.5px] text-[var(--tf-text)]">
            Für {zaehlwort(api.zieltageAuswahl.uebernehmen.length, 'Statuswert', 'Statuswerte')}
            {' '}der Phasen Eingang bis Entscheidung liegt ein Zieltage-Vorschlag aus dem Ist vor
            {api.zieltageAuswahl.zuWenigDaten.length > 0
              && ` (bei ${zaehlwort(api.zieltageAuswahl.zuWenigDaten.length,
                'weiterem Statuswert', 'weiteren Statuswerten')} reichen die Daten nicht)`}.
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

      {/* Die beiden Achsen tragen ihren ZWECK hier, nicht als Unterzeile in zwei
          Spaltenköpfen: vier der neun Arbeitslisten heißen wortgleich wie ein
          Verfahrensschritt, und zwei Spalten mit halb denselben Wörtern liest
          jeder als Widerspruch. Die Schlüssel im Datenmodell (`kategorie`,
          `zahPhaseId`) bleiben unverändert. */}
      <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
        <strong className="font-medium">Arbeitsliste</strong> bestimmt Reiter, Gruppierung und
        Farbe in Förderanträge
        {zeigeZieltage && (
          <>
            {' · '}
            <strong className="font-medium">Verfahrensschritt</strong> bestimmt Auswertung,
            Zieltage und Stillstand — umgehängt wird er im Baum.
          </>
        )}
      </p>

      <SortableTable
        rows={sortedRows}
        columns={spalten}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={toggleSort}
        rowKey={z => z.w.id}
        columnFilters={columnFilters}
        onColumnFilterChange={setColumnFilter}
        filterCandidates={filterCandidates}
        filterCounts={filterCounts}
        columnWidths={widths}
        onColumnWidthChange={setWidth}
        onColumnWidthReset={resetWidth}
        // Die vier Spalten mit Eingabe-/Auswahlfeld sind per `autoWidth: false`
        // ausgenommen — dort ist das Bauteil der Platzbedarf, nicht sein Inhalt.
        autoColumnWidth
        // Zehn Spalten, davon vier mit Eingabefeld: in den Container gestaucht
        // brach schon der Spaltenkopf mitten im Wort um („Verfahrens-schritt"
        // über drei Zeilen, Kopfzeile 60 px). Lieber die Wunschbreite halten und
        // waagerecht scrollen — wie in der Suche.
        fitContentWidth
        emptyContent="Keine Statuswerte für die aktuellen Filter."
      />

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
