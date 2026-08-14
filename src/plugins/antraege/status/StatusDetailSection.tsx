/**
 * Status-Detailsektion (`#status`) der Verbund-Detailseite. Komponiert die zwei
 * Verlaufs-Sichten, die Status-Erklärung und den Navigator aus dem gerätelokalen,
 * read-only `useStatusVerlauf`. Rendert nichts, solange der Katalog fehlt (Flag
 * aus oder noch nicht initialisiert).
 *
 * Einklappbar mit Default ZU — im Kopf steht die **ZAH-Phase** des amtlichen
 * Status, aufgeklappt der Verlauf. **Vollständig** einklappbar: bis v3.48 stand
 * die Bearbeitungsfrist vor dem Rumpf und damit als einzige Fläche immer offen.
 * Ihre Zahlen stehen in der Frist-Spalte der Tabelle, in der Kopfkarte des
 * Ausklapps und im Block „Wie die Bearbeitungsfrist zustande kommt" — die
 * Herleitung ein viertes Mal zu zeigen, kostete nur Platz.
 *
 * Bis v2.383 stand hier die abgeleitete Spine-Phase, daneben ein „Warum dieser
 * Status?"-Panel aus Rängen und ein zweiter Block „Nächste Schritte" aus fünf
 * handgeschriebenen Regeln. Beide sind mit dem Rückbau entfallen: die Frage
 * „warum?" beantwortet das Herleitungs-Popover aus dem amtlichen Status, die
 * Frage „was jetzt?" der Navigator aus der Trigger-Tabelle. Zwei
 * Erklärungs-Oberflächen nebeneinander waren der Übergangszustand, nicht das Ziel.
 */
import { useMemo, useRef } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import { sektionOffenDefault, sektionsKey } from '../detailSektionen';
import { isVorgangssystemEnabled } from '@/config/feature-flags';
import {
  baueChronik, baueSchrittMatrix, baueSpalten, filterePaare, rollenSicht, rollenVonFeld,
  teileChronik, trifftBereich, verlaufKennzahlen, zahPhaseLabel, zahPhaseFuerStatusText,
  offenePaareJeTeilvorhaben,
} from '@/core/status';
import { HerleitungPopover } from './HerleitungPopover';
import { NaechsteSchritte } from './NaechsteSchritte';
import { OffeneAufgaben } from './OffeneAufgaben';
import { useStatusVerlauf } from './useStatusVerlauf';
import { StatusChronik } from './StatusChronik';
import { StatusCodeListe } from './StatusCodeListe';
import { StatusSchrittMatrix } from './StatusSchrittMatrix';
import { RollenBadges } from './VerlaufBadges';
import { VerlaufFilterLeiste } from './VerlaufFilterLeiste';
import { VerlaufKennzahlenZeile } from './VerlaufKennzahlenZeile';
import { useTimelinePrefs } from './timelinePrefs';
import { useVerlaufFilter } from './useVerlaufFilter';
import { VerbundBand } from '../verlauf-band/VerbundBand';

