/**
 * **Liegt bei** — auf wessen Schreibtisch der Vorgang wartet. Rein.
 *
 * **Die Zuständigkeit hängt am VORGANG, nicht am Meilenstein.** Der
 * Meilenstein-Plan kennt kein Rollenfeld. Zwei Quellen kennt die App, und beide
 * laufen durch `pruefeStillstand`, das sie in dieser Reihenfolge liest:
 *
 * 1. **Das halb offene Kürzel-Paar** (`AK4` gesetzt, `AT4` fehlt). Die präziseste
 *    Auskunft — sie trägt als einzige eine Liegezeit.
 * 2. **Die To-do-Engine** (seit v3.41 auch hier): das `wartetAuf` der treffenden
 *    Regel, ersatzweise ihr erstes `zustaendig`. Sie hat keine Liegezeit, dafür
 *    einen Namen — die Regel steht im Tooltip.
 *
 * **Ohne Quelle wird nichts geraten.** Keine Adresse heißt nicht „liegt bei
 * niemandem" und schon gar nicht „ist in Ordnung" — es heißt, dass die Grundlage
 * für diese Auskunft fehlt. Das steht dann da (Pitfall #44), und zwar mit dem
 * Grund, der wirklich zutrifft: fehlende Regeln, uneinige Teilvorhaben oder
 * schlicht nichts Belegbares sind drei verschiedene Lagen.
 */
import { ROLLE_LABEL, ROLLE_LANG } from '@/core/status/rollen';
import type { WaechterErgebnis } from '@/core/status/waechter';

export interface LiegtBei {
  /** Kurzform für die Kachel: `QS`, `AST` oder `—`. */
  kurz: string;
  /** Langform bzw. der Grund, warum nichts dasteht. Immer gefüllt. */
  lang: string;
  /** „seit 326 T"; `null`, wenn keine Liegezeit bekannt ist. */
  seit: string | null;
  /** `unklar` färbt den Punkt grau statt in der Rollenfarbe. */
  ton: 'belegt' | 'unklar';
}

/** Was die To-do-Engine zur Adresse beisteuert. */
export interface AufgabenQuelle {
  /** Die geladene Fassung führt keine To-do-Regeln. */
  ohneRegeln: boolean;
  /** Die Teilvorhaben warten auf VERSCHIEDENE Rollen — keine eine Adresse. */
  uneinig: boolean;
  /** Menschenlesbare Herkunft der Regel („R6 · Rücknahmeempfehlung"). */
  herkunft: string | null;
}

export interface LiegtBeiEingabe {
  waechter: WaechterErgebnis | null;
  /** Ohne Vorgangssystem gibt es weder Regeln noch Paar-Auswertung im Ausklapp. */
  vorgangssystemAn: boolean;
  aufgabe: AufgabenQuelle;
}

const OHNE_WAECHTER = 'Nicht bestimmbar — ohne Statuskatalog gibt es keinen Wächter.';
const OHNE_FLAG = 'Nicht ableitbar — ohne Vorgangssystem gibt es keine Zuständigkeits-Quelle.';
const OHNE_REGELN = 'Nicht ableitbar — kein halb offenes Kürzel-Paar, und die Fassung führt keine To-do-Regeln.';
const UNEINIG = 'Nicht eindeutig — die Teilvorhaben warten auf verschiedene Rollen. Die Aufgabe darunter nennt sie einzeln.';
const OHNE_QUELLE = 'Nicht ableitbar — kein halb offenes Kürzel-Paar, und keine To-do-Regel benennt eine Rolle.';

/**
 * Wie lange der Vorgang schon auf DIESEM Schreibtisch liegt.
 *
 * **Nur aus dem Paar.** Die To-do-Engine kennt keine Liegezeit; als Ersatz bliebe
 * die Zeit seit der letzten Aktivität — und die steht bereits als „Bewegung"
 * daneben. Dieselbe Zahl unter zwei Überschriften liest sich als zwei Messungen.
 */
function seitText(w: WaechterErgebnis): string | null {
  return w.paar === null ? null : `seit ${w.paar.tage} T`;
}

/** Woher die Adresse stammt — das Paar gewinnt, sonst die Regel. */
function herkunftText(w: WaechterErgebnis, q: AufgabenQuelle): string {
  if (w.paar !== null && w.paar.rolle !== null) {
    return ` · aus dem offenen Paar ${w.paar.gesetzt}/${w.paar.fehlt}`;
  }
  return q.herkunft === null ? '' : ` · aus ${q.herkunft}`;
}

/** Warum keine Adresse dasteht — drei Lagen, drei Sätze. */
function ohneAdresse(e: LiegtBeiEingabe): string {
  if (!e.vorgangssystemAn) return OHNE_FLAG;
  if (e.aufgabe.uneinig) return UNEINIG;
  if (e.aufgabe.ohneRegeln) return OHNE_REGELN;
  return OHNE_QUELLE;
}

export function liegtBei(e: LiegtBeiEingabe): LiegtBei {
  const w = e.waechter;
  if (w === null) return { kurz: '—', lang: OHNE_WAECHTER, seit: null, ton: 'unklar' };
  if (w.rolle === null) {
    return { kurz: '—', lang: ohneAdresse(e), seit: null, ton: 'unklar' };
  }
  const seit = seitText(w);
  const herkunft = herkunftText(w, e.aufgabe);
  if (w.rolle === 'ast') {
    return { kurz: 'AST', lang: `Antragsteller${herkunft}`, seit, ton: 'belegt' };
  }
  return {
    kurz: ROLLE_LABEL[w.rolle],
    lang: `${ROLLE_LANG[w.rolle]}${herkunft}`,
    seit,
    ton: 'belegt',
  };
}
