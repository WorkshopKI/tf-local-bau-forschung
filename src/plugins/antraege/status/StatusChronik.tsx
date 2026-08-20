/**
 * Die Chronik **nach Datum** — der Verlauf als Zeitstrahl von oben nach unten,
 * gruppiert nach Monat. Die Schwesteransicht dazu ist
 * {@link StatusSchrittMatrix}: dieselben Termine, nach Schritt geordnet.
 *
 * Warum aus den Datumsfeldern: bis v3.48 stand daneben eine Lane-Ansicht auf das
 * gerätelokale Ereignis-Protokoll. Sie blieb leer, solange eine Installation noch
 * keine Änderung mitgeschrieben hatte — die Termine im Vorgang gibt es trotzdem.
 * Sie stehen in den Datumsfeldern und ergeben, chronologisch gelesen, die
 * eigentliche Geschichte des Antrags.
 *
 * **Kein Deckel, aber ein Fenster.** Die Liste bekommt weder Höhenbegrenzung
 * noch eigenen Scrollbereich: ein Kasten, der zehn von 22 Terminen zeigt, liest
 * sich als der ganze Verlauf. Der Tabellen-Ausklapp braucht trotzdem eine
 * kürzere Auskunft — dort schneidet `fenster` auf die **jüngsten** Zeilen, und
 * ein Schalter darüber sagt, wie viele ältere er weglässt. Das ist die
 * Bedingung, unter der gekürzt werden darf; die Kennzahlen-Zeile daneben nennt
 * weiterhin die volle Größe des Vorgangs, nicht die der Darstellung. Auf der
 * Detailseite gibt es kein Fenster — dort ist die Chronik das Ziel des Klicks.
 *
 * **Deshalb ist die Höhe hier ein Entwurfsziel.** Gemessen über 13 090 Vorgänge:
 * Median 22 Termine in 6 Monaten, p90 32 in 9. Drei Entscheidungen folgen daraus
 * — der Monat steht in einer **eigenen linken Spalte** statt in einer eigenen
 * Zeile, jeder Termin belegt **genau eine** Zeile (Begleittext gekürzt, voller
 * Wortlaut im Tooltip), und die senkrechte Achse läuft durch alle Monate durch,
 * weil der Blockabstand innerhalb der Liste entsteht.
 *
 * **Das Kürzel steht dabei.** Zwischen Datum und Rolle, in einer eigenen
 * schmalen Spalte — dieselbe Anordnung wie im Fachsystem. Es ist der Bezeichner,
 * unter dem das Team einen Eintrag kennt und in C16 wiederfindet; die
 * Bezeichnung daneben sagt, was er bedeutet.
 *
 * **Wer hat gesetzt** steht als getönte Marke da, in derselben Farbe wie in der
 * Filterleiste und in der Matrix — die Leiste ist die Legende. Neutrale
 * Einträge — 143 der 505 Codes, die das Fachsystem von jedem setzen lässt —
 * bleiben unbeschriftet: „alle" an jeder dritten Zeile wäre Rauschen ohne
 * Information. Gelesen wird **ausschließlich** über `rollenVonFeld`, nie über
 * `feld.rollen` — sonst fallen Bestandsfassungen mit `zustaendigkeit` durch
 * (Pitfall #43).
 *
 * **Wo der Eintrag steht**, sagen die Träger-Marken rechts: nicht mehr
 * „3 Teilvorhaben", sondern welche drei. Genau diese Auskunft ist der Grund,
 * aus dem im Fachsystem jedes Teilvorhaben einzeln geöffnet wird.
 *
 * **Was davon meins ist**, sagt die Rolle aus dem Profil (`status_rolle`): meine
 * Zeilen tragen eine Kante auf der Achse. Das ist eine andere Frage als der
 * Wer-Filter darüber — der fragt „was hat die QS getan", die Kante „was geht
 * mich an" — und beide dürfen nebeneinander stehen. Neutrale Zeilen zählen dabei
 * NICHT als meine: sie gehören jedem, und markiert trüge fast jede dritte Zeile
 * die Kante.
 *
 * **Was fehlt**, kommt aus `offenePaareJeTeilvorhaben` und steht als Fehlzeile
 * unter dem Termin, der die andere Seite gesetzt hat — roter Ring, kein Datum.
 * Sie zählt **nicht** als Termin: eine Lücke ist keiner.
 *
 * **Was einmal dastand**, kommt aus dem Import-Diff-Journal und steht
 * durchgestrichen an seinem alten Tag (`chronik-zurueckgenommen.ts`). Ohne diese
 * Zeilen ist eine im Fachsystem zurückgenommene Setzung nach dem nächsten
 * Nacht-Export spurlos — der Fall, für den das Journal überhaupt geführt wird.
 * Sie zählen ebenfalls nicht als Termin.
 *
 * Rein darstellend: `baueChronik` und `baueZurueckgenommene` liefern die Daten,
 * `mischeVerlaufZeilen` die Reihenfolge, hier wird nur gerendert.
 */
