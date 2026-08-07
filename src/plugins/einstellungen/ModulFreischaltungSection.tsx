/**
 * Module per Zusatzpasswort freischalten (v3.0).
 *
 * Loest den fruehren `KuratorSessionPanel` ab. Der hatte Setup-, Login- und
 * Passwort-aendern-Dialoge gegen `_intern/kurator-config.enc` — eine zweite
 * Passwort-Mechanik neben der App-Wall. Geblieben ist der Build-Weg: verifiziert
 * wird gegen den in die Config eingebackenen Verifier, wie beim App-Passwort.
 *
 * Zwei Zustaende je Modul: gesperrt (Passwortfeld) oder frei (Restlaufzeit +
 * „Sperren"). Nach einer Freischaltung wird neu geladen — der Zustand liegt in
 * der IndexedDB und uebersteht das, und dadurch bleiben alle Sichtbarkeits-
 * Praedikate schlichte Konstanten, die beim Start EINMAL aufgeloest werden.
 *
 * Rendert nichts, wenn der Build keine Schloesser traegt (dev/local/prod).
 */
import { useEffect, useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useModulFreischaltung } from '@/core/hooks/useModulFreischaltung';
import { verifyModulPassword } from '@/core/services/infrastructure/app-password';
import { refreshAllPermissions } from '@/core/services/infrastructure/smb-handle';
import { useConnectionState } from '@/core/services/connection-status';
import { hatModulSchloss, hatIrgendeinModulSchloss } from '@/config/feature-flags';
import { runtimeConfig, MODUL_SLOTS, type ModulSlot } from '@/config/runtime-config';
import { SettingsSectionHeader } from './_shared/settings-primitives';

const TITEL: Record<ModulSlot, string> = {
  auslastung: 'Auslastung',
  kurator: 'Kuration',
};

const BESCHREIBUNG: Record<ModulSlot, string> = {
  auslastung: 'Kategorisierung, MA-Zuweisung und Themen-Vektoren.',
  kurator: 'Programme, CSV-Quellen, Filter, Suchindex und Feedback-Verwaltung.',
};

/** Restlaufzeit als „7 h 12 m" — sekundengenau waere hier nur Unruhe. */
function restLabel(bis: number | null): string {
  if (bis === null) return '';
  const diff = bis - Date.now();
  if (diff <= 0) return 'abgelaufen';
  const min = Math.floor(diff / 60_000);
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} h ${min % 60} m` : `${min} m`;
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

  // Minuetlich neu rendern, damit die Restlaufzeit nicht einfriert.
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
      // Menue-Sichtbarkeit haengt an der Profil-Flagge (ShellLayout liest sie
      // UND die Session — die Flagge allein oeffnet nichts mehr).
      await updateProfile({ is_kurator: true });
      // Handle im selben User-Gesture auf readwrite hochstufen (Pitfall #25):
      // ein Erst-Start ohne Kurator-Recht hat evtl. nur `read` erhalten.
      try {
        const refreshed = await refreshAllPermissions(storage.idb, { isKurator: true });
        applyRefreshResult(refreshed);
      } catch {
        /* best-effort — der naechste Start stuft hoch. */
      }
    } else {
      await useModulFreischaltung.getState().freischalten(storage.idb);
    }
    // Neu laden: Plugin-Registrierung, onInit-Hooks und modul-globale Konstanten
    // wurden beim Start auf „gesperrt" aufgeloest.
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

  return (
    <div className="py-3" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
      <div className="flex items-center gap-2 mb-1">
        {frei
          ? <LockOpen size={14} className="text-[var(--tf-primary)]" />
          : <Lock size={14} className="text-[var(--tf-text-tertiary)]" />}
        <span className="text-[13.5px] font-medium text-[var(--tf-text)]">{TITEL[slot]}</span>
        <span className="text-[12px] text-[var(--tf-text-tertiary)]">
          {frei ? `frei — noch ${restLabel(bis)}` : 'gesperrt'}
        </span>
      </div>
      <p className="text-[12.5px] text-[var(--tf-text-secondary)] mb-2">{BESCHREIBUNG[slot]}</p>

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
            onKeyDown={e => { if (e.key === 'Enter' && pw) void freischalten.run(); }}
            placeholder="Zusatzpasswort"
            className="max-w-[220px]"
            aria-label={`Zusatzpasswort für ${TITEL[slot]}`}
          />
          <Button type="button" variant="primary" size="sm" onClick={() => freischalten.run()} disabled={!pw || freischalten.busy}>
            {freischalten.busy ? 'Prüfen…' : 'Freischalten'}
          </Button>
        </div>
      )}

      {falsch && <p className="text-[12px] text-[var(--tf-danger-text)] mt-1.5">Passwort falsch.</p>}
      {/* Fehler NACH der Passwortpruefung (z.B. IDB-Schreibfehler). Ohne diese
          Zeile bricht die Aktion stumm ab und sieht aus wie „Klick tut nichts". */}
      {freischalten.error && (
        <p className="text-[12px] text-[var(--tf-danger-text)] mt-1.5">
          Freischaltung konnte nicht gespeichert werden: {freischalten.error}
        </p>
      )}
      {sperren.error && (
        <p className="text-[12px] text-[var(--tf-danger-text)] mt-1.5">
          Sperren fehlgeschlagen: {sperren.error}
        </p>
      )}
      {!frei && hinweis && <p className="text-[12px] text-[var(--tf-text-tertiary)] mt-1.5">{hinweis}</p>}
    </div>
  );
}

export function ModulFreischaltungSection(): React.ReactElement | null {
  if (!hatIrgendeinModulSchloss()) return null;

  return (
    <section id="sec-freischaltung" className="scroll-mt-20">
      <SettingsSectionHeader label="Module freischalten" />
      <p className="text-[12.5px] text-[var(--tf-text-secondary)] mb-1">
        Diese Bereiche sind mit einem Zusatzpasswort geschützt. Eine Freischaltung gilt
        12 Stunden und übersteht einen Neustart der App.
      </p>
      {MODUL_SLOTS.map(slot => <ModulZeile key={slot} slot={slot} />)}
    </section>
  );
}
