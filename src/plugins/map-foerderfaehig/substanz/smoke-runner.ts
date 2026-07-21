/**
 * Substanz-Smoke: misst den Widerspruchscheck gegen die Kontrast-Fixtures.
 *
 * Der Transport wird hereingereicht, es gibt keinen React-Import und keinen
 * Node-Zugriff — die Datei ist damit sowohl vom dev-Panel als auch von einem
 * Test aus benutzbar. Bewusst OHNE `getOrComputeBaustein`: kein Cache, kein
 * Einreichungs-Schlüssel, keine gespeicherten Ergebnisse. Ein Messlauf darf den
 * Produktivzustand nicht anfassen (Muster: `aufbereitung/eval-panel/runner.ts`).
 *
 * Gemessen wird nur die Substanz-Seite. Canvas, Delta und Wirkungskette laufen
 * zwar im selben Aufruf mit, sind hier aber nicht das Prüfobjekt.
 *
 * Die Fixtures sind fiktiv und gebündelt — es wird nie ein echter Antrag geladen.
 */
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import { runBaustein } from '@/plugins/antraege/aufbereitung/bausteine';
import { parseVbGliederung } from '@/plugins/antraege/aufbereitung/gliederung';
import { MAP_INFOGRAFIK_SKILL } from '@/core/services/skills';
import { baueFaktenBlock } from '../infografik/fakten';
import { buildInfografikPrompt, parseInfografik } from '../infografik/schema';
import type { Widerspruch } from '../infografik/substanz';
import { stufenAbstand, type ZweitmeinungEintrag } from '../infografik/zweitmeinung';
import type { MapChecklistenItem, MapStufe } from '../checkliste/typen';
import { KONTRAST_EINREICHUNG, KONTRAST_FIXTURES, type KontrastFixture } from './kontrast.seed';

/** Ein Gold-Wert und was das Modell daraus gemacht hat. Rein informativ. */
export interface GoldZeile {
  itemId: string;
  gold: MapStufe;
  ki: MapStufe | null;
  /** `null`, wenn das Modell zu diesem Item nichts geliefert hat. */
  abstand: number | null;
}

export interface SmokeErgebnis {
  id: KontrastFixture['id'];
  label: string;
  manipulation: string;
  erwartet: string;
  /** Gefundene Widersprüche des Laufs. */
  gefunden: Widerspruch[];
  unschaerfeAnzahl: number;
  bestanden: boolean;
  /** Einstufungen des Laufs. */
  zweitmeinung: ZweitmeinungEintrag[];
  /** Je Skala-Item eine gültige Stufe MIT Begründung UND mindestens einer Fundstelle. */
  zweitmeinungVollstaendig: boolean;
  goldAbgleich: GoldZeile[];
  /** Gesetzt, wenn der Lauf gar nicht ausgewertet werden konnte. */
  fehler: string | null;
}

export interface SmokeReport {
  ergebnisse: SmokeErgebnis[];
  /** Die saubere Fassung hat KEINEN Widerspruch gemeldet. */
  falschPositivKontrolle: boolean;
  /** Alle Fixtures lieferten eine vollständige Zweitmeinung. Steht NEBEN `alleBestanden`. */
  zweitmeinungKontrolle: boolean;
  alleBestanden: boolean;
}

function erwartungsText(f: KontrastFixture): string {
  return f.erwarteteArt === null
    ? 'kein Widerspruch'
    : `${f.erwarteteWidersprueche} Widerspruch (${f.erwarteteArt})`;
}

/**
 * Bewertet einen Lauf. Bewusst nachsichtig bei der Anzahl, streng bei der Art:
 * meldet das Modell zusätzlich einen zweiten, plausiblen Widerspruch, ist das
 * kein Fehlschlag — meldet es bei der SAUBEREN Fassung irgendetwas, schon.
 */
function bewerte(f: KontrastFixture, gefunden: readonly Widerspruch[]): boolean {
  if (f.erwarteteArt === null) return gefunden.length === 0;
  return gefunden.some(w => w.art === f.erwarteteArt);
}

/**
 * Vollständig heisst: zu JEDEM Skala-Item eine Einstufung, die eine Begründung
 * UND mindestens eine Fundstelle trägt. Der Parser lässt Einträge ohne Fundstelle
 * durch — genau deshalb ist diese Prüfung hier eine Messung am Modell und nicht
 * am Parser.
 */
