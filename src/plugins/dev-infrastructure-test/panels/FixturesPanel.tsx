import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { DevRow, DevLog } from './shared';
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
    <div>
      <DevRow label="Szenarien">
        {SCENARIOS.map(s => (
          <Button
            key={s.key}
            variant="secondary"
            size="sm"
            disabled={busy !== null}
            onClick={() => onScenario(s.key, s.label)}
            title={s.description}
          >
            {s.label}
          </Button>
        ))}
      </DevRow>

      <DevRow label="Einzel-Aktionen">
        <Button
          variant="secondary"
          size="sm"
          disabled={busy !== null}
          onClick={() => run('CSV-Daten leeren', () => clearAllCsvSources(storage.idb))}
        >
          CSV leeren
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy !== null}
          onClick={() => run('Kurator-Flag AN', () => setKuratorOn(storage.idb))}
        >
          Kurator AN
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy !== null}
          onClick={() => run('Kurator-Flag AUS', () => setKuratorOff(storage.idb))}
        >
          Kurator AUS
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy !== null}
          onClick={() => run('Offline 60s', async () => { applyOfflineMode(60_000); })}
        >
          Offline 60s
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy !== null}
          onClick={onExportState}
        >
          State → Clipboard
        </Button>
      </DevRow>

      <DevRow label="Protokoll">
        <div className="w-full">
          <DevLog lines={log.map(format)} />
        </div>
      </DevRow>
    </div>
  );
}
