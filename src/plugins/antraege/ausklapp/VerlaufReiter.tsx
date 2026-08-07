/**
 * Der Verlauf einer Zeile — schlicht, aber echt.
 *
 * Der erste Renderer der Spuren aus Phase 1b. **Keine Grafik**: das Band ist
 * Phase 3, und diese Liste ist zugleich das Sicherheitsnetz, falls die Messung
 * die Bauform des Bands noch umwirft. Ersetzt wird später die Darstellung, nicht
 * die Daten.
 *
 * **Nie eine leere Zeile.** Jeder Spurzustand ≠ `verlauf` trägt eine Begründung
 * im Klartext — „kein Bearbeitungsstand", „kein Wert im Export" und „kein
 * Übergang erklärt ihn" sind drei verschiedene Auskünfte, und keine davon ist
 * Schweigen (Pitfall #44, Abschnitt 14.2).
 */
import { AlertTriangle } from 'lucide-react';
import { formatDatumsWert } from '@/core/services/csv/dateParse';
import type {
  Konfidenz, VerlaufsSegment, VerlaufsSpur, VerlaufsUebergang,
} from '@/core/status/verlauf';

const leise = 'text-[11px] text-[var(--tf-text-tertiary)]';
/** Dieselbe Datums-Darstellung wie im Herleitungs-Popover. */
const tagDe = formatDatumsWert;

/** Wie sicher ein Übergang einen Statuswechsel belegt — im Klartext. */
const KONFIDENZ_TEXT: Record<Konfidenz, string> = {
  trigger_bestaetigt: 'Regel belegt den Wechsel',
  zeitliche_naehe: 'Journal belegt einen Wechsel in der Nähe',
  kein_kuerzel: 'kein bekannter Statuswechsel',
};

function spurTitel(spur: VerlaufsSpur, eigenes: string): string {
  if (spur.art === 'verbund') return 'Verbund';
  return spur.id === eigenes ? `${spur.id} (diese Zeile)` : spur.id;
}

function dauerText(s: VerlaufsSegment): string {
  if (s.dauerTage === null) {
    if (s.vonDatum === null) return 'Anfang unbekannt';
    return 'läuft weiter';
  }
  return `${s.dauerTage.toLocaleString('de-DE')} T${s.dauerUnsicher ? ' (unsicher)' : ''}`;
}

function Segment({ s }: { s: VerlaufsSegment }): React.ReactElement {
  const label = s.mehrdeutig
    ? (s.kandidaten ?? []).map(k => k.kurz).join(' oder ')
    : (s.statusRef?.kurz ?? '—');
  return (
    <li className="flex items-baseline gap-2 flex-wrap text-[12px]">
      <span className="text-[var(--tf-text)]">{label}</span>
      <span className={leise}>
        {s.vonDatum ? tagDe(s.vonDatum) : '…'} – {s.bisDatum ? tagDe(s.bisDatum) : '…'}
      </span>
      <span className={leise}>{dauerText(s)}</span>
      {s.mehrdeutig && <span className={leise}>mehrdeutig (gleichtägig)</span>}
    </li>
  );
}

function Uebergang({ u }: { u: VerlaufsUebergang }): React.ReactElement {
  return (
    <li className="flex items-baseline gap-2 flex-wrap text-[12px]">
      <span className="font-mono text-[11.5px] text-[var(--tf-text)]">
        {u.kuerzel}
        {/* Beide Formen, nie stillschweigend ersetzt: wer im Altbestand nach
            „AAW" sucht, muss es hier wiederfinden. */}
        {u.kuerzelHistorisch && (
          <span className={leise}> (im Export {u.kuerzelHistorisch})</span>
        )}
      </span>
      <span className={leise}>{tagDe(u.datum)}</span>
      {u.bezeichnung !== null && (
        <span className="text-[var(--tf-text-secondary)]">
          {u.bezeichnung}
          {!u.bezeichnungEindeutig && <span className={leise}> · je Projektform verschieden</span>}
        </span>
      )}
      {u.rollenLage === 'benannt' && u.rollen.length > 0 && (
        <span className={leise}>{u.rollen.join(', ')}</span>
      )}
      {u.rollenLage === 'neutral' && <span className={leise}>jede Rolle</span>}
      {u.rollenLage === 'unbekannt' && <span className={leise}>Rolle unbekannt</span>}
      <span className={leise}>{KONFIDENZ_TEXT[u.konfidenz]}</span>
      {u.setztStatus && (
        <span className="text-[11.5px] text-[var(--tf-text-secondary)]">
          → {u.setztStatus.code === null ? `„${u.setztStatus.roh}" (kein Code)` : u.setztStatus.kurz}
        </span>
      )}
      {u.scopeUnbestimmt && <span className={leise}>Ebene unbestimmt</span>}
      {u.ausAggregation && (
        <span className={leise}>
          aus {u.ausAggregation.kuerzel} ·{' '}
          {u.ausAggregation.erfuellt === null
            ? 'Bedingung nicht prüfbar'
            : u.ausAggregation.erfuellt ? 'Bedingung trägt heute' : 'Bedingung trägt heute nicht'}
        </span>
      )}
    </li>
  );
}

