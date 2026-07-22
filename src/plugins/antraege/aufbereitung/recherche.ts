/**
 * Recherche-Hilfen der Antrag-Aufbereitung (v2.221): leitet aus den bereits vom
 * Steckbrief-Baustein extrahierten Angaben (Zielmärkte, FuE-Gegenstand, Kern-Zielwert)
 * + den Stammdaten **fertige Suchanfragen zum Kopieren** ab — für die externe Recherche
 * des Prüfers (Marktzahlen, Wettbewerb, Stand der Technik). Rein deterministisch (KEIN
 * neuer LLM-Lauf), keine Live-Links (bleibt `file://`-/DSGVO-konform). Reine Funktion
 * (Node-testbar); die App kopiert die Texte nur in die Zwischenablage.
 */
import type { SteckbriefDaten } from './steckbrief';

/** Eine vorbereitete Suchanfrage (Copy-Text). */
export interface RechercheAnfrage {
  text: string;
}

/** Eine Themengruppe von Suchanfragen. */
export interface RechercheGruppe {
  id: string;
  titel: string;
  anfragen: RechercheAnfrage[];
}

/** Minimale Stammdaten-Sicht (nur was die Recherche braucht). */
export interface RechercheStammdaten {
  antragsteller: string | null;
}

/** Normalisiert Whitespace (geteilt mit dem Stichwort-Sanitizer). */
export const clean = (s: string): string => s.trim().replace(/\s+/g, ' ');

/** Kürzt einen (Satz-)Text auf ≤ n Wörter — Suchanfragen wollen Kernbegriffe, keine Sätze. */
export function kurz(s: string, n = 10): string {
  const w = clean(s).split(' ').filter(Boolean);
  return w.slice(0, n).join(' ');
}

/** Verwirft leere + doppelte Anfragen (case-insensitiv), Reihenfolge stabil. */
function dedup(anfragen: RechercheAnfrage[]): RechercheAnfrage[] {
  const seen = new Set<string>();
  const out: RechercheAnfrage[] = [];
  for (const a of anfragen) {
    const t = clean(a.text);
    const k = t.toLowerCase();
    if (t && !seen.has(k)) { seen.add(k); out.push({ text: t }); }
  }
  return out;
}

/**
 * Baut die Recherche-Gruppen aus den Steckbrief-Daten + Stammdaten. Fehlt eine Quelle,
 * entfällt die zugehörige Gruppe/Anfrage (nie geraten, kein Platzhalter). Leerer
 * Steckbrief → keine Gruppen (das UI zeigt dann den Leerzustand).
 */
export function baueRechercheAnfragen(
  steckbrief: SteckbriefDaten | null,
  stammdaten: RechercheStammdaten,
): RechercheGruppe[] {
  const gruppen: RechercheGruppe[] = [];
  const gegenstaende = (steckbrief?.fueGegenstand ?? []).map(g => kurz(g.text)).filter(Boolean).slice(0, 2);
  const antragsteller = stammdaten.antragsteller ? clean(stammdaten.antragsteller) : null;

  // Marktzahlen — je Zielmarkt zwei Startanfragen.
  const maerkte = [...new Set((steckbrief?.zielmaerkte ?? []).map(z => clean(z.markt)).filter(Boolean))];
  const markt = dedup(maerkte.flatMap(m => [
    { text: `Marktvolumen ${m}` },
    { text: `Marktwachstum ${m} Prognose` },
  ]));
  if (markt.length) gruppen.push({ id: 'markt', titel: 'Marktzahlen', anfragen: markt });

  // Wettbewerb — Antragsteller + FuE-Gegenstand.
  const wettbewerb = dedup([
    ...(antragsteller ? [{ text: `${antragsteller} Wettbewerber` }] : []),
    ...gegenstaende.map(g => ({ text: `${g} Anbieter Vergleich` })),
  ]);
  if (wettbewerb.length) gruppen.push({ id: 'wettbewerb', titel: 'Wettbewerb', anfragen: wettbewerb });

  // Stand der Technik — FuE-Gegenstand + Kern-Zielwert.
  const sdt = dedup([
    ...gegenstaende.map(g => ({ text: `Stand der Technik ${g}` })),
    ...(steckbrief?.kernZielwert ? [{ text: `${kurz(steckbrief.kernZielwert.text)} Benchmark` }] : []),
  ]);
  if (sdt.length) gruppen.push({ id: 'sdt', titel: 'Stand der Technik', anfragen: sdt });

  return gruppen;
}

/** Stammdaten für das (bewusst identifizierende) Marktzugang-Template. */
export interface MarktzugangStammdaten {
  firmenname: string | null;
  website?: string | null;
}

/**
 * Baut den (bewusst IDENTIFIZIERENDEN) Marktzugang-Recherche-Text — rein deterministisch,
 * KEIN LLM, ausschließlich aus Stammdaten (Firmenname + ggf. Website), NIE VB-Inhalt.
 * `null`, wenn kein Firmenname vorliegt (dann bietet das UI den Abschnitt nicht an).
 * Getrennt vom anonymen DR-Prompt (kein kombinierter Prompt).
 */
export function baueMarktzugangText(s: MarktzugangStammdaten): string | null {
  const firma = s.firmenname?.trim();
  if (!firma) return null;
  const zeilen = [
    `Recherchiere den Marktzugang des Unternehmens „${firma}".`,
    '',
    'Bitte analysiere:',
    '- In welchen Märkten und Branchen ist das Unternehmen aktiv?',
    '- Über welche Vertriebskanäle und Partnerschaften erreicht es seine Kunden?',
    '- Wer sind typische Abnehmer oder Referenzkunden?',
    '- Wie positioniert es sich gegenüber Wettbewerbern?',
  ];
  const web = s.website?.trim();
  if (web) zeilen.push(`- Website als Ausgangspunkt: ${web}`);
  return zeilen.join('\n');
}
