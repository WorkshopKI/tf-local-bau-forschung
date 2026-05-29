/**
 * NeueAntraegeFuerDich — Homepage-Sektion fuer MA-Selbsteintragung (1.17).
 *
 * Loest den eigenen Tab "Selbsteintragung" im Auslastungs-Modul ab.
 * MAs sehen offene Antraege ihrer **Hauptkategorie** direkt auf der Home-
 * Page mit "Uebernehme ich"-Button + Frist + Kapazitaets-Hinweis.
 *
 * Filter:
 *  - klassifizierung.status === 'freigegeben'
 *  - klassifizierung.freigegebenePrimaer === myMa.hauptKategorie
 *    (Fallback fuer noch nicht migrierte MAs: ma.ueberKategorien enthaelt
 *     den Primaer-Wert)
 *  - kein Eintrag in zuweisungen mit status 'freigegeben'|'selbst'
 *  - Frist nicht abgelaufen (`config.selbsteintragungFristTage`)
 *
 * Sichtbar: nur wenn Bearbeiter-Kuerzel gesetzt + MA im aktuellen Programm
 * bekannt + offene Antraege vorhanden ODER hauptKategorie fehlt.
 *
 * Stunden bleiben intern — Anzeige ausschliesslich in Antraegen
 * ("4 von 16 Antraegen frei in Q2-2026").
 */
import { useEffect, useMemo, useState } from 'react';
import { SectionHeader } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { XswSuffix } from '@/plugins/antraege/XswSuffix';
import { readXsw, xswMatchesOwnKuerzel } from '@/plugins/antraege/xsw';
import { useAuslastungData } from '@/plugins/auslastung/hooks/useAuslastungData';
import { useAntraegeCache } from '@/plugins/auslastung/hooks/useAntraegeCache';
import { useKuerzelMap } from '@/plugins/auslastung/hooks/useKuerzelMap';
import { useBenachrichtigung } from '@/plugins/auslastung/hooks/useBenachrichtigung';
import { useMyAuslastungProfil } from '@/plugins/auslastung/hooks/useMyAuslastungProfil';
import { useMyUebernahmeWuensche } from '@/plugins/auslastung/hooks/useMyUebernahmeWuensche';
import { computeKapazitaet } from '@/plugins/auslastung/services/kapazitaet';
import { matchesAntragstyp } from '@/plugins/auslastung/services/antragstyp-praeferenz';
import {
  computeQuartalsAuslastung,
  getTVCount,
} from '@/plugins/auslastung/services/quartals-auslastung';
import { KategoriePill } from '@/plugins/auslastung/components/KategoriePill';
import {
  CANONICAL_TITEL,
  CANONICAL_VERBUND_TITEL,
  type Klassifizierung,
} from '@/plugins/auslastung/types';
import type { Antrag } from '@/core/services/csv/types';

interface OffenerAntrag {
  antrag: Antrag;
  klassifizierung: Klassifizierung;
  daysLeft: number;
  /** T_XSW enthält das EIGENE Kürzel des Users → „mein alter Antrag" → nach oben. */
  xswMine: boolean;
  /** Vom User vorgemerkt („Kann ich übernehmen" geklickt) — lokaler Wunsch
   *  ODER bereits von der PL eingesammelte Selbst-Zuweisung. Bleibt sichtbar
   *  (gedämpft, mit „Rückgängig"), statt zu verschwinden. */
  claimed: boolean;
}

