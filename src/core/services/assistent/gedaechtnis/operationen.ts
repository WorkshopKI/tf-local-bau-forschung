/**
 * Deterministische Anwendung der LLM-Operationsliste (REIN, LLM-frei).
 *
 * Das LLM liefert diskrete Operationen (ADD/UPDATE/INVALIDATE/NOOP) mit
 * Faktensätzen + Belege-IDs. `wendeOperationenAn` validiert jede Operation gegen
 * Belege-Integrität, Textgrenzen/Poisoning (guard.ts), Duplikat- und Block-
 * Kapazitätsgrenzen und erzeugt Code-IDs/-Zeitstempel. Ungültige Operationen
 * werden VERWORFEN (mit Grund), nie nachverhandelt.
 *
 * Determinismus: keine `Date.now()`, kein `crypto` im Kern — Uhr (`jetzt`) und
 * ID-Fabrik (`neueId`) werden injiziert. Gleiche Ops + Bestand + Kontext ⇒
 * identisches Ergebnis (Guard: operationen.test.ts „Determinismus").
 */

import { istVerdaechtig } from './guard';
import {
  GEDAECHTNIS_BLOECKE,
  MAX_EINTRAEGE_PRO_BLOCK,
} from './types';
import type {
  GedaechtnisBlock,
  GedaechtnisEintrag,
  LaufErgebnis,
  VerworfeneOperation,
  VerwurfsArt,
} from './types';

/** Injizierter Kontext — hält den Kern rein/testbar. */
export interface OperationsKontext {
  /** Gültige Ereignis-IDs aus dem Protokoll (Belege müssen hier existieren). */
  belegIndex: ReadonlySet<string>;
  /** Uhr (epoch ms) — injiziert statt `Date.now()`. */
  jetzt: number;
  /** ID-Fabrik — injiziert statt `crypto.randomUUID()`. */
  neueId: () => string;
}

function normText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function istBlock(v: unknown): v is GedaechtnisBlock {
  return typeof v === 'string' && (GEDAECHTNIS_BLOECKE as readonly string[]).includes(v);
}

function belegeGueltig(belege: unknown, belegIndex: ReadonlySet<string>): belege is string[] {
  return (
    Array.isArray(belege) &&
    belege.length >= 1 &&
    belege.every(b => typeof b === 'string' && belegIndex.has(b))
  );
}

function istRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/**
 * Wendet die Operationsliste auf den Bestand an und liefert den resultierenden
 * VOLL-Bestand (aktive + invalidierte) plus Zähler + Verworfen-Liste.
 * Der Eingabe-`bestand` wird NICHT mutiert (defensive Kopie).
 */
