/**
 * Was der letzte Korpus-Abgleich ergeben hat — modul-global sichtbar.
 *
 * Bis v4.127 endete jede Verweigerung („Share-Korpus stammt aus einem anderen
 * Vektorraum") in einem `console.info`. Unter `file://` ist die Konsole zu; fuer
 * den Menschen davor sah ein veralteter Suchindex genauso aus wie ein aktueller.
 * Ein Messfeld ohne Urteil meldet keinen Stillstand.
 *
 * Eigene Datei ohne Plugin-Importe: die Suche liest diesen Zustand, und sie soll
 * dafuer nicht die halbe Auslastungs-Kette in ihren Import-Graphen ziehen (der
 * ausfuehrende Hook `useEmbeddingKorpusAbgleich` darf das, er haengt ohnehin in
 * der Shell).
 */
import { create } from 'zustand';
import type { AbgleichBefund } from '@/core/services/embedding-corpus';

interface KorpusAbgleichState {
  /** `null` = der Abgleich lief in dieser Sitzung noch nicht. */
  befund: AbgleichBefund | null;
  /** Laeuft gerade ein Download vom Datenspeicher? */
  laeuft: boolean;
  setBefund: (befund: AbgleichBefund | null) => void;
  setLaeuft: (laeuft: boolean) => void;
}

export const useKorpusAbgleich = create<KorpusAbgleichState>(set => ({
  befund: null,
  laeuft: false,
  setBefund: (befund) => set({ befund }),
  setLaeuft: (laeuft) => set({ laeuft }),
}));
