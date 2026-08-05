/**
 * Die Spalten der Katalog-Tabelle für den geteilten `SortableTable`.
 *
 * Bis v2.410 war die Tabelle handgebaut und konnte deshalb nicht, was man mit
 * 148 Zeilen dauernd will: nach Vorkommen sortieren, nach Feld filtern, Spalten
 * breiter ziehen. Der Baustein kann das alles — er braucht nur Spalten, die
 * einen Sortierwert und ein Rendering trennen.
 *
 * **Zwei Spalten bleiben bewusst unsortierbar.** `useTableSort` sortiert bei
 * jeder Zeilenänderung neu; bei *Label* (Texteingabe) spränge die Zeile mitten
 * im Tippen weg, bei *aktiv* (Häkchen) sofort nach dem Klick. Beide werden in
 * der Zelle bearbeitet — eine Sortierung, die den bearbeiteten Datensatz aus dem
 * Blick schiebt, ist keine Hilfe.
 *
 * **Filter-Dropdowns nur für Feld und Verfahrensschritt.** Arbeitsliste und
 * Prominenz haben ihre Filter-Chips über der Tabelle; ein zweiter Weg zur
 * selben Achse wären zwei Vokabulare für dieselbe Frage.
 */
import { Badge } from '@/components/ui/badge';
import type { SortableColumn } from '@/components/data-table';
import type { StatusWertEintrag, StatusCategory, Prominenz } from '@/core/status';
import type { KatalogZeile } from './katalogZeilen';
import {
  KATEGORIE_LABEL, KATEGORIE_WERTE, PROMINENZ_LABEL, PROMINENZ_WERTE,
  feldKlasse, feldKlasseSchmal, feldStil, formatDatum,
} from './labels';

/** Unbesetzte Zieltage sortieren ans Ende, nicht an den Anfang — „nicht
 *  bewertbar" ist keine besonders kurze Frist. Im Export steht dafür nichts. */
const ZIELTAGE_LEER = Number.MAX_SAFE_INTEGER;

export interface SpaltenKontext {
  /** Zieltage + Verfahrensschritt nur im Vorgangssystem — sonst ohne Konsument. */
  zeigeZieltage: boolean;
  setWert: (id: string, patch: Partial<StatusWertEintrag>) => void;
}

