/**
 * Globale Auslastungs-Config: Stunden pro TV, Quartal, Gewichtungen, Frist.
 * Section im Admin-Tab.
 */
import { useState } from 'react';
import type { StorageService } from '@/core/services/storage';
import { isMaVerwaltungPasswortEnabled } from '@/config/feature-flags';
import { useAuslastungData } from '../../hooks/useAuslastungData';
import { useDeAnonResolver } from '../../components/AnonymIdBadge';
import { ZugangVerwaltungDialog, type MaZugangItem } from '../../components/ZugangVerwaltungDialog';
import {
  ALL_ANTRAGSTYP_BUCKETS,
  DEFAULT_ZUGANG_EMAIL_BETREFF,
  DEFAULT_ZUGANG_EMAIL_VORLAGE,
  type AntragstypBucket,
} from '../../types';

interface Props {
  storage: StorageService;
}

export function KonfigurationSection({ storage }: Props): React.ReactElement {
  const config = useAuslastungData(s => s.data.config);
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);
  const updateConfig = useAuslastungData(s => s.updateConfig);
  const [busy, setBusy] = useState(false);

  // Zugangspasswort-Verwaltung (Übersicht ALLER aktiven MAs + erzeugen/neu
  // erzeugen + E-Mail-Versand). Lag bis v2.205 im Header des Tabs „Auslastung MA"
  // (MaListSection); jetzt hier bei der zugehörigen E-Mail-Vorlage. Die Liste wird
  // EINMALIG beim Klick gebaut (stabile Referenz für den Dialog-Mount-Effekt). Nur
  // maVerwaltungs-Passwort-Flag + aktive De-Anon-Session (braucht das Klartext-
  // Kürzel pro anonId).
  const resolveName = useDeAnonResolver();
  const [zugangListe, setZugangListe] = useState<MaZugangItem[] | null>(null);

  function openZugangVerwaltung(): void {
    const liste: MaZugangItem[] = Object.values(mitarbeiter)
      .filter(m => m.aktiv)
      .map(m => ({ anonId: m.anonId, kuerzel: resolveName(m.anonId) ?? '' }))
      .filter(x => x.kuerzel);
    setZugangListe(liste);
  }

  async function update(partial: Parameters<typeof updateConfig>[1]): Promise<void> {
    setBusy(true);
    try { await updateConfig(storage, partial); } finally { setBusy(false); }
  }

  // v2.12 Fix: E-Mail-Vorlage in LOKALEM Draft-State editieren und NUR beim
  // Verlassen des Feldes (onBlur) persistieren. Sonst schrieb jeder Tastendruck
  // das ganze auslastung.json auf den SMB-Share → UI fror bei langem Text ein.
  // (Init-once aus config — die Auslastungs-Daten sind beim Öffnen dieser
  // Sektion längst geladen.)
  const [betreff, setBetreff] = useState(config.zugangEmailBetreff ?? DEFAULT_ZUGANG_EMAIL_BETREFF);
  const [vorlage, setVorlage] = useState(config.zugangEmailVorlage ?? DEFAULT_ZUGANG_EMAIL_VORLAGE);
  const [emailSaved, setEmailSaved] = useState(false);

  // v2.31: Antragstyp-spezifischer Stunden-pro-TV-Override. Leeres/0-Feld → Key
  // entfernen (Standard greift via `stundenProTVFor`).
  function updateTyp(bucket: AntragstypBucket, raw: string): void {
    const next: Partial<Record<AntragstypBucket, number>> = { ...(config.stundenProTVProTyp ?? {}) };
    const v = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(v) || v <= 0) {
      delete next[bucket];
    } else {
      next[bucket] = v;
    }
    void update({ stundenProTVProTyp: next });
  }

  function commitEmail(): void {
    const curB = config.zugangEmailBetreff ?? DEFAULT_ZUGANG_EMAIL_BETREFF;
    const curV = config.zugangEmailVorlage ?? DEFAULT_ZUGANG_EMAIL_VORLAGE;
    if (betreff === curB && vorlage === curV) return; // nichts geändert
    void (async () => {
      await update({ zugangEmailBetreff: betreff, zugangEmailVorlage: vorlage });
      setEmailSaved(true);
      window.setTimeout(() => setEmailSaved(false), 1500);
    })();
  }

  return (
    <div className="rounded-[12px] p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      <h3 className="text-[14px] font-medium text-[var(--tf-text)] mb-3">Konfiguration</h3>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Standard-Stunden pro Teilvorhaben">
          <input
            type="number"
            min={1}
            max={500}
            step={0.5}
            value={config.stundenProTV}
            onChange={e => void update({ stundenProTV: Number(e.target.value) || 9 })}
            disabled={busy}
            className="w-full text-[12.5px] px-2 py-1 rounded outline-none"
            style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
          />
        </Field>
        <Field label="Aktuelles Quartal">
          <input
            type="text"
            value={config.aktuellesQuartal}
            onChange={e => void update({ aktuellesQuartal: e.target.value })}
            placeholder="2026-Q2"
            disabled={busy}
            className="w-full text-[12.5px] px-2 py-1 rounded outline-none font-mono"
            style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
          />
        </Field>
        <Field label="Selbsteintragungs-Frist (Tage)">
          <input
            type="number"
            min={0}
            max={90}
            value={config.selbsteintragungFristTage}
            onChange={e => void update({ selbsteintragungFristTage: Number(e.target.value) || 7 })}
            disabled={busy}
            className="w-full text-[12.5px] px-2 py-1 rounded outline-none"
            style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
          />
        </Field>
      </div>

      {/* v2.31: Antragstyp-spezifische Stunden pro TV (FuE/DS/DL/NW) */}
      <div className="mt-4 pt-4" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
        <h4 className="text-[12.5px] font-medium text-[var(--tf-text)] mb-2">
          Stunden pro Teilvorhaben je Antragstyp
        </h4>
        <div className="grid grid-cols-4 gap-3">
          {ALL_ANTRAGSTYP_BUCKETS.map(bucket => (
            <Field key={bucket} label={bucket}>
              <input
                type="number"
                min={0}
                max={500}
                step={0.5}
                value={config.stundenProTVProTyp?.[bucket] ?? ''}
                placeholder={String(config.stundenProTV)}
                onChange={e => updateTyp(bucket, e.target.value)}
                disabled={busy}
                className="w-full text-[12.5px] px-2 py-1 rounded outline-none"
                style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
              />
            </Field>
          ))}
        </div>
        <p className="mt-2 text-[10.5px] text-[var(--tf-text-tertiary)] leading-snug">
          Leer = Standard-Faktor ({config.stundenProTV} h). Ein eigener Wert je Antragstyp
          wirkt auf Kapazität, Matching und Kontingent — z.&nbsp;B. bei 4,5&nbsp;h für DS
          hat ein MA mit gleichem Stunden-Konto doppelt so viele freie DS-Teilvorhaben wie
          bei 9&nbsp;h.
        </p>
      </div>

      {/* v2.12: Zugangspasswort-E-Mail-Vorlage (für den „✉ E-Mail"-Link im Passwort-Dialog) */}
      <div className="mt-4 pt-4" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
        <h4 className="text-[12.5px] font-medium text-[var(--tf-text)] mb-2 flex items-center gap-2">
          Zugangspasswort-E-Mail-Vorlage
          {emailSaved ? <span className="text-[11px] font-normal text-emerald-600">✓ gespeichert</span> : null}
        </h4>
        {isMaVerwaltungPasswortEnabled() && (
          <div className="mb-3 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={openZugangVerwaltung}
              className="h-7 px-3 rounded-md text-[12px] font-medium cursor-pointer transition-opacity hover:opacity-90 whitespace-nowrap"
              style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text-secondary)' }}
              title="Übersicht aller aktiven MAs: Passwörter erzeugen/neu erzeugen + per E-Mail versenden."
            >
              Passwörter für alle aktiven MAs
            </button>
            <span className="text-[10.5px] text-[var(--tf-text-tertiary)] leading-snug">
              Erzeugt/erneuert Zugangspasswörter und versendet sie per E-Mail — mit der Vorlage unten.
            </span>
          </div>
        )}
        <div className="flex flex-col gap-3">
          <Field label="Betreff">
            <input
              type="text"
              value={betreff}
              onChange={e => setBetreff(e.target.value)}
              onBlur={commitEmail}
              className="w-full text-[12.5px] px-2 py-1 rounded outline-none"
              style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
            />
          </Field>
          <Field label="Text">
            <textarea
              value={vorlage}
              onChange={e => setVorlage(e.target.value)}
              onBlur={commitEmail}
              rows={8}
              className="w-full text-[12.5px] px-2 py-1 rounded outline-none resize-y"
              style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
            />
          </Field>
          <p className="text-[10.5px] text-[var(--tf-text-tertiary)] leading-snug">
            Platzhalter <code>{'{kuerzel}'}</code>, <code>{'{passwort}'}</code> und <code>{'{anonId}'}</code>{' '}
            werden beim Versand pro Mitarbeitenden ersetzt. Wird beim Verlassen des Feldes gespeichert.
            Der „✉ E-Mail"-Link im Passwort-Dialog öffnet Outlook mit diesem Text.
          </p>
        </div>
      </div>

      {zugangListe && (
        <ZugangVerwaltungDialog maListe={zugangListe} onClose={() => setZugangListe(null)} />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
        {label}
      </label>
      {children}
    </div>
  );
}
