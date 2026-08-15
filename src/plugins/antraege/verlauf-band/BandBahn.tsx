/**
 * **Eine Bahn** des VerlaufsBands — Verbund oder Teilvorhaben, drei Etagen
 * übereinander:
 *
 * 1. **Termin-Marken** über dem Balken: jedes gesetzte Kürzel in der Farbe der
 *    Rolle, die es setzt. Meilensteine in Medium.
 * 2. **Der Balken** mit den Statusabschnitten, ihren Grenzstrichen (Konfidenz)
 *    und dem Abschlussstreifen.
 * 3. **Die Etage darunter** mit dem, was der Balken nicht zeigen kann: fehlende
 *    Gegenstücke (rot), Termine ohne Phase, zu lange Abschnittsnamen, Dauern.
 *
 * Eigene Datei seit v4.50: `VerlaufsBand.tsx` lag bei 679 Zeilen und beantwortet
 * eine andere Frage — es rahmt, misst und ordnet die Bahnen, während hier eine
 * einzelne gezeichnet wird. Das Koordinatensystem der drei Etagen ist in
 * v3.37/v3.38 mühsam sortiert worden; es bleibt in einer Hand.
 *
 * **Die Rolle sitzt am Termin, nicht auf der Fläche.** Der Entwurf färbt den
 * Balken nach Rolle; am echten Bestand trägt das nicht (`chronik-und-zeitstrahl.md`):
 * PA ist Neutralgrau und wäre von „neutral" (144 der 505 Codes) nicht zu
 * unterscheiden, ein Kürzel trägt bis zu vier Rollen, und der Balken nennt seinen
 * Status bereits als Text in sich.
 */
import { useMemo } from 'react';
import { Tooltip } from '@/components/ui/Tooltip';
import { messeBreite } from '@/components/data-table/messung/textMessung';
import { formatDatumsWert } from '@/core/services/csv/dateParse';
import {
  ROLLE_LANG, rollenBilanz, rollenFarbe, rollenSicht, sichtFuerBahn, sortiereRollen,
  type Rolle,
} from '@/core/status';
import type { Konfidenz, VerlaufsSpur, VerlaufsUebergang } from '@/core/status/verlauf';
import { KONFIDENZ_TEXT, SpurListe, leise, spurTitel } from '../ausklapp/SpurListe';
import { URTEIL_FARBE } from '../waechterLabels';
import { RollenBilanz, RollenKuerzel } from '../status/VerlaufBadges';
import { dauerText, type BandSegment, type BandSpur, type ZeitAchse } from './bandGeometrie';
import type { SegmentBeschriftung, UnterEintrag } from './bandBeschriftung';
import { baueKanten, type BandKante } from './bandKanten';
import { tagesGruppen, verteileTermine } from './bandTermine';
import { segmentFarbe, segmentFuellung } from './bandFarbe';

/** Oberkante des Balkens in seiner Bahn. */
const BALKEN_OBEN = 4;
/**
 * Höhe des Balkens. Seit v4.48.1 **26** px — das Maß des Entwurfs
 * (`_design/handoff/chronik`, `.track`). Zwischenstufen: bis v3.36 16 px, danach
 * 20. Der Grund ist derselbe geblieben und war bei 20 px nicht erledigt: die
 * Beschriftung steht bei 11 px im Balken, und ein 20-px-Band mit 11-px-Schrift
 * darin liest sich als Strich mit Text darauf, nicht als Fläche. Die Zeilenhöhe
 * der Schrift folgt der Konstanten (siehe {@link Segment}) — sie darf nicht als
 * eigene Utility-Klasse danebenstehen und auseinanderlaufen.
 */