import { Fragment } from 'react';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { useProfile } from '@/core/hooks/useProfile';
import {
  baueChronik, gruppiereNachMonat, juengsteZeilen, kategoriePfadLabel, mischeVerlaufZeilen,
  monateDazwischen, teileChronik, rollenSicht, trifftBereich, zahPhaseLabel,
  ROLLE_LABEL, leseStatusRolle, normKey, rollenVonFeld,
  type ChronikEintrag, type FeldVorkommen, type MappingVersion,
  type OffenesPaarJeTv, type Rolle, type ZurueckgenommenerTermin,
} from '@/core/status';
import { formatDatumsWert } from '@/core/services/csv/dateParse';
import { tagDe, wannText } from './journalTexte';
import { RollenBadges, TraegerBadges } from './VerlaufBadges';

/** Ab wann eine Pause eigens benannt wird — ein übersprungener Monat ist Alltag. */
const LUECKE_AB = 2;

const LEISE = 'text-[var(--tf-text-tertiary)]';

/** Die Tagesspalte — hier steht bei einer Fehlzeile der Gedankenstrich. */
const TAG_SPALTE = 'w-[42px] shrink-0 font-mono text-[11px]';

/**
 * Die Kürzelspalte. Steht zwischen Datum und Rolle — dieselbe Lesereihenfolge
 * wie im Fachsystem, wo das Kürzel der Bezeichner ist, unter dem das Team einen
 * Eintrag kennt. Die Bezeichnung sagt, WAS passiert ist; das Kürzel sagt, wo im
 * Fachsystem man es wiederfindet.
 *
 * 46 px: der längste Code des Katalogs hat **sechs** Zeichen (`XSPDOK`,
 * `WRWZG+`), gemessen über alle 505.
 */
const CODE_SPALTE = 'w-[46px] shrink-0 truncate font-mono text-[11px]';

/**
 * Die Rollenspalte — Platz für **drei** Marken. 62 px reichten für zwei, und die
 * dritte schob sich in den Ereignistext (`AB` `FB` `Q`|`S-Freigabe …`); 31 der
 * 506 Codes tragen drei Rollen. Mehr fängt `RollenBadges` mit „+n" ab.
 */
const ROLLEN_SPALTE = 'w-[76px] shrink-0';

/**
 * Die Linie, die einen Monatsblock vom vorigen trennt — über die **ganze**
 * Breite, Monatsspalte eingeschlossen. Ohne sie lief die Liste als ein Block
 * durch, und die Monatsbeschriftung links hatte keinen sichtbaren Anfang.
 */
const MONATS_TRENNER = 'border-t border-[var(--tf-border)]';

