/**
 * **Was an einem Segment des VerlaufsBands steht** — und wo.
 *
 * Schwester von `bandGeometrie.ts`, nicht Teil davon. Die Geometrie beantwortet
 * „wo sitzt ein Tag" und ist im ersten Rahmen fertig; diese Datei beantwortet
 * „was steht dran" und braucht dafür ein Textmaß, das frühestens vorliegt, wenn
 * die Webschriften stehen. Zwei Fragen, zwei Rechnungen, zwei Memo-Signaturen.
 *
 * **Das Problem.** Die Achse gibt jedem Intervall einen Boden (`bodenFuer`); ein
 * Ein-Tages-Abschnitt sitzt darauf. Seit v3.38 wächst der Boden mit der Bahn und
 * trägt damit in mittleren Lagen wieder eine Kurzform — aber gedeckelt ist er
 * auch: bei sechsundzwanzig Grenzen fällt er auf `MIN_INTERVALL` zurück, und
 * dann macht Breite allein solche Segmente nie beschriftbar. Wer nur im Balken
 * beschriftet, schickt den Leser für genau die Abschnitte in die Legende, die er
 * nachschlagen will.
 *
 * **Die Lösung ist eine zweite Etage.** Passt der Text nicht IN den Balken,
 * steht er DARUNTER, ab dem linken Rand des Abschnitts. Dort darf er unter den
 * Balken seiner breiten Nachbarn hinweglaufen, ohne etwas zu verdecken — die
 * liegen eine Etage höher. Nur Unter-Beschriftungen untereinander konkurrieren,
 * und die prüfen wir.
 *
 * **In derselben Etage stehen Dauer und Warnung** (v3.38). Passt der Name in den
 * Balken, ist die Etage darunter frei und nimmt die Dauer; passt er nicht, hängt
 * sie an ihn an („beantragt · 28 T"). Dazu kommt am Achsenende die **Endmarke**
 * („hängt fest").
 *
 * **Seit v4.50 trägt sie außerdem, was der Balken gar nicht zeigen kann**: die
 * Termine, die keinen Statuswechsel auslösen (92,7 % im Bestand), und die
 * fehlenden Gegenstücke in Rot.
 *
 * Vergeben wird in **Durchgängen, und die Reihenfolge ist die Rangfolge**:
 *
 * | Rang | Was | warum dort |
 * |---|---|---|
 * | 0 | Endmarke („hängt fest") | der Grund, warum jemand hinsieht |
 * | 1 | Lücke („… fehlt", rot) | eine Aufgabe, kein Befund |
 * | 2 | fokussierter Termin | genau der, nach dem gefragt wurde |
 * | 3 | übrige Termine ohne Phase | steht **nirgends sonst** im Bild |
 * | 4 | Segmentnamen, die nicht in den Balken passten | stehen auch im Tooltip und in der Legende |
 * | 5 | Dauern | die Zugabe |
 *
 * Dass die Termine **vor** den Segmentnamen kommen, kostet sichtbar: im Bestand
 * verlieren dadurch Abschnitte ihre Unterzeile. Der Tausch ist trotzdem richtig —
 * der Name eines Abschnitts steht im Balken, im Tooltip und in der Legende, der
 * Klartext eines Termins nirgends.
 *
 * **Gemessen, nicht geraten.** Die Textbreite kommt als Funktion herein
 * ({@link BeschriftungsOptionen.messeText}); die Datei bleibt rein und
 * node-testbar. `null` heißt „keine Messung möglich" und fällt exakt auf das
 * Schwellen-Verhalten bis v3.31 zurück — nie unter den heutigen Stand.
 *
 * **Keine eigene Kürzung.** `lang` und `kurz` werden genommen, wie `statusRef`
 * sie liefert (Pitfall #50: die Kurzform hat GENAU EINE Quelle). Passt keins von
 * beidem, tritt die Legendennummer an ihre Stelle — nie ein selbst
 * abgeschnittener Text.
 */
import type { VerlaufsUebergang } from '@/core/status/verlauf';
import {
  dauerText, imFenster, xFuerTag,
  type BandSegment, type BandSpur, type ZeitAchse,
} from './bandGeometrie';
import { tagesGruppen } from './bandTermine';

