/**
 * Was die Zeichen in einem Trigger-Satz bedeuten: `ABB` → „Bewilligung", `59` →
 * „bewilligt (ZAH-Phase Begleitung)", `211` → „Teilvorhaben-Ebene".
 *
 * Die Schicht zwischen Grammatik (`trigger-satz.ts`, kennt keinen Katalog) und
 * Anzeige (kennt keine Fassung). Sie nimmt die Segmente und hängt an jedes, was
 * die Katalog-Fassung darüber weiß — mehr nicht: `text` bleibt unangetastet, die
 * Verkettung ergibt weiter denselben Satz.
 *
 * **Erklärt wird nur, was belegt ist.** Ein Kürzel, das der Katalog nicht führt,
 * bekommt an einer gedeuteten Position die Aussage „steht nicht im Katalog" — an
 * einer ungedeuteten (`weitere`) dagegen gar nichts, weil dort nicht einmal
 * feststeht, dass es ein Kürzel IST. Die Anzeige zeigt genau da eine
 * Erklär-Geste, wo eine Erklärung dranhängt; ihr Fehlen ist damit selbst eine
 * Information.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import { kuerzelIndex, type KuerzelIndex } from './feld-zugriff';
import { normKey } from './normalisierung';
import { istNeutral, rollenLabel, MAIL_ROLLE, ROLLE_LANG } from './rollen';
import { sonderKuerzel } from './sonderkuerzel';
import { statusCodeEintrag, type StatusCodeIndex } from './status-codes';
import { ebeneVonNummer, type TriggerSegment } from './trigger-satz';
import { zahPhaseLabel, ZAH_MARKER_LABEL, SEED_CODE_ZU_ZAH_PHASE, SEED_MARKER_CODES } from './zah-phasen';
import type { MappingVersion, StatusWertEintrag, ZahPhase } from './typen';

/** Was hinter einem erklärbaren Zeichen steht — zwei Zeilen, mehr passt nicht. */
export interface SegmentErklaerung {
  /** Die Bedeutung selbst: „Bewilligung", „beantragt", „Teilvorhaben-Ebene". */
  titel: string;
  /** Einordnung, wo es eine gibt: „wird gesetzt von AB/FB", „ZAH-Phase Eingang". */
  zusatz?: string;
}

/** Ein Segment mit dem, was die Fassung darüber weiß. `text` bleibt gleich. */
export type ErklaertesSegment = TriggerSegment & { erklaerung?: SegmentErklaerung };

/**
 * Der Ausschnitt der Fassung, den die Erklärung braucht.
 *
 * Bewusst nicht die ganze `MappingVersion`: der Navigator bekommt heute nur
 * `felder` herein, und ihm die volle Fassung aufzuzwingen machte seine Eingabe
 * breiter, als seine Aufgabe ist.
 */
export interface ErklaerKatalog {
  felder: MappingVersion['felder'];
  werte?: readonly StatusWertEintrag[];
  zahPhasen?: readonly ZahPhase[];
}

/** Aus einer Fassung den Ausschnitt nehmen — Bequemlichkeit für die Aufrufer. */
export function erklaerKatalog(version: MappingVersion): ErklaerKatalog {
  return { felder: version.felder, werte: version.werte, zahPhasen: version.zahPhasen };
}

/**
 * Kürzel → Bedeutung. `null`, wenn der Katalog es nicht führt — der Aufrufer
 * entscheidet, ob das eine Aussage wert ist (siehe `erklaereSegmente`).
 */
export function kuerzelErklaerung(index: KuerzelIndex, code: string): SegmentErklaerung | null {
  const feld = index.get(normKey(code));
  if (!feld) return null;
  return {
    titel: feld.label.trim() || code,
    zusatz: istNeutral(feld) ? 'von jedem zu setzen' : `wird gesetzt von ${rollenLabel(feld)}`,
  };
}

/**
 * Statuscode → amtliche Bezeichnung und ZAH-Phase.
 *
 * **Die Fassung schlägt die Auslieferung** — dieselbe Reihenfolge wie in
 * `statusHerleitungKopf`: was die PL kuratiert (eine umgehängte Phase, ein gepflegtes
 * Label), gewinnt gegen den Seed-Schnitt. Bestandsfassungen tragen noch keine
 * Codes an den Werten; dort greift der Seed, damit nicht wochenlang „keine
 * Phase" dasteht, obwohl der Code längst einer zugeordnet ist.
 */
