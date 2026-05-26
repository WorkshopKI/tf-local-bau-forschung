/**
 * KapazitaetsSection — Kapazitaets-Liste fuer den Uebersicht-Tab (v2.4).
 *
 * Single-Source-of-Truth-Modell: pro MA wird `computeQuartalsAuslastung`
 * mit der Master-CSV + den Auslastungs-Store-Zuweisungen aggregiert,
 * danach zeigt jede Zeile die Antrags-/TV-/Stunden-Aufschluesselung:
 *   - **fest**: aus CSV (PL hat tib_kuerz eingetragen)
 *   - **pending**: Selbsteintragungen, noch nicht in CSV
 *
 * Klick auf MA → Read-Flyout mit zwei Sections (Festgebucht + Pending).
 */
import { useMemo, useState } from 'react';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { AnonymIdBadge, useDeAnonResolver } from '../components/AnonymIdBadge';
import { KategoriePill } from '../components/KategoriePill';
import { KapazitaetsBalken } from '../components/KapazitaetsBalken';
import { computeKapazitaet } from '../services/kapazitaet';
import {
  computeQuartalsAuslastung,
  EMPTY_AUSLASTUNG,
  type AuslastungVerbund,
  type MaQuartalsAuslastung,
} from '../services/quartals-auslastung';
import type { AnonymerMitarbeiter } from '../types';

