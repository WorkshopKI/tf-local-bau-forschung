/**
 * Das Anzeigemodell der Kopfkarte **„Woran es hängt"** — rein, ohne React.
 *
 * **Nichts wird nachgerechnet.** Frist, Stillstand und Meilensteine kommen
 * fertig herein; hier entstehen nur Sätze, Farben und drei Kacheln. Die einzige
 * Arithmetik ist die Bearbeitungsfrist als Differenz Basis→Ziel — und die steht
 * hier, weil ihre Zahl im Entwurf ausgeschrieben ist und ein Literal (`90 T`)
 * für jeden Antrag stimmen müsste, dessen Uhr anders läuft (Guard
 * `no-inline-frist-arithmetik`).
 *
 * **Zwei Überschriften, ein Bauteil.** Der Entwurf zeigt nur den Verzugsfall.
 * Eine Karte, die auch bei einem Antrag in der Frist „Woran es hängt" fragt,
 * behauptet ein Problem — deshalb wechselt die Zeile auf „Wo der Antrag steht",
 * und der Rahmen verliert sein Rot.
 */
import type { FristErgebnis } from '@/core/services/csv/frist-ergebnis';
import { FRIST_GRUND } from '@/core/services/csv/frist-ergebnis';
import type { FristBezug } from '@/core/status/frist-bezug';
import { tageZwischen, type WaechterErgebnis } from '@/core/status/waechter';
import { formatDatum } from '@/plugins/meilensteine/labels';
import { AMPEL_COLOR } from '../../eingangAmpel';
import { HALT_HERKUNFT, HALT_OHNE, fristAnzeigeVon } from '../../fristAnzeige';
import { URTEIL_FARBE, URTEIL_LABEL } from '../../waechterLabels';
import type { MeilensteinLage } from '../meilensteinLage';
import type { BlockerBefund } from './blocker';
import type { LiegtBei } from './liegtBei';

/** Eine der drei Kacheln rechts im Kopf. */
export interface Fakt {
  id: 'bewegung' | 'meilensteine' | 'liegtBei';
  label: string;
  wert: string;
  /** Leiser Nachsatz hinter dem Wert („Grenze 14 T", „von 9"). */
  zusatz?: string;
  /** Punktfarbe vor dem Wert; `null` = kein Punkt. */
  farbe: string | null;
  titel: string;
}

export interface KopfModell {
  /** „Woran es hängt" bzw. „Wo der Antrag steht". */
  eyebrow: string;
  urteil: string;
  urteilFarbe: string;
  /** Ampelpunkt vor dem Urteil; `null`, wo keine Uhr läuft. */
  punkt: string | null;
  /** Die Herleitung in einem Halbsatz. Immer gefüllt. */
  zusatz: string;
  /** Rahmenfarbe der Karte. */
  rahmen: string;
  /** Verzug — entscheidet über Rot in Rahmen und Urteil. */
  imVerzug: boolean;
  fakten: Fakt[];
}

const BASIS_LABEL: Record<string, string> = {
  D_AAE: 'Antragseingang',
  D_XTE: 'Eingang aller Anträge',
};

function tage(n: number, ein = 'Tag', viele = 'Tage'): string {
  return `${n} ${n === 1 ? ein : viele}`;
}

