/**
 * Word-Import-Heuristik für den Textbaustein-Katalog.
 *
 * Word ist Einfuhrquelle, nicht Ablageort: eine `.docx` wird über **mammoth**
 * (bereits im Bundle, `converter/index.ts`) zu HTML, hier zu Block-Kandidaten
 * zerlegt und dann MIT dem Nutzer kategorisiert. Diese Datei ist die reine, testbare
 * Zerlege-Logik; der mammoth-Aufruf selbst ist der dünne Mantel `mammothZuHtml`.
 *
 * **Verbatim-Regel (Pitfall #34):** der extrahierte Text wird NIE geglättet, normalisiert
 * oder korrigiert — nur Klartext aus dem HTML gezogen (Formatierung verworfen, Wortlaut
 * erhalten). Auffälligkeiten (verdächtige Sonderzeichen) werden ausschliesslich GEMELDET.
 */
import mammoth from 'mammoth';
import { extractPlatzhalter, type BausteinArtefaktTyp, type NfScope } from '@/core/services/skills';
import { scopeAusId } from './textbausteinKatalogOps';

/** Ein aus dem Word-HTML gelesener Roh-Block (eine Überschrift + Folgeabsätze). */
export interface RohBlock {
  /** Überschriften-Text (Kandidat für ID/Thema). `null` = Absätze vor der ersten Überschrift. */
  ueberschrift: string | null;
  /** Absatz-/Listen-Texte in Original-Reihenfolge. */
  absaetze: string[];
}

/** Ein vorbelegter Import-Kandidat, den der Nutzer prüft und übernimmt. */
export interface KandidatEntwurf {
  /** Aus einem führenden ID-Token der Überschrift, sonst leer (Nutzer füllt). */
  id: string;
  thema: string;
  artefaktTyp: BausteinArtefaktTyp;
  scope?: NfScope;
  aspekte: string[];
  stichworte: string[];
  /** WORTGETREUER Klartext (Absätze mit Leerzeile getrennt). READ-ONLY im Editor. */
  text: string;
  /** Hinweise auf Auffälligkeiten — nie eine Korrektur, nur eine Meldung. */
  warnungen: string[];
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
};

/** Dekodiert die von mammoth benutzten HTML-Entities. Rein. */
function decodeEntities(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, m => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

/** Entfernt Inline-Tags, dekodiert Entities, trimmt. Rein. */
function tagFreierText(inner: string): string {
  return decodeEntities(inner.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

/**
 * Zerlegt mammoth-HTML in Blöcke: jede Überschrift (`h1`–`h6`) startet einen neuen
 * Block, `p`/`li` dazwischen sind seine Absätze. Absätze vor der ersten Überschrift
 * bilden einen führerlosen Block (`ueberschrift: null`) — auch das ist ein Kandidat.
 *
 * mammoth liefert flaches, wohlgeformtes HTML (keine block-in-block-Verschachtelung),
 * deshalb genügt ein einfacher Block-Scan. Rein.
 */
export function htmlZuBloecke(html: string): RohBlock[] {
  const bloecke: RohBlock[] = [];
  let aktuell: RohBlock | null = null;

  const push = (): void => {
    if (aktuell && (aktuell.ueberschrift !== null || aktuell.absaetze.length > 0)) bloecke.push(aktuell);
  };

  for (const m of html.matchAll(/<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const tag = m[1]!.toLowerCase();
    const text = tagFreierText(m[2]!);
    if (!text) continue;
    if (tag.startsWith('h')) {
      push();
      aktuell = { ueberschrift: text, absaetze: [] };
    } else {
      if (!aktuell) aktuell = { ueberschrift: null, absaetze: [] };
      aktuell.absaetze.push(text);
    }
  }
  push();
  return bloecke;
}

/** Führendes ID-Token einer Überschrift: `G1.1`, `T2.3.7`, `RNE-A2`, `ABL-C1`. */
const ID_TOKEN = /^([A-Z]{1,4}[-.]?\d+(?:[.-]\w+)*)\s*[)\].:–—-]?\s+(.*)$/;

/** Ersetzungszeichen + Steuerzeichen (ohne Tab/Zeilenumbruch) — Extraktions-Verdacht. */
const VERDAECHTIG = /[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

/**
 * Macht aus einem Roh-Block einen vorbelegten Kandidaten. Trägt die Überschrift ein
 * führendes ID-Token (`G1.1 …`), wird es als `id` abgespalten und der Rest zum `thema`;
 * sonst bleibt `id` leer und die ganze Überschrift wird zum `thema`. Scope wird bei NF
 * aus der ID abgeleitet. Rein.
 */
export function bausteinKandidatAus(block: RohBlock, defaultTyp: BausteinArtefaktTyp): KandidatEntwurf {
  const text = block.absaetze.join('\n\n');
  const warnungen: string[] = [];
  if (block.ueberschrift === null) warnungen.push('Kein Überschrift-Block — ID und Thema bitte selbst vergeben.');
  if (block.absaetze.length === 0) warnungen.push('Keine Textabsätze erkannt — der Baustein-Text ist leer.');
  if (VERDAECHTIG.test(text) || (block.ueberschrift && VERDAECHTIG.test(block.ueberschrift))) {
    warnungen.push('Verdächtige Sonderzeichen im Text — bitte gegen das Original prüfen (Text bleibt unverändert).');
  }

  let id = '';
  let thema = block.ueberschrift ?? '';
  if (block.ueberschrift) {
    const treffer = ID_TOKEN.exec(block.ueberschrift);
    if (treffer) {
      id = treffer[1]!;
      thema = treffer[2]!.trim();
    }
  }

  const scope = defaultTyp === 'nf' && id ? scopeAusId(id) : undefined;
  return {
    id,
    thema,
    artefaktTyp: defaultTyp,
    ...(scope ? { scope } : {}),
    aspekte: [],
    stichworte: [],
    text,
    warnungen,
  };
}

/** Zerlegt Word-HTML direkt in Kandidaten (Convenience für die UI). Rein. */
export function bausteinKandidaten(html: string, defaultTyp: BausteinArtefaktTyp): KandidatEntwurf[] {
  return htmlZuBloecke(html).map(b => bausteinKandidatAus(b, defaultTyp));
}

/** Vorschau der abgeleiteten Platzhalter — dieselbe Ableitung wie beim Speichern. */
export function platzhalterVorschau(text: string): ReturnType<typeof extractPlatzhalter> {
  return extractPlatzhalter(text);
}

/**
 * `.docx`-ArrayBuffer → HTML (mammoth). Dünner Mantel; die Zerlegung läuft danach über
 * die reinen Funktionen oben. Wirft, wenn mammoth die Datei nicht lesen kann.
 */
export async function mammothZuHtml(arrayBuffer: ArrayBuffer): Promise<{ html: string; warnungen: string[] }> {
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return { html: result.value, warnungen: result.messages.map(m => m.message) };
}
