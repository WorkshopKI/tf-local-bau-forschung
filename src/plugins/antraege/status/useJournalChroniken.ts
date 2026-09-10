/**
 * Die Journal-Chroniken mehrerer Anträge — **ein** Lesevorgang je Seite.
 *
 * `chronikFuerAntraege` liest `stand.json` bei jedem Aufruf neu; die Datei ist
 * bewusst nicht gecacht (nur die Monatsdateien sind es, `journal/lesen.ts`) und
 * wiegt im Bestand über 5 MB. Auf der Verbund-Detailseite fragen inzwischen zwei
 * Stellen nach denselben Chroniken — die Sektion „Historie" und die Chronik im
 * Verlauf. Jede mit eigenem `useEffect` hieße: dieselbe Datei zweimal über SMB.
 *
 * Deshalb dieser Hook mit modul-lokalem Cache. Er hält **das Versprechen**, nicht
 * nur das Ergebnis: zwei Komponenten, die im selben Tick mounten, teilen sich
 * einen Lauf statt zwei anzustoßen.
 *
 * **Entwertet wird über den Datenstand des Antrags-Stores** (`lastLoadedAt`).
 * `refreshAntraegeStoreAfterSync` bumpt ihn nach jedem Import und Snapshot-Sync
 * — genau die Ereignisse, nach denen das Journal gewachsen sein kann. Dieselbe
 * Kopplung nutzt `useVerbundDetailData` aus demselben Grund. Ein Cache ohne
 * dieses Glied zeigte nach dem Nacht-Import weiter den Stand von gestern.
 *
 * **`null` heißt beim ersten Versuch noch nichts** (Bug-Klasse 1,
 * „Cold-Start-Store-Refresh"). `leseSidecar` wirft „kein Share-Handle" und „keine
 * Datei" auf dasselbe `null`; wer beim Kaltstart eine Antragsseite per Deep-Link
 * öffnet, liest, bevor `getDatenShareHandle` aufgelöst hat — und die Anzeige
 * behauptete dann „auf diesem Daten-Share wird kein Journal geführt", obwohl
 * eines läuft. Gemessen: nach einem Reload auf `#/antraege/verbund/…` trat genau
 * das ein. Deshalb wird ein `null` bis zu {@link VERSUCHE_MAX}-mal
 * nachgefasst, und **`laden` bleibt dabei wahr** — eine falsche Aussage ist
 * schlechter als eine späte. Erst wenn alle Versuche `null` liefern, gilt es als
 * Antwort. Der Defekt ist älter als dieser Hook; die Historie-Sektion trug ihn
 * seit v4.13 und heilt hier mit.
 */
import { useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { chronikFuerAntraege, type AntragsChronikMitId } from '@/core/status';
import { useAntraegeStore } from '../store';

export interface JournalChroniken {
  /** `true`, solange der erste Lauf läuft. */
  laden: boolean;
  /**
   * Die Chroniken in der Reihenfolge der angefragten Aktenzeichen.
   * `null` = auf diesem Share wird (noch) **kein** Journal geführt — eine
   * andere Aussage als „nichts geändert" und getrennt zu benennen.
   */
  chroniken: AntragsChronikMitId[] | null;
  /** Nullpunkt des Journals; `null` = keines vorhanden. Gehört an jede Anzeige. */
  journalAb: string | null;
  /**
   * `false`, wenn KEINER der Anträge im Journal geführt wird — der Vorgang stand
   * beim letzten Nachtlauf außerhalb des Betrachtungsbereichs (§12.4). Bei
   * fehlendem Journal `false`; die Anzeige unterscheidet über `chroniken`.
   */
  gefuehrt: boolean;
}

const LEER: JournalChroniken = {
  laden: false, chroniken: null, journalAb: null, gefuehrt: false,
};

/** Ergebnis-/In-Flight-Cache. Klein gedeckelt — eine Seite fragt eine Menge. */
const CACHE = new Map<string, Promise<AntragsChronikMitId[] | null>>();
const CACHE_MAX = 8;

/**
 * Wie oft ein `null` nachgefasst wird, bevor es als Antwort gilt, und mit
 * welchem Abstand. Der erste Versuch läuft sofort.
 *
 * Vier Versuche über gut zehn Sekunden: der Kaltstart lädt 14 225 Anträge und
 * braucht dafür gemessen 2,5–5 s je `loadAll`-Durchgang. Kürzer gefasst liefe
 * die Kette ab, bevor der Share-Handle steht; länger hielte eine Seite ohne
 * Journal unnötig lange in „Lädt …".
 */
export const VERSUCHE_MAX = 4;
export const ABSTAND_MS: readonly number[] = [0, 1_000, 3_000, 7_000];

/**
 * Ist dieses Ergebnis eine **Antwort** — oder nur ein Zwischenstand?
 *
 * Rein und exportiert, weil hier die eigentliche Entscheidung liegt: ein `null`
 * bedeutet „Share nicht erreicht ODER kein Journal", und die beiden sind erst
 * nach dem letzten Versuch nicht mehr zu trennen. Ein Ergebnis mit Inhalt gilt
 * dagegen sofort — auch eine leere Liste, denn die kommt nur zustande, wenn der
 * Stand gelesen wurde.
 */
export function istAntwort(
  chroniken: AntragsChronikMitId[] | null, versuch: number,
): boolean {
  return chroniken !== null || versuch >= VERSUCHE_MAX - 1;
}

function schluessel(ids: readonly string[], stichtag: string, stand: number): string {
  return `${stand}|${stichtag}|${[...ids].sort((a, b) => a.localeCompare(b)).join('|')}`;
}

/** Nur für Tests: den Sitzungs-Cache leeren. */
export function leereJournalChronikCache(): void {
  CACHE.clear();
}

/**
 * Passt ein Cache-Schlüssel zu diesen Anträgen und diesem Datenstand — gleich,
 * mit welchem Stichtag er gezogen wurde?
 *
 * Der Stichtag bestimmt nur, bis zu welchem Monat gelesen wird; zwei Anzeigen
 * derselben Sitzung lesen denselben Stand. Rein, damit die Regel testbar ist.
 */
export function schluesselPasst(key: string, aktenzeichen: readonly string[], datenStand: number): boolean {
  const teile = key.split('|');
  const ids = [...aktenzeichen].sort((a, b) => a.localeCompare(b)).join('|');
  return teile[0] === String(datenStand) && teile.slice(2).join('|') === ids;
}

/**
 * Ein Lauf, den eine Anzeige dieser Seite für genau diese Anträge schon
 * angestoßen hat — **ohne** eigenen Lesevorgang.
 *
 * Für den Assistenten: er soll das Journal eines Vorgangs kennen, wenn die
 * Detailseite es ohnehin geladen hat, aber `stand.json` (über 5 MB, ungecacht)
 * nie selbst ein zweites Mal über SMB ziehen. `null` = niemand hat es geladen.
 */
export function laufendeJournalChroniken(
  aktenzeichen: readonly string[], datenStand: number,
): Promise<AntragsChronikMitId[] | null> | null {
  for (const [key, lauf] of CACHE) {
    if (schluesselPasst(key, aktenzeichen, datenStand)) return lauf;
  }
  return null;
}

export function useJournalChroniken(
  aktenzeichen: readonly string[], stichtag: string,
): JournalChroniken {
  const idb = useStorage().idb;
  const datenStand = useAntraegeStore(s => s.lastLoadedAt);
  // `laden` startet WAHR, solange etwas zu laden ist: sonst zeigte der erste
  // Render `chroniken === null` und damit für einen Frame „kein Journal auf
  // diesem Share" — eine Aussage, die dann meist widerrufen wird.
  const [stand, setStand] = useState<JournalChroniken>(
    () => (aktenzeichen.length > 0 ? { ...LEER, laden: true } : LEER),
  );
  // Als Zeichenkette in die Deps: ein frisch gemapptes Array wäre bei jedem
  // Render eine neue Referenz und triebe den Effekt in eine Schleife.
  const ids = aktenzeichen.join('|');

  useEffect(() => {
    let abgebrochen = false;
    const liste = ids === '' ? [] : ids.split('|');
    if (liste.length === 0) {
      setStand(LEER);
      return;
    }
    setStand(s => ({ ...s, laden: true }));

    const key = schluessel(liste, stichtag, datenStand);

    const einLauf = (): Promise<AntragsChronikMitId[] | null> => {
      const da = CACHE.get(key);
      if (da) return da;
      // Ein Fehlschlag darf sich nicht einbrennen: `catch` gibt `null` zurück,
      // der Eintrag fliegt danach aus dem Cache, damit der nächste Versuch —
      // und der nächste Mount — es erneut probiert.
      const lauf = chronikFuerAntraege(idb, liste, stichtag).catch(() => null);
      if (CACHE.size >= CACHE_MAX) {
        const aeltester = CACHE.keys().next().value;
        if (aeltester !== undefined) CACHE.delete(aeltester);
      }
      CACHE.set(key, lauf);
      void lauf.then(w => { if (w === null) CACHE.delete(key); });
      return lauf;
    };

    void (async () => {
      for (let versuch = 0; versuch < VERSUCHE_MAX; versuch++) {
        const pause = ABSTAND_MS[versuch] ?? 0;
        if (pause > 0) await new Promise(r => setTimeout(r, pause));
        if (abgebrochen) return;
        const chroniken = await einLauf();
        if (abgebrochen) return;
        if (!istAntwort(chroniken, versuch)) continue;
        setStand({
          laden: false,
          chroniken,
          journalAb: chroniken?.[0]?.journalAb ?? null,
          gefuehrt: chroniken?.some(c => c.gefuehrt) ?? false,
        });
        return;
      }
    })();

    return () => { abgebrochen = true; };
  }, [idb, ids, stichtag, datenStand]);

  return stand;
}
