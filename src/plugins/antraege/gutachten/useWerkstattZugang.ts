/**
 * Sieht der aktuelle Nutzer die Inline-Werkstatt am Gutachten-Abschnitt?
 *
 * Vorher stand hier `isDevContext()` — damit blieb der kurze Weg zum Prompt
 * ausgerechnet den Rollen verschlossen, die die Registry ohnehin schreiben
 * dürfen (pl, as). Die Entscheidung selbst liegt in der reinen
 * [werkstattZugang](@/config/registry-zugang); dieser Hook liefert ihr nur den
 * Session-Zustand, den sie nicht selbst lesen kann.
 *
 * Die Kurator-Session ist der einzige Teil der Umgebung, der sich WÄHREND der
 * Sitzung ändert — deshalb ein Hook und keine Konstante.
 */
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { registryUmgebung } from '@/config/feature-flags';
import { werkstattZugang } from '@/config/registry-zugang';

export function useWerkstattZugang(): boolean {
  const sessionAktiv = useKuratorSession(s => s.isActive);
  return werkstattZugang(registryUmgebung(sessionAktiv)).sichtbar;
}
