import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { ActionRow, Archive, DevLog, SectionCaption } from './shared';
import {
  SCENARIOS,
  applyScenario,
  clearAllCsvSources,
  setKuratorOn,
  setKuratorOff,
  applyOfflineMode,
  exportCurrentState,
  type ScenarioKey,
} from '@/dev-fixtures';

type LogLine = { ts: number; text: string };

function format(line: LogLine): string {
  const t = new Date(line.ts).toLocaleTimeString('de-DE', { hour12: false });
  return `[${t}] ${line.text}`;
}

export function FixturesPanel(): React.ReactElement {
  const storage = useStorage();
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);

  const push = useCallback((text: string) => {
    setLog(prev => [...prev.slice(-19), { ts: Date.now(), text }]);
  }, []);

  const run = useCallback(
    async (label: string, fn: () => Promise<void>): Promise<void> => {
      setBusy(label);
      const start = Date.now();
      push(`▶ ${label} …`);
      try {
        await fn();
        push(`✓ ${label} (${Date.now() - start} ms)`);
      } catch (err) {
        push(`✗ ${label}: ${(err as Error).message}`);
        console.error(err);
      } finally {
        setBusy(null);
      }
    },
    [push],
  );

  const onScenario = (key: ScenarioKey, label: string): void => {
    void run(`Szenario: ${label}`, () => applyScenario(storage, key));
  };

  const onExportState = async (): Promise<void> => {
    await run('State-Dump in Clipboard', async () => {
      const dump = await exportCurrentState(storage.idb);
      const text = JSON.stringify(dump, null, 2);
      await navigator.clipboard.writeText(text);
      const total = Object.values(dump.stores).reduce((sum, s) => sum + s.count, 0);
      push(`  ${dump.kv_keys.length} KV-Keys, ${total} Store-Items`);
    });
  };

  return (
    <div className="px-8 py-6 max-w-[760px]">
      <h2 className="text-[18px] font-medium text-[var(--tf-text)]">Fixtures &amp; Test-Aktionen</h2>
      <p className="text-[13px] text-[var(--tf-text-secondary)] leading-relaxed mt-1.5 mb-5 max-w-[620px]">
        Vordefinierte Zustände in einem Klick. Achtung: jedes Szenario überschreibt die lokale IndexedDB.
      </p>

      <SectionCaption>Szenarien</SectionCaption>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {SCENARIOS.map(s => (
          <div
            key={s.key}
            className="flex items-start gap-3 p-3 rounded-[var(--tf-radius)] bg-[var(--tf-bg)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-medium text-[var(--tf-text)]">{s.label}</div>
              <div className="text-[12px] text-[var(--tf-text-secondary)] mt-1 leading-relaxed">
                {s.description}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => onScenario(s.key, s.label)}
            >
              Anwenden
            </Button>
          </div>
        ))}
      </div>

      <Archive title="Einzel-Aktionen (selten)">
        <ActionRow
          title="CSV leeren"
          hint="Nur die CSV-Quelle, Anträge bleiben."
          btn={
            <Button size="sm" variant="outline" disabled={busy !== null}
              onClick={() => run('CSV-Daten leeren', () => clearAllCsvSources(storage.idb))}>
              Leeren
            </Button>
          }
        />
        <ActionRow
          title="Kurator AN"
          hint="Schaltet Schreibrechte ein, ohne Session-Dialog."
          btn={
            <Button size="sm" variant="outline" disabled={busy !== null}
              onClick={() => run('Kurator-Flag AN', () => setKuratorOn(storage.idb))}>
              AN
            </Button>
          }
        />
        <ActionRow
          title="Kurator AUS"
          hint="Schaltet Schreibrechte aus."
          btn={
            <Button size="sm" variant="outline" disabled={busy !== null}
              onClick={() => run('Kurator-Flag AUS', () => setKuratorOff(storage.idb))}>
              AUS
            </Button>
          }
        />
        <ActionRow
          title="Offline 60 s"
          hint="Simuliert Netzwerk-Ausfall."
          btn={
            <Button size="sm" variant="outline" disabled={busy !== null}
              onClick={() => run('Offline 60s', async () => { applyOfflineMode(60_000); })}>
              Offline
            </Button>
          }
        />
        <ActionRow
          title="State → Clipboard"
          hint="Snapshot des Zustand-Stores in die Zwischenablage."
          btn={
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void onExportState()}>
              Kopieren
            </Button>
          }
        />
      </Archive>

      <div className="mt-6">
        <SectionCaption>Protokoll</SectionCaption>
        <DevLog lines={log.map(format)} />
      </div>
    </div>
  );
}