function istVollstaendig(
  eintraege: readonly ZweitmeinungEintrag[], skalaItems: readonly MapChecklistenItem[],
): boolean {
  if (skalaItems.length === 0) return false;
  return skalaItems.every(item => {
    const e = eintraege.find(x => x.itemId === item.id);
    return e !== undefined && e.begruendung.length > 0 && e.sektionIds.length > 0;
  });
}

/** Stellt die Gold-Werte den Einstufungen gegenüber. Rein informativ, nie Pass/Fail. */
function goldAbgleichFuer(
  f: KontrastFixture, eintraege: readonly ZweitmeinungEintrag[],
): GoldZeile[] {
  return Object.entries(f.goldZweitmeinung ?? {}).map(([itemId, gold]) => {
    const ki = eintraege.find(e => e.itemId === itemId)?.stufe ?? null;
    return {
      itemId,
      gold: gold as MapStufe,
      ki,
      abstand: ki === null ? null : stufenAbstand(gold as MapStufe, ki),
    };
  });
}

async function laufeFixture(
  transport: AITransport,
  f: KontrastFixture,
  faktenBlock: string,
  skalaItems: readonly MapChecklistenItem[],
): Promise<SmokeErgebnis> {
  const basis = {
    id: f.id, label: f.label, manipulation: f.manipulation, erwartet: erwartungsText(f),
  };
  const leer = {
    gefunden: [], unschaerfeAnzahl: 0, bestanden: false,
    zweitmeinung: [], zweitmeinungVollstaendig: false, goldAbgleich: [],
  };

  try {
    const gliederung = parseVbGliederung(f.markdown);
    const prompt = buildInfografikPrompt(gliederung, f.markdown, faktenBlock, skalaItems);
    // `runBaustein` setzt den Chat vor jedem Lauf zurück (Pitfall #36) — sonst
    // trüge Fixture 2 den Verlauf von Fixture 1 mit und die Messung wäre wertlos.
    const { text } = await runBaustein(transport, MAP_INFOGRAFIK_SKILL, prompt);
    const daten = parseInfografik(text, gliederung, skalaItems);

    if (daten === null) {
      return { ...basis, ...leer, fehler: 'Die Antwort enthielt kein auswertbares JSON.' };
    }

    return {
      ...basis,
      gefunden: daten.widersprueche,
      unschaerfeAnzahl: daten.unschaerfeBegriffe.length,
      bestanden: bewerte(f, daten.widersprueche),
      zweitmeinung: daten.innoZweitmeinung,
      zweitmeinungVollstaendig: istVollstaendig(daten.innoZweitmeinung, skalaItems),
      goldAbgleich: goldAbgleichFuer(f, daten.innoZweitmeinung),
      fehler: null,
    };
  } catch (e) {
    return { ...basis, ...leer, fehler: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Fährt alle Kontrast-Fixtures nacheinander. Sequenziell, weil die Bridge genau
 * ein postMessage-Fenster hat. Wirft nie — ein gescheiterter Lauf ist ein
 * Messergebnis, kein Programmfehler.
 */
export async function laufeSubstanzSmoke(
  transport: AITransport, skalaItems: readonly MapChecklistenItem[],
): Promise<SmokeReport> {
  const faktenBlock = baueFaktenBlock(KONTRAST_EINREICHUNG);
  const ergebnisse: SmokeErgebnis[] = [];

  for (const f of KONTRAST_FIXTURES) {
    ergebnisse.push(await laufeFixture(transport, f, faktenBlock, skalaItems));
  }

  const sauber = ergebnisse.find(e => e.id === 'sauber');
  return {
    ergebnisse,
    falschPositivKontrolle: sauber !== undefined && sauber.fehler === null
      && sauber.gefunden.length === 0,
    zweitmeinungKontrolle: ergebnisse.every(e => e.zweitmeinungVollstaendig),
    // Bewusst UNVERÄNDERT der Widerspruchs-Befund: der Gold-Abgleich ist eine
    // Kurator-Meinung, kein Sollwert, und darf kein Pass/Fail tragen.
    alleBestanden: ergebnisse.every(e => e.bestanden),
  };
}
