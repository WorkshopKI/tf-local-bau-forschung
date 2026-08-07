/**
 * Das **VerlaufsBand**: Verbundspur oben, darunter je Teilvorhaben eine, alle
 * auf derselben Zeitachse.
 *
 * **React/CSS, kein SVG.** Die Segmente tragen Text, der kürzen und hovern
 * können muss; in einem `viewBox` skaliert Schrift mit der Grafik und wird
 * unlesbar (dieselbe Entscheidung wie in `StatusTimeline`).
 *
 * **Konfidenz sitzt an den KANTEN, nie am Statusfeld.** Der Status ist eine
 * beobachtete Tatsache — er steht so im Export. Unsicher ist die Zuschreibung:
 * ob ein Kürzel den Wechsel wirklich ausgelöst hat. Ein Segment einzufärben,
 * weil sein Übergang unsicher ist, verwechselte beides.
 *
 * **Keine Codes in der Bahn.** Sie stehen im Popover und im kopierten Text —
 * dort, wo jemand mit dem Fachsystem spricht. In der Bahn wäre `AK4` eine
 * Vokabel, die nur die Hälfte des Teams kennt.
 *
 * Gerechnet wird nebenan (alles rein und node-testbar): `bandGeometrie.ts`
 * platziert, `bandBeschriftung.ts` beschriftet, `bandKanten.ts` bündelt die
 * Übergänge je Tag. Diese Datei zeichnet; `BandFuss.tsx` steht darunter.
 */
import { useEffect, useMemo, useState } from 'react';
import { Tooltip } from '@/components/ui/Tooltip';
// Direkt, nicht über das Barrel: `textMessung` hängt nur an `data-table/types`,
// der Umweg zöge die halbe Tabellen-Schicht in dieses Bauteil.
import {
  aktuelleSchriftGeneration, messeBreite, warteAufSchriften,
} from '@/components/data-table/messung/textMessung';
import { useElementBreite } from '@/core/hooks/useElementBreite';
import { formatDatumsWert } from '@/core/services/csv/dateParse';
import type { Konfidenz, VerlaufsSpur } from '@/core/status/verlauf';
import { KONFIDENZ_TEXT, SpurListe, leise, spurTitel } from '../ausklapp/SpurListe';
import {
  baueBandGeometrie, buendle, dauerText, type BandSegment, type BandSpur,
} from './bandGeometrie';
import { verteileBeschriftung, type SegmentBeschriftung } from './bandBeschriftung';
import { baueKanten, type BandKante } from './bandKanten';
import { segmentFarbe } from './bandFarbe';
import { BandFuss, BandLegende, type LegendenEintrag } from './BandFuss';

/** Oberkante des Balkens in seiner Bahn. */
const BALKEN_OBEN = 4;
/**
 * Höhe des Balkens. Seit v3.36 20 statt 16 px: die Beschriftung steht bei
 * 11 px (vorher 10), und darunter wirkte der Balken wie ein Strich mit Text
 * darauf statt wie eine Fläche.
 */
const BALKEN_H = 20;
/** Höhe des Balken-Kastens einer Bahn — Balken plus etwas Luft darunter. */
const KASTEN_H = BALKEN_OBEN + BALKEN_H + 4;
/** Höhe einer Bahn inklusive Abstand zur nächsten. */
const SPUR_H = KASTEN_H + 6;
/** Zusatzhöhe einer Bahn, die eine zweite Beschriftungs-Etage trägt. */
const UNTER_H = 16;
/** Untergrenze der Spur-Beschriftung links — das Maß bis v3.35. */
const LABEL_MIN = 128;
/** Obergrenze: ab hier frisst die Beschriftung die Bahn, und `truncate` greift. */
const LABEL_MAX = 260;
/** Abstand zwischen Spur-Beschriftung und Bahn (`pr-2`). */
const LABEL_POLSTER = 8;
/** Unter diese Bahnbreite geht es nie, egal wie eng der Container wird. */
const MIN_BAHN = 320;
/**
 * Luft rechts neben der Achse. Am Achsenende sitzt Tinte, die über `geo.breite`
 * hinausragt: eine Kante wird um ihre halbe Breite nach links versetzt gezeichnet
 * (`x − 4`, 8 px breit), und ein auf die Mindestbreite kollabiertes Segment endet
 * einen Pixel dahinter. Ohne diese Luft scrollt die Bahn um genau diese vier
 * Pixel — ein Scrollbalken für nichts.
 */
