/**
 * StartupScreen (v2.0 + v2.0.1 + v4.0).
 *
 * Vier Render-Branches:
 *  - `needsShareUmzug` (v4.0): der Daten-Share ist auf einen neuen Ablageort
 *    umgezogen (Config-Generation > gespeicherte). Zeigt den neuen Pfad und
 *    erzwingt EINEN Re-Pick — der alte Handle bleibt bis dahin stehen.
 *  - `needsInitialPick` (v2.0.1): Variante hat fixedDataSharePath aber kein Handle
 *    in IDB. Zeigt Pfad-Hint + "Datenordner verbinden"-Button (Picker mit
 *    mode = isKurator ? 'readwrite' : 'read').
 *  - `needsDowngrade` (v2.0): bestehende Nicht-Kurator-User mit readwrite-Handle —
 *    Re-Pick mit read-Mode (Sicherheits-Update-Banner).
 *  - Default: "Starten"-Button → refreshAllPermissions() in einer User-Gesture-Kette.
 */

import { useState, useEffect } from 'react';
import { ArrowRight, FolderOpen, PackageOpen, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PfadKopierZeile } from '@/components/ui/PfadKopierZeile';
import { useStorage } from '@/core/hooks/useStorage';
import { GuidedGrantSteps } from '@/core/components/GuidedGrantSteps';
import {
  pickAndStoreDatenShareHandle,
  refreshAllPermissions,
  listPendingGrants,
  queryAllPermissions,
  type RefreshAllResult,
  type PendingGrant,
} from '@/core/services/infrastructure/smb-handle';
import { connectDataShare } from '@/core/services/infrastructure/connect-data-share';
import { useConnectionState } from '@/core/services/connection-status';
import { NEEDS_HANDLE_DOWNGRADE_IDB_KEY } from '@/core/services/infrastructure/types';
import { dataConfig, canWriteDatenShare } from '@/config/feature-flags';
import type { UserProfile } from '@/core/types/config';

interface StartupScreenProps {
  profile: UserProfile | null;
  /** Wenn true, zeigt der Screen das Migrations-Banner statt "Starten"-Button. */
  needsDowngrade: boolean;
  /** v2.0.1: true wenn kein Daten-Share-Handle in IDB liegt (Initial-Setup-Pfad). */
  needsInitialPick?: boolean;
  /** v4.0: true wenn der Daten-Share umgezogen ist (Umzugs-Banner + Re-Pick). */
  needsShareUmzug?: boolean;
  /** v4.0: laeuft nach erfolgreichem Umzugs-Re-Pick (statt `onReady`). */
  onUmzugFertig?: () => void;
  onReady: () => void;
}