export function KapazitaetsSection(): React.ReactElement {
  const config = useAuslastungData(s => s.data.config);
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);
  const zuweisungen = useAuslastungData(s => s.data.zuweisungen);
  const cache = useAntraegeCache();

  const [kategorieFilter, setKategorieFilter] = useState<string>('');
  const [zeigeInaktive, setZeigeInaktive] = useState(false);
  const [openMa, setOpenMa] = useState<string | null>(null);

  const list = useMemo(() => {
    const all = Object.values(mitarbeiter);
    const sichtbar = zeigeInaktive ? all : all.filter(m => m.aktiv);
    const filtered = kategorieFilter
      ? sichtbar.filter(m => (m.hauptKategorie === kategorieFilter)
          || (m.nebenKategorien?.includes(kategorieFilter) ?? false)
          || (m.ueberKategorien?.includes(kategorieFilter) ?? false))
      : sichtbar;
    return filtered.sort((a, b) => a.anonId.localeCompare(b.anonId));
  }, [mitarbeiter, kategorieFilter, zeigeInaktive]);

  // v2.4: Quartals-Auslastung pro MA — einmal pro Render gecacht statt im
  // map-Loop pro MA neu berechnet.
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

  const totalCount = Object.keys(mitarbeiter).length;
  const aktivCount = Object.values(mitarbeiter).filter(m => m.aktiv).length;
  const hasGaps = totalCount > aktivCount;

  const openMaObj = openMa ? mitarbeiter[openMa] : null;
  const openMaAuslastung = openMa ? (auslastungByAnon.get(openMa) ?? EMPTY_AUSLASTUNG) : EMPTY_AUSLASTUNG;
  const resolveName = useDeAnonResolver();

  return (
    <div className="rounded-[12px] p-4 flex flex-col gap-3" style={{ border: '0.5px solid var(--tf-border)' }}>
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-medium">Kapazität</h2>
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {aktivCount} aktiv / {totalCount} gesamt · {config.aktuellesQuartal}
        </span>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">Kategorie</span>
        <button
          type="button"
          onClick={() => setKategorieFilter('')}
          className={`text-[11.5px] px-2.5 py-1 rounded-full cursor-pointer ${kategorieFilter === '' ? '' : 'opacity-50'}`}
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          Alle
        </button>
        {config.ueberKategorien.map(k => {
          const count = Object.values(mitarbeiter).filter(m =>
            m.aktiv && (m.hauptKategorie === k.id || m.nebenKategorien?.includes(k.id) || m.ueberKategorien?.includes(k.id))).length;
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => setKategorieFilter(k.id === kategorieFilter ? '' : k.id)}
              className={`cursor-pointer flex items-center gap-1 ${kategorieFilter === k.id ? '' : 'opacity-50'}`}
            >
              <KategoriePill kategorie={k} />
              <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">{count}</span>
            </button>
          );
        })}
        <label className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] text-[var(--tf-text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={zeigeInaktive}
            onChange={e => setZeigeInaktive(e.target.checked)}
          />
          <span>Inaktive anzeigen</span>
        </label>
      </div>

      {/* MA-Liste */}
      <div className="rounded-[12px] overflow-hidden" style={{ border: '0.5px solid var(--tf-border)' }}>
        {list.map(ma => {
          const auslastung = auslastungByAnon.get(ma.anonId);
          const kap = computeKapazitaet(ma, auslastung, config);
          const abgemeldet = ma.abgemeldet.includes(config.aktuellesQuartal);
          const haupt = ma.hauptKategorie || ma.ueberKategorien?.[0] || '';
          const neben = ma.nebenKategorien ?? (ma.ueberKategorien ? ma.ueberKategorien.slice(1) : []);
          const hauptKat = config.ueberKategorien.find(k => k.id === haupt);
          const nebenKats = neben.map(id => config.ueberKategorien.find(k => k.id === id)).filter((k): k is NonNullable<typeof k> => k != null);

          return (
            <div
              key={ma.anonId}
              className={`px-4 py-3 cursor-pointer flex items-center gap-4 ${ma.aktiv ? '' : 'opacity-50'}`}
              style={{ borderBottom: '0.5px solid var(--tf-border)' }}
              onClick={() => setOpenMa(ma.anonId)}
            >
              <AnonymIdBadge anonId={ma.anonId} realName={resolveName(ma.anonId)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {hauptKat && <KategoriePill kategorie={hauptKat} active />}
                  {nebenKats.map(k => <KategoriePill key={k.id} kategorie={k} active={false} />)}
                  {(ma.abschlagProzent ?? 0) > 0 && (
                    <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">
                      ({ma.abschlagProzent}% Abschlag)
                    </span>
                  )}
                </div>
                <KapazitaetsBalken
                  freigegeben={kap.fest.stunden}
                  selbst={kap.pending.stunden}
                  vorgeschlagen={0}
                  quartalsKapazitaet={kap.effektivStunden}
                  showLabels={false}
                />
                <div className="mt-1 text-[11px] text-[var(--tf-text-tertiary)]">
                  <span className="font-medium text-[var(--tf-text-secondary)]">
                    Festgebucht: {kap.fest.antraege} {kap.fest.antraege === 1 ? 'Antrag' : 'Anträge'} ({kap.fest.tvs} TVs)
                  </span>
                  {kap.pending.antraege > 0 && (
                    <>
                      {' · '}
                      <span>Pending: {kap.pending.antraege} ({kap.pending.tvs} TVs)</span>
                    </>
                  )}
                  {' · '}
                  {kap.ueberbuchung > 0
                    ? <span className="text-[var(--tf-warning-text)]" title={`${Math.round(kap.verbrauchteStunden)}h von ${Math.round(kap.effektivStunden)}h`}>
                        Überbucht um {Math.ceil(kap.ueberbuchung)}h
                      </span>
                    : <span title={`${Math.round(kap.verbrauchteStunden)}h von ${Math.round(kap.effektivStunden)}h`}>
                        Frei: {kap.restTVs} TVs
                      </span>}
                </div>
              </div>
              {abgemeldet && (
                <span className="text-[10.5px] text-amber-700">⏸ abgemeldet</span>
              )}
              {!ma.aktiv && (
                <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">inaktiv</span>
              )}
            </div>
          );
        })}
        {list.length === 0 && (
          <div className="px-3 py-8 text-center text-[var(--tf-text-tertiary)] text-[12.5px]">
            Keine MAs in dieser Kategorie.
          </div>
        )}
      </div>

      {hasGaps && !zeigeInaktive && (
        <p className="text-[11px] text-[var(--tf-text-tertiary)] leading-tight">
          {aktivCount} von {totalCount} Mitarbeitern aktiv. Inaktive MAs behalten ihre Nummer — Lücken sind normal.
        </p>
      )}

      {/* Read-Flyout */}
      {openMaObj && (
        <MaReadFlyout
          ma={openMaObj}
          quartal={config.aktuellesQuartal}
          kategorien={config.ueberKategorien}
          auslastung={openMaAuslastung}
          realName={resolveName(openMaObj.anonId)}
          onClose={() => setOpenMa(null)}
        />
      )}
    </div>
  );
}

function MaReadFlyout({
  ma, quartal, kategorien, auslastung, realName, onClose,
}: {
  ma: AnonymerMitarbeiter;
  quartal: string;
  kategorien: import('../types').UeberKategorie[];
  auslastung: MaQuartalsAuslastung;
  realName: string | null;
  onClose: () => void;
}): React.ReactElement {
  const haupt = ma.hauptKategorie || ma.ueberKategorien?.[0] || '';
  const neben = ma.nebenKategorien ?? (ma.ueberKategorien ? ma.ueberKategorien.slice(1) : []);
  const hauptKat = kategorien.find(k => k.id === haupt);
  const nebenKats = neben.map(id => kategorien.find(k => k.id === id)).filter((k): k is NonNullable<typeof k> => k != null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end p-4"
      style={{ background: 'rgba(0,0,0,0.3)' }}
      onClick={onClose}
    >
      <div
        className="w-[520px] max-h-full rounded-[12px] p-5 overflow-y-auto flex flex-col gap-4"
        style={{ background: 'var(--tf-bg)', border: '0.5px solid var(--tf-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AnonymIdBadge anonId={ma.anonId} size="lg" realName={realName} />
            <div className="flex flex-col gap-1">
              <div className="flex gap-1">
                {hauptKat && <KategoriePill kategorie={hauptKat} active />}
                {nebenKats.map(k => <KategoriePill key={k.id} kategorie={k} active={false} />)}
              </div>
              <span className="text-[11px] text-[var(--tf-text-tertiary)]">
                {ma.jahresKapazitaet}h/Jahr
                {(ma.abschlagProzent ?? 0) > 0 && ` · ${ma.abschlagProzent}% Abschlag`}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer text-[var(--tf-text-tertiary)]">×</button>
        </div>

        <VerbundSection
          label={`Festgebucht (Master-CSV) — ${quartal}`}
          verbuende={auslastung.fest.verbuende}
          empty="Keine festen Buchungen im Quartal."
          hint="Quelle: tib_kuerz in der Master-CSV mit Antragsdatum im Quartal."
        />

        <VerbundSection
          label={`Eigene Eintragungen (pending) — ${quartal}`}
          verbuende={auslastung.pending.verbuende}
          empty="Keine offenen Selbsteintragungen."
          hint="Werden in die Kapazität gerechnet, bis der PL das Kürzel in die CSV einträgt."
        />

        <p className="text-[11px] text-[var(--tf-text-tertiary)] leading-snug">
          Zur vollen Bearbeitung des MA-Profils → Abschnitt „Mitarbeiter" weiter unten.
        </p>
      </div>
    </div>
  );
}

function VerbundSection({
  label, verbuende, empty, hint,
}: {
  label: string;
  verbuende: readonly AuslastungVerbund[];
  empty: string;
  hint: string;
}): React.ReactElement {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">
        {label} ({verbuende.length})
      </div>
      {verbuende.length === 0 ? (
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {verbuende.map((v, i) => {
            const azDisplay = v.aktenzeichen.length === 1
              ? v.aktenzeichen[0]
              : `${v.aktenzeichen[0]} +${v.aktenzeichen.length - 1}`;
            return (
              <li
                key={`${v.verbundId ?? v.aktenzeichen[0] ?? i}`}
                className="flex items-baseline gap-2 text-[11.5px] py-1"
                style={{ borderBottom: i < verbuende.length - 1 ? '0.5px dashed var(--tf-border)' : 'none' }}
              >
                <span className="font-mono text-[var(--tf-text-secondary)] shrink-0">{azDisplay}</span>
                <div className="flex-1 min-w-0">
                  {v.akronym && <span className="font-medium">{v.akronym}</span>}
                  {v.akronym && v.titel && <span className="text-[var(--tf-text-tertiary)]"> · </span>}
                  {v.titel && <span className="text-[var(--tf-text-secondary)]">{v.titel}</span>}
                </div>
                <span className="text-[10.5px] text-[var(--tf-text-tertiary)] shrink-0 tabular-nums">
                  {v.tvCount} TVs · {v.stunden}h
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[10.5px] text-[var(--tf-text-tertiary)] leading-snug mt-1.5">{hint}</p>
    </div>
  );
}
