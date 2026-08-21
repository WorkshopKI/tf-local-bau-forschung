/**
 * Die Chronik **nach Phase**: eine Zeile je Kürzel, eine Spalte je Träger.
 *
 * Sie ersetzt einen Arbeitsgang, nicht ein Bild. Im Fachsystem wird für die
 * Frage „haben alle Teilvorhaben das schon?" der Verbund und danach jedes TV
 * einzeln geöffnet, und der Vergleich entsteht im Kopf des Lesers. Hier ist er
 * die Ansicht: nebeneinander steht, wer geliefert hat, wer später, und wo das
 * Kürzel fehlt.
 *
 * **Dasselbe Bild wie „nach Datum", andere Ordnung.** Rinne, Kürzel, Rolle und
 * Ereignistext stehen an denselben x-Positionen wie in {@link StatusChronik},
 * die Zeilen sind gleich hoch, und getrennt wird nur am Gruppenwechsel — dort
 * der Monat, hier die Phase. Beim Umschalten tauscht deshalb nur die rechte
 * Hälfte: Träger-Spalten mit Datum statt Datum plus Träger-Marken. Das Maß dazu
 * liegt in `verlaufGeometrie.ts` und gilt für beide.
 *
 * **Feste Spaltenbreiten** (`<colgroup>` in px, nicht `auto`): die Datumsspalten
 * sind der Vergleich. Ließe man sie sich nach Inhalt bemessen, wanderten sie mit
 * jedem Filterklick, und untereinander stünde nichts mehr. Die Zellen tragen
 * dafür **kein waagerechtes Polster** — sonst wäre die `<col>`-Breite nicht mehr
 * die ganze Wahrheit, und die Ausrichtung gegen die Chronik ginge verloren.
 *
 * **Die zweite Spalte ist leer.** Sie hält den Platz der Tagesspalte: die
 * Termine stehen hier in den Träger-Spalten, aber ohne den Slot spränge alles
 * dahinter beim Umschalten um gut 40 px nach links.
 *
 * **Das Jahr steht nur da, wenn es eines braucht.** Läuft die Matrix über einen
 * Jahreswechsel, tragen alle Zellen zwei Stellen mehr — sonst keine. Ein
 * Vorgang, der von November bis Februar läuft, hätte sonst vier Spalten, deren
 * Reihenfolge man nicht lesen kann.
 *
 * Gerechnet wird nebenan in `chronik-matrix.ts` (rein, node-getestet); diese
 * Datei zeichnet.
 */
import {
  ZAH_MARKER_LABEL, phasenGruppen, rollenSicht, rollenVonFeld, zahPhaseLabel,
  type MappingVersion, type MatrixSpalte, type MatrixZelle, type Rolle,
  type SchrittZeile,
} from '@/core/status';
import { formatDatumsWert } from '@/core/services/csv/dateParse';
import { RollenBadges } from './VerlaufBadges';
import {
  RINNE_TEXT, SPALTE_CODE, SPALTE_RINNE, SPALTE_ROLLE, SPALTE_TAG, ZEILE_KLASSE,
} from './verlaufGeometrie';

const LEISE = 'text-[var(--tf-text-tertiary)]';

/** Träger- und Spannen-Spalte — sie haben in der Chronik kein Gegenstück. */
const B_TRAEGER = 86;
const B_SPANNE = 108;
/** Was der Ereignis-Spalte mindestens bleiben muss, bevor waagerecht gescrollt wird. */
const B_EREIGNIS_MIN = 220;

/** Kein senkrechtes Polster: die Zeilenhöhe trägt den Abstand allein (siehe
 *  Modulkopf der Chronik — bei 28 Terminen sind 3 px je Zeile ein Eintrag). */
const ZELLE = `align-middle ${ZEILE_KLASSE}`;
/** Der Abstand einer Gruppe zu ihrer Trennlinie — wie `pt-2` in der Chronik. */
const GRUPPE = 'border-t border-[var(--tf-border)] pt-2';
/** Kopfzelle. Die Linie sitzt an den ZELLEN, nicht an der Zeile: `border-separate`
 *  zeichnet keinen Rand am `<tr>` (dort blieb sie bis v4.13x unsichtbar). */
