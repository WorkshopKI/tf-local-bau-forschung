/**
 * Die selbst angelegten Spalten als Zustand der Seite: laden, anlegen, ändern,
 * löschen, ins Team übernehmen — und der Hinweis, wann das einen Neuaufbau der
 * Projektion kostet.
 *
 * **Zwei Ablagen, ein Zustand.** Die persönlichen Definitionen liegen
 * gerätelokal in IndexedDB, die des Teams in einer Sidecar auf dem Share. Nach
 * außen ist das EINE Liste — welche Ablage betroffen ist, entscheidet die
 * Herkunft in der Id, nicht der Aufrufer. Eine zweite Steuerung nur für Team
 * hätte jede Aufrufstelle gezwungen, die Fallunterscheidung zu wiederholen.
 *
 * **Der Neuaufbau ist die einzige teure Stelle.** Er wird fällig, sobald eine
 * Definition ein Feld referenziert, das bisher niemand las; Beschriftung, Text
 * und Farbe ändern nichts daran. Deshalb entscheidet der Vergleich der
 * Feld-Mengen (nicht der Definitionen), ob nach dem Speichern neu projiziert
 * wird — und der Aufrufer kann das VORHER anzeigen.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { canManageTeamSpalten, isEigeneSpaltenEnabled } from '@/config/feature-flags';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import {
  alleFeldRefs, herkunftVon, slugVon, spaltenId, type EigeneSpalte,
} from '@/core/spalten';
import { ladeAlleEigenenSpalten } from '@/core/spalten/programm';
import { speicherePersoenlicheSpalten } from '@/core/spalten/store';
import { schreibeTeamSpalten } from '@/core/spalten/team-store';
import {
  rebuildAntraegeListView, stempleProjektionsStand,
} from '@/core/services/csv/list-view-migration';

export interface EigeneSpaltenSteuerung {
  /** Team-Spalten und eigene, in Anzeige-Reihenfolge. */
  spalten: EigeneSpalte[];
  /** Erst nach dem ersten Lesen `true` — vorher weiß niemand, ob es welche gibt. */
  geladen: boolean;
  /** Läuft gerade ein Neuaufbau der Projektion? */
  baut: boolean;
  /** Darf dieser Mensch Team-Spalten pflegen? Steuert nur die Bedienelemente. */
  darfTeam: boolean;
  /** Legt an oder ersetzt nach `id`; die Ablage folgt der Herkunft in der Id. */
  speichere: (spalte: EigeneSpalte) => Promise<void>;
  entferne: (id: string) => Promise<void>;
  /**
   * Übernimmt eine persönliche Spalte ins Team: dieselbe Definition unter einer
   * `frei:team:`-Id, die persönliche verschwindet. Liefert die neue Id, damit
   * der Aufrufer die Spaltenwahl mitziehen kann.
   */
  uebernimmInsTeam: (spalte: EigeneSpalte) => Promise<string>;
  /** Würde diese Änderung einen Neuaufbau auslösen? Für den Hinweis im Dialog. */
  brauchtNeuaufbau: (spalte: EigeneSpalte) => boolean;
}

/** Freie Team-Id zum Label — hängt `-2`, `-3`, … an, statt eine fremde Spalte
 *  zu überschreiben. Zwei Kolleginnen dürfen „Restlaufzeit" heißen wollen. */
function freieTeamId(label: string, vergeben: ReadonlySet<string>): string {
  const basis = slugVon(label);
  let kandidat = spaltenId('team', basis);
  for (let n = 2; vergeben.has(kandidat); n++) kandidat = spaltenId('team', `${basis}-${n}`);
  return kandidat;
}