/** Waagerechtes Polster im Balken (`px-1` links + rechts). */
const POLSTER_BALKEN = 8;
/** Führungsstrich plus Abstand vor einer Unter-Beschriftung. */
const POLSTER_UNTER = 3;
/**
 * Zuschlag gegen die Untertreibung des Messmodells. `measureText` liefert die
 * Glyphenbreite; Rundung und Sub-Pixel-Anstrich kosten im Bestand bis zu ~1 px
 * (im Kopf-Profil der Tabelle nachgemessen). Ohne den Zuschlag liefe ein
 * gerade-so-passender Text über seinen Balken hinaus.
 */
const SICHERHEIT = 2;
/**
 * Platz für das Bruchzeichen `⁄⁄`, das ein gestauchtes Segment mittig im Balken
 * trägt. Ein ganzes Wort liefe hindurch — deshalb wird der Platz beim TEXT
 * reserviert. Bei der Legendennummer nicht: sie steht am linken Rand, und ihr
 * den Platz abzuziehen nähme einem schmalen gestauchten Abschnitt die letzte
 * Auskunft, die er heute schon trägt.
 */
const BRUCH_BREITE = 12;
/** Mindestlücke zwischen zwei Unter-Beschriftungen. */
const UNTER_ABSTAND = 6;
/**
 * Rückfall-Schwellen ohne Messung — die Konstanten bis v3.31. `LABEL_AB` war
 * gegen `text-[10px] px-1` geraten; sie gilt nur noch, wenn gar nicht gemessen
 * werden kann.
 */
const LABEL_AB_RUECKFALL = 46;
const NUMMER_AB_RUECKFALL = 16;

/** Was im BALKEN steht. Die zweite Etage hängt daneben ({@link UnterEintrag}). */
export type LabelLage = 'im-balken' | 'nummer' | 'keine';

/**
 * Woher ein Eintrag der Etage stammt — die Anzeige liest daraus seine Farbe.
 * Ein `art`-Feld statt fünf paralleler Listen: die Etage ist EINE Fläche, und
 * ihre Kollisionsprüfung darf nicht davon abhängen, wer gerade zeichnet.
 */
export type UnterArt = 'warnung' | 'luecke' | 'termin' | 'name' | 'dauer';

/** Ein Eintrag der zweiten Etage — unter dem Balken. */
export interface UnterEintrag {
  text: string;
  /** px ab dem linken Bahnrand. */
  x: number;
  /** Belegte Breite — macht die Kollision testbar. */
  breite: number;
  /**
   * Der Eintrag musste nach links rücken, um ins Bild zu passen. Sein
   * Führungsstrich gehört dann an die RECHTE Seite — links zeigte er in einen
   * fremden Abschnitt.
   */
  rechtsBuendig: boolean;
  art: UnterArt;
  /**
   * Nur bei `art: 'termin'`: die Übergänge, aus denen der Text entstand — die
   * Anzeige liest daraus Rollenfarbe, Titel und Filterwirkung. Diese Datei
   * urteilt allein über Platz.
   */
  uebergaenge?: readonly VerlaufsUebergang[];
}

/** Ein fehlendes Gegenstück, das die Bahn ausweisen soll. */
export interface BandLuecke {
  /** ISO-Tag, seit dem die eine Seite gesetzt ist — die Stelle auf der Achse. */
  seit: string;
  /** „Brief NF (TB) fehlt". */
  text: string;
}

export interface SegmentBeschriftung {
  lage: LabelLage;
  /** Der Text IM Balken; `''` bei `'keine'`, die Ziffer bei `'nummer'`. */
  text: string;
  /**
   * Die zweite Etage: der Name, der nicht in den Balken passte — oder, wenn er
   * passte, die **Dauer** des Abschnitts. `null` = für dieses Segment bleibt sie
   * leer.
   *
   * Bis v3.37 war das eine dritte {@link LabelLage}. Seit die Dauer dazukommt,
   * kann ein Segment beides tragen (Name im Balken, Dauer darunter) — ein
   * einzelnes `lage`-Feld könnte das nicht ausdrücken, und zwei Wege zum selben
   * Ziel wären zwei Wahrheiten.
   */
  unten: UnterEintrag | null;
}