export function wendeOperationenAn(
  ops: readonly unknown[],
  bestand: readonly GedaechtnisEintrag[],
  kontext: OperationsKontext,
): LaufErgebnis {
  const { belegIndex, jetzt, neueId } = kontext;
  // Defensive Kopie — Einträge werden bei INVALIDATE/UPDATE mutiert.
  const arbeit: GedaechtnisEintrag[] = bestand.map(e => ({ ...e, belege: [...e.belege] }));
  const verworfen: VerworfeneOperation[] = [];
  /** Verwerfen mit Art — `defekt` ist der Normalfall, Sättigung die Ausnahme. */
  const verwirf = (op: unknown, grund: string, art: VerwurfsArt = 'defekt'): void => {
    verworfen.push({ op, grund, art });
  };
  let hinzugefuegt = 0;
  let aktualisiert = 0;
  let invalidiert = 0;

  const aktiveImBlock = (block: GedaechtnisBlock): GedaechtnisEintrag[] =>
    arbeit.filter(e => e.status === 'aktiv' && e.block === block);
  const findeAktiv = (id: string): GedaechtnisEintrag | undefined =>
    arbeit.find(e => e.status === 'aktiv' && e.id === id);
  const istDuplikat = (block: GedaechtnisBlock, text: string, ausserId?: string): boolean =>
    aktiveImBlock(block).some(e => e.id !== ausserId && normText(e.text) === normText(text));

  for (const roh of ops) {
    if (!istRecord(roh) || typeof roh.op !== 'string') {
      verwirf(roh, 'keine gültige Operation (Objekt mit op-Feld erwartet)');
      continue;
    }
    const typ = roh.op;

    if (typ === 'NOOP') {
      continue; // bewusst nichts (weder angewandt noch verworfen)
    }

    if (typ === 'ADD') {
      if (!istBlock(roh.block)) {
        verwirf(roh, 'unbekannter Block');
        continue;
      }
      if (typeof roh.text !== 'string') {
        verwirf(roh, 'text fehlt');
        continue;
      }
      const verdacht = istVerdaechtig(roh.text);
      if (verdacht.verdaechtig) {
        verwirf(roh, verdacht.grund ?? 'Textprüfung');
        continue;
      }
      if (!belegeGueltig(roh.belege, belegIndex)) {
        verwirf(roh, 'Belege fehlen oder verweisen auf unbekannte Ereignisse');
        continue;
      }
      if (istDuplikat(roh.block, roh.text)) {
        verwirf(roh, 'Duplikat (Text bereits aktiv im Block)', 'gesaettigt');
        continue;
      }
      if (aktiveImBlock(roh.block).length >= MAX_EINTRAEGE_PRO_BLOCK) {
        verwirf(roh, 'Blockkapazität erreicht', 'gesaettigt');
        continue;
      }
      arbeit.push({
        id: neueId(),
        version: 1,
        block: roh.block,
        text: roh.text.trim(),
        status: 'aktiv',
        erstellt: jetzt,
        aktualisiert: jetzt,
        belege: [...roh.belege],
      });
      hinzugefuegt++;
      continue;
    }

    if (typ === 'UPDATE') {
      if (typeof roh.id !== 'string') {
        verwirf(roh, 'id fehlt');
        continue;
      }
      const ziel = findeAktiv(roh.id);
      if (!ziel) {
        verwirf(roh, 'Ziel-Eintrag nicht aktiv oder nicht gefunden');
        continue;
      }
      if (typeof roh.text !== 'string') {
        verwirf(roh, 'text fehlt');
        continue;
      }
      const verdacht = istVerdaechtig(roh.text);
      if (verdacht.verdaechtig) {
        verwirf(roh, verdacht.grund ?? 'Textprüfung');
        continue;
      }
      if (!belegeGueltig(roh.belege, belegIndex)) {
        verwirf(roh, 'Belege fehlen oder verweisen auf unbekannte Ereignisse');
        continue;
      }
      if (istDuplikat(ziel.block, roh.text, ziel.id)) {
        verwirf(roh, 'Duplikat (Text bereits aktiv im Block)', 'gesaettigt');
        continue;
      }
      ziel.status = 'invalidiert';
      ziel.aktualisiert = jetzt;
      arbeit.push({
        id: neueId(),
        version: 1,
        block: ziel.block,
        text: roh.text.trim(),
        status: 'aktiv',
        erstellt: jetzt,
        aktualisiert: jetzt,
        vorgaengerId: ziel.id,
        belege: [...roh.belege],
      });
      aktualisiert++;
      continue;
    }

    if (typ === 'INVALIDATE') {
      if (typeof roh.id !== 'string') {
        verwirf(roh, 'id fehlt');
        continue;
      }
      const ziel = findeAktiv(roh.id);
      if (!ziel) {
        verwirf(roh, 'Ziel-Eintrag nicht aktiv oder nicht gefunden');
        continue;
      }
      ziel.status = 'invalidiert';
      ziel.aktualisiert = jetzt;
      invalidiert++;
      continue;
    }

    verwirf(roh, `unbekannter Operationstyp „${typ}"`);
  }

  return { eintraege: arbeit, hinzugefuegt, aktualisiert, invalidiert, verworfen };
}
