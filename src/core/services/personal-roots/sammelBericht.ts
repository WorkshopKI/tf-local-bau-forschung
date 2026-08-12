/**
 * Einsammeln über mehrere Wurzeln — je Wurzel ein Ausgang, keine Summe.
 *
 * Solange es EINE Wurzel gab, war „kein Handle → `return`" ehrlich: alles oder
 * nichts. Bei zweien sieht Teil-Einsammeln aus wie Erfolg — der Anwender liest
 * „4 eingesammelt" und erfährt nie, dass die zweite Gruppe gar nicht verbunden
 * war. Deshalb berichtet jede Sammel-Aktion je Wurzel:
 *
 *     PL-Ordner: 4 eingesammelt · Bearbeiter-Ordner: nicht verbunden
 *
 * Kein harter Gate: wer nur eine Wurzel verbunden hat, sammelt weiter ein und
 * SIEHT, dass etwas fehlt.
 *
 * `jeWurzel` ist bewusst KEIN generischer `collectOverRoots<T>`: es kennt weder
 * Arrays noch Result-Objekte und transportiert keine Nutzlast, nur eine Zahl.
 * Die Sammler bleiben unangetastet, die Schleife liegt beim Aufrufer — geteilt
 * wird nur, was sonst sechsmal leicht unterschiedlich nachgebaut würde:
 * Sequenzialität, Fehler-Isolierung je Wurzel und das Zustands-Mapping.
 *
 * **Streng sequenziell, nie `Promise.all`.** Die Feedback-Aufrufer schreiben in
 * ihrem Sammler dieselbe `feedback.json` (Read-Modify-Write, ohne Lock).
 * Parallel läsen zwei Wurzeln dieselbe Basis — der zweite Write verwürfe die
 * Items des ersten —, und zwei gleichzeitige `atomicWrite` auf denselben Pfad
 * teilen sich `.tmp`- und `.backup`-Namen.
 */

import type { UserFoldersRoot } from '@/core/services/infrastructure/smb-handle';

export type SammelAusgang =
  | { art: 'ok'; anzahl: number }
  | { art: 'nicht-verbunden' }
  | { art: 'kein-zugriff' }
  | { art: 'fehler'; meldung: string };

export interface SammelZeile {
  id: string;
  label: string;
  ausgang: SammelAusgang;
}

export type SammelBericht = SammelZeile[];

/** Eine Wurzel, von der feststeht, dass sie ein Handle hat. */
export type VerbundeneWurzel = UserFoldersRoot & { handle: FileSystemDirectoryHandle };

/**
 * Führt `lies` nacheinander für jede VERBUNDENE Wurzel aus und hält je Wurzel
 * einen Ausgang fest. Wirft nie: ein Fehler bleibt bei seiner Wurzel, die
 * nächste läuft weiter.
 *
 * `lies` liefert die Anzahl der gelesenen Einheiten. Die Nutzlast sammelt der
 * Aufrufer selbst ein (typisch: in ein Array pushen), damit er sie danach in
 * EINEM Schritt weiterverarbeiten kann — Pitfall #16/#20.
 */
export async function jeWurzel(
  roots: readonly UserFoldersRoot[],
  lies: (root: VerbundeneWurzel) => Promise<number>,
): Promise<SammelBericht> {
  const bericht: SammelBericht = [];
  for (const root of roots) {
    if (!root.handle) {
      bericht.push({ id: root.id, label: root.label, ausgang: { art: 'nicht-verbunden' } });
      continue;
    }
    try {
      const anzahl = await lies(root as VerbundeneWurzel);
      bericht.push({ id: root.id, label: root.label, ausgang: { art: 'ok', anzahl } });
    } catch (err) {
      bericht.push({
        id: root.id,
        label: root.label,
        ausgang: { art: 'fehler', meldung: (err as Error)?.message ?? String(err) },
      });
    }
  }
  return bericht;
}

/**
 * „PL-Ordner: 4 eingesammelt · Bearbeiter-Ordner: nicht verbunden".
 *
 * `0` wird ausgeschrieben statt weggelassen — „gelesen, nichts gefunden" ist
 * eine andere Aussage als „gar nicht gelesen".
 */
export function formatiereSammelBericht(
  bericht: SammelBericht,
  opts: { einheit?: string } = {},
): string {
  const einheit = opts.einheit ?? 'eingesammelt';
  return bericht
    .map(z => `${z.label}: ${beschreibe(z.ausgang, einheit)}`)
    .join(' · ');
}

/** Wurde überhaupt irgendwo gelesen? */
export function hatGelesen(bericht: SammelBericht): boolean {
  return bericht.some(z => z.ausgang.art === 'ok');
}

/** Summe über alle gelesenen Wurzeln (für Aufrufer, die eine Gesamtzahl brauchen). */
export function summeGelesen(bericht: SammelBericht): number {
  return bericht.reduce((n, z) => (z.ausgang.art === 'ok' ? n + z.ausgang.anzahl : n), 0);
}

function beschreibe(ausgang: SammelAusgang, einheit: string): string {
  switch (ausgang.art) {
    case 'ok': return `${ausgang.anzahl} ${einheit}`;
    case 'nicht-verbunden': return 'nicht verbunden';
    case 'kein-zugriff': return 'kein Zugriff';
    case 'fehler': return 'Fehler beim Lesen';
  }
}
