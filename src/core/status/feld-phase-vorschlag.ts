/**
 * Welche ZAH-Phase gehört an ein Kürzel — und woher wissen wir das?
 *
 * Ein Kürzel ohne Phase wird erfasst und angezeigt, erklärt aber kein „seit
 * wann": `bestimmeSeit` (`herleitung.ts`) sucht in der Chronik ein Datumsfeld
 * **derselben Phase wie der aktuelle Status** und liefert ohne Zuordnung immer
 * `null`. Gemessen trugen 0 von 508 Feldern eine Phase — die „seit"-Zeile war
 * damit für den ganzen Bestand tot.
 *
 * 508 Zuordnungen von Hand sind keine Option. Zwei Quellen wissen es bereits:
 *
 * 1. **Die Trigger-Tabelle.** Sie sagt je Kürzel, welchen Status es setzt, und
 *    der Status kennt seine Phase. Das ist keine Beobachtung aus dem Bestand,
 *    sondern eine Regel des Fachsystems — ein einziger Beleg genügt deshalb,
 *    eine Stichproben-Schwelle wie bei den Zieltagen wäre hier sinnlos.
 * 2. **Die Auslieferung.** `seed-codes.ts` kuratiert 24 Feld-Phasen von Hand.
 *    Sie erreichen keine Bestandsfassung, weil `ergaenzeSeedFelder` rein additiv
 *    ist und an bestehenden Feldern nichts nachzieht.
 *
 * Vier Ehrlichkeiten sind fest eingebaut:
 *
 * - **Keine Mehrheitsentscheidung.** Trägt ein Kürzel über mehrere Richtlinien
 *   verschiedene Phasen, gibt es KEINEN Vorschlag — der Fall wird benannt.
 * - **Trigger schlägt Auslieferung, aber nicht stillschweigend.** Widersprechen
 *   sich beide Quellen an einem Feld, fällt der Vorschlag aus BEIDEN Quellen weg
 *   und die Abweichung steht mit beiden Phasen da. Sonst kippte ein späterer
 *   Trigger-Import still eine handkuratierte Zuordnung.
 * - **TV vor VB, aber sichtbar.** Die Kürzel-Phase beschreibt den TV-Weg, also
 *   gewinnt der TV-Status. Weicht der VB-Status davon ab, bleibt der Vorschlag
 *   und der Beleg nennt die Abweichung ausdrücklich.
 * - **Kein Vorschlag ist eine Antwort**, kein Mangel — und sie wird begründet
 *   (kein Trigger / keine Status-Zeile / nur Marker / unbekannter Zielcode).
 *
 * **Die Anzeigetexte entstehen hier**, nicht in der Vorschau: die Testumgebung
 * ist node-only, ohne DOM. Ein `satz` je Beleg, Konflikt und Abweichung macht
 * die Darstellung prüfbar — dasselbe Muster wie `TriggerZeile.satz`.
 *
 * Rein: keine IO, keine Uhr.
 */
import { normKey } from './normalisierung';
import { statusCodeEintrag } from './status-codes';
import { ebeneVonNummer } from './trigger-satz';
import { ZAH_PHASE_LABEL } from './zah-phasen';
import type { StatusFeldEintrag, TriggerZeile, ZahPhaseId } from './typen';

/** An welchem Status-Feld die Trigger-Zeile ihre Wirkung entfaltet. */
export type PhasenQuelle = 'tv' | 'vb' | 'seed';

export type PhasenHerkunft = 'trigger' | 'seed';

/** Warum ein Kürzel keinen Vorschlag bekommt. */
export type OhneGrund =
  /** Die Trigger-Tabelle kennt das Kürzel nicht. */
  | 'keinTrigger'
  /** Trigger ja, aber nur Mail-/Eintrags-Prozeduren (oder nicht interpretiert). */
  | 'keinStatusTrigger'
  /** Setzt nur Marker-Codes (29/88/93/94) — `null` ist dort der richtige Zustand. */
  | 'nurMarker'
  /** Setzt einen Status, den der Phasen-Schnitt nicht führt (gemessen: 74). */
  | 'unbekannterZielcode';

