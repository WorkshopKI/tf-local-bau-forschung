/**
 * Rechte Spalte des Zuweisungs-Cockpits (Screen 1b) — Detail des selektierten
 * Verbundes + Match-Vorschläge (Engine live), Übernahme-Wünsche und manueller
 * MA-Picker. Aus ZuweisungsCockpit.tsx ausgelagert (Kohäsion vor Zeilenzahl),
 * Verhalten unverändert — rein prop-getrieben.
 */
import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { getKategorieLabel } from '@/plugins/antraege/filter/kategorieQuickfilter';
import { unvollstaendigGrund } from '../services/verbund';
import {
  CANONICAL_AKRONYM,
  CANONICAL_TITEL,
  CANONICAL_VERBUND_ID,
  CANONICAL_VERBUND_TITEL,
  FIELD_PROJEKTBESCHREIBUNG,
  type AusgeschlossenerMa,
  type MatchResult,
  type Zuweisung,
} from '../types';
import { KategoriePill } from '../components/KategoriePill';
import { TechnologieTags } from '../components/TechnologieTags';
import { VorschlagRow } from '../components/VorschlagRow';
import { NichtVorgeschlagenListe } from '../components/NichtVorgeschlagenListe';
import { ZuweisungStreifen } from '../components/ZuweisungStreifen';
import { ManuellerMaPicker } from '../components/ManuellerMaPicker';
import { AnonymIdBadge, useDeAnonResolver } from '../components/AnonymIdBadge';
import { formatKlickZeit } from './cockpit-helpers';
import type { Antrag, AntragListItem } from '@/core/services/csv/types';

