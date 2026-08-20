/**
 * Der **Stillstands-Wächter einer Tabellenzeile** — einmal gerechnet, von beiden
 * Reitern gelesen.
 *
 * Bis v3.37 rechnete ihn nur der Fristen-Reiter, mitten in dessen
 * Anzeigemodell. Seit die Verlaufs-Bahn ihren aktuellen Abschnitt
 * markiert, brauchen ihn beide — und zweimal gerechnet liefen sie beim ersten
 * Sonderfall auseinander (dieselbe Regel, an der `fristAnzeige.ts` seit v3.6
 * hängt). Der Aufruf sitzt deshalb dort, wo beide Reiter hängen
 * ({@link ZeilenBereich}), und das Ergebnis wird durchgereicht.
 *
 * **Er urteilt über den VORGANG, nicht über eine Bahn.** Wer ihn in der Bahn
 * anzeigt, darf die Marke nur an die Spur hängen, die diese Zeile IST — bei
 * einer verdichteten Verbundzeile also an die Verbundbahn, sonst an die des
 * Teilvorhabens. An alle Bahnen geschrieben wäre er schlicht falsch.
 */
import { useMemo } from 'react';
import { findeStatusCode, type MappingVersion } from '@/core/status';
import type { FeldVorkommen } from '@/core/status/feld-aufloesung';
import { pruefeStillstand, type WaechterErgebnis } from '@/core/status/waechter';
import type { TodoErgebnis } from '@/core/status/todo-engine';

export interface WaechterQuelle {
  version: MappingVersion | null;
  /** Status UND Vorkommen DIESER Zeile — nie die einer anderen. */
  vorkommen: readonly FeldVorkommen[];
  /**
   * Dieselben Vorkommen, aber je Teilvorhaben getrennt. Nur so findet der
   * Wächter die halb offenen Kürzel-Paare einer verdichteten Verbund-Zeile —
   * siehe `WaechterEingabe.jeTeilvorhaben`.
   */
  jeTeilvorhaben?: readonly { aktenzeichen: string; vorkommen: readonly FeldVorkommen[] }[];
  statusRoh: unknown;
  /** ISO-Tag. */
  stichtag: string;
  journalAenderung?: string | null;
  /**
   * Das To-do des **AB-Satzes** — Stufe 2 des Wächters, wo kein Kürzel-Paar
   * greift.
   *
   * Bewusst der AB-Satz und nicht die gewählte Sicht: sein Urteil (ok / hängt /
   * unbewertet) hängt gar nicht am To-do, und die Adresse soll sich nicht
   * verschieben, nur weil jemand seine Anzeige umschaltet (dieselbe Begründung
   * wie in `useVorgangsBoard`). `null`, wo es keine EINE Adresse gibt.
   */
  todo?: TodoErgebnis | null;
}

/** `null`, solange kein Katalog geladen ist — dann gibt es nichts zu beurteilen. */
export function useZeilenWaechter(q: WaechterQuelle): WaechterErgebnis | null {
  return useMemo(() => {
    if (!q.version) return null;
    return pruefeStillstand({
      version: q.version,
      vorkommen: q.vorkommen,
      statusCode: findeStatusCode(q.statusRoh)?.eintrag.code ?? null,
      stichtag: q.stichtag,
      ...(q.jeTeilvorhaben !== undefined ? { jeTeilvorhaben: q.jeTeilvorhaben } : {}),
      ...(q.journalAenderung !== undefined ? { journalAenderung: q.journalAenderung } : {}),
      ...(q.todo !== undefined ? { todo: q.todo } : {}),
    });
  }, [q.version, q.vorkommen, q.jeTeilvorhaben, q.statusRoh, q.stichtag, q.journalAenderung, q.todo]);
}
