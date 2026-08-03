/**
 * Klartext zu einer Förder-Richtlinie (`FM_NUMMER` / `unterprogramm_id`).
 *
 * Die Nummern älterer Richtlinien kennt außerhalb der AB kaum jemand — „47"
 * sagt nichts, „ZIM FuE-Projekte 2019" schon. Diese eine Auflösung speist
 * deshalb überall: Bereichs-Chip, Auswahl-Panel, Trigger-Meldungen.
 *
 * Anders als {@link useUnterprogrammLabels} **programm-übergreifend**: der
 * Betrachtungsbereich spannt über alle CSV-Programme, und dieselbe FM-Nummer
 * darf nicht je nach geöffnetem Programm anders heißen.
 *
 * **Ehrlicher Fallback statt leerer Auflösung.** Fehlt die Bezeichnung — bei
 * Altprogrammen der Normalfall, und im pl-Build war zeitweise nur „DS · 137" zu
 * sehen —, steht dort „Programm 137 (ohne Bezeichnung)". Eine nackte Nummer
 * liest sich wie ein Anzeigefehler; ein leerer String wie ein fehlender Wert.
 */
import { useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { listProgramme, listUnterprogramme } from '@/core/services/csv';

/** Ein Lauf pro Sitzung reicht: Labels ändern sich nur per Kurator-Import. */
let cache: ReadonlyMap<string, string> | null = null;
let laufend: Promise<ReadonlyMap<string, string>> | null = null;

async function ladeAlle(idb: Parameters<typeof listProgramme>[0]): Promise<ReadonlyMap<string, string>> {
  if (cache) return cache;
  if (!laufend) {
    laufend = (async () => {
      const out = new Map<string, string>();
      for (const p of await listProgramme(idb)) {
        for (const up of await listUnterprogramme(idb, p.id)) {
          const code = typeof up.code === 'string' ? up.code.trim() : '';
          const name = typeof up.name === 'string' ? up.name.trim() : '';
          if (code && name && !out.has(code)) out.set(code, name);
        }
      }
      cache = out;
      return out;
    })();
  }
  return laufend;
}

/** Nur für Tests: den Modul-Cache leeren. */
export function resetRichtlinienLabelCache(): void {
  cache = null;
  laufend = null;
}

/**
 * Beschriftung einer Richtlinie. Rein — die Map reicht der Aufrufer herein.
 *
 * @param mitCode Hängt die Nummer an („ZIM FuE-Projekte 2025 (138)"). Für Listen
 *   sinnvoll, für Fließtext meist nicht.
 */
export function richtlinienLabel(
  code: string, labels: ReadonlyMap<string, string>, mitCode = false,
): string {
  const c = code.trim();
  if (!c) return 'ohne Programm';
  const name = labels.get(c);
  if (!name) return `Programm ${c} (ohne Bezeichnung)`;
  return mitCode ? `${name} (${c})` : name;
}

/** Code → Bezeichnung über alle Programme. Leer, solange der Load läuft. */
export function useRichtlinienLabels(): ReadonlyMap<string, string> {
  const storage = useStorage();
  const [map, setMap] = useState<ReadonlyMap<string, string>>(() => cache ?? new Map());

  useEffect(() => {
    if (cache) {
      setMap(cache);
      return;
    }
    let abgebrochen = false;
    void ladeAlle(storage.idb).then(m => {
      if (!abgebrochen) setMap(m);
    });
    return () => {
      abgebrochen = true;
    };
  }, [storage.idb]);

  return map;
}