/**
 * Ein Beleg ist **eine Regel**, nicht eine Zeile.
 *
 * Dasselbe Kürzel trägt dieselbe Regel in allen neun Richtlinien, teils zweimal
 * je Richtlinie (zwei `statusTvVb`-Zeilen mit gleichem Zielstatus). Zeile für
 * Zeile aufgeführt ergäbe das für `AAE` siebzehn identische Sätze — eine
 * Vorschau, die niemand liest. Gleiche Wirkung wird deshalb zusammengefasst und
 * nennt ihre Richtlinien.
 */
export interface PhasenBeleg {
  /** Richtlinien, in denen diese Regel gleich lautet. Leer bei Quelle `seed`. */
  programme: string[];
  /** Zielstatus, aus dem die Phase folgt. `null` bei der Auslieferung. */
  status: number | null;
  quelle: PhasenQuelle;
  /** Gesetzt, wenn dieselbe Regel einen VB-Status mit ANDERER Phase setzt. */
  abweichenderVbStatus?: number;
  /** Deutsche Satzform für die Anzeige. Immer gefüllt. */
  satz: string;
}

export interface PhasenVorschlag {
  /** Schreibschlüssel — `setzeFeldPhasen` keyt danach. */
  feldId: string;
  /** Kürzel des Fachsystems in Originalschreibweise. */
  code: string;
  bezeichnung: string;
  phase: ZahPhaseId;
  /**
   * Bisheriger Wert der Fassung. `undefined` = nie entschieden, `null` = bewusst
   * ohne Phase — der Unterschied bleibt erhalten (siehe `typen.ts`).
   */
  alt: ZahPhaseId | null | undefined;
  herkunft: PhasenHerkunft;
  /** Woraus der Vorschlag folgt. Immer mindestens ein Eintrag. */
  belege: PhasenBeleg[];
}

/** Ein Kürzel, das über die Richtlinien hinweg verschiedene Phasen setzt. */
export interface PhasenKonflikt {
  feldId: string;
  code: string;
  bezeichnung: string;
  phasen: { phase: ZahPhaseId; programme: string[] }[];
  satz: string;
}

/** Auslieferung und Trigger-Tabelle sagen etwas Verschiedenes. */
export interface QuellenAbweichung {
  feldId: string;
  code: string;
  bezeichnung: string;
  seedPhase: ZahPhaseId;
  triggerPhase: ZahPhaseId;
  satz: string;
}

/** Die Zahlen für die ehrliche Kopfzeile — was überhaupt ableitbar ist. */
export interface PhasenKennzahlen {
  /** Katalog-Felder mit Kürzel (die Grundgesamtheit des Joins). */
  mitCode: number;
  /** Davon: setzen laut Trigger-Tabelle überhaupt einen Status. */
  mitStatusTrigger: number;
  /** Feld-Phasen, die die Auslieferung von Hand kuratiert. */
  seedPhasen: number;
}

export interface PhasenAuswahl {
  /** Was gesetzt würde — nach `herkunft` trennbar, in Kürzel-Reihenfolge. */
  vorschlaege: PhasenVorschlag[];
  uneinheitlich: PhasenKonflikt[];
  quellenAbweichungen: QuellenAbweichung[];
  ohneVorschlag: { code: string; bezeichnung: string; grund: OhneGrund }[];
  kennzahlen: PhasenKennzahlen;
}

/**
 * Die Quellen, die eine Fassung überschreiben kann — deshalb hereingereicht und
 * nicht importiert (wie `phaseVon` bei den Zieltagen).
 */
export interface PhasenSchnitt {
  codeZuPhase: ReadonlyMap<number, ZahPhaseId>;
  markerCodes: ReadonlySet<number>;
}