const RAND_LUFT = 4;

/** Ein Segment ohne eigene Entscheidung — kann nur auftreten, wenn Geometrie
 *  und Beschriftung auseinanderliefen; dann lieber leer als falsch. */
const LEER_LABEL: SegmentBeschriftung = {
  lage: 'keine', text: '', x: 0, breite: 0, rechtsBuendig: false,
};

/**
 * Wie eine Kante gezeichnet wird — **eine** Rampe, kein Sortiment: die drei
 * belegten Stufen tragen ein volles Muster, die unbelegte einen halbdurch-
 * sichtigen Haarstrich.
 *
 * **Der Strich hat die Farbe des Hintergrunds, nicht der Schrift** — er ist ein
 * Schnitt durch den Balken. Eine Schriftfarbe funktionierte nur im hellen
 * Modus: dort sind die Balken satt und die Schrift dunkel, im dunklen Modus
 * aber sind die Balken pastellhell UND die Schrift hell (gemessen: #cccac4 auf
 * rgb(142,168,204), rund 1,3:1 — unsichtbar). Der Hintergrund ist in beiden
 * Modi die Gegenfarbe der Balken und trägt darum in beiden.
 *
 * Bis v3.35 trug `kein_kuerzel` statt eines Strichs ein Handsymbol. Es war
 * 9 px groß, lag in Tertiärfarbe auf einem gesättigten Balken und deckte den
 * Strich zu, der an derselben Stelle schon stand (siehe `bandKanten.ts`) —
 * niemand konnte es lesen, und rückgefragt wurde nach dem „mini Pfeil".
 */
const KANTE: Record<Konfidenz, { stil: string; staerke: string; deckung: number }> = {
  trigger_bestaetigt: { stil: 'solid', staerke: '2px', deckung: 1 },
  trigger_bedingt: { stil: 'dashed', staerke: '2px', deckung: 1 },
  zeitliche_naehe: { stil: 'dotted', staerke: '2px', deckung: 1 },
  kein_kuerzel: { stil: 'solid', staerke: '1px', deckung: 0.45 },
};

/**
 * Tooltip-Inhalt mit echten Zeilen. Der `text`-Weg des {@link Tooltip} kann das
 * nicht: sein Kasten steht auf `white-space: normal`, ein `\n` darin fällt zu
 * einem Leerzeichen zusammen.
 */
function Zeilen({ zeilen }: { zeilen: readonly string[] }): React.ReactElement {
  return (
    <span className="flex flex-col gap-0.5">
      {zeilen.map(z => <span key={z}>{z}</span>)}
    </span>
  );
}

function segmentZeilen(b: BandSegment): string[] {
  const s = b.segment;
  const zeitraum = `${s.vonDatum ? formatDatumsWert(s.vonDatum) : 'Anfang unbekannt'}`
    + ` – ${s.bisDatum ? formatDatumsWert(s.bisDatum) : 'offen'}`;
  const zeilen = [
    s.statusRef?.lang ?? 'ohne Status',
    `${zeitraum} · ${dauerText(s.dauerTage)}${s.dauerUnsicher ? ' (unsicher)' : ''}`,
  ];
  if (s.statusRef?.labelHerkunft === 'ohne') zeilen.push('Kurzform nicht gepflegt');
  if (s.statusRef?.labelHerkunft === 'fassung') zeilen.push('Kurzform aus eurer Fassung');
  return zeilen;
}

