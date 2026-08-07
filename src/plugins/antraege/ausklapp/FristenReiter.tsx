/**
 * Frist und Meilensteine einer Zeile — dieselbe Engine, tiefere Eingabe.
 *
 * **Der Bereich rechnet nicht nach, er füttert besser.** Die Tabellenzelle ruft
 * `fristErgebnisVon` über die schlanke Listen-Projektion; die kennt weder
 * `D_XTE` noch das Haltedatum ([fristAnzeige.ts](../fristAnzeige.ts) sagt das
 * ausdrücklich und verweist auf genau diesen Bereich). Hier liegen Fassung und
 * Vorkommen vor, also geht beides in `berechneFrist` — dieselbe Funktion, nur
 * vollständiger informiert.
 *
 * Fehlt eine der beiden Eingaben, **steht das da**. Eine stillschweigend
 * schlechtere Rechnung wäre schlimmer als eine offen benannte.
 */
import { formatDatumsWert } from '@/core/services/csv/dateParse';
import { fristFuerVorkommen } from '@/core/status/frist-bezug';
import { isMeilensteinMonitoringEnabled } from '@/config/feature-flags';
import { MeilensteinLeiste } from '@/plugins/meilensteine/MeilensteinLeiste';
import { PROGNOSE_FARBE, PROGNOSE_LABEL, formatDatum } from '@/plugins/meilensteine/labels';
import { useVerbundMeilensteine } from '../meilensteine/useVerbundMeilensteine';
import { fristAnzeigeVon } from '../fristAnzeige';
import type { StatusVerlauf } from '../status/useStatusVerlauf';

const leise = 'text-[11px] text-[var(--tf-text-tertiary)]';

function Zeile({ label, wert, hinweis }: {
  label: string; wert: string; hinweis?: string;
}): React.ReactElement {
  return (
    <li className="flex items-baseline gap-2 flex-wrap text-[12px]">
      <span className="text-[var(--tf-text-secondary)] w-[150px] shrink-0">{label}</span>
      <span className="text-[var(--tf-text)]">{wert}</span>
      {hinweis !== undefined && <span className={leise}>{hinweis}</span>}
    </li>
  );
}

/** Der Meilenstein-Teil — eigene Komponente, damit sein Hook nicht bedingt läuft. */
function MeilensteinBlock({ verbundId }: { verbundId: string }): React.ReactElement | null {
  const api = useVerbundMeilensteine(verbundId);
  if (!isMeilensteinMonitoringEnabled()) return null;
  if (api.laden) return <p className={leise}>Meilensteine laden …</p>;
  if (!api.plan || !api.bewertung) return null;
  const b = api.bewertung;
  return (
    <div className="flex flex-col gap-1.5">
      <p className={`uppercase tracking-wider ${leise}`}>Meilensteine</p>
      <div className="flex items-baseline gap-3 flex-wrap text-[12px]">
        <span style={{ color: PROGNOSE_FARBE[b.prognose] }}>{PROGNOSE_LABEL[b.prognose]}</span>
        <span className="text-[var(--tf-text-secondary)]">Frist {formatDatum(b.fristDatum)}</span>
        {b.wocheAktuell !== null && (
          <span className={leise}>Bearbeitungswoche {b.wocheAktuell}</span>
        )}
      </div>
      <MeilensteinLeiste bewertung={b} knoten={api.plan.knoten} />
    </div>
  );
}