/** Sortierung von Richtlinien-Nummern: 76 vor 131, nicht „131" vor „76". */
const nachNummer = (a: string, b: string): number =>
  a.localeCompare(b, 'de', { numeric: true });

/** „40 (Gutachten fertig)" bzw. nur „74", wenn der Katalog den Code nicht führt. */
function statusPhrase(code: number): string {
  const text = statusCodeEintrag(code)?.text;
  return text ? `${code} (${text})` : String(code);
}

/** Der Zielstatus einer Zeile — `null`, wenn sie gar keinen setzt. */
function zielStatus(zeile: TriggerZeile): { status: number; quelle: 'tv' | 'vb'; vbAbweichend: number | null } | null {
  const g = zeile.geparst;
  if (!g) return null;
  if (g.art === 'statusTvVb') {
    // TV hat Vorrang: die Kürzel-Phase beschreibt den TV-Weg. Ein abweichender
    // VB-Status verdrängt den Vorschlag nicht, wird aber am Beleg genannt —
    // eine unsichtbare Auswahl wäre schlimmer als gar keine.
    if (g.statusTv !== null) {
      return { status: g.statusTv, quelle: 'tv', vbAbweichend: g.statusVb };
    }
    if (g.statusVb !== null) return { status: g.statusVb, quelle: 'vb', vbAbweichend: null };
    return null;
  }
  if (g.art === 'statusSetzen') {
    const kurz = ebeneVonNummer(g.ebene);
    return { status: g.status, quelle: kurz === 'VB' ? 'vb' : 'tv', vbAbweichend: null };
  }
  return null;
}

function belegSatz(
  programme: readonly string[], status: number, quelle: 'tv' | 'vb',
  phase: ZahPhaseId, vbAbweichend: number | null,
): string {
  const feld = quelle === 'tv' ? 'TV-Status' : 'VB-Status';
  const kern = `setzt in Richtlinie ${programme.join(', ')} den ${feld} ${statusPhrase(status)}`
    + ` → ${ZAH_PHASE_LABEL[phase]}`;
  return vbAbweichend !== null
    ? `${kern}, VB-Status abweichend ${statusPhrase(vbAbweichend)}`
    : kern;
}

/**
 * Sammelt die Phasen, die die Trigger-Zeilen eines Kürzels setzen — je Phase die
 * Belege, gleiche Wirkung zu EINEM Beleg gefaltet. Nebenbei fällt an, warum eine
 * Zeile nichts beigetragen hat.
 */
function faltePhasen(
  zeilen: readonly TriggerZeile[], schnitt: PhasenSchnitt,
): { phasen: Map<ZahPhaseId, PhasenBeleg[]>; hatStatus: boolean; hatUnbekannt: boolean } {
  type Rohbeleg = {
    phase: ZahPhaseId; status: number; quelle: 'tv' | 'vb';
    abweichend: number | null; programme: string[];
  };
  const gefaltet = new Map<string, Rohbeleg>();
  let hatStatus = false;
  let hatUnbekannt = false;

  for (const z of zeilen) {
    const ziel = zielStatus(z);
    if (!ziel) continue;
    hatStatus = true;
    if (schnitt.markerCodes.has(ziel.status)) continue;
    const phase = schnitt.codeZuPhase.get(ziel.status);
    if (!phase) { hatUnbekannt = true; continue; }

    // Nur ein VB-Status mit ANDERER Phase ist eine Abweichung; dieselbe Phase
    // über beide Felder ist der Regelfall und bläht den Beleg nur auf.
    const vbPhase = ziel.vbAbweichend !== null
      ? schnitt.codeZuPhase.get(ziel.vbAbweichend) ?? null
      : null;
    const abweichend = ziel.vbAbweichend !== null && vbPhase !== phase ? ziel.vbAbweichend : null;

    const schluessel = `${ziel.status}|${ziel.quelle}|${abweichend ?? ''}`;
    const roh = gefaltet.get(schluessel);
    if (roh) {
      if (!roh.programme.includes(z.programm)) roh.programme.push(z.programm);
      continue;
    }
    gefaltet.set(schluessel, {
      phase, status: ziel.status, quelle: ziel.quelle, abweichend, programme: [z.programm],
    });
  }

  const phasen = new Map<ZahPhaseId, PhasenBeleg[]>();
  for (const r of gefaltet.values()) {
    const programme = [...r.programme].sort(nachNummer);
    const liste = phasen.get(r.phase) ?? [];
    liste.push({
      programme,
      status: r.status,
      quelle: r.quelle,
      ...(r.abweichend !== null ? { abweichenderVbStatus: r.abweichend } : {}),
      satz: belegSatz(programme, r.status, r.quelle, r.phase, r.abweichend),
    });
    phasen.set(r.phase, liste);
  }
  return { phasen, hatStatus, hatUnbekannt };
}