export interface BandBeschriftung {
  /** `[spurIndex][segmentIndex]`, deckungsgleich mit `geo.spuren[i].segmente`. */
  segmente: SegmentBeschriftung[][];
  /**
   * Je Bahn die **Endmarke** am Achsenende, oder `null` — heute die Warnung
   * „hängt fest". Sie steht in derselben Etage wie Namen und Dauern und wird
   * vor beiden gesetzt.
   */
  endMarken: (UnterEintrag | null)[];
  /**
   * Je Bahn die Einträge, die **an keinem Segment hängen**: Lücken und Termine
   * ohne Phase. Sie sitzen an einem Tag, nicht an einem Abschnitt — eine eigene
   * Liste, statt sie einem Segment unterzuschieben, dem sie nicht gehören.
   */
  frei: UnterEintrag[][];
  /** Je Bahn: trägt sie mindestens eine Unter-Beschriftung? Steuert ihre Höhe. */
  unterzeile: boolean[];
  /**
   * Wurde mindestens eine Legendennummer vergeben? Nur dann nummeriert die
   * Legende. Eine Nummer ist eine Brücke — ohne Segment, das sie braucht, führt
   * sie nirgendwohin.
   */
  nummernGenutzt: boolean;
}

export interface BeschriftungsOptionen {
  /** Breite der Bahn (ohne die Spur-Beschriftung links). */
  bahnBreite: number;
  /**
   * Die x-Skala der Bahn — Termine und Lücken sitzen an einem **Tag**, nicht an
   * einem Segment, und müssen dieselbe Rechnung nutzen wie die Balken.
   */
  achse: ZeitAchse;
  /** Breite eines Textes in px. `null` = keine Messung → Schwellen-Rückfall. */
  messeText: ((text: string) => number) | null;
  /** Kurzform → Legendennummer; `undefined`, wo keine vergeben ist. */
  nummerVon: (kurz: string) => number | undefined;
  /**
   * Die fehlenden Gegenstücke dieser Bahn. Welche das sind, weiß der Aufrufer
   * (sie hängen am Teilvorhaben, nicht an der Spur) — dieselbe Arbeitsteilung
   * wie bei {@link BeschriftungsOptionen.endMarke}.
   */
  luecken?: (bahnIndex: number) => readonly BandLuecke[];
  /**
   * Fokussierte Feld-Id. Ihr Termin wird **vor** allen anderen gesetzt: der eine,
   * nach dem gefragt wurde, darf nicht der sein, der aus Platzmangel entfällt.
   */
  fokus?: string | null;
  /**
   * Text der **Endmarke** einer Bahn (heute „hängt fest"); `null` = keine.
   *
   * WELCHE Bahn eine bekommt, entscheidet der Aufrufer — der Stillstands-Wächter
   * urteilt über einen **Vorgang**, nicht über eine Spur, und nur der Aufrufer
   * weiß, welche Bahn dieser Vorgang ist. Diese Datei bleibt domänenfrei: sie
   * bekommt einen Text und sucht ihm einen Platz.
   */
  endMarke?: (bahnIndex: number) => string | null;
}

const LEER: SegmentBeschriftung = { lage: 'keine', text: '', unten: null };

/**
 * Die Dauer eines Abschnitts als Beschriftung — `null`, wo sie nichts aussagt.
 *
 * `dauerUnsicher` heißt `dauerTage === null || dauerTage <= 1` und fasst vier
 * verschiedene Lagen zusammen (`erhebung.ts`), darunter die **offene Grenze**.
 * Ein „1 T" darunter wäre eine Behauptung über etwas, das niemand weiß. Der
 * Tooltip sagt an dieser Stelle weiter „(unsicher)" — die Auskunft geht also
 * nicht verloren, sie steht nur nicht als Zahl in der Bahn.
 *
 * Der Wortlaut kommt aus {@link dauerText}, damit Bahn und Tooltip dieselbe
 * Einheit runden.
 */
