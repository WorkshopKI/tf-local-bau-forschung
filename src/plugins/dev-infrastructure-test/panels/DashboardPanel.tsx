import { useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { readBuildLock, isStale } from '@/core/services/infrastructure/build-lock';
import { getRecentAudits } from '@/core/services/infrastructure/audit-log';
import { listAllSkipEntries } from '@/phase2/skip-list/store';
import { listAllPending } from '@/phase2/pending-antrag/holding-bucket';
import { listManifestEntries } from '@/phase2/scanner/manifest-store';
import type { AuditEntry, BuildLock } from '@/core/services/infrastructure/types';
import { Archive, SectionCaption, StatusDot, type StatusTone } from './shared';

interface QuickAction {
  title: string;
  hint: string;
  tabId: number;
  tabLabel: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { title: 'Verbindung prüfen', hint: 'SMB-Handle revalidieren · 5 Sek.', tabId: 2, tabLabel: 'Tab 2' },
  { title: 'Bulk-Triage starten', hint: 'Phase-2 Scan über gewählte Pfade', tabId: 6, tabLabel: 'Tab 6' },
  { title: 'Index laden', hint: 'DMS-CSV-Index für Akronym-Lookup', tabId: 6, tabLabel: 'Tab 6' },
  { title: 'Fixtures: Frisch', hint: 'IndexedDB leer + Seed minimal', tabId: 7, tabLabel: 'Tab 7' },
  { title: 'Backup erstellen', hint: 'Wöchentlicher Snapshot manuell', tabId: 4, tabLabel: 'Tab 4' },
  { title: 'Kurator-Modus aktivieren', hint: 'Session 12 h, Auditlog konsistent', tabId: 3, tabLabel: 'Tab 3' },
];

const PHASE_SETUP = [
  'Daten-Share-Root auswählen',
  'Permission anfordern',
  'Ordnerstruktur initialisieren',
  'Dokumentenquelle setzen',
];

function formatRemaining(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'abgelaufen';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

interface Props {
  onSwitchTab: (tabId: number) => void;
}

export function DashboardPanel({ onSwitchTab }: Props): React.ReactElement {
  const storage = useStorage();
  const smb = useSmbStatus();
  const kurator = useKuratorSession();
  const [lock, setLock] = useState<BuildLock | null>(null);
  const [phase2Counts, setPhase2Counts] = useState<{ skip: number; pending: number; manifest: number } | null>(null);
  const [audits, setAudits] = useState<AuditEntry[]>([]);

  // Build-Lock + Phase-2-Counts + Audit beim Mount und bei SMB-Wechsel laden.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [bl, skip, pending, manifest, recent] = await Promise.all([
          readBuildLock(storage.idb),
          listAllSkipEntries(storage.idb),
          listAllPending(storage.idb),
          listManifestEntries(storage.idb),
          getRecentAudits(storage.idb, 5),
        ]);
        if (cancelled) return;
        setLock(bl);
        setPhase2Counts({ skip: skip.length, pending: pending.length, manifest: manifest.length });
        setAudits(recent);
      } catch {
        if (!cancelled) {
          setLock(null);
          setPhase2Counts(null);
          setAudits([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [storage.idb, smb.status]);

  // Status-Karten
  const smbCard = smbToCard(smb.status, smb.lastCheck);
  const kuratorCard = kuratorToCard(kurator);
  const lockCard = lockToCard(lock);
  const phase2Card = phase2ToCard(phase2Counts);

  const headlineTone: StatusTone =
    [smbCard, kuratorCard, lockCard, phase2Card].some(c => c.tone === 'danger') ? 'danger'
    : [smbCard, kuratorCard, lockCard, phase2Card].some(c => c.tone === 'warning') ? 'warning'
    : 'success';

  const headline =
    headlineTone === 'success' ? 'Alles läuft'
    : headlineTone === 'warning' ? 'Alles läuft — eine Sache zu prüfen'
    : 'Achtung — ein Subsystem fehlt';

  return (
    <div className="px-8 py-6 max-w-[980px]">
      <div className="text-[12px] text-[var(--tf-text-tertiary)]">
        Zustand · {new Date().toLocaleString('de-DE')}
      </div>
      <h2 className="text-[22px] font-medium mt-1.5">{headline}</h2>

      {/* Status-Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
        {[smbCard, kuratorCard, lockCard, phase2Card].map((c, i) => (
          <div
            key={i}
            className="rounded-[var(--tf-radius)] p-3.5 bg-[var(--tf-bg)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <div className="text-[11.5px] text-[var(--tf-text-tertiary)]">{c.label}</div>
            <div className="flex items-center gap-2 mt-1">
              <StatusDot tone={c.tone} />
              <span className="text-[13.5px] font-medium text-[var(--tf-text)]">{c.value}</span>
            </div>
            <div className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-1 truncate" title={c.sub}>
              {c.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Häufig in dieser Phase */}
      <SectionCaption>Häufig in dieser Phase</SectionCaption>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {QUICK_ACTIONS.map(qa => (
          <button
            key={qa.title}
            type="button"
            onClick={() => onSwitchTab(qa.tabId)}
            className="text-left rounded-[var(--tf-radius)] px-3.5 py-3 bg-[var(--tf-bg)] hover:bg-[var(--tf-hover)] cursor-pointer transition-colors"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[13.5px] font-medium text-[var(--tf-text)]">{qa.title}</span>
              <span className="text-[11px] text-[var(--tf-text-tertiary)]">{qa.tabLabel} →</span>
            </div>
            <div className="text-[12px] text-[var(--tf-text-secondary)] mt-1">{qa.hint}</div>
          </button>
        ))}
      </div>

      {/* Letzte Ereignisse */}
      <SectionCaption>Letzte Ereignisse</SectionCaption>
      <div
        className="rounded-[var(--tf-radius)] p-3 bg-[var(--tf-bg-secondary)] font-mono text-[11.5px] leading-[1.7]"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        {audits.length === 0 ? (
          <span className="text-[var(--tf-text-tertiary)]">Keine Einträge im Audit-Log.</span>
        ) : (
          audits.slice().reverse().map((a, i) => (
            <div key={i}>
              <span className="text-[var(--tf-text-tertiary)]">{formatTime(a.ts)}</span>
              <span className="ml-3 text-[var(--tf-text-secondary)]">{a.user}</span>
              <span className="ml-3 text-[var(--tf-text)]">{a.action}</span>
            </div>
          ))
        )}
      </div>

      <Archive title="Phasen-Setup (selten — meist 1× pro Maschine)">
        <div className="flex flex-col gap-1.5 text-[12.5px] text-[var(--tf-text-secondary)]">
          {PHASE_SETUP.map(t => (
            <div key={t}>· {t}</div>
          ))}
          <button
            type="button"
            onClick={() => onSwitchTab(2)}
            className="mt-2 text-[12px] text-[var(--tf-primary)] hover:underline cursor-pointer self-start"
          >
            Setup in Tab 2 (SMB &amp; Handle) öffnen →
          </button>
        </div>
      </Archive>
    </div>
  );
}

interface CardData {
  label: string;
  value: string;
  tone: StatusTone;
  sub: string;
}

function smbToCard(status: string, lastCheck: number | null): CardData {
  const ageMin = lastCheck ? Math.round((Date.now() - lastCheck) / 60_000) : null;
  const sub = ageMin !== null ? `geprüft vor ${ageMin} min` : 'noch nicht geprüft';
  switch (status) {
    case 'online': return { label: 'SMB-Handle', value: 'verbunden', tone: 'success', sub };
    case 'offline': return { label: 'SMB-Handle', value: 'offline', tone: 'warning', sub };
    case 'denied': return { label: 'SMB-Handle', value: 'verweigert', tone: 'danger', sub };
    default: return { label: 'SMB-Handle', value: 'unbekannt', tone: 'default', sub };
  }
}

function kuratorToCard(s: { isActive: boolean; kuratorName: string | null; expiresAt: number | null }): CardData {
  if (!s.isActive) {
    return { label: 'Kurator', value: 'inaktiv', tone: 'default', sub: 'keine Schreibsession' };
  }
  const remaining = s.expiresAt ? formatRemaining(s.expiresAt) : '—';
  return {
    label: 'Kurator',
    value: 'aktiv',
    tone: 'success',
    sub: `${s.kuratorName ?? 'unbekannt'} · ${remaining}`,
  };
}

function lockToCard(lock: BuildLock | null): CardData {
  if (!lock) {
    return { label: 'Build-Lock', value: 'frei', tone: 'default', sub: 'kein aktiver Build' };
  }
  const stale = isStale(lock);
  const stage = lock.stufe ?? 'unbekannt';
  if (stale) {
    return {
      label: 'Build-Lock',
      value: 'stale',
      tone: 'warning',
      sub: `${stage} · Heartbeat > 2 h`,
    };
  }
  return {
    label: 'Build-Lock',
    value: 'belegt',
    tone: 'warning',
    sub: `${lock.kurator_name ?? 'unbekannt'} · ${stage}`,
  };
}

function phase2ToCard(counts: { skip: number; pending: number; manifest: number } | null): CardData {
  if (!counts) {
    return { label: 'Phase-2 Index', value: '—', tone: 'default', sub: 'wird geladen …' };
  }
  if (counts.manifest === 0 && counts.skip === 0 && counts.pending === 0) {
    return {
      label: 'Phase-2 Index',
      value: 'leer',
      tone: 'default',
      sub: 'kein Triage-Lauf bisher',
    };
  }
  return {
    label: 'Phase-2 Index',
    value: counts.manifest.toLocaleString('de-DE') + ' Manifest',
    tone: 'success',
    sub: `${counts.skip.toLocaleString('de-DE')} Skip · ${counts.pending} Pending`,
  };
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}
