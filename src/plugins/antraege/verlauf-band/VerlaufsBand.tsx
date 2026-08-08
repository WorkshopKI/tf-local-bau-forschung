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
 * **Die Kürzel stehen ÜBER der Bahn** — seit v3.38, und das widerruft eine
 * Entscheidung: bis dahin galt „keine Codes in der Bahn", weil `AK4` eine
 * Vokabel ist, die nur die Hälfte des Teams kennt. Dagegen steht, dass das
 * Kürzel der **Griff zum Gespräch mit C16** ist: wer nachfragt, nennt es. Die
 * Etage über dem Balken stand ohnehin leer, und der volle Statusname bleibt
 * dort, wo er war. Was nicht ohne Überlappung passt, entfällt (`bandKanten.ts`)
 * — im Bestand mit sechsundzwanzig Grenzen zeigt sich deshalb nur ein Teil.
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
import { URTEIL_FARBE, URTEIL_LABEL } from '../waechterLabels';
import {
  baueBandGeometrie, buendle, dauerText, type BandSegment, type BandSpur,
} from './bandGeometrie';
import {
  verteileBeschriftung, type SegmentBeschriftung, type UnterEintrag,
} from './bandBeschriftung';
import { baueKanten, verteileKuerzel, type BandKante } from './bandKanten';
import { segmentFarbe, segmentFuellung } from './bandFarbe';
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
/** Zusatzhöhe einer Bahn, die Kürzel ÜBER dem Balken trägt. */
const KUERZEL_H = 14;
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
const LEER_LABEL: SegmentBeschriftung = { lage: 'keine', text: '', unten: null };

