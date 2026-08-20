/**
 * Das **VerlaufsBand**: Verbundspur oben, darunter je Teilvorhaben eine, alle
 * auf derselben Zeitachse.
 *
 * **React/CSS, kein SVG.** Die Segmente tragen Text, der kürzen und hovern
 * können muss; in einem `viewBox` skaliert Schrift mit der Grafik und wird
 * unlesbar.
 *
 * **Konfidenz sitzt an den KANTEN, nie am Statusfeld.** Der Status ist eine
 * beobachtete Tatsache — er steht so im Export. Unsicher ist die Zuschreibung:
 * ob ein Kürzel den Wechsel wirklich ausgelöst hat. Ein Segment einzufärben,
 * weil sein Übergang unsicher ist, verwechselte beides.
 *
 * **Die Kürzel stehen ÜBER der Bahn** — seit v3.38, und das widerruft eine
 * Entscheidung: bis dahin galt „keine Codes in der Bahn", weil `AK4` eine
 * Vokabel ist, die nur die Hälfte des Teams kennt. Dagegen steht, dass das
 * Kürzel der **Griff zum Gespräch mit C16** ist: wer nachfragt, nennt es. Seit
 * v4.50 steht dort **jeder** Termin, nicht nur die, die einen Statuswechsel
 * auslösen (gemessen 7,3 %) — was nicht ohne Überlappung passt, entfällt
 * (`bandTermine.ts`).
 *
 * Diese Datei **rahmt, misst und ordnet**; eine einzelne Bahn zeichnet
 * `BandBahn.tsx`. Gerechnet wird nebenan, alles rein und node-testbar:
 * `bandGeometrie.ts` platziert, `bandBeschriftung.ts` beschriftet,
 * `bandTermine.ts` setzt die Marken, `bandKanten.ts` bündelt die Übergänge je
 * Tag. `BandFuss.tsx` steht darunter.
 */
import { useEffect, useMemo, useState } from 'react';
// Direkt, nicht über das Barrel: `textMessung` hängt nur an `data-table/types`,
// der Umweg zöge die halbe Tabellen-Schicht in dieses Bauteil.
import {
  aktuelleSchriftGeneration, messeBreite, warteAufSchriften,
} from '@/components/data-table/messung/textMessung';
import { useElementBreite } from '@/core/hooks/useElementBreite';
import { rollenBilanz, type Rolle } from '@/core/status';
import type { VerlaufsSpur } from '@/core/status/verlauf';
import { leise, spurTitel } from '../ausklapp/SpurListe';
import { URTEIL_LABEL } from '../waechterLabels';
import { baueBandGeometrie, buendle, type ZeitAchse } from './bandGeometrie';
import { verteileBeschriftung, type BandLuecke } from './bandBeschriftung';
import { Bahn, BahnAufklapp, SPUR_H } from './BandBahn';
import { BandFuss, BandLegende, type LegendenEintrag } from './BandFuss';

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

