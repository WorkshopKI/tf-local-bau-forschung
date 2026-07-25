/**
 * „Fristen & Meilensteine" — Vollbild-Seite mit drei Bereichen: die Übersicht
 * aller offenen Verbünde, die Arbeitsliste „Diese Woche" und die Konfiguration
 * des Plans.
 *
 * Zwei Hooks, bewusst getrennt: `useMeilensteinStand` liest den bewerteten
 * Stand (read-only, für alle), `useMeilensteinPlan` den editierbaren Plan (nur
 * mit Schreibrecht wirksam). Ein gemeinsamer Hook müsste beide Lebenszyklen
 * bedienen und würde bei jedem Tastendruck im Editor die Projektion anfassen.
 */
import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { History } from 'lucide-react';
import { useMeilensteinPlan, type MeilensteinPlanApi } from './useMeilensteinPlan';
import { useMeilensteinStand } from './useMeilensteinStand';
import { KonfigurationTab } from './KonfigurationTab';
import { UebersichtTab } from './UebersichtTab';
import { DieseWocheTab } from './DieseWocheTab';
import { sammleWochenPunkte } from './monitoringLogic';
import { feldStil, formatDatum } from './labels';

type TabKey = 'uebersicht' | 'woche' | 'konfiguration';

function StatusLeiste({ api }: { api: MeilensteinPlanApi }): React.ReactElement | null {
  // Hooks vor jedem Early-Return — sonst kippt die Hook-Reihenfolge (React #310).
  const freigeben = useAsyncAction(async () => { await api.freigebenJetzt(); });
  const zurueck = useAsyncAction(async () => { await api.zurueckziehen(); });
  const plan = api.gespeichert;
  if (!plan) return null;

  return (
    <div className="px-6 py-2.5 border-b border-[var(--tf-border)] flex items-center gap-2 flex-wrap">
      <span className="text-[12.5px] font-mono text-[var(--tf-text)]">Fassung {plan.version}</span>
      <Badge variant={plan.status === 'freigegeben' ? 'success' : 'warning'}>
        {plan.status === 'freigegeben' ? 'freigegeben' : 'Entwurf'}
      </Badge>
      <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
        {plan.autor ?? '—'} · {formatDatum(plan.stand)}
      </span>

      {api.ausSeed && (
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          Auslieferungs-Plan — noch nicht gespeichert.
        </span>
      )}
      {api.stale && (
        <span className="text-[11.5px] text-[var(--tf-warning-text)]">
          Aus dem lokalen Zwischenspeicher — der Daten-Share war nicht erreichbar.
        </span>
      )}

      {api.darfSchreiben && !api.geaendert && (
        <span className="ml-auto flex items-center gap-1.5">
          {plan.status === 'freigegeben' ? (
            <Button variant="ghost" size="sm" disabled={zurueck.busy} onClick={() => zurueck.run()}>
              {zurueck.busy ? 'Zieht zurück …' : 'Zurück in Entwurf'}
            </Button>
          ) : (
            <Button variant="primary" size="sm" disabled={freigeben.busy} onClick={() => freigeben.run()}>
              {freigeben.busy ? 'Gibt frei …' : 'Für das Team freigeben'}
            </Button>
          )}
        </span>
      )}
      {(freigeben.error ?? zurueck.error) != null && (
        <span className="text-[11.5px] text-[var(--tf-danger-text)] w-full">
          ⚠ {freigeben.error ?? zurueck.error}
        </span>
      )}
    </div>
  );
}

