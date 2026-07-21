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
import { KONTRAST_EINREICHUNG, KONTRAST_FIXTURES, type KontrastFixture } from './kontrast.seed';

export interface SmokeErgebnis {
  id: KontrastFixture['id'];
  label: string;
  manipulation: string;
  erwartet: string;
  /** Gefundene Widersprüche des Laufs. */
  gefunden: Widerspruch[];
  unschaerfeAnzahl: number;
  bestanden: boolean;
  /** Gesetzt, wenn der Lauf gar nicht ausgewertet werden konnte. */
  fehler: string | null;
}

export interface SmokeReport {
  ergebnisse: SmokeErgebnis[];
  /** Die saubere Fassung hat KEINEN Widerspruch gemeldet. */
  falschPositivKontrolle: boolean;
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

async function laufeFixture(
  transport: AITransport, f: KontrastFixture, faktenBlock: string,
): Promise<SmokeErgebnis> {
  const basis = {
    id: f.id, label: f.label, manipulation: f.manipulation, erwartet: erwartungsText(f),
  };

  try {
    const gliederung = parseVbGliederung(f.markdown);
    const prompt = buildInfografikPrompt(gliederung, f.markdown, faktenBlock);
    // `runBaustein` setzt den Chat vor jedem Lauf zurück (Pitfall #36) — sonst
    // trüge Fixture 2 den Verlauf von Fixture 1 mit und die Messung wäre wertlos.
    const { text } = await runBaustein(transport, MAP_INFOGRAFIK_SKILL, prompt);
    const daten = parseInfografik(text, gliederung);

    if (daten === null) {
      return {
        ...basis, gefunden: [], unschaerfeAnzahl: 0, bestanden: false,
        fehler: 'Die Antwort enthielt kein auswertbares JSON.',
      };
    }

    return {
      ...basis,
      gefunden: daten.widersprueche,
      unschaerfeAnzahl: daten.unschaerfeBegriffe.length,
      bestanden: bewerte(f, daten.widersprueche),
      fehler: null,
    };
  } catch (e) {
    return {
      ...basis, gefunden: [], unschaerfeAnzahl: 0, bestanden: false,
      fehler: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Fährt alle Kontrast-Fixtures nacheinander. Sequenziell, weil die Bridge genau
 * ein postMessage-Fenster hat. Wirft nie — ein gescheiterter Lauf ist ein
 * Messergebnis, kein Programmfehler.
 */
export async function laufeSubstanzSmoke(transport: AITransport): Promise<SmokeReport> {
  const faktenBlock = baueFaktenBlock(KONTRAST_EINREICHUNG);
  const ergebnisse: SmokeErgebnis[] = [];

  for (const f of KONTRAST_FIXTURES) {
    ergebnisse.push(await laufeFixture(transport, f, faktenBlock));
  }

  const sauber = ergebnisse.find(e => e.id === 'sauber');
  return {
    ergebnisse,
    falschPositivKontrolle: sauber !== undefined && sauber.fehler === null
      && sauber.gefunden.length === 0,
    alleBestanden: ergebnisse.every(e => e.bestanden),
  };
}
