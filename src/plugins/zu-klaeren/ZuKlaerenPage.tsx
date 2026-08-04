/**
 * Die Seite „Zu klären": Kopf, Hinweise, Zuordnungstabelle, Grundsatzfragen.
 *
 * **Kein Betrachtungsbereich-Chip.** Die Seite fragt nach dem Phasenschnitt als
 * Ganzem; sie ist Evidenz, nicht Arbeitsvorrat (Pitfall #46). Ein Chip behauptete
 * einen Filter, den es hier nicht gibt.
 *
 * **Sperren stehen als Satz da, nicht als grauer Knopf.** Wer kein Kürzel gesetzt
 * hat oder kein Schreibrecht besitzt, soll den Grund lesen können — ein
 * deaktiviertes Bedienelement ohne Begründung ist eine Sackgasse.
 */
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useKlaerung } from './useKlaerung';
import { PunkteTabelle, type AntwortKontext } from './PunkteTabelle';
import { GrundsatzFragen } from './GrundsatzFragen';
import { ExportLeiste } from './ExportLeiste';
import { standZeit } from './labels';
import type { ZeilenFilter } from './gruppen';

const SPERR_TEXT: Record<'kein-kuerzel' | 'kein-schreibrecht', string> = {
  'kein-kuerzel':
    'Zum Antworten fehlt Dein eigenes Kürzel: bitte in den Einstellungen im Profil '
    + 'eintragen. Ein Sammel-Kürzel („alle") oder eine Vertretungsliste geht nicht — '
    + 'sonst ließe sich nicht auseinanderhalten, wer was gesagt hat. Mitlesen kannst Du.',
  'kein-schreibrecht':
    'Dieser Build darf den Daten-Share nicht beschreiben. Du kannst alles mitlesen, '
    + 'aber nicht antworten.',
};

export function ZuKlaerenPage(): React.ReactElement {
  const api = useKlaerung();
  const laden = useAsyncAction(async () => { await api.neuLaden(); });

  const kontext: AntwortKontext = {
    stand: api.stand,
    meinKuerzel: api.meinKuerzel,
    gesperrt: api.sperre !== null,
    sperrGrund: api.sperre !== null ? SPERR_TEXT[api.sperre] : '',
    aeussern: api.aeussern,
  };

  const kopf = (
    <PageHeader
      title="Zu klären"
      subtitle={api.klaerung.titel}
      meta={
        <span className="text-[11px] text-[var(--tf-text-tertiary)] tabular-nums">
          {api.beantwortet} von {api.gesamt} Punkten von Dir beantwortet
          {api.standIso !== null && ` · Stand ${standZeit(api.standIso)}`}
        </span>
      }
      actions={
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost" size="sm"
            disabled={laden.busy || api.laden}
            title="Antworten der anderen neu vom Daten-Share lesen"
            onClick={() => laden.run()}
          >
            <RefreshCw size={13} /> {laden.busy || api.laden ? 'Lädt …' : 'Neu laden'}
          </Button>
          <SeitenHilfeButton pluginId="zu-klaeren" />
        </div>
      }
    />
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-6 pt-5 pb-3 flex flex-col gap-3 border-b border-[var(--tf-border)]">
        {kopf}
        <ScopeTabs
          variant="pills"
          aria-label="Zeilen"
          activeKey={api.filter}
          onChange={k => api.setFilter(k as ZeilenFilter)}
          items={[
            { key: 'alle', label: 'Alle Zuordnungen', count: 30 },
            {
              key: 'strittig', label: 'Nur strittige', count: api.anzahlStrittig,
              title: 'Zeilen, für die zwei oder mehr verschiedene Zielphasen genannt wurden',
            },
            {
              key: 'unklar', label: 'Offene Rückfragen', count: api.anzahlUnklar,
              title: 'Zeilen, die jemand nicht beurteilen konnte',
            },
          ]}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 flex flex-col gap-5">
        {api.fehler != null && (
          <div className="rounded px-3 py-2 text-[12.5px] text-[var(--tf-danger-text)] bg-[var(--tf-danger-bg)]">
            ⚠ {api.fehler}
          </div>
        )}

        {api.sperre !== null && (
          <p className="text-[12.5px] text-[var(--tf-text-secondary)]">{SPERR_TEXT[api.sperre]}</p>
        )}

        {api.fassungWeichtAb.length > 0 && (
          <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
            Hinweis: Die geladene Katalog-Fassung weicht bei{' '}
            {api.fassungWeichtAb.length} {api.fassungWeichtAb.length === 1 ? 'Code' : 'Codes'} vom
            ausgelieferten Schnitt ab ({api.fassungWeichtAb.join(', ')}). Diese Seite fragt nach dem
            ausgelieferten Schnitt — das ist der, den eine Änderung am Programm betrifft.
          </p>
        )}

        <section className="flex flex-col gap-2">
          <p className="text-[12px] text-[var(--tf-text-secondary)]">
            Der Phasenschnitt ordnet jedem Status eine ZAH-Phase zu. Er ist eine Lesebrille der
            App — er ändert nichts am Fachsystem, bestimmt aber Gruppierung, Filter und
            Fristen-Vorschläge. Diese Seite sammelt nur Antworten; übernommen wird eine Änderung
            später als Programm-Änderung.
          </p>
          <PunkteTabelle gruppen={api.gruppen} kontext={kontext} bestandVom={api.bestandVom} />
        </section>

        <GrundsatzFragen fragen={api.fragen} kontext={kontext} />

        <ExportLeiste baueEingabe={() => ({
          klaerung: api.klaerung,
          punkte: api.punkte,
          stand: api.stand,
          autoren: api.autoren,
          vorkommen: api.vorkommen,
          bestandVom: api.bestandVom,
          jetztIso: new Date().toISOString(),
        })} />
      </div>
    </div>
  );
}