export function FristenReiter({ quelle, aktenzeichen, istVerbundZeile, statusRoh, stichtag, verbundId }: {
  quelle: StatusVerlauf;
  aktenzeichen: string;
  /** Verdichtete Verbund-Zeile? Dann zählen alle Teilvorhaben, sonst nur dieses. */
  istVerbundZeile: boolean;
  statusRoh: unknown;
  /** ISO-Tag. */
  stichtag: string;
  verbundId: string | null;
}): React.ReactElement {
  const { version, jeTeilvorhaben } = quelle;
  if (quelle.laden) return <p className={leise}>Lädt …</p>;
  if (!version) return <p className={leise}>Kein Statuskatalog geladen.</p>;

  const relevante = istVerbundZeile
    ? jeTeilvorhaben
    : jeTeilvorhaben.filter(t => t.aktenzeichen === aktenzeichen);
  const vorkommen = relevante.flatMap(t => t.vorkommen);

  // Dieselbe Rechnung wie für den Bezugszeitpunkt der Bahn — EIN Ausdruck in
  // `frist-bezug.ts`, nicht zwei Fassungen desselben Gedankens (v3.26).
  const { ergebnis, antragsdatum, alleAntraegeDa, halt } =
    fristFuerVorkommen(version, vorkommen, statusRoh, stichtag);
  const anzeige = fristAnzeigeVon(ergebnis, new Date(stichtag).getTime());

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <p className={`uppercase tracking-wider ${leise}`}>Bearbeitungsfrist</p>
        <ul className="flex flex-col gap-0.5">
          <Zeile
            label="Zustand"
            wert={anzeige.text}
            hinweis={anzeige.hinweis ?? (ergebnis.zustand === 'laeuft' ? 'Uhr läuft' : undefined)}
          />
          {/* Die Eingangsdaten stehen IMMER da, auch wenn die Uhr steht: die
              Engine entscheidet „angehalten" vor der Basis, und dann bliebe hier
              sonst dreimal „—" — obwohl die Daten vorliegen. */}
          <Zeile
            label="Antragseingang"
            wert={antragsdatum ? formatDatumsWert(antragsdatum) : '—'}
            hinweis="D_AAE"
          />
          <Zeile
            label="Alle Anträge da"
            wert={alleAntraegeDa ? formatDatumsWert(alleAntraegeDa) : '—'}
            hinweis={alleAntraegeDa === null ? 'D_XTE nicht gesetzt oder nicht gemappt' : 'D_XTE'}
          />
          {ergebnis.basisFeld !== undefined && (
            <Zeile
              label="Maßgeblich"
              wert={ergebnis.basisDatum ? formatDatumsWert(ergebnis.basisDatum) : '—'}
              hinweis={ergebnis.basisFeld === 'D_XTE'
                ? 'das spätere von beiden (D_XTE)'
                : 'das spätere von beiden (D_AAE)'}
            />
          )}
          {ergebnis.zielDatum !== undefined && (
            <Zeile
              label="Ziel"
              wert={formatDatumsWert(ergebnis.zielDatum)}
              hinweis={ergebnis.tageRest !== undefined
                ? `${ergebnis.tageRest >= 0 ? 'noch' : 'überfällig um'} ${Math.abs(ergebnis.tageRest)} T`
                : undefined}
            />
          )}
          {ergebnis.zustand === 'angehalten' && (
            <Zeile
              label="Haltedatum"
              wert={halt ? formatDatumsWert(halt.tag) : 'unbekannt'}
              hinweis={halt
                ? (halt.herkunft === 'journal' ? 'aus dem Journal belegt' : 'aus einem Datumsfeld genähert')
                : 'weder Journal noch passendes Datumsfeld — nicht geraten'}
            />
          )}
        </ul>
        {/* Was die Zelle NICHT hat, steht hier — und was auch hier fehlt, auch. */}
        <p className={leise}>
          {ergebnis.basisFeld !== undefined
            ? (alleAntraegeDa === null
              ? 'Gerechnet ab D_AAE — D_XTE führt das Programm-Schema für dieses Vorhaben nicht.'
              : 'Gerechnet mit D_XTE aus dem Schema — die Tabellenzelle kann das nicht.')
            : 'Der Zustand steht fest, bevor die Basis gebraucht wird — deshalb keine Ziel-Rechnung.'}
          {istVerbundZeile && relevante.length > 1
            && ` Über alle ${relevante.length} Teilvorhaben; maßgeblich ist das späteste Eingangsdatum.`}
        </p>
      </div>

      {verbundId !== null && <MeilensteinBlock verbundId={verbundId} />}
    </div>
  );
}