function Segment({ b, schrift }: {
  b: BandSegment; schrift: SegmentBeschriftung;
}): React.ReactElement {
  const s = b.segment;
  // Was hier steht, hat `bandBeschriftung.ts` entschieden — gemessen, nicht
  // geraten. Steht der Text unter dem Balken, bleibt der Balken selbst leer.
  const label = schrift.lage === 'im-balken' || schrift.lage === 'nummer' ? schrift.text : '';
  return (
    <Tooltip content={<Zeilen zeilen={segmentZeilen(b)} />} wrapperClassName="absolute" wrapperStyle={{
      left: b.links, width: b.breite, top: BALKEN_OBEN, height: BALKEN_H,
    }}>
      <span
        // `data-band-label`: Anker für die Gegenprobe im Abnahmelauf — läuft ein
        // gemessener Text doch über seinen Balken, ist `scrollWidth` größer als
        // der Kasten, und das Messmodell ist widerlegt.
        data-band-label=""
        // Polster NUR mit Text: ein leerer Balken hätte sonst 8 px Mindestbreite
        // (das `px-1` eines Blocks lässt sich nicht unterschreiten) und ein auf
        // die Mindestbreite kollabiertes Segment ragte achtfach über sein Maß
        // hinaus — sichtbar als Scrollbalken am rechten Bahnrand.
        className={`block h-full rounded-[2px] overflow-hidden text-[11px] leading-5 text-white whitespace-nowrap${
          label === '' ? '' : ' px-1'}`}
        style={{
          background: segmentFarbe(s.statusRef?.roh),
          // Angeschnittene Kante statt Ersatzbreite: wo eine Grenze fehlt, endet
          // das Segment im Nichts — eine gerade Kante behauptete ein Datum.
          ...(b.offenLinks
            ? { maskImage: 'linear-gradient(to right, transparent 0, black 10px)', WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 10px)' }
            : {}),
          ...(b.offenRechts
            ? { maskImage: 'linear-gradient(to left, transparent 0, black 10px)', WebkitMaskImage: 'linear-gradient(to left, transparent 0, black 10px)' }
            : {}),
        }}
      >
        {label}
      </span>
      {/* Bruchzeichen: hier ist der Zeitmaßstab gerissen, die Länge sagt nichts. */}
      {b.gestaucht && b.breite >= 18 && (
        <span
          className="absolute top-0 text-[9px] text-[var(--tf-text-tertiary)] pointer-events-none"
          style={{ left: b.breite / 2 - 5, lineHeight: `${BALKEN_H}px` }}
        >
          ⁄⁄
        </span>
      )}
    </Tooltip>
  );
}

/**
 * Die Kante an einer Segmentgrenze — Trägerin der Konfidenz.
 *
 * **Eine je Tag**, nicht eine je Kürzel: was an einem Tag zusammenfällt, steht
 * an derselben x-Position und lag vorher übereinander (`bandKanten.ts`). Der
 * Strich zeigt die beste Konfidenz des Tages, der Tooltip nennt jedes Kürzel
 * einzeln.
 */
function Kante({ k }: { k: BandKante }): React.ReactElement {
  const stil = KANTE[k.konfidenz];
  return (
    <Tooltip
      content={(
        <Zeilen zeilen={[
          formatDatumsWert(k.datum),
          ...k.uebergaenge.map(u => `${u.kuerzel} · ${KONFIDENZ_TEXT[u.konfidenz]}`),
        ]} />
      )}
      wrapperClassName="absolute"
      wrapperStyle={{ left: k.x - 4, top: BALKEN_OBEN, width: 8, height: BALKEN_H }}
    >
      <span className="block relative w-2 h-full">
        {/* Genau so hoch wie der Balken: außerhalb wäre der Strich
            hintergrundfarben auf Hintergrund, also nicht da. */}
        <span
          className="absolute inset-y-0 left-1/2"
          style={{
            borderLeft: `${stil.staerke} ${stil.stil} var(--tf-bg)`,
            opacity: stil.deckung,
          }}
        />
      </span>
    </Tooltip>
  );
}

/**
 * Warum diese Bahn keinen Verlauf zeigt — **je Lage ein eigener Satz**.
 *
 * `null` nur bei einer echten Bahn. Alles andere bekommt Worte: „für diese
 * Richtlinie keine Regeln" (Richtlinie 2015, 552 NW-Verbünde) und „kein
 * Bearbeitungsstand" (Irrläufer) sind verschiedene Auskünfte, und keine davon
 * ist eine leere graue Zeile.
 */
function lageText(spur: VerlaufsSpur): string | null {
  if (spur.regelLage !== undefined) {
    return spur.regelLage === 'programm-unbekannt'
      ? 'Richtlinie unbekannt — keine Regelquelle'
      : 'für diese Richtlinie keine Regeln';
  }
  if (spur.zustand === 'kein_bearbeitungsstand') return 'kein Bearbeitungsstand';
  if (spur.zustand === 'kein_wert_im_csv') return 'kein Statuswert im Export';
  if (spur.zustand === 'nicht_beobachtet') return 'kein Übergang erklärt diesen Status';
  return null;
}