function Spur({ spur, eigenes }: { spur: VerlaufsSpur; eigenes: string }): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[12px] font-medium text-[var(--tf-text)]">
          {spurTitel(spur, eigenes)}
        </span>
        <span className={leise}>
          {spur.herkunft === 'beobachtet' ? 'beobachtet' : 'abgeleitet'}
        </span>
        {spur.projektform.art !== 'bekannt' && (
          <span className={leise}>
            {/* `unbekannt` trägt keine Beschriftung — es IST die Auskunft.
                „zuarbeit-aelter"/„keine-projektform" nennen ihren Wert. */}
            Projektform {spur.projektform.art === 'unbekannt' ? 'unbekannt' : spur.projektform.label}
          </span>
        )}
      </div>

      {spur.begruendung !== undefined && (
        <p className="text-[11.5px] text-[var(--tf-text-secondary)]">
          {spur.begruendung}
          {spur.verworfeneTermine !== undefined && spur.verworfeneTermine > 0
            && ` (${spur.verworfeneTermine} Termine liegen vor, tragen aber keine Bahn)`}
        </p>
      )}

      {spur.abweichung && (
        <p className="flex items-start gap-1.5 text-[11.5px] text-[var(--tf-warning-text)]">
          <AlertTriangle size={13} className="shrink-0 mt-[2px]" />
          <span>
            {spur.abweichung.art === 'widerspruch'
              ? 'Die Ableitung widerspricht dem Export'
              : 'Der Export-Status ist aus keiner Regel erreichbar'}
            {' — es gilt „'}{spur.abweichung.beobachtet}{'"'}
            {spur.abweichung.erwartet
              && `, abgeleitet war „${spur.abweichung.erwartet.kurz}"`}.
          </span>
        </p>
      )}

      {spur.segmente.length > 0 && (
        <div>
          <p className={`uppercase tracking-wider ${leise}`}>Abschnitte</p>
          <ul className="flex flex-col gap-0.5">
            {spur.segmente.map((s, i) => <Segment key={`${s.vonDatum}-${i}`} s={s} />)}
          </ul>
        </div>
      )}

      {spur.uebergaenge.length > 0 && (
        <div>
          <p className={`uppercase tracking-wider ${leise}`}>
            Kürzel ({spur.uebergaenge.length})
          </p>
          <ul className="flex flex-col gap-0.5">
            {spur.uebergaenge.map((u, i) => <Uebergang key={`${u.kuerzel}-${u.datum}-${i}`} u={u} />)}
          </ul>
        </div>
      )}
    </div>
  );
}

export function VerlaufReiter({ spuren, eigenes, journalAb, journalGenutzt, laden }: {
  spuren: readonly VerlaufsSpur[];
  /** Aktenzeichen der geklickten Zeile — ihre Spur wird benannt. */
  eigenes: string;
  journalAb: string | null;
  journalGenutzt: boolean;
  laden: boolean;
}): React.ReactElement {
  if (laden) return <p className={leise}>Lädt …</p>;
  if (spuren.length === 0) {
    return <p className={leise}>Kein Statuskatalog geladen — ohne ihn gibt es keine Bahn.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {spuren.map(s => <Spur key={`${s.art}-${s.id}`} spur={s} eigenes={eigenes} />)}
      {/* Der Nullpunkt gehoert an JEDE Anzeige: ohne ihn liest sich eine
          unvollstaendige Chronik als vollstaendige (Abschnitt 12.2). */}
      <p className={leise}>
        Aus den Datumsspalten abgeleitet — die `D_`-Spalten tragen je Kürzel nur das
        zuletzt gesetzte Datum.{' '}
        {journalAb === null
          ? 'Kein Import-Diff-Journal geführt.'
          : `Belegte Änderungen führt das Journal ab ${tagDe(journalAb)}`}
        {journalAb !== null && !journalGenutzt
          && ' — hier nicht herangezogen, weil es je Teilvorhaben geführt wird und dieses Vorhaben mehrere hat'}
        {journalAb !== null && '.'}
      </p>
    </div>
  );
}