export function DetailPanel({
  antrag, deskriptoren, akronym, verbundTitel, klassifizierung, kategorien, matches, nebenMatches, ausgeschlossen, matchingRunning,
  zuweisungen, mitarbeiter, pendingAnonIds, unvollstaendig, zuweisenGesperrt, tHints, restTVsByAnon,
  onZuweisen, onAblehnen, onAddManual, onRemoveManual, onUnassign, tageImQuartal,
}: {
  /** Voller Record (Point-Read) — kurz nach Selektionswechsel kann hier der
   *  Slim-Record stehen, bis der Point-Read ankommt (Summary dann kurz leer). */
  antrag: Antrag | AntragListItem;
  /** Deskriptoren des Antrags aus dem Slim-Cache-Stream-Pass (v2.63). */
  deskriptoren: readonly string[];
  /** Verbund-Akronym/-Titel (aus dem verbuende-Store aufgeloest, siehe
   *  resolveVerbundMeta) — konsistent mit der linken Liste. */
  akronym: string;
  verbundTitel: string;
  klassifizierung: import('../types').Klassifizierung;
  kategorien: import('../types').UeberKategorie[];
  matches: MatchResult[];
  /** v2.48: MAs, die nur über eine Nebenkompetenz zur Primärkategorie passen
   *  (eigener Block „Auch geeignet"). */
  nebenMatches: MatchResult[];
  /** v2.48: kategorie-relevante MAs, die NICHT vorgeschlagen werden (mit Grund). */
  ausgeschlossen: AusgeschlossenerMa[];
  matchingRunning: boolean;
  zuweisungen: Zuweisung[];
  mitarbeiter: Record<string, import('../types').AnonymerMitarbeiter>;
  /** anonIds mit offenem (noch nicht eingesammeltem) Übernahme-Wunsch für diesen Antrag. */
  pendingAnonIds: string[];
  /** Antrag „nicht vollständig" (kein D_XTEC/D_ADV je nach Antragstyp) →
   *  Warn-Markierung im Header. */
  unvollstaendig: boolean;
  /** Verbund noch nicht vollständig erfasst → Zuweisung gesperrt (Buttons
   *  deaktiviert + Hinweis-Banner). Sichtbarkeit bleibt erhalten. */
  zuweisenGesperrt: boolean;
  /** v2.19: T_HINT-Bemerkungen über alle TVs des Verbundes (distinct, nicht-leer). */
  tHints: string[];
  /** v2.19: freie TVs pro aktivem MA — Kapazitäts-Hinweis im manuellen Picker. */
  restTVsByAnon: Map<string, number>;
  onZuweisen: (m: MatchResult) => void;
  onAblehnen: (m: MatchResult) => void;
  /** v2.19: aktiven MA manuell als Vorschlag hinzufügen. */
  onAddManual: (anonId: string) => void;
  /** v2.19: manuelle Card wieder entfernen (Ablehnen auf manueller Card). */
  onRemoveManual: (anonId: string) => void;
  /** Ruecknahme der Verbund-Freigabe (entfernt die freigegebene Zuweisung). */
  onUnassign: () => void;
  tageImQuartal: number;
}): React.ReactElement {
  const resolveName = useDeAnonResolver();
  // v2.48: Nebenkompetenz-Block standardmäßig eingeklappt (sekundäre Kandidaten).
  const [nebenOpen, setNebenOpen] = useState(false);
  const rec = antrag as unknown as Record<string, unknown>;
  const akt = akronym || (rec[CANONICAL_AKRONYM] as string | undefined);
  const vbTitel = verbundTitel || (rec[CANONICAL_VERBUND_TITEL] as string | undefined);
  const tvTitel = rec[CANONICAL_TITEL] as string | undefined;
  const summary = rec[FIELD_PROJEKTBESCHREIBUNG] as string | undefined;
  const verbund_id = rec[CANONICAL_VERBUND_ID] as string | undefined;
  const desk = deskriptoren;
  // 1.17: Primaer (gefuellt) + Aspekte (outline) trennen.
  const primaerKatId = klassifizierung.freigegebenePrimaer;
  const aspektKatIds = klassifizierung.freigegebeneAspekte;
  const primaerKategorie = kategorien.find(k => k.id === primaerKatId);
  const aspektKategorien = aspektKatIds
    .map(id => kategorien.find(k => k.id === id))
    .filter((k): k is NonNullable<typeof k> => k != null);
  // v2.9: ALLE Interessenten (selbst-Eintraege) — die PL waehlt einen aus.
  // Pro MA nur EIN Eintrag (frueheste Vormerkung, falls mehrere TVs), sortiert
  // nach Klick-Zeit aufsteigend → der zuerst Wollende steht oben.
  const klickTs = (z: Zuweisung): number => {
    const iso = z.selbstEingetragenAm ?? z.freigegebenAm; // Fallback fuer Pre-v2.9-Eintraege
    return iso ? Date.parse(iso) : Number.POSITIVE_INFINITY;
  };
  const interessenten = (() => {
    const byAnon = new Map<string, Zuweisung>();
    for (const z of zuweisungen) {
      if (z.status !== 'selbst' && !z.selbstEingetragen) continue;
      const prev = byAnon.get(z.anonId);
      if (!prev || klickTs(z) < klickTs(prev)) byAnon.set(z.anonId, z);
    }
    return Array.from(byAnon.values()).sort((a, b) => klickTs(a) - klickTs(b));
  })();
  // „Kein klares Match"-Hinweis nur über die echten Matcher-Treffer — manuelle
  // Cards (immer confidence 'low') sollen die Warnung nicht auslösen.
  const echteMatches = matches.filter(m => !m.manuell);
  const hasLow = echteMatches.length > 0 && echteMatches.every(m => m.confidence === 'low');

  // Redesign v2.26: der freigegebene Zustand steht oben als Streifen (statt der
  // alten „Aktuelle Zuweisungen"-Liste unten). assignVerbund setzt genau EINE
  // Freigabe pro Verbund → in der Praxis ein Eintrag.
  const freigegebeneZuweisung = zuweisungen.find(z => z.status === 'freigegeben');
  const assignedAnonIds = new Set(
    zuweisungen.filter(z => z.status === 'freigegeben').map(z => z.anonId),
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          {unvollstaendig && (
            <span className="text-amber-600 shrink-0 inline-flex" title={unvollstaendigGrund(antrag)} aria-label={unvollstaendigGrund(antrag)}>
              <AlertTriangle size={13} aria-hidden />
            </span>
          )}
          <span className="font-mono text-[11.5px] text-[var(--tf-text-tertiary)]">{antrag.aktenzeichen}</span>
          {akt && <span className="font-mono text-[11.5px] text-[var(--tf-text-secondary)]">{akt}</span>}
          {verbund_id && <span className="font-mono text-[11px] text-[var(--tf-text-tertiary)]">VB {verbund_id}</span>}
          <div className="ml-auto flex gap-1">
            {primaerKategorie && <KategoriePill key={primaerKategorie.id} kategorie={primaerKategorie} mode="primaer" />}
            {aspektKategorien.map(k => <KategoriePill key={k.id} kategorie={k} mode="aspekt" />)}
          </div>
        </div>
        <h2 className="text-[15px] leading-[1.4] font-medium text-[var(--tf-text)] [text-wrap:pretty] tracking-[-0.005em]">{vbTitel ?? '—'}</h2>
        {tvTitel && tvTitel !== vbTitel && (
          <p className="text-[12.5px] leading-[1.5] text-[var(--tf-text-tertiary)] mt-0.5 [text-wrap:pretty]">{tvTitel}</p>
        )}
      </div>

      {/* Sperr-Hinweis: Verbund noch nicht vollständig erfasst → keine Zuweisung. */}
      {zuweisenGesperrt && (
        <div className="rounded p-2.5 text-[12px]" style={{ background: '#fef3c7', color: '#92400e' }}>
          <div className="font-medium">⚠ Zuweisung gesperrt</div>
          <p className="text-[11px] mt-0.5 opacity-90">
            {unvollstaendigGrund(antrag)}. Sobald der Verbund vollständig im System
            erfasst ist (D_XTEC für FuE/DS bzw. D_ADV für DL/NW), kann zugewiesen werden.
          </p>
        </div>
      )}

      {/* v2.26: Zuweisungs-Streifen ganz oben — nur wenn freigegeben. */}
      {freigegebeneZuweisung && (
        <ZuweisungStreifen
          anonId={freigegebeneZuweisung.anonId}
          realName={resolveName(freigegebeneZuweisung.anonId)}
          stunden={freigegebeneZuweisung.stunden}
          quartal={freigegebeneZuweisung.quartal}
          onUnassign={onUnassign}
        />
      )}

      {/* v2.9: offene Übernahme-Wünsche (noch nicht eingesammelt) — read-only,
          damit die PL den Antrag nicht versehentlich erneut zuweist. */}
      {pendingAnonIds.length > 0 && (
        <div className="rounded p-2.5 text-[12px]" style={{ background: '#fef3c7', color: '#92400e' }}>
          <div className="font-medium mb-1.5">
            ⚑ Vorgemerkt — noch nicht eingesammelt
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {pendingAnonIds.map(a => (
              <AnonymIdBadge key={a} anonId={a} size="sm" realName={resolveName(a)} />
            ))}
          </div>
          <p className="text-[10.5px] mt-1.5 opacity-90">
            Über »Übernahme-Wünsche einsammeln« formalisieren — danach erscheint der Antrag unter „Übernahme-Wunsch".
          </p>
        </div>
      )}

      {/* Übernahme-Wünsche: alle Interessenten, PL weist gezielt einem zu */}
      {interessenten.length > 0 && (
        <div className="rounded p-2.5 text-[12px]" style={{ background: 'var(--tf-info-soft, #dbeafe)', color: '#075985' }}>
          <div className="font-medium mb-1.5">
            {interessenten.length === 1
              ? 'Übernahme-Wunsch'
              : `${interessenten.length} Übernahme-Wünsche`}
          </div>
          <ul className="flex flex-col gap-1">
            {interessenten.map((z, i) => {
              const ts = formatKlickZeit(z.selbstEingetragenAm ?? z.freigegebenAm);
              return (
              <li key={z.anonId} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <AnonymIdBadge anonId={z.anonId} size="sm" realName={resolveName(z.anonId)} />
                  {ts && (
                    <span className="text-[10.5px] opacity-75 shrink-0" title="Zeitpunkt des Klicks auf den Übernahme-Button">
                      {i === 0 && interessenten.length > 1 ? `zuerst · ${ts}` : ts}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const m: MatchResult = {
                      anonId: z.anonId,
                      bm25Score: 1, embeddingScore: 0, kompetenzScore: 1, restKapazitaet: 0,
                      quartalsKapazitaet: 0, balanceScore: 0, finalScore: 1,
                      matchendeTechnologien: [], aehnlicheProjekte: [],
                      matchStufe: 1, confidence: 'high',
                      benoetigteStunden: z.stunden,
                      astMatchCount: 0, astBoost: 0,
                    };
                    onZuweisen(m);
                  }}
                  disabled={zuweisenGesperrt}
                  title={zuweisenGesperrt ? 'Verbund noch nicht vollständig erfasst (D_XTEC/D_ADV fehlt) — Zuweisung gesperrt' : undefined}
                  className="text-[11.5px] px-2 py-0.5 rounded cursor-pointer font-medium shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#075985', color: 'white' }}
                >
                  Zuweisen
                </button>
              </li>
              );
            })}
          </ul>
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
      {/* v2.19: Bemerkung (T_HINT) — verbund-weit, nur wenn befuellt. */}
      {tHints.length > 0 && (
        <div className="rounded p-2.5" style={{ background: 'var(--tf-bg-secondary)' }}>
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">Bemerkung</div>
          {tHints.map((t, i) => (
            <p key={i} className="text-[12px] text-[var(--tf-text-secondary)] whitespace-pre-wrap">{t}</p>
          ))}
        </div>
      )}

      {/* Match-Vorschlaege */}
      <div>
        <div className="flex items-center gap-2.5 mb-2">
          <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">Vorschläge</span>
          <span className="font-mono text-[11px] text-[var(--tf-text-tertiary)]">{matches.length} · sortiert nach Passung</span>
          <span className="flex-1 h-[0.5px]" style={{ background: 'var(--tf-border)' }} />
          {matchingRunning && <span className="text-[11px] text-[var(--tf-text-tertiary)]">Berechne…</span>}
          <ManuellerMaPicker
            mitarbeiter={mitarbeiter}
            excludeAnonIds={new Set([...matches, ...nebenMatches].map(m => m.anonId))}
            resolveName={resolveName}
            restTVsByAnon={restTVsByAnon}
            onAdd={onAddManual}
          />
        </div>
        {hasLow && (
          <div className="mb-2 rounded p-2 text-[11.5px]" style={{ background: '#fef3c7', color: '#92400e' }}>
            ⚠ Kein klares Match — manuelle Prüfung empfohlen.
          </div>
        )}
        {matches.length > 0 && (
          <div className="rounded-[10px] overflow-hidden" style={{ border: '0.5px solid var(--tf-border)' }}>
            {matches.map(m => (
              <VorschlagRow
                key={m.anonId}
                match={m}
                isAssigned={assignedAnonIds.has(m.anonId)}
                antragstyp={getKategorieLabel((antrag as Record<string, unknown>).vb_phase)}
                zuweisenGesperrt={zuweisenGesperrt}
                onZuweisen={() => onZuweisen(m)}
                onAblehnen={() => (m.manuell ? onRemoveManual(m.anonId) : onAblehnen(m))}
                tageImQuartal={tageImQuartal}
              />
            ))}
          </div>
        )}

        {/* v2.48: Nebenkompetenz — MAs, deren Primärkategorie hier nur Neben-
            kategorie ist. Getrennter Block, niedrigere Priorität, gleich zuweisbar. */}
        {nebenMatches.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setNebenOpen(v => !v)}
              aria-expanded={nebenOpen}
              className="w-full flex items-center gap-2.5 mb-1.5 cursor-pointer group/neben"
            >
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] group-hover/neben:text-[var(--tf-text-secondary)]">
                {nebenOpen ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
                Auch geeignet · Nebenkompetenz ({nebenMatches.length})
              </span>
              <span className="flex-1 h-[0.5px]" style={{ background: 'var(--tf-border)' }} />
            </button>
            {nebenOpen && (
              <div className="rounded-[10px] overflow-hidden" style={{ border: '0.5px solid var(--tf-border)' }}>
                {nebenMatches.map(m => (
                  <VorschlagRow
                    key={m.anonId}
                    match={m}
                    variant="neben"
                    isAssigned={assignedAnonIds.has(m.anonId)}
                    antragstyp={getKategorieLabel((antrag as Record<string, unknown>).vb_phase)}
                    zuweisenGesperrt={zuweisenGesperrt}
                    onZuweisen={() => onZuweisen(m)}
                    onAblehnen={() => onAblehnen(m)}
                    tageImQuartal={tageImQuartal}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {matches.length === 0 && nebenMatches.length === 0 && !matchingRunning && (
          <p className="text-[12px] text-[var(--tf-text-tertiary)] text-center py-4">
            Keine passenden MAs gefunden — möglicherweise keine MAs in den Kategorien, alle abgemeldet oder Kapazität voll.
          </p>
        )}

        {/* v2.48: nachvollziehbar machen, WARUM kategorie-relevante MAs fehlen. */}
        <NichtVorgeschlagenListe ausgeschlossen={ausgeschlossen} resolveName={resolveName} />
      </div>
    </div>
  );
}
