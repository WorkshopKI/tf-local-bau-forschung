/**
 * Gruppe „Umfang der Oberfläche" — die beiden Schalter, mit denen jeder für
 * sich entscheidet, wie viel App er sehen will.
 *
 * Sie stehen in der rechten Spalte bei den anderen Folgen-aus-dir-Zeilen: was
 * du siehst, hängt an deiner Person, nicht an diesem Gerät.
 *
 * **Die Kurzzeilen zählen den ECHTEN Zugewinn im aktuellen Stand.** Bei
 * UND-Verknüpfung hängt der Effekt des einen Schalters vom anderen ab: mit
 * ausgeschaltetem Expertenmodus bringt „Beta" nur die reinen Beta-Bereiche, mit
 * eingeschaltetem zusätzlich die, die beides tragen. Eine feste Zahl wäre eine
 * Zusage, die nicht in jedem Zustand stimmt.
 */
import { Switch } from '@/components/ui/switch';
import { useProfile } from '@/core/hooks/useProfile';
import { useZugewinn } from '@/core/hooks/useSichtbar';
import { SettingsGruppe, SettingsOption } from '@/components/settings';

const HINT_BETA =
  'Zeigt Seiten, Reiter, Abschnitte und Startseiten-Widgets, die noch in Erprobung sind. Sie funktionieren, können sich aber noch ändern — Rückmeldungen dazu sind ausdrücklich erwünscht. Was als Beta gilt, legt die Kuration team-weit fest (Datenpflege › Sichtbarkeit).';
const HINT_EXPERTE =
  'Zeigt selten gebrauchte Tiefen-Werkzeuge: Verwaltungs-Reiter, Rohfelder, Diagnose-Abschnitte. Nichts davon ist gesperrt — es steht nur nicht im Weg, solange du es nicht brauchst. Was beides trägt (neu UND tief), erscheint erst, wenn auch „Beta-Funktionen" an ist.';

function zeile(n: number): string {
  if (n === 0) return 'Zurzeit gibt es hier nichts zusätzlich zu sehen';
  return n === 1 ? 'Blendet 1 weiteren Bereich ein' : `Blendet ${n} weitere Bereiche ein`;
}

export function UmfangGruppe(): React.ReactElement | null {
  const { profile, updateProfile } = useProfile();
  const zugewinnBeta = useZugewinn('beta');
  const zugewinnExperte = useZugewinn('experte');
  if (!profile) return null;

  // allow-sichtbarkeit-eine-mechanik: die Schreibstelle der beiden Schalter —
  // hier MUSS das Rohfeld stehen, gelesen wird es überall sonst via useSichtbar().
  const betaAn = profile.beta_features === true;
  // allow-sichtbarkeit-eine-mechanik: dito.
  const experteAn = profile.experten_modus === true;

  return (
    <SettingsGruppe
      id="sec-umfang"
      titel="Umfang der Oberfläche"
      unterzeile="Wie viel die App dir zeigt. Beides aus = der tägliche Weg."
    >
      <SettingsOption
        label="Beta-Funktionen"
        hint={HINT_BETA}
        kurzzeile={betaAn ? undefined : zeile(zugewinnBeta)}
      >
        <Switch
          checked={betaAn}
          onCheckedChange={v => void updateProfile({ beta_features: v })}
          aria-label="Beta-Funktionen anzeigen"
        />
      </SettingsOption>

      <SettingsOption
        label="Expertenmodus"
        hint={HINT_EXPERTE}
        kurzzeile={experteAn ? undefined : zeile(zugewinnExperte)}
      >
        <Switch
          checked={experteAn}
          onCheckedChange={v => void updateProfile({ experten_modus: v })}
          aria-label="Expertenmodus anzeigen"
        />
      </SettingsOption>
    </SettingsGruppe>
  );
}
