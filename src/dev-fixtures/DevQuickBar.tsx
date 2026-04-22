/**
 * Quick-Access-Bar für Dev-Builds. Nur gerendert wenn `__TEAMFLOW_DEV_FIXTURES__`
 * aktiv ist. Erlaubt Ein-Klick-Szenarien + Navigation zum State-Inspector.
 *
 * Visuell bewusst zurückhaltend (monospace, graue Fläche, schmale Höhe) damit
 * klar erkennbar ist, dass dies keine normale App-Navigation ist.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStorage } from '@/core/hooks/useStorage';
import { SCENARIOS, applyScenario, type ScenarioKey } from './scenarios';
import { applyOfflineMode } from './helpers';
import { exportCurrentState } from './actions';
import { pluginIdToRoute } from '@/core/routes';

export function DevQuickBar(): React.ReactElement {
  const storage = useStorage();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<'basis' | 'spezial' | null>(null);

  const run = async (label: string, fn: () => Promise<void>): Promise<void> => {
    setBusy(label);
    setFlash(null);
    const start = Date.now();
    try {
      await fn();
      setFlash(`✓ ${label} (${Date.now() - start} ms)`);
      window.setTimeout(() => setFlash(null), 3000);
    } catch (err) {
      setFlash(`✗ ${label}: ${(err as Error).message}`);
      console.error(err);
    } finally {
      setBusy(null);
      setMenuOpen(null);
    }
  };

  const onScenario = (key: ScenarioKey, label: string): void => {
    void run(`Szenario: ${label}`, () => applyScenario(storage, key));
  };

  const onExport = (): void => {
    void run('State → Clipboard', async () => {
      const dump = await exportCurrentState(storage.idb);
      await navigator.clipboard.writeText(JSON.stringify(dump, null, 2));
    });
  };

  const basis = SCENARIOS.filter(s => s.group === 'basis');
  const spezial = SCENARIOS.filter(s => s.group === 'spezial');

  const barStyle: React.CSSProperties = {
    borderBottom: '0.5px solid var(--tf-border)',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  };

  const btnBase = 'px-2 py-0.5 rounded bg-white/70 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div
      className="relative flex items-center gap-2 bg-amber-50 px-3 text-[11px] text-amber-900 shrink-0"
      style={{ ...barStyle, height: 28 }}
    >
      <span className="font-medium tracking-wider">🔧 DEV</span>
      <span className="opacity-50">│</span>

      <div className="relative">
        <button
          className={btnBase}
          disabled={busy !== null}
          onClick={() => setMenuOpen(menuOpen === 'basis' ? null : 'basis')}
        >
          Szenario ▾
        </button>
        {menuOpen === 'basis' && (
          <div
            className="absolute left-0 top-full mt-1 z-50 min-w-[220px] rounded-md bg-white p-1 shadow-lg"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            {basis.map(s => (
              <button
                key={s.key}
                className="w-full rounded px-2 py-1 text-left text-[11px] hover:bg-amber-50"
                onClick={() => onScenario(s.key, s.label)}
                title={s.description}
              >
                <div className="font-medium">{s.label}</div>
                <div className="text-[10px] text-gray-500">{s.description}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          className={btnBase}
          disabled={busy !== null}
          onClick={() => setMenuOpen(menuOpen === 'spezial' ? null : 'spezial')}
        >
          Spezialfälle ▾
        </button>
        {menuOpen === 'spezial' && (
          <div
            className="absolute left-0 top-full mt-1 z-50 min-w-[260px] rounded-md bg-white p-1 shadow-lg"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            {spezial.map(s => (
              <button
                key={s.key}
                className="w-full rounded px-2 py-1 text-left text-[11px] hover:bg-amber-50"
                onClick={() => onScenario(s.key, s.label)}
                title={s.description}
              >
                <div className="font-medium">{s.label}</div>
                <div className="text-[10px] text-gray-500">{s.description}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        className={btnBase}
        disabled={busy !== null}
        onClick={() => void run('Offline 60s', async () => { applyOfflineMode(60_000); })}
      >
        Offline 60s 📴
      </button>

      <button
        className={btnBase}
        disabled={busy !== null}
        onClick={onExport}
      >
        State 📋
      </button>

      <button
        className={btnBase}
        onClick={() => navigate(pluginIdToRoute('dev-state-inspector'))}
      >
        Inspector 🔍
      </button>

      <button
        className={btnBase}
        onClick={() => navigate(pluginIdToRoute('dev-infrastructure-test'))}
      >
        Infra 🧪
      </button>

      <div className="flex-1" />
      <span className="text-[10.5px] opacity-70 truncate">
        {busy ? `… ${busy}` : (flash ?? 'bereit')}
      </span>
    </div>
  );
}
