/**
 * **Meine Anträge oder alle** — der Umschalter zwischen eigenem Arbeitsvorrat
 * und Team-Bestand (v4.47).
 *
 * Bis v4.46 war das keine eigene Größe: „meine vs. alle" war der WERT des
 * Profil-Kürzels (`'THÜ'` = meine, `'alle'` = alle). Umschalten hieß, die eigene
 * Identität zu überschreiben und danach neu einzutippen. Seither trennt diese
 * Datei beides — das Profil sagt, wer man ist, die Sicht sagt, wessen Anträge
 * man gerade sehen will.
 *
 * Aufbau wie beim Betrachtungsbereich (`useBetrachtungsbereich` +
 * `useBereich`), hier aber in EINER Datei: die zweite Hälfte, die den Bereich
 * zum Aufteilen zwingt (eine kuratierte Definition neben der persönlichen
 * Auswahl), gibt es hier nicht — die Definition ist das Profil-Kürzel.
 *
 * **Dieser Hook filtert nichts** (Pitfall #46). Er liefert den fertigen Modus;
 * anwenden müssen ihn die Konsumenten selbst — und den Zustand sichtbar machen
 * (`BearbeiterSichtChip`), sonst blendet eine Liste stumm den halben Bestand aus.
 */
import { useMemo } from 'react';
import { create } from 'zustand';
import { useProfile } from '@/core/hooks/useProfile';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { useMAIdentity } from '@/core/hooks/useMAIdentity';
import { isMaLoginEnabled } from '@/config/feature-flags';
import {
  parseBearbeiterFilter,
  sichtModus,
  type BearbeiterFilterMode,
  type BearbeiterSicht,
} from '@/plugins/antraege/bearbeiterFilter';

export type { BearbeiterSicht };

const KEY = 'teamflow_bearbeiter_sicht';

/** Default `'meine'` — der Bestand verhält sich damit exakt wie vor v4.47:
 *  wer ein Kürzel gesetzt hat, sieht weiterhin zuerst seine eigenen Anträge. */
function ladeSicht(): BearbeiterSicht {
  try {
    return localStorage.getItem(KEY) === 'alle' ? 'alle' : 'meine';
  } catch {
    return 'meine';
  }
}

function speichereSicht(v: BearbeiterSicht): void {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* ignore */
  }
}

interface BearbeiterSichtStore {
  sicht: BearbeiterSicht;
  setSicht: (v: BearbeiterSicht) => void;
}

/** Gerätelokal und persistent — die Sicht ist eine Arbeitsgewohnheit, keine
 *  Team-Kuration; sie gehört deshalb weder ins Profil auf dem Share noch in den
 *  Snapshot. */
export const useBearbeiterSichtStore = create<BearbeiterSichtStore>((set) => ({
  sicht: ladeSicht(),
  setSicht: (v: BearbeiterSicht) => {
    speichereSicht(v);
    set({ sicht: v });
  },
}));

export interface BearbeiterSichtErgebnis {
  sicht: BearbeiterSicht;
  /**
   * Steht der Umschalter überhaupt zur Verfügung? Nur wenn ein echtes Kürzel
   * gesetzt ist UND es aus dem Profilfeld stammt — im MA-Login (prod) ist die
   * Identität aus dem Passwort abgeleitet und der Ausschnitt daran gebunden.
   * Das ist zugleich das Varianten-Gate: genau dort, wo man heute schon „alle"
   * ins Profilfeld tippen konnte, gibt es jetzt den Schalter dafür.
   */
  kannUmschalten: boolean;
  /** Der anzuwendende Filter-Modus (Sicht bereits eingerechnet). */
  mode: BearbeiterFilterMode;
  /** Das eigene Kürzel — auch in der „alle"-Sicht, damit der Chip den Rückweg
   *  beschriften kann („Meine Anträge (THÜ)"). Leer ohne gesetztes Kürzel. */
  eigeneTokens: string[];
  setSicht: (v: BearbeiterSicht) => void;
}

export function useBearbeiterSicht(): BearbeiterSichtErgebnis {
  const sicht = useBearbeiterSichtStore(s => s.sicht);
  const setSicht = useBearbeiterSichtStore(s => s.setSicht);
  const meinKuerzel = useMeinKuerzel();
  const istAngemeldet = useMAIdentity(s => s.istAngemeldet);
  const { profile } = useProfile();
  const inklBegleitung = profile?.bearbeiter_inkl_begleitung;

  return useMemo(() => {
    const eigen = parseBearbeiterFilter(meinKuerzel, inklBegleitung);
    const identitaetFest = isMaLoginEnabled() && istAngemeldet;
    const kannUmschalten = eigen.active && !identitaetFest;
    return {
      sicht: kannUmschalten ? sicht : 'meine',
      kannUmschalten,
      // Ohne Umschalt-Recht gilt der Profil-Wert unverändert — eine im
      // localStorage liegengebliebene „alle"-Wahl darf einem prod-User mit
      // festem Kürzel nicht den ganzen Bestand aufmachen.
      mode: kannUmschalten ? sichtModus(eigen, sicht) : eigen,
      eigeneTokens: eigen.tokens,
      setSicht,
    };
  }, [meinKuerzel, inklBegleitung, istAngemeldet, sicht, setSicht]);
}