export function statusErklaerung(
  katalog: ErklaerKatalog, code: number, index?: StatusCodeIndex,
): SegmentErklaerung | null {
  const eintrag = katalog.werte?.find(w => w.code === code);
  const seed = statusCodeEintrag(code, index);
  const titel = eintrag?.label?.trim() || eintrag?.wert.trim() || seed?.text;
  if (!titel) return null;

  const marker = eintrag?.marker === true
    || (eintrag?.marker === undefined && SEED_MARKER_CODES.has(code));
  if (marker) return { titel, zusatz: ZAH_MARKER_LABEL };

  const phase = eintrag?.zahPhaseId !== undefined
    ? eintrag.zahPhaseId
    : SEED_CODE_ZU_ZAH_PHASE.get(code) ?? null;
  return phase === null
    ? { titel }
    : { titel, zusatz: `ZAH-Phase ${zahPhaseLabel(phase, katalog.zahPhasen)}` };
}

/**
 * Bezugsdatei-Nummer → unsere Lesart. Die Zuordnung ist **erschlossen**, und der
 * Zusatz sagt das — sonst liest sich eine Vermutung wie ein Beleg.
 */
export function ebeneErklaerung(nummer: string): SegmentErklaerung | null {
  const kurz = ebeneVonNummer(nummer);
  if (!kurz) return null;
  return {
    titel: kurz === 'VB' ? 'Verbund-Ebene' : 'Teilvorhaben-Ebene',
    zusatz: 'Bezugsdatei des Fachsystems — Zuordnung erschlossen, nicht belegt',
  };
}

/** Mail-Empfänger → Rolle im Klartext. Ohne bekannte Rolle: `null`. */
export function empfaengerErklaerung(token: string): SegmentErklaerung | null {
  const rolle = MAIL_ROLLE[normKey(token)];
  return rolle ? { titel: ROLLE_LANG[rolle] } : null;
}

/** Der Satz für ein gedeutetes, aber unbekanntes Kürzel — wortgleich zum Navigator. */
const NICHT_IM_KATALOG = 'steht nicht im Katalog';

/**
 * Segmente um das anreichern, was die Fassung weiß.
 *
 * Rein und **texterhaltend**: kein `text` wird angefasst, die Reihenfolge bleibt.
 * Wer die Ausgabe verkettet, bekommt Zeichen für Zeichen denselben Satz wie
 * vorher.
 *
 * @param index Vorgebauter Kürzel-Index. Der Aufrufer baut ihn EINMAL je Lauf —
 *   über ~505 Felder je Segment neu wäre Verschwendung.
 */
export function erklaereSegmente(
  katalog: ErklaerKatalog,
  segmente: readonly TriggerSegment[],
  index?: KuerzelIndex,
): ErklaertesSegment[] {
  const felder = index ?? kuerzelIndex(katalog.felder);
  return segmente.map((s): ErklaertesSegment => {
    switch (s.art) {
      case 'kuerzel': {
        const treffer = kuerzelErklaerung(felder, s.code);
        if (treffer) return { ...s, erklaerung: treffer };
        // Was die Fachseite zu einem katalogfremden Kürzel gesagt hat, gilt auch
        // an einer ungedeuteten Position — dort ist jetzt belegt, dass es ein
        // Kürzel IST, und das war der einzige Grund fürs Schweigen.
        const sonder = sonderKuerzel(s.code);
        if (sonder) return { ...s, erklaerung: { titel: sonder.label, zusatz: sonder.zusatz } };
        // Die übrigen ungedeuteten Zusatz-Argumente schweigen weiter: dass sie
        // überhaupt ein Kürzel sind, deckt die Legacy-Doku nicht ab.
        return s.herkunft === 'weiteres' ? s : { ...s, erklaerung: { titel: NICHT_IM_KATALOG } };
      }
      case 'status': {
        const treffer = statusErklaerung(katalog, s.code);
        return treffer ? { ...s, erklaerung: treffer } : { ...s, erklaerung: { titel: NICHT_IM_KATALOG } };
      }
      case 'ebene': {
        const treffer = ebeneErklaerung(s.nummer);
        return treffer ? { ...s, erklaerung: treffer } : s;
      }
      case 'empfaenger': {
        const treffer = empfaengerErklaerung(s.token);
        return treffer ? { ...s, erklaerung: treffer } : s;
      }
      case 'text':
        return s;
    }
  });
}