const KOPF = `${ZELLE} border-b border-[var(--tf-border)] pb-1.5`;

/**
 * Was in der Rinne steht — meist die Beschriftung selbst.
 *
 * Ausnahme ist der Marker: „Marker (ohne Phase)" ist mit 126 px doppelt so
 * breit wie die 76 px, die die Rinne hergibt, und bräche dort dreifach um. In
 * der Rinne steht deshalb „Marker" — dasselbe Wort, mit dem das
 * Herleitungs-Popover den Fall benennt. Der volle Wortlaut steht im Titel.
 */
function kurzeRinne(label: string): string {
  return label === ZAH_MARKER_LABEL ? 'Marker' : label;
}

/** Kürzt `10.03.2026` auf `10.03.` bzw. `10.03.26`. */
function tagKurz(tag: string, mitJahr: boolean): string {
  const voll = formatDatumsWert(tag);
  return mitJahr ? `${voll.slice(0, 6)}${voll.slice(-2)}` : voll.slice(0, 6);
}

/**
 * Was in einer Zelle steht — Datum, Schuld oder nichts.
 *
 * Die Schuld steht **einzeilig**: bis v4.13x standen „− 14 T" und „nicht
 * gesetzt" übereinander, und diese eine Zellenart sprengte als einzige das
 * Zeilenraster der Tabelle. Was der zweite Satz sagte, sagen jetzt die Farbe,
 * der Tooltip und die Fußzeile unter der Tabelle — einmal je Tabelle statt
 * einmal je Zelle.
 */
function Zelle({ zelle, mitJahr }: {
  zelle: MatrixZelle | undefined; mitJahr: boolean;
}): React.ReactElement {
  if (zelle === undefined) {
    return <span className={`font-mono text-[11.5px] ${LEISE}`} aria-hidden="true">–</span>;
  }
  if (zelle.art === 'datum') {
    return (
      <span className="font-mono text-[11.5px] text-[var(--tf-text)]">
        {tagKurz(zelle.tag, mitJahr)}
      </span>
    );
  }
  return (
    <span
      className="font-mono text-[11.5px]"
      style={{ color: 'var(--tf-danger-text)' }}
      title={`Kürzel nicht gesetzt — offen seit ${formatDatumsWert(zelle.seit)}`}
    >
      − {zelle.tage} T
    </span>
  );
}

/**
 * Die Streuung zwischen den Teilvorhaben: Zahl plus Balken.
 *
 * Der Balken ist relativ zur größten Streuung **dieser** Tabelle — er vergleicht
 * die Zeilen miteinander, nicht gegen eine absolute Skala. Eine absolute wäre
 * hier bedeutungslos: ob 18 Tage viel sind, entscheidet der Vorgang.
 */
