/**
 * Online-Tab (Einstellungen, nur pl/dev — gegated via `isOnlineStatusTabEnabled`).
 *
 * Zeigt, wer die App zuletzt genutzt hat — aus den Heartbeat-Dateien
 * (`ZAH/online-status.json`) aller User unter den Wurzeln der persoenlichen
 * Ordner. „Online" = Heartbeat juenger als ONLINE_STALE_WINDOW_MS (5 Min).
 * Auto-Refresh alle ~45 s, solange der Tab offen ist. Serverless: kein
 * Echtzeit-Presence, sondern „zuletzt aktiv vor X Min".
 *
 * Seit v4.1 mehrere Wurzeln: der Timer bleibt strikt non-invasiv (kein
 * `requestPermission` ohne Klick), das Verbinden laeuft ueber `WurzelnVerbinden`
 * — eine Zeile, ein Knopf, ein Dialog je Gruppe. Dieselbe Person kann unter
 * zwei Wurzeln liegen, deshalb faellt die Liste vor dem Sortieren auf den
 * juengsten Heartbeat je Geraet zusammen.
 */
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { usePersoenlicheWurzeln, nurNutzbare } from '@/core/hooks/usePersoenlicheWurzeln';
import { WurzelnVerbinden } from '@/core/components/WurzelnVerbinden';
import { jeWurzel, formatiereSammelBericht, juengsterGewinnt } from '@/core/services/personal-roots';
import { collectHeartbeats, type OnlineUser } from '@/core/services/presence';
// Direktimport statt Barrel: `@/components/feedback` zieht `FeedbackPanel` mit, das
// wiederum `@/plugins.config` laedt — ueber die Einstellungen-Plugin-Kette entstuende
// ein Laufzeit-Zyklus. `feedbackUi.ts` haengt nur an lucide + Typen + `./constants`.
import { relativeZeitLang } from '@/core/utils/relativeZeit';
import { SettingsSectionHeader } from './_shared/settings-primitives';

const REFRESH_INTERVAL_MS = 45_000;