export function VerlaufsBand({
  spuren, eigenes, bezugsZeitpunkt, breite = 620,
  fassung = null, journalAb = null, journalGenutzt = false, journalGrund, haengtFest = null,
  kuerzelEbene = true, randRechts = RAND_LUFT, zusatzBahn = null,
  rollenWahl, bereichWahl, fokus = null, onFokus, luecken = null, zeigeBilanz = false,
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
  /** Warum nicht — siehe `HerkunftsAngabe.journalGrund`. */
  journalGrund?: 'mehrereTv' | 'ganzesVorhaben' | 'ohneChronik';
  /**
   * Die Bahn, die festhängt — vom Aufrufer benannt, nicht hier abgeleitet: der
   * Stillstands-Wächter urteilt über einen **Vorgang**, und nur der Aufrufer
   * weiß, welche Spur dieser Vorgang ist (bei einer verdichteten Verbundzeile
   * die Verbundbahn, sonst die des Teilvorhabens). Auf der Verbund-Detailseite
   * gibt es keinen Wächter — dort bleibt es bei `null`.
   */
  haengtFest?: { art: 'verbund' | 'tv'; id: string } | null;
  /**
   * Trägt jede Bahn ihre Termin-Etage? Default an — die Verbund-Detailseite und
   * jeder Bestandsaufrufer bleiben dadurch unverändert.
   */
  kuerzelEbene?: boolean;
  /**
   * Reserve rechts neben der Bahn in px. Eine zusätzliche Schicht kann rechts
   * hinausragen (die Verzugslabels der Meilenstein-Ebene); ohne Reserve
   * schnitte der Scroll-Container sie ab.
   */
  randRechts?: number;
  /**
   * Eine weitere Schicht auf **derselben** Achse — als eigene Zeile unter den
   * Bahnen, mit derselben Beschriftungsspalte links.
   *
   * Bewusst ein Slot und kein Eingriff in `Bahn`: das Koordinatensystem der
   * Balken, Kanten und Unter-Label ist in v3.37/v3.38 mühsam sortiert worden
   * und bleibt unangetastet. Die Schicht bekommt die x-Skala und die Breite und
   * zeichnet selbst.
   */
  zusatzBahn?: {
    label: string;
    render: (o: { achse: ZeitAchse; breite: number }) => React.ReactNode;
  } | null;
  /**
   * Der geteilte Verlaufs-Filter, sofern der Wirt einen führt. Ohne diese vier
   * Angaben zeichnet die Bahn wie bisher — der Tabellen-Ausklapp hat keine
   * Filterleiste und soll auch keine bekommen.
   *
   * **Wer blendet ab, Wo blendet aus.** Eine Rolle abzuwählen darf die Bahn
   * nicht zerreißen (`sichtFuerBahn`); eine Bahn abzuwählen heißt dagegen, dass
   * genau diese Zeile nicht gemeint ist — sie zu dimmen böte dieselbe Zeile
   * achtmal an. Die **Achse bleibt in beiden Fällen dieselbe**
   * (`bandGeometrie.ts`), sonst zeigte „nur TV 3" einen anderen Maßstab.
   */
  rollenWahl?: ReadonlySet<Rolle>;
  bereichWahl?: ReadonlySet<string>;
  fokus?: string | null;
  onFokus?: (feldId: string | null) => void;
  /**
   * Die fehlenden Gegenstücke je Teilvorhaben (`aktenzeichen` → Lücken). Sie
   * hängen am Teilvorhaben, nicht an der Spur — welche zu welcher Bahn gehören,
   * weiß nur der Aufrufer.
   */
  luecken?: ReadonlyMap<string, readonly BandLuecke[]> | null;
  /**
   * Trägt jede Bahn ihre Rollenbilanz unter dem Titel? Default aus — im
   * Tabellen-Ausklapp ist die Beschriftungsspalte der knappste Platz des
   * Bildes, und fünf Marken darin nähmen sie der Bahn.
   */
  zeigeBilanz?: boolean;
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

  // Welche Bahnen gezeichnet werden. `undefined` = alle; eine leere Wahl heißt
  // in der Filterleiste ebenfalls „alle" (`trifftBereich`), nicht „keine".
  const nurBahnen = useMemo(() => {
    if (bereichWahl === undefined || bereichWahl.size === 0) return undefined;
    const out = new Set<string>();
    for (const s of spuren) {
      const id = s.art === 'verbund' ? 'verbund' : s.id;
      if (bereichWahl.has(id)) out.add(`${s.art}-${s.id}`);
    }
    return out;
  }, [spuren, bereichWahl]);

  // Die Spur-Beschriftung bekommt die Breite, die ihr längster Titel braucht.
  // Sie hing bis v3.35 an einer festen Zahl, und `16KN073848 (diese Zeile)`
  // brauchte 137 px — abgeschnitten wurde ausgerechnet der Zusatz, der die
  // eigene Zeile benennt. Gemessen wird über `buendle`, also über GENAU die
  // Titel, die die Geometrie später zeichnet (die Bündelung hängt nicht an der
  // Breite, es entsteht kein Ringschluss). Seit v4.50 misst sie auch die
  // Rollenbilanz mit — sie steht unter dem Titel in derselben Spalte.
  const labelBreite = useMemo(() => {
    let max = 0;
    for (const b of buendle(spuren)) {
      const gruppe = b.gleiche.length > 0 ? ` +${b.gleiche.length}` : '';
      max = Math.max(max, messeBreite(spurTitel(b.spur, eigenes) + gruppe, 'bandSpur'));
      if (!zeigeBilanz) continue;
      const bilanz = rollenBilanz(b.spur.uebergaenge);
      // Je Marke: Kürzel + Zahl + Polster (2 × 3 px) + Lücke (3 px).
      const breiteBilanz = (Object.values(bilanz) as number[])
        .filter(n => n > 0)
        .reduce((s, n) => s + messeBreite(`XX ${n}`, 'bandSpur') + 9, 0);
      max = Math.max(max, breiteBilanz);
    }
    return Math.min(LABEL_MAX, Math.max(LABEL_MIN, Math.ceil(max) + LABEL_POLSTER));
    // `schriftGen`: siehe unten — die Signatur des modulweiten Messcaches.
  }, [spuren, eigenes, schriftGen, zeigeBilanz]);

  // `gemessen === null`: erster Rahmen, verborgene Pane oder kein
  // `ResizeObserver` — dann gilt der Prop. Die Spur-Beschriftung links geht vom
  // gemessenen Platz ab, sie steht neben der Bahn, nicht darin.
  const vorgabe = Math.max(
    MIN_BAHN,
    gemessen === null ? breite : gemessen - labelBreite - randRechts,
  );
  const geo = useMemo(
    () => baueBandGeometrie(spuren, bezugsZeitpunkt, vorgabe, { ...(nurBahnen ? { nurBahnen } : {}) }),
    [spuren, bezugsZeitpunkt, vorgabe, nurBahnen],
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
      achse: geo.achse,
      messeText: (t: string) => messeBreite(t, 'bandLabel'),
      nummerVon: (k: string) => nummern.get(k),
      fokus,
      // Die Lücken der Bahn — bei gebündelten Spuren die ALLER vertretenen
      // Teilvorhaben: eine Aufgabe zu verschweigen, weil ihr Teilvorhaben
      // gerade von einem anderen mitvertreten wird, wäre der schlechteste
      // Grund, sie nicht zu zeigen.
      luecken: (i: number) => {
        const b = geo.spuren[i];
        if (b === undefined || luecken === null) return [];
        return [b.spur, ...b.gleiche]
          .filter(s => s.art === 'tv')
          .flatMap(s => luecken.get(s.id) ?? []);
      },
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
    [geo, nummern, schriftGen, haengtFest, luecken, fokus],
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
        <div style={{ width: labelBreite + geo.breite + randRechts }}>
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
                  achse={geo.achse}
                  schrift={beschriftung.segmente[i] ?? []}
                  frei={beschriftung.frei[i] ?? []}
                  unterzeile={beschriftung.unterzeile[i] ?? false}
                  endMarke={beschriftung.endMarken[i] ?? null}
                  schriftGen={schriftGen}
                  kuerzelEbene={kuerzelEbene}
                  zeigeBilanz={zeigeBilanz}
                  {...(rollenWahl ? { rollenWahl } : {})}
                  fokus={fokus}
                  {...(onFokus ? { onFokus } : {})}
                  offen={offen === key}
                  onToggle={() => setOffen(offen === key ? null : key)}
                />
              );
            })}
            {/* Keine Bahn übrig: die Wahl steht, nur trifft sie nichts. Ein
                leerer Kasten sagte das nicht. */}
            {geo.spuren.length === 0 && (
              <p className={`${leise} italic`} style={{ height: SPUR_H, lineHeight: `${SPUR_H}px` }}>
                Keine Bahn in dieser Auswahl.
              </p>
            )}
            {/* Die Zusatzschicht als eigene Zeile: gleiche Achse, gleiche
                Beschriftungsspalte — aber eigenes Koordinatensystem. */}
            {zusatzBahn !== null && (
              // Ohne feste Höhe: was die Schicht braucht, weiß erst sie selbst —
              // ihre Bahnzahl steht erst mit der Achse fest, und die gibt es
              // nicht, bevor die Geometrie gerechnet ist.
              <div className="flex items-start pt-1">
                <span
                  className="shrink-0 text-left text-[11.5px] truncate pr-2 text-[var(--tf-text-secondary)]"
                  style={{ width: labelBreite, lineHeight: '16px' }}
                >
                  {zusatzBahn.label}
                </span>
                <div style={{ width: geo.breite }}>
                  {zusatzBahn.render({ achse: geo.achse, breite: geo.breite })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Erst die Legende — sie erklärt das Bild darüber und gehört an dessen
          Kante. Die Herkunft ist eine Fußnote und steht darunter. */}
      <BandLegende eintraege={legende} nummeriert={nummeriert} />

      <BandFuss
        spuren={spuren} eigenes={eigenes}
        angabe={{ bezugsZeitpunkt, fassung, journalAb, journalGenutzt, ...(journalGrund ? { journalGrund } : {}) }}
      />

      {/* Höchstens eine Spur offen — die schlichte Liste aus Phase 2 als
          Aufklappstufe, nicht als Ersatz. */}
      {offeneSpur !== undefined && <BahnAufklapp b={offeneSpur} eigenes={eigenes} />}
    </div>
  );
}
