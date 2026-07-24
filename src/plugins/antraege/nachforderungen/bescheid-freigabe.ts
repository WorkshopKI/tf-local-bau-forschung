/**
 * Freigabe-Tor + Konsistenz-Checks für RNE/ABL-Bescheide (deterministisch, rein).
 *
 * Strenger als NF, weil ein Bescheid eine Rechtsfolge trägt:
 *  - **Platzhalter-Tor** (Reuse `pruefeNf`): kein ungefüllter Platzhalter im Text.
 *  - **Begründungs-Vollständigkeit**: jeder adressierte Punkt hat einen Baustein
 *    ODER eine bewusste TODO-Markierung — bei RNE/ABL blockiert TODO die Freigabe.
 *  - **Konsistenz Bewertung↔Baustein** (Warnungen, blockieren NICHT — müssen bei der
 *    Freigabe einzeln quittiert werden): liegt eine MAP-Fachbewertung vor, prüft der
 *    Tor, ob ein tragender Grund einem gut bewerteten Aspekt widerspricht. **Keine
 *    Bewertung auffindbar ⇒ ehrlicher „übersprungen"-Hinweis** (nie still).
 *
 * Type-only-Import aus dem MAP-Plugin (keine Laufzeit-Kante); die Daten liefert der
 * Aufrufer über die Rückwärtssuche (Werkbank).
 */
import type { MapChecklistenDefinition, MapPruefung, MapStufe } from '@/plugins/map-foerderfaehig/checkliste/typen';
import type { TextbausteinRecord } from '@/core/services/skills';

/** Gut bewertete Stufen — ein Bescheid-Grund darauf ist widersprüchlich. */
const GUTE_STUFEN: ReadonlySet<MapStufe> = new Set<MapStufe>(['B2', 'B3']);
const STUFE_RANG: Record<MapStufe, number> = { B0: 0, B1: 1, B2: 2, B3: 3 };

/** Kurz-Label der Stufen (für den Warntext). */
const STUFE_LABEL: Record<MapStufe, string> = {
  B0: 'unzureichend', B1: 'ausreichend', B2: 'übertroffen', B3: 'deutlich übertroffen',
};

export interface KonsistenzWarnung {
  /** Stabiler Key (für die Quittierungs-Verwaltung). */
  key: string;
  text: string;
}

/**
 * Beste (höchste) MAP-Stufe je Prüfaspekt A–J — aus den Checklisten-Items (die ihre
 * `aspekte` tragen) und den zugehörigen Bewertungen. Rein.
 */
export function aspektBewertung(
  pruefung: MapPruefung, checkliste: MapChecklistenDefinition,
): Record<string, MapStufe> {
  const out: Record<string, MapStufe> = {};
  for (const item of checkliste.items) {
    const stufe = pruefung.bewertungen[item.id]?.stufe;
    if (!stufe) continue;
    for (const a of item.aspekte ?? []) {
      if (!out[a] || STUFE_RANG[stufe] > STUFE_RANG[out[a]!]) out[a] = stufe;
    }
  }
  return out;
}

/**
 * Konsistenz der bestätigten Bausteine gegen die MAP-Bewertung. Für jeden Baustein,
 * der einen Aspekt als Grund trägt, dessen MAP-Bewertung aber B2/B3 (gut) ist, eine
 * Warnung. Rein; leere Bewertung ⇒ keine Warnungen (der Aufrufer zeigt dann den
 * „übersprungen"-Hinweis).
 */
export function pruefeKonsistenz(
  bausteine: readonly TextbausteinRecord[], bewertung: Record<string, MapStufe>,
): KonsistenzWarnung[] {
  const out: KonsistenzWarnung[] = [];
  for (const b of bausteine) {
    for (const a of b.aspekte) {
      const stufe = bewertung[a];
      if (stufe && GUTE_STUFEN.has(stufe)) {
        out.push({
          key: `${b.id}:${a}`,
          text: `Baustein ${b.id} begründet mit Aspekt ${a}, aber die Fachbewertung dort ist „${STUFE_LABEL[stufe]}" (${stufe}) — bitte prüfen, ob der Grund trägt.`,
        });
      }
    }
  }
  return out;
}

export interface BescheidTorEingang {
  /** Finaler Text des Entwurfs (Platzhalter-Prüfung). */
  finalerText: string;
  /** Adressierte Punkte gesamt vs. mit Baustein — für die Vollständigkeit. */
  offeneTodos: number;
  /** Konsistenz-Warnungen (aus `pruefeKonsistenz`). */
  warnungen: KonsistenzWarnung[];
  /** Wurde eine MAP-Bewertung gefunden? `false` ⇒ Checks übersprungen. */
  bewertungGefunden: boolean;
  /** Quittierte Warnungs-Keys. */
  quittiert: ReadonlySet<string>;
  /** Pflicht-Checkbox „geprüft und freigegeben". */
  freigabeBestaetigt: boolean;
}

export interface BescheidTorErgebnis {
  /** Kein ungefüllter Platzhalter im Text. */
  platzhalterOk: boolean;
  /** Alle adressierten Punkte haben einen Baustein (TODO blockiert bei RNE/ABL). */
  vollstaendig: boolean;
  /** Alle Warnungen quittiert. */
  warnungenQuittiert: boolean;
  /** Darf exportiert werden? (alle Tore + Pflicht-Checkbox). */
  exportErlaubt: boolean;
  /** Sichtbarer „Konsistenz übersprungen"-Hinweis (keine Bewertung gefunden). */
  konsistenzUebersprungen: boolean;
}

/** Regel `nf_keine_platzhalter_reste` als reine Prüfung (Reuse-Muster). */
function platzhalterFrei(text: string): boolean {
  // Dieselben Marker wie `extractPlatzhalter`: geschweifte Gruppen, x€-Werte, Auslassungen.
  return !/\{[^{}]*\}|x{1,3}\s?T?€|…|\.\.\./.test(text);
}

/** Wertet das RNE/ABL-Freigabe-Tor aus. Rein. */
export function bescheidFreigabeTor(e: BescheidTorEingang): BescheidTorErgebnis {
  const platzhalterOk = platzhalterFrei(e.finalerText);
  const vollstaendig = e.offeneTodos === 0;
  const warnungenQuittiert = e.warnungen.every(w => e.quittiert.has(w.key));
  return {
    platzhalterOk,
    vollstaendig,
    warnungenQuittiert,
    konsistenzUebersprungen: !e.bewertungGefunden,
    exportErlaubt: platzhalterOk && vollstaendig && warnungenQuittiert && e.freigabeBestaetigt,
  };
}