function Spanne({ zeile, maximum }: { zeile: SchrittZeile; maximum: number }): React.ReactElement {
  const t = zeile.streuungTage;
  if (t === null) {
    return <span className={`text-[11px] ${LEISE}`} aria-hidden="true">–</span>;
  }
  if (t === 0) {
    return <span className={`text-[11px] ${LEISE}`}>gleichzeitig</span>;
  }
  const text = t >= 60 ? `${Math.round(t / 30)} Mon` : `${t} T`;
  const anteil = maximum > 0 ? Math.max(0.06, t / maximum) : 0;
  return (
    <span
      className="flex items-center gap-1.5"
      title={`${formatDatumsWert(zeile.fruehestesTv ?? '')} – ${formatDatumsWert(zeile.spaetestesTv ?? '')}`}
    >
      <span className="w-[42px] shrink-0 text-[11px] text-[var(--tf-text-secondary)]">{text}</span>
      <span
        aria-hidden="true"
        className="h-[3px] min-w-0 flex-1 rounded-full"
        style={{ background: 'var(--tf-bg-secondary)' }}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${anteil * 100}%`, background: 'var(--tf-text-tertiary)' }}
        />
      </span>
    </span>
  );
}

export function StatusSchrittMatrix({
  zeilen, spalten, version, fokus, onFokus, rollenWahl,
}: {
  zeilen: readonly SchrittZeile[];
  spalten: readonly MatrixSpalte[];
  version: MappingVersion;
  /** Fokussierte Feld-Id; bleibt über den Ansichtswechsel hinweg stehen. */
  fokus: string | null;
  onFokus: (feldId: string | null) => void;
  /** Rollenwahl — entscheidet, welche Zeile abgeblendet steht. */
  rollenWahl: ReadonlySet<Rolle>;
}): React.ReactElement {
  const rinne = phasenGruppen(zeilen);
  const maximum = zeilen.reduce((m, z) => Math.max(m, z.streuungTage ?? 0), 0);
  const jahre = new Set<string>();
  let mitLuecke = false;
  for (const z of zeilen) {
    for (const zelle of z.zellen.values()) {
      if (zelle.art === 'datum') jahre.add(zelle.tag.slice(0, 4));
      else mitLuecke = true;
    }
  }
  const mitJahr = jahre.size > 1;
  const minBreite = SPALTE_RINNE + SPALTE_TAG + SPALTE_CODE + SPALTE_ROLLE
    + B_EREIGNIS_MIN + spalten.length * B_TRAEGER + B_SPANNE;

  if (zeilen.length === 0) {
    return (
      <div className={`py-6 text-[12px] ${LEISE}`}>
        Keine Schritte zur aktuellen Auswahl. Wert- und Textfelder stehen unten in der
        Ordner-Ansicht.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        {/* `border-separate` statt `collapse`: nur so liegt die Achsenlinie der
            zweiten Spalte INNERHALB ihrer `<col>`-Breite, und die Summe der
            Spalten trifft die x-Positionen der Chronik auf den Pixel. */}
        <table
          className="w-full border-separate border-spacing-0 text-left"
          style={{ tableLayout: 'fixed', minWidth: minBreite }}
        >
          <colgroup>
            <col style={{ width: SPALTE_RINNE }} />
            <col style={{ width: SPALTE_TAG }} />
            <col style={{ width: SPALTE_CODE }} />
            <col style={{ width: SPALTE_ROLLE }} />
            <col />
            {spalten.map(s => <col key={s.id} style={{ width: B_TRAEGER }} />)}
            <col style={{ width: B_SPANNE }} />
          </colgroup>
          <thead>
            <tr>
              <th className={`${KOPF} pr-2 ${RINNE_TEXT} ${LEISE}`}>Phase</th>
              {/* Der Platzhalter der Tagesspalte — siehe Modulkopf. */}
              <th aria-hidden="true" className={KOPF} />
              <th className={`${KOPF} text-[10.5px] font-normal ${LEISE}`}>Kürzel</th>
              <th className={`${KOPF} text-[10.5px] font-normal ${LEISE}`}>Wer</th>
              <th className={`${KOPF} pr-2 text-[10.5px] font-normal ${LEISE}`}>Ereignis</th>
              {spalten.map(s => (
                <th key={s.id} className={`${KOPF} text-center font-normal`}>
                  <span className="block text-[11.5px] text-[var(--tf-text)]">{s.kurz}</span>
                  <span className={`block truncate font-mono text-[10px] ${LEISE}`} title={s.lang}>
                    {s.lang}
                  </span>
                </th>
              ))}
              <th className={`${KOPF} text-[10.5px] font-normal ${LEISE}`}>
                <span className="block">Spanne</span>
                <span className="block text-[10px]">TV-Streuung</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z, i) => {
              const rollen = rollenVonFeld(z.feld);
              const gedimmt = rollenSicht(rollen, rollenWahl) !== 'voll';
              const meilenstein = z.feld.prominenzDefault === 'meilenstein';
              const imFokus = fokus === z.feld.feldId;
              const gruppe = rinne[i];
              const voll = gruppe == null || gruppe.phase === null
                ? '' : zahPhaseLabel(gruppe.phase, version.zahPhasen);
              // Getrennt wird am Gruppenwechsel, nicht unter jeder Zeile — wie
              // der Monatstrenner der Chronik. Eine Linie je Zeile ließ die
              // Tabelle als Gitter lesen, obwohl die Gliederung die Phase ist.
              //
              // Und nur, wo die Rinne auch etwas SAGT: Zeilen, für die das
              // Fachsystem keine Phase führt, bilden zwar eine eigene Gruppe
              // (sie gehören der vorigen nicht), aber eine Linie über einer
              // leeren Rinne behauptete einen Wechsel, den niemand benennen
              // kann. Die erste Gruppe bekommt nur den Abstand: über ihr steht
              // schon die Linie des Tabellenkopfs, und zwei davon lesen sich
              // als eine doppelt gezogene.
              const trennt = voll !== '';
              const extra = trennt ? (i > 0 ? GRUPPE : 'pt-2') : '';
              const td = `${ZELLE} ${extra}`;
              return (
                <tr
                  key={z.feld.feldId}
                  onClick={() => onFokus(imFokus ? null : z.feld.feldId)}
                  className="cursor-pointer hover:bg-[var(--tf-hover)]"
                  style={imFokus ? { background: 'var(--tf-bg-secondary)' } : undefined}
                >
                  {/* Die Beschriftung steht über der GANZEN Gruppe, nicht in
                      ihrer ersten Zeile: „Marker (ohne Phase)" bricht in der
                      84 px schmalen Rinne dreifach um und machte aus einer
                      22-px-Zeile eine von 66. Über `rowSpan` trägt der Umbruch
                      die Gruppe — genau wie der Monat in der Chronik neben dem
                      ganzen Block steht und nicht neben seinem ersten Termin. */}
                  {gruppe != null && (
                    <td
                      rowSpan={gruppe.laenge}
                      // Ohne `ZELLE`: dessen `align-middle` und dieses
                      // `align-top` sind dieselbe Eigenschaft, und welches
                      // gewinnt, entschiede die Reihenfolge im erzeugten CSS,
                      // nicht die im Klassen-String. Die Zeilenhöhe erbt die
                      // Rinne ohnehin nicht — sie steht über der ganzen Gruppe.
                      className={`align-top pr-2 pt-2 ${extra} ${RINNE_TEXT} ${LEISE}`}
                      {...(voll === '' ? {} : { title: voll })}
                    >
                      {/* Zwei Zeilen sind das Maß der Rinne: eine kuratierte
                          Beschriftung kann beliebig lang sein, und in 76 px
                          bricht sie schnell dreifach um — dann bestimmte das
                          Label die Höhe einer Gruppe, statt sie zu benennen.
                          Der volle Wortlaut steht im Titel der Zelle. */}
                      <span className="line-clamp-2">{kurzeRinne(voll)}</span>
                    </td>
                  )}
                  {/* Die Achse läuft durch alle Zeilen — dieselbe Linie, die in
                      der Chronik am `<ol>` hängt. */}
                  <td className={`${td} border-l border-[var(--tf-border)]`} />
                  <td className={`${td} truncate font-mono text-[11.5px]`}>
                    <span
                      style={{
                        color: gedimmt
                          ? 'var(--tf-text-tertiary)'
                          : meilenstein ? 'var(--tf-primary)' : 'var(--tf-text-secondary)',
                      }}
                    >
                      {z.feld.code ?? ''}
                    </span>
                  </td>
                  <td className={td}>
                    <RollenBadges rollen={rollen} gedimmt={gedimmt} />
                  </td>
                  <td className={`${td} truncate pr-2`} title={z.feld.label}>
                    <span
                      className="text-[12.5px]"
                      style={{
                        color: gedimmt ? 'var(--tf-text-tertiary)' : 'var(--tf-text)',
                        ...(meilenstein ? { fontWeight: 500 } : {}),
                      }}
                    >
                      {z.feld.label}
                    </span>
                  </td>
                  {spalten.map(s => (
                    <td key={s.id} className={`${td} text-center`}>
                      <Zelle zelle={z.zellen.get(s.id)} mitJahr={mitJahr} />
                    </td>
                  ))}
                  <td className={td}>
                    <Spanne zeile={z} maximum={maximum} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Was das Rot in einer Datumsspalte bedeutet — einmal je Tabelle. In der
          Zelle selbst stand es bis v4.13x als zweite Zeile und kostete dort
          jede Zeile Höhe (siehe {@link Zelle}). */}
      {mitLuecke && (
        <p className={`text-[11px] ${LEISE}`}>
          <span style={{ color: 'var(--tf-danger-text)' }}>− N T</span> in Rot: Kürzel nicht
          gesetzt, seit N Tagen offen.
        </p>
      )}
    </div>
  );
}
