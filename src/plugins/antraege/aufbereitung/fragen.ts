/**
 * Fragen-Aggregation der Antrag-Aufbereitung (Paket 4). Sammelt ALLE offenen Punkte
 * eines Runs an einem Ort — rein deterministisch aus dem vorhandenen Run + den bereits
 * gelaufenen Bausteinen, KEIN neuer LLM-Aufruf. Vorstufe der späteren NF-Anbindung.
 *
 * Quellen: Zeitplan-/Kapazitäts-Befunde (`run.befunde`), fehlende Pflichtangaben +
 * unabgedeckte Aspekte (Aspekt-Mapping), Lösungswege ohne Risiko + unzuordenbare
 * Risiken (`zuordneRisiken`), Zahlen-Widersprüche (`pruefeZahlWidersprueche`). Gruppiert
 * nach Prüfaspekt A–J (+ „Allgemein"); die Zuordnung ist deterministisch herleitbar
 * (Sektion→Aspekt bzw. Domäne), nie geraten. Reine Funktionen (Node-testbar).
 */
import { PRUEF_ASPEKTE, ASPEKT_IDS, fehlendeAlsKandidaten, type AspektMapping } from './aspekte';
import { zuordneRisiken } from './risiken';
import { pruefeZahlWidersprueche, type ZahlenDaten } from './zahlen';
import { befundKey } from './store';
import type { AufbereitungRun } from './types';
import type { Befund } from './tabellen';

/** Lauf-Status eines Bausteins (spiegelt `BausteinUiStatus`, hier entkoppelt gehalten). */
export type BausteinLaufStatus = 'fehlt' | 'laeuft' | 'ok' | 'degradiert' | 'fehler';

/** Eine aggregierte Prüffrage mit stabilem Key (für die `erledigtePunkte`-Mechanik). */
export interface FrageEintrag {
  /** befundKey ODER Kandidaten-Key (`aspekt-fehlt:`/`risiko-fehlt:`/…) — stabil. */
  key: string;
  /** Deterministisch generierter Fragetext (als Prüffrage). */
  frage: string;
  /** Quell-Baustein/Herkunft (Anzeige). */
  quelle: string;
  /** Zugeordneter Prüfaspekt A–J (oder null = Allgemein). */
  aspektId: string | null;
  /** Sektions-IDs für den `FundstelleChip` (kann leer sein). */
  sektionIds: string[];
}

/** Eine Aspekt-Gruppe (oder „Allgemein", `aspektId: null`). */
export interface FragenGruppe {
  aspektId: string | null;
  label: string;
  eintraege: FrageEintrag[];
}

/** Meta-Hinweis: ein Frage-liefernder Baustein ist nicht/teilweise gelaufen. */
export interface FragenMetaHinweis {
  baustein: string;
  status: BausteinLaufStatus;
}

export interface FragenModell {
  gruppen: FragenGruppe[];
  meta: FragenMetaHinweis[];
  /** Anzahl aller Frage-Einträge (über alle Gruppen). */
  gesamt: number;
}

export interface SammleFragenInput {
  run: AufbereitungRun;
  mapping: AspektMapping | null;
  zahlen: ZahlenDaten | null;
  status: { aspekte: BausteinLaufStatus; zahlen: BausteinLaufStatus };
}

