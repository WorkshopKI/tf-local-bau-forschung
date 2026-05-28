/**
 * useBenachrichtigung — zaehlt neue Antraege seit letztem Banner-Dismiss.
 *
 * Workflow-Revision 1.17 ersetzt den eigenen Tab "Selbsteintragung" durch
 * eine Sektion auf der Homepage. Damit MAs nicht uebersehen dass neue
 * klassifizierte Antraege auf sie warten, zeigt die Homepage einen Banner
 * mit der Anzahl seit dem letzten Besuch.
 *
 * Persistierung: localStorage pro anonId (funktioniert unter `file://`,
 * benoetigt kein SMB-Roundtrip — passt zum Zero-Backend-Prinzip).
 *
 * Default-Wert beim ersten Besuch: Epoch 0 (alle freigegebenen zaehlen).
 * Klick auf den Banner setzt den Marker auf jetzt.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Klassifizierung } from '../types';
import { useAuslastungData } from './useAuslastungData';

export function benachrichtigungStorageKey(anonId: string): string {
  return `teamflow_auslastung_seen_freigegeben_${anonId}`;
}

export function readLastSeen(anonId: string | null): number {
  if (!anonId) return Number.POSITIVE_INFINITY;  // kein Tracking moeglich
  try {
    const raw = localStorage.getItem(benachrichtigungStorageKey(anonId));
    if (!raw) return 0;
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : 0;
  } catch {
    return 0;
  }
}

export function writeLastSeen(anonId: string, isoDate: string): void {
  try {
    localStorage.setItem(benachrichtigungStorageKey(anonId), isoDate);
  } catch {
    // localStorage-Quota oder disabled: stiller Fail, Banner zeigt halt
    // weiter "neu" — User kann erneut dismissen.
  }
}

/**
 * Pure-Funktion (testbar ohne React): filtert Klassifizierungen auf "neu seit
 * lastSeenMs in der Haupt-Kategorie des MAs". Gibt nur die Antrag-IDs zurueck.
 */
export function findNeueAntraegeIds(
  klassifizierungen: Klassifizierung[],
  myHauptKategorie: string,
  lastSeenMs: number,
): string[] {
  if (!myHauptKategorie) return [];
  const ids: string[] = [];
  for (const k of klassifizierungen) {
    if (k.status !== 'freigegeben') continue;
    const primaer = k.freigegebenePrimaer;
    if (primaer !== myHauptKategorie) continue;
    const ts = k.freigegebenAm ? Date.parse(k.freigegebenAm) : 0;
    if (!Number.isFinite(ts) || ts <= lastSeenMs) continue;
    ids.push(k.antragId);
  }
  return ids;
}

export interface BenachrichtigungResult {
  /** Anzahl Klassifizierungen mit freigegebenAm > lastSeen + matching Hauptkat. */
  neueAnzahl: number;
  /** Liste der Aktenzeichen (fuer Scroll-Anchor o.ae.). */
  neueAntraegeIds: string[];
  /** Setzt lastSeen auf jetzt — Banner verschwindet. */
  dismiss: () => void;
}

export function useBenachrichtigung(
  myAnonId: string | null,
  myHauptKategorie: string,
): BenachrichtigungResult {
  const klassifizierungen = useAuslastungData(s => s.data.klassifizierungen);
  const [lastSeenMs, setLastSeenMs] = useState<number>(() => readLastSeen(myAnonId));

  // Refresh wenn anonId wechselt (Profil-Switch).
  useEffect(() => {
    setLastSeenMs(readLastSeen(myAnonId));
  }, [myAnonId]);

  const { neueAnzahl, neueAntraegeIds } = useMemo(() => {
    if (!myAnonId) return { neueAnzahl: 0, neueAntraegeIds: [] };
    const ids = findNeueAntraegeIds(klassifizierungen, myHauptKategorie, lastSeenMs);
    return { neueAnzahl: ids.length, neueAntraegeIds: ids };
  }, [klassifizierungen, myAnonId, myHauptKategorie, lastSeenMs]);

  const dismiss = useCallback(() => {
    if (!myAnonId) return;
    const now = new Date().toISOString();
    writeLastSeen(myAnonId, now);
    setLastSeenMs(Date.now());
  }, [myAnonId]);

  return { neueAnzahl, neueAntraegeIds, dismiss };
}