export function OnlineTab(): React.ReactElement {
  const { wurzeln, zustaende, laden, neuLaden, verbinde, entferne } = usePersoenlicheWurzeln();
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [bericht, setBericht] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const applyList = useCallback((list: OnlineUser[]) => {
    // Dieselbe Person kann unter zwei Wurzeln liegen (Gruppenwechsel,
    // Ordnerleiche). Erst je Geraet auf den juengsten Heartbeat falten — sonst
    // entschiede die Wurzel-Reihenfolge, ob jemand „online" aussieht. Geraet,
    // nicht Person: eine Person hat legitim mehrere Geraete.
    const eindeutig = juengsterGewinnt(list, u => u.deviceId, u => u.lastActive);
    // Online zuerst, dann nach Aktualitaet absteigend.
    eindeutig.sort((a, b) =>
      Number(b.online) - Number(a.online) ||
      Date.parse(b.lastActive) - Date.parse(a.lastActive));
    setUsers(eindeutig);
    setLoaded(true);
  }, []);

  // Auto-/Manuell-Refresh: liest NUR bestehende, freigegebene Handles — KEIN
  // Picker und KEIN requestPermission (beides darf ausschliesslich aus einer
  // echten Klick-Geste kommen; `usePersoenlicheWurzeln` prueft non-invasiv).
  const load = useAsyncAction(async () => {
    // Den frisch gelesenen Stand VERWENDEN, nicht den aus dem Render-Closure:
    // `setState` wirkt erst im naechsten Render, `wurzeln` waere hier beim
    // ersten Lauf noch das leere Array (und der Tab bliebe bis zum 45-s-Takt
    // stumm — genau so ist es in der Abnahme aufgefallen).
    const stand = await neuLaden();
    const alle: OnlineUser[] = [];
    const b = await jeWurzel(stand.wurzeln, async root => {
      if (stand.zustaende[root.id] !== 'granted') return 0;
      const teil = await collectHeartbeats(root.handle);
      alle.push(...teil);
      return teil.length;
    });
    setBericht(stand.wurzeln.length > 1 ? formatiereSammelBericht(b, { einheit: 'gelesen' }) : null);
    applyList(alle);
  });

  useEffect(() => {
    void load.run();
    const h = window.setInterval(() => void load.run(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nach dem Verbinden einer Wurzel sofort nachladen — sonst bliebe die Liste
  // bis zum naechsten 45-s-Takt leer.
  const verbindeUndLade = useCallback(async (root: Parameters<typeof verbinde>[0]) => {
    await verbinde(root);
    await load.run();
  }, [verbinde, load]);

  const onlineCount = users.filter(u => u.online).length;
  const nutzbare = nurNutzbare(wurzeln, zustaende);

  return (
    <section id="sec-team" className="scroll-mt-20 space-y-5">
      <SettingsSectionHeader
        label="Team-Status"
        hint={'„Online" = in den letzten 5 Minuten aktiv. Aktualisiert sich alle 45 Sekunden. Liest nur den übergeordneten Ordner der persönlichen Ordner (Lesezugriff, einmalig).'}
        action={
          <Button variant="secondary" size="sm" icon={RefreshCw} loading={load.busy}
            onClick={() => load.run()}>
            Aktualisieren
          </Button>
        }
      />
      <p className="text-[13px] text-[var(--tf-text-secondary)] max-w-prose">
        Wer die App zuletzt genutzt hat. „Online" = in den letzten 5&nbsp;Minuten
        aktiv. Aktualisiert sich automatisch alle 45&nbsp;Sekunden.
      </p>

      {load.error && (
        <div className="text-[13px] rounded-[var(--tf-radius)] px-3 py-2 bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]"
          style={{ border: '0.5px solid var(--tf-danger-border)' }}>
          Konnte den Online-Status nicht laden: {load.error}
        </div>
      )}

      {!laden && (
        <WurzelnVerbinden
          wurzeln={wurzeln}
          zustaende={zustaende}
          verbinde={verbindeUndLade}
          entferne={entferne}
          hinweis={'Wähle je Gruppe den übergeordneten Ordner mit den persönlichen Ordnern der Teammitglieder — das Verzeichnis, in dem die Ordner der Kolleg:innen liegen. Nur Lesezugriff. Es sind dieselben Ordner wie für „Profile einsammeln" im Auslastung-Modul.'}
        />
      )}

      {bericht && loaded && (
        <p className="text-[12px] text-[var(--tf-text-secondary)]">{bericht}</p>
      )}

      {nutzbare.length > 0 && loaded && users.length === 0 && (
        <div className="text-[13px] text-[var(--tf-text-secondary)] rounded-[var(--tf-radius)] px-3 py-3"
          style={{ border: '0.5px solid var(--tf-border)' }}>
          Aktuell ist niemand online.
        </div>
      )}

      {users.length > 0 && (
        <div className="space-y-2">
          <div className="text-[12px] text-[var(--tf-text-secondary)]">
            {onlineCount} {onlineCount === 1 ? 'Person' : 'Personen'} online
            {users.length > onlineCount && ` · ${users.length - onlineCount} zuletzt aktiv`}
          </div>
          <ul className="rounded-[var(--tf-radius)] overflow-hidden" style={{ border: '0.5px solid var(--tf-border)' }}>
            {users.map((u, i) => (
              <li key={u.deviceId}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                style={{ borderBottom: i < users.length - 1 ? '0.5px solid var(--tf-border)' : 'none' }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: u.online ? 'var(--tf-success-text)' : 'var(--tf-text-secondary)' }}
                    title={u.online ? 'Online' : 'Offline'} />
                  <span className={`text-[13px] truncate ${u.online ? 'text-[var(--tf-text)]' : 'text-[var(--tf-text-secondary)]'}`}>
                    {u.display}
                  </span>
                </div>
                <span className={`text-[12px] shrink-0 ${u.online ? 'text-[var(--tf-success-text)]' : 'text-[var(--tf-text-secondary)]'}`}>
                  {relativeZeitLang(u.lastActive)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