/** Deutsch-tolerante Slug-Bildung (Umlaute ausgeschrieben, nur a-z0-9-, gekürzt). */
function slug(s: string): string {
  return s.toLowerCase().normalize('NFC')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/** Herkunfts-Label eines deterministischen Befunds. */
function quelleVonBefund(b: Befund): string {
  return b.typ === 'kapazitaet' ? 'Kapazität' : 'Zeitplan';
}

/** Deterministischer Fragetext aus Befundtyp + Kontext (als Prüffrage). */
function frageVonBefund(b: Befund): string {
  switch (b.typ) {
    case 'kapazitaet': return `${b.text} Ist diese Auslastung leistbar?`;
    case 'horizont': return `${b.text} Ist der Projekthorizont plausibel?`;
    case 'zeitraum-abweichung': return `${b.text} Welche Angabe stimmt?`;
    case 'nur-im-text': return `${b.text} Wurde das Arbeitspaket in Anlage 5 vergessen?`;
    case 'nur-in-anlage': return `${b.text} Wurde das Arbeitspaket im Text vergessen?`;
    default: return b.text;
  }
}

/**
 * Aggregiert alle offenen Punkte des Runs zu gruppierten Prüffragen. Reine Funktion.
 * Zeitplan-/Kapazitäts-Befunde gehören per Domäne zu Aspekt H (Projektplan); alle
 * übrigen Quellen tragen ihren Aspekt bereits (aspekt-fehlt/risiko/zahl → D/H/…).
 */
export function sammleFragen(input: SammleFragenInput): FragenModell {
  const { run, mapping, zahlen, status } = input;
  const eintraege: FrageEintrag[] = [];

  // 1. Deterministische Zeitplan-/Kapazitäts-Befunde → Aspekt H (Projektplan).
  for (const b of run.befunde) {
    eintraege.push({ key: befundKey(b), frage: frageVonBefund(b), quelle: quelleVonBefund(b), aspektId: 'H', sektionIds: [] });
  }

  if (mapping) {
    // 2. Fehlende Pflichtangaben je Aspekt.
    for (const k of fehlendeAlsKandidaten(mapping)) {
      eintraege.push({
        key: k.key,
        frage: `Ist die Angabe „${k.text}" im Antrag enthalten?`,
        quelle: 'Pflichtangabe',
        aspektId: k.aspektId,
        sektionIds: [],
      });
    }
    // 3. Prüfaspekte ganz ohne zugeordnete Sektion.
    for (const a of PRUEF_ASPEKTE) {
      if ((mapping.zuordnung[a.id] ?? []).length > 0) continue;
      eintraege.push({
        key: `aspekt-leer:${a.id}`,
        frage: `Prüfaspekt ${a.id} („${a.name}") ist keiner Sektion zugeordnet — wird er im Antrag behandelt?`,
        quelle: 'Aspekt-Abdeckung',
        aspektId: a.id,
        sektionIds: [],
      });
    }
    // 4. Lösungswege ohne Risiko + unzuordenbare Risiken.
    const zu = zuordneRisiken(run.risiken ?? [], mapping, run.gliederung);
    for (const s of zu.ohneRisiko) {
      eintraege.push({
        key: `risiko-fehlt:${s.id}`,
        frage: `Lösungsweg ${s.nummer ?? s.id} („${s.titel}") ohne benanntes technisches Risiko — welches Risiko wird adressiert?`,
        quelle: 'Risiko-Zuordnung',
        aspektId: 'D',
        sektionIds: [s.id],
      });
    }
    for (const r of zu.unzugeordnet) {
      eintraege.push({
        key: `risiko-unzugeordnet:${slug(r.titel)}`,
        frage: `Risiko „${r.titel}" ist keinem Lösungsweg zugeordnet — wo wird es im Antrag behandelt?`,
        quelle: 'Risiko-Zuordnung',
        aspektId: 'D',
        sektionIds: r.sektionId ? [r.sektionId] : [],
      });
    }
  }

  // 5. Zahlen-Widersprüche (Aspekt H) — Vergleich gegen den Zeitplan (Laufzeit-Horizont,
  // Anlage-5-PM-Summe); ohne Zeitplan liefert die reine Funktion von sich aus nichts.
  if (zahlen) {
    for (const b of pruefeZahlWidersprueche(zahlen.claims, run)) {
      eintraege.push({
        key: b.key,
        frage: `${b.text} Welcher Wert stimmt?`,
        quelle: 'Zahlen-Quervergleich',
        aspektId: b.aspektId,
        sektionIds: b.sektionIds,
      });
    }
  }

  // Gruppieren: A–J in Katalog-Reihenfolge, dann „Allgemein" (aspektId null/unbekannt).
  const gruppen: FragenGruppe[] = [];
  for (const a of PRUEF_ASPEKTE) {
    const e = eintraege.filter(x => x.aspektId === a.id);
    if (e.length) gruppen.push({ aspektId: a.id, label: `${a.id} — ${a.name}`, eintraege: e });
  }
  const allgemein = eintraege.filter(x => x.aspektId == null || !ASPEKT_IDS.has(x.aspektId));
  if (allgemein.length) gruppen.push({ aspektId: null, label: 'Allgemein / unzugeordnet', eintraege: allgemein });

  // Meta-Hinweise: die Frage-liefernden Bausteine, die nicht sauber gelaufen sind.
  const meta: FragenMetaHinweis[] = [];
  if (status.aspekte !== 'ok') meta.push({ baustein: 'Aspekt-Mapping', status: status.aspekte });
  if (status.zahlen !== 'ok') meta.push({ baustein: 'Zahlen-Inventar', status: status.zahlen });

  return { gruppen, meta, gesamt: eintraege.length };
}

/** Menschenlesbarer Status-Text eines Meta-Hinweises. */
export function metaStatusText(s: BausteinLaufStatus): string {
  switch (s) {
    case 'degradiert': return 'lieferte ein unstrukturiertes Ergebnis';
    case 'fehler': return 'konnte nicht laufen';
    case 'laeuft': return 'läuft noch';
    default: return 'ist noch nicht gelaufen';
  }
}

/**
 * Fragenliste als Markdown, gruppiert nach Aspekt, mit Sektions-IDs als Referenz und
 * `[x]`/`[ ]` je nach Erledigt-Status. Keine NF-Anbindung, kein Versand.
 */
export function formatFragenMarkdown(modell: FragenModell, erledigt: ReadonlySet<string>): string {
  const zeilen: string[] = ['# Offene Punkte / Prüffragen', ''];
  for (const g of modell.gruppen) {
    const offen = g.eintraege.filter(e => !erledigt.has(e.key)).length;
    zeilen.push(`## ${g.label} (${offen}/${g.eintraege.length} offen)`);
    for (const e of g.eintraege) {
      const box = erledigt.has(e.key) ? '[x]' : '[ ]';
      const ref = e.sektionIds.length ? ` — ${e.sektionIds.join(', ')}` : '';
      zeilen.push(`- ${box} ${e.frage}${ref}`);
    }
    zeilen.push('');
  }
  if (modell.meta.length) {
    zeilen.push('## Hinweis');
    for (const m of modell.meta) zeilen.push(`- Baustein „${m.baustein}" ${metaStatusText(m.status)} — die Aggregation ist unvollständig.`);
    zeilen.push('');
  }
  return zeilen.join('\n').trimEnd() + '\n';
}