/** `2026-03` → „März 2026" in der Kurzform, die in die schmale Spalte passt. */
function monatLabel(monat: string): string {
  const d = new Date(`${monat}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return monat;
  return d.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' });
}

/** `2026-03-10` → „10.03." — das Jahr steht schon in der Monatsspalte.
 *  Über die zentrale Kette, damit hier nicht ein zweites Datumsformat entsteht. */
function tagLabel(tag: string): string {
  return formatDatumsWert(tag).slice(0, 6);
}

/**
 * Was der Tooltip einer Zeile trägt: Bezeichnung, Begleittext im **vollen**
 * Wortlaut, Ordnerpfad. Die Zeile selbst kürzt — der Titel darf das nicht.
 */
/**
 * Sagt die Textspalte dasselbe wie die Beschriftung?
 *
 * Verglichen wird normalisiert (Kleinschreibung, Satzzeichen und Mehrfach-
 * Leerzeichen weg) und ohne einen abschließenden Doppelpunkt — das Fachsystem
 * schreibt denselben Satz mal mit, mal ohne. Der Text zählt auch dann als
 * Wiederholung, wenn er mit der Beschriftung BEGINNT und danach nur noch
 * Interpunktion trägt; ein echter Zusatz („FKZ zum zugehörigen FuE: EP201185")
 * bleibt stehen, weil er über die Beschriftung hinausgeht.
 *
 * Rein — der Vergleich ist die Zusage, nicht die Darstellung.
 */
export function textWiederholtLabel(label: string, text: string): boolean {
  const norm = (s: string): string => s
    .toLowerCase()
    .replace(/[.,;:!?„“"'»«()\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const l = norm(label);
  const t = norm(text);
  return l.length > 0 && l === t;
}

function zeilenTitel(e: ChronikEintrag, pfad: string): string {
  return [e.feld.label, e.text, pfad].filter(t => t !== undefined && t !== '').join('\n');
}

/**
 * Punkt auf der Achse. Drei Signale zusammen — Größe, Halo, Textgewicht —
 * ergeben eine Rangfolge, die auf einen Blick lesbar ist; ein Symbol im Punkt
 * war es bei 9 px nie.
 */
function Punkt({ eintrag }: { eintrag: ChronikEintrag }): React.ReactElement {
  const p = eintrag.feld.prominenzDefault;
  if (p === 'meilenstein') {
    return (
      <span
        className="inline-block rounded-full"
        style={{
          width: 10, height: 10,
          background: 'var(--tf-primary)',
          boxShadow: '0 0 0 3px var(--tf-primary-light)',
        }}
      />
    );
  }
  if (p === 'nebensaechlich') {
    return (
      <span
        className="inline-block rounded-full"
        style={{ width: 6, height: 6, border: '1px solid var(--tf-text-tertiary)', background: 'var(--tf-bg)' }}
      />
    );
  }
  return (
    <span
      className="inline-block rounded-full"
      style={{ width: 7, height: 7, background: 'var(--tf-text-tertiary)' }}
    />
  );
}

/**
 * Die Kante, die eine Zeile als „meine" markiert — 2 px auf der Achse, in der
 * Primärfarbe. Sie liegt UNTER dem Punkt (DOM-Reihenfolge), damit ein
 * Meilenstein-Punkt sie überdeckt statt umgekehrt.
 */
function Kante(): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className="absolute bottom-0 left-0 top-0 w-[2px] -translate-x-1/2"
      style={{ background: 'var(--tf-primary)' }}
    />
  );
}

/** Der gemeinsame Rahmen einer Zeile: Achse, Kante, Fokus, Klickfläche. */
function ZeilenRahmen({ meins, imFokus, onKlick, punkt, children }: {
  meins: boolean;
  imFokus: boolean;
  onKlick?: () => void;
  punkt: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <li
      className={`relative pl-4${onKlick ? ' cursor-pointer hover:bg-[var(--tf-hover)]' : ''}`}
      style={imFokus ? { background: 'var(--tf-bg-secondary)' } : undefined}
      onClick={onKlick}
    >
      {meins && <Kante />}
      <span
        className="absolute left-0 flex -translate-x-1/2 items-center justify-center"
        style={{ width: 14, height: 14, top: 3 }}
      >
        {punkt}
      </span>
      <div className="flex items-baseline gap-2 leading-[19px]">{children}</div>
    </li>
  );
}

/** Eine Zeile: Punkt · Tag · Kürzel · Rolle · Bezeichnung (+ Notiz) · Phase · Träger. */
function Zeile({ e, version, meins, gedimmt, imFokus, onFokus, tvNummern, tvGesamt }: {
  e: ChronikEintrag;
  version: MappingVersion;
  meins: boolean;
  gedimmt: boolean;
  imFokus: boolean;
  onFokus?: (feldId: string | null) => void;
  tvNummern?: ReadonlyMap<string, number>;
  tvGesamt?: number;
}): React.ReactElement {
  const pfad = kategoriePfadLabel(version.kategorien ?? [], e.feld.kategorieId);
  const meilenstein = e.feld.prominenzDefault === 'meilenstein';
  const nebensache = e.feld.prominenzDefault === 'nebensaechlich';
  const textFarbe = gedimmt || nebensache ? 'var(--tf-text-tertiary)' : 'var(--tf-text)';
  return (
    <ZeilenRahmen
      meins={meins}
      imFokus={imFokus}
      punkt={<Punkt eintrag={e} />}
      {...(onFokus ? { onKlick: () => onFokus(imFokus ? null : e.feld.feldId) } : {})}
    >
      {/* Kein senkrechtes Padding: die Zeilenhöhe trägt den Abstand allein —
          bei 28 Terminen sind 3 px je Zeile ein ganzer Eintrag. Und sie steht
          in **px**, nicht als Faktor: ein Faktor rechnet gegen die geerbte
          Schriftgröße, und die ist im Ausklapp eine andere als auf der
          Detailseite (gemessen: 20 px hier, 24 px dort). */}
      <span className={`${TAG_SPALTE} ${LEISE}`}>{tagLabel(e.tag)}</span>
      {/* Jedes Datumsfeld trägt einen Code — auch die kanonischen (`AAE`,
          `ABB`, `AZ1`, `VBE` in `seed-kanonisch.ts`). Der Fallback bleibt
          trotzdem stehen: `code` ist am Typ optional. */}
      <span
        className={CODE_SPALTE}
        style={{
          color: gedimmt
            ? 'var(--tf-text-tertiary)'
            : meilenstein ? 'var(--tf-primary)' : 'var(--tf-text-tertiary)',
        }}
      >
        {e.feld.code ?? ''}
      </span>
      <span className={ROLLEN_SPALTE}>
        <RollenBadges rollen={rollenVonFeld(e.feld)} gedimmt={gedimmt} />
      </span>
      <span className="min-w-0 flex-1 truncate" title={zeilenTitel(e, pfad)}>
        <span
          className="text-[12.5px]"
          style={{ color: textFarbe, ...(meilenstein ? { fontWeight: 500 } : {}) }}
        >
          {e.feld.label}
        </span>
        {/* Die Textspalte NUR, wenn sie etwas hinzufügt. Wo das Fachsystem
            denselben Wortlaut in die Textspalte schreibt wie die Katalog-
            Beschriftung, stand er zweimal da („Termin für Nachlieferung ·
            Termin für Nachlieferung") — gemessen 14 158 von 22 752 Einträgen
            (62,2 %), allein `ANT` und `XPC+` 12 511 (v4.124). Die Beschriftungen
            stammen wortgetreu aus der Kürzel-Zuarbeit und bleiben, wie sie sind;
            korrigiert wird die Anzeige. */}
        {e.text && !textWiederholtLabel(e.feld.label, e.text) ? (
          <span className={`text-[11.5px] ${LEISE}`}>{' · '}{e.text}</span>
        ) : null}
      </span>
      {e.feld.zahPhaseId ? (
        <span className="shrink-0 rounded-full bg-[var(--tf-bg-secondary)] px-1.5 text-[10.5px] text-[var(--tf-text-secondary)]">
          {zahPhaseLabel(e.feld.zahPhaseId, version.zahPhasen)}
        </span>
      ) : null}
      <span className="shrink-0">
        <TraegerBadges tvIds={e.tvIds} nummern={tvNummern} gesamt={tvGesamt} />
      </span>
    </ZeilenRahmen>
  );
}

/**
 * Ein fehlendes Gegenstück: die eine Seite eines Kürzel-Paares ist gesetzt, die
 * andere nicht. Kein Datum — es gibt keines; die Standzeit steht stattdessen da.
 *
 * Der Ring ist **rot und durchgezogen**, nicht grau gestrichelt: das hier ist
 * eine offene Aufgabe in genau einem Teilvorhaben, meist ein vergessener
 * Eintrag. Grau-gestrichelt las sich als Randnotiz.
 */
function FehlZeile({ p, meins, gedimmt, tvNummern }: {
  p: OffenesPaarJeTv;
  meins: boolean;
  gedimmt: boolean;
  tvNummern?: ReadonlyMap<string, number>;
}): React.ReactElement {
  return (
    <ZeilenRahmen
      meins={meins}
      imFokus={false}
      punkt={(
        <span
          className="inline-block rounded-full"
          style={{
            width: 9, height: 9,
            border: '1px solid var(--tf-danger-text)',
            background: 'var(--tf-danger-bg)',
          }}
        />
      )}
    >
      <span className={`${TAG_SPALTE} ${LEISE}`} aria-hidden="true">—</span>
      {/* Das FEHLENDE Kürzel, nicht das gesetzte: die Zeile sagt „hier müsste
          `p.fehlt` stehen". Genau dieses Kürzel wird in C16 gesucht. */}
      <span className={CODE_SPALTE} style={{ color: 'var(--tf-danger-text)' }}>{p.fehlt}</span>
      <span className={ROLLEN_SPALTE}>
        <RollenBadges rollen={p.rolle === null ? [] : [p.rolle]} gedimmt={gedimmt} />
      </span>
      <span
        className="min-w-0 flex-1 truncate"
        title={`${p.fehlt} — ${p.fehltLabel}\nfehlt, seit ${p.gesetzt} gesetzt wurde`}
      >
        <span className={`text-[12.5px] ${LEISE}`}>{p.fehltLabel}</span>
        <span className="text-[11.5px]" style={{ color: 'var(--tf-danger-text)' }}>
          {` · Kürzel nicht gesetzt · ${p.tage} T`}
        </span>
      </span>
      <span className="shrink-0">
        <TraegerBadges tvIds={[p.tvId]} nummern={tvNummern} />
      </span>
    </ZeilenRahmen>
  );
}

/** Wie eine Rücknahme sich liest — eine Zeile, in der Sprache der Historie. */
function stornoText(s: ZurueckgenommenerTermin): string {
  return s.art === 'verschoben' && s.nachTag !== undefined
    ? `verschoben auf ${tagDe(s.nachTag)}`
    : `zurückgenommen ${wannText(s.belegt)}`;
}

/**
 * Ein Termin, den der Export nicht mehr führt — er stand einmal an diesem Tag.
 *
 * Der Ring ist **grau und gestrichelt**, nicht rot wie bei der {@link FehlZeile}:
 * hier ist nichts offen. Jemand hat in C16 eine Setzung zurückgenommen oder ihr
 * Datum korrigiert; das ist ein erledigter Vorgang, kein Auftrag.
 *
 * Durchgestrichen wird **nur die Bezeichnung**. Tag und Kürzel bleiben stehen,
 * denn genau mit ihnen findet man den Vorgang im Fachsystem wieder — sie
 * durchzustreichen nähme der Zeile ihren einzigen praktischen Nutzen.
 */
function StornoZeile({ s, meins, gedimmt, tvNummern, tvGesamt }: {
  s: ZurueckgenommenerTermin;
  meins: boolean;
  gedimmt: boolean;
  tvNummern?: ReadonlyMap<string, number>;
  tvGesamt?: number;
}): React.ReactElement {
  const text = stornoText(s);
  return (
    <ZeilenRahmen
      meins={meins}
      imFokus={false}
      punkt={(
        <span
          className="inline-block rounded-full"
          style={{
            width: 8, height: 8,
            border: '1px dashed var(--tf-text-tertiary)',
            background: 'var(--tf-bg)',
          }}
        />
      )}
    >
      <span className={`${TAG_SPALTE} ${LEISE}`}>{tagLabel(s.tag)}</span>
      <span className={`${CODE_SPALTE} ${LEISE}`}>{s.feld.code ?? ''}</span>
      {/* Die Rollenmarke behält ihre Tönung — wer den Schritt gesetzt hat, ist
          auch dann eine Auskunft, wenn er zurückgenommen wurde. Gedimmt wird
          sie nur, wenn der Filter es sagt (dieselbe Regel wie bei einem
          Termin); die Filterleiste ist die Legende. */}
      <span className={ROLLEN_SPALTE}>
        <RollenBadges rollen={rollenVonFeld(s.feld)} gedimmt={gedimmt} />
      </span>
      <span
        className="min-w-0 flex-1 truncate"
        title={`${s.feld.label}\n${text}\nStand des Exports — frühere Setzungen sind überschrieben`}
      >
        <span className={`text-[12.5px] line-through ${LEISE}`}>{s.feld.label}</span>
        <span className={`text-[11.5px] ${LEISE}`}>{' · '}{text}</span>
      </span>
      <span className="shrink-0">
        <TraegerBadges tvIds={s.tvIds} nummern={tvNummern} gesamt={tvGesamt} />
      </span>
    </ZeilenRahmen>
  );
}

/** Schlüssel, unter dem eine Fehlzeile an ihren Termin gehängt wird. */
function ankerKey(code: string, tag: string): string {
  return `${normKey(code)}|${tag}`;
}

/**
 * Der Schalter über einem Ausschnitt: **wie viele ältere Einträge fehlen**.
 *
 * Er steht OBEN, weil die Liste aufsteigend läuft — das Fenster zeigt ihr Ende,
 * und was fehlt, liegt darüber. Die Zahl ist nicht Zierde, sondern die
 * Bedingung, unter der ein Ausschnitt überhaupt gezeigt werden darf: ohne sie
 * läse er sich als der ganze Verlauf.
 *
 * „Einträge", nicht „Schritte": „Schritte" ist in der Kennzahlen-Zeile darüber
 * für etwas anderes vergeben (verschiedene Felder, nicht Zeilen).
 */
function FensterSchalter({ weggelassen, offen, onKlick }: {
  weggelassen: number;
  offen: boolean;
  onKlick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onKlick}
      aria-expanded={offen}
      className={`self-start cursor-pointer text-[11.5px] underline-offset-2 hover:underline ${LEISE}`}
    >
      {offen
        ? 'weniger zeigen'
        : `${weggelassen} ältere ${weggelassen === 1 ? 'Eintrag' : 'Einträge'} zeigen`}
    </button>
  );
}

/** Die vier Knotenzustände, ausgeschrieben — nur in dieser Ansicht. */
function Legende(): React.ReactElement {
  const eintraege: [React.ReactNode, string][] = [
    [<span key="m" className="inline-block rounded-full" style={{ width: 10, height: 10, background: 'var(--tf-primary)', boxShadow: '0 0 0 3px var(--tf-primary-light)' }} />, 'Hauptereignis'],
    [<span key="n" className="inline-block rounded-full" style={{ width: 7, height: 7, background: 'var(--tf-text-tertiary)' }} />, 'Regelfall'],
    [<span key="k" className="inline-block rounded-full" style={{ width: 6, height: 6, border: '1px solid var(--tf-text-tertiary)', background: 'var(--tf-bg)' }} />, 'Nachrichtenkanal'],
    [<span key="f" className="inline-block rounded-full" style={{ width: 9, height: 9, border: '1px solid var(--tf-danger-text)', background: 'var(--tf-danger-bg)' }} />, 'Kürzel nicht gesetzt'],
    [<span key="z" className="inline-block rounded-full" style={{ width: 8, height: 8, border: '1px dashed var(--tf-text-tertiary)', background: 'var(--tf-bg)' }} />, 'zurückgenommen / verschoben'],
  ];
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] ${LEISE}`}>
      {eintraege.map(([punkt, text]) => (
        <span key={text} className="inline-flex items-center gap-1.5">
          <span className="inline-flex w-[10px] justify-center">{punkt}</span>
          {text}
        </span>
      ))}
    </div>
  );
}

