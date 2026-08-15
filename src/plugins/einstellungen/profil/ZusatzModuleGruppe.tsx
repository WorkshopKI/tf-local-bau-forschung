/**
 * Gruppe „Zusatz-Module" — was hinter einem Zusatzpasswort liegt
 * (Design-Handoff `_design/handoff/einstellungen-zweispaltig`, Screenshot 01).
 *
 * Je Modul eine Zeile: Name, Restlaufzeit als Status-Badge, Kurzbeschreibung
 * und rechts die Aktion („Freischalten" mit Passwortfeld bzw. „Sperren"). Die
 * Passwortregel stand bis v4.27 als Absatz über der Sektion — sie steht jetzt
 * im ⓘ am Gruppentitel.
 *
 * In Builds ohne Schloss (dev/local) gibt es stattdessen den freien
 * Kurator-Schalter (`sec-kurator`) — wo ein Schloss existiert, wäre er die
 * offene Hintertür daneben.
 */
import { useEffect, useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { restlaufzeitLabel, useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useModulFreischaltung } from '@/core/hooks/useModulFreischaltung';
import { verifyModulPassword } from '@/core/services/infrastructure/app-password';
import { refreshAllPermissions } from '@/core/services/infrastructure/smb-handle';
import { useConnectionState } from '@/core/services/connection-status';
import { hatModulSchloss, hatIrgendeinModulSchloss, isKuratorMenusEnabled } from '@/config/feature-flags';
import { spiegleKuratorSchalterInSession } from '@/core/modul-freischaltung';
import { runtimeConfig, MODUL_SLOTS, type ModulSlot } from '@/config/runtime-config';
import {
  SettingsGruppe,
  SettingsOption,
  SettingsStatusBadge,
} from '@/components/settings';

const TITEL: Record<ModulSlot, string> = {
  auslastung: 'Auslastung',
  kurator: 'Kuration',
};

const BESCHREIBUNG: Record<ModulSlot, string> = {
  auslastung: 'Kategorisierung, MA-Zuweisung, Themen-Vektoren',
  kurator: 'Programme, CSV-Quellen, Filter, Suchindex, Feedback',
};

const HINT_GRUPPE =
  'Diese Bereiche sind mit einem Zusatzpasswort geschützt. Eine Freischaltung gilt 12 Stunden und übersteht das Neuladen der Seite. Die nächste Anmeldung setzt sie neu — dann zählt wieder, welches Passwort eingegeben wurde.';
const HINT_KURATOR_FREI =
  'Schaltet die Kurations-Menüpunkte (Suchindex, Programme, CSV-Quellen, Filter, Feedback-Verwaltung, Review) in der Sidebar frei. In Builds mit Zusatzpasswort gibt es diesen Schalter nicht.';

/** Restlaufzeit als „7 h 12 m" — sekundengenau wäre hier nur Unruhe. */
export function ZusatzModuleGruppe(): React.ReactElement | null {
  const schloesser = hatIrgendeinModulSchloss();
  const freierSchalter = isKuratorMenusEnabled() && !hatModulSchloss('kurator');
  if (!schloesser && !freierSchalter) return null;

  return (
    <SettingsGruppe
      // Der Anker steht nur, wo die Registry ihn auch führt (`hatIrgendeinModulSchloss`) —
      // sonst zeigte die Seite ein Sprungziel, das die Suche gar nicht kennt.
      id={schloesser ? 'sec-freischaltung' : undefined}
      titel="Zusatz-Module"
      hint={schloesser ? HINT_GRUPPE : undefined}
      unterzeile={schloesser ? 'Freigeschaltet, bis die Zeit abläuft.' : undefined}
    >
      {schloesser && MODUL_SLOTS.map(slot => <ModulZeile key={slot} slot={slot} />)}
      {freierSchalter && <KuratorSchalter />}
    </SettingsGruppe>
  );
}

function ModulZeile({ slot }: { slot: ModulSlot }): React.ReactElement | null {
  const storage = useStorage();
  const { updateProfile } = useProfile();
  const applyRefreshResult = useConnectionState(s => s.applyRefreshResult);
  const kuratorAktiv = useKuratorSession(s => s.isActive);
  const kuratorBis = useKuratorSession(s => s.expiresAt);
  const auslastungFrei = useModulFreischaltung(s => s.auslastungFrei);
  const auslastungBis = useModulFreischaltung(s => s.auslastungBis);

  const [pw, setPw] = useState('');
  const [falsch, setFalsch] = useState(false);
  const [, tick] = useState(0);

  // Minütlich neu rendern, damit die Restlaufzeit nicht einfriert.
  useEffect(() => {
    const h = window.setInterval(() => tick(n => n + 1), 60_000);
    return () => window.clearInterval(h);
  }, []);

  const frei = slot === 'kurator' ? kuratorAktiv : auslastungFrei;
  const bis = slot === 'kurator' ? kuratorBis : auslastungBis;

  const freischalten = useAsyncAction(async () => {
    setFalsch(false);
    const ok = await verifyModulPassword(slot, pw);
    if (!ok) {
      setFalsch(true);
      return;
    }
    if (slot === 'kurator') {
      await useKuratorSession.getState().aktiviere(storage.idb, `${runtimeConfig.build.label} · Kurator`);
      // Menü-Sichtbarkeit hängt an der Profil-Flagge (ShellLayout liest sie UND
      // die Session — die Flagge allein öffnet nichts mehr).
      await updateProfile({ is_kurator: true });
      // Handle im selben User-Gesture auf readwrite hochstufen (Pitfall #25):
      // ein Erst-Start ohne Kurator-Recht hat evtl. nur `read` erhalten.
      try {
        const refreshed = await refreshAllPermissions(storage.idb, { isKurator: true });
        applyRefreshResult(refreshed);
      } catch {
        /* best-effort — der nächste Start stuft hoch. */
      }
    } else {
      await useModulFreischaltung.getState().freischalten(storage.idb);
    }
    // Neu laden: Plugin-Registrierung, onInit-Hooks und modul-globale Konstanten
    // wurden beim Start auf „gesperrt" aufgelöst.
    window.location.reload();
  });

  const sperren = useAsyncAction(async () => {
    if (slot === 'kurator') {
      await useKuratorSession.getState().deactivate(storage.idb);
      await updateProfile({ is_kurator: false });
    } else {
      await useModulFreischaltung.getState().sperren(storage.idb);
    }
    window.location.reload();
  });

  if (!hatModulSchloss(slot)) return null;

  const hinweis = runtimeConfig.moduleAuth?.[slot]?.hint;
  const fehler = freischalten.error
    ? `Freischaltung konnte nicht gespeichert werden: ${freischalten.error}`
    : sperren.error
      ? `Sperren fehlgeschlagen: ${sperren.error}`
      : falsch
        ? 'Passwort falsch.'
        : null;

  return (
    <SettingsOption
      oben
      label={
        <span className="inline-flex items-center gap-2">
          {frei
            ? <LockOpen size={13} className="text-[var(--tf-primary)] shrink-0" />
            : <Lock size={13} className="text-[var(--tf-text-tertiary)] shrink-0" />}
          {TITEL[slot]}
        </span>
      }
      badge={
        <SettingsStatusBadge ton={frei ? 'ok' : 'neutral'}>
          {frei ? `noch ${restlaufzeitLabel(bis)}` : 'gesperrt'}
        </SettingsStatusBadge>
      }
      kurzzeile={
        <>
          {BESCHREIBUNG[slot]}
          {fehler && (
            <span className="block text-[var(--tf-danger-text)] mt-1">{fehler}</span>
          )}
          {!frei && hinweis && <span className="block mt-1">{hinweis}</span>}
        </>
      }
    >
      {frei ? (
        <Button type="button" variant="secondary" size="sm" onClick={() => sperren.run()} disabled={sperren.busy}>
          Sperren
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            type="password"
            value={pw}
            onChange={e => { setPw(e.target.value); setFalsch(false); }}
            onKeyDown={e => { if (e.key === 'Enter' && pw) freischalten.run(); }}
            placeholder="Zusatzpasswort"
            className="max-w-[160px]"
            aria-label={`Zusatzpasswort für ${TITEL[slot]}`}
          />
          <Button type="button" variant="primary" size="sm" onClick={() => freischalten.run()} disabled={!pw || freischalten.busy}>
            {freischalten.busy ? 'Prüfen…' : 'Freischalten'}
          </Button>
        </div>
      )}
    </SettingsOption>
  );
}

function KuratorSchalter(): React.ReactElement {
  const storage = useStorage();
  const { profile, updateProfile } = useProfile();
  const applyRefreshResult = useConnectionState(s => s.applyRefreshResult);

  /**
   * Ohne Schloss ist dieser Schalter der EINZIGE Kurator-Gate — er muss deshalb
   * dasselbe tun wie der Passwort-Weg oben: Profil-Flagge UND Sitzung. Bis v4.59
   * setzte er nur die Flagge; die Menüs erschienen, aber jede Schreib-Aktion
   * darin blieb grau, weil sie an `session.isActive` hängt.
   */
  const umschalten = useAsyncAction(async (v: boolean) => {
    await updateProfile({ is_kurator: v });
    await spiegleKuratorSchalterInSession(storage.idb, v);
    if (v) {
      // Handle im selben User-Gesture auf readwrite hochstufen (Pitfall #25) —
      // ein Start ohne Kurator-Recht hat evtl. nur `read` erhalten.
      try {
        applyRefreshResult(await refreshAllPermissions(storage.idb, { isKurator: true }));
      } catch {
        /* best-effort — der nächste Start stuft hoch. */
      }
    }
  });

  return (
    <SettingsOption id="sec-kurator" label="Kurator-Menüs" hint={HINT_KURATOR_FREI}>
      <Switch
        checked={!!(profile?.is_kurator ?? profile?.is_admin)}
        onCheckedChange={v => umschalten.run(v)}
        disabled={umschalten.busy}
        aria-label="Kurator-Menüs aktivieren"
      />
    </SettingsOption>
  );
}
