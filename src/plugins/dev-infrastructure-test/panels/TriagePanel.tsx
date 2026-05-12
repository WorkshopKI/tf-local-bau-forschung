/**
 * Phase-2 Triage-Test-Panel.
 *
 * Erlaubt es, einzelne Dokumente per File-Picker durch die volle
 * Triage-Pipeline zu schicken und das resultierende Manifest-Objekt
 * inspizierbar zu machen. Außerdem: Skip-List + Pending-Antrag-Bucket-
 * Inhalte einsehen und DMS-CSV-Index aus dem Daten-Share laden.
 *
 * State + Handler leben in `useTriagePanel.ts`; Progress-Visualisierungen
 * in `TriageProgressBlocks.tsx`.
 */
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ActionRow, Archive, Danger, DevLog, Field, SectionCaption, StatusPill } from './shared';
import { useTriagePanel } from './useTriagePanel';
import { BulkProgressBlock, ScanProgressBlock } from './TriageProgressBlocks';

export function TriagePanel(): React.ReactElement {
  const p = useTriagePanel();
  const dmsLastRun = p.dmsMap
    ? `${p.dmsMap.size.toLocaleString('de-DE')} Einträge geladen`
    : (p.dmsSource === 'absent' ? 'dms-index-filtered.csv fehlt' : 'nicht geladen');

  return (
    <div className="px-8 py-6 max-w-[880px]">
      <h2 className="text-[18px] font-medium text-[var(--tf-text)]">Phase-2 Triage</h2>
      <p className="text-[13px] text-[var(--tf-text-secondary)] leading-relaxed mt-1.5 mb-5 max-w-[620px]">
        Bulk-Scan über Verzeichnisse, Akronym-Lookup gegen DMS-Index, Verteilung in Manifest / Skip-Liste / Pending.
      </p>

      {/* Hero-Status: 3 Karten — Skip / Pending / Manifest */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { l: 'Skip-Liste', v: p.skipCount },
          { l: 'Pending', v: p.pendingCount },
          { l: 'Manifest', v: p.manifestCount },
        ].map(s => (
          <div
            key={s.l}
            className="rounded-[var(--tf-radius)] p-3.5 bg-[var(--tf-bg)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <div className="text-[11.5px] text-[var(--tf-text-tertiary)]">{s.l}</div>
            <div className="text-[22px] font-medium font-mono mt-1">{s.v.toLocaleString('de-DE')}</div>
          </div>
        ))}
      </div>

      {/* 1. Voraussetzungen */}
      <SectionCaption>1. Voraussetzungen</SectionCaption>
      <ActionRow
        title="DMS-CSV-Index laden"
        hint="Pflicht. Ohne Index bricht Triage ab."
        lastRun={dmsLastRun}
        btn={
          <Button size="sm" onClick={() => void p.onLoadDmsIndex()} disabled={p.busy}>
            {p.busy && !p.dmsMap ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Lädt…
              </span>
            ) : 'Index laden'}
          </Button>
        }
      />
      <Field label="Aktives Programm (Akronym-Lookup)">
        {p.activeProgrammId ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] bg-emerald-50 text-emerald-800">
            {p.activeProgrammName ?? p.activeProgrammId}
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] bg-amber-50 text-amber-800">
            kein Programm aktiv — Switcher in der Sidebar
          </span>
        )}
      </Field>

      {/* 2. DMS-Quelle */}
      <SectionCaption>2. DMS-Quelle</SectionCaption>
      <Field
        label="Quelle für diesen Triage-Test"
        hint='Verwaltung neuer Quellen + Sub-Roots läuft im Plugin „Dokumentenquellen“.'
      >
        {p.sources.length === 0 ? (
          <span className="text-[12px] text-[var(--tf-text-tertiary)]">
            Keine DMS-Quellen konfiguriert. Im Plugin „Dokumentenquellen“ anlegen.
          </span>
        ) : (
          <div className="flex items-center flex-wrap gap-2">
            <select
              value={p.selectedSourceId ?? ''}
              onChange={e => p.setSelectedSourceId(e.target.value || null)}
              className="rounded-md px-2 py-1 text-[12.5px] bg-[var(--tf-bg)]"
              style={{ border: '0.5px solid var(--tf-border)' }}
            >
              {p.sources.map(s => (
                <option key={s.id} value={s.id}>
                  {s.label}
                  {s.is_active ? '' : ' (inaktiv)'}
                </option>
              ))}
            </select>
            {p.selectedSource && (
              <StatusPill
                label={
                  p.selectedSource.sub_roots.length === 0
                    ? 'ganzer Ordner'
                    : `${p.selectedSource.sub_roots.length} Sub-Root${p.selectedSource.sub_roots.length === 1 ? '' : 's'}`
                }
                tone="neutral"
              />
            )}
          </div>
        )}
      </Field>

      {/* 3. Lauf */}
      <SectionCaption>3. Lauf</SectionCaption>
      <ActionRow
        title="Roots scannen"
        hint="Liest die Wurzelverzeichnisse, ohne Triage. Liefert die Datei-Liste für Bulk-Triage."
        lastRun={p.scanFiles && !p.scanRunning ? `${p.scanFiles.length.toLocaleString('de-DE')} Dateien gefunden` : undefined}
        btn={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void p.onScanRoots()}
              disabled={p.scanRunning || p.bulkRunning || p.selectedRoots.length === 0}
            >
              {p.scanRunning ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Scanne…
                </span>
              ) : 'Scannen'}
            </Button>
            {p.scanRunning && (
              <Button size="sm" variant="destructive" onClick={p.onAbortScan}>
                Abbrechen
              </Button>
            )}
          </div>
        }
      />
      <ActionRow
        title="Bulk-Triage starten"
        hint="Hauptlauf. Verteilt Treffer auf Manifest / Skip / Pending."
        btn={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => void p.onBulkTriage()}
              disabled={!p.scanFiles || !p.dmsMap || p.bulkRunning || p.scanRunning}
              title={!p.scanFiles ? 'Erst „Roots scannen"' : !p.dmsMap ? 'Erst DMS-Index laden' : undefined}
            >
              Starten
            </Button>
            {p.bulkRunning && (
              <Button size="sm" variant="destructive" onClick={p.onAbortBulk}>
                Abbrechen
              </Button>
            )}
          </div>
        }
      />
      <ActionRow
        title="Nur Errors retriagieren"
        hint={p.errorCount === 0 ? '0 Fehler in der Warteschlange.' : `${p.errorCount.toLocaleString('de-DE')} parse_error-Manifests werden neu klassifiziert.`}
        btn={
          <Button
            size="sm"
            variant="outline"
            onClick={() => void p.onRetryErrors()}
            disabled={p.errorCount === 0 || !p.dmsMap || p.bulkRunning || p.scanRunning}
          >
            Retriage
          </Button>
        }
      />

      {p.scanProgress && <ScanProgressBlock scanProgress={p.scanProgress} />}
      {p.bulkStats && <BulkProgressBlock bulkStats={p.bulkStats} bulkTick={p.bulkTick} />}

      {/* Diagnose & Konfig (selten) */}
      <Archive title="Diagnose & Konfig (selten)">
        <div className="flex items-center gap-2 py-3" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-medium text-[var(--tf-text)]">DocID nachschlagen</div>
            <div className="text-[12px] text-[var(--tf-text-secondary)] mt-1">z. B. GMKZSZ01.docx — gibt zurück, in welchen Bucket sie fällt.</div>
            <div className="flex items-center gap-2 mt-2">
              <Input
                value={p.lookupQuery}
                onChange={e => p.setLookupQuery(e.target.value)}
                placeholder="DocID eingeben"
                className="h-8 text-[12px] flex-1 max-w-[280px]"
                onKeyDown={e => { if (e.key === 'Enter') p.onLookupDocId(); }}
              />
              <Button size="sm" variant="outline" onClick={p.onLookupDocId} disabled={!p.dmsMap}>
                Suchen
              </Button>
            </div>
          </div>
        </div>
        <ActionRow
          title="Datei wählen + Triage"
          hint="Einzelne Datei testen. Nur, wenn Index geladen ist."
          btn={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void p.onPickAndTriage()}
              disabled={p.busy || !p.dmsMap}
              title={!p.dmsMap ? 'Erst „Index laden"' : undefined}
            >
              Datei wählen
            </Button>
          }
        />
        <ActionRow
          title="Manifest auf Share spiegeln"
          hint="Synct die lokale IndexedDB-Sicht zurück auf den Share."
          btn={
            <Button size="sm" variant="outline" onClick={() => void p.onMirrorManifest()} disabled={p.mirrorBusy || p.bulkRunning}>
              {p.mirrorBusy ? 'Schreibt…' : 'Spiegeln'}
            </Button>
          }
        />
        <ActionRow
          title="Skip-Liste anzeigen"
          hint="Erste 10 Einträge ins Log."
          btn={<Button size="sm" variant="outline" onClick={() => void p.onShowSkipList()}>Anzeigen</Button>}
        />
        <ActionRow
          title="Pending anzeigen"
          hint="Erste 10 Holding-Bucket-Einträge ins Log."
          btn={<Button size="sm" variant="outline" onClick={() => void p.onShowPending()}>Anzeigen</Button>}
        />
      </Archive>

      <Danger>
        <ActionRow
          title="Skip-Liste leeren"
          hint={`${p.skipCount.toLocaleString('de-DE')} Einträge weg. Beim nächsten Scan werden alle wieder geprüft.`}
          btn={
            <Button size="sm" variant="destructive" onClick={() => void p.onClearSkipList()} disabled={p.skipCount === 0}>
              Leeren
            </Button>
          }
        />
        <ActionRow
          title="Pending leeren"
          hint={`${p.pendingCount.toLocaleString('de-DE')} Einträge weg.`}
          btn={
            <Button size="sm" variant="destructive" onClick={() => void p.onClearPending()} disabled={p.pendingCount === 0}>
              Leeren
            </Button>
          }
        />
        <ActionRow
          title="Manifest leeren"
          hint={`${p.manifestCount.toLocaleString('de-DE')} Einträge weg. Phase-2 fängt von vorne an.`}
          btn={
            <Button size="sm" variant="destructive" onClick={() => void p.onClearManifest()} disabled={p.manifestCount === 0}>
              Leeren
            </Button>
          }
        />
        <ActionRow
          title="Alle Phase-2-Caches leeren"
          hint="Manifest + Skip + Pending. Run-Logs auf dem Share bleiben."
          btn={
            <Button
              size="sm"
              variant="destructive"
              onClick={() => void p.onFullReset()}
              disabled={p.manifestCount === 0 && p.skipCount === 0 && p.pendingCount === 0}
            >
              Komplett-Reset
            </Button>
          }
        />
      </Danger>

      {p.lastManifest && (
        <div className="mt-6">
          <SectionCaption>Letztes Triage-Manifest</SectionCaption>
          <pre
            className="w-full overflow-x-auto rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)] p-3 font-mono text-[10.5px] leading-snug text-[var(--tf-text-secondary)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            {JSON.stringify(p.lastManifest, null, 2)}
          </pre>
        </div>
      )}

      <div className="mt-6">
        <SectionCaption>Log</SectionCaption>
        <DevLog lines={p.logLines} />
      </div>
    </div>
  );
}