const BALKEN_H = 26;
/** Höhe des Balken-Kastens einer Bahn — Balken plus etwas Luft darunter. */
const KASTEN_H = BALKEN_OBEN + BALKEN_H + 4;
/** Höhe einer Bahn inklusive Abstand zur nächsten. */
export const SPUR_H = KASTEN_H + 6;
/** Zusatzhöhe einer Bahn, die eine zweite Beschriftungs-Etage trägt. */
const UNTER_H = 16;
/** Zusatzhöhe einer Bahn, die Termin-Marken ÜBER dem Balken trägt. */
const KUERZEL_H = 20;
/** Zusatzhöhe einer Bahn, die unter ihrem Titel die Rollenbilanz trägt. */
const BILANZ_H = 20;

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
        className={`block h-full overflow-hidden text-[11px] text-[var(--tf-text)] whitespace-nowrap${
          erstes && !b.offenLinks ? ' rounded-l-[3px]' : ''}${
          letztes && !b.offenRechts ? ' rounded-r-[3px]' : ''}${
          label === '' ? '' : ' px-1'}${
          // Der letzte Abschnitt IST der geltende Stand — das darf man sehen.
          letztes ? ' font-medium' : ''}`}
        style={{
          background: segmentFuellung(s.statusRef?.roh),
          // Aus der Konstanten, nicht als `leading-*`-Klasse: die Schrift sitzt
          // sonst beim nächsten Höhenwechsel wieder oben statt in der Mitte.
          lineHeight: `${BALKEN_H}px`,
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
 * Die Beschriftung, die nicht in ihren Balken passte — oder gar nicht zu einem
 * Balken gehört. Sie steht in der zweiten Etage und darf unter den Balken ihrer
 * Nachbarn hinweglaufen — die liegen höher, es wird nichts verdeckt.
 *
 * **Die Zuordnung ist das ganze Problem dieser Etage.** Ein Text, der links an
 * seinem schmalen Abschnitt beginnt und weit nach rechts reicht, liegt unter
 * FREMDEN Balken, und das Auge paart ihn mit dem, was direkt darüber steht
 * („warum steht unter *NF gestellt* der Text *keine weiteren NF*?"). Deshalb
 * beginnt der Strich bündig an der Unterkante des Balkens und trägt DESSEN
 * Farbe: er liest sich als Fortsetzung des eigenen Abschnitts nach unten, nicht
 * als Trennlinie irgendwo im Feld.
 */
function UnterLabel({ s, farbton, textFarbe, titel }: {
  s: UnterEintrag; farbton: string;
  /** Schriftfarbe; ohne Angabe die gedämpfte Textfarbe. */
  textFarbe?: string;
  titel?: string;
}): React.ReactElement {
  return (
    <span
      className={`absolute text-[11px] leading-4 whitespace-nowrap ${
        s.rechtsBuendig ? 'pr-1' : 'pl-1'}`}
      style={{
        left: s.x,
        // Bündig an der Balken-Unterkante — jeder Abstand macht aus dem Strich
        // eine freistehende Linie.
        top: BALKEN_OBEN + BALKEN_H,
        color: textFarbe ?? 'var(--tf-text-secondary)',
        // Nach innen gerückt zeigt der Strich nach rechts: links stünde er in
        // einem fremden Abschnitt.
        ...(s.rechtsBuendig
          ? { borderRight: `2px solid ${farbton}` }
          : { borderLeft: `2px solid ${farbton}` }),
      }}
      title={titel}
    >
      {s.text}
    </span>
  );
}

/** Die Rollen aller Übergänge eines Tages — für Tönung und Filterwirkung. */
function rollenVonGruppe(uebergaenge: readonly VerlaufsUebergang[]): Rolle[] {
  return sortiereRollen([...new Set(uebergaenge.flatMap(u => [...u.rollen]))]);
}

/**
 * Was der Titel einer Termin-Marke sagt — Kürzel, Klartext, Rolle, und **warum**
 * keine Rolle dasteht, wenn keine dasteht (Pitfall #43: „jeder darf setzen" und
 * „Kürzel nicht im Katalog" sind verschiedene Auskünfte).
 */
function terminZeilen(uebergaenge: readonly VerlaufsUebergang[]): string[] {
  return uebergaenge.map(u => {
    const rollen = u.rollen.length > 0
      ? sortiereRollen([...u.rollen]).map(r => ROLLE_LANG[r]).join(', ')
      : u.rollenLage === 'neutral' ? 'jeder darf setzen' : 'Kürzel nicht im Katalog';
    return `${u.kuerzel} · ${u.bezeichnung ?? 'ohne Bezeichnung'} · ${rollen}`;
  });
}

/** Derselbe Titel mit dem Datum davor — für die Marke, die auf dem Tag sitzt. */
function terminTitel(datum: string, uebergaenge: readonly VerlaufsUebergang[]): string {
  return [formatDatumsWert(datum), ...terminZeilen(uebergaenge)].join('\n');
}

export interface BahnProps {
  b: BandSpur;
  breite: number;
  labelBreite: number;
  eigenes: string;
  offen: boolean;
  onToggle: () => void;
  /** Die x-Skala — Termin-Marken sitzen an einem Tag, nicht an einem Segment. */
  achse: ZeitAchse;
  /** Trägt die Bahn ihre Termin-Etage? */
  kuerzelEbene: boolean;
  /** Beschriftungsentscheidung je Segment, indexgleich zu `b.segmente`. */
  schrift: readonly SegmentBeschriftung[];
  /** Einträge der Etage, die an keinem Segment hängen (Lücken, Termine). */
  frei: readonly UnterEintrag[];
  /** Trägt diese Bahn eine zweite Etage? Dann wächst sie um deren Höhe. */
  unterzeile: boolean;
  /** Warnung am Achsenende („hängt fest"); `null` = keine. */
  endMarke: UnterEintrag | null;
  /** Signatur des Messcaches — siehe `VerlaufsBand`. */
  schriftGen: number;
  /** Aktive Rollenwahl; blendet ab, nie weg. */
  rollenWahl?: ReadonlySet<Rolle>;
  /** Fokussierte Feld-Id. */
  fokus?: string | null;
  onFokus?: (feldId: string | null) => void;
  /** Zeigt die Bahn ihre Rollenbilanz unter dem Titel? */
  zeigeBilanz?: boolean;
}

export function Bahn({
  b, breite, labelBreite, eigenes, offen, onToggle, achse, schrift, frei, unterzeile,
  endMarke, schriftGen, kuerzelEbene, rollenWahl, fokus = null, onFokus, zeigeBilanz = false,
}: BahnProps): React.ReactElement {
  const spur = b.spur;
  const lage = lageText(spur);
  const gruppe = b.gleiche.length > 0 ? ` +${b.gleiche.length}` : '';
  const kanten = useMemo(() => baueKanten(b.segmente, spur.uebergaenge), [b.segmente, spur.uebergaenge]);
  const marken = useMemo(
    () => (kuerzelEbene
      ? verteileTermine(tagesGruppen(spur.uebergaenge), {
        achse,
        bahnBreite: breite,
        messeText: (t: string) => messeBreite(t, 'bandKuerzel'),
      })
      : []),
    // `schriftGen`: die Signatur des modulweiten Messcaches, kein Argument.
    [spur.uebergaenge, achse, breite, schriftGen, kuerzelEbene],
  );
  const bilanz = useMemo(() => rollenBilanz(spur.uebergaenge), [spur.uebergaenge]);
  // Höhe JE BAHN, nicht global: ein Verbund mit acht Teilvorhaben soll nicht
  // überall Platz verschenken, weil eine einzige Bahn eine zweite Etage braucht.
  // Die Zusage „derselbe Tag, dieselbe x-Position" bricht davon nicht — die
  // Achse ist waagerecht geteilt, nicht senkrecht.
  const zusatz = unterzeile ? UNTER_H : 0;
  const obenH = marken.length > 0 ? KUERZEL_H : 0;
  const bilanzH = zeigeBilanz ? BILANZ_H : 0;
  const letztes = b.segmente[b.segmente.length - 1];
  const abschluss = letztes === undefined || letztes.offenRechts
    ? null
    : segmentFarbe(letztes.segment.statusRef?.roh);
  return (
    <div className="flex items-start" style={{ height: SPUR_H + zusatz + obenH + bilanzH }}>
      <div className="shrink-0 flex flex-col items-end pr-2" style={{ width: labelBreite, marginTop: obenH }}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={offen}
          className={`max-w-full text-right text-[11.5px] truncate cursor-pointer ${
            offen ? 'text-[var(--tf-text)] font-medium' : 'text-[var(--tf-text-secondary)]'}`}
          // Die Beschriftung folgt dem BALKEN nach unten, nicht dem Kasten: sonst
          // stünde sie zwischen Termin-Etage und Bahn und gehörte sichtbar zu
          // keinem von beiden.
          style={{ lineHeight: `${KASTEN_H}px` }}
          title={spurTitel(spur, eigenes) + (gruppe ? ` (und ${b.gleiche.length} weitere mit gleichem Verlauf)` : '')}
        >
          {spurTitel(spur, eigenes)}{gruppe}
        </button>
        {/* Wer hat an dieser Bahn gearbeitet — die Leitfrage des Bildes, in
            einer Zeile. Sie steht UNTER dem Titel und damit auf Höhe der
            Klartext-Etage, deren Termine sie zusammenfasst. */}
        {zeigeBilanz && (
          <span style={{ height: BILANZ_H, lineHeight: `${BILANZ_H}px` }}>
            <RollenBilanz bilanz={bilanz} {...(rollenWahl ? { wahl: rollenWahl } : {})} />
          </span>
        )}
      </div>
      <div className="relative" style={{ width: breite, height: obenH + KASTEN_H + zusatz }}>
        {/* Die Termin-Etage ganz oben, als eigene Schicht. Die Balkenschicht
            darunter behält dadurch ihr eigenes Koordinatensystem — jedes `top`
            in `Segment`, `Kante` und `UnterLabel` bleibt, wie es war. */}
        {marken.map(m => {
          const rollen = rollenVonGruppe(m.uebergaenge);
          const gedimmt = rollenWahl !== undefined
            && sichtFuerBahn(rollenSicht(rollen, rollenWahl)) === 'gedimmt';
          const imFokus = fokus !== null && m.uebergaenge.some(u => u.feldId === fokus);
          const erstesFeld = m.uebergaenge[0]?.feldId;
          return (
            <button
              key={m.datum}
              type="button"
              className="absolute flex cursor-pointer rounded-[4px]"
              style={{
                left: m.links,
                width: m.breite,
                top: 2,
                ...(imFokus ? { outline: '1.5px solid var(--tf-primary)', outlineOffset: 1 } : {}),
              }}
              onClick={() => {
                if (onFokus === undefined || erstesFeld === undefined) return;
                onFokus(imFokus ? null : erstesFeld);
              }}
              title={terminTitel(m.datum, m.uebergaenge)}
            >
              <RollenKuerzel
                text={m.text}
                rolle={rollen[0] ?? null}
                meilenstein={m.uebergaenge.some(u => u.prominenz === 'meilenstein')}
                gedimmt={gedimmt}
              />
            </button>
          );
        })}
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
          {/* Was an keinem Segment hängt: die fehlenden Gegenstücke (rot) und
              die Termine ohne Phase. Beide sitzen an einem TAG. */}
          {frei.map((s, i) => {
            if (s.art === 'luecke') {
              return (
                <UnterLabel
                  key={`f-${i}`} s={s}
                  farbton="var(--tf-danger-text)" textFarbe="var(--tf-danger-text)"
                />
              );
            }
            const rollen = rollenVonGruppe(s.uebergaenge ?? []);
            const gedimmt = rollenWahl !== undefined
              && sichtFuerBahn(rollenSicht(rollen, rollenWahl)) === 'gedimmt';
            const farbe = gedimmt || rollen[0] === undefined
              ? { text: 'var(--tf-text-tertiary)' }
              : rollenFarbe(rollen[0]);
            return (
              <UnterLabel
                key={`f-${i}`} s={s} farbton={farbe.text} textFarbe={farbe.text}
                {...(s.uebergaenge ? { titel: terminZeilen(s.uebergaenge).join('\n') } : {})}
              />
            );
          })}
          {/* Die Warnung steht am Achsenende, weil sie über das JETZT spricht —
              und außerhalb der Segment-Bedingung, weil ein Vorgang auch ohne
              zeichenbare Bahn festhängen kann. */}
          {endMarke !== null && (
            <UnterLabel
              s={endMarke} farbton={URTEIL_FARBE.haengt} textFarbe="var(--tf-danger-text)"
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Die aufgeklappte Spur-Liste unter der Bahn — Aufklappstufe, nicht Ersatz. */
export function BahnAufklapp({ b, eigenes }: {
  b: BandSpur; eigenes: string;
}): React.ReactElement {
  return (
    <div className="rounded px-2.5 py-2" style={{ background: 'var(--tf-bg-secondary)' }}>
      <SpurListe spur={b.spur} eigenes={eigenes} />
      {b.gleiche.length > 0 && (
        <p className={`${leise} mt-1`}>
          Gleicher Verlauf: {b.gleiche.map(s => s.id).join(', ')}
        </p>
      )}
    </div>
  );
}