export function StatusDetailSection({ verbundId, statusRoh }: {
  verbundId: string;
  /** Der amtliche Verbund-Status — Grundlage der Erklärung (Vorgangssystem). */
  statusRoh?: string | null;
}): React.ReactElement | null {
  const v = useStatusVerlauf(verbundId);
  // Einklappbar, Default ZU (persistierter Zustand gewinnt): die abgeleitete
  // Phase steht als Vorschau im Kopf, Timeline und Begründung sind Nachschlagen.
  // Hook VOR den Early Returns (Hook-Reihenfolge, React #310).
  const [open, toggleOpen] = useCollapsedSection(
    sektionsKey('status'), { defaultOpen: sektionOffenDefault('status') },
  );
  // Eine Präferenz-Instanz für beide Verlaufs-Ansichten (Hook vor den Early
  // Returns — React #310).
  const prefsApi = useTimelinePrefs();
  // Einmal je Seitenaufruf gestempelt und in die reine Engine injiziert — nie
  // eine Uhr in der Berechnung (Hook vor den Early Returns, React #310).
  const stichtagRef = useRef<string>(new Date().toISOString());
  const stichtag = stichtagRef.current;
  // Die Spaltenachse: Verbund, dann die Teilvorhaben **nach Aktenzeichen
  // sortiert**. Ohne feste Ordnung wechselte „TV 2" mit der Reihenfolge, in der
  // IndexedDB die Anträge zurückgibt — eine Nummer, die man nicht zitieren kann.
  // Hook vor den Early Returns (React #310).
  const tvIds = useMemo(
    () => v.jeTeilvorhaben.map(t => t.aktenzeichen).sort((a, b) => a.localeCompare(b)),
    [v.jeTeilvorhaben],
  );
  const spalten = useMemo(() => baueSpalten(tvIds), [tvIds]);
  const bereichsIds = useMemo(() => spalten.map(s => s.id), [spalten]);
  const tvNummern = useMemo(
    () => new Map(tvIds.map((id, i) => [id, i + 1] as const)),
    [tvIds],
  );
  const filter = useVerlaufFilter(bereichsIds);

  if (v.laden) {
    return <div className="text-[13px] text-[var(--tf-text-tertiary)]">Lädt …</div>;
  }
  if (!v.version) return null;
  const version = v.version;
  // Die Phase des AMTLICHEN Status — nicht abgeleitet. Ohne Katalog-Treffer
  // bleibt die Vorschau leer statt eine Phase zu erfinden.
  const phase = zahPhaseFuerStatusText(statusRoh);
  // Ohne Vorgangssystem gibt es nur die Chronik. Dann entfällt die Reiter-Leiste
  // ganz — ein einzelner Reiter ist Zierde —, und eine gespeicherte Wahl `band`
  // fällt auf die Chronik zurück, statt einen leeren Bereich zu hinterlassen.
  const bandAn = isVorgangssystemEnabled();
  const ansicht = bandAn ? prefsApi.prefs.ansicht : 'chronik';
  // Die halb offenen Kürzel-Paare — **je Teilvorhaben**, nie über `v.vorkommen`:
  // das wirft alle TVs zusammen, und dann gilt ein Kürzel als gesetzt, sobald es
  // irgendeines trägt (`offenePaareJeTeilvorhaben`).
  const offenePaare = offenePaareJeTeilvorhaben(version, v.jeTeilvorhaben, stichtag);
  const modus = prefsApi.prefs.modus;

  // Was die Auswahl überhaupt erreichen kann (der Schalter „Nebensächliches"
  // liegt VOR dem Filter — er sagt, was zur Ansicht gehört, nicht, was davon
  // gewählt ist), und was nach Rolle und Träger davon übrig bleibt. Die
  // Filterleiste zählt gegen das erste, die Kennzahlen nennen beides.
  const basis = baueChronik(v.vorkommen, {
    zeigeNebensaechlich: prefsApi.prefs.zeigeNebensaechlich,
  });
  // Wie viele Termine der Schalter überhaupt zusätzlich zeigen könnte — ohne
  // diese Zahl wäre er eine Tür ohne Schild (`teileChronik` auf dem VOLLEN Bau).
  const nebenAnzahl = teileChronik(
    baueChronik(v.vorkommen, { zeigeNebensaechlich: true }),
  ).neben.length;
  const gefiltert = basis.filter(e =>
    rollenSicht(rollenVonFeld(e.feld), filter.rollen) !== 'weg'
    && trifftBereich(e.tvIds, filter.bereiche));
  const paareGefiltert = filterePaare(offenePaare, filter.rollen, filter.bereiche);
  const kennzahlenGesamt = verlaufKennzahlen(basis, offenePaare, tvIds.length);
  const kennzahlen = verlaufKennzahlen(gefiltert, paareGefiltert, tvIds.length);

  const matrixZeilen = baueSchrittMatrix(gefiltert, paareGefiltert, spalten, version)
    .filter(z => !filter.nurLuecken || z.fehlt > 0);
  const fokusZeile = filter.fokus === null
    ? null
    : version.felder.find(f => f.feldId === filter.fokus) ?? null;

  return (
    <div>
      {/* Der Abstand zum Rumpf gilt nur, solange es einen gibt — zugeklappt blieb
          er als hängende Marge unter einer einzeiligen Kopfzeile stehen. */}
      <div className={`flex items-center gap-3 flex-wrap${open ? ' mb-3' : ''}`}>
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          className="flex items-center gap-1.5 cursor-pointer"
        >
          <ChevronRight
            size={15}
            className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0"
            style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
          <span className="text-[16px] font-medium text-[var(--tf-text)]">Status &amp; Verlauf</span>
        </button>
        {/* Vorschau: die ZAH-Phase — sonst sagt die eingeklappte Zeile nichts. */}
        {phase !== null && (
          <span className="text-[12px] text-[var(--tf-text-secondary)]">
            {zahPhaseLabel(phase, version.zahPhasen)}
          </span>
        )}
        {isVorgangssystemEnabled() && (
          <HerleitungPopover verbundId={verbundId} statusRoh={statusRoh} ebene="verbund" />
        )}
      </div>

      {/* Der Rumpf trägt den Abstand seiner Blöcke als `gap`, nicht als `mt-5` an
          Wrapper-`div`s: ein Block, der `null` liefert (`OffeneAufgaben` ohne
          Regeln, `NaechsteSchritte` ohne Flag), zeichnete sonst seine 20 px
          trotzdem — dasselbe Muster, das `Sektionsrahmen` mit `empty:hidden` löst.
          Als `null` ist er gar kein Flex-Item. */}
      <div className={open ? 'flex flex-col gap-3' : 'hidden'}>
      {/* Zwei Sichten auf DIESELBEN Termine aus den Datumsfeldern: die Chronik
          listet sie, der Zeitstrahl zeichnet sie als Bahn.
          Der Reiter heißt „Zeitstrahl", der gespeicherte Wert dahinter `band` —
          bis v3.48 hieß so eine dritte Sicht auf das gerätelokale
          Ereignis-Protokoll. Die ist entfallen (sie blieb leer, solange diese
          Installation nichts mitgeschrieben hatte), ihr Name auf die Bahn
          übergegangen. Den Wert mitzubenennen hieße, jede gespeicherte Wahl zu
          migrieren, ohne dass ein Nutzer davon etwas sähe. */}
      {/* Wie groß dieser Vorgang ist — über beiden Ansichten, damit die Zahl
          nicht zur Eigenschaft einer Darstellung wird. */}
      <VerlaufKennzahlenZeile
        kennzahlen={kennzahlen}
        {...(kennzahlen.datumsangaben === kennzahlenGesamt.datumsangaben
          ? {} : { gesamt: kennzahlenGesamt })}
        onLuecken={() => filter.setzeNurLuecken(!filter.nurLuecken)}
      />

      <div className="flex flex-wrap items-center gap-2">
        {bandAn && (
          <SegmentedToggle
            value={ansicht}
            onChange={a => prefsApi.setAnsicht(a)}
            options={[{ id: 'chronik', label: 'Chronik' }, { id: 'band', label: 'Zeitstrahl' }]}
            ariaLabel="Darstellung des Verlaufs"
          />
        )}
        {/* Zwei Ordnungen auf denselben Terminen: nach Schritt vergleicht die
            Teilvorhaben, nach Datum erzählt den Hergang. */}
        {ansicht === 'chronik' && (
          <SegmentedToggle
            value={modus}
            onChange={m => prefsApi.setModus(m)}
            options={[{ id: 'schritt', label: 'nach Schritt' }, { id: 'datum', label: 'nach Datum' }]}
            ariaLabel="Ordnung der Chronik"
          />
        )}
      </div>

      {/* Die Leiste steht nur über der Chronik: der Zeitstrahl liest sie noch
          nicht, und ein Bedienelement ohne Wirkung ist ein gebrochenes
          Versprechen. Er bekommt sie mit seinem eigenen Umbau. */}
      {ansicht === 'chronik' && (
        <VerlaufFilterLeiste
          chronik={basis}
          spalten={spalten}
          filter={filter}
          nichtGesetzt={offenePaare.length}
          nebensaechlich={nebenAnzahl === 0 ? null : {
            an: prefsApi.prefs.zeigeNebensaechlich,
            anzahl: nebenAnzahl,
            umschalten: () => prefsApi.setNebensaechlich(!prefsApi.prefs.zeigeNebensaechlich),
          }}
        />
      )}

      {/* Der Fokus überlebt den Ordnungswechsel — in der Matrix eine Streuung
          sehen, nach Datum nachlesen, wann sie entstand. */}
      {fokusZeile !== null && ansicht === 'chronik' && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-[var(--tf-radius)] px-2.5 py-1.5 text-[12px]"
          style={{ background: 'var(--tf-bg-secondary)', border: '0.5px solid var(--tf-border)' }}
        >
          <span className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
            Fokus
          </span>
          <span className="font-mono text-[11.5px] text-[var(--tf-primary)]">
            {fokusZeile.code ?? fokusZeile.feldId}
          </span>
          <span className="text-[var(--tf-text)]">{fokusZeile.label}</span>
          <RollenBadges rollen={rollenVonFeld(fokusZeile)} />
          <button
            type="button"
            onClick={() => filter.setzeFokus(null)}
            className="ml-auto inline-flex cursor-pointer items-center gap-1 text-[11.5px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]"
          >
            <X size={12} aria-hidden="true" />
            aufheben
          </button>
        </div>
      )}

      {ansicht !== 'chronik' ? (
        <VerbundBand verbundId={verbundId} statusRoh={statusRoh} stichtag={stichtag.slice(0, 10)} />
      ) : modus === 'schritt' ? (
        <StatusSchrittMatrix
          zeilen={matrixZeilen}
          spalten={spalten}
          version={version}
          fokus={filter.fokus}
          onFokus={filter.setzeFokus}
          rollenWahl={filter.rollen}
        />
      ) : (
        <StatusChronik
          vorkommen={v.vorkommen}
          version={version}
          zeigeNebensaechlich={prefsApi.prefs.zeigeNebensaechlich}
          onToggleNebensaechlich={() => prefsApi.setNebensaechlich(!prefsApi.prefs.zeigeNebensaechlich)}
          offenePaare={offenePaare}
          zeigeSchalter={false}
          rollenWahl={filter.rollen}
          bereichWahl={filter.bereiche}
          nurLuecken={filter.nurLuecken}
          fokus={filter.fokus}
          onFokus={filter.setzeFokus}
          tvNummern={tvNummern}
          tvGesamt={tvIds.length}
        />
      )}

      {/* Was steht an — dieselbe Kaskade wie im Board, je Teilvorhaben und je
          Rolle. Steht VOR dem Navigator: „was ist meine Aufgabe" kommt vor
          „welches Kürzel setze ich dafür". */}
      {isVorgangssystemEnabled() && (
        <OffeneAufgaben
          version={version} jeTeilvorhaben={v.jeTeilvorhaben} stichtag={stichtag}
        />
      )}

      {/* Der Navigator: was ist als Nächstes zu setzen, von wem, was löst es aus.
          Aus der Trigger-Tabelle des Fachsystems — nicht abgeleitet. */}
      <NaechsteSchritte
        version={version} vorkommen={v.vorkommen} statusRoh={statusRoh} programm={v.programm}
      />

      {/* Die Ordner des Fachsystems: was steht wo. Die Timeline oben beantwortet
          „wann", diese Liste „in welchem Ordner". */}
      <StatusCodeListe version={version} vorkommen={v.vorkommen} />
      </div>
    </div>
  );
}