export function NeueAntraegeFuerDich(): React.ReactElement | null {
  const storage = useStorage();
  const config = useAuslastungData(s => s.data.config);
  const klassifizierungen = useAuslastungData(s => s.data.klassifizierungen);
  const zuweisungen = useAuslastungData(s => s.data.zuweisungen);
  const loaded = useAuslastungData(s => s.loaded);
  const load = useAuslastungData(s => s.load);
  const cache = useAntraegeCache();
  const kuerzelMapLoaded = useKuerzelMap(s => s.loaded);
  const { profile } = useProfile();
  // Rohes eigenes Kürzel (ggf. kommagetrennt) für den T_XSW-Wiedereinreicher-Bump.
  const ownKuerzelRaw = profile?.bearbeiter_kuerzel ?? null;
  const [showAlleModal, setShowAlleModal] = useState(false);

  // Idempotent: triggert Initial-Load auch wenn der User noch nie im
  // Auslastungs-Tab war. Store ignoriert Doppel-Aufrufe via loading-Lock.
  useEffect(() => {
    if (!loaded) void load(storage);
  }, [load, loaded, storage]);

  // Eigenes Profil: persoenliches Profil (ZAH/auslastung-profil.json) hat Vorrang
  // vor dem auslastung.json-Store-Record — sonst sieht ein frischer User seine
  // gerade gesetzte Hauptkategorie erst nach PL-Aggregation (v2.6-Regression).
  const { myAnonId, effectiveMa: myMa, hauptKategorie: myHauptKategorie, loading: profilLoading } = useMyAuslastungProfil();

  // v2.9: eigene Übernahme-Wünsche aus dem persoenlichen Ordner. Schreibt NICHT
  // mehr direkt in auslastung.json (prod-User sind read-only) — der Wunsch geht
  // in ZAH/auslastung-uebernahme.json, die PL sammelt ihn ein.
  const {
    claimedSet,
    wuensche,
    loading: wuenscheLoading,
    busy: wuenscheBusy,
    error: wuenscheError,
    claim,
    undo,
  } = useMyUebernahmeWuensche();

  // Zähler-Badge: ersetzt den frueheren SelbsteintragungBanner (v2.3).
  // Der User sieht die Liste direkt darunter — die Banner-Funktion ist
  // erfuellt. Wir lassen den Badge 5 s sichtbar, damit der User die Zahl
  // wahrnehmen kann, und dismissen dann automatisch (markiert lastSeen=now).
  // Beim naechsten Page-Visit ist das Badge weg, sofern keine neuen
  // Klassifizierungen seitdem dazugekommen sind.
  const { neueAnzahl, dismiss } = useBenachrichtigung(myAnonId, myHauptKategorie);
  useEffect(() => {
    if (neueAnzahl === 0) return;
    const t = setTimeout(() => dismiss(), 5000);
    return () => clearTimeout(t);
  }, [neueAnzahl, dismiss]);

  // Antrag-Index fuer schnellen Lookup.
  const antraegeById = useMemo(() => {
    const m = new Map<string, Antrag>();
    for (const a of cache.antraege) m.set(a.aktenzeichen, a);
    return m;
  }, [cache.antraege]);

  // v2.4: Zentrale Quartals-Auslastungs-Berechnung — Single Source of Truth.
  // Liefert pro MA `{ fest, pending }` mit `aktenzeichenSet`, das wir fuer
  // den Pool-Filter (Antraege, die schon fest gebucht sind, nicht mehr
  // anbieten) UND fuer Pending-Dedup nutzen.
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
  const myAuslastung = myAnonId ? auslastungByAnon.get(myAnonId) : undefined;
  const myFestAktenzeichen = myAuslastung?.fest.aktenzeichenSet;
  const myPendingAktenzeichen = myAuslastung?.pending.aktenzeichenSet;

  const eintraege = useMemo((): OffenerAntrag[] => {
    if (!myMa || !myHauptKategorie) return [];
    const fristTage = config.selbsteintragungFristTage;
    const items: OffenerAntrag[] = [];
    for (const k of klassifizierungen) {
      if (k.status !== 'freigegeben') continue;
      if (k.freigegebenePrimaer !== myHauptKategorie) continue;
      // Fest gebucht (CSV) — nicht mehr anbieten
      if (myFestAktenzeichen?.has(k.antragId)) continue;
      const antrag = antraegeById.get(k.antragId);
      if (!antrag) continue;
      // v2.2: Antragstyp-Filter (FuE/DS/DL/NW). Ohne Praeferenz: passt alles
      // durch (Backwards-Kompat). PL-Override hat Vorrang.
      if (!matchesAntragstyp(antrag, myMa)) continue;
      // v2.9: vorgemerkt = lokaler Wunsch ODER bereits eingesammelte
      // Selbst-Zuweisung (Pending). Bleibt sichtbar statt zu verschwinden.
      const claimed = claimedSet.has(k.antragId) || (myPendingAktenzeichen?.has(k.antragId) ?? false);
      // Frist berechnen
      const freigegebenAm = k.freigegebenAm ? new Date(k.freigegebenAm).getTime() : null;
      const deadline = freigegebenAm != null ? freigegebenAm + fristTage * 86400000 : null;
      const daysLeft = deadline != null ? Math.max(0, Math.ceil((deadline - Date.now()) / 86400000)) : fristTage;
      // Frist gilt nur fuer noch nicht vorgemerkte Antraege — vorgemerkte bleiben
      // sichtbar (der User hat schon gehandelt, „Rückgängig" moeglich).
      if (!claimed && deadline != null && daysLeft <= 0) continue;
      // Wiedereinreicher-Bump: T_XSW enthält das eigene Kürzel → „mein alter Antrag".
      const xswMine = xswMatchesOwnKuerzel(readXsw(antrag), ownKuerzelRaw);
      items.push({ antrag, klassifizierung: k, daysLeft, xswMine, claimed });
    }
    // Sortierung: vorgemerkte ans Ende (weniger prominent); unter den offenen
    // eigene Wiedereinreicher zuerst, dann Frist asc; Tiebreak Akronym asc.
    items.sort((a, b) => {
      if (a.claimed !== b.claimed) return a.claimed ? 1 : -1;
      if (!a.claimed) {
        if (a.xswMine !== b.xswMine) return a.xswMine ? -1 : 1;
        if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
      }
      const akA = (a.antrag.akronym as string | undefined) ?? a.antrag.aktenzeichen;
      const akB = (b.antrag.akronym as string | undefined) ?? b.antrag.aktenzeichen;
      return akA.localeCompare(akB);
    });
    return items;
  }, [klassifizierungen, myMa, myHauptKategorie, myFestAktenzeichen, myPendingAktenzeichen, claimedSet, antraegeById, config.selbsteintragungFristTage, ownKuerzelRaw]);

  const offene = useMemo(() => eintraege.filter(e => !e.claimed), [eintraege]);
  const vorgemerkt = useMemo(() => eintraege.filter(e => e.claimed), [eintraege]);

  // Lokale Wünsche, die noch nicht in auslastung.json (Pending) stehen, in die
  // Pending-Anzeige einrechnen — sonst sieht der prod-User nach dem Klick keine
  // Veraenderung (Wunsch ist erst nach PL-Einsammeln im Store).
  const extraPending = useMemo(() => {
    let antraege = 0;
    let tvs = 0;
    for (const w of wuensche) {
      if (myPendingAktenzeichen?.has(w.antragId)) continue;
      antraege += 1;
      tvs += w.anzahlTV > 0 ? w.anzahlTV : 1;
    }
    return { antraege, tvs };
  }, [wuensche, myPendingAktenzeichen]);

  // Kapazitaets-Sicht (v2.4): konsumiert MaQuartalsAuslastung statt
  // zuweisungen[]+externeAnzahl. Rest in TVs statt "Antraegen" (Stunden-
  // basiert, kein durchschnittTV-Faktor mehr).
  const kapView = useMemo(() => {
    if (!myMa) return null;
    return computeKapazitaet(myMa, myAuslastung, config);
  }, [myMa, myAuslastung, config]);

  // "Kann ich uebernehmen" (v2.9): kein Direkt-Write in auslastung.json mehr
  // (prod-User read-only → NotAllowedError). Der Wunsch geht mit ECHTER
  // TV-Anzahl in den persoenlichen Ordner; die PL sammelt ihn ein.
  function handleClaim(antragId: string): void {
    const antrag = antraegeById.get(antragId);
    const verbundId = (antrag as { verbund_id?: string } | undefined)?.verbund_id ?? null;
    const tvCount = getTVCount(cache.antraege, verbundId, antragId);
    void claim(antragId, tvCount, config.aktuellesQuartal);
  }

  // Sichtbarkeit
  if (!loaded || !kuerzelMapLoaded) return null;
  if (profilLoading || wuenscheLoading) return null;  // warten bis Profil + Wünsche geladen sind (kein Flackern claimed↔offen)
  if (!myAnonId) return null;  // User hat kein Kuerzel oder nicht im Auslastungs-Modul
  if (!myHauptKategorie) {
    return (
      <div className="mb-6">
        <SectionHeader label="Neue Anträge für dich" />
        <div className="rounded-[var(--tf-radius)] p-4 bg-[var(--tf-bg-secondary)] text-[12.5px] text-[var(--tf-text-secondary)]">
          Lege deine Hauptkategorie im Profil fest, damit hier passende Anträge erscheinen.
        </div>
      </div>
    );
  }
  // Nichts Offenes UND nichts Vorgemerktes → Sektion ausblenden.
  if (eintraege.length === 0) return null;

  const visible = offene.slice(0, 5);
  const hasMore = offene.length > 5;

  return (
    <div className="mb-6" data-auslastung="neue-antraege">
      <SectionHeader
        label="Neue Anträge für dich"
        action={
          <div className="flex items-center gap-2">
            {neueAnzahl > 0 && (
              <span
                className="text-[10.5px] font-medium px-1.5 py-0.5 rounded"
                style={{
                  background: 'var(--tf-primary-soft, var(--tf-bg-secondary))',
                  color: 'var(--tf-primary)',
                }}
                title={`${neueAnzahl} neu seit deinem letzten Besuch`}
              >
                {neueAnzahl} neu
              </span>
            )}
            {hasMore && (
              <button
                onClick={() => setShowAlleModal(true)}
                className="text-[11px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
              >
                Alle ({offene.length}) →
              </button>
            )}
          </div>
        }
      />
      <div className="flex flex-col gap-2">
        {visible.map(item => (
          <NeueAntraegeRow
            key={item.antrag.aktenzeichen}
            item={item}
            onUebernehmen={() => handleClaim(item.antrag.aktenzeichen)}
            onUndo={() => void undo(item.antrag.aktenzeichen)}
            disabled={wuenscheBusy}
          />
        ))}
        {/* Vorgemerkte Antraege: gedämpft inline darunter, „Rückgängig" statt
            „Kann ich übernehmen" — der User hat sich schon eingetragen. */}
        {vorgemerkt.map(item => (
          <NeueAntraegeRow
            key={item.antrag.aktenzeichen}
            item={item}
            onUebernehmen={() => handleClaim(item.antrag.aktenzeichen)}
            onUndo={() => void undo(item.antrag.aktenzeichen)}
            disabled={wuenscheBusy}
          />
        ))}
      </div>
      {kapView && (
        <p className="mt-2 text-[11px] text-[var(--tf-text-tertiary)]">
          Festgebucht: {kapView.fest.antraege} {kapView.fest.antraege === 1 ? 'Antrag' : 'Anträge'} ({kapView.fest.tvs} TVs)
          {(kapView.pending.antraege + extraPending.antraege) > 0 && ` · Pending: ${kapView.pending.antraege + extraPending.antraege} (${kapView.pending.tvs + extraPending.tvs} TVs)`}
          {' · '}
          {kapView.ueberbuchung > 0
            ? <span className="text-[var(--tf-warning-text)]">Überbucht um {Math.ceil(kapView.ueberbuchung)}h</span>
            : <>Frei: {Math.max(0, kapView.restTVs - extraPending.tvs)} TVs</>}
          {' in '}{config.aktuellesQuartal}
        </p>
      )}
      {wuenscheError && (
        <div className="mt-2 text-[11.5px] text-[var(--tf-danger-text)]">
          Fehler: {wuenscheError}
        </div>
      )}
      {showAlleModal && (
        <NeueAntraegeAlleModal
          alle={offene}
          configKategorien={config.ueberKategorien}
          onClose={() => setShowAlleModal(false)}
          onUebernehmen={(id) => handleClaim(id)}
          busy={wuenscheBusy}
        />
      )}
    </div>
  );
}

