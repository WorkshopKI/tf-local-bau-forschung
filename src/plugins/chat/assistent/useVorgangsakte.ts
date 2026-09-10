/**
 * Was das Dock über den gesehenen Vorgang weiß — die unreine Hülle um den reinen
 * `baueVorgangsakte` und die zuschaltbaren Blöcke.
 *
 * Lädt nur, was die Detailseite für denselben Verbund ohnehin lädt
 * (`useStatusVerlauf`, `useVerbundMeilensteine`, die Artefakt-Leiste), und nur bei
 * offenem Dock: das Panel ist auf jeder Route gemountet, und ein geschlossener
 * Streifen braucht keine Akte.
 *
 * **Das Journal wird nie selbst gelesen.** `stand.json` wiegt über 5 MB und ist
 * bewusst ungecacht; das Dock nimmt nur einen Lauf mit, den eine Anzeige der
 * Seite schon angestoßen hat (`laufendeJournalChroniken`). Ohne ihn schweigt die
 * Akte zum Journal, und die Journal-Fragen erscheinen nicht.
 *
 * Ein Antrag bekommt die Akte seines Verbunds, geschnitten auf sein
 * Teilvorhaben. Ohne Verbund (Solo-Antrag) bleibt es bei der Projektion.
 */
import { useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { useStatusVerlauf } from '@/plugins/antraege/status/useStatusVerlauf';
import { laufendeJournalChroniken } from '@/plugins/antraege/status/useJournalChroniken';
import { useVerbundMeilensteine } from '@/plugins/antraege/meilensteine/useVerbundMeilensteine';
import { useArtefaktLeiste } from '@/plugins/antraege/artefakte/useArtefaktLeiste';
import { getWorkflowRun } from '@/plugins/antraege/gutachten/workflow-store';
import type { WorkflowRun } from '@/plugins/antraege/gutachten/types';
import {
  isGutachtenWorkflowEnabled, isMeilensteinMonitoringEnabled, isVorgangssystemEnabled,
} from '@/config/feature-flags';
import { bezugsZeitpunktFuerVorkommen } from '@/core/status/frist-bezug';
import { baueVerlaufFuerVorgang } from '@/core/status/verlauf/fuer-vorgang';
import type { VerlaufsBezug } from '@/core/status/verlauf';
import type { AntragsChronikMitId } from '@/core/status/journal/lesen';
import type { Antrag, AntragListItem } from '@/core/services/csv/types';
import type { KontextEntitaet, VorgangsAkte } from '@/core/services/assistent/kontext';
import { baueVorgangsakte } from './vorgangsakte';
import { journalBlock, verlaufBlock, type BlockId, type ZusatzBlock } from './zusatzBloecke';

export interface VorgangsWissen {
  akte: VorgangsAkte | null;
  /** Die zuschaltbaren Blöcke, soweit ihre Daten vorliegen. */
  bloecke: Partial<Record<BlockId, ZusatzBlock>>;
}

const LEER_WISSEN: VorgangsWissen = { akte: null, bloecke: {} };
const LEER_TVS: AntragListItem[] = [];

/**
 * Wie oft nach einem Journal-Lauf der Seite gesehen wird: die Detailseite kann
 * NACH dem Dock mounten, und ihr Lauf beginnt erst dann. Dieselbe Staffel wie
 * `useJournalChroniken` beim Kaltstart.
 */
const JOURNAL_NACHFASSEN_MS: readonly number[] = [0, 1_000, 3_000, 7_000];

/**
 * Das Journal dieser Anträge, falls eine Anzeige der Seite es schon lädt.
 * `undefined` = nicht (oder noch nicht) geladen — dann spricht die Akte nicht
 * darüber. Ein Lauf, der `null` liefert, zählt ebenfalls als „nicht geladen":
 * beim Kaltstart heißt `null` oft nur „Share noch nicht erreicht".
 */
function useGeladenesJournal(
  ids: readonly string[], datenStand: number, an: boolean,
): readonly AntragsChronikMitId[] | undefined {
  const idsKey = [...ids].sort((a, b) => a.localeCompare(b)).join('|');
  const schluessel = an && idsKey ? `${datenStand}|${idsKey}` : '';
  const [stand, setStand] = useState<{ schluessel: string; wert: AntragsChronikMitId[] } | null>(null);

  useEffect(() => {
    if (!schluessel) return;
    let abgebrochen = false;
    const liste = idsKey.split('|');
    void (async () => {
      for (const pause of JOURNAL_NACHFASSEN_MS) {
        if (pause > 0) await new Promise(r => setTimeout(r, pause));
        if (abgebrochen) return;
        const lauf = laufendeJournalChroniken(liste, datenStand);
        if (!lauf) continue;
        const wert = await lauf;
        if (abgebrochen) return;
        if (wert !== null) setStand({ schluessel, wert });
        return;
      }
    })();
    return () => { abgebrochen = true; };
  }, [schluessel, idsKey, datenStand]);

  return stand !== null && stand.schluessel === schluessel ? stand.wert : undefined;
}

/** Der Gutachten-Lauf des Scopes — für die Prüfer-Hinweise (kv-`get`, billig). */
function useGutachtenLauf(scope: string | null, an: boolean): WorkflowRun | null {
  const idb = useStorage().idb;
  const [stand, setStand] = useState<{ scope: string; run: WorkflowRun | null } | null>(null);
  useEffect(() => {
    if (!an || !scope) return;
    let abgebrochen = false;
    void getWorkflowRun(idb, scope, 'ga')
      .then(run => { if (!abgebrochen) setStand({ scope, run }); })
      .catch(() => { if (!abgebrochen) setStand({ scope, run: null }); });
    return () => { abgebrochen = true; };
  }, [idb, scope, an]);
  return stand !== null && stand.scope === scope ? stand.run : null;
}

export function useVorgangsakte(
  entitaet: KontextEntitaet | null, aktiv: boolean, stichtag: string,
): VorgangsWissen {
  const antraege = useAntraegeStore(s => s.antraege);
  const verbundById = useAntraegeStore(s => s.verbundById);
  const datenStand = useAntraegeStore(s => s.lastLoadedAt);
  const art = aktiv ? entitaet?.art ?? null : null;
  const id = aktiv ? entitaet?.id ?? null : null;

  const verbundId = useMemo(() => {
    if (art === null || id === null) return null;
    if (art === 'verbund') return id;
    return antraege.find(a => a.aktenzeichen === id)?.verbund_id ?? null;
  }, [art, id, antraege]);

  const tvs = useMemo(() => {
    if (art === null || id === null) return LEER_TVS;
    return verbundId !== null
      ? antraege.filter(a => a.verbund_id === verbundId)
      : antraege.filter(a => a.aktenzeichen === id);
  }, [art, id, verbundId, antraege]);
  const verbund = verbundId !== null ? verbundById.get(verbundId) : undefined;
  const verbundStatus = verbund?.status ?? null;

  const verlauf = useStatusVerlauf(verbundId);
  // Der Hook nimmt keinen „aus"-Wert; ein leerer Schlüssel findet keinen Verbund
  // und liefert keine Bewertung.
  const ms = useVerbundMeilensteine(
    isMeilensteinMonitoringEnabled() && verbundId !== null ? verbundId : '', stichtag,
  );
  // Dieselben Karten wie die Leiste der Detailseite. Sie liest von den
  // Teilvorhaben nur Aktenzeichen und Eingangsdaten — die trägt die Projektion.
  const leiste = useArtefaktLeiste({
    ctxKey: art !== null ? (verbundId ?? id ?? '') : '',
    tvs: tvs as unknown as Antrag[],
    status: art !== null ? (verbundStatus ?? tvs[0]?.status ?? null) : null,
  });
  const gaRun = useGutachtenLauf(art !== null ? (verbundId ?? id) : null, isGutachtenWorkflowEnabled());
  const tvIds = useMemo(() => verlauf.jeTeilvorhaben.map(t => t.aktenzeichen), [verlauf.jeTeilvorhaben]);
  const journal = useGeladenesJournal(tvIds, datenStand, art !== null && verbundId !== null);

  // Die Spuren wie im Tabellen-Ausklapp und in der Verlaufs-Erhebung — ohne
  // Journal (die Chronik gehört je EINEM Teilvorhaben, `baueVerlaufFuerVorgang`).
  const spuren = useMemo(() => {
    const version = verlauf.version;
    if (art === null || verbundId === null || verlauf.laden || !version || verlauf.jeTeilvorhaben.length === 0) {
      return null;
    }
    const alle = verlauf.jeTeilvorhaben.flatMap(t => t.vorkommen);
    const bezug: VerlaufsBezug = {
      verbundId,
      statusVbRoh: verlauf.statusVbRoh,
      vbPhaseRoh: verlauf.vbPhaseRoh,
      programm: verlauf.programm,
      bezugsZeitpunkt: bezugsZeitpunktFuerVorkommen(version, alle, verlauf.statusVbRoh, stichtag),
      teilvorhaben: verlauf.jeTeilvorhaben.map(tv => ({
        aktenzeichen: tv.aktenzeichen,
        statusTvRoh: tv.statusTvRoh,
        vorkommen: tv.vorkommen,
        vbPhaseRoh: tv.vbPhaseRoh,
      })),
    };
    return baueVerlaufFuerVorgang(bezug, version, verlauf.trigger, null);
  }, [art, verbundId, verlauf, stichtag]);

  return useMemo<VorgangsWissen>(() => {
    if (art === null || id === null) return LEER_WISSEN;
    const istVerbund = art === 'verbund';
    const quelle = verbundId !== null && !verlauf.laden ? verlauf : null;
    const akte = baueVorgangsakte({
      entitaet: { art, id },
      antraege: tvs,
      verbundStatus,
      verlauf: quelle,
      meilensteine: ms.plan && ms.bewertung ? { plan: ms.plan, bewertung: ms.bewertung } : null,
      vorgangssystem: isVorgangssystemEnabled(),
      stichtag,
      spuren,
      ...(journal !== undefined ? { journal } : {}),
      artefakte: { gutachten: leiste.gutachten, nachforderung: leiste.nachforderung, gaRun },
      alleAntraege: antraege,
      akronym: verbund?.akronym ?? tvs[0]?.akronym ?? null,
    });

    const bloecke: Partial<Record<BlockId, ZusatzBlock>> = {};
    const vb = verlaufBlock({ istVerbund, akte, spuren, fassung: quelle?.version?.version ?? null });
    if (vb) bloecke.verlauf = vb;
    if (journal !== undefined) {
      const azs = new Set(akte.teilvorhaben.map(t => t.aktenzeichen));
      const aktuell = !quelle
        ? []
        : istVerbund
          ? quelle.vorkommen
          : quelle.jeTeilvorhaben.filter(t => azs.has(t.aktenzeichen)).flatMap(t => t.vorkommen);
      bloecke.journal = journalBlock({
        chroniken: journal, azs, version: quelle?.version ?? null, aktuell, vbPhase: quelle?.vbPhaseRoh,
      });
    }
    return { akte, bloecke };
  }, [art, id, verbundId, tvs, verbundStatus, verlauf, ms.plan, ms.bewertung, stichtag, spuren,
    journal, leiste.gutachten, leiste.nachforderung, gaRun, antraege, verbund?.akronym]);
}