/**
 * Die Beschriftung eines Segments, die nicht in seinen Balken passte. Sie steht
 * in der zweiten Etage und darf unter den Balken ihrer Nachbarn hinweglaufen —
 * die liegen höher, es wird nichts verdeckt.
 *
 * **Die Zuordnung ist das ganze Problem dieser Etage.** Ein Text, der links an
 * seinem schmalen Abschnitt beginnt und weit nach rechts reicht, liegt unter
 * FREMDEN Balken, und das Auge paart ihn mit dem, was direkt darüber steht
 * („warum steht unter *NF gestellt* der Text *keine weiteren NF*?"). Deshalb
 * beginnt der Strich bündig an der Unterkante des Balkens und trägt DESSEN
 * Farbe: er liest sich als Fortsetzung des eigenen Abschnitts nach unten, nicht
 * als Trennlinie irgendwo im Feld.
 */
function UnterLabel({ s, farbton }: {
  s: SegmentBeschriftung; farbton: string;
}): React.ReactElement {
  return (
    <span
      className={`absolute text-[11px] leading-4 whitespace-nowrap pointer-events-none
        text-[var(--tf-text-secondary)] ${s.rechtsBuendig ? 'pr-1' : 'pl-1'}`}
      style={{
        left: s.x,
        // Bündig an der Balken-Unterkante — jeder Abstand macht aus dem Strich
        // eine freistehende Linie.
        top: BALKEN_OBEN + BALKEN_H,
        // Nach innen gerückt zeigt der Strich nach rechts: links stünde er in
        // einem fremden Abschnitt.
        ...(s.rechtsBuendig
          ? { borderRight: `2px solid ${farbton}` }
          : { borderLeft: `2px solid ${farbton}` }),
      }}
    >
      {s.text}
    </span>
  );
}

