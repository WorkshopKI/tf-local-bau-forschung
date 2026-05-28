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
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useAuslastungData } from '@/plugins/auslastung/hooks/useAuslastungData';
import { useAntraegeCache } from '@/plugins/auslastung/hooks/useAntraegeCache';
import { useKuerzelMap } from '@/plugins/auslastung/hooks/useKuerzelMap';
import { useBenachrichtigung } from '@/plugins/auslastung/hooks/useBenachrichtigung';
import { resolveAnonIdForUser } from '@/plugins/auslastung/services/anonym-map';
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
  type Zuweisung,
} from '@/plugins/auslastung/types';
import type { Antrag } from '@/core/services/csv/types';

interface OffenerAntrag {
  antrag: Antrag;
  klassifizierung: Klassifizierung;
  daysLeft: number;
}

export function NeueAntraegeFuerDich(): React.ReactElement | null {
  const storage = useStorage();
  const { profile } = useProfile();
  const config = useAuslastungData(s => s.data.config);
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);
  const klassifizierungen = useAuslastungData(s => s.data.klassifizierungen);
  const zuweisungen = useAuslastungData(s => s.data.zuweisungen);
  const upsertZuweisung = useAuslastungData(s => s.upsertZuweisung);
  const loaded = useAuslastungData(s => s.loaded);
  const load = useAuslastungData(s => s.load);
  const cache = useAntraegeCache();
  const kuerzelMapLoaded = useKuerzelMap(s => s.loaded);
  const [showAlleModal, setShowAlleModal] = useState(false);

  // Idempotent: triggert Initial-Load auch wenn der User noch nie im
  // Auslastungs-Tab war. Store ignoriert Doppel-Aufrufe via loading-Lock.
  useEffect(() => {
    if (!loaded) void load(storage);
  }, [load, loaded, storage]);

  const myAnonId = resolveAnonIdForUser(profile?.bearbeiter_kuerzel, cache.anonymMap);
  const myMa = myAnonId ? mitarbeiter[myAnonId] : undefined;
  const myHauptKategorie = myMa?.hauptKategorie ?? '';

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

  const offene = useMemo((): OffenerAntrag[] => {
    if (!myMa || !myHauptKategorie) return [];
    const fristTage = config.selbsteintragungFristTage;
    const items: OffenerAntrag[] = [];
    for (const k of klassifizierungen) {
      if (k.status !== 'freigegeben') continue;
      if (k.freigegebenePrimaer !== myHauptKategorie) continue;
      // Fest gebucht (CSV) — nicht mehr anbieten
      if (myFestAktenzeichen?.has(k.antragId)) continue;
      // Pending (eigene Selbsteintragung) — nicht mehr anbieten
      if (myPendingAktenzeichen?.has(k.antragId)) continue;
      const antrag = antraegeById.get(k.antragId);
      if (!antrag) continue;
      // v2.2: Antragstyp-Filter (FuE/DS/DL/NW). Ohne Praeferenz: passt alles
      // durch (Backwards-Kompat). PL-Override hat Vorrang.
      if (!matchesAntragstyp(antrag, myMa)) continue;
      // Frist berechnen
      const freigegebenAm = k.freigegebenAm ? new Date(k.freigegebenAm).getTime() : null;
      const deadline = freigegebenAm != null ? freigegebenAm + fristTage * 86400000 : null;
      const daysLeft = deadline != null ? Math.max(0, Math.ceil((deadline - Date.now()) / 86400000)) : fristTage;
      if (deadline != null && daysLeft <= 0) continue;
      items.push({ antrag, klassifizierung: k, daysLeft });
    }
    // Sortierung: Frist asc, dann Akronym asc
    items.sort((a, b) => {
      if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
      const akA = (a.antrag.akronym as string | undefined) ?? a.antrag.aktenzeichen;
      const akB = (b.antrag.akronym as string | undefined) ?? b.antrag.aktenzeichen;
      return akA.localeCompare(akB);
    });
    return items;
  }, [klassifizierungen, myMa, myHauptKategorie, myFestAktenzeichen, myPendingAktenzeichen, antraegeById, config.selbsteintragungFristTage]);

  // Kapazitaets-Sicht (v2.4): konsumiert MaQuartalsAuslastung statt
  // zuweisungen[]+externeAnzahl. Rest in TVs statt "Antraegen" (Stunden-
  // basiert, kein durchschnittTV-Faktor mehr).
  const kapView = useMemo(() => {
    if (!myMa) return null;
    return computeKapazitaet(myMa, myAuslastung, config);
  }, [myMa, myAuslastung, config]);

  // "Kann ich uebernehmen" — Selbsteintragung mit ECHTER TV-Anzahl (v2.4).
  // Bei einem 4-TV-Verbund werden tvCount × stundenProTV = 36h gebucht, nicht
  // pauschal 9h wie vorher.
  const uebernehmen = useAsyncAction(async (antragId: string) => {
    if (!myAnonId) return;
    const stundenProTV = config.stundenProTV ?? 9;
    const antrag = antraegeById.get(antragId);
    const verbundId = (antrag as { verbund_id?: string } | undefined)?.verbund_id ?? null;
    const tvCount = getTVCount(cache.antraege, verbundId, antragId);
    const z: Zuweisung = {
      antragId,
      anonId: myAnonId,
      quartal: config.aktuellesQuartal,
      stunden: tvCount * stundenProTV,
      anzahlTV: tvCount,
      status: 'selbst',
      selbstEingetragen: true,
      freigegebenAm: new Date().toISOString(),
    };
    await upsertZuweisung(storage, z);
  });

  // Sichtbarkeit
  if (!loaded || !kuerzelMapLoaded) return null;
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
  if (offene.length === 0) return null;

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
            onUebernehmen={() => uebernehmen.run(item.antrag.aktenzeichen)}
            disabled={uebernehmen.busy}
          />
        ))}
      </div>
      {kapView && (
        <p className="mt-2 text-[11px] text-[var(--tf-text-tertiary)]">
          Festgebucht: {kapView.fest.antraege} {kapView.fest.antraege === 1 ? 'Antrag' : 'Anträge'} ({kapView.fest.tvs} TVs)
          {kapView.pending.antraege > 0 && ` · Pending: ${kapView.pending.antraege} (${kapView.pending.tvs} TVs)`}
          {' · '}
          {kapView.ueberbuchung > 0
            ? <span className="text-[var(--tf-warning-text)]">Überbucht um {Math.ceil(kapView.ueberbuchung)}h</span>
            : <>Frei: {kapView.restTVs} TVs</>}
          {' in '}{config.aktuellesQuartal}
        </p>
      )}
      {uebernehmen.error && (
        <div className="mt-2 text-[11.5px] text-[var(--tf-danger-text)]">
          Fehler: {uebernehmen.error}
        </div>
      )}
      {showAlleModal && (
        <NeueAntraegeAlleModal
          alle={offene}
          configKategorien={config.ueberKategorien}
          onClose={() => setShowAlleModal(false)}
          onUebernehmen={(id) => uebernehmen.run(id)}
          busy={uebernehmen.busy}
        />
      )}
    </div>
  );
}

