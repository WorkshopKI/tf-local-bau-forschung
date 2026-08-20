/**
 * NF-Service (Artefakt-Engine) — reine Helfer für den Nachforderungs-Durchstich:
 * Katalog-Formatierung (Slot-Input), administrative QS, Verbund-Merge (G-Bausteine
 * EINMAL am Verbund gefüllt + in JEDE TV-NF) und der E-Mail-Entwurf je TV.
 *
 * Bewusst LLM-frei + ohne React (testbar). Die Generierung selbst läuft über den
 * Skill-Runner (`useNachforderungen`); diese Funktionen tragen den Rest.
 */
import { SEED_NF_REGELN, runRegelChecks, type CheckResult } from '@/core/services/skills';
import { buildMailtoUrl } from '@/plugins/auslastung/services/tib-mail';

/** Überschriften des Verbund-/TV-Blocks in einer zusammengesetzten TV-NF. */
export const VERBUND_BLOCK_TITEL = 'Fragen, die das Gesamtvorhaben betreffen';
export const TV_BLOCK_TITEL = 'Fragen zum Teilvorhaben';

/**
 * Was ein Baustein mitbringen muss, um in den Slot zu passen — strukturell statt an
 * einen Typ gebunden, damit Seed-Bausteine und Katalog-Records dieselbe Formatierung
 * durchlaufen (der Slot-Input bleibt dadurch byte-identisch zur Zeit vor dem Katalog).
 */
export interface KatalogEintrag {
  id: string;
  thema: string;
  kategorie: string;
  text: string;
}

/**
 * Formatiert die übergebenen Bausteine als Slot-Input für `{{nfBausteine}}`. Pro
 * Baustein: ID + Thema + Kategorie + wortgetreuer Text. Die Reihenfolge bleibt
 * erhalten (Katalog-Reihenfolge).
 */
export function formatBausteinKatalog(bausteine: readonly KatalogEintrag[]): string {
  return bausteine
    .map(b => `### ${b.id} — ${b.thema} (${b.kategorie})\n${b.text}`)
    .join('\n\n');
}

/**
 * Administrative + textliche NF-QS über den finalen Text (deterministisch). Das
 * harte Tor: bleibt ein ungefüllter Platzhalter, liefert `nf_keine_platzhalter_reste`
 * einen Fehler — der Lauf ist NICHT freigabereif. Der fachliche Check (Baustein-
 * Passung) ist LLM-QS und hier bewusst nicht enthalten.
 */
export function pruefeNf(finalerText: string): CheckResult[] {
  return runRegelChecks(finalerText, SEED_NF_REGELN);
}

/**
 * True, wenn der Text das administrative Tor passiert (kein `fehler`-Check).
 *
 * **Ein leerer Text ist nie freigabereif** (v4.124): das Tor prüfte nur die
 * Abwesenheit von Fehlern, nie die Anwesenheit von Text — `extractPlatzhalter('')`
 * ist leer, `verbotenes_muster` greift auf Leertext nicht. War für keinen
 * gewählten Punkt ein Baustein bestätigt, stand die Karte mit „— kein Text —"
 * und dem grünen Siegel „bereit zur Freigabe" da, der Word-Export war aktiv und
 * der `mailto:`-Entwurf trug Anschreiben plus Grußformel mit leerer Mitte.
 */
export function nfFreigabereif(finalerText: string): boolean {
  if (finalerText.trim().length === 0) return false;
  return pruefeNf(finalerText).every(c => c.level !== 'fehler');
}

/**
 * Validiert vom LLM gewählte Baustein-IDs gegen die Menge der bekannten IDs. Die
 * Menge kommt vom Aufrufer (kuratierter Katalog), damit hier keine zweite Quelle
 * darüber entsteht, welche Bausteine es gibt.
 */