function FassungenPanel({ api }: { api: MeilensteinPlanApi }): React.ReactElement | null {
  const [offen, setOffen] = useState(false);   // vor dem Early-Return (React #310)
  const historie = api.gespeichert?.historie ?? [];
  if (historie.length === 0) return null;

  return (
    <section className="mt-6 rounded" style={feldStil}>
      <button
        type="button"
        onClick={() => setOffen(v => !v)}
        aria-expanded={offen}
        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
      >
        <History size={15} />
        Frühere Fassungen ({historie.length})
        <span className="ml-auto text-[11px] text-[var(--tf-text-tertiary)]">
          {offen ? 'einklappen' : 'ausklappen'}
        </span>
      </button>
      {offen && (
        <div className="flex flex-col divide-y divide-[var(--tf-border)] border-t border-[var(--tf-border)]">
          {historie.map(h => (
            <div key={h.version} className="flex items-center gap-2 px-3 py-2 flex-wrap">
              <span className="text-[12.5px] font-mono text-[var(--tf-text)]">v{h.version}</span>
              <Badge variant={h.status === 'freigegeben' ? 'success' : 'default'}>
                {h.status === 'freigegeben' ? 'freigegeben' : 'Entwurf'}
              </Badge>
              <span className="text-[12px] text-[var(--tf-text-secondary)]">{h.autor ?? '—'}</span>
              <span className="text-[11px] text-[var(--tf-text-tertiary)]">{formatDatum(h.stand)}</span>
              <span className="text-[11px] text-[var(--tf-text-tertiary)]">
                {h.knoten.length} Meilensteine · {h.gesamtfristTage} Tage
              </span>
              {h.kommentar && (
                <span className="text-[12px] text-[var(--tf-text-secondary)] italic min-w-0 truncate">
                  „{h.kommentar}"
                </span>
              )}
              {api.darfSchreiben && (
                <Button
                  variant="ghost" size="sm" className="ml-auto"
                  onClick={() => api.fassungUebernehmen(h.version)}
                >
                  Als Entwurf übernehmen
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SpeicherLeiste({ api }: { api: MeilensteinPlanApi }): React.ReactElement {
  const [kommentar, setKommentar] = useState('');
  const speichern = useAsyncAction(async () => {
    await api.speichern(kommentar.trim() || undefined);
    setKommentar('');
  });

  return (
    <div className="shrink-0 border-t border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] px-6 py-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12.5px] text-[var(--tf-text-secondary)]">
          Entwurf weicht vom gespeicherten Plan ab.
        </span>
        <input
          value={kommentar}
          onChange={e => setKommentar(e.target.value)}
          placeholder="Was hat sich geändert? (optional)"
          aria-label="Kommentar zur Fassung"
          className="flex-1 min-w-[200px] max-w-[420px] text-[12.5px] rounded px-2.5 py-1.5 bg-[var(--tf-bg)] text-[var(--tf-text)]"
          style={feldStil}
        />
        <Button variant="primary" size="sm" disabled={speichern.busy} onClick={() => speichern.run()}>
          {speichern.busy ? 'Speichert …' : 'Als neue Fassung speichern'}
        </Button>
        <Button variant="ghost" size="sm" disabled={speichern.busy} onClick={() => api.verwerfen()}>
          Verwerfen
        </Button>
      </div>
      <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
        Gespeicherte Fassungen sind zunächst Entwürfe — erst die Freigabe lässt sie für das Team gelten.
      </p>
      {speichern.error != null && (
        <p className="text-[11.5px] text-[var(--tf-danger-text)]">⚠ {speichern.error}</p>
      )}
    </div>
  );
}

/** Hinweis statt Leere, wenn noch keine Fassung freigegeben ist. */
function KeinPlanHinweis({ onZurKonfiguration }: { onZurKonfiguration: () => void }): React.ReactElement {
  return (
    <div className="pt-6 flex flex-col items-start gap-2">
      <p className="text-[13px] text-[var(--tf-text)]">Noch kein Plan freigegeben.</p>
      <p className="text-[12.5px] text-[var(--tf-text-secondary)] max-w-[560px]">
        Es wird nur eine freigegebene Fassung ausgewertet — solange keine vorliegt, bleibt die
        Auswertung bewusst leer, statt Zahlen aus einem halbfertigen Entwurf zu zeigen.
      </p>
      <Button variant="ghost" size="sm" onClick={onZurKonfiguration}>Zur Konfiguration</Button>
    </div>
  );
}

export function MeilensteinePage(): React.ReactElement {
  const planApi = useMeilensteinPlan();
  const stand = useMeilensteinStand();
  const [tab, setTab] = useState<TabKey>('uebersicht');

  const kopf = (
    <PageHeader
      title="Fristen & Meilensteine"
      subtitle="Bearbeitungs-Meilensteine je Verbund, gemessen ab Antragseingang"
    />
  );

  const wochenAnzahl = stand.plan ? sammleWochenPunkte(stand.zeilen, stand.plan, stand.stand).length : 0;
  const entwurf = planApi.entwurf;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-6 pt-5 pb-3 flex flex-col gap-3 border-b border-[var(--tf-border)]">
        {kopf}
        <ScopeTabs
          variant="tabs"
          aria-label="Bereich"
          activeKey={tab}
          onChange={k => setTab(k as TabKey)}
          items={[
            { key: 'uebersicht', label: 'Übersicht', count: stand.zeilen.length },
            { key: 'woche', label: 'Diese Woche', count: wochenAnzahl },
            { key: 'konfiguration', label: 'Konfiguration', count: entwurf?.knoten.length ?? 0 },
          ]}
        />
      </div>

      {(planApi.fehler ?? stand.fehler) != null && (
        <div className="mx-6 mt-3 rounded px-3 py-2 text-[12.5px] text-[var(--tf-danger-text)] bg-[var(--tf-danger-bg)]">
          ⚠ {planApi.fehler ?? stand.fehler}
        </div>
      )}

      {tab === 'konfiguration' && <StatusLeiste api={planApi} />}

      {tab === 'uebersicht' && (
        <div className="flex-1 min-h-0 px-6 pb-4 pt-3">
          {stand.laden ? (
            <p className="text-[13px] text-[var(--tf-text-tertiary)]">Bewertet …</p>
          ) : stand.keinPlan || !stand.plan ? (
            <KeinPlanHinweis onZurKonfiguration={() => setTab('konfiguration')} />
          ) : (
            <UebersichtTab zeilen={stand.zeilen} plan={stand.plan} meinKuerzel={stand.meinKuerzel} />
          )}
        </div>
      )}

      {tab === 'woche' && (
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          {stand.laden ? (
            <p className="pt-4 text-[13px] text-[var(--tf-text-tertiary)]">Bewertet …</p>
          ) : stand.keinPlan || !stand.plan ? (
            <KeinPlanHinweis onZurKonfiguration={() => setTab('konfiguration')} />
          ) : (
            <DieseWocheTab
              zeilen={stand.zeilen} plan={stand.plan}
              meinKuerzel={stand.meinKuerzel} stand={stand.stand}
            />
          )}
        </div>
      )}

      {tab === 'konfiguration' && (
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          {planApi.laden ? (
            <p className="pt-4 text-[13px] text-[var(--tf-text-tertiary)]">Lädt …</p>
          ) : (
            <>
              {!planApi.darfSchreiben && (
                <p className="mt-4 text-[12.5px] text-[var(--tf-text-tertiary)]">
                  Der Meilenstein-Plan wird von der Projektleitung gepflegt. Sie sehen hier den
                  aktuellen Stand.
                </p>
              )}
              {entwurf && (
                <KonfigurationTab
                  knoten={entwurf.knoten}
                  gesamtfristTage={entwurf.gesamtfristTage}
                  spalten={planApi.spalten}
                  schreibgeschuetzt={!planApi.darfSchreiben}
                  onKnoten={planApi.setKnoten}
                  onGesamtfrist={planApi.setGesamtfrist}
                />
              )}
              <FassungenPanel api={planApi} />
            </>
          )}
        </div>
      )}

      {tab === 'konfiguration' && planApi.geaendert && planApi.darfSchreiben && (
        <SpeicherLeiste api={planApi} />
      )}
    </div>
  );
}