interface RowProps {
  item: OffenerAntrag;
  onUebernehmen: () => void;
  disabled?: boolean;
  /** Kompakte Layout-Variante fuer das "Alle"-Modal (v2.3):
   *  weniger Padding, Akronym/Titel/Frist/Button in einer Zeile. */
  compact?: boolean;
}

function NeueAntraegeRow({ item, onUebernehmen, disabled, compact }: RowProps): React.ReactElement {
  const config = useAuslastungData(s => s.data.config);
  const { antrag, klassifizierung, daysLeft } = item;
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

  if (compact) {
    return (
      <div
        className="rounded-[8px] px-2.5 py-1.5 flex items-center gap-3"
        style={{ border: '0.5px solid var(--tf-border)' }}
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
        <span className={`text-[10.5px] tabular-nums shrink-0 ${fristTone}`} title="Verbleibende Frist">
          Noch {daysLeft}d
        </span>
        <button
          type="button"
          onClick={onUebernehmen}
          disabled={disabled}
          className={`${buttonClasses} px-2.5 py-1 shrink-0`}
          style={buttonStyle}
          aria-label={`Kann ich übernehmen — ${akronym ?? antrag.aktenzeichen}`}
        >
          Kann ich übernehmen
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-[12px] p-3 flex items-center gap-4"
      style={{ border: '0.5px solid var(--tf-border)' }}
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
        </div>
        <div className="text-[12.5px] text-[var(--tf-text)] truncate">{titel}</div>
      </div>
      <div className="text-right flex flex-col items-end gap-1 shrink-0">
        <span className={`text-[10.5px] ${fristTone}`}>
          Noch {daysLeft} Tag{daysLeft === 1 ? '' : 'e'}
        </span>
        <button
          type="button"
          onClick={onUebernehmen}
          disabled={disabled}
          className={`${buttonClasses} px-3 py-1`}
          style={buttonStyle}
          aria-label={`Kann ich übernehmen — ${akronym ?? antrag.aktenzeichen}`}
        >
          Kann ich übernehmen
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