/** Der erste Buchstabe groß — das Urteil ist eine Überschrift, kein Zellwert. */
function gross(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

/**
 * Die Herleitung: welches Ziel, welche Frist, ab welchem Datum.
 *
 * `imVerzug` kommt herein statt hier aus Zieldatum und Stichtag abgeleitet zu
 * werden: das Urteil eine Zeile darüber liest `tageRest`, und zwei Wege zur
 * Frage „liegt das Ziel hinter uns?" laufen beim ersten Sonderfall auseinander
 * — dann stünde „Ziel war …" neben „Noch 26 Tage bis zur Frist".
 */
function zusatzText(bezug: FristBezug, imVerzug: boolean): string {
  const e = bezug.ergebnis;
  if (e.zustand === 'nicht_berechenbar') return e.grund ?? FRIST_GRUND.ohneEingang;
  if (e.zustand === 'angehalten') {
    const halt = bezug.halt;
    const herkunft = halt ? HALT_HERKUNFT[halt.herkunft] : HALT_OHNE;
    return halt
      ? `Angehalten am ${formatDatum(halt.tag)} · ${herkunft}`
      : `${e.grund ?? 'in diesem Verfahrensschritt läuft keine Frist'} · ${herkunft}`;
  }
  if (e.basisDatum === undefined || e.zielDatum === undefined) {
    return 'Kein Zieltermin — die Basis fehlt.';
  }
  const frist = tageZwischen(e.basisDatum, e.zielDatum);
  const zielWort = imVerzug ? 'Ziel war' : 'Ziel';
  const basis = BASIS_LABEL[e.basisFeld ?? ''] ?? 'Eingang';
  const fristTeil = frist === null ? 'Bearbeitungsfrist unbekannt' : `Bearbeitungsfrist ${frist} T`;
  return `${zielWort} ${formatDatum(e.zielDatum)} · ${fristTeil} ab ${basis} ${formatDatum(e.basisDatum)}`;
}

/** Das Urteil in der Sprache seines Zustands. */
function urteilText(e: FristErgebnis, stichtagMs: number): string {
  if (e.zustand === 'laeuft') {
    const rest = e.tageRest;
    if (rest === undefined) return 'Frist nicht berechenbar';
    if (rest === 0) return 'Heute fällig';
    return rest > 0 ? `Noch ${tage(rest)} bis zur Frist` : `${tage(-rest)} über der Frist`;
  }
  if (e.zustand === 'angehalten') return gross(fristAnzeigeVon(e, stichtagMs).text);
  return 'Frist nicht berechenbar';
}

/** Bewegung: wann zuletzt etwas passiert ist, gemessen an den Zieltagen des Schritts. */
function faktBewegung(w: WaechterErgebnis | null): Fakt {
  if (w === null) {
    return {
      id: 'bewegung', label: 'Bewegung', wert: 'nicht prüfbar', farbe: null,
      titel: 'Ohne Statuskatalog gibt es kein Urteil über den Stillstand.',
    };
  }
  const herkunft = w.letzteAktivitaet === null
    ? 'keine Aktivität in den Datumsspalten'
    : w.belegt ? 'aus dem Journal belegt' : 'genähert aus dem Export';
  return {
    id: 'bewegung',
    label: 'Bewegung',
    wert: w.tage === null ? URTEIL_LABEL[w.urteil] : `vor ${w.tage} T`,
    ...(w.zieltage === null ? {} : { zusatz: `Grenze ${w.zieltage} T` }),
    farbe: URTEIL_FARBE[w.urteil],
    titel: `${URTEIL_LABEL[w.urteil]} — ${w.grund} (${herkunft})`,
  };
}

/** Meilensteine: wie viele Stufen gerissen sind. Entfällt ohne Plan-Grundlage. */
function faktMeilensteine(lage: MeilensteinLage, befund: BlockerBefund): Fakt | null {
  if (lage.art === 'flagAus' || lage.art === 'ohneVerbund') return null;
  if (lage.art !== 'da') {
    return {
      id: 'meilensteine', label: 'Meilensteine', wert: '—', farbe: null, titel: befund.satz,
    };
  }
  return {
    id: 'meilensteine',
    label: 'Meilensteine',
    wert: befund.relevant === 0 ? 'keine' : `${befund.gerissen} gerissen`,
    ...(befund.relevant === 0 ? {} : { zusatz: `von ${befund.relevant}` }),
    farbe: befund.gerissen > 0 ? 'var(--tf-danger-text)' : 'var(--tf-success-text)',
    titel: `${befund.satz} Gezählt werden die Stufen, an denen gearbeitet wird — Sammel-Stufen aggregieren ihre Kinder und zählen nicht doppelt.`,
  };
}

function faktLiegtBei(l: LiegtBei): Fakt {
  return {
    id: 'liegtBei',
    label: 'Liegt bei',
    wert: l.kurz,
    ...(l.seit === null ? {} : { zusatz: l.seit }),
    farbe: l.ton === 'belegt' ? 'var(--tf-text-secondary)' : 'var(--tf-text-tertiary)',
    titel: l.lang,
  };
}

export interface KopfEingabe {
  bezug: FristBezug;
  /** ISO-Tag. */
  stichtag: string;
  waechter: WaechterErgebnis | null;
  lage: MeilensteinLage;
  befund: BlockerBefund;
  liegtBei: LiegtBei;
}

export function baueKopfModell(e: KopfEingabe): KopfModell {
  const erg = e.bezug.ergebnis;
  const stichtagMs = new Date(e.stichtag).getTime();
  const anzeige = fristAnzeigeVon(erg, stichtagMs);
  const imVerzug = erg.zustand === 'laeuft' && erg.tageRest !== undefined && erg.tageRest < 0;
  const fakten = [faktBewegung(e.waechter), faktMeilensteine(e.lage, e.befund), faktLiegtBei(e.liegtBei)]
    .filter((f): f is Fakt => f !== null);
  return {
    eyebrow: imVerzug ? 'Woran es hängt' : 'Wo der Antrag steht',
    urteil: urteilText(erg, stichtagMs),
    urteilFarbe: imVerzug ? 'var(--tf-danger-text)' : 'var(--tf-text)',
    punkt: anzeige.ampel === null ? null : AMPEL_COLOR[anzeige.ampel],
    zusatz: zusatzText(e.bezug, imVerzug),
    rahmen: imVerzug ? 'var(--tf-danger-border)' : 'var(--tf-border)',
    imVerzug,
    fakten,
  };
}
