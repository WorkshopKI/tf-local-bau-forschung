/**
 * Assistent-Panel v1.1 — Bauer der deterministischen Arbeitsvorrat-Übersicht.
 *
 * Reine Funktion (`now` injizierbar → node-testbar): fasst den nicht-terminalen
 * Antragsbestand zu einer kompakten, frist-sortierten Übersicht zusammen, die der
 * Assembler im Kein-Entität-Fall (Liste/Startseite) in den Faktenblock hängt. So
 * tragen „Fristen"/„Was ist heute dran?" auch ohne selektierte Entität echte Fakten.
 *
 * KEINE neue Ableitung — es werden ausschließlich bestehende reine Helfer konsumiert:
 * `partitionArbeitsvorrat` (Terminalität), `fristTageVon` + `fristAnzeigeFromDays`
 * (dieselbe phasen-bewusste Frist-Infra wie der Entitäts-Faktenblock — bewusst statt
 * der age-basierten Eingangs-Ampel, weil frist-relativ = „was ist WANN fällig") und
 * `naechsterSchritt` (Handlungs-Formel).
 */
import type { AntragListItem } from '@/core/services/csv/types';
import type { ArbeitsvorratFrist, ArbeitsvorratUebersicht } from '@/core/services/assistent/kontext';
import { partitionArbeitsvorrat } from '@/plugins/antraege/arbeitsvorrat';
import { fristAnzeigeFromDays, fristTageVon } from '@/plugins/antraege/fristAnzeige';
import { naechsterSchritt, precheckUrteilVonZeile } from '@/core/utils/naechsterSchritt';
import type { EingangAmpel } from '@/plugins/antraege/eingangAmpel';

/** Menschliches Ampel-Wort — identisch zur Entitäts-Frist in kontextSnapshot. */
const AMPEL_WORT: Record<EingangAmpel, string> = {
  rot: 'überfällig',
  orange: 'dringend',
  gelb: 'näher rückend',
  gruen: 'im Zeitplan',
};

/** Cap der namentlich aufgeführten dringlichsten Anträge (Prompt-Budget). */
export const NAECHSTE_FRISTEN_CAP = 5;

/**
 * Baut die Arbeitsvorrat-Übersicht aus dem vollen Antragsbestand. `now` injizierbar.
 * Nur nicht-terminale Anträge mit berechenbarer Frist gehen in die Frist-Buckets/
 * -Liste ein; `gesamtInArbeit` zählt alle nicht-terminalen (auch fristlose) ehrlich.
 */
export function baueArbeitsvorratUebersicht(
  antraege: ReadonlyArray<AntragListItem>,
  now: number,
): ArbeitsvorratUebersicht {
  const { inArbeit } = partitionArbeitsvorrat(antraege);

  // Frist-tragende Teilmenge, nächste Frist zuerst (überfällig = negativ → ganz vorn).
  // `fristTageVon` liefert `null`, wo die Uhr steht — der Assistent zählt damit
  // dieselben Vorgänge wie die Liste. Mit der alten, zustandslosen Rechnung
  // meldete er „überfällig" für Vorgänge, die die Liste als angehalten zeigt.
  const mitFrist = inArbeit
    .map(a => ({ a, tage: fristTageVon(a, now) }))
    .filter((x): x is { a: AntragListItem; tage: number } => x.tage !== null)
    .sort((x, y) => x.tage - y.tage);

  let ueberfaellig = 0;
  let dringend = 0;
  const naechsteFristen: ArbeitsvorratFrist[] = [];

  for (const { a, tage } of mitFrist) {
    const anz = fristAnzeigeFromDays(tage);
    if (!anz) continue; // tage ist number → anz nie null; defensiv
    if (anz.ampel === 'rot') ueberfaellig++;
    else if (anz.ampel === 'orange' || anz.ampel === 'gelb') dringend++;

    if (naechsteFristen.length < NAECHSTE_FRISTEN_CAP) {
      // PreCheck-aware nächster Schritt (opt-in via ?? null) — wie Liste/Home.
      const schritt = naechsterSchritt(a.status, precheckUrteilVonZeile(a).label || null);
      naechsteFristen.push({
        titel: a.akronym || a.titel || a.aktenzeichen,
        hinweis: `${anz.text} (${AMPEL_WORT[anz.ampel]})`,
        ...(schritt?.aktion ? { aktion: schritt.aktion } : {}),
      });
    }
  }

  return { gesamtInArbeit: inArbeit.length, ueberfaellig, dringend, naechsteFristen };
}