function dauerLabel(b: BandSegment): string | null {
  const s = b.segment;
  return s.dauerUnsicher || s.dauerTage === null ? null : dauerText(s.dauerTage);
}

function imBalken(text: string): SegmentBeschriftung {
  return { lage: 'im-balken', text, unten: null };
}

/**
 * Die belegten Strecken der zweiten Etage. Bis v3.37 genügte ein einzelner
 * Endwert, weil nur Namen dort landeten und streng von links nach rechts
 * vergeben wurden. Mit den Dauern gibt es **zwei** Durchgänge (siehe
 * {@link beschrifteBahn}), und der zweite füllt Lücken, die der erste gelassen
 * hat — dafür braucht es die Strecken, nicht nur ihr Ende.
 */
class Etage {
  private readonly belegt: { von: number; bis: number }[] = [];

  frei(x: number, w: number): boolean {
    return !this.belegt.some(s => x < s.bis + UNTER_ABSTAND && s.von < x + w + UNTER_ABSTAND);
  }

  belege(x: number, w: number): void {
    this.belegt.push({ von: x, bis: x + w });
  }

  get benutzt(): boolean {
    return this.belegt.length > 0;
  }
}

/**
 * Setzt einen Text in die zweite Etage — oder gibt `null` zurück, wenn er nicht
 * hinpasst.
 *
 * `rechtsRuecken` erlaubt das Ausweichen an den rechten Bahnrand. Es hilft nur
 * gegen den RAND, nicht gegen eine Kollision: wer wegen des Nachbarn ausweicht,
 * landete weit rechts von seinem eigenen Abschnitt, und der Führungsstrich
 * zeigte ins Leere. Nur das LETZTE Segment darf es — es ist der aktuelle Stand.
 */
function setzeUnten(
  etage: Etage, x: number, text: string, o: { messe: (t: string) => number; bahnBreite: number },
  rechtsRuecken: boolean, art: UnterArt = 'name',
): UnterEintrag | null {
  const w = o.messe(text) + POLSTER_UNTER + SICHERHEIT;
  const passtLinks = x + w <= o.bahnBreite;
  if (passtLinks && etage.frei(x, w)) {
    etage.belege(x, w);
    return { text, x, breite: w, rechtsBuendig: false, art };
  }
  const rechts = o.bahnBreite - w;
  if (!passtLinks && rechtsRuecken && rechts >= 0 && etage.frei(rechts, w)) {
    etage.belege(rechts, w);
    return { text, x: rechts, breite: w, rechtsBuendig: true, art };
  }
  return null;
}

/**
 * Ein Termin, der **keinen** Statuswechsel auslöst — der Fall, für den es diese
 * Etage seit v4.50 gibt. Was einen Wechsel auslöst, steht als Balken da; was
 * nicht, stünde ohne sie nirgends.
 *
 * Mehrere am selben Tag werden zu **einem** Eintrag verbunden („Import ZIM-Foyer
 * · in C16 eingestellt"): sie sitzen an derselben x-Position und verdeckten
 * einander sonst.
 */
interface TerminZeile {
  tag: string;
  /** Volltext, alle Bezeichnungen des Tages. */
  voll: string;
  /** Kurzfassung: die erste Bezeichnung, dahinter `+n`. */
  knapp: string;
  uebergaenge: readonly VerlaufsUebergang[];
}

/**
 * Die Termine ohne Phase einer Bahn, in Tagesfolge.
 *
 * Der Klartext kommt aus dem Katalog (`bezeichnung`); kennt der ihn nicht, steht
 * das Kürzel selbst da — nie eine erfundene Bezeichnung und nie Schweigen.
 */
function terminZeilen(bahn: BandSpur): TerminZeile[] {
  const out: TerminZeile[] = [];
  for (const g of tagesGruppen(bahn.spur.uebergaenge)) {
    const ohnePhase = g.uebergaenge.filter(u => u.setztStatus === undefined);
    if (ohnePhase.length === 0) continue;
    const texte = ohnePhase.map(u => u.bezeichnung ?? u.kuerzel);
    const erste = texte[0] ?? '';
    out.push({
      tag: g.tag,
      voll: texte.join(' · '),
      knapp: texte.length > 1 ? `${erste} +${texte.length - 1}` : erste,
      uebergaenge: ohnePhase,
    });
  }
  return out.sort((a, b) => a.tag.localeCompare(b.tag));
}

