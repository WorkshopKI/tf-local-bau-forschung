/**
 * Die Seite „Glossar": Suchfeld oben, Liste links, Erklärung rechts.
 *
 * **Ein Suchfeld über alles.** Wer nachschlägt, weiß nicht, ob das Gesuchte eine
 * Abkürzung, ein Kürzel oder ein Statuswert ist; zwei Suchfelder verlangten
 * genau die Unterscheidung, die man hier erst lernen will.
 *
 * Die Auswahl wird aus den sichtbaren Gruppen ABGELEITET, nicht mitgeführt:
 * verschwindet ein Eintrag beim Weitertippen, schließt sich das Detail von
 * selbst — ohne Effekt, der zwei Zustände synchron hält.
 *
 * **Fehlt der Katalog, sagt die Seite das und zeigt trotzdem die Abkürzungen.**
 * Ein leerer Bildschirm ohne Begründung wäre die schlechtere Antwort.
 */
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/PageHeader';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';
import { MasterDetailLayout } from '@/components/master-detail';
import { GLOSSAR_BEGRIFFE } from '@/core/glossar';
import { GlossarListe } from './GlossarListe';
import { GlossarDetail, GlossarLeer } from './GlossarDetail';
import { RollenSicht } from './RollenSicht';
import { useGlossar } from './useGlossar';
import { kuerzelZeilen, statuswertZeilen } from './glossarZeilen';
import {
  begriffAlsEintrag, gruppiere, gesamtZahl, kuerzelAlsEintrag, statuswertAlsEintrag,
  waehleEintrag,
} from './glossarSuche';

type Sicht = 'nachschlagen' | 'rolle';

export function GlossarPage(): React.ReactElement {
  const { version, trigger, vorkommen, laden } = useGlossar();
  const [sicht, setSicht] = useState<Sicht>('nachschlagen');
  const [suche, setSuche] = useState('');
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);

  const kuerzel = useMemo(
    () => (version === null ? [] : kuerzelZeilen(version, vorkommen)),
    [version, vorkommen],
  );

  const alle = useMemo(() => [
    ...GLOSSAR_BEGRIFFE.map(begriffAlsEintrag),
    ...(version === null ? [] : statuswertZeilen(version, vorkommen).map(statuswertAlsEintrag)),
    ...kuerzel.map(kuerzelAlsEintrag),
  ], [version, vorkommen, kuerzel]);

  const gruppen = useMemo(() => gruppiere(alle, suche), [alle, suche]);
  const auswahl = waehleEintrag(gruppen, gewaehlt);

  /** Ein Querverweis springt zum Ziel — und holt es zurück in die Sicht. */
  const springeZu = (id: string): void => {
    setSuche('');
    setSicht('nachschlagen');
    setGewaehlt(id);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-3 border-b border-[var(--tf-border)] px-6 pb-3 pt-5">
        <PageHeader
          title="Glossar"
          subtitle="Nachschlagen, nicht ändern"
          meta={
            <span className="text-[11px] tabular-nums text-[var(--tf-text-tertiary)]">
              {gesamtZahl(gruppen)} Einträge
            </span>
          }
          actions={<SeitenHilfeButton pluginId="glossar" />}
        />
        <div className="flex flex-wrap items-center gap-3">
          <ScopeTabs
            variant="pills"
            aria-label="Sicht"
            activeKey={sicht}
            onChange={k => setSicht(k as Sicht)}
            items={[
              { key: 'nachschlagen', label: 'Nachschlagen' },
              {
                key: 'rolle', label: 'Für meine Rolle wichtig', count: kuerzel.length,
                disabled: kuerzel.length === 0,
                title: kuerzel.length === 0
                  ? 'Ohne geladenen Katalog gibt es keine Kürzel'
                  : 'Die Kürzel einer Fachrolle, nach Vorkommen im Bestand',
              },
            ]}
          />
          {sicht === 'nachschlagen' && (
            <div className="relative">
              <Search
                size={13}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)]"
              />
              <Input
                autoFocus
                autoComplete="off"
                value={suche}
                onChange={e => setSuche(e.target.value)}
                placeholder="Abkürzung, Begriff, Statuswert oder Kürzel suchen"
                aria-label="Glossar durchsuchen"
                className="h-8 max-w-[340px] pl-7 text-[12.5px]"
              />
            </div>
          )}
        </div>
        {version === null && !laden && (
          // Ehrlich leer: die Abkürzungen stehen weiter da, aber warum die
          // anderen Gruppen fehlen, gehört gesagt.
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            Kein Status-Katalog geladen — Statuswerte und Kürzel fehlen deshalb. Die
            Abkürzungen und Begriffe stehen unabhängig davon.
          </p>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {sicht === 'rolle' ? (
          <RollenSicht zeilen={kuerzel} trigger={trigger} onWaehlen={springeZu} />
        ) : (
          <MasterDetailLayout
            listWidthKey="teamflow_glossar_narrow_width"
            onCloseDetail={() => setGewaehlt(null)}
            list={
              <div className="h-full overflow-y-auto">
                <GlossarListe
                  gruppen={gruppen}
                  gewaehlt={auswahl?.id ?? null}
                  onWaehlen={setGewaehlt}
                  leerText={`Kein Eintrag zu „${suche.trim()}". Was hier fehlt, fehlt im Glossar — sagen Sie es über „Hilfe → Text stimmt nicht".`}
                />
              </div>
            }
            detail={
              auswahl
                ? <GlossarDetail
                    key={auswahl.id} eintrag={auswahl}
                    version={version} trigger={trigger} onWaehlen={springeZu}
                  />
                : <GlossarLeer />
            }
          />
        )}
      </div>
    </div>
  );
}