/**
 * Wie eine Kante gezeichnet wird — **eine** Rampe, kein Sortiment: die drei
 * belegten Stufen tragen ein volles Muster, die unbelegte einen halbdurch-
 * sichtigen Haarstrich.
 *
 * **Der Strich trägt den satten Akzent des Abschnitts, der hier beginnt**
 * (v3.38). Damit ist er zweierlei in einem Element: Träger der Konfidenz *und*
 * sichtbare Segmentgrenze. Beides braucht er, seit die Flächen getönt sind —
 * ihr Farbunterschied allein trennt zu schwach (`offen`/`in Prüfung` liegen
 * getönt nur noch 11 RGB-Einheiten auseinander).
 *
 * Zwei verworfene Vorgänger, damit sie nicht wiederkommen: eine **Schrift**farbe
 * war im dunklen Modus unsichtbar (Balken UND Schrift hell, gemessen #cccac4
 * auf rgb(142,168,204) ≈ 1,3:1); die **Hintergrund**farbe (v3.36–v3.37) war der
 * richtige Schnitt durch eine SATTE Fläche, auf einer getönten aber
 * Hintergrund auf Fast-Hintergrund. Und bis v3.35 trug `kein_kuerzel` statt
 * eines Strichs ein 9-px-Handsymbol, das den Strich zudeckte, der an derselben
 * Stelle schon stand — rückgefragt wurde nach dem „mini Pfeil".
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

function Segment({ b, schrift, erstes, letztes }: {
  b: BandSegment; schrift: SegmentBeschriftung;
  /** Randlage in der Bahn — nur außen wird gerundet (siehe unten). */
  erstes: boolean; letztes: boolean;
}): React.ReactElement {
  const s = b.segment;
  // Was hier steht, hat `bandBeschriftung.ts` entschieden — gemessen, nicht
  // geraten. Steht der Text unter dem Balken, bleibt der Balken selbst leer
  // (`text` ist dann `''`).
  const label = schrift.text;
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
        // Gerundet wird nur AUSSEN (v3.38): innen gerundete Segmente lasen sich
        // als Kachelreihe, nicht als eine Zeitleiste. Eine angeschnittene Kante
        // (`offenLinks`/`offenRechts`) bleibt eckig — die Maske blendet sie
        // ohnehin aus, und eine Rundung darauf behauptete einen Abschluss.
        className={`block h-full overflow-hidden text-[11px] leading-5 text-[var(--tf-text)] whitespace-nowrap${
          erstes && !b.offenLinks ? ' rounded-l-[3px]' : ''}${
          letztes && !b.offenRechts ? ' rounded-r-[3px]' : ''}${
          label === '' ? '' : ' px-1'}${
          // Der letzte Abschnitt IST der geltende Stand — das darf man sehen.
          letztes ? ' font-medium' : ''}`}
        style={{
          background: segmentFuellung(s.statusRef?.roh),
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
        {/* Genau so hoch wie der Balken — er ist dessen Kante, keine Linie
            daneben. */}
        <span
          className="absolute inset-y-0 left-1/2"
          style={{
            borderLeft: `${stil.staerke} ${stil.stil} ${segmentFarbe(k.roh)}`,
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
function UnterLabel({ s, farbton, warnung = false }: {
  s: UnterEintrag; farbton: string;
  /** Endmarke statt Beschriftung — sie spricht über das Jetzt und warnt. */
  warnung?: boolean;
}): React.ReactElement {
  return (
    <span
      className={`absolute text-[11px] leading-4 whitespace-nowrap pointer-events-none ${
        warnung ? 'text-[var(--tf-danger-text)]' : 'text-[var(--tf-text-secondary)]'
      } ${s.rechtsBuendig ? 'pr-1' : 'pl-1'}`}
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

function Bahn({
  b, breite, labelBreite, eigenes, offen, onToggle, schrift, unterzeile, endMarke, schriftGen,
}: {
  b: BandSpur; breite: number; labelBreite: number; eigenes: string;
  offen: boolean; onToggle: () => void;
  /** Beschriftungsentscheidung je Segment, indexgleich zu `b.segmente`. */
  schrift: readonly SegmentBeschriftung[];
  /** Trägt diese Bahn eine zweite Etage? Dann wächst sie um deren Höhe. */
  unterzeile: boolean;
  /** Warnung am Achsenende („hängt fest"); `null` = keine. */
  endMarke: UnterEintrag | null;
  /** Signatur des Messcaches — siehe {@link VerlaufsBand}. */
  schriftGen: number;
}): React.ReactElement {
  const spur = b.spur;
  const lage = lageText(spur);
  const gruppe = b.gleiche.length > 0 ? ` +${b.gleiche.length}` : '';
  const kanten = useMemo(() => baueKanten(b.segmente, spur.uebergaenge), [b.segmente, spur.uebergaenge]);
  const kuerzel = useMemo(
    () => verteileKuerzel(kanten, {
      bahnBreite: breite,
      messeText: (t: string) => messeBreite(t, 'bandKuerzel'),
    }),
    // `schriftGen`: die Signatur des modulweiten Messcaches, kein Argument.
    [kanten, breite, schriftGen],
  );
  // Höhe JE BAHN, nicht global: ein Verbund mit acht Teilvorhaben soll nicht
  // überall Platz verschenken, weil eine einzige Bahn eine zweite Etage braucht.
  // Die Zusage „derselbe Tag, dieselbe x-Position" bricht davon nicht — die
  // Achse ist waagerecht geteilt, nicht senkrecht.
  const zusatz = unterzeile ? UNTER_H : 0;
  const obenH = kuerzel.length > 0 ? KUERZEL_H : 0;
  const letztes = b.segmente[b.segmente.length - 1];
  const abschluss = letztes === undefined || letztes.offenRechts
    ? null
    : segmentFarbe(letztes.segment.statusRef?.roh);
  return (
    <div className="flex items-start" style={{ height: SPUR_H + zusatz + obenH }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={offen}
        className={`shrink-0 text-left text-[11.5px] truncate pr-2 cursor-pointer ${
          offen ? 'text-[var(--tf-text)] font-medium' : 'text-[var(--tf-text-secondary)]'}`}
        // Die Beschriftung folgt dem BALKEN nach unten, nicht dem Kasten: sonst
        // stünde sie zwischen Kürzel-Etage und Bahn und gehörte sichtbar zu
        // keinem von beiden.
        style={{ width: labelBreite, lineHeight: `${KASTEN_H}px`, marginTop: obenH }}
        title={spurTitel(spur, eigenes) + (gruppe ? ` (und ${b.gleiche.length} weitere mit gleichem Verlauf)` : '')}
      >
        {spurTitel(spur, eigenes)}{gruppe}
      </button>
      <div className="relative" style={{ width: breite, height: obenH + KASTEN_H + zusatz }}>
        {/* Die Kürzel-Etage ganz oben, als eigene Schicht. Die Balkenschicht
            darunter behält dadurch ihr eigenes Koordinatensystem — jedes `top`
            in `Segment`, `Kante` und `UnterLabel` bleibt, wie es war. */}
        {kuerzel.map(m => (
          <span
            key={m.datum}
            className="absolute text-[10px] leading-none text-[var(--tf-text-tertiary)]
              whitespace-nowrap pointer-events-none text-center"
            style={{ left: m.links, width: m.breite, top: 3 }}
          >
            {m.text}
          </span>
        ))}
        <div className="absolute inset-x-0" style={{ top: obenH, height: KASTEN_H + zusatz }}>
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
                <Segment
                  key={`${s.segment.vonDatum}-${i}`} b={s} schrift={schrift[i] ?? LEER_LABEL}
                  erstes={i === 0} letztes={i === b.segmente.length - 1}
                />
              ))}
              {/* Abschlussstreifen am Achsenende: „bis hier gemessen". Er
                  entfällt bei offenem Ende — dort endet die Bahn im Nichts, und
                  ein Strich behauptete eine Grenze. */}
              {abschluss !== null && (
                <span
                  className="absolute pointer-events-none"
                  style={{
                    left: breite - 2, top: BALKEN_OBEN, width: 2, height: BALKEN_H,
                    background: abschluss, borderRadius: '0 3px 3px 0',
                  }}
                />
              )}
              {/* Die zweite Etage NACH den Balken, damit sie im Zweifel obenauf
                  liegt — sie läuft absichtlich unter fremde Balken hinweg. */}
              {schrift.map((s, i) => (s.unten === null
                ? null
                : (
                  <UnterLabel
                    key={`u-${i}`} s={s.unten}
                    farbton={segmentFarbe(b.segmente[i]?.segment.statusRef?.roh)}
                  />
                )))}
              {/* Je Tag eine Kante. Die Konfidenz gehört hierher, nicht auf die
                  Fläche daneben. */}
              {kanten.map(k => <Kante key={k.datum} k={k} />)}
            </>
          )}
          {/* Die Warnung steht am Achsenende, weil sie über das JETZT spricht —
              und außerhalb der Segment-Bedingung, weil ein Vorgang auch ohne
              zeichenbare Bahn festhängen kann. */}
          {endMarke !== null && (
            <UnterLabel s={endMarke} farbton={URTEIL_FARBE.haengt} warnung />
          )}
        </div>
      </div>
    </div>
  );
}

export function VerlaufsBand({
  spuren, eigenes, bezugsZeitpunkt, breite = 620,
  fassung = null, journalAb = null, journalGenutzt = false, haengtFest = null,
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
  /**
   * Die Bahn, die festhängt — vom Aufrufer benannt, nicht hier abgeleitet: der
   * Stillstands-Wächter urteilt über einen **Vorgang**, und nur der Aufrufer
   * weiß, welche Spur dieser Vorgang ist (bei einer verdichteten Verbundzeile
   * die Verbundbahn, sonst die des Teilvorhabens). Auf der Verbund-Detailseite
   * gibt es keinen Wächter — dort bleibt es bei `null`.
   */
  haengtFest?: { art: 'verbund' | 'tv'; id: string } | null;
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
      endMarke: (i: number) => {
        const s = geo.spuren[i]?.spur;
        return s !== undefined && haengtFest !== null
          && s.art === haengtFest.art && s.id === haengtFest.id
          ? URTEIL_LABEL.haengt
          : null;
      },
    }),
    // `schriftGen` ist kein Argument der Rechnung, sondern die Signatur des
    // modulweiten Messcaches: wechselt sie, ist jede vorherige Messung ungültig.
    [geo, nummern, schriftGen, haengtFest],
  );

  // Nummeriert wird genau dann, wenn ein Segment eine Nummer TRÄGT. Eine Nummer
  // ist eine Brücke; ohne Segment, das sie braucht, führt sie nirgendwohin und
  // wäre in der Legende nur Rauschen.
  const nummeriert = beschriftung.nummernGenutzt;
  const offeneSpur = geo.spuren.find(b => `${b.spur.art}-${b.spur.id}` === offen);

  return (
    // EIN Rahmen um Achse, Bahnen, Legende und Fuß (v3.38): bis dahin war nur
    // die Legende gerahmt, und das Bild darüber, das sie erklärt, stand nackt
    // daneben. Der Rahmen sagt, was zusammengehört.
    <div
      className="flex flex-col gap-2 rounded border p-2"
      style={{ borderColor: 'var(--tf-border)' }}
    >
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
          <div className="relative">
            {/* Das Jahresgitter — VOR den Bahnen gezeichnet, also darunter. Die
                Balken sind deckend; sichtbar bleibt es in den Zwischenräumen,
                und genau dort verankert es die Jahreszahlen, die bis v3.37 über
                dem Nichts schwebten. */}
            <div
              className="absolute inset-y-0 pointer-events-none"
              style={{ left: labelBreite, width: geo.breite }}
              aria-hidden="true"
            >
              {geo.marken.map(m => (
                <span
                  key={m.label}
                  className="absolute inset-y-0 w-px"
                  style={{ left: m.x, background: 'var(--tf-border)' }}
                />
              ))}
            </div>
            {geo.spuren.map((b, i) => {
              const key = `${b.spur.art}-${b.spur.id}`;
              return (
                <Bahn
                  key={key} b={b} breite={geo.breite} labelBreite={labelBreite} eigenes={eigenes}
                  schrift={beschriftung.segmente[i] ?? []}
                  unterzeile={beschriftung.unterzeile[i] ?? false}
                  endMarke={beschriftung.endMarken[i] ?? null}
                  schriftGen={schriftGen}
                  offen={offen === key}
                  onToggle={() => setOffen(offen === key ? null : key)}
                />
              );
            })}
          </div>
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
