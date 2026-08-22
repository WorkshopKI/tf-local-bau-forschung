/**
 * Sammelt die **weiteren Anträge desselben Antragstellers** für das Kurzprofil
 * an der Teilvorhaben-Zeile der Verbund-Detailseite.
 *
 * Zweck: Der Bearbeiter sieht am Teilvorhaben bisher nur den Namen. Ob dieselbe
 * Organisation schon dreimal abgelehnt wurde oder gerade in einem Widerruf
 * steckt, steht nirgends — obwohl der Bestand es hergibt. Am Nachtexport
 * gemessen (12.359 Datensätze, August 2026) haben **9.477 von 12.358
 * Teilvorhaben** (77 %) einen Antragsteller mit weiteren Anträgen; von den 2.035
 * Mehrfach-Antragstellern tragen **1.396 (69 %)** mindestens eine Ablehnung.
 *
 * **Abgeglichen wird auf `antragsteller` — genau dem Feld, das die Karte
 * anzeigt** (im Master-Schema aus `ORG_AFS`, der ausführenden Stelle; `ORG_AST`,
 * die Rechtsperson, weicht in 306 Fällen = 2,5 % davon ab). Auf einem anderen
 * Feld abzugleichen als anzuzeigen ergäbe eine Liste, die dem Namen über ihr
 * widerspricht.
 *
 * **Kein Fuzzy-Matching, kein Rechtsform-Stripper.** Gemessen: von 4.916
 * verschiedenen Namen fällt unter NFC + Kleinschreibung + Whitespace-Kollaps
 * **kein einziger** mit einem anderen zusammen — die Namen im Export sind
 * bereits kanonisch. Ein Abwerfen von „GmbH"/„AG"/„e.V." würde deshalb keine
 * Schreibweise heilen, wohl aber verschiedene Rechtspersonen desselben
 * Wortstamms verschmelzen („Müller GmbH" ≠ „Müller AG"). Die Normalisierung
 * unten ist reine Vorsicht gegen künftige Tippunterschiede.
 *
 * Scope: arbeitet auf der In-Memory-Slim-Liste des aktuellen Programms
 * (`useAntraegeStore.antraege`) — bewusst über den **ganzen** Bestand, nicht
 * über den Betrachtungsbereich: eine alte Ablehnung ist Evidenz, kein
 * Arbeitsvorrat (Pitfall #46). Die Karte sagt das an ihrem Fuß.
 *
 * Kosten: **11,5 ms je Aufruf** über 14.225 Records (gemessen im Dev-Server,
 * 10 Läufe). Kein Index, kein Memo — der Aufruf passiert einmal beim Öffnen
 * einer Karte, hinter 500 ms Hover-Verzögerung, und höchstens eine ist offen.
 * Teuerster Einzelschritt ist der Whitespace-Regex (4,4 ms), nicht `normalize`
 * (3,2 ms); wer hier optimiert, fängt dort an — und misst vorher nach, ob es
 * überhaupt jemandem auffällt.
 */
import type { AntragListItem } from '@/core/services/csv/types';
import {
  getStatusCategory,
  isAbgelehntZurueckgezogenStatus,
  isBewilligtStatus,
  isTerminalStatus,
} from '@/core/utils/status-canonical';

/**
 * Normalisiert einen Antragsteller-Namen für den Gleichstands-Vergleich:
 * NFC (Pitfall #22 — Umlaute liegen je nach Quelle als NFD vor), Whitespace-
 * Kollaps, Groß-/Kleinschreibung. Leer/`null` → `null`.
 */
export function normalizeAntragstellerForMatch(s: string | null | undefined): string | null {
  if (typeof s !== 'string') return null;
  const t = s.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
  return t.length === 0 ? null : t;
}

/** Ein weiterer Antrag desselben Antragstellers (Zeile im Kurzprofil). */
export interface AntragstellerAntrag {
  aktenzeichen: string;
  /** Kurzname, so wie gespeichert — Vorgänger tragen ihn geklammert („(AIWOOD)"). */
  akronym?: string;
  /** Roher Status; die Anzeige mappt ihn über `getStatusVariant`/`statusKurzLabel`. */
  status?: string;
  /** Antragsdatum (ISO), falls vorhanden. */
  antragsdatum?: string;
  /** Gehört dieser Antrag zum gerade geöffneten Verbund? Dann leise markieren. */
  imSelbenVerbund: boolean;
}

/**
 * Das Kurzprofil eines Antragstellers. Die fünf Zähler sind **disjunkt** und
 * summieren sich auf `gesamt`.
 */