function konfliktSatz(code: string, phasen: { phase: ZahPhaseId; programme: string[] }[]): string {
  const teile = phasen.map(
    p => `${ZAH_PHASE_LABEL[p.phase]} (Richtlinie ${p.programme.join(', ')})`,
  );
  return `${code} setzt ${teile.join(' und ')} — kein Vorschlag, solange das offen ist.`;
}

/**
 * Baut die Vorschau beider Bänder.
 *
 * @param felder     Die Felder der Fassung (der Entwurf).
 * @param trigger    Die importierte Trigger-Tabelle; Zeilen ohne Richtlinie
 *   bleiben außen vor — sie stammen aus Fassungen vor v2.380 und ließen sich
 *   keinem Antrag zuordnen.
 * @param seedFelder Die Felder der Auslieferung (`SEED_FELDER`).
 * @param schnitt    Code → Phase und die Marker-Codes.
 */
export function berechnePhasenVorschlag(
  felder: readonly StatusFeldEintrag[],
  trigger: readonly TriggerZeile[],
  seedFelder: readonly StatusFeldEintrag[],
  schnitt: PhasenSchnitt,
): PhasenAuswahl {
  const jeKuerzel = new Map<string, TriggerZeile[]>();
  for (const z of trigger) {
    if (!z.programm) continue;
    const k = normKey(z.kuerzel);
    const liste = jeKuerzel.get(k) ?? [];
    liste.push(z);
    jeKuerzel.set(k, liste);
  }

  const vorschlaege: PhasenVorschlag[] = [];
  const uneinheitlich: PhasenKonflikt[] = [];
  const ohneVorschlag: { code: string; bezeichnung: string; grund: OhneGrund }[] = [];
  let mitCode = 0;
  let mitStatusTrigger = 0;

  for (const f of felder) {
    if (!f.code) continue;
    mitCode++;
    const bezeichnung = f.label;
    const zeilen = jeKuerzel.get(normKey(f.code));
    if (!zeilen) {
      ohneVorschlag.push({ code: f.code, bezeichnung, grund: 'keinTrigger' });
      continue;
    }

    const { phasen, hatStatus, hatUnbekannt } = faltePhasen(zeilen, schnitt);
    if (hatStatus) mitStatusTrigger++;

    if (phasen.size === 0) {
      const grund: OhneGrund = !hatStatus
        ? 'keinStatusTrigger'
        : hatUnbekannt ? 'unbekannterZielcode' : 'nurMarker';
      ohneVorschlag.push({ code: f.code, bezeichnung, grund });
      continue;
    }

    if (phasen.size > 1) {
      const liste = [...phasen.entries()].map(([phase, belege]) => ({
        phase,
        programme: [...new Set(belege.flatMap(b => b.programme))].sort(nachNummer),
      }));
      uneinheitlich.push({
        feldId: f.feldId, code: f.code, bezeichnung, phasen: liste,
        satz: konfliktSatz(f.code, liste),
      });
      continue;
    }

    const [phase, belege] = [...phasen.entries()][0]!;
    if (f.zahPhaseId === phase) continue;   // steht schon so da
    vorschlaege.push({
      feldId: f.feldId, code: f.code, bezeichnung, phase,
      alt: f.zahPhaseId, herkunft: 'trigger',
      belege: belege.sort((a, b) => nachNummer(a.programme[0] ?? '', b.programme[0] ?? '')),
    });
  }

  const quellenAbweichungen = ergaenzeSeedPhasen(felder, seedFelder, vorschlaege);

  vorschlaege.sort((a, b) => a.code.localeCompare(b.code, 'de'));
  uneinheitlich.sort((a, b) => a.code.localeCompare(b.code, 'de'));
  ohneVorschlag.sort((a, b) => a.code.localeCompare(b.code, 'de'));

  return {
    vorschlaege,
    uneinheitlich,
    quellenAbweichungen,
    ohneVorschlag,
    kennzahlen: {
      mitCode,
      mitStatusTrigger,
      seedPhasen: seedFelder.filter(f => f.zahPhaseId != null).length,
    },
  };
}

