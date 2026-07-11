/**
 * Konsolidierungslauf (LLM-Anbindung) — der einzige Ort, an dem das Gedächtnis
 * per INTERNEM Modell fortgeschrieben wird.
 *
 * Ablauf: Voraussetzungen (Flag + beide Opt-ins, Bridge frei) → Eingabe rein
 * aufbereiten → resetChat → GENAU EIN submitMessage → tolerant parsen →
 * `wendeOperationenAn` (rein) → Bestand + Wasserzeichen atomar schreiben. Kein
 * Auto-Retry. Abbruch bei Vordergrund-Aktivität (Skill/Panel hat Vorrang) lässt
 * Bestand + Wasserzeichen unverändert (Ops erst nach vollständigem Parse
 * angewandt). Der Transport wird als LEASE injiziert (`holeLease`) — testbar mit
 * Fake-Bridge; in-App liefert ihn `AIBridge.getTransportForKonsolidierung()`.
 */
import { isAssistentGedaechtnisEnabled } from '@/config/feature-flags';
import { resetHatVerlaufsrisiko, starteFrischenChat } from '@/core/services/ai/chat-reset';
import type { TransportLease } from '@/core/services/ai/bridge-vordergrund';
import { istProtokollAktiv, ladeEreignisseSeit } from '../protokoll';
import type { AssistentEreignis } from '../protokoll';
import { baueEingabe } from './eingabe';
import { buildKonsolidierungsPrompt } from './prompt';
import { parseOperationsliste } from './parse';
import { wendeOperationenAn } from './operationen';
import {
  getGedaechtnisIdb,
  istGedaechtnisAktiv,
  ladeAktiveEintraege,
  ladeLaufMeta,
  neueGedaechtnisId,
  persistiereEintraege,
  schreibeLaufMeta,
} from './recorder';
import type { GedaechtnisEintrag, LaufErgebnis } from './types';

export type KonsolidierungsStatus =
  | 'ok'
  | 'nichts-zu-tun'
  | 'bridge-belegt'
  | 'ki-nicht-erreichbar'
  | 'abgebrochen'
  | 'transport-fehler'
  | 'parse-fehler'
  | 'deaktiviert';

export interface KonsolidierungsResultat {
  status: KonsolidierungsStatus;
  ergebnis?: LaufErgebnis;
  meldung?: string;
  /** true, wenn der resetChat vor dem Lauf eine mögliche Verlaufskontamination hatte. */
  resetRisiko?: boolean;
}

export interface KonsolidierungsDeps {
  /** Holt den Konsolidierungs-Lease (in-App: `bridge.getTransportForKonsolidierung()`).
   *  Wirft bei externem Provider (DSGVO); liefert `null`, wenn die Bridge belegt ist. */
  holeLease: () => TransportLease | null;
  /** `ping({ openIfNeeded })` — App-Start: false (kein KI-Fenster erzwingen);
   *  manueller Button (User-Geste): true. Default false. */
  darfFensterOeffnen?: boolean;
  /** Uhr — injiziert für Tests. */
  jetzt?: () => number;
  /** ID-Fabrik — injiziert für Tests. */
  neueId?: () => string;
}

export async function fuehreKonsolidierungAus(deps: KonsolidierungsDeps): Promise<KonsolidierungsResultat> {
  const jetzt = deps.jetzt ?? (() => Date.now());
  const neueId = deps.neueId ?? neueGedaechtnisId;

  // Voraussetzungen: Flag + BEIDE Opt-ins + initialisierter Store.
  if (!isAssistentGedaechtnisEnabled() || !istProtokollAktiv() || !istGedaechtnisAktiv()) {
    return { status: 'deaktiviert' };
  }
  if (!getGedaechtnisIdb()) return { status: 'deaktiviert' };

  const meta = await ladeLaufMeta();
  const wasserzeichen = meta?.wasserzeichen ?? null;

  let neue: AssistentEreignis[];
  let aktive: GedaechtnisEintrag[];
  try {
    neue = await ladeEreignisseSeit(wasserzeichen);
    aktive = await ladeAktiveEintraege();
  } catch (e) {
    return { status: 'transport-fehler', meldung: fehlertext(e) };
  }

  const eingabe = baueEingabe(neue, aktive);
  if (eingabe.vollEreignisse.length === 0 && eingabe.ueberhangGesamt === 0) {
    return { status: 'nichts-zu-tun' }; // nichts Neues → Bridge gar nicht anfassen
  }

  let lease: TransportLease | null;
  try {
    lease = deps.holeLease();
  } catch (e) {
    // DSGVO-Guard (externer Provider) o.ä. → Fehlerstatus, Bestand unverändert.
    await schreibeFehlerMeta(jetzt, wasserzeichen, fehlertext(e));
    return { status: 'transport-fehler', meldung: fehlertext(e) };
  }
  if (!lease) return { status: 'bridge-belegt' };

  try {
    const erreichbar = await lease.transport.ping({ openIfNeeded: deps.darfFensterOeffnen ?? false });
    if (!erreichbar) {
      // KI nicht offen → KEIN Fehler-Meta (retry beim nächsten Trigger), kein Öffnen erzwungen.
      return { status: 'ki-nicht-erreichbar' };
    }

    const prompt = buildKonsolidierungsPrompt(eingabe);
    const resetStatus = await starteFrischenChat(lease.transport);
    const antwort = await lease.transport.submitMessage(prompt, undefined, { signal: lease.signal });

    const ops = parseOperationsliste(antwort);
    if (ops === null) {
      await schreibeFehlerMeta(jetzt, wasserzeichen, 'Antwort enthielt keine JSON-Operationsliste');
      return { status: 'parse-fehler' };
    }

    const ergebnis = wendeOperationenAn(ops, aktive, {
      belegIndex: eingabe.belegIndex,
      jetzt: jetzt(),
      neueId,
    });
    await persistiereEintraege(ergebnis.eintraege);
    await schreibeLaufMeta({
      letzterLauf: jetzt(),
      wasserzeichen: eingabe.juengsterZeitstempel ?? wasserzeichen,
      angewandt: ergebnis.hinzugefuegt + ergebnis.aktualisiert + ergebnis.invalidiert,
      verworfen: ergebnis.verworfen.length,
      fehler: false,
    });
    return { status: 'ok', ergebnis, resetRisiko: resetHatVerlaufsrisiko(resetStatus) };
  } catch (e) {
    // Vordergrund hatte Vorrang (Skill/Panel startete) → Signal abort. KEIN Meta-
    // Write: Bestand + Wasserzeichen unverändert, retry beim nächsten Trigger.
    if (lease.signal.aborted) return { status: 'abgebrochen' };
    await schreibeFehlerMeta(jetzt, wasserzeichen, fehlertext(e));
    return { status: 'transport-fehler', meldung: fehlertext(e) };
  } finally {
    lease.freigeben();
  }
}

function fehlertext(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function schreibeFehlerMeta(
  jetzt: () => number,
  wasserzeichen: number | null,
  meldung: string,
): Promise<void> {
  await schreibeLaufMeta({
    letzterLauf: jetzt(),
    wasserzeichen, // unverändert — Fehlerlauf schreibt den Fortschritt NICHT fort
    angewandt: 0,
    verworfen: 0,
    fehler: true,
    fehlerMeldung: meldung.slice(0, 300),
  });
}