export function StatusChronik({
  vorkommen,
  version,
  zeigeNebensaechlich,
  onToggleNebensaechlich,
  offenePaare = [],
  zurueckgenommene = [],
  rollenWahl,
  bereichWahl,
  nurLuecken = false,
  fokus = null,
  onFokus,
  tvNummern,
  tvGesamt,
  zeigeSchalter = true,
  fenster = null,
}: {
  /** `readonly`, weil der Ausklapp seine Vorkommen unveränderlich durchreicht
   *  (`ZeilenVerlauf.vorkommen`) — gelesen wird hier ohnehin nur. */
  vorkommen: readonly FeldVorkommen[];
  version: MappingVersion;
  zeigeNebensaechlich: boolean;
  onToggleNebensaechlich: () => void;
  /**
   * Halb offene Kürzel-Paare, **je Teilvorhaben** gerechnet
   * (`offenePaareJeTeilvorhaben`). Fertig hereingereicht, weil hier keine Uhr
   * ticken darf — und weil nur der Aufrufer weiß, welche Teilvorhaben seine
   * Zeile trägt.
   */
  offenePaare?: readonly OffenesPaarJeTv[];
  /**
   * Termine, die der Export nicht mehr führt — aus dem Import-Diff-Journal
   * (`baueZurueckgenommene`). Fertig gerechnet hereingereicht, weil das Journal
   * vom Share kommt und diese Komponente rein darstellend bleibt.
   *
   * Fehlend = leer: ein Wirt ohne Journal-Zugriff verhält sich wie bisher.
   */
  zurueckgenommene?: readonly ZurueckgenommenerTermin[];
  /** Rollenwahl der Filterleiste; leer/fehlend = keine Einschränkung. */
  rollenWahl?: ReadonlySet<Rolle>;
  /** Bereichswahl der Filterleiste; leer/fehlend = alle Träger. */
  bereichWahl?: ReadonlySet<string>;
  /** Nur die Schritte zeigen, an denen irgendwo ein Kürzel fehlt. */
  nurLuecken?: boolean;
  /** Fokussierte Feld-Id — geteilt mit der Matrix. */
  fokus?: string | null;
  /** Fehlt der Handler, ist die Zeile nicht klickbar (Ausklapp). */
  onFokus?: (feldId: string | null) => void;
  /** Aktenzeichen → laufende Nummer für die Träger-Marken. */
  tvNummern?: ReadonlyMap<string, number>;
  /** Anzahl Teilvorhaben des Verbunds — für „alle N". */
  tvGesamt?: number;
  /**
   * Ob der Schalter „Nebensächliches" hier steht. Auf der Detailseite steht er
   * in der Filterleiste, weil er beide Ordnungen betrifft — zweimal wäre er
   * zwei Schalter auf denselben Zustand. Im Ausklapp gibt es keine Leiste, dort
   * bleibt er hier.
   */
  zeigeSchalter?: boolean;
  /**
   * Nur den jüngsten Abschnitt zeigen — der Tabellen-Ausklapp, wo der volle
   * Verlauf (Median 22, p90 32 Zeilen) die aufgeklappte Zeile sprengt.
   *
   * `null`/fehlend = alles, und das bleibt der Fall auf der Detailseite: dort
   * ist die Chronik das Ziel des Klicks, nicht die Begleitung einer Tabelle.
   *
   * `offen` und der Umschalter gehören dem **Wirt**: der Ausklapp persistiert
   * nichts, die Detailseite hat gar kein Fenster — ein Zustand hier drin wäre in
   * beiden Fällen falsch angesiedelt. `offen` kommt mit, statt die Prop bei
   * „alles zeigen" auf `null` fallen zu lassen: sonst verschwände mit dem
   * Fenster auch sein Schalter, und der Weg zurück wäre weg.
   */
  fenster?: { anzahl: number; offen: boolean; onUmschalten: () => void } | null;
}): React.ReactElement {
  const rollen = rollenWahl ?? new Set<Rolle>();
  const bereiche = bereichWahl ?? new Set<string>();

  // EIN Aufbau, danach geteilt: die Anzeige muss wissen, ob der Schalter
  // überhaupt etwas bewirkt, bevor sie ihn anbietet (`teileChronik`). Die
  // volle Liste wird NICHT neu sortiert — sie kommt bereits geordnet.
  const alle = baueChronik(vorkommen, { zeigeNebensaechlich: true });
  const { neben } = teileChronik(alle);
  const sichtbar = alle.filter(e =>
    (zeigeNebensaechlich || e.feld.prominenzDefault !== 'nebensaechlich')
    && rollenSicht(rollenVonFeld(e.feld), rollen) !== 'weg'
    && trifftBereich(e.tvIds, bereiche));

  // Fehlzeilen hängen an dem Termin, der die andere Seite gesetzt hat. Findet
  // sich der nicht — sein Feld kann `ignoriert` sein oder als nebensächlich
  // gerade ausgeblendet —, geht die Lücke NICHT verloren: sie landet am Ende
  // ihres Monats, und fehlt auch der, ganz am Schluss.
  const ankerFuer = (p: OffenesPaarJeTv): string => ankerKey(p.gesetzt, p.seit);
  const mitLuecke = new Set(offenePaare.map(ankerFuer));
  // „Nur nicht gesetzt" behält die Termine, die eine Lücke tragen: die Zeile
  // darüber sagt, WER geliefert hat, und erst daneben wird die Schuld lesbar.
  const eintraege = !nurLuecken
    ? sichtbar
    : sichtbar.filter(e => e.feld.code !== undefined && mitLuecke.has(ankerKey(e.feld.code, e.tag)));

  // Zurückgenommenes folgt DENSELBEN Filtern wie ein Termin — die Filterleiste
  // ist die Legende, und sie darf keine Zeile stehen lassen, deren Rolle sie
  // nicht anbietet. Bei „nur nicht gesetzt" fällt es ganz weg: die Ansicht
  // fragt dort nach Offenem, nicht nach Erledigtem.
  const stornos = nurLuecken ? [] : zurueckgenommene.filter(s =>
    rollenSicht(rollenVonFeld(s.feld), rollen) !== 'weg'
    && trifftBereich(s.tvIds, bereiche));

  // Das Fenster schneidet die GEMISCHTE Liste, nicht die Termine allein: ein
  // zurückgenommener Termin ist eine Zeile wie jede andere, und getrennt
  // gefenstert stünden am Rand des Ausschnitts Stornos ohne ihre Nachbarn.
  // Geschnitten wird VOR der Monatsgruppierung, damit Rinne und
  // „N Monate ohne Termin" den sichtbaren Ausschnitt beschreiben.
  const alleZeilen = mischeVerlaufZeilen(eintraege, stornos);
  const grenze = fenster === null || fenster.offen ? 0 : fenster.anzahl;
  const geschnitten = juengsteZeilen(alleZeilen, grenze);
  const monate = gruppiereNachMonat(geschnitten.sichtbar);
  const gefenstert = geschnitten.weggelassen > 0;
  // Der Schalter steht auch aufgeklappt da — aber nur, wenn Zuklappen etwas
  // verstecken würde. Sonst böte er einen Zustand an, der genauso aussieht.
  const zeigeFensterSchalter = fenster !== null
    && (gefenstert || (fenster.offen && alleZeilen.length > fenster.anzahl));

  const { profile } = useProfile();
  // Vorauswahl, keine Sperre — dieselbe Lesart wie in der Ordner-Liste. `alle`
  // heißt „nichts hervorheben"; die Rollenspalte steht trotzdem.
  const meineRolle = leseStatusRolle(profile?.status_rolle);
  const istMeins = (r: readonly Rolle[]): boolean =>
    meineRolle !== 'alle' && r.includes(meineRolle);

  // Nur die Termine, die das Fenster übrig gelassen hat, können eine Lücke
  // tragen — sonst hinge sie an einer Zeile, die gar nicht dasteht.
  const vorhanden = new Set(
    geschnitten.sichtbar
      .flatMap(z => (z.art === 'termin' && z.e.feld.code ? [ankerKey(z.e.feld.code, z.tag)] : [])),
  );
  const anTermin = new Map<string, OffenesPaarJeTv[]>();
  const anMonat = new Map<string, OffenesPaarJeTv[]>();
  const heimatlos: OffenesPaarJeTv[] = [];
  const monatsNamen = new Set(monate.map(m => m.monat));
  for (const p of offenePaare) {
    const key = ankerFuer(p);
    const monat = p.seit.slice(0, 7);
    const ziel = vorhanden.has(key) ? anTermin : monatsNamen.has(monat) ? anMonat : null;
    // Im Fenster entfällt der LETZTE Rückfall („ohne Bezug"): eine Lücke, deren
    // Termin und deren Monat beide außerhalb des Ausschnitts liegen, stünde
    // unter einem Ausschnitt, der sie nicht erklärt. Der Rückfall auf den Monat
    // bleibt — der ist ja sichtbar. Verloren ist nichts: die Kennzahlen-Zeile
    // darüber nennt alle nicht gesetzten Kürzel in Rot.
    if (ziel === null && gefenstert) continue;
    if (ziel === null) { heimatlos.push(p); continue; }
    const unter = ziel === anTermin ? key : monat;
    const liste = ziel.get(unter);
    if (liste) liste.push(p); else ziel.set(unter, [p]);
  }

  return (
    <div className="flex flex-col gap-2">
      {((zeigeSchalter && neben.length > 0) || meineRolle !== 'alle') && (
        <div className="flex flex-wrap items-center gap-2">
          {zeigeSchalter && neben.length > 0 && (
            <ToggleChip
              label="Nebensächliches"
              zahl={neben.length}
              selected={zeigeNebensaechlich}
              onToggle={onToggleNebensaechlich}
              title="Briefe, Bestätigungen und andere reine Nachrichtenkanäle"
            />
          )}
          {meineRolle !== 'alle' && (
            <span className={`text-[11px] ${LEISE}`}>
              Kante auf der Achse: {ROLLE_LABEL[meineRolle]} — Ihre Rolle laut Profil
            </span>
          )}
        </div>
      )}

      {/* Auch ohne einen einzigen Termin kann es eine Lücke geben — dann ist sie
          das Einzige, was zu sagen ist, und darf nicht mit der Liste wegfallen. */}
      {eintraege.length === 0 && stornos.length === 0 && heimatlos.length === 0 && anMonat.size === 0 ? (
        <div className={`py-6 text-[12px] ${LEISE}`}>
          Keine datierten Statuseinträge zur aktuellen Auswahl. Wert- und Textfelder stehen
          unten in der Ordner-Ansicht.
        </div>
      ) : (
        <div className="flex flex-col">
          {/* Der Schalter steht ÜBER der Liste, weil sie aufsteigend läuft: das
              Fenster zeigt ihr jüngstes Ende, das Fehlende liegt darüber. Er
              steht auch im aufgeklappten Zustand — ein Weg hin ohne Weg zurück
              wäre eine Einbahn. */}
          {zeigeFensterSchalter && fenster !== null && (
            <FensterSchalter
              weggelassen={
                gefenstert ? geschnitten.weggelassen : alleZeilen.length - fenster.anzahl
              }
              offen={fenster.offen}
              onKlick={fenster.onUmschalten}
            />
          )}
          {monate.map((m, i) => {
            const vorheriger = monate[i - 1]?.monat;
            const luecke = vorheriger === undefined ? 0 : monateDazwischen(vorheriger, m.monat);
            return (
              <div key={m.monat} className={`flex ${MONATS_TRENNER}`}>
                <div className="w-[84px] shrink-0 pr-2 pt-2">
                  <div className={`text-[11px] font-medium uppercase tracking-wide ${LEISE}`}>
                    {monatLabel(m.monat)}
                  </div>
                  {luecke >= LUECKE_AB ? (
                    <div className={`text-[10px] leading-tight ${LEISE}`} style={{ opacity: 0.75 }}>
                      {luecke} Monate ohne Termin
                    </div>
                  ) : null}
                </div>
                <ol className="min-w-0 flex-1 border-l border-[var(--tf-border)] pt-2">
                  {m.eintraege.map(z => {
                    if (z.art === 'storno') {
                      const rs = rollenVonFeld(z.s.feld);
                      return (
                        <StornoZeile
                          key={`storno:${z.s.feld.feldId}:${z.tag}:${z.s.art}`} s={z.s}
                          meins={istMeins(rs)}
                          gedimmt={rollenSicht(rs, rollen) === 'gedimmt'}
                          {...(tvNummern ? { tvNummern } : {})}
                          {...(tvGesamt !== undefined ? { tvGesamt } : {})}
                        />
                      );
                    }
                    const e = z.e;
                    const r = rollenVonFeld(e.feld);
                    return (
                      <Fragment key={`${e.feld.feldId}:${e.tag}`}>
                        <Zeile
                          e={e} version={version} meins={istMeins(r)}
                          gedimmt={rollenSicht(r, rollen) === 'gedimmt'}
                          imFokus={fokus === e.feld.feldId}
                          {...(onFokus ? { onFokus } : {})}
                          {...(tvNummern ? { tvNummern } : {})}
                          {...(tvGesamt !== undefined ? { tvGesamt } : {})}
                        />
                        {(e.feld.code ? anTermin.get(ankerKey(e.feld.code, e.tag)) ?? [] : []).map(p => (
                          <FehlZeile
                            key={`${p.tvId}:${p.fehlt}`} p={p}
                            meins={istMeins(p.rolle === null ? [] : [p.rolle])}
                            gedimmt={rollenSicht(p.rolle === null ? [] : [p.rolle], rollen) === 'gedimmt'}
                            {...(tvNummern ? { tvNummern } : {})}
                          />
                        ))}
                      </Fragment>
                    );
                  })}
                  {/* Lücken ohne sichtbaren Termin: der Monat stimmt, die Stelle
                      darin nicht — besser als sie zu verschlucken. */}
                  {(anMonat.get(m.monat) ?? []).map(p => (
                    <FehlZeile
                      key={`rest:${p.tvId}:${p.fehlt}`} p={p}
                      meins={istMeins(p.rolle === null ? [] : [p.rolle])}
                      gedimmt={rollenSicht(p.rolle === null ? [] : [p.rolle], rollen) === 'gedimmt'}
                      {...(tvNummern ? { tvNummern } : {})}
                    />
                  ))}
                </ol>
              </div>
            );
          })}
          {heimatlos.length > 0 && (
            <div className={`flex ${MONATS_TRENNER}`}>
              <div className={`w-[84px] shrink-0 pr-2 pt-2 text-[11px] font-medium uppercase tracking-wide ${LEISE}`}>
                ohne Bezug
              </div>
              <ol className="min-w-0 flex-1 border-l border-[var(--tf-border)] pt-2">
                {heimatlos.map(p => (
                  <FehlZeile
                    key={`heimatlos:${p.tvId}:${p.fehlt}`} p={p}
                    meins={istMeins(p.rolle === null ? [] : [p.rolle])}
                    gedimmt={rollenSicht(p.rolle === null ? [] : [p.rolle], rollen) === 'gedimmt'}
                    {...(tvNummern ? { tvNummern } : {})}
                  />
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      <Legende />
    </div>
  );
}
