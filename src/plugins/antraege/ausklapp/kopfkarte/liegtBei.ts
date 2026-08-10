/**
 * **Liegt bei** — auf wessen Schreibtisch der Vorgang wartet. Rein.
 *
 * **Die Zuständigkeit hängt am VORGANG, nicht am Meilenstein.** Der
 * Meilenstein-Plan kennt kein Rollenfeld; was die App weiß, weiß der
 * Stillstands-Wächter: er findet halb offene Kürzel-Paare (`AK4` gesetzt, `AT4`
 * fehlt) und liest die Rolle am fehlenden Gegenstück. Der Entwurf schreibt den
 * Satz neben den Blocker — inhaltlich ist er eine Aussage über den Vorgang, und
 * genau so steht er hier: als eigenes Faktum.
 *
 * **Ohne Paar wird nichts geraten.** Kein halb offenes Paar heißt nicht „liegt
 * bei niemandem" und schon gar nicht „ist in Ordnung" — es heißt, dass die
 * Quelle für diese Auskunft fehlt. Das steht dann da (Pitfall #44).
 */
import { ROLLE_LABEL, ROLLE_LANG } from '@/core/status/rollen';
import type { WaechterErgebnis } from '@/core/status/waechter';

export interface LiegtBei {
  /** Kurzform für die Kachel: `QS`, `AST` oder `—`. */
  kurz: string;
  /** Langform bzw. der Grund, warum nichts dasteht. Immer gefüllt. */
  lang: string;
  /** „seit 326 T" / „seit mindestens 12 T"; `null`, wenn keine Liegezeit bekannt ist. */
  seit: string | null;
  /** `unklar` färbt den Punkt grau statt in der Rollenfarbe. */
  ton: 'belegt' | 'unklar';
}

const OHNE_WAECHTER = 'Nicht bestimmbar — ohne Statuskatalog gibt es keinen Wächter.';
const OHNE_QUELLE = 'Nicht ableitbar — kein halb offenes Kürzel-Paar, das eine Rolle benennt.';
const OHNE_FLAG = 'Nicht ableitbar — ohne Vorgangssystem gibt es keine Zuständigkeits-Quelle.';

/**
 * Wie lange der Vorgang schon auf DIESEM Schreibtisch liegt.
 *
 * **Nur aus dem Paar.** Ohne Paar bliebe als Ersatz die Zeit seit der letzten
 * Aktivität — und die steht bereits als „Bewegung" daneben. Dieselbe Zahl unter
 * zwei Überschriften liest sich als zwei Messungen; ohne Adresse ist sie
 * ohnehin keine Liegezeit, sondern nur Stille.
 */
function seitText(w: WaechterErgebnis): string | null {
  return w.paar === null ? null : `seit ${w.paar.tage} T`;
}

export function liegtBei(
  w: WaechterErgebnis | null, opt: { vorgangssystemAn: boolean },
): LiegtBei {
  if (w === null) return { kurz: '—', lang: OHNE_WAECHTER, seit: null, ton: 'unklar' };
  const seit = seitText(w);
  if (w.rolle === null) {
    return {
      kurz: '—', lang: opt.vorgangssystemAn ? OHNE_QUELLE : OHNE_FLAG, seit: null, ton: 'unklar',
    };
  }
  if (w.rolle === 'ast') {
    return { kurz: 'AST', lang: 'Antragsteller', seit, ton: 'belegt' };
  }
  return { kurz: ROLLE_LABEL[w.rolle], lang: ROLLE_LANG[w.rolle], seit, ton: 'belegt' };
}
