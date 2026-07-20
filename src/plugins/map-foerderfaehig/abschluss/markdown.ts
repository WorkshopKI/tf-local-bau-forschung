/**
 * Abschluss-Entwürfe: Gutachten-Gerüst, Nachforderung und Ablehnung.
 *
 * Rein und ohne LLM — das Gerüst entsteht deterministisch aus den Bewertungen.
 * Die Nachforderung setzt die kuratierten Bausteine WORTGETREU ein (Pitfall #34);
 * findet die Suche nichts, steht dort eine Freitext-Zeile mit einer
 * `[TODO Baustein zuordnen]`-Markierung statt einer erfundenen Formulierung.
 */
import type { MapBewertungsErgebnis, MapItemZustand } from '../checkliste/bewertung';
import type { MapChecklistenDefinition } from '../checkliste/typen';
import { formatDatum } from '../import/laufzeit';
import type { MapEinreichung } from '../types';
import { sucheNfBausteine } from './nf-suche';

export type AbschlussArt = 'gutachten' | 'nachforderung' | 'ablehnung';

export interface AbschlussOptionen {
  /** Titeländerung — in der Papiervorlage ein fester Abschluss-Teilschritt. */
  titelGeprueft: boolean;
  /** Freitext-Hinweise für die weiterverarbeitende Rolle. */
  hinweis: string;
}

const NICHTS = '—';

function kopf(e: MapEinreichung, definition: MapChecklistenDefinition, titel: string): string[] {
  return [
    `# ${titel}`,
    '',
    `**Vorhaben:** ${e.stamm.titel ?? NICHTS}`,
    `**Akronym:** ${e.stamm.akronym ?? NICHTS}`,
    `**Laufzeit:** ${formatDatum(e.laufzeit.start)} – ${formatDatum(e.laufzeit.ende)}`
      + (e.laufzeit.monate !== null ? ` (${e.laufzeit.monate} Monate)` : ''),
    `**Checkliste:** ${definition.titel}, Fassung ${definition.version}`,
    '',
  ];
}

function innoAbschnitt(ergebnis: MapBewertungsErgebnis, definition: MapChecklistenDefinition): string[] {
  const { innoScore } = ergebnis;
  const zeilen = ['## Innovationsgrad', ''];

  for (const z of ergebnis.zustaende.filter(x => x.item.art === 'skala')) {
    const stufe = z.bewertung?.stufe;
    const anker = z.item.anker?.find(a => a.stufe === stufe);
    zeilen.push(
      `- **${z.item.kriterium}:** ${stufe ?? 'nicht bewertet'}`
      + (anker ? ` — ${anker.kurz} (${anker.punkte} Punkte)` : ''),
    );
    const bemerkung = z.bewertung?.bemerkung?.trim();
    if (bemerkung) zeilen.push(`  - Bemerkung: ${bemerkung}`);
  }

  zeilen.push('');
  zeilen.push(
    innoScore.nullWegenB0
      ? `**Punktzahl: 0 von ${innoScore.maxPunkte}** — mindestens eine Kategorie ist mit B0 bewertet;`
        + ` die Einzelsumme (${innoScore.rohSumme}) bleibt damit unberücksichtigt.`
      : `**Punktzahl: ${innoScore.punkte} von ${innoScore.maxPunkte}**`,
  );
  zeilen.push(
    innoScore.vertiefungNoetig
      ? `Unterhalb des Kurzpfads (${definition.innoScoreKurzpfad} Punkte) — die vertiefte Einzelprüfung war erforderlich.`
      : `Kurzpfad erreicht (ab ${definition.innoScoreKurzpfad} Punkten).`,
  );
  zeilen.push('');
  return zeilen;
}

/** Gruppiert die anwendbaren Items in Vorlagen-Reihenfolge. */
function nachGruppe(zustaende: readonly MapItemZustand[]): Array<[string, MapItemZustand[]]> {
  const gruppen = new Map<string, MapItemZustand[]>();
  for (const z of zustaende) {
    const liste = gruppen.get(z.item.gruppe) ?? [];
    liste.push(z);
    gruppen.set(z.item.gruppe, liste);
  }
  return [...gruppen.entries()];
}

function fuss(optionen: AbschlussOptionen): string[] {
  const zeilen = ['## Hinweise', ''];
  zeilen.push(
    optionen.titelGeprueft
      ? '- Teilvorhabentitel geprüft.'
      : '- **Offen:** Teilvorhabentitel prüfen, ggf. anpassen.',
  );
  const hinweis = optionen.hinweis.trim();
  if (hinweis) zeilen.push(`- ${hinweis}`);
  return zeilen;
}

