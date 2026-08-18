/**
 * Die **Zahlen aus dem Wortlaut-Korpus**: der Probelauf, seine Vorschlagszahl
 * und der Wertevorrat für die Vervollständigung.
 *
 * Nur die WORTLAUT-Stufe, synchron und ~10–30 ms je Lauf. Orama blockiert je
 * Lauf 150–300 ms, die Vektorstufe bräuchte für jede Variante ein neues
 * Embedding — beides wäre bei mehreren Probeläufen hintereinander deutlich
 * spürbar. Deshalb ist alles hier eine Näherung nach unten, und sie ist als
 * solche gemeint: was der Probelauf zählt, findet die Suche mindestens.
 *
 * **Gezählt wird auf die gewählten Richtlinien herunter.** Sonst verspräche ein
 * Vorschlag „42 Treffer" und lieferte nach dem Klick 30 — die Zahl an einem
 * Vorschlag ist eine Zusage. Ein ausdrücklich gesetztes `richtlinien` hebt das
 * auf; das braucht der Ausweg „alle Richtlinien einbeziehen", der ja gerade die
 * Zahl OHNE Einschränkung nennt.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StorageService } from '@/core/services/storage';
import type { SuchVerknuepfung } from '@/core/hooks/useSuchVerknuepfung';
import type { Suchbereich } from '@/core/services/search/suchbereich';
import { istImBereich } from '@/core/status/betrachtungsbereich';
import {
  getProgrammCaches, searchAntraegeSubstring,
} from '@/plugins/antraege/services/antraege-search-service';
import type { AntragTextEntry } from '@/plugins/antraege/services/search-corpus';
import type { WertIndex } from '@/plugins/antraege/services/wert-index';

export interface ProbelaufOptionen {
  verknuepfung: SuchVerknuepfung;
  stammSuche: boolean;
  bereich: Suchbereich;
  /** Fehlt = die aktuell gewählten Richtlinien; `null` = ausdrücklich alle. */
  richtlinien?: ReadonlySet<string> | null;
}

export interface KorpusZahlen {
  /** Steht der Korpus? Ohne ihn entfallen alle Zahlen, nicht die Suche. */
  korpusBereit: boolean;
  /** Wertevorrat der Vervollständigung — fällt im selben Ladevorgang ab. */
  wertIndex: WertIndex | null;
  probelauf: (query: string, optionen: ProbelaufOptionen) => number;
  /**
   * Die Trefferzahl an einem Vorschlag — mit den EINGESTELLTEN Reglern
   * gerechnet, nicht mit den Standardwerten. Steht die Verknüpfung auf
   * „irgendein Wort", findet `ort:"Dresden" laser` etwas anderes als bei „alle
   * Wörter", und die Zahl in der Liste muss die Zahl nach dem Klick sein.
   * `null`, solange der Korpus fehlt.
   */
  zaehleVorschlag: (anfrage: string) => number | null;
}

export function useKorpusZahlen(params: {
  storage: StorageService;
  activeProgrammId: string | null;
  verknuepfung: SuchVerknuepfung;
  stammSuche: boolean;
  bereich: Suchbereich;
  /** Die geltenden Richtlinien; `null` = alle. */
  richtlinienMenge: ReadonlySet<string> | null;
}): KorpusZahlen {
  const { storage, activeProgrammId, verknuepfung, stammSuche, bereich, richtlinienMenge } = params;

  const korpusRef = useRef<Map<string, AntragTextEntry> | null>(null);
  const [korpusBereit, setKorpusBereit] = useState(false);
  const [wertIndex, setWertIndex] = useState<WertIndex | null>(null);

  useEffect(() => {
    if (!activeProgrammId) return;
    let abgebrochen = false;
    void getProgrammCaches(storage.idb, activeProgrammId)
      .then(c => {
        if (abgebrochen) return;
        korpusRef.current = c.textCorpus;
        setWertIndex(c.werteIndex);
        setKorpusBereit(true);
      })
      .catch(() => { /* best effort — ohne Korpus entfallen die Zahlen */ });
    return () => { abgebrochen = true; };
  }, [activeProgrammId, storage]);

  const probelauf = useCallback((q: string, opt: ProbelaufOptionen): number => {
    const korpus = korpusRef.current;
    if (!korpus || q.trim().length === 0) return 0;
    const akzListe = searchAntraegeSubstring(q, korpus, opt);
    const menge = opt.richtlinien === undefined ? richtlinienMenge : opt.richtlinien;
    if (menge === null) return akzListe.length;
    // Ohne Nummer bleibt ein Satz drin — dieselbe Regel wie in `wendeRichtlinienAn`.
    return akzListe.filter(akz => {
      const code = korpus.get(akz)?.unterprogrammId ?? '';
      return code === '' || istImBereich(code, menge);
    }).length;
  }, [richtlinienMenge]);

  const zaehleVorschlag = useCallback(
    (anfrage: string): number | null => (
      korpusRef.current ? probelauf(anfrage, { verknuepfung, stammSuche, bereich }) : null
    ),
    [probelauf, verknuepfung, stammSuche, bereich],
  );

  return { korpusBereit, wertIndex, probelauf, zaehleVorschlag };
}
