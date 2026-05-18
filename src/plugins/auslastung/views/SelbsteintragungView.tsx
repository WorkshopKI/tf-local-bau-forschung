/**
 * Screen 1c — Selbsteintragungs-Ansicht fuer MAs.
 *
 * Listet offene Antraege der eigenen Ueberkategorien mit "Übernehme ich"-Button.
 * Frist-Anzeige je Eintrag: "Noch X Tage bis automatische PL-Zuweisung".
 */
import { useMemo } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { useKuerzelMap } from '../hooks/useKuerzelMap';
import { useKlassifizierungenView } from '../hooks/useKlassifizierungen';
import { resolveAnonIdForUser } from '../services/anonym-map';
import { readAntragDeskriptoren } from '../services/profil-aggregator';
import { computeVerbrauchByAnon } from '../services/matching-engine';
import {
  CANONICAL_TITEL,
  CANONICAL_VERBUND_TITEL,
  type Zuweisung,
} from '../types';
import { KategoriePill } from '../components/KategoriePill';
import { AnonymIdBadge } from '../components/AnonymIdBadge';
import { TechnologieTags } from '../components/TechnologieTags';

export function SelbsteintragungView(): React.ReactElement {
  const storage = useStorage();
  const { profile } = useProfile();
  const config = useAuslastungData(s => s.data.config);
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);
  const klassifizierungen = useAuslastungData(s => s.data.klassifizierungen);
  const zuweisungen = useAuslastungData(s => s.data.zuweisungen);
  const upsertZuweisung = useAuslastungData(s => s.upsertZuweisung);

  const cache = useAntraegeCache();
  const kuerzelMapLoaded = useKuerzelMap(s => s.loaded);
  const view = useKlassifizierungenView(cache.antraege, config.ueberKategorien, klassifizierungen);

  const myAnonId = resolveAnonIdForUser(profile?.bearbeiter_kuerzel, cache.anonymMap);
  const myMa = myAnonId ? mitarbeiter[myAnonId] : undefined;
  const myKategorien = new Set(myMa?.ueberKategorien ?? []);

  const verbrauchMap = useMemo(
    () => computeVerbrauchByAnon(zuweisungen, config.aktuellesQuartal),
    [zuweisungen, config.aktuellesQuartal],
  );
  const verbraucht = myAnonId ? (verbrauchMap.get(myAnonId) ?? 0) : 0;
  const quartalsKap = myMa ? myMa.jahresKapazitaet / 4 : 0;
  const rest = quartalsKap - verbraucht;

  const offene = useMemo(() => {
    if (!myAnonId) return [];
    return view.filter(v => {
      if (v.klassifizierung.status !== 'freigegeben') return false;
      const kats = v.klassifizierung.freigegebeneKategorien;
      if (!kats.some(k => myKategorien.has(k))) return false;
      const ze = zuweisungen.filter(z => z.antragId === v.antrag.aktenzeichen);
      const zugewiesen = ze.some(z => z.status === 'freigegeben' || z.status === 'selbst');
      return !zugewiesen;
    });
  }, [view, myAnonId, myKategorien, zuweisungen]);

  if (!cache.loaded || !kuerzelMapLoaded) {
    return (
      <div className="rounded-[12px] p-6" style={{ border: '0.5px solid var(--tf-border)' }}>
        <h2 className="text-[15px] font-medium mb-2">Selbsteintragung</h2>
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">Lade Daten…</p>
      </div>
    );
  }

  if (!myAnonId) {
    return (
      <div className="rounded-[12px] p-6" style={{ border: '0.5px solid var(--tf-border)' }}>
        <h2 className="text-[15px] font-medium mb-2">Selbsteintragung</h2>
        <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
          Dein Bearbeiter-Kürzel ist nicht im aktuellen Programm bekannt. Trage es in den Einstellungen ein (oder kontaktiere die PL).
        </p>
      </div>
    );
  }

  async function uebernehmen(antragId: string, benoetigt: number): Promise<void> {
    if (!myAnonId) return;
    if (benoetigt > rest) {
      const ok = confirm(`Du hast nur noch ${Math.round(rest)}h frei, dieser Antrag benötigt ${benoetigt}h. Trotzdem übernehmen?`);
      if (!ok) return;
    }
    const z: Zuweisung = {
      antragId,
      anonId: myAnonId,
      quartal: config.aktuellesQuartal,
      stunden: benoetigt,
      status: 'selbst',
      selbstEingetragen: true,
      freigegebenAm: new Date().toISOString(),
    };
    await upsertZuweisung(storage, z);
  }

  function daysLeft(freigegebenAm?: string): number | null {
    if (!freigegebenAm) return null;
    const start = new Date(freigegebenAm).getTime();
    if (!Number.isFinite(start)) return null;
    const deadline = start + config.selbsteintragungFristTage * 86400000;
    return Math.max(0, Math.ceil((deadline - Date.now()) / 86400000));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-[12px] p-3 px-4" style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg-secondary)' }}>
        <div className="flex items-center gap-3">
          <span className="text-[12.5px] text-[var(--tf-text-secondary)]">Du bist <AnonymIdBadge anonId={myAnonId} /></span>
          <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">·</span>
          <span className="text-[12px]">
            Quartal {config.aktuellesQuartal} · {Math.round(verbraucht)}h verbraucht · <span className="font-medium">{Math.round(rest)}h frei</span>
          </span>
        </div>
        <div className="flex gap-1">
          {(myMa?.ueberKategorien ?? []).map(id => {
            const k = config.ueberKategorien.find(x => x.id === id);
            return k ? <KategoriePill key={id} kategorie={k} /> : null;
          })}
        </div>
      </div>

      <div>
        <h3 className="text-[12.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-2">
          Offene Anträge in deinen Kategorien ({offene.length})
        </h3>

        {offene.length === 0 ? (
          <p className="text-[12.5px] text-[var(--tf-text-tertiary)] py-6 text-center">
            Aktuell keine offenen Anträge in deinen Kategorien.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {offene.map(v => {
              const benoetigt = config.stundenProTV; // pro TV
              const days = daysLeft(v.klassifizierung.freigegebenAm);
              const kats = config.ueberKategorien.filter(k => v.klassifizierung.freigegebeneKategorien.includes(k.id));
              const desk = readAntragDeskriptoren(v.antrag);
              return (
                <div
                  key={v.antrag.aktenzeichen}
                  className="rounded-[12px] p-3 flex items-center gap-4"
                  style={{ border: '0.5px solid var(--tf-border)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[11px] text-[var(--tf-text-secondary)]">{v.antrag.aktenzeichen}</span>
                      <div className="flex gap-1">{kats.map(k => <KategoriePill key={k.id} kategorie={k} />)}</div>
                    </div>
                    <div className="text-[12.5px] text-[var(--tf-text)] truncate">
                      {(v.antrag[CANONICAL_VERBUND_TITEL] as string | undefined)
                        ?? (v.antrag[CANONICAL_TITEL] as string | undefined)
                        ?? '—'}
                    </div>
                    <div className="mt-1"><TechnologieTags tags={desk} max={5} /></div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <span className="text-[12px] text-[var(--tf-text-secondary)]">{benoetigt}h Aufwand</span>
                    {days != null && (
                      <span className={`text-[10.5px] ${days <= 2 ? 'text-rose-700' : 'text-[var(--tf-text-tertiary)]'}`}>
                        Noch {days} Tag{days === 1 ? '' : 'e'}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void uebernehmen(v.antrag.aktenzeichen, benoetigt)}
                      className="px-3 py-1 rounded-md text-[12px] cursor-pointer mt-1"
                      style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
                    >
                      Übernehme ich
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