function Bahn({ b, breite, labelBreite, eigenes, offen, onToggle, schrift, unterzeile }: {
  b: BandSpur; breite: number; labelBreite: number; eigenes: string;
  offen: boolean; onToggle: () => void;
  /** Beschriftungsentscheidung je Segment, indexgleich zu `b.segmente`. */
  schrift: readonly SegmentBeschriftung[];
  /** Trägt diese Bahn eine zweite Etage? Dann wächst sie um deren Höhe. */
  unterzeile: boolean;
}): React.ReactElement {
  const spur = b.spur;
  const lage = lageText(spur);
  const gruppe = b.gleiche.length > 0 ? ` +${b.gleiche.length}` : '';
  const kanten = useMemo(() => baueKanten(b.segmente, spur.uebergaenge), [b.segmente, spur.uebergaenge]);
  // Höhe JE BAHN, nicht global: ein Verbund mit acht Teilvorhaben soll nicht
  // überall Platz verschenken, weil eine einzige Bahn eine zweite Etage braucht.
  // Die Zusage „derselbe Tag, dieselbe x-Position" bricht davon nicht — die
  // Achse ist waagerecht geteilt, nicht senkrecht.
  const zusatz = unterzeile ? UNTER_H : 0;
  return (
    <div className="flex items-start" style={{ height: SPUR_H + zusatz }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={offen}
        className={`shrink-0 text-left text-[11.5px] truncate pr-2 cursor-pointer ${
          offen ? 'text-[var(--tf-text)] font-medium' : 'text-[var(--tf-text-secondary)]'}`}
        style={{ width: labelBreite, lineHeight: `${KASTEN_H}px` }}
        title={spurTitel(spur, eigenes) + (gruppe ? ` (und ${b.gleiche.length} weitere mit gleichem Verlauf)` : '')}
      >
        {spurTitel(spur, eigenes)}{gruppe}
      </button>
      <div className="relative" style={{ width: breite, height: KASTEN_H + zusatz }}>
        {/* Die Lage steht DANEBEN, nicht statt der Bahn: ein Vorgang ohne
            erklärten Wechsel trägt trotzdem seinen Status, und der gehört
            gezeichnet. Nur wenn es gar kein Segment gibt, tritt der Satz an
            seine Stelle. */}
        {lage !== null && (
          <span
            className={`absolute ${leise} italic whitespace-nowrap pointer-events-none z-[1]`}
            style={{
              top: BALKEN_OBEN, lineHeight: `${BALKEN_H}px`,
              ...(b.segmente.length === 0 ? { left: 0 } : { left: 6 }),
            }}
          >
            {lage}
          </span>
        )}
        {b.segmente.length === 0 ? null : (
          <>
            {b.segmente.map((s, i) => (
              <Segment key={`${s.segment.vonDatum}-${i}`} b={s} schrift={schrift[i] ?? LEER_LABEL} />
            ))}
            {/* Die zweite Etage NACH den Balken, damit sie im Zweifel obenauf
                liegt — sie läuft absichtlich unter fremde Balken hinweg. */}
            {schrift.map((s, i) => (s.lage === 'unter-balken'
              ? (
                <UnterLabel
                  key={`u-${i}`} s={s}
                  farbton={segmentFarbe(b.segmente[i]?.segment.statusRef?.roh)}
                />
              )
              : null))}
            {/* Je Tag eine Kante. Die Konfidenz gehört hierher, nicht auf die
                Fläche daneben. */}
            {kanten.map(k => <Kante key={k.datum} k={k} />)}
          </>
        )}
      </div>
    </div>
  );
}

export function VerlaufsBand({
  spuren, eigenes, bezugsZeitpunkt, breite = 620,
  fassung = null, journalAb = null, journalGenutzt = false,
}: {
  spuren: readonly VerlaufsSpur[];
  eigenes: string;
  bezugsZeitpunkt: string;
  /**
   * Breite für den ERSTEN Rahmen, bevor die Messung greift — danach folgt die
   * Bahn dem Container. Die Bahn darf über ihn hinauswachsen und scrollt dann.
   */
  breite?: number;
  /** Beschriftung der geladenen Katalogfassung — gehört in den kopierten Text. */
  fassung?: string | null;
  journalAb?: string | null;
  /** Ob das Journal für DIESE Bahn herangezogen wurde (Fußzeile). */
  journalGenutzt?: boolean;
}): React.ReactElement {
  const [offen, setOffen] = useState<string | null>(null);
  // Gemessen wird der Scroll-Behälter der Bahn: seine Breite kommt von OBEN
  // (Block in einer Flex-Spalte), sein Inhalt fließt daran vorbei in den Scroll
  // — es gibt also keine Rückkopplung Inhalt → Container → Inhalt. Das setzt
  // voraus, dass kein Vorfahr shrink-to-fit ist; `TableBody` gibt dem Bereich
  // seit v3.32 die sichtbare Tabellenbreite (`portBreite`).
  const [scroll, gemessen] = useElementBreite<HTMLDivElement>('inhalt');

  // Die Webschriften laden asynchron. Wer vorher misst, bekommt die Metrik der
  // Ersatzschrift und bleibt dabei — die Beschriftungen wären systematisch zu
  // schmal gemessen und liefen über ihre Balken hinaus. Genau eine Neumessung,
  // sobald sie stehen (`textMessung.ts` zählt die Generation hoch).
  const [schriftGen, setSchriftGen] = useState(() => aktuelleSchriftGeneration());
  useEffect(() => {
    let lebt = true;
    void warteAufSchriften().then(() => {
      if (lebt) setSchriftGen(aktuelleSchriftGeneration());
    });
    return () => { lebt = false; };
  }, []);

  // Die Spur-Beschriftung bekommt die Breite, die ihr längster Titel braucht.
  // Sie hing bis v3.35 an einer festen Zahl, und `16KN073848 (diese Zeile)`
  // brauchte 137 px — abgeschnitten wurde ausgerechnet der Zusatz, der die
  // eigene Zeile benennt. Gemessen wird über `buendle`, also über GENAU die
  // Titel, die die Geometrie später zeichnet (die Bündelung hängt nicht an der
  // Breite, es entsteht kein Ringschluss).
  const labelBreite = useMemo(() => {
    let max = 0;
    for (const b of buendle(spuren)) {
      const gruppe = b.gleiche.length > 0 ? ` +${b.gleiche.length}` : '';
      max = Math.max(max, messeBreite(spurTitel(b.spur, eigenes) + gruppe, 'bandSpur'));
    }
    return Math.min(LABEL_MAX, Math.max(LABEL_MIN, Math.ceil(max) + LABEL_POLSTER));
    // `schriftGen`: siehe unten — die Signatur des modulweiten Messcaches.
  }, [spuren, eigenes, schriftGen]);

  // `gemessen === null`: erster Rahmen, verborgene Pane oder kein
  // `ResizeObserver` — dann gilt der Prop. Die Spur-Beschriftung links geht vom
  // gemessenen Platz ab, sie steht neben der Bahn, nicht darin.
  const vorgabe = Math.max(
    MIN_BAHN,
    gemessen === null ? breite : gemessen - labelBreite - RAND_LUFT,
  );
  const geo = useMemo(
    () => baueBandGeometrie(spuren, bezugsZeitpunkt, vorgabe),
    [spuren, bezugsZeitpunkt, vorgabe],
  );

  // Die Legende: volle Bezeichner in Verlaufsreihenfolge, entdoppelt. Ihre
  // REIHENFOLGE steht unabhängig von der Beschriftung fest — offen ist nur, ob
  // die Nummern gebraucht werden.
  const legende = useMemo(() => {
    const gesehen = new Set<string>();
    const out: LegendenEintrag[] = [];
    for (const b of geo.spuren) {
      for (const s of b.segmente) {
        const r = s.segment.statusRef;
        if (!r || gesehen.has(r.kurz)) continue;
        gesehen.add(r.kurz);
        out.push({ kurz: r.kurz, lang: r.lang, roh: r.roh });
      }
    }
    return out;
  }, [geo]);

  const nummern = useMemo(
    () => new Map(legende.map((l, i) => [l.kurz, i + 1] as const)),
    [legende],
  );

  const beschriftung = useMemo(
    () => verteileBeschriftung(geo.spuren, {
      bahnBreite: geo.breite,
      messeText: (t: string) => messeBreite(t, 'bandLabel'),
      nummerVon: (k: string) => nummern.get(k),
    }),
    // `schriftGen` ist kein Argument der Rechnung, sondern die Signatur des
    // modulweiten Messcaches: wechselt sie, ist jede vorherige Messung ungültig.
    [geo, nummern, schriftGen],
  );

  // Nummeriert wird genau dann, wenn ein Segment eine Nummer TRÄGT. Eine Nummer
  // ist eine Brücke; ohne Segment, das sie braucht, führt sie nirgendwohin und
  // wäre in der Legende nur Rauschen.
  const nummeriert = beschriftung.nummernGenutzt;
  const offeneSpur = geo.spuren.find(b => `${b.spur.art}-${b.spur.id}` === offen);

  return (
    <div className="flex flex-col gap-2">
      {/* Die Bahn scrollt in ihrem EIGENEN Container — der Seiten-Body nie. */}
      <div ref={scroll} className="overflow-x-auto">
        <div style={{ width: labelBreite + geo.breite + RAND_LUFT }}>
          {/* Achsenmarken oben, damit die Stauchung ablesbar bleibt. */}
          <div className="relative" style={{ height: 12, marginLeft: labelBreite }}>
            {geo.marken.map(m => (
              <span key={m.label} className={`absolute top-0 ${leise}`} style={{ left: m.x }}>
                {m.label}
              </span>
            ))}
          </div>
          {geo.spuren.map((b, i) => {
            const key = `${b.spur.art}-${b.spur.id}`;
            return (
              <Bahn
                key={key} b={b} breite={geo.breite} labelBreite={labelBreite} eigenes={eigenes}
                schrift={beschriftung.segmente[i] ?? []}
                unterzeile={beschriftung.unterzeile[i] ?? false}
                offen={offen === key}
                onToggle={() => setOffen(offen === key ? null : key)}
              />
            );
          })}
        </div>
      </div>

      {/* Erst die Legende — sie erklärt das Bild darüber und gehört an dessen
          Kante. Die Herkunft ist eine Fußnote und steht darunter. */}
      <BandLegende eintraege={legende} nummeriert={nummeriert} />

      <BandFuss
        spuren={spuren} eigenes={eigenes}
        angabe={{ bezugsZeitpunkt, fassung, journalAb, journalGenutzt }}
      />

      {/* Höchstens eine Spur offen — die schlichte Liste aus Phase 2 als
          Aufklappstufe, nicht als Ersatz. */}
      {offeneSpur !== undefined && (
        <div className="rounded px-2.5 py-2" style={{ background: 'var(--tf-bg-secondary)' }}>
          <SpurListe spur={offeneSpur.spur} eigenes={eigenes} />
          {offeneSpur.gleiche.length > 0 && (
            <p className={`${leise} mt-1`}>
              Gleicher Verlauf: {offeneSpur.gleiche.map(s => s.id).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