/**
 * Der zweite Zweig: was die Auslieferung von Hand kuratiert und der Fassung
 * fehlt. **Mutiert `vorschlaege`** — ein Widerspruch zwischen den Quellen nimmt
 * den Trigger-Vorschlag wieder heraus, damit an dem Feld aus KEINER Quelle
 * stillschweigend etwas gesetzt wird.
 *
 * Felder, die die Fassung schon entschieden hat, bleiben unberührt: „was es
 * schon gibt, bleibt wie es ist" — dieselbe Zusage wie `ergaenzeSeedFelder`.
 */
function ergaenzeSeedPhasen(
  felder: readonly StatusFeldEintrag[],
  seedFelder: readonly StatusFeldEintrag[],
  vorschlaege: PhasenVorschlag[],
): QuellenAbweichung[] {
  const abweichungen: QuellenAbweichung[] = [];
  const jeFeldId = new Map(felder.map(f => [f.feldId, f]));

  for (const s of seedFelder) {
    const seedPhase = s.zahPhaseId;
    if (seedPhase == null) continue;
    const feld = jeFeldId.get(s.feldId);
    // Fehlt das Feld ganz, ist das die Aufgabe von „Nachziehen" (`seedLuecke`),
    // nicht dieses Bandes — es bringt die Phase dann von selbst mit.
    if (!feld || feld.zahPhaseId != null) continue;

    const i = vorschlaege.findIndex(v => v.feldId === s.feldId && v.herkunft === 'trigger');
    if (i >= 0) {
      const triggerPhase = vorschlaege[i]!.phase;
      if (triggerPhase === seedPhase) continue;   // einig — der Trigger-Beleg genügt
      vorschlaege.splice(i, 1);
      abweichungen.push({
        feldId: s.feldId, code: feld.code ?? s.feldId, bezeichnung: feld.label,
        seedPhase, triggerPhase,
        satz: `${feld.code ?? s.feldId}: Auslieferung sagt ${ZAH_PHASE_LABEL[seedPhase]},`
          + ` Trigger-Tabelle sagt ${ZAH_PHASE_LABEL[triggerPhase]} — kein Vorschlag aus beiden Quellen.`,
      });
      continue;
    }

    vorschlaege.push({
      feldId: s.feldId, code: feld.code ?? s.feldId, bezeichnung: feld.label,
      phase: seedPhase, alt: feld.zahPhaseId, herkunft: 'seed',
      belege: [{
        programme: [], status: null, quelle: 'seed',
        satz: `steht in der Auslieferung als ${ZAH_PHASE_LABEL[seedPhase]}`,
      }],
    });
  }

  abweichungen.sort((a, b) => a.code.localeCompare(b.code, 'de'));
  return abweichungen;
}
