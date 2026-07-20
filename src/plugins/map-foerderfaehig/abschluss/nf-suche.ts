/**
 * Suche in den kuratierten Nachforderungs-Bausteinen.
 *
 * Die Baustein-Registry hat keine Suchfunktion — nur Scope-Filter und
 * ID-Lookup. Diese Datei ergänzt eine reine Volltextsuche, ohne die Registry
 * anzufassen: sie wird ausschliesslich **gelesen**.
 *
 * Pitfall #34 gilt unverändert: die Baustein-Texte werden wortgetreu verwendet.
 * Diese Suche wählt aus, sie formuliert nicht um und füllt keine Platzhalter.
 */
import { NF_BAUSTEINE, type NfBaustein, type NfScope } from '@/core/services/skills';

export interface NfTreffer {
  baustein: NfBaustein;
  /** Trefferwert, höher ist besser. */
  punkte: number;
  /** Suchbegriffe, die angeschlagen haben — macht den Vorschlag begründbar. */
  treffer: string[];
}

/** Gewicht eines Treffers im Thema gegenüber einem Treffer im Fliesstext. */
const GEWICHT_THEMA = 3;
const GEWICHT_TEXT = 1;

/** Wortstämme, die in fast jedem Baustein vorkommen und nichts unterscheiden. */
const STOPPWOERTER = new Set([
  'bitte', 'ihre', 'ihrer', 'ihren', 'sich', 'dass', 'oder', 'und', 'der', 'die', 'das',
  'den', 'dem', 'des', 'ein', 'eine', 'einer', 'einen', 'nicht', 'sind', 'ist', 'werden',
  'wird', 'sie', 'wie', 'bei', 'mit', 'für', 'auf', 'aus', 'von', 'zum', 'zur', 'als',
  'auch', 'noch', 'nur', 'sowie', 'beschreiben', 'erläutern', 'geplante', 'geplanten',
]);

/** Zerlegt einen Text in normalisierte Suchwörter. Rein. */
export function zerlegeBegriffe(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .split(/[^a-z0-9]+/)
    .filter(w => w.length >= 4 && !STOPPWOERTER.has(w));
}

function normalisiere(text: string): string {
  return text.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
}

/**
 * Sucht passende Bausteine zu einer Liste von Begriffen.
 *
 * Bewusst schlicht: ein Wortstamm-Vergleich, kein Ranking-Modell. Der Vorschlag
 * muss nachvollziehbar bleiben — `treffer` nennt die Wörter, die angeschlagen
 * haben, damit erkennbar ist, warum ein Baustein vorgeschlagen wird. Rein.
 */
export function sucheNfBausteine(
  begriffe: readonly string[], scope: NfScope = 'tv', maxTreffer = 3,
): NfTreffer[] {
  const gesucht = [...new Set(begriffe.flatMap(zerlegeBegriffe))];
  if (gesucht.length === 0) return [];

  const kandidaten = NF_BAUSTEINE.filter(b => b.scope === scope);

  return kandidaten
    .map(baustein => {
      const thema = normalisiere(baustein.thema);
      const text = normalisiere(baustein.text);
      const treffer: string[] = [];
      let punkte = 0;

      for (const wort of gesucht) {
        if (thema.includes(wort)) { punkte += GEWICHT_THEMA; treffer.push(wort); }
        else if (text.includes(wort)) { punkte += GEWICHT_TEXT; treffer.push(wort); }
      }

      return { baustein, punkte, treffer };
    })
    .filter(t => t.punkte > 0)
    .sort((a, b) => b.punkte - a.punkte || a.baustein.id.localeCompare(b.baustein.id))
    .slice(0, maxTreffer);
}