export function baueKatalogSpalten(ctx: SpaltenKontext): SortableColumn<KatalogZeile>[] {
  const { zeigeZieltage, setWert } = ctx;
  const spalten: SortableColumn<KatalogZeile>[] = [
    {
      // Der kuratierte Feldname, nicht die technische feldId („status" ist der
      // TV-Status). feldId und rohe CSV-Spalte stehen im Tooltip — im Katalog
      // wird kuratiert, nicht gegen den Export-Dump gearbeitet. Als Beleg
      // reicht ein Tooltip nicht: der Export führt die Spalte weiter einzeln.
      key: 'feld',
      label: 'Feld',
      defaultVisible: true,
      sortable: true,
      filterable: true,
      width: 148,
      wrap: false,
      accessor: z => z.feldName,
      filterAccessor: z => z.feldName,
      render: z => (
        <span
          className="text-[12px] text-[var(--tf-text-secondary)]"
          title={`Feld-Id: ${z.w.feldId} · CSV-Spalte: ${z.csvSpalte}`}
        >
          {z.feldName}
        </span>
      ),
    },
    {
      key: 'rohwert',
      label: 'Rohwert',
      defaultVisible: true,
      sortable: true,
      width: 200,
      accessor: z => z.w.wert,
      render: z => (
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-[var(--tf-text)]">{z.w.wert}</span>
          {z.w.unkuratiert && <Badge variant="warning">unkuratiert</Badge>}
        </div>
      ),
    },
    {
      // Leeres Label heißt: es gilt der Rohwert. Der Platzhalter sagt das,
      // statt den Rohwert zu spiegeln — sonst sehen beide Spalten gleich aus
      // und man hält das ungesetzte Label für einen gesetzten Wert.
      key: 'label',
      label: 'Label',
      defaultVisible: true,
      sortable: false,
      width: 150,
      accessor: z => z.w.label ?? '',
      render: z => (
        <input
          value={z.w.label ?? ''} placeholder="wie Rohwert" className={feldKlasse} style={feldStil}
          onChange={e => setWert(z.w.id, { label: e.target.value })}
        />
      ),
    },
    {
      // Bedienbar ist die Arbeitsliste nur dort, wo sie auch wirkt. Trägt der
      // Wert einen amtlichen Code, leitet die App sie aus Verfahrensschritt +
      // Code ab (`kategorieAusFassung`) — dann stand hier bis v2.410 ein
      // Auswahlfeld, das nichts bewirkte, und darunter ein Satz, der das
      // erklärte. Ein bedienbares Feld ohne Wirkung wird ausprobiert; ein
      // deaktiviertes verspricht die Handlung weiter und belegt Platz.
      key: 'kategorie',
      label: 'Arbeitsliste',
      defaultVisible: true,
      sortable: true,
      width: 172,
      // Verfahrensreihenfolge, nicht Alphabet: „Abgeschlossen" vor „Eingang"
      // liest niemand als Sortierung.
      accessor: z => z.kategorieRang,
      exportValue: z => KATEGORIE_LABEL[z.effektiveKategorie],
      render: z => (
        <div className="flex flex-col gap-0.5">
          {z.w.code === undefined ? (
            <select
              value={z.w.kategorie} className={feldKlasse} style={feldStil}
              onChange={e => setWert(z.w.id, { kategorie: e.target.value as StatusCategory })}
            >
              {KATEGORIE_WERTE.map(k => <option key={k} value={k}>{KATEGORIE_LABEL[k]}</option>)}
            </select>
          ) : (
            <span
              className="text-[12px] text-[var(--tf-text)]"
              title={'Ergibt sich aus dem amtlichen Code und dem Verfahrensschritt. '
                + 'Änderbar durch Umhängen im Baum („Phasen und Zuordnung").'}
            >
              {KATEGORIE_LABEL[z.effektiveKategorie]}
              <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">
                {' · folgt dem Verfahrensschritt'}
              </span>
            </span>
          )}
          {/* Nur dort eine Zeile, wo sie etwas sagt: die Fassung führt einen
              anderen gepflegten Wert, als die Ableitung ergibt. Ohne diese
              Bedingung stand ein Satz unter fast jeder Zeile. */}
          {z.effektiveKategorie !== z.w.kategorie && (
            <span className="text-[10.5px] text-[var(--tf-warning-text)]">
              in dieser Fassung noch als „{KATEGORIE_LABEL[z.w.kategorie]}" gepflegt
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'prominenz',
      label: 'Prominenz',
      defaultVisible: true,
      sortable: true,
      width: 130,
      wrap: false,
      accessor: z => PROMINENZ_WERTE.indexOf(z.w.prominenz),
      exportValue: z => PROMINENZ_LABEL[z.w.prominenz],
      render: z => (
        <select
          value={z.w.prominenz} className={feldKlasse} style={feldStil}
          onChange={e => setWert(z.w.id, { prominenz: e.target.value as Prominenz })}
        >
          {PROMINENZ_WERTE.map(p => <option key={p} value={p}>{PROMINENZ_LABEL[p]}</option>)}
        </select>
      ),
    },
  ];

  if (zeigeZieltage) {
    spalten.push(
      {
        // Read-only in DIESER Tabelle — kuratiert wird im Baum-Editor. Die Zelle
        // liest den Schnitt der FASSUNG, nicht die rohe Seed-Tabelle: sonst
        // zeigte sie nach dem ersten Umhängen weiter die ausgelieferte Phase
        // und widerspräche dem Baum daneben.
        key: 'schritt',
        label: 'Verfahrensschritt',
        defaultVisible: true,
        sortable: true,
        filterable: true,
        // Der Spaltenkopf gibt die Breite vor, nicht der Inhalt:
        // „VERFAHRENSSCHRITT" ist EIN Wort (gemessen 118 px) und bräche sonst
        // mitten drin um. Dazu Sortier-Pfeil, Filter-Knopf und Zellenrand.
        width: 178,
        wrap: false,
        accessor: z => z.phaseRang,
        filterAccessor: z => z.phaseLabel,
        exportValue: z => z.phaseLabel,
        render: z => (
          <span
            className="text-[12px] text-[var(--tf-text-tertiary)]"
            title='Verfahrensschritt dieses Status. Änderbar im Baum („Phasen und Zuordnung").'
          >
            {z.phaseLabel}
          </span>
        ),
      },
      {
        key: 'zieltage',
        label: 'Zieltage',
        defaultVisible: true,
        sortable: true,
        width: 120,
        wrap: false,
        accessor: z => z.w.zieltage ?? ZIELTAGE_LEER,
        exportValue: z => z.w.zieltage ?? '',
        render: z => (
          <div className="flex items-center gap-1">
            <input
              type="number" min={0} value={z.w.zieltage ?? ''} placeholder="—"
              className={`${feldKlasseSchmal} w-[58px]`} style={feldStil}
              title="Nach wie vielen Tagen ohne Aktivität gilt dieser Status als hängend? Leer = nicht bewertbar."
              onChange={e => setWert(z.w.id, {
                zieltage: e.target.value === '' ? null
                  : (Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : null),
              })}
            />
            {/* Der Vorschlag wird ZEILENWEISE übernommen, nie im Block: er ist
                eine Näherung aus dem Ist, kein Sollwert. */}
            {z.vorschlag !== undefined && z.w.zieltage !== z.vorschlag.median && (
              <button
                type="button"
                onClick={() => setWert(z.w.id, { zieltage: z.vorschlag!.median })}
                title={`Median der Ist-Liegezeiten: ${z.vorschlag.median} Tage (n = ${z.vorschlag.n})`}
                className="text-[10.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer underline whitespace-nowrap"
              >
                ⌀{z.vorschlag.median}
              </button>
            )}
          </div>
        ),
      },
    );
  }

  spalten.push(
    {
      key: 'aktiv',
      label: 'aktiv',
      defaultVisible: true,
      sortable: false,
      width: 62,
      wrap: false,
      accessor: z => (z.w.aktiv ? 1 : 0),
      exportValue: z => (z.w.aktiv ? 'ja' : 'nein'),
      render: z => (
        <div className="flex justify-center">
          <input
            type="checkbox" className="accent-[var(--tf-primary)] cursor-pointer" checked={z.w.aktiv}
            onChange={e => setWert(z.w.id, { aktiv: e.target.checked })}
          />
        </div>
      ),
    },
    {
      key: 'vorkommen',
      label: 'Vorkommen',
      defaultVisible: true,
      sortable: true,
      width: 120,
      wrap: false,
      accessor: z => z.vorkommen,
      render: z => (
        <span className="block text-right text-[12px] text-[var(--tf-text-secondary)] font-mono">
          {z.vorkommen}
        </span>
      ),
    },
    {
      key: 'zuletzt',
      label: 'zuletzt gesehen',
      defaultVisible: true,
      sortable: true,
      width: 118,
      wrap: false,
      accessor: z => z.zuletzt,
      exportValue: z => formatDatum(z.zuletzt || undefined),
      render: z => (
        <span className="block text-right text-[12px] text-[var(--tf-text-tertiary)]">
          {formatDatum(z.zuletzt || undefined)}
        </span>
      ),
    },
  );

  return spalten;
}