export interface AntragstellerProfil {
  /** Name wie angezeigt (nicht normalisiert). */
  name: string;
  /** Anzahl der WEITEREN Anträge — der betrachtete zählt nicht mit. */
  gesamt: number;
  abgelehnt: number;
  bewilligt: number;
  abgeschlossen: number;
  sonstige: number;
  inArbeit: number;
  /** Alle weiteren Anträge, jüngster zuerst. */
  antraege: AntragstellerAntrag[];
}

interface FindParams {
  /** Antragsteller-Name des betrachteten Teilvorhabens. */
  name: string | null | undefined;
  /** Aktenzeichen des betrachteten Teilvorhabens (wird ausgeschlossen). */
  currentAktenzeichen: string;
  /** Verbund-ID des geöffneten Verbundes — markiert Geschwister-Teilvorhaben. */
  currentVerbundId: string | null;
  /** In-Memory-Slim-Liste des Programms. */
  antraege: readonly AntragListItem[];
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

/**
 * Ordnet einen Status genau EINEM der fünf Töpfe zu.
 *
 * **Die Reihenfolge ist nicht kosmetisch**: `abgelehnt/zurückgezogen` liegt im
 * Förder-Katalog in der Kategorie `abgeschlossen` (siehe Kommentar an
 * `ABGELEHNT_ZURUECKGEZOGEN`) und ist damit auch `isTerminalStatus`. Wer
 * `isTerminalStatus` zuerst prüft, lässt 3.534 Ablehnungen unter „abgeschlossen"
 * verschwinden — also genau den Befund, um den es hier geht.
 */
function topfVon(status: unknown): 'abgelehnt' | 'bewilligt' | 'abgeschlossen' | 'sonstige' | 'inArbeit' {
  if (isAbgelehntZurueckgezogenStatus(status)) return 'abgelehnt';
  if (isBewilligtStatus(status)) return 'bewilligt';
  if (isTerminalStatus(status)) return 'abgeschlossen';
  if (getStatusCategory(status) === 'sonstige') return 'sonstige';
  return 'inArbeit';
}

/**
 * Liefert das Kurzprofil zum Antragsteller des betrachteten Teilvorhabens.
 *
 * Gibt **immer** ein Profil zurück, auch mit `gesamt: 0` — „dieser Antragsteller
 * hat sonst nichts eingereicht" ist eine Antwort und muss in der Karte stehen
 * können (41 % der Antragsteller haben genau einen Antrag). `null` nur, wenn gar
 * kein Name vorliegt: dann gibt es kein Subjekt, über das man etwas sagen könnte.
 */
export function findAntraegeVonAntragsteller(params: FindParams): AntragstellerProfil | null {
  const { name, currentAktenzeichen, currentVerbundId, antraege } = params;
  const anzeigeName = strOrNull(name);
  const target = normalizeAntragstellerForMatch(anzeigeName);
  if (anzeigeName === null || target === null) return null;

  const profil: AntragstellerProfil = {
    name: anzeigeName,
    gesamt: 0,
    abgelehnt: 0,
    bewilligt: 0,
    abgeschlossen: 0,
    sonstige: 0,
    inArbeit: 0,
    antraege: [],
  };

  for (const a of antraege) {
    if (a.aktenzeichen === currentAktenzeichen) continue;
    if (normalizeAntragstellerForMatch(a.antragsteller) !== target) continue;
    profil.antraege.push({
      aktenzeichen: a.aktenzeichen,
      akronym: strOrNull(a.akronym) ?? undefined,
      status: strOrNull(a.status) ?? undefined,
      antragsdatum: strOrNull(a.antragsdatum) ?? undefined,
      // Geschwister-Teilvorhaben desselben Verbundes sind eigene Anträge und
      // bleiben in der Liste — sie tragen nur eine leise Marke.
      imSelbenVerbund: currentVerbundId !== null && strOrNull(a.verbund_id) === currentVerbundId,
    });
    profil[topfVon(a.status)] += 1;
    profil.gesamt += 1;
  }

  // Jüngster zuerst; ISO-Daten vergleichen sich lexikografisch. Anträge ohne
  // Datum ans Ende (sie sind nicht „am ältesten", sondern unbekannt).
  profil.antraege.sort((x, y) => {
    const dx = x.antragsdatum;
    const dy = y.antragsdatum;
    if (dx && dy && dx !== dy) return dy.localeCompare(dx);
    if (dx && !dy) return -1;
    if (!dx && dy) return 1;
    return x.aktenzeichen.localeCompare(y.aktenzeichen);
  });

  return profil;
}
