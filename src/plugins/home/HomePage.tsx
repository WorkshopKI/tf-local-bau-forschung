import { useEffect, useState } from 'react';
import { ArrowRight, AlertTriangle, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, SectionHeader, ListItem, Button } from '@/ui';
import { Alert } from '@/components/ui/alert';
import { useStorage } from '@/core/hooks/useStorage';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useProfile } from '@/core/hooks/useProfile';
import { useTourContext } from '@/core/hooks/useTour';
import { useBauantraegeStore } from '@/plugins/bauantraege/store';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useDashboardData } from './useDashboardData';
import { ProgrammeOverviewCards } from './ProgrammeOverviewCards';
import { menuLabel, dataConfig } from '@/config/feature-flags';
import { getStatusVariant, getStatusLabel } from '@/core/utils/status-mappings';
import { getSmbHandle } from '@/core/services/infrastructure/smb-handle';
import { HomeCallToAction } from '@/core/components/HomeCallToAction';
import { tfPerfStart } from '@/core/utils/tfPerf';

export function HomePage(): React.ReactElement {
  const storage = useStorage();
  const { navigate } = useNavigation();
  const loadBau = useBauantraegeStore(s => s.loadAll);
  const loadAntraege = useAntraegeStore(s => s.loadAll);
  const { profile } = useProfile();
  const tour = useTourContext();
  const [hasHandle, setHasHandle] = useState<boolean | null>(null);
  // Verhindert den "Noch keine Vorgaenge"-Flash, bevor die beiden Stores
  // (Bauantraege + Antraege) beim ersten Mount async befuellt sind.
  // Wird nur einmal gesetzt — Programm-Switches loesen kein Reset aus, damit
  // beim Wechsel kein Skeleton aufblitzt.
  const [firstLoadDone, setFirstLoadDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const h = await getSmbHandle(storage.idb);
      if (!cancelled) setHasHandle(!!h);
    })();
    return () => { cancelled = true; };
  }, [storage.idb]);

  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const department = profile?.department ?? 'beide';
  useEffect(() => {
    let cancelled = false;
    const end = tfPerfStart('HomePage mount: loadBau+loadAntraege');
    // Konditionaler Load: was im Dashboard eh nicht angezeigt wird, laden
    // wir gar nicht erst. Bei Profil 'antraege' (reine Foerderantraege-User)
    // sparen wir den FS-Scan komplett; bei 'bauantraege' den 480 MB
    // IDB-getAll der Foerderantraege.
    const tasks: Promise<void>[] = [];
    if (department !== 'antraege') tasks.push(loadBau(storage));
    if (department !== 'bauantraege') {
      tasks.push(loadAntraege(storage.idb, activeProgrammId ?? undefined));
    }
    void Promise.all(tasks).then(() => {
      if (!cancelled) {
        setFirstLoadDone(true);
        end();
      }
    });
    return () => { cancelled = true; };
  }, [storage, loadBau, loadAntraege, activeProgrammId, department]);

  // useDashboardData filtert NICHT explizit auf activeProgrammId — der
  // useAntraegeStore.antraege-State enthält nach loadAll(idb, programmId)
  // bereits nur die Anträge des aktiven Programms.
  const data = useDashboardData(profile?.department);
  const name = profile?.name ?? '';
  const antraegeLabel = menuLabel('antraege', 'Anträge');
  const bauantraegeLabel = menuLabel('bauantraege', 'Bauanträge');
  const dept = profile?.department === 'antraege' ? antraegeLabel
    : profile?.department === 'bauantraege' ? bauantraegeLabel
    : 'Beide Abteilungen';

  // Auto-Start der Tour beim ersten Besuch (nur wenn Daten vorhanden)
  const tourHasCompleted = tour.hasCompleted;
  const tourIsActive = tour.isActive;
  const tourStart = tour.start;
  useEffect(() => {
    if (tourHasCompleted || tourIsActive) return;
    if (data.stats.total === 0) return;
    const timer = setTimeout(() => tourStart(), 800);
    return () => clearTimeout(timer);
  }, [tourHasCompleted, tourIsActive, tourStart, data.stats.total]);

  if (hasHandle === null) {
    return <div className="min-h-[60vh]" />;
  }

  // CTA nur wenn die Variante dem User erlaubt, einen Daten-Share selbst zu waehlen.
  // Demo (demoDataBundled=true) und Prod-Fixed-Path-Varianten ueberspringen die Aktion.
  if (hasHandle === false && dataConfig.allowUserToChangePath) {
    return <HomeCallToAction idb={storage.idb} onConnected={() => setHasHandle(true)} />;
  }

  // Erster Store-Load laeuft noch — Skeleton mit echter Begruessung statt
  // leerem Div. Unter Multi-CSV-Joins (~480 MB IDB-getAll fuer 13k Antraege)
  // dauert das mehrere Sekunden; ohne Skeleton sieht der User in der Zeit
  // gar nichts und die App fuehlt sich eingefroren an.
  if (!firstLoadDone) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';
    return (
      <div className="px-8 pt-4 pb-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-[22px] font-medium text-[var(--tf-text)]">
            {greeting}{name ? `, ${name}` : ''}
          </h1>
          <p className="text-[13px] text-[var(--tf-text-tertiary)]">Lade Vorgänge …</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8">
          <div className="min-w-0">
            <div className="h-4 w-40 rounded bg-[var(--tf-bg-secondary)] animate-pulse mb-3" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded bg-[var(--tf-bg-secondary)] animate-pulse" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)] animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (data.stats.total === 0) {
    // Wenn der Bearbeiter-Filter aktiv ist und die KUERZ-Spalten in den
    // CSV-Quellen fehlen, ist die "Noch keine Vorgänge"-Meldung trügerisch —
    // es gäbe ja Daten, sie können nur nicht gefiltert werden.
    if (data.bearbeiterFilterActive && data.bearbeiterKuerzelMissing) {
      return (
        <div className="px-8 pt-4 pb-6 max-w-3xl">
          <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-4">
            {data.greeting}{name ? `, ${name}` : ''}
          </h1>
          <BearbeiterKuerzelMissingAlert tokens={data.bearbeiterTokens} />
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-2">{data.greeting}{name ? `, ${name}` : ''}</h1>
        <p className="text-[14px] text-[var(--tf-text-secondary)] mb-6">Noch keine Vorgänge angelegt</p>
        <Button variant="secondary" icon={ArrowRight} onClick={() => navigate('bauantraege')}>Ersten Antrag erstellen</Button>
      </div>
    );
  }

  return (
    <div data-tour="home-dashboard" className="px-8 pt-4 pb-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)]">{data.greeting}{name ? `, ${name}` : ''}</h1>
        <p className="text-[13px] text-[var(--tf-text-secondary)]">
          {dept} · {data.stats.offen} offene Vorgänge · {data.fristenDieseWoche} Fristen diese Woche
        </p>
      </div>

      {data.bearbeiterFilterActive && data.bearbeiterKuerzelMissing ? (
        <BearbeiterKuerzelMissingAlert tokens={data.bearbeiterTokens} />
      ) : null}

      {/* Multi-Programm-Übersicht — versteckt bei <= 1 Programm */}
      <ProgrammeOverviewCards />

      {/* Callout */}
      {data.naechsterSchritt && data.naechsterSchritt.daysLeft <= 7 && (
        <div className="flex items-center justify-between p-4 mb-6 rounded-[var(--tf-radius)]" style={{ borderLeft: '3px solid var(--tf-border-hover)' }}>
          <div>
            <p className="text-[12px] text-[var(--tf-text-tertiary)]">
              Nächster Schritt · {data.naechsterSchritt.daysLeft < 0 ? (
                <span className="text-[var(--tf-danger-text)]">
                  Frist seit {Math.abs(data.naechsterSchritt.daysLeft)} Tagen überschritten
                </span>
              ) : (
                <>Frist in {data.naechsterSchritt.daysLeft} Tagen</>
              )}
            </p>
            <p className="text-[14px] font-medium text-[var(--tf-text)]">
              <span className="text-[var(--tf-text-tertiary)] font-mono">{data.naechsterSchritt.id}</span> — {data.naechsterSchritt.title}
            </p>
          </div>
          <Button variant="secondary" size="sm" icon={ArrowRight}
            onClick={() => {
              const v = data.naechsterSchritt!;
              const target = (v as { _isAntrag?: boolean })._isAntrag ? 'antraege' : 'bauantraege';
              navigate(target, { selectedId: v.id });
            }}>
            Öffnen
          </Button>
        </div>
      )}

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8">
        {/* Main */}
        <div data-tour="document-list" className="min-w-0">
          <SectionHeader label="Aktuelle Vorgänge"
            action={<button onClick={() => navigate('bauantraege')} className="text-[11px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer">Alle →</button>} />
          {data.letzteAenderungen.map((v, i) => {
            const isAntrag = (v as { _isAntrag?: boolean })._isAntrag === true;
            return (
              <ListItem key={v.id}
                icon={<span className="text-[11px] font-medium text-[var(--tf-text-secondary)]">{isAntrag ? 'F' : 'B'}</span>}
                title={v.title}
                subtitle={v.id}
                meta={<Badge variant={getStatusVariant(v.status)}>{getStatusLabel(v.status)}</Badge>}
                onClick={() => navigate(isAntrag ? 'antraege' : 'bauantraege', { selectedId: v.id })}
                last={i === data.letzteAenderungen.length - 1}
              />
            );
          })}
        </div>

        {/* Sidebar cards */}
        <div className="space-y-4">
          {/* Fristen */}
          <div className="bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] p-4">
            <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-3 uppercase tracking-[0.08em]">Offene Fristen</p>
            {data.dringend.length === 0 ? (
              <p className="text-[13px] text-[var(--tf-text-secondary)]">Keine dringenden Fristen</p>
            ) : (
              data.dringend.slice(0, 5).map(v => (
                <div key={v.id} className="flex items-center gap-2 py-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${v.daysLeft < 0 ? 'bg-[var(--tf-danger-text)]' : v.daysLeft < 3 ? 'bg-[var(--tf-danger-text)]' : 'bg-[var(--tf-warning-text)]'}`} />
                  <span className="text-[12px] font-mono text-[var(--tf-text-tertiary)] flex-1 truncate">{v.id}</span>
                  <span className={`text-[11px] whitespace-nowrap ${v.daysLeft < 0 ? 'text-[var(--tf-danger-text)]' : 'text-[var(--tf-text-tertiary)]'}`}>
                    {v.daysLeft < 0 ? `${Math.abs(v.daysLeft)}d überfällig` : `in ${v.daysLeft}d`}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* AI Status */}
          <div className="bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] p-4">
            <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-3 uppercase tracking-[0.08em]">AI-Assistent</p>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--tf-text-tertiary)]" />
              <span className="text-[13px] text-[var(--tf-text-secondary)]">Nicht verbunden</span>
            </div>
            <button onClick={() => navigate('chat')} className="text-[12px] text-[var(--tf-primary)] hover:underline cursor-pointer">Chat öffnen →</button>
          </div>

          {/* Search Index */}
          <div data-tour="suchindex-status" className="bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] p-4">
            <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-3 uppercase tracking-[0.08em]">Suchindex</p>
            <p className="text-[13px] text-[var(--tf-text-secondary)]">{data.stats.total} Vorgänge indexiert</p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface BearbeiterKuerzelMissingAlertProps {
  tokens: string[];
}

function BearbeiterKuerzelMissingAlert({ tokens }: BearbeiterKuerzelMissingAlertProps): React.ReactElement {
  return (
    <Alert variant="warning" className="mb-6">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium">
          Bearbeiter-Filter aktiv ({tokens.join(', ')}), aber die Bearbeiter-Spalten
          {' '}<span className="font-mono">TiB_KUERZ</span> / <span className="font-mono">BIB_KUERZ</span>
          {' '}sind in den geladenen CSV-Quellen nicht vorhanden.
        </p>
        <p className="mt-1 text-[12px] opacity-90">
          Deshalb ist die Anzeige leer. Lösungen: Kürzel-Filter im Profil deaktivieren
          (Wert <span className="font-mono">alle</span> eintragen oder leeren) oder eine
          CSV-Quelle mit den KUERZ-Spalten registrieren bzw. das Mapping ergänzen.
        </p>
        <div className="mt-1.5 flex items-center gap-3 text-[11.5px]">
          <Link
            to="/einstellungen"
            className="inline-flex items-center gap-1 underline hover:no-underline"
          >
            <Settings size={12} /> Profil bearbeiten
          </Link>
        </div>
      </div>
    </Alert>
  );
}
