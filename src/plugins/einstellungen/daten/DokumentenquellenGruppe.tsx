/**
 * Gruppe „Persönliche Dokumentenquellen" — angekündigt, noch nicht bedienbar.
 *
 * Vorbereitend für eine User-persönliche-Pfade-Funktion (kommt, sobald internes
 * Embedding/LLM-API zur Verfügung steht). Zentral verwaltete DMS-Quellen leben
 * im Plugin „Dokumentenquellen" und sind für normale User unsichtbar.
 */
import { Badge } from '@/components/ui/badge';
import { SettingsNoteCard } from '../_shared/settings-primitives';
import { SettingsGruppe } from '@/components/settings';

export function DokumentenquellenGruppe(): React.ReactElement {
  return (
    <SettingsGruppe id="sec-doku" titel="Persönliche Dokumentenquellen">
      <div className="pt-1">
        <SettingsNoteCard
          badge={<Badge variant="default">In Vorbereitung</Badge>}
          hint="Zentral verwaltete DMS-Quellen pflegt der Kurator — nicht hier. Die Verarbeitung eigener Pfade läuft ausschließlich lokal auf diesem Rechner."
        >
          Eigene Dokumentenpfade — verfügbar, sobald internes Embedding &amp; LLM bereitstehen.
        </SettingsNoteCard>
      </div>
    </SettingsGruppe>
  );
}
