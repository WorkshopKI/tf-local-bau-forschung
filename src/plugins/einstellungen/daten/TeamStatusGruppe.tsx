/**
 * Gruppe „Team-Status" (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`, Screenshot 10, rechte Spalte).
 *
 * Zeigt, wer die App zuletzt genutzt hat — aus den Heartbeat-Dateien aller
 * User unter den Wurzeln der persönlichen Ordner. „Online" = Heartbeat jünger
 * als 5 Minuten; Auto-Refresh alle ~45 s, solange die Seite offen ist.
 * Serverless: kein Echtzeit-Presence, sondern „zuletzt aktiv vor X Min".
 *
 * Offen stehen nur die Verbinden-Zeilen (die brauchen einen Klick); die
 * Personenliste steht in der Klappe mit „N online · M zuletzt aktiv".
 *
 * Der Timer bleibt strikt non-invasiv (kein `requestPermission` ohne Klick);
 * dieselbe Person kann unter zwei Wurzeln liegen, deshalb fällt die Liste vor
 * dem Sortieren auf den jüngsten Heartbeat je Gerät zusammen.
 */
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { usePersoenlicheWurzeln, nurNutzbare } from '@/core/hooks/usePersoenlicheWurzeln';
import { WurzelnVerbinden } from '@/core/components/WurzelnVerbinden';
import { jeWurzel, formatiereSammelBericht, juengsterGewinnt } from '@/core/services/personal-roots';
import { collectHeartbeats, type OnlineUser } from '@/core/services/presence';
import { relativeZeitLang } from '@/core/utils/relativeZeit';
import { SettingsGruppe, SettingsKlappe, SettingsLeer } from '@/components/settings';

const REFRESH_INTERVAL_MS = 45_000;

const HINT_GRUPPE =
  '„Online" = in den letzten 5 Minuten aktiv, Aktualisierung alle 45 Sekunden. Wähle je Gruppe den übergeordneten Ordner, in dem die persönlichen Ordner der Kolleg:innen liegen — nur Lesezugriff, dieselben Ordner wie „Profile einsammeln" im Auslastung-Modul.';

export function TeamStatusGruppe(): React.ReactElement {
  const { wurzeln, zustaende, laden, neuLaden, verbinde, entferne } = usePersoenlicheWurzeln();
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [bericht, setBericht] = useState<string | null>(null);
  const [geladen, setGeladen] = useState(false);

  const uebernehmen = useCallback((list: OnlineUser[]) => {
    // Dieselbe Person kann unter zwei Wurzeln liegen (Gruppenwechsel,
    // Ordnerleiche). Erst je Gerät auf den jüngsten Heartbeat falten — sonst
    // entschiede die Wurzel-Reihenfolge, ob jemand „online" aussieht.
    const eindeutig = juengsterGewinnt(list, u => u.deviceId, u => u.lastActive);
    eindeutig.sort((a, b) =>
      Number(b.online) - Number(a.online) ||
      Date.parse(b.lastActive) - Date.parse(a.lastActive));
    setUsers(eindeutig);
    setGeladen(true);
  }, []);

  // Liest NUR bestehende, freigegebene Handles — KEIN Picker, KEIN
  // requestPermission (beides darf nur aus einer echten Klick-Geste kommen).
  const load = useAsyncAction(async () => {
    // Den frisch gelesenen Stand VERWENDEN, nicht den aus dem Render-Closure:
    // `setState` wirkt erst im nächsten Render.
    const stand = await neuLaden();
    const alle: OnlineUser[] = [];
    const b = await jeWurzel(stand.wurzeln, async root => {
      // Nicht freigegeben heißt NICHT „leer": als 0 gemeldet sähe die Wurzel
      // aus wie ein Ordner ohne Kolleg:innen.
      if (stand.zustaende[root.id] !== 'granted') return 'kein-zugriff';
      const teil = await collectHeartbeats(root.handle);
      alle.push(...teil);
      return teil.length;
    });
    setBericht(stand.wurzeln.length > 1 ? formatiereSammelBericht(b, { einheit: 'gelesen' }) : null);
    uebernehmen(alle);
  });

  useEffect(() => {
    void load.run();
    const h = window.setInterval(() => void load.run(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nach dem Verbinden einer Wurzel sofort nachladen — sonst bliebe die Liste
  // bis zum nächsten 45-s-Takt leer.
  const verbindeUndLade = useCallback(async (root: Parameters<typeof verbinde>[0]) => {
    await verbinde(root);
    await load.run();
  }, [verbinde, load]);

  const onlineAnzahl = users.filter(u => u.online).length;
  const nutzbare = nurNutzbare(wurzeln, zustaende);

  return (
    <SettingsGruppe
      id="sec-team"
      titel="Team-Status"
      hint={HINT_GRUPPE}
      unterzeile={
        nutzbare.length === 0
          ? 'Noch nicht aktiv — Ordner fehlen.'
          : `${onlineAnzahl} ${onlineAnzahl === 1 ? 'Person' : 'Personen'} online.`
      }
      aktion={
        <Button variant="ghost" size="sm" icon={RefreshCw} loading={load.busy} onClick={() => load.run()}>
          Aktualisieren
        </Button>
      }
    >
      {load.error && (
        <p className="text-[12px] text-[var(--tf-danger-text)] py-1.5">
          Konnte den Team-Status nicht laden: {load.error}
        </p>
      )}

      {!laden && (
        <div className="pt-1">
          <WurzelnVerbinden
            wurzeln={wurzeln}
            zustaende={zustaende}
            verbinde={verbindeUndLade}
            entferne={entferne}
          />
        </div>
      )}

      {bericht && geladen && (
        <p className="text-[12px] text-[var(--tf-text-tertiary)] pt-1.5">{bericht}</p>
      )}

      {nutzbare.length > 0 && (
        <SettingsKlappe
          id="sec-team-liste"
          label="Wer ist online"
          storageKey="teamflow_settings_teamstatus_collapsed"
          zaehler={
            users.length === 0
              ? '0'
              : `${onlineAnzahl} online · ${users.length - onlineAnzahl} zuletzt aktiv`
          }
        >
          {users.length === 0 ? (
            <SettingsLeer>
              {geladen ? 'Aktuell ist niemand online.' : 'Wird geladen…'}
            </SettingsLeer>
          ) : (
            <ul className="rounded-[var(--tf-radius)] overflow-hidden bg-[var(--tf-bg)]" style={{ border: '0.5px solid var(--tf-border)' }}>
              {users.map((u, i) => (
                <li
                  key={u.deviceId}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                  style={{ borderBottom: i < users.length - 1 ? '0.5px solid var(--tf-border)' : 'none' }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: u.online ? 'var(--tf-success-text)' : 'var(--tf-text-tertiary)' }}
                      title={u.online ? 'Online' : 'Offline'}
                    />
                    <span className={`text-[12.5px] truncate ${u.online ? 'text-[var(--tf-text)]' : 'text-[var(--tf-text-secondary)]'}`}>
                      {u.display}
                    </span>
                  </div>
                  <span className={`text-[11.5px] shrink-0 ${u.online ? 'text-[var(--tf-success-text)]' : 'text-[var(--tf-text-tertiary)]'}`}>
                    {relativeZeitLang(u.lastActive)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SettingsKlappe>
      )}
    </SettingsGruppe>
  );
}
