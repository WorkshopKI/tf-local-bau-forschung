/**
 * Das **Erhebungsmaterial für den FB-Termin** als XLSX und Markdown.
 *
 * Ersatz für die fehlende FB-Mappe: auf AB-Seite gab es WENN-Formeln zum
 * Transkribieren, auf FB-Seite gibt es nichts. Die Spezifikation muss aus dem
 * Bestand kommen, und zwar in einer Form, die im Termin auf dem Tisch liegen
 * kann — drei Blätter und eine Seite Text für die Einladung.
 *
 * Rein bis auf den Download: das Formen der Blätter ist testbar, `schreibe…`
 * ruft nur die geteilte Mappen-Utility.
 */
import {
  ROLLE_LABEL, ROLLE_LANG,
  type BlindeFleckenErhebung, type KuerzelKarteZeile, type PlatzhalterErhebung, type Rolle,
} from '@/core/status';
import { schreibeArbeitsmappe, zeitstempel, type Blatt } from './arbeitsmappe';

export interface ErhebungsKontext {
  /** ISO-Zeitpunkt des Laufs. */
  stichtag: string;
  /** Welche Richtlinien gezählt wurden — sonst ist keine Zahl einzuordnen. */
  bereichText: string;
  /** Für welche Rolle die Erhebung gemacht wurde. */
  rolle: Rolle;
}

export interface ErhebungsDaten {
  platzhalter: PlatzhalterErhebung;
  flecken: BlindeFleckenErhebung;
  karte: KuerzelKarteZeile[];
}

/** Die Kopfzeilen, die auf JEDEM Blatt stehen. */
function kopfZeilen(k: ErhebungsKontext, gesamt: number, was: string): string[] {
  return [
    `Erhebung ${ROLLE_LABEL[k.rolle]}-Regelsatz — ${was}`,
    `Stichtag: ${k.stichtag.slice(0, 10)}`,
    `Betrachtungsbereich: ${k.bereichText}`,
    `Ausgewertete Vorgänge: ${gesamt} · alle Jahrgänge`,
  ];
}

export function baueBlaetter(k: ErhebungsKontext, d: ErhebungsDaten): Blatt[] {
  const rolle = ROLLE_LABEL[k.rolle];
  return [
    {
      name: 'Platzhalter',
      kopf: [
        ...kopfZeilen(k, d.platzhalter.gesamt, 'abgeleitete Platzhalter'),
        `Situationen, in denen eine fremde Regel schon heute auf ${rolle} wartet.`,
        'Die Anzahl ist eine Untergrenze: gezählt wird nur, wo die fremde Regel ihre Kaskade gewinnt.',
      ],
      spalten: ['Anzahl', 'To-do', 'Herkunftsregel', 'Rolle', 'Beispiel-Aktenzeichen'],
      zeilen: d.platzhalter.gruppen
        .filter(g => g.rolle === k.rolle)
        .map(g => [g.anzahl, g.todo, g.beschreibung, ROLLE_LABEL[g.rolle], g.beispiele.join(', ')]),
    },
    {
      name: 'Blinde Flecken',
      kopf: [
        ...kopfZeilen(k, d.flecken.gesamt, 'blinde Flecken'),
        `Davon ohne To-do in JEDEM Regelsatz: ${d.flecken.ohneTodo}`,
        'Vorgänge, für die keine Regel greift, obwohl ein Kürzel-Paar einseitig offen steht —',
        'jemand hat angefangen und nicht abgeschlossen, und die Kaskade sagt dazu nichts.',
      ],
      spalten: [
        'Anzahl', 'gesetzt', 'fehlt', 'Bezeichnung des fehlenden Kürzels',
        'zuständige Rolle', 'Median-Standzeit (Tage)', 'Beispiel-Aktenzeichen',
      ],
      zeilen: d.flecken.paare.map(p => [
        p.anzahl, p.gesetzt, p.fehlt, p.fehltLabel,
        p.rolle === null ? 'alle' : ROLLE_LABEL[p.rolle],
        p.medianTage, p.beispiele.join(', '),
      ]),
    },
    {
      name: `${rolle}-Kürzel`,
      kopf: [
        ...kopfZeilen(k, d.platzhalter.gesamt, `Kürzel-Landkarte ${rolle}`),
        `Alle Kürzel, die laut Zuarbeit von ${rolle} gesetzt werden.`,
        'Vorkommen 0 heißt: vorgesehen, im Bestand aber nie gesetzt — selbst ein Befund.',
      ],
      spalten: ['Kürzel', 'Bezeichnung', 'Vorkommen im Bestand', 'Was das Setzen auslöst'],
      zeilen: d.karte.map(z => [z.code, z.label, z.vorkommen, z.wirkung.join(' | ')]),
    },
  ];
}

