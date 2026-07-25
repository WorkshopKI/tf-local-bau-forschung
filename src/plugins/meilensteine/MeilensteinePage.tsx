/**
 * „Fristen & Meilensteine" — Vollbild-Seite.
 *
 * Ausbaustufe P3: der Konfigurations-Bereich. Übersicht, „Diese Woche" und
 * Auswertung kommen in den Folgephasen als weitere Tabs dazu; die Tab-Leiste
 * wird erst dann eingezogen — eine Leiste mit einem Reiter ist kein Navigations-,
 * sondern ein Ratlosigkeits-Signal.
 */
import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { History } from 'lucide-react';
import { useMeilensteinPlan, type MeilensteinPlanApi } from './useMeilensteinPlan';
import { KonfigurationTab } from './KonfigurationTab';
import { feldStil, formatDatum } from './labels';

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

export function MeilensteinePage(): React.ReactElement {
  const api = useMeilensteinPlan();

  const kopf = (
    <PageHeader
      title="Fristen & Meilensteine"
      subtitle="Bearbeitungs-Meilensteine je Verbund, gemessen ab Antragseingang"
    />
  );

  if (api.laden) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="px-6 pt-5 pb-3">{kopf}</div>
        <div className="flex-1 grid place-items-center text-[13px] text-[var(--tf-text-tertiary)]">Lädt …</div>
      </div>
    );
  }

  const entwurf = api.entwurf;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-6 pt-5 pb-3 border-b border-[var(--tf-border)]">{kopf}</div>

      {api.fehler != null && (
        <div className="mx-6 mt-3 rounded px-3 py-2 text-[12.5px] text-[var(--tf-danger-text)] bg-[var(--tf-danger-bg)]">
          ⚠ {api.fehler}
        </div>
      )}

      <StatusLeiste api={api} />

      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        {!api.darfSchreiben && (
          <p className="mt-4 text-[12.5px] text-[var(--tf-text-tertiary)]">
            Der Meilenstein-Plan wird von der Projektleitung gepflegt. Sie sehen hier den
            aktuellen Stand.
          </p>
        )}
        {entwurf && (
          <KonfigurationTab
            knoten={entwurf.knoten}
            gesamtfristTage={entwurf.gesamtfristTage}
            spalten={api.spalten}
            schreibgeschuetzt={!api.darfSchreiben}
            onKnoten={api.setKnoten}
            onGesamtfrist={api.setGesamtfrist}
          />
        )}
        <FassungenPanel api={api} />
      </div>

      {api.geaendert && api.darfSchreiben && <SpeicherLeiste api={api} />}
    </div>
  );
}
