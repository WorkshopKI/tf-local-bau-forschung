/**
 * Screen 1b — Zuweisungs-Cockpit.
 *
 * 50/50 Split:
 *  - Links: Antragsliste mit Filter-Pills (Quartal/Kategorie/Status)
 *  - Rechts: Detail + Top-3 VorschlagCards (Matching-Engine live)
 */
import { useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { useKlassifizierungenView } from '../hooks/useKlassifizierungen';
import { runMatching } from '../services/matching-engine';
import {
  computeQuartalsAuslastung,
  getTVCount,
} from '../services/quartals-auslastung';
import {
  buildAntraegeIndexForMatching,
} from '../services/embedding-matcher';
import {
  loadAllEmbeddings,
  embedText,
  ensureEmbeddingReady,
} from '@/core/services/embedding-corpus';
import {
  CANONICAL_AKRONYM,
  CANONICAL_TITEL,
  CANONICAL_VERBUND_ID,
  CANONICAL_VERBUND_TITEL,
  FIELD_PROJEKTBESCHREIBUNG,
  type MatchResult,
  type Zuweisung,
} from '../types';
import { KategoriePill } from '../components/KategoriePill';
import { ConfidenceDot } from '../components/ConfidenceDot';
import { TechnologieTags } from '../components/TechnologieTags';
import { VorschlagCard } from '../components/VorschlagCard';
import { tageImQuartal as computeTageImQuartal } from '../services/kapazitaet';
import { AnonymIdBadge } from '../components/AnonymIdBadge';
import { PasswortDialog } from '../components/PasswortDialog';
import { readAntragDeskriptoren } from '../services/profil-aggregator';
import { exportAnonymousXlsx, exportProtectedZip } from '../services/export-service';
import type { Antrag } from '@/core/services/csv/types';

type StatusFilter = 'offen' | 'selbst' | 'zugewiesen' | 'alle';

export function ZuweisungsCockpit(): React.ReactElement {
  const storage = useStorage();
  const config = useAuslastungData(s => s.data.config);
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);
  const klassifizierungen = useAuslastungData(s => s.data.klassifizierungen);
  const zuweisungen = useAuslastungData(s => s.data.zuweisungen);
  const upsertZuweisung = useAuslastungData(s => s.upsertZuweisung);

  const cache = useAntraegeCache();
  const view = useKlassifizierungenView(cache.antraege, config.ueberKategorien, klassifizierungen);

  const [kategorieFilter, setKategorieFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('offen');
  const [selectedAz, setSelectedAz] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [matchingRunning, setMatchingRunning] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const data = useAuslastungData(s => s.data);

  function exportAnonym(): void {
    exportAnonymousXlsx({ data, antraege: cache.antraege });
  }

  async function exportGeschuetzt(password: string): Promise<void> {
    setExportBusy(true);
    try {
      await exportProtectedZip({
        data,
        antraege: cache.antraege,
        anonymMap: cache.anonymMap,
        password,
      });
      setPwOpen(false);
    } finally {
      setExportBusy(false);
    }
  }

  // v2.4: Quartals-Auslastung pro MA — einmal pro Render-Cycle. Wird an
  // die Matching-Engine UEBERGEBEN, damit fest+pending in den Score
  // einfliessen (statt nur die Store-Zuweisungen).
  const auslastungByAnon = useMemo(
    () => computeQuartalsAuslastung(
      cache.antraege,
      zuweisungen,
      cache.anonymMap.toAnon,
      config.aktuellesQuartal,
      config.stundenProTV ?? 9,
    ),
    [cache.antraege, cache.anonymMap, zuweisungen, config.aktuellesQuartal, config.stundenProTV],
  );

  // Nur freigegebene Klassifizierungen sind hier sichtbar (Phase 1 muss durch)
  const freigegebene = useMemo(() => {
    return view.filter(v => v.klassifizierung.status === 'freigegeben');
  }, [view]);

  // Filter anwenden
  const filtered = useMemo(() => {
    return freigegebene.filter(v => {
      const kats = v.klassifizierung.freigegebeneKategorien;
      if (kategorieFilter && !kats.includes(kategorieFilter)) return false;
      if (statusFilter !== 'alle') {
        const ze = zuweisungen.filter(z => z.antragId === v.antrag.aktenzeichen);
        const offen = ze.length === 0 || ze.every(z => z.status === 'abgelehnt');
        const selbst = ze.some(z => z.status === 'selbst' || z.selbstEingetragen);
        const zug = ze.some(z => z.status === 'freigegeben');
        if (statusFilter === 'offen' && !offen) return false;
        if (statusFilter === 'selbst' && !selbst) return false;
        if (statusFilter === 'zugewiesen' && !zug) return false;
      }
      return true;
    });
  }, [freigegebene, kategorieFilter, statusFilter, zuweisungen]);

  const selected = selectedAz ? cache.antraege.find(a => a.aktenzeichen === selectedAz) : null;
  const selectedView = selectedAz ? view.find(v => v.antrag.aktenzeichen === selectedAz) : null;

  // Wenn Selektion durch Filter wegfaellt
  useEffect(() => {
    if (selectedAz && !filtered.some(v => v.antrag.aktenzeichen === selectedAz)) {
      setSelectedAz(filtered[0]?.antrag.aktenzeichen ?? null);
    } else if (!selectedAz && filtered.length > 0) {
      setSelectedAz(filtered[0]!.antrag.aktenzeichen);
    }
  }, [filtered, selectedAz]);

  // Matching-Engine fuer selektierten Antrag
  useEffect(() => {
    if (!selected || !selectedView) {
      setMatches([]);
      return;
    }
    void (async () => {
      setMatchingRunning(true);
      try {
        // 1.17: primaer + aspekte aus den freigegebenen Feldern, Fallback
        // auf die deprecated `freigegebeneKategorien`-Liste.
        const k = selectedView.klassifizierung;
        const primaerKategorie = k.freigegebenePrimaer || k.freigegebeneKategorien?.[0] || '';
        const aspekte = k.freigegebeneAspekte ?? k.freigegebeneKategorien?.slice(1) ?? [];
        let queryEmbedding: number[] | undefined;
        let corpusEmbeddings: Map<string, number[]> | undefined;
        let antraegeIndex: ReturnType<typeof buildAntraegeIndexForMatching> | undefined;
        if (config.stage2Aktiv) {
          await ensureEmbeddingReady(storage.idb);
          const text = [
            selected[CANONICAL_VERBUND_TITEL],
            selected[CANONICAL_TITEL],
            selected[FIELD_PROJEKTBESCHREIBUNG],
          ].filter(s => typeof s === 'string').join(' ');
          queryEmbedding = await embedText(text, 'query');
          corpusEmbeddings = await loadAllEmbeddings(storage.idb);
          antraegeIndex = buildAntraegeIndexForMatching(cache.antraege);
        }
        // v2.4: echte TV-Anzahl aus der Anträge-Liste, damit Engine die
        // korrekten benoetigtenStunden berechnet (Verbund mit 4 TVs = 36h).
        const verbundId = (selected as { verbund_id?: string }).verbund_id;
        const tvCount = getTVCount(cache.antraege, verbundId, selected.aktenzeichen);
        const result = runMatching({
          antrag: selected,
          primaerKategorie,
          aspekte,
          config,
          mitarbeiter,
          zuweisungen,
          historischeDeskriptorenByAnon: cache.historischeDeskriptorenByAnon,
          historischeAstByAnon: cache.historischeAstByAnon,
          anonymMap: cache.anonymMap,
          queryEmbedding,
          corpusEmbeddings,
          antraegeIndex,
          anzahlTV: tvCount,
          auslastungByAnon,
        });
        setMatches(result);
      } finally {
        setMatchingRunning(false);
      }
    })();
  }, [selectedAz, selected, selectedView, config, mitarbeiter, zuweisungen, cache.antraege, cache.historischeDeskriptorenByAnon, cache.anonymMap, storage, auslastungByAnon]);

  async function zuweisen(match: MatchResult): Promise<void> {
    if (!selected) return;
    // v2.4: PL-Freigabe bucht echte tvCount-Stunden + setzt anzahlTV im
    // Zuweisungs-Record, damit die Buchung mit der CSV konsistent ist.
    const verbundId = (selected as { verbund_id?: string }).verbund_id;
    const tvCount = getTVCount(cache.antraege, verbundId, selected.aktenzeichen);
    const z: Zuweisung = {
      antragId: selected.aktenzeichen,
      anonId: match.anonId,
      quartal: config.aktuellesQuartal,
      stunden: match.benoetigteStunden,
      anzahlTV: tvCount,
      status: 'freigegeben',
      freigegebenAm: new Date().toISOString(),
    };
    await upsertZuweisung(storage, z);
  }

  async function ablehnen(match: MatchResult): Promise<void> {
    if (!selected) return;
    const z: Zuweisung = {
      antragId: selected.aktenzeichen,
      anonId: match.anonId,
      quartal: config.aktuellesQuartal,
      stunden: 0,
      status: 'abgelehnt',
    };
    await upsertZuweisung(storage, z);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Export-Toolbar */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={exportAnonym}
          disabled={exportBusy}
          className="px-3 py-1.5 rounded-md text-[12px] cursor-pointer disabled:opacity-50"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          Export (anonym)
        </button>
        <button
          type="button"
          onClick={() => setPwOpen(true)}
          disabled={exportBusy}
          className="px-3 py-1.5 rounded-md text-[12px] cursor-pointer disabled:opacity-50"
          style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
        >
          Export (mit Kürzeln, geschützt)
        </button>
      </div>

      <PasswortDialog
        open={pwOpen}
        busy={exportBusy}
        onClose={() => setPwOpen(false)}
        onConfirm={exportGeschuetzt}
      />

      {/* Filter-Pills (Kategorien) */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">Kategorie</span>
        <button
          type="button"
          onClick={() => setKategorieFilter('')}
          className={`text-[11.5px] px-2.5 py-1 rounded-full cursor-pointer ${kategorieFilter === '' ? '' : 'opacity-50'}`}
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          Alle
        </button>
        {config.ueberKategorien.map(k => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKategorieFilter(k.id === kategorieFilter ? '' : k.id)}
            className={`cursor-pointer ${kategorieFilter === k.id ? '' : 'opacity-50'}`}
          >
            <KategoriePill kategorie={k} />
          </button>
        ))}
        <span className="ml-4 text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">Status</span>
        {(['offen', 'selbst', 'zugewiesen', 'alle'] as const).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`text-[11.5px] px-2.5 py-1 rounded-full cursor-pointer ${statusFilter === s ? '' : 'opacity-60'}`}
            style={{
              background: statusFilter === s ? 'var(--tf-text)' : 'transparent',
              color: statusFilter === s ? 'var(--tf-bg)' : 'var(--tf-text-secondary)',
              border: '0.5px solid var(--tf-border)',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Split */}
      <div className="grid grid-cols-2 gap-4 min-h-[600px]">
        {/* Links: Liste */}
        <div className="rounded-[12px] overflow-hidden flex flex-col" style={{ border: '0.5px solid var(--tf-border)' }}>
          <div className="px-3 py-2 text-[11.5px] text-[var(--tf-text-tertiary)]" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
            {filtered.length} Antrag{filtered.length !== 1 ? 'e' : ''}
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.map(v => {
              const isSel = selectedAz === v.antrag.aktenzeichen;
              // 1.17: Primaer (gefuellt) vs Aspekte (outline) trennen.
              const primaerId = v.klassifizierung.freigegebenePrimaer
                || v.klassifizierung.freigegebeneKategorien?.[0]
                || '';
              const aspektIds = v.klassifizierung.freigegebeneAspekte
                ?? v.klassifizierung.freigegebeneKategorien?.slice(1)
                ?? [];
              const primaerKat = config.ueberKategorien.find(k => k.id === primaerId);
              const aspektKats = aspektIds
                .map(id => config.ueberKategorien.find(k => k.id === id))
                .filter((k): k is NonNullable<typeof k> => k != null);
              const ze = zuweisungen.filter(z => z.antragId === v.antrag.aktenzeichen);
              const selbst = ze.some(z => z.status === 'selbst' || z.selbstEingetragen);
              const zug = ze.some(z => z.status === 'freigegeben');
              return (
                <div
                  key={v.antrag.aktenzeichen}
                  onClick={() => setSelectedAz(v.antrag.aktenzeichen)}
                  className="px-3 py-2 cursor-pointer flex items-center gap-2"
                  style={{
                    background: isSel ? 'var(--tf-bg-secondary)' : 'transparent',
                    borderBottom: '0.5px solid var(--tf-border)',
                  }}
                >
                  <span className="font-mono text-[11px] text-[var(--tf-text-secondary)]">{v.antrag.aktenzeichen}</span>
                  <span className="flex-1 truncate text-[12px]">{(v.antrag[CANONICAL_VERBUND_TITEL] as string | undefined) ?? '—'}</span>
                  <div className="flex gap-0.5">
                    {primaerKat && <KategoriePill key={primaerKat.id} kategorie={primaerKat} mode="primaer" />}
                    {aspektKats.map(k => <KategoriePill key={k.id} kategorie={k} mode="aspekt" />)}
                  </div>
                  {zug && <span className="text-emerald-700 text-[11px]">✓✓</span>}
                  {selbst && !zug && <span className="text-blue-700 text-[11px]">✓</span>}
                  <ConfidenceDot confidence={v.confidence} />
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-3 py-8 text-center text-[var(--tf-text-tertiary)] text-[12.5px]">
                Keine freigegebenen Anträge in dieser Ansicht.
              </div>
            )}
          </div>
        </div>

        {/* Rechts: Detail */}
        <div className="rounded-[12px] p-4 overflow-y-auto" style={{ border: '0.5px solid var(--tf-border)' }}>
          {!selected || !selectedView ? (
            <div className="flex items-center justify-center h-full text-[var(--tf-text-tertiary)] text-[12.5px]">
              ← Wähle einen Antrag aus
            </div>
          ) : (
            <DetailPanel
              antrag={selected}
              klassifizierung={selectedView.klassifizierung}
              kategorien={config.ueberKategorien}
              matches={matches}
              matchingRunning={matchingRunning}
              zuweisungen={zuweisungen.filter(z => z.antragId === selected.aktenzeichen)}
              mitarbeiter={mitarbeiter}
              onZuweisen={zuweisen}
              onAblehnen={ablehnen}
              tageImQuartal={computeTageImQuartal(config.aktuellesQuartal)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DetailPanel({
  antrag, klassifizierung, kategorien, matches, matchingRunning,
  zuweisungen, mitarbeiter, onZuweisen, onAblehnen, tageImQuartal,
}: {
  antrag: Antrag;
  klassifizierung: import('../types').Klassifizierung;
  kategorien: import('../types').UeberKategorie[];
  matches: MatchResult[];
  matchingRunning: boolean;
  zuweisungen: Zuweisung[];
  mitarbeiter: Record<string, import('../types').AnonymerMitarbeiter>;
  onZuweisen: (m: MatchResult) => void;
  onAblehnen: (m: MatchResult) => void;
  tageImQuartal: number;
}): React.ReactElement {
  const akt = antrag[CANONICAL_AKRONYM] as string | undefined;
  const vbTitel = antrag[CANONICAL_VERBUND_TITEL] as string | undefined;
  const tvTitel = antrag[CANONICAL_TITEL] as string | undefined;
  const summary = antrag[FIELD_PROJEKTBESCHREIBUNG] as string | undefined;
  const verbund_id = antrag[CANONICAL_VERBUND_ID] as string | undefined;
  const desk = readAntragDeskriptoren(antrag);
  // 1.17: Primaer (gefuellt) + Aspekte (outline) trennen, mit Fallback auf
  // deprecated freigegebeneKategorien fuer Pre-Migration-Stand.
  const primaerKatId = klassifizierung.freigegebenePrimaer
    || klassifizierung.freigegebeneKategorien?.[0]
    || '';
  const aspektKatIds = klassifizierung.freigegebeneAspekte
    ?? klassifizierung.freigegebeneKategorien?.slice(1)
    ?? [];
  const primaerKategorie = kategorien.find(k => k.id === primaerKatId);
  const aspektKategorien = aspektKatIds
    .map(id => kategorien.find(k => k.id === id))
    .filter((k): k is NonNullable<typeof k> => k != null);
  const selbstEintragung = zuweisungen.find(z => z.status === 'selbst' || z.selbstEingetragen);
  const hasLow = matches.length > 0 && matches.every(m => m.confidence === 'low');

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-[11px] text-[var(--tf-text-secondary)]">{antrag.aktenzeichen}</span>
          {akt && <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">{akt}</span>}
          {verbund_id && <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">VB {verbund_id}</span>}
          <div className="ml-auto flex gap-1">
            {primaerKategorie && <KategoriePill key={primaerKategorie.id} kategorie={primaerKategorie} mode="primaer" />}
            {aspektKategorien.map(k => <KategoriePill key={k.id} kategorie={k} mode="aspekt" />)}
          </div>
        </div>
        <h2 className="text-[14px] font-medium text-[var(--tf-text)]">{vbTitel ?? '—'}</h2>
        {tvTitel && tvTitel !== vbTitel && (
          <p className="text-[12px] text-[var(--tf-text-secondary)] mt-0.5">{tvTitel}</p>
        )}
      </div>

      {/* Selbst eingetragen Banner */}
      {selbstEintragung && (
        <div className="rounded p-2.5 flex items-center justify-between text-[12px]" style={{ background: 'var(--tf-info-soft, #dbeafe)', color: '#075985' }}>
          <span>
            <AnonymIdBadge anonId={selbstEintragung.anonId} size="sm" /> hat sich selbst eingetragen
          </span>
          <button
            type="button"
            onClick={() => {
              const m: MatchResult = {
                anonId: selbstEintragung.anonId,
                bm25Score: 1, embeddingScore: 0, kompetenzScore: 1, restKapazitaet: 0,
                quartalsKapazitaet: 0, balanceScore: 0, finalScore: 1,
                matchendeTechnologien: [], aehnlicheProjekte: [],
                matchStufe: 1, confidence: 'high',
                benoetigteStunden: selbstEintragung.stunden,
                astMatchCount: 0, astBoost: 0,
              };
              onZuweisen(m);
            }}
            className="text-[11.5px] px-2 py-0.5 rounded cursor-pointer font-medium"
            style={{ background: '#075985', color: 'white' }}
          >
            Bestätigen
          </button>
        </div>
      )}

      {/* Body */}
      {desk.length > 0 && (
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">Deskriptoren</div>
          <TechnologieTags tags={desk} />
        </div>
      )}
      {summary && (
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">Zusammenfassung</div>
          <p className="text-[12px] text-[var(--tf-text-secondary)] line-clamp-5">{summary}</p>
        </div>
      )}

      {/* Match-Vorschlaege */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[12.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">Vorschläge (Top {matches.length})</h3>
          {matchingRunning && <span className="text-[11px] text-[var(--tf-text-tertiary)]">Berechne…</span>}
        </div>
        {hasLow && (
          <div className="mb-2 rounded p-2 text-[11.5px]" style={{ background: '#fef3c7', color: '#92400e' }}>
            ⚠ Kein klares Match — manuelle Prüfung empfohlen.
          </div>
        )}
        <div className="flex flex-col gap-2">
          {matches.map(m => (
            <VorschlagCard
              key={m.anonId}
              match={m}
              onZuweisen={() => onZuweisen(m)}
              onAblehnen={() => onAblehnen(m)}
              tageImQuartal={tageImQuartal}
            />
          ))}
          {matches.length === 0 && !matchingRunning && (
            <p className="text-[12px] text-[var(--tf-text-tertiary)] text-center py-4">
              Keine passenden MAs gefunden — möglicherweise keine MAs in den Kategorien, alle abgemeldet oder Kapazität voll.
            </p>
          )}
        </div>
      </div>

      {/* Aktuelle Zuweisungen */}
      {zuweisungen.length > 0 && (
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">Zuweisungen</div>
          <ul className="text-[11.5px] space-y-0.5">
            {zuweisungen.map(z => {
              const ma = mitarbeiter[z.anonId];
              return (
                <li key={z.anonId} className="flex items-center gap-2">
                  <AnonymIdBadge anonId={z.anonId} size="sm" />
                  <span className="text-[var(--tf-text-secondary)]">{z.status}</span>
                  <span className="text-[var(--tf-text-tertiary)]">· {z.stunden}h</span>
                  {ma && <span className="text-[var(--tf-text-tertiary)]">· Q {z.quartal}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
