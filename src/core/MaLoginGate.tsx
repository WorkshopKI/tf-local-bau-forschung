/**
 * MaLoginGate (v2.11).
 *
 * Vollbild-Pflicht-Login fuer prod-User (`features.maLogin`). Wird im
 * Startup-Flow von App.tsx NACH dem StartupScreen (Daten-Share-Permission
 * steht, damit die Zugangsdatei lesbar ist) und VOR dem AppRouter gerendert,
 * wenn `_intern/auslastung-zugang.enc` existiert (`zugangsdateiVorhanden`) aber
 * keine gueltige Session aus sessionStorage rehydriert wurde.
 *
 * Ein Feld: NUR das Passwort (kein Kuerzel/Personalnummer-Hint). Das Kuerzel
 * wird daraus entschluesselt — die App probiert das Passwort gegen alle
 * Eintraege durch (~N× PBKDF2 im Web Worker → Spinner bleibt fluessig). Kein
 * Abbrechen/Ueberspringen: ohne korrektes Passwort kein App-Zugang.
 */
import { useState } from 'react';
import { LogIn, KeyRound } from 'lucide-react';
import { Button } from '@/ui';
import { Input } from '@/components/ui/input';
import { useStorage } from '@/core/hooks/useStorage';
import { useMAIdentity } from '@/core/hooks/useMAIdentity';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';

interface MaLoginGateProps {
  onSuccess: () => void;
}

export function MaLoginGate({ onSuccess }: MaLoginGateProps): React.ReactElement {
  const storage = useStorage();
  const session = useMAIdentity();
  const [pw, setPw] = useState('');
  const [wrong, setWrong] = useState(false);

  const login = useAsyncAction(async () => {
    setWrong(false);
    const ok = await session.login(storage.idb, pw);
    if (!ok) {
      setWrong(true);
      return;
    }
    onSuccess();
  });

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--tf-bg)] z-50">
      <div
        className="w-full max-w-[420px] mx-4 bg-[var(--tf-bg)] rounded-[16px] p-8"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <div className="flex items-center gap-2.5 mb-2">
          <KeyRound size={22} className="text-[var(--tf-primary)]" />
          <h1 className="text-[20px] font-medium text-[var(--tf-text)]">Anmeldung</h1>
        </div>
        <p className="text-[13px] text-[var(--tf-text-secondary)] mb-6 leading-relaxed">
          Bitte dein persönliches Passwort eingeben. Dein Kürzel wird daraus ermittelt.
        </p>

        <Input
          type="password"
          placeholder="Passwort"
          value={pw}
          onChange={e => { setPw(e.target.value); if (wrong) setWrong(false); }}
          onKeyDown={e => { if (e.key === 'Enter' && pw && !login.busy) { e.preventDefault(); void login.run(); } }}
          disabled={login.busy}
          autoFocus
        />

        {wrong && (
          <p className="mt-2 text-[12.5px] text-[var(--tf-danger-text)]">Passwort falsch.</p>
        )}
        {login.error && (
          <p className="mt-2 text-[12.5px] text-[var(--tf-danger-text)]">{login.error}</p>
        )}

        <Button
          icon={LogIn}
          loading={login.busy}
          onClick={() => { void login.run(); }}
          disabled={pw.length === 0}
          className="w-full mt-5"
        >
          {login.busy ? 'Wird geprüft…' : 'Anmelden'}
        </Button>

        <p className="mt-4 text-[11.5px] text-[var(--tf-text-tertiary)] text-center">
          Passwort vergessen? → Projektleitung
        </p>
      </div>
    </div>
  );
}
