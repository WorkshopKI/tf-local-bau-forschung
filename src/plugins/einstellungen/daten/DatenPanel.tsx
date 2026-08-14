/**
 * Seite „Daten & Verbindungen" (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`, Screenshot 10).
 *
 * Links die Orte, aus denen die App liest und in die sie schreibt; rechts, was
 * daneben entsteht: der Team-Status und die Tags. Die persönlichen
 * Dokumentenquellen stehen als Hinweiskarte darunter — sie sind angekündigt,
 * aber noch nicht bedienbar.
 */
import { isOnlineStatusTabEnabled } from '@/config/feature-flags';
import { SettingsZweiSpalten } from '@/components/settings';
import { DokumentenquellenGruppe } from './DokumentenquellenGruppe';
import { OrdnerGruppe } from './OrdnerGruppe';
import { VerzeichnisseGruppe } from './VerzeichnisseGruppe';
import { TeamStatusGruppe } from './TeamStatusGruppe';
import { TagsGruppe } from './TagsGruppe';

export function DatenPanel(): React.ReactElement {
  return (
    <SettingsZweiSpalten
      haupt={
        <>
          <OrdnerGruppe />
          <VerzeichnisseGruppe />
        </>
      }
      neben={
        <>
          {isOnlineStatusTabEnabled() && <TeamStatusGruppe />}
          <TagsGruppe />
          <DokumentenquellenGruppe />
        </>
      }
    />
  );
}
