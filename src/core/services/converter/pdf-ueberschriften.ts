/**
 * Überschriften-Schätzung aus **Schriftgrößen** — die zweite Sprosse der
 * PDF-Leiter, für PDFs ohne Tag-Baum (`pdf-struktur.ts` ist die erste).
 *
 * Ein PDF ohne Tags weiß nicht, was eine Überschrift ist. Sichtbar ist sie
 * trotzdem: sie steht in einer größeren Schrift als der Fließtext. Gemessen an
 * den synthetischen Anträgen trennt das sauber (Fließtext 11, Überschrift 16,
 * Kopfzeile 10) — aber es ist eine SCHÄTZUNG und heißt im Bericht auch so.
 *
 * Zwei Leitplanken, damit die Schätzung nichts erfindet:
 *  - die Grundgröße ist die **zeichenstärkste** Größe, nicht die häufigste
 *    Zeile — sonst gewinnt eine dreizeilige Kopfzeile gegen den Fließtext;
 *  - findet die Skala mehr als `MAX_ANTEIL` aller Zeilen als Überschrift, ist
 *    das Signal unbrauchbar (z. B. durchgehend gemischte Größen) und die Skala
 *    bleibt LEER. Lieber keine Gliederung als eine falsche.
 *
 * REINE Funktionen, keine pdf.js-Abhängigkeit.
 */

/** Eine Textzeile mit ihrer größten Schriftgröße (PDF-Texteinheiten). */
export interface GroessenZeile {
  text: string;
  groesse: number;
}

/** Ergebnis der Skalen-Ermittlung; `stufen` ist absteigend sortiert (max. 3). */
export interface UeberschriftsSkala {
  /** Schriftgröße des Fließtextes. 0 = keine brauchbare Skala. */
  grundgroesse: number;
  /** Größen, die als Überschrift gelten — Index 0 → Ebene 1. */
  stufen: number[];
}

/** Ab welchem Faktor über der Grundgröße eine Zeile als Überschrift zählt. */
const FAKTOR = 1.08;
/** Längere Zeilen sind Fließtext, auch wenn sie groß gesetzt sind. */
const MAX_ZEICHEN = 140;
/** Mehr als dieser Anteil an Überschriften → Signal unbrauchbar. */
const MAX_ANTEIL = 0.25;
/** Mehr Ebenen macht Markdown hier nicht auf. */
const MAX_STUFEN = 3;

const LEERE_SKALA: UeberschriftsSkala = { grundgroesse: 0, stufen: [] };

/** Größen auf eine Nachkommastelle runden — sonst zersplittert 11.04 vs 11.0396. */
const norm = (g: number): number => Math.round(g * 10) / 10;

/** Sieht die Zeile überhaupt wie eine Überschrift aus (Form, nicht Größe)? */
function formPasst(text: string): boolean {
  const t = text.trim();
  if (t.length === 0 || t.length > MAX_ZEICHEN) return false;
  if (!/\p{L}/u.test(t)) return false;      // reine Zahlen/Striche
  if (/[.;,]$/.test(t)) return false;       // Satzende → Fließtext
  return true;
}

/**
 * Ermittelt Grundgröße und Überschriften-Stufen über ALLE Zeilen eines
 * Dokuments (nicht je Seite — eine Seite ohne Überschrift hätte sonst eine
 * eigene, falsche Skala).
 */
export function ermittleUeberschriftsSkala(zeilen: GroessenZeile[]): UeberschriftsSkala {
  const zeichenJeGroesse = new Map<number, number>();
  for (const z of zeilen) {
    if (z.groesse <= 0) continue;
    const g = norm(z.groesse);
    zeichenJeGroesse.set(g, (zeichenJeGroesse.get(g) ?? 0) + z.text.trim().length);
  }
  if (zeichenJeGroesse.size === 0) return LEERE_SKALA;

  let grundgroesse = 0;
  let meiste = -1;
  for (const [g, zeichen] of zeichenJeGroesse) {
    if (zeichen > meiste) { meiste = zeichen; grundgroesse = g; }
  }
  if (grundgroesse <= 0) return LEERE_SKALA;

  const kandidaten = [...zeichenJeGroesse.keys()]
    .filter(g => g >= grundgroesse * FAKTOR)
    .sort((a, b) => b - a)
    .slice(0, MAX_STUFEN);
  if (kandidaten.length === 0) return LEERE_SKALA;

  const skala: UeberschriftsSkala = { grundgroesse, stufen: kandidaten };
  const treffer = zeilen.filter(z => ueberschriftStufe(z, skala) !== null).length;
  if (treffer === 0) return LEERE_SKALA;
  if (treffer > zeilen.length * MAX_ANTEIL) return LEERE_SKALA;
  return skala;
}

/** Überschriften-Ebene einer Zeile (1–3) oder `null` für Fließtext. */
export function ueberschriftStufe(zeile: GroessenZeile, skala: UeberschriftsSkala): number | null {
  if (skala.stufen.length === 0 || zeile.groesse <= 0) return null;
  if (!formPasst(zeile.text)) return null;
  const g = norm(zeile.groesse);
  if (g < skala.grundgroesse * FAKTOR) return null;
  // Nächstgrößere deklarierte Stufe; alles darüber teilt sich Ebene 1.
  for (let i = 0; i < skala.stufen.length; i++) {
    if (g >= skala.stufen[i]!) return i + 1;
  }
  return skala.stufen.length;
}