export function useEigeneSpalten(): EigeneSpaltenSteuerung {
  const storage = useStorage();
  const { profile } = useProfile();
  const kuratorName = useKuratorSession(s => s.kuratorName);
  const [spalten, setSpalten] = useState<EigeneSpalte[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [baut, setBaut] = useState(false);

  const darfTeam = isEigeneSpaltenEnabled() && canManageTeamSpalten(profile?.is_kurator === true);

  useEffect(() => {
    if (!isEigeneSpaltenEnabled()) { setGeladen(true); return; }
    let abgebrochen = false;
    void (async () => {
      const geladeneSpalten = await ladeAlleEigenenSpalten(storage.idb).catch(() => []);
      if (abgebrochen) return;
      setSpalten(geladeneSpalten);
      setGeladen(true);
    })();
    return () => { abgebrochen = true; };
  }, [storage.idb]);

  const bisherigeFelder = useMemo(() => new Set(alleFeldRefs(spalten)), [spalten]);

  const brauchtNeuaufbau = useCallback(
    (spalte: EigeneSpalte) => alleFeldRefs([spalte]).some(f => !bisherigeFelder.has(f)),
    [bisherigeFelder],
  );

  /**
   * Schreibt die Liste in BEIDE Ablagen und baut die Projektion neu, WENN sich
   * die Feldmenge geändert hat. Der Vergleich läuft über die Menge, nicht über
   * die Liste: eine gelöschte Spalte, deren Felder eine andere weiterhin liest,
   * kostet nichts.
   *
   * **Die Team-Sidecar wird zuerst geschrieben** — sie ist die Stelle, die
   * scheitern kann (kein Share, kein Recht). Scheitert sie, bricht der ganze
   * Vorgang ab, statt einen halb übernommenen Zustand zu hinterlassen: die
   * persönliche Ablage bleibt unangetastet und der Mensch bekommt den Grund
   * zu sehen.
   */
  const uebernimm = useCallback(async (neu: readonly EigeneSpalte[]): Promise<void> => {
    const teamVorher = JSON.stringify(spalten.filter(s => herkunftVon(s.id) === 'team'));
    const teamNachher = neu.filter(s => herkunftVon(s.id) === 'team');
    if (JSON.stringify(teamNachher) !== teamVorher) {
      const ok = await schreibeTeamSpalten(storage.idb, teamNachher);
      if (!ok) {
        throw new Error(
          'Die Team-Spalten ließen sich nicht speichern — Daten-Ordner nicht erreichbar '
          + 'oder kein Schreibrecht. Es wurde nichts geändert.',
        );
      }
      await logAudit(storage.idb, {
        action: 'eigene_spalten_team_geaendert',
        user: kuratorName ?? profile?.name ?? undefined,
        details: { anzahl: teamNachher.length },
      });
    }
    await speicherePersoenlicheSpalten(storage.idb, neu);
    setSpalten([...neu]);

    const vorher = alleFeldRefs(spalten).join('|');
    const nachher = alleFeldRefs(neu).join('|');
    if (vorher === nachher) return;
    setBaut(true);
    try {
      await rebuildAntraegeListView(storage.idb);
      // Stand stempeln, sonst sieht der Boot-Guard beim nächsten Start eine
      // veraltete Signatur und baut dieselbe Projektion ein zweites Mal.
      await stempleProjektionsStand(storage.idb);
    } finally {
      setBaut(false);
    }
  }, [spalten, storage.idb, kuratorName, profile?.name]);

  const speichere = useCallback(async (spalte: EigeneSpalte): Promise<void> => {
    const idx = spalten.findIndex(s => s.id === spalte.id);
    const neu = idx >= 0
      ? spalten.map(s => (s.id === spalte.id ? spalte : s))
      : [...spalten, spalte];
    await uebernimm(neu);
  }, [spalten, uebernimm]);

  const entferne = useCallback(async (id: string): Promise<void> => {
    await uebernimm(spalten.filter(s => s.id !== id));
  }, [spalten, uebernimm]);

  /**
   * Einweg-Kopie mit anschließendem Wegfall der persönlichen Fassung — keine
   * lebende Verknüpfung. Beides gleichzeitig, damit dieselbe Spalte nicht
   * doppelt in der Kopfzeile steht (einmal unter „Meine", einmal unter „Team").
   * Eine spätere Änderung an der Team-Spalte ist eine Änderung AM TEAM-Objekt;
   * ein Sync-Verhältnis bräuchte eine Konflikt-Auflösung, die niemand
   * angefragt hat.
   */
  const uebernimmInsTeam = useCallback(async (spalte: EigeneSpalte): Promise<string> => {
    if (herkunftVon(spalte.id) !== 'ich') return spalte.id;
    const vergeben = new Set(spalten.map(s => s.id));
    const neueId = freieTeamId(spalte.label, vergeben);
    const kopie = { ...spalte, id: neueId } as EigeneSpalte;
    await uebernimm([...spalten.filter(s => s.id !== spalte.id), kopie]);
    return neueId;
  }, [spalten, uebernimm]);

  return { spalten, geladen, baut, darfTeam, speichere, entferne, uebernimmInsTeam, brauchtNeuaufbau };
}
