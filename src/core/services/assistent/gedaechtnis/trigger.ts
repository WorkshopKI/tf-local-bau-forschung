/**
 * Trigger der Gedächtnis-Konsolidierung (Assistent Phase 2).
 *
 * KEIN Idle-/Aktivitätstracking. Nur zwei Auslöser:
 *  - App-Start, wenn der letzte Lauf länger als das Mindestintervall (12 h) her
 *    ist — best-effort, nicht-blockierend, erzwingt KEIN KI-Fenster.
 *  - Manueller „Jetzt konsolidieren"-Button (User-Geste → darf das KI-Fenster
 *    öffnen).
 */
import type { AIBridge } from '@/core/services/ai/bridge';
import { isAssistentGedaechtnisEnabled } from '@/config/feature-flags';
import { istProtokollAktiv } from '../protokoll';
import { fuehreKonsolidierungAus } from './konsolidierung';
import type { KonsolidierungsResultat } from './konsolidierung';
import { istGedaechtnisAktiv, ladeLaufMeta } from './recorder';

/** Mindestabstand zwischen automatischen Läufen (12 h). */
export const MINDESTINTERVALL_MS = 12 * 60 * 60 * 1000;

/** Flag + beide Opt-ins aktiv? (Vorbedingung jeder Konsolidierung.) */
export function gedaechtnisVoraussetzungenErfuellt(): boolean {
  return isAssistentGedaechtnisEnabled() && istProtokollAktiv() && istGedaechtnisAktiv();
}

/** Ist ein automatischer Lauf fällig (Voraussetzungen erfüllt + letzter Lauf alt genug)? */
export async function konsolidierungFaellig(
  mindestintervallMs: number = MINDESTINTERVALL_MS,
  jetzt: number = Date.now(),
): Promise<boolean> {
  if (!gedaechtnisVoraussetzungenErfuellt()) return false;
  const meta = await ladeLaufMeta();
  if (!meta) return true;
  return jetzt - meta.letzterLauf >= mindestintervallMs;
}

/**
 * App-Start-Trigger: best-effort, nicht-blockierend. Läuft nur bei Fälligkeit und
 * ohne das KI-Fenster zu erzwingen (`darfFensterOeffnen: false`).
 */
export async function starteKonsolidierungWennFaellig(
  bridge: AIBridge,
): Promise<KonsolidierungsResultat | null> {
  if (!(await konsolidierungFaellig())) return null;
  return fuehreKonsolidierungAus({
    holeLease: () => bridge.getTransportForKonsolidierung(),
    darfFensterOeffnen: false,
  });
}

/** Manueller Lauf („Jetzt konsolidieren") — User-Geste darf das KI-Fenster öffnen. */
export async function starteKonsolidierungManuell(bridge: AIBridge): Promise<KonsolidierungsResultat> {
  return fuehreKonsolidierungAus({
    holeLease: () => bridge.getTransportForKonsolidierung(),
    darfFensterOeffnen: true,
  });
}