/** Die Kurzfassung für die Einladung — eine Seite, keine Tabelle. */
export function baueMarkdown(k: ErhebungsKontext, d: ErhebungsDaten): string {
  const rolle = ROLLE_LABEL[k.rolle];
  const eigene = d.platzhalter.gruppen.filter(g => g.rolle === k.rolle);
  const bilanz = d.platzhalter.proRolle.find(b => b.rolle === k.rolle);
  const z: string[] = [];
  z.push(`# Erhebung ${rolle}-Regelsatz`);
  z.push('');
  z.push(`Stand ${k.stichtag.slice(0, 10)} · Betrachtungsbereich: ${k.bereichText} · `
    + `${d.platzhalter.gesamt} Vorgänge, alle Jahrgänge.`);
  z.push('');
  z.push(`Die To-do-Kaskade der App kennt heute nur den AB-Regelsatz. Für ${ROLLE_LANG[k.rolle]} `
    + 'gibt es keine Mappe zum Transkribieren — diese Erhebung ersetzt sie: sie zeigt, wo die '
    + 'bestehenden Regeln schon heute auf diese Rolle warten und wo sie schweigen, obwohl die '
    + 'Daten etwas sagen.');
  z.push('');
  z.push('## 1. Wo die AB-Regeln auf uns warten');
  z.push('');
  if (eigene.length === 0) {
    z.push('Keine — im ausgewerteten Bestand wartet derzeit keine Regel auf diese Rolle.');
  } else {
    z.push(`${bilanz?.abgeleitet ?? 0} Vorgänge tragen heute ein geliehenes To-do. Je Zeile: `
      + 'was die App anzeigt, aus welcher Regel es stammt, wie oft.');
    z.push('');
    z.push('| Anzahl | To-do | Herkunftsregel |');
    z.push('|---:|---|---|');
    for (const g of eigene) z.push(`| ${g.anzahl} | ${g.todo} | ${g.beschreibung} |`);
    z.push('');
    z.push('**Achtung bei der Größenordnung:** die Anzahl zählt nur die Vorgänge, bei denen die '
      + 'AB-Regel ihre Kaskade gewinnt. Eine eigene Regel steht in ihrem Satz allein und trifft '
      + 'deshalb regelmäßig ein Vielfaches.');
  }
  z.push('');
  z.push('## 2. Wo heute niemand etwas sagt');
  z.push('');
  z.push(`${d.flecken.ohneTodo} von ${d.flecken.gesamt} Vorgängen tragen in keinem Regelsatz ein `
    + 'To-do. Bei diesen steht zusätzlich ein Kürzel-Paar einseitig offen — jemand hat angefangen '
    + 'und nicht abgeschlossen:');
  z.push('');
  if (d.flecken.paare.length === 0) {
    z.push('Keine einseitig offenen Paare im ausgewerteten Bestand.');
  } else {
    z.push('| Anzahl | gesetzt | fehlt | Median-Standzeit |');
    z.push('|---:|---|---|---:|');
    for (const p of d.flecken.paare) {
      z.push(`| ${p.anzahl} | ${p.gesetzt} | ${p.fehlt} („${p.fehltLabel}") | ${p.medianTage} Tage |`);
    }
  }
  z.push('');
  z.push('## 3. Womit wir arbeiten');
  z.push('');
  const gesetzt = d.karte.filter(x => x.vorkommen > 0);
  z.push(`Die Zuarbeit führt ${d.karte.length} Kürzel, die ${rolle} setzt; `
    + `${gesetzt.length} davon kommen im Bestand tatsächlich vor. Die häufigsten:`);
  z.push('');
  z.push('| Kürzel | Bezeichnung | Vorkommen |');
  z.push('|---|---|---:|');
  for (const x of gesetzt.slice(0, 15)) z.push(`| ${x.code} | ${x.label} | ${x.vorkommen} |`);
  z.push('');
  z.push('## Was im Termin zu entscheiden ist');
  z.push('');
  z.push('1. Welche der Situationen aus Abschnitt 1 sollen eine **eigene** Regel bekommen — und '
    + 'mit welchem To-do-Text?');
  z.push('2. Welche der offenen Paare aus Abschnitt 2 sind ein echter Rückstand und welche eine '
    + 'Altlast der Datenpflege?');
  z.push('3. Soll eine eigene Regel dieselbe Population treffen wie der geliehene Platzhalter '
    + '(dann braucht sie zusätzliche Abgrenzungen) oder bewusst die breitere?');
  z.push('');
  return z.join('\n');
}

/** XLSX und Markdown herunterladen. */
export function exportiereErhebung(
  k: ErhebungsKontext, d: ErhebungsDaten, jetzt: Date = new Date(),
): void {
  const stempel = zeitstempel(jetzt);
  schreibeArbeitsmappe(baueBlaetter(k, d), `erhebung-${k.rolle}-regelsatz-${stempel}.xlsx`);
  const blob = new Blob([baueMarkdown(k, d)], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `erhebung-${k.rolle}-regelsatz-${stempel}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}
