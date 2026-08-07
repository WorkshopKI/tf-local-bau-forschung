/**
 * Der **Bestandslauf** der Verlaufsableitung — auf Knopfdruck, ein Durchgang.
 *
 * **Warum ein Knopf und kein Skript** (wie bei `useTerminErhebung`): der Bestand
 * liegt in der Browser-IDB, `jederVorgang` ist aus einem Node-Vitest nicht
 * erreichbar, und eine Node-Fixture des Echtbestands gibt es nicht. Der Knopf
 * ist damit nicht bequemer, sondern der einzige Weg an die Zahlen — und sie
 * veralten mit jedem Nacht-Export.
 *
 * **Gruppiert wird nach Verbund, nicht nach Teilvorhaben.** `baueVerlauf`
 * braucht alle Teilvorhaben zusammen: die Verbundspur entsteht einmal je
 * Vorhaben, und die Aggregationsregeln (`XPC+`, `XPC?`) fragen „haben ALLE TV
 * PC+?". Je Teilvorhaben gerechnet wäre die Verbundspur so oft gezählt, wie das
 * Vorhaben Teilvorhaben hat, und jede Aggregation träfe auf eine Menge von eins.
 *
 * Gepuffert wird deshalb der Bestand — aber nur das, was die Ableitung liest
 * (Aktenzeichen, Status, `vb_phase`, Vorkommen), nicht der volle Record.
 *
 * Der Betrachtungsbereich ist ein **expliziter Parameter** (Pitfall #46) und
 * steht in der Ausgabe, damit die Zahl einzuordnen ist.
 */
import { useCallback, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useBereich } from '@/core/hooks/useBereich';
import { useAsyncAction, type UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { generationenVon } from '@/core/status/betrachtungsbereich';
import { zaehlwort } from '@/core/utils/zaehlwort';
import { jederVorgang, istImBereich, ladeTrigger, type MappingVersion } from '@/core/status';
import {
  leereBefunde, nimmAuf, c16Treffer,
  type VerlaufsBefunde, type VerlaufsBezug, type VerlaufsBezugTv,
} from '@/core/status/verlauf';
import { baueVerlaufFuerVorgang } from '@/core/status/verlauf/fuer-vorgang';

export interface VerlaufLauf {
  befunde: VerlaufsBefunde | null;
  /** Wie der Bereich beim Lauf stand — sonst sind die Zahlen nicht einzuordnen. */
  bereichText: string | null;
  /** Laufzeit des Durchgangs in Millisekunden. */
  dauerMs: number | null;
  /** `false` = keine C16-Trigger-Tabelle importiert; die Vergleichszahl fehlt dann. */
  c16Vorhanden: boolean;
  stichtag: string;
  aktion: UseAsyncActionResult<[]>;
}

/** Ein gepufferter Vorgang — nur, was die Ableitung liest. */
interface Gepuffert extends VerlaufsBezugTv {
  programm: string;
  codes: string[];
}

export function useVerlaufErhebung(version: MappingVersion | null): VerlaufLauf {
  const idb = useStorage().idb;
  const bereich = useBereich();
  const stichtagRef = useRef<string>(new Date().toISOString().slice(0, 10));
  const [befunde, setBefunde] = useState<VerlaufsBefunde | null>(null);
  const [bereichText, setBereichText] = useState<string | null>(null);
  const [dauerMs, setDauerMs] = useState<number | null>(null);
  const [c16Vorhanden, setC16Vorhanden] = useState(false);

  const starte = useCallback(async (): Promise<void> => {
    if (!version) return;
    const begonnen = performance.now();

    // Die C16-Tabelle wird NUR gezählt, nie abgeleitet: Schlüssel (Programm,
    // Kürzel), getrennt nach TV- und VB-Statuswechsel (Argumentposition 6/7).
    const stand = await ladeTrigger(idb);
    const c16Tv = new Set<string>();
    const c16Vb = new Set<string>();
    for (const z of stand.datei?.trigger ?? []) {
      const g = z.geparst;
      if (!g || g.art !== 'statusTvVb') continue;
      const k = `${z.programm}|${z.kuerzel.normalize('NFC').toUpperCase()}`;
      if (g.statusTv !== null) c16Tv.add(k);
      if (g.statusVb !== null) c16Vb.add(k);
    }

    const jeVerbund = new Map<string, Gepuffert[]>();
    await jederVorgang(idb, version, ({ aktenzeichen, unterprogrammId, verbundId, record, vorkommen }) => {
      if (!istImBereich(unterprogrammId, bereich.menge)) return;
      const codes = vorkommen
        .filter(v => v.feld.typ === 'datum' && v.feld.code && v.wert.trim() !== '')
        .map(v => v.feld.code as string);
      const schluessel = verbundId ?? `einzel:${aktenzeichen}`;
      const liste = jeVerbund.get(schluessel);
      const eintrag: Gepuffert = {
        aktenzeichen, statusTvRoh: record.status, vorkommen,
        vbPhaseRoh: record.vb_phase,
        programm: String(unterprogrammId ?? ''), codes,
      };
      if (liste) liste.push(eintrag); else jeVerbund.set(schluessel, [eintrag]);
    });

    const bilanz = leereBefunde();
    const stichtag = stichtagRef.current;
    for (const [schluessel, tvs] of jeVerbund) {
      const erstes = tvs[0];
      if (!erstes) continue;
      const bezug: VerlaufsBezug = {
        verbundId: schluessel.startsWith('einzel:') ? null : schluessel,
        // Der Verbund-Record führt den VB-Status; er steht auf jeder TV-Zeile
        // nicht mit, deshalb kommt er hier aus dem Vorkommen des Katalogfeldes.
        statusVbRoh: erstes.vorkommen.find(v => v.feld.feldId === 'verbund_status')?.wert ?? '',
        vbPhaseRoh: erstes.vbPhaseRoh,
        bezugsZeitpunkt: stichtag,
        teilvorhaben: tvs,
      };
      nimmAuf(bilanz, baueVerlaufFuerVorgang(bezug, version, null));

      let vbTreffer = false;
      for (const tv of tvs) {
        const t = c16Treffer(tv.codes, tv.programm, c16Tv, c16Vb);
        bilanz.c16TvUebergaenge += t.tv;
        if (t.vb > 0) vbTreffer = true;
      }
      if (vbTreffer) bilanz.c16VerbuendeMitVbUebergang++;
    }

    setBefunde(bilanz);
    setDauerMs(Math.round(performance.now() - begonnen));
    setC16Vorhanden(c16Tv.size > 0 || c16Vb.size > 0);

    if (bereich.menge === null) {
      setBereichText('alle Richtlinien');
    } else {
      const zahl = zaehlwort(bereich.programme.length, 'Programm', 'Programme');
      const { jahre, exakt } = generationenVon(bereich.programme);
      setBereichText(exakt ? `Richtlinien ${jahre.join(' + ')} · ${zahl}` : zahl);
    }
  }, [idb, version, bereich.menge, bereich.programme]);

  return {
    befunde, bereichText, dauerMs, c16Vorhanden,
    stichtag: stichtagRef.current, aktion: useAsyncAction(starte),
  };
}