interface RowProps {
  item: OffenerAntrag;
  onUebernehmen: () => void;
  /** v2.9: „Rückgängig" — Vormerkung zuruecknehmen (nur fuer claimed-Rows). */
  onUndo?: () => void;
  disabled?: boolean;
  /** Kompakte Layout-Variante fuer das "Alle"-Modal (v2.3):
   *  weniger Padding, Akronym/Titel/Frist/Button in einer Zeile. */
  compact?: boolean;
}

function NeueAntraegeRow({ item, onUebernehmen, onUndo, disabled, compact }: RowProps): React.ReactElement {
  const config = useAuslastungData(s => s.data.config);
  const { antrag, klassifizierung, daysLeft, claimed } = item;
  const primaerId = klassifizierung.freigegebenePrimaer;
  const aspektIds = klassifizierung.freigegebeneAspekte;
  const primaerKat = config.ueberKategorien.find(k => k.id === primaerId);
  const aspektKats = aspektIds
    .map(id => config.ueberKategorien.find(k => k.id === id))
    .filter((k): k is NonNullable<typeof k> => k != null);
  const titel = (antrag[CANONICAL_VERBUND_TITEL] as string | undefined)
    ?? (antrag[CANONICAL_TITEL] as string | undefined)
    ?? '—';
  const akronym = (antrag.akronym as string | undefined) ?? null;
  const fristTone = daysLeft <= 2 ? 'text-rose-700 font-medium'
    : daysLeft <= 3 ? 'text-amber-700 font-medium'
    : 'text-[var(--tf-text-tertiary)]';

  // v2.3: dezenter Secondary-Style fuer den CTA-Button. Der vorherige
  // schwarz/weiss-Kontrast suggeriert Endgueltigkeit — der User signalisiert
  // hier aber nur Absicht, die PL entscheidet final.
  const buttonClasses = 'rounded-md text-[12px] cursor-pointer border bg-[var(--tf-bg)] hover:bg-[var(--tf-bg-secondary)] text-[var(--tf-text)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
  const buttonStyle: React.CSSProperties = { borderColor: 'var(--tf-border)' };

  // v2.9: vorgemerkte Rows gedämpft (dezenter Hintergrund + Tertiär-Text statt
  // opacity, Pitfall #14) + Button „Rückgängig" statt „Kann ich übernehmen".
  const rowStyle: React.CSSProperties = claimed
    ? { border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg-secondary)' }
    : { border: '0.5px solid var(--tf-border)' };
  const actionLabel = claimed ? 'Rückgängig' : 'Kann ich übernehmen';
  const onAction = claimed ? onUndo : onUebernehmen;
  const actionAria = `${actionLabel} — ${akronym ?? antrag.aktenzeichen}`;

  if (compact) {
    return (
      <div
        className="rounded-[8px] px-2.5 py-1.5 flex items-center gap-3"
        style={rowStyle}
      >
        <span className="font-mono text-[10.5px] text-[var(--tf-text-secondary)] shrink-0 w-[88px] truncate">
          {antrag.aktenzeichen}
        </span>
        {primaerKat && (
          <div className="shrink-0">
            <KategoriePill kategorie={primaerKat} active />
          </div>
        )}
        <div className="flex-1 min-w-0 text-[12px] text-[var(--tf-text)] truncate">
          {akronym && <span className="font-medium">{akronym}</span>}
          {akronym && <span className="text-[var(--tf-text-tertiary)]"> · </span>}
          <span className="text-[var(--tf-text-secondary)]">{titel}</span>
        </div>
        <XswSuffix value={antrag} className="shrink-0 max-w-[35%] truncate text-[12px]" />
        {claimed ? (
          <span className="text-[10.5px] shrink-0 text-[var(--tf-text-tertiary)]">Vorgemerkt</span>
        ) : (
          <span className={`text-[10.5px] tabular-nums shrink-0 ${fristTone}`} title="Verbleibende Frist">
            Noch {daysLeft}d
          </span>
        )}
        <button
          type="button"
          onClick={onAction}
          disabled={disabled}
          className={`${buttonClasses} px-2.5 py-1 shrink-0`}
          style={buttonStyle}
          aria-label={actionAria}
        >
          {actionLabel}
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-[12px] p-3 flex items-center gap-4"
      style={rowStyle}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-mono text-[11px] text-[var(--tf-text-secondary)]">
            {antrag.aktenzeichen}
          </span>
          {primaerKat && <KategoriePill kategorie={primaerKat} active />}
          {aspektKats.map(k => (
            <KategoriePill key={k.id} kategorie={k} active={false} />
          ))}
          {claimed && (
            <span className="text-[10px] px-1.5 py-0.5 rounded text-[var(--tf-text-tertiary)]" style={{ border: '0.5px solid var(--tf-border)' }}>
              Vorgemerkt
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1 min-w-0">
          <span className="text-[12.5px] text-[var(--tf-text)] truncate">{titel}</span>
          <XswSuffix value={antrag} className="shrink-0 max-w-[50%] truncate text-[12.5px]" />
        </div>
      </div>
      <div className="text-right flex flex-col items-end gap-1 shrink-0">
        {!claimed && (
          <span className={`text-[10.5px] ${fristTone}`}>
            Noch {daysLeft} Tag{daysLeft === 1 ? '' : 'e'}
          </span>
        )}
        <button
          type="button"
          onClick={onAction}
          disabled={disabled}
          className={`${buttonClasses} px-3 py-1`}
          style={buttonStyle}
          aria-label={actionAria}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

interface ModalProps {
  alle: OffenerAntrag[];
  configKategorien: import('@/plugins/auslastung/types').UeberKategorie[];
  onClose: () => void;
  onUebernehmen: (antragId: string) => void;
  busy?: boolean;
}

function NeueAntraegeAlleModal({ alle, onClose, onUebernehmen, busy }: ModalProps): React.ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] rounded-[12px] flex flex-col"
        style={{ background: 'var(--tf-bg)', border: '0.5px solid var(--tf-border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="flex items-center justify-between px-4 py-2.5 shrink-0"
          style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
          <h2 className="text-[14px] font-medium">Alle neuen Anträge ({alle.length})</h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] text-[18px] leading-none px-1"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>
        {/* Scrollbarer Body — kompakte Rows damit moeglichst viele ohne
            Scrollen sichtbar sind. */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="flex flex-col gap-1.5">
            {alle.map(item => (
              <NeueAntraegeRow
                key={item.antrag.aktenzeichen}
                item={item}
                onUebernehmen={() => onUebernehmen(item.antrag.aktenzeichen)}
                disabled={busy}
                compact
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

