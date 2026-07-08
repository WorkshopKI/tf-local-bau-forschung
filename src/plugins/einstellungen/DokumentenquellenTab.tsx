/**
 * Einstellungen-Abschnitt "Persönliche Dokumentenquellen" — User-sichtbar,
 * in Vorbereitung.
 *
 * Vorbereitend fuer eine User-persoenliche-Pfade-Funktion (kommt sobald
 * internes Embedding/LLM-API zur Verfuegung steht). Aktuell nur Disclosure.
 *
 * DMS-Quellen (Mandanten-Ebene) leben im Plugin "Dokumentenquellen" und sind
 * fuer normale User unsichtbar.
 */
import { Badge } from '@/components/ui/badge';
import { SettingsSectionHeader, SettingsNoteCard } from './_shared/settings-primitives';

export function DokumentenquellenTab(): React.ReactElement {
  return (
    <section id="sec-doku" className="scroll-mt-20">
      <SettingsSectionHeader label="Persönliche Dokumentenquellen" />
      <SettingsNoteCard
        badge={<Badge variant="default">In Vorbereitung</Badge>}
        hint="Zentral verwaltete DMS-Quellen pflegt der Kurator — nicht hier."
      >
        Eigene Dokumentenpfade — verfügbar, sobald internes Embedding- &amp; LLM-API bereitsteht.
        Verarbeitung ausschließlich lokal auf Ihrem Rechner.
      </SettingsNoteCard>
    </section>
  );
}
