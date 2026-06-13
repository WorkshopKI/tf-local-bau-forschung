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
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import { readXsw, xswMatchesOwnKuerzel } from '@/plugins/antraege/xsw';
import { useAuslastungData } from '@/plugins/auslastung/hooks/useAuslastungData';
import { useAntraegeCache } from '@/plugins/auslastung/hooks/useAntraegeCache';
import { useKuerzelMap } from '@/plugins/auslastung/hooks/useKuerzelMap';
import { useBenachrichtigung } from '@/plugins/auslastung/hooks/useBenachrichtigung';
import { useMyAuslastungProfil } from '@/plugins/auslastung/hooks/useMyAuslastungProfil';
import { useMyUebernahmeWuensche } from '@/plugins/auslastung/hooks/useMyUebernahmeWuensche';
import { computeKapazitaet } from '@/plugins/auslastung/services/kapazitaet';
import { matchesAntragstyp } from '@/plugins/auslastung/services/kapazitaet';
import {
  computeQuartalsAuslastung,
  getTVCount,
} from '@/plugins/auslastung/services/kapazitaet';
import type { AntragOderSlim } from '@/core/services/csv/types';
import {
  groupEintraegeByVerbund,
  isClaimed,
  type OffenerAntrag,
} from './neueAntraegeVerbund';
import { NeueAntraegeVerbundRow } from './NeueAntraegeVerbundRow';
import { NeueAntraegeAlleModal } from './NeueAntraegeAlleModal';

/** Stabile leere Menge — vermeidet Render-Churn beim Hook-Param/Deps. */
const EMPTY_AKTENZEICHEN: ReadonlySet<string> = new Set();

