/**
 * Vollbild-Seite der Antrag-Aufbereitung (Route `/antraege/:aktenzeichen/aufbereitung`,
 * flag-gated `antragAufbereitung`). Rahmen aus dem Mockup: Zurück-Link + Kopf
 * (Titel/Meta + Quellen-Status + „Neu aufbereiten") + Hinweiszeile + Tab-Leiste.
 * In Paket 1 ist nur der Zeitplan-Tab funktional.
 *
 * Der Kontext wird aus dem Route-Key über dieselben Helfer wie VerbundDetail
 * aufgelöst (`useVerbundDetailData` + `buildKurzfassungContext`) — deep-link-/
 * refresh-fest. `key` ist ein echtes Verbund-Az oder ein Aktenzeichen (nie ein
 * Pseudo-Id), daher direkt als Route-Segment nutzbar.
 */
import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { isAntragAufbereitungEnabled } from '@/config/feature-flags';
import { useAntraegeStore } from '../store';
import { useVerbundDetailData } from '../useVerbundDetailData';
import { buildKurzfassungContext } from '../kurzfassung/context-builder';
import { isPseudoVerbundId, pseudoVerbundIdFor } from '../pseudoVerbund';
import { useAufbereitung } from './useAufbereitung';
import { AufbereitungTabs, type AufbereitungTabId } from './AufbereitungTabs';
import { ZeitplanTab } from './ZeitplanTab';

const kurzHash = (h: string): string => (h.length > 6 ? `${h.slice(0, 4)}…${h.slice(-2)}` : h);
function kurzDatum(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : d.toLocaleDateString('de-DE');
}

export function AufbereitungPage({ antragKey }: { antragKey: string }): React.ReactElement {
  const antraege = useAntraegeStore(s => s.antraege);
  const istVerbund = useMemo(() => antraege.some(a => a.verbund_id === antragKey), [antraege, antragKey]);
  const verbundId = istVerbund ? antragKey : pseudoVerbundIdFor(antragKey);
  const { verbund, antraege: tvs } = useVerbundDetailData(verbundId, isPseudoVerbundId(verbundId));
  const ctx = useMemo(
    () => (verbund ? buildKurzfassungContext(verbund, tvs, antragKey, verbund.verbund_id) : null),
    [verbund, tvs, antragKey],
  );
  const aufb = useAufbereitung(ctx ? { key: ctx.key, knownIds: ctx.knownIds } : null);
  const [tab, setTab] = useState<AufbereitungTabId>('zeitplan');

  // Defense-in-depth: die Route ist bereits flag-gated registriert.
  if (!isAntragAufbereitungEnabled()) return <Navigate to="/antraege" replace />;

  const backHref = istVerbund
    ? `/antraege/verbund/${encodeURIComponent(antragKey)}`
    : `/antraege/${encodeURIComponent(antragKey)}`;

  const titel = ctx?.akronym ?? antragKey;
  const metaTeile = [ctx?.foerderkennzeichen ? `FKZ ${ctx.foerderkennzeichen}` : null, ctx?.antragsteller ?? null]
    .filter((s): s is string => !!s);
  const vbQuelle = aufb.run?.quellen.find(q => q.rolle === 'vb');
  const hatAnlage5 = !!aufb.run?.quellen.find(q => q.rolle === 'anlage5');

  return (
    <div className="px-8 py-6">
      <Link to={backHref}
        className="inline-flex items-center gap-1 text-[13px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]">
        <ArrowLeft size={14} /> Zurück zum Antrag
      </Link>

      <PageHeader
        className="mt-2"
        title={titel}
        meta={metaTeile.length ? <span className="text-[12px] text-[var(--tf-text-tertiary)]">{metaTeile.join(' · ')}</span> : undefined}
        actions={
          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            {vbQuelle && aufb.run ? (
              <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
                ✓ VB: {vbQuelle.name} · Hash {kurzHash(vbQuelle.hash)} · aufbereitet {kurzDatum(aufb.run.erzeugtAm)}
              </span>
            ) : null}
            <StatusBadge label={hatAnlage5 ? 'Anlage 5 ✓' : 'Anlage 5 –'} />
            <Button variant="secondary" size="sm" loading={aufb.neu.busy} onClick={() => aufb.neu.run()}>
              {aufb.neu.busy ? 'Aufbereiten …' : 'Neu aufbereiten'}
            </Button>
          </div>
        }
      />

      {aufb.veraltet ? (
        <div className="mt-2 text-[12px] text-[var(--tf-text-tertiary)]">
          ● Quellen haben sich seit der Aufbereitung geändert — „Neu aufbereiten" für den aktuellen Stand.
        </div>
      ) : null}

      <p className="mt-2 text-[12px] text-[var(--tf-text-tertiary)]">
        KI-gestützte Aufbereitung — jede Angabe ist per Fundstelle im Original prüfbar. Kein Ersatz für die Prüfung des Antrags.
      </p>

      <div className="mt-4">
        <AufbereitungTabs active={tab} onChange={setTab} />
      </div>

      <div className="mt-6">
        {tab === 'zeitplan' ? (
          <ZeitplanTab run={aufb.run} loading={aufb.loading} neu={aufb.neu} toggle={aufb.toggle} />
        ) : (
          <div className="py-16 text-center text-[13px] text-[var(--tf-text-tertiary)]">In Vorbereitung (Paket 2)</div>
        )}
      </div>
    </div>
  );
}
