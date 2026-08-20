/**
 * Reine Auswahl-Logik der Werkbank: Baustein-Vorschläge je offenem Punkt, und aus der
 * bestätigten Auswahl der `WerkbankAuftrag` für die NF-Maschine. UI-frei + testbar.
 *
 * Kern-Idee: der Mensch kreuzt Punkte an und bestätigt je Punkt Bausteine (aus dem
 * begründbaren Vorschlag). Das LLM wählt danach NICHT mehr — es bekommt genau diese
 * Bausteine und füllt nur deren Platzhalter (Pitfall #34).
 */
import {
  freigegebeneBausteine, sucheBausteine,
  type BausteinTreffer, type TextbausteinRecord,
} from '@/core/services/skills';
import { PRUEF_ASPEKTE } from '@/plugins/antraege/aufbereitung/aspekt-katalog';
import type { WerkbankAuftrag } from '../nachforderungen/useNachforderungen';
import type { BescheidTyp } from '../nachforderungen/artefakt-typ';
import type { WerkbankPunkt } from './types';

/** Aspekt-Kürzel → Name (für den Punkt-Kontext-Text). */
const ASPEKT_NAME = new Map(PRUEF_ASPEKTE.map(a => [a.id, a.name]));

/**
 * Vorschläge zu einem Punkt: Aspekt-Treffer (hoch gewichtet) + Wortstamm-Treffer über
 * beide Scopes. Nur freigegebene Bausteine (die Selektoren garantieren das).
 */
export function vorschlaegeFuerPunkt(
  katalog: readonly TextbausteinRecord[], punkt: WerkbankPunkt,
  artefaktTyp: BescheidTyp = 'nf', maxTreffer = 4,
): Array<BausteinTreffer<TextbausteinRecord>> {
  return sucheBausteine(katalog, [punkt.text], artefaktTyp, undefined, {
    aspektId: punkt.aspektId, maxTreffer,
  });
}

/** Die bestätigte Zuordnung: Punkt-Key → Baustein-IDs (leer = TODO). */
export type Auswahl = Record<string, string[]>;

/**
 * Punkt-Keys, denen (noch) kein Baustein zugeordnet ist.
 *
 * **Typ-bewusst, wenn Katalog und Typ mitgegeben werden** (v4.124): `auswahl` ist
 * EIN Topf für NF/RNE/ABL, `baueAuftrag` filtert daraus aber über
 * `freigegebeneBausteine(katalog, artefaktTyp)`. Nur die Länge zu zählen hieß:
 * wer im Typ NF einen NF-Baustein ankreuzt und danach auf „Ablehnung" schaltet,
 * galt weiter als versorgt — die Sperre am Knopf griff nicht, der Auftrag ging
 * mit leeren Baustein-Listen los, `mergeNfFuerTv('', '')` lieferte einen LEEREN
 * Text, und das Freigabe-Tor meldete „✓ Keine ungefüllten Platzhalter" über
 * einem inhaltsleeren Ablehnungsbescheid.
 *
 * Ohne Katalog bleibt die alte, rein längenbasierte Rechnung (Aufrufer ohne
 * Katalog-Zugriff).
 */
export function todoPunkte(
  gewaehlt: readonly WerkbankPunkt[], auswahl: Auswahl,
  katalog?: readonly TextbausteinRecord[], artefaktTyp: BescheidTyp = 'nf',
): string[] {
  const freigegeben = katalog
    ? new Set(freigegebeneBausteine(katalog, artefaktTyp).map(b => b.id))
    : null;
  const zaehlt = (ids: string[]): number =>
    (freigegeben ? ids.filter(id => freigegeben.has(id)) : ids).length;
  return gewaehlt.filter(p => zaehlt(auswahl[p.key] ?? []) === 0).map(p => p.key);
}

/** Ein Punkt als Kontext-Zeile für das LLM (Aspekt + Text + zugeordnete Bausteine). */
function punktZeile(p: WerkbankPunkt, bausteinIds: string[]): string {
  const aspekt = p.aspektId ? `[${p.aspektId} ${ASPEKT_NAME.get(p.aspektId) ?? ''}] ` : '';
  const bs = bausteinIds.length > 0 ? ` (Bausteine: ${bausteinIds.join(', ')})` : ' (kein Baustein zugeordnet)';
  return `- ${aspekt}${p.text}${bs}`;
}

/**
 * Baut aus den gewählten Punkten + der bestätigten Auswahl den `WerkbankAuftrag`:
 * die zugeordneten Bausteine (dedupliziert, nur freigegebene, nach Scope getrennt) +
 * der Punkt-Kontext + die Punkt-Keys für den Audit-Stempel. Rein.
 *
 * Ein zugeordneter Baustein, der (nicht mehr) freigegeben ist, fällt still weg — die
 * Werkbank arbeitet ausschliesslich mit freigegebenen Bausteinen.
 */
export function baueAuftrag(
  katalog: readonly TextbausteinRecord[], gewaehlt: readonly WerkbankPunkt[], auswahl: Auswahl,
  artefaktTyp: BescheidTyp = 'nf',
): WerkbankAuftrag {
  const freigegeben = new Map(freigegebeneBausteine(katalog, artefaktTyp).map(b => [b.id, b]));
  const verwendet = new Map<string, TextbausteinRecord>();
  const zeilen: string[] = [];
  // Punkte OHNE (typ-passenden) Baustein — sie tragen im Entwurf die zugesagte
  // TODO-Markierung, statt spurlos zu verschwinden (siehe mergeNfFuerTv).
  const offenePunkte: string[] = [];
  for (const p of gewaehlt) {
    const ids = (auswahl[p.key] ?? []).filter(id => freigegeben.has(id));
    for (const id of ids) verwendet.set(id, freigegeben.get(id)!);
    if (ids.length === 0) offenePunkte.push(p.text);
    zeilen.push(punktZeile(p, ids));
  }
  const alle = [...verwendet.values()];
  return {
    artefaktTyp,
    verbundBausteine: alle.filter(b => b.scope === 'verbund'),
    tvBausteine: alle.filter(b => b.scope !== 'verbund'),
    punktKontext: zeilen.join('\n'),
    punktKeys: gewaehlt.map(p => p.key),
    offenePunkte,
  };
}