/**
 * Verteilt die Beschriftungen einer ganzen Bahn. Von links nach rechts, also
 * chronologisch: bei knappem Platz gewinnt der frühere Abschnitt die Unterzeile.
 * Eine Reihenfolge nach Wichtigkeit gäbe es nicht — alle Abschnitte sind gleich
 * wahr, nur der letzte ist als aktueller Stand hervorgehoben (siehe oben).
 *
 * **Die Durchgänge sind die Rangfolge** (Tabelle im Modulkopf). Andersherum
 * könnte eine Dauer bei x = 0 einen Namen bei x = 40 verdrängen — ein Name ist
 * aber die Auskunft, nach der jemand sucht, eine Dauer die Zugabe.
 */
function beschrifteBahn(
  bahn: BandSpur, o: BeschriftungsOptionen,
  markeText: string | null, luecken: readonly BandLuecke[],
): {
  segmente: SegmentBeschriftung[]; endMarke: UnterEintrag | null;
  frei: UnterEintrag[]; unterzeile: boolean;
} {
  const etage = new Etage();
  const frei: UnterEintrag[] = [];
  const letzterIndex = bahn.segmente.length - 1;

  const nummerOderNichts = (b: BandSegment): SegmentBeschriftung => {
    const ref = b.segment.statusRef;
    const nummer = ref ? o.nummerVon(ref.kurz) : undefined;
    if (nummer === undefined) return LEER;
    const passt = o.messeText === null
      ? b.breite >= NUMMER_AB_RUECKFALL
      : o.messeText(String(nummer)) <= b.breite - POLSTER_BALKEN - SICHERHEIT;
    return passt ? { lage: 'nummer', text: String(nummer), unten: null } : LEER;
  };

  if (o.messeText === null) {
    // Kein Textmaß: genau das Verhalten bis v3.31 — Kurzform ab der geratenen
    // Schwelle, sonst die Nummer. Keine Unterzeile, denn ohne Maß ließe sich
    // ihre Kollision nicht prüfen; und ohne Unterzeile auch keine Dauer.
    return {
      segmente: bahn.segmente.map(b => (b.breite >= LABEL_AB_RUECKFALL
        ? imBalken(b.segment.statusRef?.kurz ?? '—')
        : nummerOderNichts(b))),
      endMarke: null,
      frei: [],
      unterzeile: false,
    };
  }
  const messe = o.messeText;
  const setz = { messe, bahnBreite: o.bahnBreite };

  // --- Durchgang 0: die Endmarke ----------------------------------------
  // Sie steht am ACHSENENDE, weil sie über das Jetzt spricht — dort endet die
  // Achse. Und sie wird ZUERST gesetzt: eine Warnung weicht keinem Namen und
  // keiner Dauer, sondern umgekehrt.
  let endMarke: UnterEintrag | null = null;
  if (markeText !== null) {
    const w = messe(markeText) + POLSTER_UNTER + SICHERHEIT;
    const x = o.bahnBreite - w;
    if (x >= 0) {
      etage.belege(x, w);
      endMarke = { text: markeText, x, breite: w, rechtsBuendig: true, art: 'warnung' };
    }
  }

  // --- Durchgang 1: die Lücken ------------------------------------------
  // Eine Aufgabe, kein Befund — sie weicht nur der Warnung. Mehrere am selben
  // Tag werden verbunden: sie sitzen an derselben Stelle und verdeckten
  // einander sonst.
  const jeTag = new Map<string, string[]>();
  for (const l of luecken) {
    if (!imFenster(o.achse, l.seit)) continue;
    const g = jeTag.get(l.seit);
    if (g) g.push(l.text); else jeTag.set(l.seit, [l.text]);
  }
  for (const [tag, texte] of [...jeTag.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const x = xFuerTag(o.achse, tag);
    const eintrag = setzeUnten(etage, x, texte.join(' · '), setz, false, 'luecke')
      ?? setzeUnten(etage, x, `${texte.length} Kürzel fehlen`, setz, false, 'luecke');
    if (eintrag !== null) frei.push(eintrag);
  }

  // --- Durchgang 2 + 3: die Termine ohne Phase ---------------------------
  // Der fokussierte zuerst: er ist der eine, nach dem gefragt wurde, und darf
  // nicht der sein, der aus Platzmangel entfällt.
  const termine = terminZeilen(bahn).filter(t => imFenster(o.achse, t.tag));
  const istFokus = (t: TerminZeile): boolean =>
    o.fokus != null && t.uebergaenge.some(u => u.feldId === o.fokus);
  for (const t of [...termine.filter(istFokus), ...termine.filter(z => !istFokus(z))]) {
    const x = xFuerTag(o.achse, t.tag);
    const eintrag = setzeUnten(etage, x, t.voll, setz, false, 'termin')
      ?? setzeUnten(etage, x, t.knapp, setz, false, 'termin');
    if (eintrag !== null) frei.push({ ...eintrag, uebergaenge: t.uebergaenge });
  }

  // --- Durchgang 4: die Namen -------------------------------------------
  const out: SegmentBeschriftung[] = bahn.segmente.map((b, i) => {
    const ref = b.segment.statusRef;
    // Ohne Statusbezug bleibt „—" — dieselbe Auskunft wie bis v3.31: es gibt
    // einen Abschnitt, aber keinen Namen dafür.
    const lang = ref?.lang ?? '—';
    const kurz = ref?.kurz ?? '—';
    const platzText = b.breite - POLSTER_BALKEN - SICHERHEIT
      - (b.gestaucht ? BRUCH_BREITE : 0);

    if (messe(lang) <= platzText) return imBalken(lang);
    if (messe(kurz) <= platzText) return imBalken(kurz);

    // Zweite Etage. Erst der volle Bezeichner — er ist der Grund, warum es sie
    // gibt; passt er nicht, die Kurzform. Die Dauer hängt sich hier direkt an,
    // weil ein zweiter Eintrag für dasselbe Segment doppelt Platz kostete.
    const dauer = dauerLabel(b);
    const kandidaten = dauer === null
      ? [lang, kurz]
      : [`${lang} · ${dauer}`, lang, `${kurz} · ${dauer}`, kurz];
    for (const text of kandidaten) {
      const unten = setzeUnten(etage, b.links, text, setz, i === letzterIndex);
      if (unten !== null) return { lage: 'keine', text: '', unten };
    }
    return nummerOderNichts(b);
  });

  // --- Durchgang 5: die Dauern der Abschnitte, deren Name im Balken steht --
  bahn.segmente.forEach((b, i) => {
    const eintrag = out[i];
    if (eintrag === undefined || eintrag.lage !== 'im-balken') return;
    const dauer = dauerLabel(b);
    if (dauer === null) return;
    eintrag.unten = setzeUnten(etage, b.links, dauer, setz, i === letzterIndex, 'dauer');
  });

  return { segmente: out, endMarke, frei, unterzeile: etage.benutzt };
}

export function verteileBeschriftung(
  spuren: readonly BandSpur[], o: BeschriftungsOptionen,
): BandBeschriftung {
  const segmente: SegmentBeschriftung[][] = [];
  const endMarken: (UnterEintrag | null)[] = [];
  const frei: UnterEintrag[][] = [];
  const unterzeile: boolean[] = [];
  let nummernGenutzt = false;

  spuren.forEach((bahn, i) => {
    const r = beschrifteBahn(bahn, o, o.endMarke?.(i) ?? null, o.luecken?.(i) ?? []);
    segmente.push(r.segmente);
    endMarken.push(r.endMarke);
    frei.push(r.frei);
    unterzeile.push(r.unterzeile);
    if (r.segmente.some(s => s.lage === 'nummer')) nummernGenutzt = true;
  });

  return { segmente, endMarken, frei, unterzeile, nummernGenutzt };
}
