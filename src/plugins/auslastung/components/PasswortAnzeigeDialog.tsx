/**
 * PasswortAnzeigeDialog (v2.11) — zeigt der PL die generierten Klartext-
 * Zugangspasswoerter EINMALIG an.
 *
 * Wird nach „Zugangspasswort generieren" (pro MA) bzw. „Passwoerter fuer alle
 * aktiven MAs erzeugen" (Batch) geoeffnet. Die Passwoerter sind danach nicht
 * erneut anzeigbar (nur verschluesselt in `_intern/auslastung-zugang.enc`
 * gespeichert) — die PL notiert/verteilt sie jetzt.
 *
 * Bewusst getrennt vom bestehenden `PasswortDialog.tsx` (De-Anon-Passwort
 * SETZEN/EINGEBEN) — hier wird ein generiertes Passwort ANGEZEIGT.
 */
import { useMemo, useState } from 'react';
import { KeyRound, Copy, Check, X, Mail } from 'lucide-react';
import { Button } from '@/ui';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { buildKuerzelMailMap, buildMailtoUrl } from '../services/tib-mail';
import { DEFAULT_ZUGANG_EMAIL_BETREFF, DEFAULT_ZUGANG_EMAIL_VORLAGE } from '../types';

export interface ZugangPasswortEintrag {
  anonId: string;
  /** Echtes Kuerzel (nur sichtbar bei aktiver De-Anon-Session). */
  kuerzel: string;
  passwort: string;
}

interface Props {
  eintraege: ZugangPasswortEintrag[];
  onClose: () => void;
}

export function PasswortAnzeigeDialog({ eintraege, onClose }: Props): React.ReactElement {
  const [copied, setCopied] = useState<string | null>(null);

  // v2.12: E-Mail-Vorlage (PL-konfiguriert) + kuerzel→email-Map aus den Antraegen.
  // mailMap ist leer, solange die Bgl-Quelle nicht mit TIB_MAIL neu importiert
  // wurde → der „✉ E-Mail"-Link oeffnet dann Outlook ohne Empfaenger.
  const config = useAuslastungData(s => s.data.config);
  const betreff = config.zugangEmailBetreff ?? DEFAULT_ZUGANG_EMAIL_BETREFF;
  const vorlage = config.zugangEmailVorlage ?? DEFAULT_ZUGANG_EMAIL_VORLAGE;
  const cache = useAntraegeCache();
  const mailMap = useMemo(() => buildKuerzelMailMap(cache.antraege), [cache.antraege]);

  // Sync-Handler (keine roh-async onClick-Arrow): Clipboard-Write bewusst
  // best-effort mit .catch — unter file:// kann der Zugriff fehlen, das
  // Passwort bleibt dann sichtbar und manuell kopierbar.
  const copy = (text: string, key: string): void => {
    navigator.clipboard?.writeText(text)
      .then(() => {
        setCopied(key);
        window.setTimeout(() => setCopied(c => (c === key ? null : c)), 1500);
      })
      .catch(() => { /* Clipboard nicht verfuegbar — Passwort ist sichtbar. */ });
  };

  const copyAll = (): void => {
    copy(eintraege.map(e => `${e.kuerzel}\t${e.passwort}`).join('\n'), '__all__');
  };

  const single = eintraege.length === 1;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] max-h-[90vh] rounded-[16px] flex flex-col bg-[var(--tf-bg)]"
        style={{ border: '0.5px solid var(--tf-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ borderBottom: '0.5px solid var(--tf-border)' }}
        >
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-[var(--tf-primary)]" />
            <h2 className="text-[15px] font-medium text-[var(--tf-text)]">
              {single ? 'Zugangspasswort' : `Zugangspasswörter (${eintraege.length})`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]"
            aria-label="Schließen"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex flex-col gap-3">
          <p
            className="text-[12.5px] leading-relaxed"
            style={{ background: 'var(--tf-warning-bg)', color: 'var(--tf-warning-text)', borderRadius: 8, padding: '8px 10px' }}
          >
            Bitte jetzt sicher notieren und den Mitarbeitenden auf separatem Weg (z.B. E-Mail) zusenden.
            Das Passwort wird <strong>nicht erneut angezeigt</strong> (nur verschlüsselt gespeichert).
          </p>

          <div className="flex flex-col gap-1.5">
            {eintraege.map(e => (
              <div
                key={e.anonId}
                className="flex items-center gap-3 rounded-[8px] px-3 py-2"
                style={{ border: '0.5px solid var(--tf-border)' }}
              >
                <span
                  className="font-mono text-[12px] text-[var(--tf-text-secondary)] w-[130px] shrink-0 truncate"
                  title={`${e.anonId} · ${e.kuerzel}`}
                >
                  {e.kuerzel} <span className="text-[var(--tf-text-tertiary)]">({e.anonId})</span>
                </span>
                <code className="flex-1 text-[13px] font-medium text-[var(--tf-text)] select-all">{e.passwort}</code>
                <a
                  href={buildMailtoUrl(mailMap.get(e.kuerzel) ?? '', betreff, vorlage, { kuerzel: e.kuerzel, passwort: e.passwort, anonId: e.anonId })}
                  className="shrink-0 inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
                  title={mailMap.get(e.kuerzel) ? `E-Mail an ${mailMap.get(e.kuerzel)}` : 'Keine E-Mail hinterlegt — Empfänger manuell eintragen'}
                >
                  <Mail size={13} /> E-Mail
                </a>
                <button
                  type="button"
                  onClick={() => copy(e.passwort, e.anonId)}
                  className="shrink-0 inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
                  aria-label="Passwort kopieren"
                >
                  {copied === e.anonId ? <><Check size={13} /> Kopiert</> : <><Copy size={13} /> Kopieren</>}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div
          className="flex items-center justify-between gap-2 px-5 py-3 shrink-0"
          style={{ borderTop: '0.5px solid var(--tf-border)' }}
        >
          {!single ? (
            <button
              type="button"
              onClick={copyAll}
              className="inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
            >
              {copied === '__all__'
                ? <><Check size={14} /> Alle kopiert</>
                : <><Copy size={14} /> Alle kopieren (Kürzel + Passwort)</>}
            </button>
          ) : <span />}
          <Button onClick={onClose}>Fertig</Button>
        </div>
      </div>
    </div>
  );
}