/** Gutachten-Gerüst aus den erfüllten Kriterien. Rein. */
export function baueGutachten(
  e: MapEinreichung, definition: MapChecklistenDefinition,
  ergebnis: MapBewertungsErgebnis, optionen: AbschlussOptionen,
): string {
  const erfuellt = ergebnis.zustaende.filter(
    z => z.anwendbar && (z.status === 'erfuellt' || z.status === 'nf-erfuellt'),
  );

  const zeilen = [
    ...kopf(e, definition, 'Gutachten (Gerüst)'),
    ...innoAbschnitt(ergebnis, definition),
    '## Geprüfte Kriterien',
    '',
  ];

  for (const [gruppe, items] of nachGruppe(erfuellt)) {
    zeilen.push(`### ${gruppe}`, '');
    for (const z of items) {
      zeilen.push(`- ${z.item.kriterium}`
        + (z.status === 'nf-erfuellt' ? ' *(nach Nachforderung erfüllt)*' : ''));
      const bemerkung = z.bewertung?.bemerkung?.trim();
      if (bemerkung) zeilen.push(`  - ${bemerkung}`);
      if (z.item.fundstelle) zeilen.push(`  - Fundstelle: ${z.item.fundstelle}`);
    }
    zeilen.push('');
  }

  if (erfuellt.length === 0) zeilen.push('*Noch kein Kriterium als erfüllt bewertet.*', '');

  zeilen.push(...fuss(optionen));
  return zeilen.join('\n');
}

/** Nachforderung aus den Items mit ausstehender Nachlieferung. Rein. */
export function baueNachforderung(
  e: MapEinreichung, definition: MapChecklistenDefinition,
  ergebnis: MapBewertungsErgebnis, optionen: AbschlussOptionen,
): string {
  const offen = ergebnis.zustaende.filter(z => z.anwendbar && z.status === 'nf-notwendig');

  const zeilen = [...kopf(e, definition, 'Nachforderung (Entwurf)')];
  zeilen.push(
    'Zu folgenden Punkten benötigen wir ergänzende Angaben:', '',
  );

  if (offen.length === 0) {
    zeilen.push('*Kein Kriterium ist als nachforderungsbedürftig markiert.*', '');
  }

  let nummer = 0;
  for (const z of offen) {
    nummer++;
    zeilen.push(`## ${nummer}. ${z.item.kriterium}`, '');

    const bemerkung = z.bewertung?.bemerkung?.trim();
    if (bemerkung) zeilen.push(`*Vermerk der Prüfung: ${bemerkung}*`, '');

    const begriffe = z.item.nfSuchbegriffe ?? [z.item.kriterium];
    const treffer = sucheNfBausteine(begriffe, 'tv', 1);

    if (treffer.length === 0) {
      zeilen.push(
        `[TODO Baustein zuordnen] ${bemerkung || z.item.kriterium}`, '',
      );
    } else {
      const t = treffer[0]!;
      // Baustein-Text wortgetreu — Platzhalter bleiben stehen und werden
      // beim Fertigstellen der Nachforderung von Hand gefüllt.
      zeilen.push(t.baustein.text, '', `*(Baustein ${t.baustein.id} — ${t.baustein.thema})*`, '');
    }
  }

  zeilen.push(...fuss(optionen));
  return zeilen.join('\n');
}

/** Ablehnung aus den nicht erfüllten Kriterien. Rein. */
export function baueAblehnung(
  e: MapEinreichung, definition: MapChecklistenDefinition,
  ergebnis: MapBewertungsErgebnis, optionen: AbschlussOptionen,
): string {
  const gruende = ergebnis.zustaende.filter(z => z.anwendbar && z.status === 'nicht-erfuellt');

  const zeilen = [
    ...kopf(e, definition, 'Ablehnung (Entwurf)'),
    ...innoAbschnitt(ergebnis, definition),
    '## Ablehnungsgründe',
    '',
  ];

  if (gruende.length === 0) {
    zeilen.push('*Kein Kriterium ist als nicht erfüllt bewertet.*', '');
  }

  let nummer = 0;
  for (const z of gruende) {
    nummer++;
    zeilen.push(`${nummer}. **${z.item.kriterium}**`);
    const bemerkung = z.bewertung?.bemerkung?.trim();
    if (bemerkung) zeilen.push(`   ${bemerkung}`);
  }
  zeilen.push('');

  if (ergebnis.innoScore.nullWegenB0) {
    zeilen.push(
      '> Der Innovationsgrad ist unzureichend: mindestens eine Kategorie der'
      + ' Entscheidungshilfe wurde mit B0 bewertet.', '',
    );
  }

  zeilen.push('*Weitere Ablehnungsgründe mit der administrativen Bearbeitung abstimmen.*', '');
  zeilen.push(...fuss(optionen));
  return zeilen.join('\n');
}

/** Einstieg für die Oberfläche. Rein. */
export function baueAbschluss(
  art: AbschlussArt, e: MapEinreichung, definition: MapChecklistenDefinition,
  ergebnis: MapBewertungsErgebnis, optionen: AbschlussOptionen,
): string {
  if (art === 'gutachten') return baueGutachten(e, definition, ergebnis, optionen);
  if (art === 'nachforderung') return baueNachforderung(e, definition, ergebnis, optionen);
  return baueAblehnung(e, definition, ergebnis, optionen);
}