export function gueltigeBausteinIds(
  ids: readonly string[], bekannteIds: ReadonlySet<string>,
): { gueltig: string[]; unbekannt: string[] } {
  const gueltig: string[] = [];
  const unbekannt: string[] = [];
  for (const id of ids) (bekannteIds.has(id) ? gueltig : unbekannt).push(id);
  return { gueltig, unbekannt };
}

/**
 * Setzt die NF eines Teilvorhabens zusammen: der **identische** Verbund-Block
 * (G-Bausteine, einmal am Verbund-Kontext gefüllt) + der TV-spezifische Block
 * (T-Bausteine). Leere Blöcke werden ausgelassen. Der Verbund-Block ist für jede
 * TV-NF wortgleich (gleicher `gBlock`-Input → gleicher Abschnitt).
 */
export function mergeNfFuerTv(gBlock: string, tvBlock: string, offenePunkte: readonly string[] = []): string {
  const teile: string[] = [];
  if (gBlock.trim()) teile.push(`## ${VERBUND_BLOCK_TITEL}\n\n${gBlock.trim()}`);
  if (tvBlock.trim()) teile.push(`## ${TV_BLOCK_TITEL}\n\n${tvBlock.trim()}`);
  // Punkte ohne Baustein bekommen die Markierung, die die Werkbank zusagt
  // („der Entwurf trägt dort eine ‚[TODO Baustein zuordnen]'-Markierung"). Bis
  // v4.122 gab es sie im Generierungspfad nicht: der Punkt landete nur als
  // Kontextzeile im Prompt, und das Template verbietet dem Modell ausdrücklich
  // jeden eigenen Satz — die Lücke war im Entwurf nicht mehr auffindbar, während
  // die Karte „bereit zur Freigabe" meldete.
  const offen = offenePunkte.map(t => t.trim()).filter(Boolean);
  if (offen.length > 0) {
    teile.push(`## ${TODO_BLOCK_TITEL}\n\n`
      + offen.map(t => `- ${TODO_MARKE} ${t}`).join('\n'));
  }
  return teile.join('\n\n');
}

/** Überschrift des Blocks mit den noch unversorgten Punkten. */
export const TODO_BLOCK_TITEL = 'Noch ohne Textbaustein';
/** Die zugesagte Markierung — ein Literal, damit Zusage und Entwurf dasselbe Wort tragen. */
export const TODO_MARKE = '[TODO Baustein zuordnen]';

/** Betreff-/Body-Vorlage des NF-E-Mail-Entwurfs (Platzhalter: {fkz}, {nachforderungen}). */
export const NF_EMAIL_BETREFF = 'Nachforderungen zu Ihrem ZIM-Antrag {fkz}';
export const NF_EMAIL_VORLAGE =
  'Sehr geehrte Damen und Herren,\n\n'
  + 'ausgehend von den Anforderungen der Richtlinie, insbesondere hinsichtlich Antragsberechtigung, '
  + 'Gegenstand der Förderung, Zuwendungsvoraussetzungen sowie Art, Umfang und Höhe der Förderung, '
  + 'mussten wir bei der Bearbeitung Ihres Antrags feststellen, dass wir weitere Informationen bzw. '
  + 'Unterlagen zur Beurteilung Ihres Vorhabens benötigen.\n\n'
  + '{nachforderungen}\n\n'
  + 'Mit freundlichen Grüßen';

/**
 * Baut den `mailto:`-Entwurf einer TV-NF. `email` leer → mailto ohne Empfänger
 * (Adresse als editierbarer Platzhalter, Mensch trägt sie ein). Versendet wird
 * NICHTS automatisch — der Mensch öffnet/prüft/sendet (Entwurf ≠ Entscheidung).
 */
export function buildNfMailto(opts: { email?: string; fkz: string; nachforderungen: string }): string {
  return buildMailtoUrl(opts.email ?? '', NF_EMAIL_BETREFF, NF_EMAIL_VORLAGE, {
    fkz: opts.fkz,
    nachforderungen: opts.nachforderungen,
  });
}
