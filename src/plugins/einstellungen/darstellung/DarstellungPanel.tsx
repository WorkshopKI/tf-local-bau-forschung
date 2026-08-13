/**
 * Seite „Darstellung & Bedienung" (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`, Screenshots 05–07).
 *
 * Links, was das Aussehen bestimmt (Erscheinungsbild, Tastatur), rechts die
 * Startseiten-Widgets — die eigentlich woanders konfiguriert werden und hier
 * nur ihre vollständige Liste haben.
 */
import { SettingsZweiSpalten } from '../_shared/settings-layout';
import { ErscheinungsbildGruppe } from './ErscheinungsbildGruppe';
import { TastaturGruppe } from './TastaturGruppe';
import { WidgetsGruppe } from './WidgetsGruppe';

export function DarstellungPanel(): React.ReactElement {
  return (
    <SettingsZweiSpalten
      haupt={
        <>
          <ErscheinungsbildGruppe />
          <TastaturGruppe />
        </>
      }
      neben={<WidgetsGruppe />}
    />
  );
}
