/**
 * JSONL lesen und zum Stand falten.
 *
 * **Die Dateireihenfolge entscheidet, nicht der Zeitstempel.** Mehrere Kollegen an
 * mehreren Windows-Rechnern haben mehrere Uhren. Sortierte die Faltung nach `ts`,
 * könnte die nachgehende Uhr eines Rechners eine neuere Meinung dauerhaft und
 * stillschweigend überschreiben — und niemand sähe je, dass es passiert ist. Die
 * Anhänge-Reihenfolge ist die einzige Ordnung, die tatsächlich stimmt; `ts` ist
 * Anzeige. **Bitte nicht „zu einer ts-Sortierung reparieren".**
 *
 * Über Autor-Dateien hinweg spielt die Reihenfolge für Urteile keine Rolle: der
 * Schlüssel ist der Autor, und alle seine Einträge stehen in seiner Datei. Nur die
 * Kommentarliste wird zur Anzeige nach `ts` gemischt — dort ist Uhren-Schiefe
 * kosmetisch, sie verschiebt eine Unterhaltung leicht, verliert aber nichts.
 *
 * Kaputte Zeilen werden übersprungen, nie geworfen: eine append-only Datei kann
 * auf einem abgebrochenen Schreibvorgang enden, und eine halbe letzte Zeile darf
 * nicht die Antworten aller anderen unlesbar machen.
 *
 * Rein: keine IO, keine Uhr (`baueEintrag` bekommt den Zeitstempel gereicht).
 */
import { ALT_PUNKT_IDS } from './seed-phasenschnitt';
import {
  urteilSchluessel, normalisiereAutor, anzeigeAutor,
  type Beitrag, type KlaerungEintrag, type KlaerungStand, type Urteil, type ZielWert,
} from './typen';

/** Erkennt eine brauchbare Zeile. Alles ohne Autor und Punkt ist kein Eintrag. */
function istEintrag(roh: unknown): roh is KlaerungEintrag {
  if (typeof roh !== 'object' || roh === null) return false;
  const e = roh as Record<string, unknown>;
  return typeof e.autor === 'string' && e.autor.trim() !== ''
    && typeof e.punktId === 'string' && e.punktId.trim() !== ''
    && typeof e.ts === 'string';
}

/** Liest JSONL. Defekte oder abgeschnittene Zeilen werden übersprungen. */
export function parseEintraege(roh: string): KlaerungEintrag[] {
  const out: KlaerungEintrag[] = [];
  for (const zeile of roh.split('\n')) {
    const t = zeile.trim();
    if (t === '') continue;
    try {
      const parsed: unknown = JSON.parse(t);
      if (istEintrag(parsed)) out.push(parsed);
    } catch {
      // Abgebrochener Schreibvorgang oder Fremdzeile — der Rest bleibt lesbar.
    }
  }
  return out;
}

/**
 * Faltet Einträge zum Stand: EIN Durchlauf, zwei unabhängige Projektionen.
 *
 * Ein Eintrag darf beides tragen; dann wirkt er auf beides. Ein Eintrag **ohne**
 * `urteil`-Schlüssel lässt das bisherige Urteil stehen — er äußert sich dazu
 * nicht, statt es zu löschen.
 *
 * **Alte Punkt-Ids werden hier übersetzt, an genau einer Stelle.** Urteil,
 * Kommentar und Widerruf müssen denselben Schlüssel sehen — läge die Übersetzung
 * in `parseEintraege`, umginge sie jeden Aufrufer, der `falte` direkt mit
 * Objekten füttert; läge sie an den Lesestellen (`konsens`, `gruppen`, `export`),
 * wären es acht Kopien derselben Zeile.
 */
export function falte(eintraege: readonly KlaerungEintrag[]): KlaerungStand {
  const urteile = new Map<string, { urteil: Urteil; zielWert?: ZielWert; ts: string }>();
  const kommentare = new Map<string, Beitrag[]>();
  const namen = new Map<string, string>();

  for (const e of eintraege) {
    // Zwei Formen desselben Namens: der SCHLÜSSEL vergleicht (damit „Hübsch" und
    // „HÜBSCH" ein Fach teilen), die ANZEIGE trägt die Schreibweise des Profils.
    const autor = normalisiereAutor(e.autor);
    const anzeige = anzeigeAutor(e.autor);
    namen.set(autor, anzeige);
    const punktId = ALT_PUNKT_IDS.get(e.punktId) ?? e.punktId;

    if (e.urteil !== undefined) {
      urteile.set(urteilSchluessel(autor, punktId), {
        urteil: e.urteil,
        ...(e.zielWert !== undefined ? { zielWert: e.zielWert } : {}),
        ts: e.ts,
      });
    }

    const liste = kommentare.get(punktId);
    if (typeof e.kommentar === 'string' && e.kommentar.trim() !== '') {
      const beitrag: Beitrag = { autor: anzeige, ts: e.ts, text: e.kommentar };
      if (liste) liste.push(beitrag); else kommentare.set(punktId, [beitrag]);
    }
    if (e.kommentarZurueck === true && liste) {
      // Der jüngste noch stehende EIGENE Beitrag — eindeutig, weil alle Einträge
      // eines Autors in seiner Datei und damit in dieser Liste in Schreibreihen-
      // folge stehen. Die Datei behält beide Zeilen; gelöscht wird nie.
      for (let i = liste.length - 1; i >= 0; i -= 1) {
        const b = liste[i];
        if (b !== undefined && normalisiereAutor(b.autor) === autor) {
          liste.splice(i, 1);
          break;
        }
      }
    }
  }

  return { urteile, kommentare, namen };
}

/** Setzt die Beiträge mehrerer Autor-Dateien zur Anzeige zusammen. */
export function beitraegeSortiert(stand: KlaerungStand, punktId: string): Beitrag[] {
  return [...(stand.kommentare.get(punktId) ?? [])].sort((a, b) => a.ts.localeCompare(b.ts));
}

/** Was der Aufrufer über eine Äußerung weiß, bevor sie eine Zeile wird. */
export interface EintragEingabe {
  autor: string;
  punktId: string;
  urteil?: Urteil;
  zielWert?: ZielWert;
  kommentar?: string;
  kommentarZurueck?: true;
}

/**
 * Baut die Zeile. Die Uhr kommt von außen — nur der Hook ruft
 * `new Date().toISOString()`, damit zwei Läufe über dieselben Daten dasselbe
 * ergeben. Nicht gesetzte Felder werden **weggelassen**, nie als `null`
 * geschrieben (siehe Modulkopf von `typen.ts`).
 *
 * Geschrieben wird die **Anzeigeform** des Namens: die Datei wird im Zweifel von
 * einem Menschen gelesen, und „THOMAS HÜBSCH" wäre dort eine Verschlechterung
 * ohne Gegenwert — verglichen wird beim Falten ohnehin normalisiert.
 */
export function baueEintrag(eingabe: EintragEingabe, jetztIso: string): KlaerungEintrag {
  return {
    ts: jetztIso,
    autor: anzeigeAutor(eingabe.autor),
    punktId: eingabe.punktId,
    ...(eingabe.urteil !== undefined ? { urteil: eingabe.urteil } : {}),
    ...(eingabe.zielWert !== undefined ? { zielWert: eingabe.zielWert } : {}),
    ...(eingabe.kommentar !== undefined ? { kommentar: eingabe.kommentar } : {}),
    ...(eingabe.kommentarZurueck === true ? { kommentarZurueck: true as const } : {}),
  };
}