export function StartupScreen({
  profile,
  needsDowngrade,
  needsInitialPick = false,
  needsShareUmzug = false,
  onUmzugFertig,
  onReady,
}: StartupScreenProps): React.ReactElement {
  const storage = useStorage();
  const applyRefreshResult = useConnectionState(s => s.applyRefreshResult);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isKurator = profile?.is_kurator === true || profile?.is_admin === true;
  const fixedPath = dataConfig.fixedDataSharePath;
  const expectedName = dataConfig.expectedFolderName;

  // v2.55: Guided-Grant-Stepper für den Default-Zweig (kein Initial-Pick/
  // Downgrade). Beim Mount non-invasiv prüfen, welche Handles noch eine
  // Freigabe brauchen (listPendingGrants). Sind alle granted → sofort
  // durchstarten (Warm-Start). Sonst Schritt-für-Schritt freigeben, ein
  // Prompt pro Klick (file://-„ein-Prompt-pro-Gesture", recurring-bug §2).
  const [stepperPending, setStepperPending] = useState<PendingGrant[] | null>(null);
  const [scanFailed, setScanFailed] = useState(false);

  // ConnectionState non-invasiv setzen (kein Prompt) + weiter. Gemeinsamer
  // Abschluss für Warm-Start (alle Handles granted) UND Stepper-Ende. WICHTIG:
  // auch der Warm-Start MUSS applyRefreshResult fahren — sonst bleibt
  // useConnectionState.mode auf INITIAL 'offline' (connection-status.ts) und der
  // OfflineBanner erscheint beim Reload, obwohl der Daten-Share erreichbar ist.
  const finishStartup = async (): Promise<void> => {
    try {
      applyRefreshResult(await queryAllPermissions(storage.idb, { isKurator }));
    } catch {
      /* best-effort — OfflineBanner kommuniziert ggf. den Zustand. */
    }
    onReady();
  };

  // Der Scan ist bewusst NUR ueber das cancelled-Flag entkoppelt, ohne
  // zusaetzlichen „schon gestartet"-Ref. Beides zusammen blockierte sich unter
  // StrictMode gegenseitig: Lauf 1 setzte den Ref und startete den Scan, das
  // Cleanup setzte cancelled=true, Lauf 2 lief am Ref-Guard sofort zurueck — und
  // das Ergebnis von Lauf 1 wurde als „abgebrochen" verworfen. Der Screen blieb
  // dauerhaft auf „Berechtigungen werden geprueft…" stehen. In gebauten
  // Varianten faellt das nicht auf (StrictMode doppelt Effekte nur im
  // React-Dev-Build); sichtbar wird es erst, seit die Variante „local" den
  // Dev-Server ueberhaupt bis hinter das Handle-Gate bringt.
  // `listPendingGrants` ist ein reiner queryPermission-Sweep ohne Prompt —
  // ein doppelter Lauf im Dev-Modus ist folgenlos.
  useEffect(() => {
    if (needsInitialPick || needsDowngrade || needsShareUmzug) return;
    let cancelled = false;
    void (async () => {
      try {
        const pending = await listPendingGrants(storage.idb, { isKurator });
        if (cancelled) return;
        if (pending.length === 0) {
          await finishStartup(); // Warm-Start: nichts anzufordern → ConnectionState setzen + weiter.
          return;
        }
        setStepperPending(pending);
      } catch {
        if (!cancelled) setScanFailed(true); // Fallback auf den Legacy-„Starten"-Button.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsInitialPick, needsDowngrade, needsShareUmzug]);

  const handleStart = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const result: RefreshAllResult = await refreshAllPermissions(storage.idb, { isKurator });
      applyRefreshResult(result);
      // Auch bei 'denied' / 'missing' fortfahren — der OfflineBanner uebernimmt
      // die Kommunikation. Der User kann die App immer noch offline nutzen.
      onReady();
    } catch (err) {
      setError((err as Error).message ?? 'Verbindung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const handleDowngrade = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const res = await pickAndStoreDatenShareHandle(storage.idb, { mode: 'read' });
      if (!res.ok) {
        if (res.reason !== 'aborted') {
          setError(res.message ?? 'Ordner-Auswahl fehlgeschlagen.');
        }
        return;
      }
      await storage.idb.delete(NEEDS_HANDLE_DOWNGRADE_IDB_KEY);
      const result = await refreshAllPermissions(storage.idb, { isKurator: false });
      applyRefreshResult(result);
      onReady();
    } catch (err) {
      setError((err as Error).message ?? 'Verbindung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const handleInitialPick = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      // Pick + Name-Check + Struktur-Validierung + refreshAllPermissions in einem
      // gemeinsamen Helfer (geteilt mit HomeCallToAction/OfflineBanner).
      const res = await connectDataShare(storage.idb, { isKurator });
      if (!res.ok) {
        if (res.reason !== 'aborted') {
          setError(res.message ?? 'Ordner-Auswahl fehlgeschlagen.');
        }
        return;
      }
      applyRefreshResult(res.refresh);
      onReady();
    } catch (err) {
      setError((err as Error).message ?? 'Verbindung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  // v4.0: Umzugs-Re-Pick. Derselbe Helfer wie beim Initial-Pick — er bringt den
  // Ordnernamen-Check mit, und genau der ist hier der Schutz gegen den falschen
  // Ordner. `connectDataShare` stempelt bei Erfolg die neue Generation und
  // rollt bei Namens-/Struktur-Fehlern auf den ALTEN Handle zurueck; scheitert
  // der Pick, bleibt dieser Zweig stehen und der Anwender kann es erneut
  // versuchen. Danach nicht direkt weiter, sondern zurueck ins Handle-Gate
  // (der Downgrade-Check wurde beim Umzug uebersprungen).
  const handleUmzugPick = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const res = await connectDataShare(storage.idb, { isKurator });
      if (!res.ok) {
        if (res.reason !== 'aborted') {
          setError(res.message ?? 'Ordner-Auswahl fehlgeschlagen.');
        }
        return;
      }
      applyRefreshResult(res.refresh);
      if (onUmzugFertig) onUmzugFertig();
      else onReady();
    } catch (err) {
      setError((err as Error).message ?? 'Verbindung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const display = profile?.name
    ? `${profile.name}${profile.bearbeiter_kuerzel ? ` (${profile.bearbeiter_kuerzel})` : ''}` // allow-direct-kuerzel: Startup laeuft VOR der MaLoginGate — Profilfeld ist hier die einzige Identitaetsquelle (Session existiert noch nicht)
    : 'Unbekannt';

  // Im Stepper-Zweig erscheint das Browser-Permission-Popup OBEN am Viewport.
  // Eine vertikal zentrierte Karte zwingt den User pro Ordner über die halbe
  // Bildschirmhöhe hin und zurück — bei drei Ordnern sechsmal. Deshalb dort die
  // Karte direkt unter die Popup-Zone setzen (fixer px-Wert: die Bubble ist ~200px
  // hoch und skaliert NICHT mit der Fenstergröße). Initial-Pick/Downgrade bleiben
  // zentriert — dort kommt kein Permission-Popup, sondern der Ordner-Picker.
  const unterPopupZone = !needsInitialPick && !needsDowngrade && !needsShareUmzug && stepperPending !== null;

  // `overflow-y-auto` ist Pflicht: mit dem Top-Offset ragt die Karte auf niedrigen
  // Viewports sonst unerreichbar aus dem Bild (gleiches Muster wie WelcomeScreen).
  const huelleClass = `fixed inset-0 flex justify-center overflow-y-auto bg-[var(--tf-bg)] z-50 ${unterPopupZone ? 'items-start pt-[210px] pb-10' : 'items-center'}`; // allow-raw-modal: Vollbild-Zustand, kein Modal

  return (
    <div className={huelleClass}>
      <div
        className="w-full max-w-[520px] mx-4 bg-[var(--tf-bg)] rounded-[16px] p-8"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-2">ZAH</h1>
        <p className="text-[13px] text-[var(--tf-text-secondary)] mb-6">
          Angemeldet als: <span className="text-[var(--tf-text)]">{display}</span>
        </p>

        {needsShareUmzug ? (
          <>
            <div className="flex items-start gap-2.5 mb-3">
              <PackageOpen size={16} className="mt-0.5 shrink-0 text-[var(--tf-text-secondary)]" />
              <div>
                <p className="font-medium text-[13px] text-[var(--tf-text)] mb-1">Der Datenordner ist umgezogen</p>
                <p className="text-[12.5px] text-[var(--tf-text-secondary)] leading-relaxed">
                  Bitte verbinden Sie die App einmalig mit dem neuen Ordner. Bis dahin
                  bleibt die bisherige Verbindung bestehen. Der neue Pfad lautet:
                </p>
              </div>
            </div>
            {fixedPath && <PfadKopierZeile pfad={fixedPath} className="mb-4" />}
            <ol className="text-[12.5px] text-[var(--tf-text-secondary)] space-y-1 mb-5 pl-5 list-decimal leading-relaxed">
              <li>Pfad oben kopieren</li>
              <li>Unten „Neuen Datenordner verbinden" klicken</li>
              <li>Im Dialog den Pfad einfügen und Enter drücken</li>
              {expectedName && (
                <li>
                  Ordner <code>{expectedName}</code> auswählen und bestätigen
                </li>
              )}
            </ol>
            <Button icon={FolderOpen} onClick={handleUmzugPick} disabled={busy} className="w-full">
              Neuen Datenordner verbinden
            </Button>
          </>
        ) : needsInitialPick ? (
          <>
            <p className="text-[13px] text-[var(--tf-text-secondary)] mb-3 leading-relaxed">
              Bevor es losgeht, verbinden Sie die App einmalig mit dem Datenspeicher.
              Der vorgegebene Pfad lautet:
            </p>
            {fixedPath && <PfadKopierZeile pfad={fixedPath} className="mb-4" />}
            <ol className="text-[12.5px] text-[var(--tf-text-secondary)] space-y-1 mb-5 pl-5 list-decimal leading-relaxed">
              <li>Pfad oben kopieren</li>
              <li>Unten „Datenordner verbinden" klicken</li>
              <li>Im Dialog den Pfad einfügen und Enter drücken</li>
              {expectedName && (
                <li>
                  Ordner <code>{expectedName}</code> auswählen und bestätigen
                </li>
              )}
            </ol>
            <Button icon={FolderOpen} onClick={handleInitialPick} disabled={busy} className="w-full">
              Datenordner verbinden
            </Button>
          </>
        ) : needsDowngrade ? (
          <div
            className="mb-5 p-4 rounded-[var(--tf-radius)] bg-[var(--tf-info-bg)] text-[var(--tf-info-text)] border border-[var(--tf-info-border)]"
          >
            <div className="flex items-start gap-2.5 mb-2">
              <ShieldCheck size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-[13px] mb-1">Sicherheits-Update</p>
                <p className="text-[12.5px] leading-relaxed">
                  Der Datenordner muss einmalig neu verbunden werden, damit die App
                  nur lesend zugreift. Klicken Sie auf den Button unten und wählen
                  Sie denselben Ordner wie bisher.
                </p>
              </div>
            </div>
            <Button icon={FolderOpen} onClick={handleDowngrade} disabled={busy} className="w-full mt-2">
              Datenordner neu verbinden
            </Button>
          </div>
        ) : scanFailed ? (
          <>
            <p className="text-[12.5px] text-[var(--tf-text-tertiary)] leading-relaxed mb-5">
              Beim Start kann der Browser einmalig nach Erlaubnis für den Datenordner
              {profile && !canWriteDatenShare(isKurator) ? ' (Lese-Zugriff)' : ''} und Ihren persönlichen
              Ordner fragen. Wenn die Erlaubnis noch gültig ist (z.&nbsp;B. ein weiterer Tab ist
              offen), startet die App direkt.
            </p>
            <Button icon={ArrowRight} onClick={handleStart} disabled={busy} className="w-full">
              Starten
            </Button>
          </>
        ) : stepperPending ? (
          <GuidedGrantSteps
            pending={stepperPending}
            rescan={() => listPendingGrants(storage.idb, { isKurator })}
            onComplete={finishStartup}
          />
        ) : (
          <p className="text-[12.5px] text-[var(--tf-text-tertiary)] leading-relaxed">
            Berechtigungen werden geprüft…
          </p>
        )}

        {error && (
          <p className="mt-4 text-[12.5px] text-[var(--tf-danger-text)]">{error}</p>
        )}
      </div>
    </div>
  );
}
