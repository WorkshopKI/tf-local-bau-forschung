/**
 * Mengen-/Ausschluss-Berechnung für den Start-Dialog (vorab). Pur — die IO
 * (VB-Lookup, vorhandene WorkflowRun-Stände) wird als Ergebnis hereingereicht.
 * Drei Klassen: bereit / ohne_vb / bereits_stand.
 */
import type { StepId } from '@/plugins/antraege/gutachten/types';
import { gewuenschteSchritte, type BatchAbschnitte } from './types';

export interface MengenKandidat {
  aktenzeichen: string;
  fkz: string;
  titel: string;
  hatVb: boolean;
}
export interface MengenEintrag {
  aktenzeichen: string;
  fkz: string;
  titel: string;
}
export interface Mengen {
  bereit: MengenEintrag[];
  ohneVb: MengenEintrag[];
  bereitsStand: MengenEintrag[];
}

const ent = (k: MengenKandidat): MengenEintrag => ({ aktenzeichen: k.aktenzeichen, fkz: k.fkz, titel: k.titel });

/**
 * `vorhandeneStaende[aktenzeichen]` = StepId→Status der bereits persistierten
 * Schritte. `order` (optional) = geordnete Schritt-IDs der aktiven `WorkflowDef`;
 * fehlt sie, greift der `gewuenschteSchritte`-Default (`STEP_ORDER` = zim-ep).
 */
export function berechneMengen(
  kandidaten: MengenKandidat[],
  abschnitte: BatchAbschnitte,
  vorhandeneStaende: Record<string, Partial<Record<StepId, string>>>,
  order?: readonly StepId[],
): Mengen {
  const gewuenscht = gewuenschteSchritte(abschnitte, order);
  const m: Mengen = { bereit: [], ohneVb: [], bereitsStand: [] };
  for (const k of kandidaten) {
    if (!k.hatVb) { m.ohneVb.push(ent(k)); continue; }
    const staende = vorhandeneStaende[k.aktenzeichen] ?? {};
    const alleVorhanden = gewuenscht.every(s => staende[s] === 'entwurf' || staende[s] === 'freigegeben');
    if (alleVorhanden) m.bereitsStand.push(ent(k));
    else m.bereit.push(ent(k));
  }
  return m;
}
