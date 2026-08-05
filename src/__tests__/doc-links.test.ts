/**
 * Link-Guard für die dauerhaft gepflegten Marker-Docs.
 *
 * Prüft, dass alle relativen Markdown-Links in der Wurzel-CLAUDE.md, der
 * Agent-README und den verschachtelten CLAUDE.md auf existierende Dateien
 * zeigen (Anker-Fragmente abgeschnitten, externe URLs ignoriert). Die
 * generierte, gitignorete `code-map.md` ist whitelisted (der precheck-Hook
 * erzeugt sie; auf einem frischen Checkout darf sie fehlen).
 *
 * Bewusst NICHT in codebase-conventions.test.ts (die steht an ihrem
 * MAX_FILE_LOC-Limit).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const DOC_FILES = [
  'CLAUDE.md',
  'docs/agents/README.md',
  'src/plugins/auslastung/CLAUDE.md',
  'src/core/services/assistent/CLAUDE.md',
  'src/plugins/antraege/CLAUDE.md',
];

// Generierte, gitignorete Dateien: dürfen fehlen (precheck-Hook erzeugt sie).
const GENERATED_WHITELIST = new Set(['docs/architecture/code-map.md']);

function extractHrefs(md: string): string[] {
  const re = /\[[^\]]*\]\(([^)\s]+)\)/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

function stripAnchor(href: string): string {
  return href.split('#')[0] ?? '';
}

function isRelativeDocLink(href: string): boolean {
  if (/^(https?:|mailto:)/i.test(href)) return false;
  return stripAnchor(href).length > 0; // reine #anchor-Links ignorieren
}

describe('doc-links', () => {
  for (const docRel of DOC_FILES) {
    it(`alle relativen Links in ${docRel} zeigen auf existierende Dateien`, () => {
      const abs = resolve(ROOT, docRel);
      const md = readFileSync(abs, 'utf8');
      const dir = dirname(abs);
      const broken: string[] = [];
      for (const href of extractHrefs(md)) {
        if (!isRelativeDocLink(href)) continue;
        const targetAbs = resolve(dir, stripAnchor(href));
        const rootRel = targetAbs.slice(ROOT.length + 1).split('\\').join('/');
        if (GENERATED_WHITELIST.has(rootRel)) continue;
        if (!existsSync(targetAbs)) broken.push(`${href} → ${rootRel}`);
      }
      expect(broken, `Kaputte Links in ${docRel}:\n${broken.join('\n')}`).toEqual([]);
    });
  }

  it('Root-CLAUDE.md bleibt unter dem Diät-Ceiling (Regressions-Guard)', () => {
    const bytes = statSync(resolve(ROOT, 'CLAUDE.md')).size;
    // Phase 4 „CLAUDE.md-Diät": von ~68 KB auf ~44 KB. Ceiling fängt eine
    // Rückkehr Richtung Alt-Größe; bei bewusstem Wachstum hier anheben.
    // 47_000 → 47_500 (v2.271): Abschnitt „MAP-Förderfähigkeitsprüfung" + eine
    // Zeile im Decision-Tree. Der Eintrag ist bereits auf zwei harte Regeln plus
    // Themen-Doc-Link eingedampft — kürzer wäre er nutzloser als seine Nachbarn.
    // 47_500 → 47_700 (v2.296): eine Decision-Tree-Zeile für die Skill-Vorgaben
    // (wo Umfang & Form leben, seit sie nicht mehr Regel-Bibliothek sind). Bereits
    // auf Stichwort + Doc-Link gekürzt; ohne Zeile fände sie niemand.
    // 47_700 → 47_900 (Konsolidierungs-Pass): der Zyklen-Wächter im Entwicklungs-
    // Gate. Ein Gate-Schritt, den `npm run check` fährt, muss dort stehen, sonst
    // ist er beim ersten roten Lauf unerklärlich. Auf Link + einen Satz gekürzt;
    // das Warum lebt im Docstring von scripts/check-cycles.mjs.
    // 47_900 → 48_300 (v2.310): eine Decision-Tree-Zeile für den Textbaustein-
    // Katalog (NF/RNE/ABL als versionierte App-Daten). Bereits auf Stichworte +
    // Doc-Link gekürzt; ohne Zeile fände die Werkbank ihre Datengrundlage nicht.
    // 48_300 → 49_000 (v2.322): eine Decision-Tree-Zeile + Pitfall #40 fürs
    // Status-System (neu) — Katalog/Historie/Ableitung, gerätelokal, snapshot-
    // basiertes getStatusCategory. Bereits auf Stichworte + Doc-Link + zwei harte
    // Regeln gekürzt; das Warum lebt in docs/status-system/.
    // 49_000 → 49_700 (v2.331): eine Decision-Tree-Zeile + Pitfall #41 für die
    // Bearbeitungs-Meilensteine — die zweite Achse neben dem Status (Soll-Wochen,
    // Frist-Prognose, Plan als TEAM-Sidecar statt gerätelokal wie der Status-
    // Katalog). Genau dieser Unterschied ist die Stelle, an der man sich ohne
    // Hinweis vergreift; das Detail lebt in docs/architecture/meilensteine.md.
    // 49_700 → 50_200 (v2.337): EINE Zeile für die Abschnitts-Journey (Ziel-
    // Fallback, auto-angehängter Feinschliff, Abnahme-Kriterien, Vier-Ebenen-
    // Karte). Bereits auf Stichworte + Doc-Link gekürzt — vier Schichten, die
    // den GA-Lauf verhaltensrelevant ändern, ganz zu verschweigen wäre teurer
    // als die Zeile; das Warum lebt in gutachten-kurzfassung.md.
    // 50_200 → 51_200 (v2.345): eine Decision-Tree-Zeile + Pitfall #42 für den
    // Code-Katalog des Fachsystems. Der Katalog wächst von 7 auf ~184 Felder,
    // und drei Regeln daraus greift man ohne Hinweis daneben: `feldId` ist der
    // ROHE Spalten-Code (nicht der Record-Key), `ebene` und `herkunft` sind
    // verschieden, und ein Feld ohne Rang wirkt nicht. Das Detail lebt in
    // docs/status-system/KATALOG-CODES.md.
    // 51_200 → 52_000 (v2.349): Pitfall #43 für die Kürzel-Zuarbeit. Zwei
    // Regeln, die man ohne Hinweis garantiert falsch macht: Bezeichnung und
    // Rolle sind GENERIERTE Fremddaten (wer sie von Hand editiert, verliert sie
    // beim nächsten Lauf), und ein leeres Rollen-Array heißt „jeder darf",
    // nicht „niemand" — die umgekehrte Lesart blendet 143 von 505 Codes
    // überall aus. Das Detail lebt in docs/status-system/KATALOG-CODES.md.
    // 52_000 → 52_200 (v2.371): EINE Decision-Tree-Zeile für die Variante
    // „local". Sie ist reine Auffindbarkeit — ohne sie weiß ein Agent nicht,
    // dass er die App überhaupt selbst ansehen und bedienen KANN, und fällt auf
    // „bitte manuell prüfen" zurück. Die Zeile trägt nur Stichwort + Doc-Link +
    // Kommando; das Detail lebt in docs/architecture/local-variante.md.
    // 52_200 → 53_300 (v2.372.2): der Abschnitt „Abnahme: selbst ansehen, nicht
    // ansagen". Seit der Variante „local" KANN ein Agent die App selbst bedienen —
    // ohne die Regel fällt er auf „bitte manuell prüfen" zurück, und genau das
    // soll nicht mehr passieren. Die Ausnahmeliste (`file://`, FSAPI-Picker,
    // Share-Schreibrechte) gehört daneben, sonst wird aus der Pflicht ein
    // Versprechen, das der Dev-Server nicht halten kann.
    // 53_300 → 55_500 (v2.380): das Vorgangssystem. Ein Subsystem über sechs
    // neue Module in `core/status/` plus ein Plugin, komprimiert auf EINE
    // Decision-Tree-Zeile, EINEN Absatz und Pitfall #44. Drei Dinge macht man
    // ohne Hinweis garantiert falsch: eine neue Ableitung bauen (die App leitet
    // KEINEN Status mehr ab), ein Kürzel als `D_<code>` schreiben (vier Codes
    // heißen im Katalog anders, und das Feld findet dann nie einen Wert), und
    // Unbelegbares als „ok" zählen statt als eigenes Urteil. Alles Detail —
    // Bausteine, Messwerte, Abweichungen — lebt in
    // docs/architecture/vorgangssystem.md.
    // 55_500 → 56_400 (v2.385): Pitfall #45 + zwei Sätze am
    // Vorgangssystem-Absatz für den Rückbau der Ableitung. Zwei Fehler macht
    // man ohne den Hinweis garantiert: eine zweite Werteliste neben dem
    // Code-Katalog anlegen (die alte kannte 21 von 30 Codes, und niemand merkte
    // es), und eine abgeleitete Größe zusätzlich persistieren (die gespeicherte
    // Fassung gewinnt dann über die neue Ableitung — beobachtet als zwei
    // verschiedene Zahlen auf derselben Seite). Beides ist im Diff unsichtbar
    // und fällt erst am Bestand auf. Gegengerechnet: die abgelöste Rede von der
    // „Ableitung" ist an drei Stellen gekürzt worden, der Netto-Zuwachs sind
    // ~1,2 KB. Detail: docs/architecture/vorgangssystem.md#7.
    // 56_400 → 58_000 (v2.389): Pitfall #46 + zwei Decision-Tree-Zeilen für den
    // Betrachtungsbereich. Zwei Fehler macht man ohne den Hinweis garantiert:
    // den Bereich in den Daten-Layer ziehen (dann findet die Suche nur noch,
    // was ohnehin sichtbar ist, und ein Deep-Link auf ein Altprogramm läuft ins
    // Leere) und die Kompetenz-Historie der Auslastung mitfiltern (die
    // AnonymMap ist append-only und führt ehemalige Bearbeiter). Beides ist im
    // Diff unsichtbar. Detail: docs/architecture/vorgangssystem.md §10.
    // 58_000 → 61_000 (v2.392): Pitfall #47 + #48, zwei Decision-Tree-Zeilen und
    // zwei Sätze am Vorgangssystem-Absatz für die beiden neuen Subsysteme.
    // Drei Fehler macht man ohne die Hinweise garantiert, und alle drei sind im
    // Diff unsichtbar:
    //  (1) die Regelsatz-Auswahl als Vorfilter statt in der Engine — dann
    //      fallen S0/S1/S2 aus jeder fremden Rollensicht heraus, und ein im
    //      C16 abgeschlossener Vorgang steht dem FB als offene Aufgabe im
    //      Board;
    //  (2) `giltFuer` leer als „keine Rolle" lesen (wie `zustaendig` daneben)
    //      statt als „alle" — die Sperre greift dann nirgends;
    //  (3) das Journal gerätelokal führen oder eine Bearbeiterspalte
    //      aufnehmen — das erste erzeugt genau die Rechner-Divergenz, die das
    //      Vorgangssystem beseitigt hat, das zweite macht aus einem
    //      Änderungs-Journal ein mitbestimmungspflichtiges Aktivitätsprotokoll.
    // Detail: docs/architecture/vorgangssystem.md §11 und §12.
    // 61_000 → 61_400 (v2.397): eine Klausel an Pitfall #46 — die Programm-Liste
    // des Betrachtungsbereichs ist die Vereinigung der drei jüngsten
    // Richtlinien-GENERATIONEN, nicht der Programme mit Trigger-Zuarbeit, und die
    // Zahl im Chip wird daraus abgeleitet statt danebengeschrieben. Genau diese
    // beiden Sätze fehlten in v2.389: der Bereich wurde nach Datenverfügbarkeit
    // geschnitten (neun Programme = zwei Generationen) und trug trotzdem das
    // Etikett „letzte 3 Richtlinien". Im Diff unsichtbar, weil beide Hälften für
    // sich plausibel aussahen.
    // 61_400 → 61_700 (v2.401): die Tree-Basis bekommt eine Zeile in der
    // „Ich will…"-Tabelle, eine Klausel in der Layout-Schicht („kein eigener
    // Baum") und ihren Guard-Namen in der Guard-Aufzählung. Das Detail steht
    // NICHT hier, sondern in docs/architecture/tree-komponenten.md — der erste
    // Entwurf hatte einen ganzen Abschnitt in CLAUDE.md und riss genau dieses
    // Ceiling. Ohne die Klausel in der Layout-Schicht baut das nächste Modul
    // wieder einen eigenen Baum; das ist der Fehler, den vier Module vor dem
    // Umbau gemacht haben.
    // 61_700 → 62_100 (v2.407): das Klärungs-Modul „Zu klären" bekommt die drei
    // Zeilen, die jedes Modul hier bekommt — eine in der „Ich will…"-Tabelle,
    // eine im Pitfall-Themenindex und Pitfall #49. Der erste Entwurf von #49 war
    // dreimal so lang und riss dieses Ceiling; das Detail (warum Datei je Autor,
    // warum Faltung nach Dateireihenfolge, warum kein Rückschreiben) steht in
    // docs/architecture/klaerung.md. Hier bleibt nur, was beim Patchen sofort
    // sichtbar sein muss — allen voran: NICHT auf eine gemeinsame Antwortdatei
    // umbauen, `appendToFile` verliert dann stillschweigend Zeilen.
    // 62_100 → 63_600 (v2.409): die beiden Status-Achsen bekommen ihre drei
    // Zeilen — eine in der „Ich will…"-Tabelle, eine im Pitfall-Themenindex und
    // Pitfall #50. Der Pitfall ist lang, weil er vier Zusagen bündelt, die man
    // einzeln bricht: Achse A kuratierbar / Achse B nicht, EIN Schreibweg aufs
    // Register, Seed statt leerer Liste, und Aggregatnamen ≠ Kategorienamen.
    // Getrennt wären es vier Nummern für einen Zusammenhang; das Detail (warum
    // asymmetrisch, welche sieben Abschnitte, welche Namen) steht in
    // docs/architecture/status-achsen.md.
    // 63_600 → 65_100 (v3.0): die Modul-Freischaltung bekommt ihre drei Zeilen
    // (Tabelle, Themenindex, Pitfall #51). Gegengerechnet ist bereits, was die
    // Varianten-Zusammenlegung eingespart hat: der Build-Varianten-Abschnitt
    // beschreibt drei statt fünf Varianten und ist dabei kürzer geworden. Der
    // erste Entwurf von #51 war doppelt so lang; das Detail (zwei Ebenen, warum
    // die Prädikate nicht in feature-flags.ts leben, welche Aufrufstellen roh
    // bleiben) steht in docs/architecture/modul-freischaltung.md. Hier bleibt
    // nur, was beim Patchen sofort sichtbar sein muss.
    expect(bytes).toBeLessThan(65_100);
  });
});
