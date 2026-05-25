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
import { resolveAnonIdForUser } from '@/plugins/auslastung/services/anonym-map';
import { computeKapazitaet } from '@/plugins/auslastung/services/kapazitaet';
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
  // Hauptkategorie mit Fallback (Pre-Migration-MAs: erste ueberKategorie).
  const myHauptKategorie = myMa?.hauptKategorie
    || (myMa?.ueberKategorien && myMa.ueberKategorien.length > 0 ? myMa.ueberKategorien[0]! : '');

  // Antrag-Index fuer schnellen Lookup.
  const antraegeById = useMemo(() => {
    const m = new Map<string, Antrag>();
    for (const a of cache.antraege) m.set(a.aktenzeichen, a);
    return m;
  }, [cache.antraege]);

  // Zuweisungen pro Antrag (Set fuer "schon vergeben").
  const zugewieseneIds = useMemo(() => {
    const s = new Set<string>();
    for (const z of zuweisungen) {
      if (z.status === 'freigegeben' || z.status === 'selbst') s.add(z.antragId);
    }
    return s;
  }, [zuweisungen]);

  const offene = useMemo((): OffenerAntrag[] => {
    if (!myMa || !myHauptKategorie) return [];
    const fristTage = config.selbsteintragungFristTage;
    const items: OffenerAntrag[] = [];
    for (const k of klassifizierungen) {
      if (k.status !== 'freigegeben') continue;
      const primaer = k.freigegebenePrimaer || k.freigegebeneKategorien?.[0];
      if (primaer !== myHauptKategorie) continue;
      if (zugewieseneIds.has(k.antragId)) continue;
      const antrag = antraegeById.get(k.antragId);
      if (!antrag) continue;
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
  }, [klassifizierungen, myMa, myHauptKategorie, zugewieseneIds, antraegeById, config.selbsteintragungFristTage]);

  // Kapazitaets-Sicht in Antraegen (NICHT Stunden).
  const kapView = useMemo(() => {
    if (!myMa) return null;
    return computeKapazitaet(myMa, zuweisungen, config, config.aktuellesQuartal);
  }, [myMa, zuweisungen, config]);

  // "Uebernehme ich" — Selbsteintragung
  const uebernehmen = useAsyncAction(async (antragId: string) => {
    if (!myAnonId) return;
    const stundenProTV = config.stundenProTV ?? 9;
    const z: Zuweisung = {
      antragId,
      anonId: myAnonId,
      quartal: config.aktuellesQuartal,
      stunden: stundenProTV,  // 1-TV-Default; PL korrigiert ggf. spaeter
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
          hasMore ? (
            <button
              onClick={() => setShowAlleModal(true)}
              className="text-[11px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
            >
              Alle ({offene.length}) →
            </button>
          ) : undefined
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
          {kapView.restAntraege} von {kapView.maxAntraege} Anträgen frei in {config.aktuellesQuartal}
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
}

function NeueAntraegeRow({ item, onUebernehmen, disabled }: RowProps): React.ReactElement {
  const config = useAuslastungData(s => s.data.config);
  const { antrag, klassifizierung, daysLeft } = item;
  const primaerId = klassifizierung.freigegebenePrimaer || klassifizierung.freigegebeneKategorien?.[0];
  const aspektIds = klassifizierung.freigegebeneAspekte
    ?? klassifizierung.freigegebeneKategorien?.slice(1)
    ?? [];
  const primaerKat = config.ueberKategorien.find(k => k.id === primaerId);
  const aspektKats = aspektIds
    .map(id => config.ueberKategorien.find(k => k.id === id))
    .filter((k): k is NonNullable<typeof k> => k != null);
  const titel = (antrag[CANONICAL_VERBUND_TITEL] as string | undefined)
    ?? (antrag[CANONICAL_TITEL] as string | undefined)
    ?? '—';
  const fristTone = daysLeft <= 2 ? 'text-rose-700 font-medium'
    : daysLeft <= 3 ? 'text-amber-700 font-medium'
    : 'text-[var(--tf-text-tertiary)]';

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
          className="px-3 py-1 rounded-md text-[12px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
        >
          Übernehme ich
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
      className="fixed inset-0 z-50 flex items-start justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-full overflow-y-auto rounded-[12px] p-5 flex flex-col gap-3"
        style={{ background: 'var(--tf-bg)', border: '0.5px solid var(--tf-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-medium">Alle neuen Anträge ({alle.length})</h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {alle.map(item => (
            <NeueAntraegeRow
              key={item.antrag.aktenzeichen}
              item={item}
              onUebernehmen={() => onUebernehmen(item.antrag.aktenzeichen)}
              disabled={busy}
            />
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer"
            style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text-secondary)' }}
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