export function NeueAntraegeFuerDich(): React.ReactElement | null {
  const storage = useStorage();
  const config = useAuslastungData(s => s.data.config);
  const klassifizierungen = useAuslastungData(s => s.data.klassifizierungen);
  const zuweisungen = useAuslastungData(s => s.data.zuweisungen);
  const loaded = useAuslastungData(s => s.loaded);
  const load = useAuslastungData(s => s.load);
  const cache = useAntraegeCache();
  const kuerzelMapLoaded = useKuerzelMap(s => s.loaded);
  // Rohes eigenes Kürzel (ggf. kommagetrennt) für den T_XSW-Wiedereinreicher-Bump.
  // Aus dem MA-Login (sonst Profilfeld) via zentralem Getter.
  const ownKuerzelRaw = useMeinKuerzel() ?? null;
  const [showAlleModal, setShowAlleModal] = useState(false);
  const [open, toggleOpen] = useCollapsedSection('home_neue_antraege_collapsed');

  // Idempotent: triggert Initial-Load auch wenn der User noch nie im
  // Auslastungs-Tab war. Store ignoriert Doppel-Aufrufe via loading-Lock.
  useEffect(() => {
    if (!loaded) void load(storage);
  }, [load, loaded, storage]);

  // Eigenes Profil: persoenliches Profil (ZAH/auslastung-profil.json) hat Vorrang
  // vor dem auslastung.json-Store-Record — sonst sieht ein frischer User seine
  // gerade gesetzte Hauptkategorie erst nach PL-Aggregation (v2.6-Regression).
  const { myAnonId, effectiveMa: myMa, hauptKategorie: myHauptKategorie, loading: profilLoading } = useMyAuslastungProfil();

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
    const m = new Map<string, AntragOderSlim>();
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
      config.stundenProTVProTyp,
    ),
    [cache.antraege, cache.anonymMap, zuweisungen, config.aktuellesQuartal, config.stundenProTV, config.stundenProTVProTyp],
  );
  const myAuslastung = myAnonId ? auslastungByAnon.get(myAnonId) : undefined;
  const myFestAktenzeichen = myAuslastung?.fest.aktenzeichenSet;
  const myPendingAktenzeichen = myAuslastung?.pending.aktenzeichenSet;

  // v2.9: eigene Übernahme-Wünsche aus dem persoenlichen Ordner. Schreibt NICHT
  // mehr direkt in auslastung.json (prod-User sind read-only) — der Wunsch geht
  // in ZAH/auslastung-uebernahme.json, die PL sammelt ihn ein. Das pendingSet
  // (aus auslastung.json) speist das self-healing Prune des Ruecknahme-Overlays
  // — erst wenn der Store geladen ist (sonst leert ein leeres Set es vorzeitig).
  const {
    claimedSet,
    retractedSet,
    wuensche,
    loading: wuenscheLoading,
    busy: wuenscheBusy,
    error: wuenscheError,
    claim,
    undo,
  } = useMyUebernahmeWuensche(loaded ? (myPendingAktenzeichen ?? EMPTY_AKTENZEICHEN) : undefined);

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
      // Selbst-Zuweisung (Pending) — abzueglich lokal zurueckgenommener
      // (retractedSet, Optimistic-Overlay). Bleibt sichtbar statt zu verschwinden.
      const claimed = isClaimed(k.antragId, claimedSet, myPendingAktenzeichen ?? EMPTY_AKTENZEICHEN, retractedSet);
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
  }, [klassifizierungen, myMa, myHauptKategorie, myFestAktenzeichen, myPendingAktenzeichen, claimedSet, retractedSet, antraegeById, config.selbsteintragungFristTage, ownKuerzelRaw]);

  // Verbund-Gruppierung: Bearbeiter übernehmen den ganzen Verbund, nicht
  // einzelne TVs. Aus den per-TV-Einträgen wird eine Zeile pro Verbund.
  // pendingSet + retractedSet → claimedAktenzeichen umfasst auch PL-Pending-TVs
  // (sonst hätte „Rückgängig" bei eingesammelten Anträgen kein Ziel).
  const verbundEintraege = useMemo(
    () => groupEintraegeByVerbund(eintraege, cache.antraege, cache.verbuendeById, claimedSet, myPendingAktenzeichen ?? EMPTY_AKTENZEICHEN, retractedSet),
    [eintraege, cache.antraege, cache.verbuendeById, claimedSet, myPendingAktenzeichen, retractedSet],
  );
  const offene = useMemo(() => verbundEintraege.filter(v => !v.claimed), [verbundEintraege]);
  const vorgemerkt = useMemo(() => verbundEintraege.filter(v => v.claimed), [verbundEintraege]);

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
        collapsible
        collapsed={!open}
        onToggleCollapsed={toggleOpen}
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
      <div
        className="grid transition-[grid-template-rows] ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr', transitionDuration: 'var(--tf-duration-med)' }}
      >
        <div className="overflow-hidden">
      <div className="flex flex-col gap-2">
        {visible.map(v => (
          <NeueAntraegeVerbundRow
            key={v.verbundId}
            verbund={v}
            onUebernehmen={() => handleClaim(v.leadAktenzeichen)}
            onUndo={() => v.claimedAktenzeichen.forEach(az => void undo(az))}
            disabled={wuenscheBusy}
          />
        ))}
        {/* Vorgemerkte Verbünde: gedämpft inline darunter, „Rückgängig" statt
            „Kann ich übernehmen" — der User hat sich schon eingetragen. */}
        {vorgemerkt.map(v => (
          <NeueAntraegeVerbundRow
            key={v.verbundId}
            verbund={v}
            onUebernehmen={() => handleClaim(v.leadAktenzeichen)}
            onUndo={() => v.claimedAktenzeichen.forEach(az => void undo(az))}
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
      {retractedSet.size > 0 && (
        <p className="mt-1 text-[10.5px] text-[var(--tf-text-tertiary)]">
          Zurückgenommene Vormerkungen verschwinden beim nächsten Einsammeln durch die Projektleitung.
        </p>
      )}
      {wuenscheError && (
        <div className="mt-2 text-[11.5px] text-[var(--tf-danger-text)]">
          Fehler: {wuenscheError}
        </div>
      )}
        </div>
      </div>
      {showAlleModal && (
        <NeueAntraegeAlleModal
          alle={offene}
          onClose={() => setShowAlleModal(false)}
          onUebernehmen={(leadAktenzeichen) => handleClaim(leadAktenzeichen)}
          busy={wuenscheBusy}
        />
      )}
    </div>
  );
}

