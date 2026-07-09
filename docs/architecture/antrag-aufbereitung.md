# Antrag-Aufbereitung (Fundament, Zeitplan, LLM-Bausteine)

Eine **Vollbild-Seite pro Förderantrag**, die die Vorhabensbeschreibung (VB, 30–60 Seiten) strukturiert aufbereitet — nicht durch Zusammenfassungen, sondern durch **im Original verankerte** Sichten. Route `/antraege/:aktenzeichen/aufbereitung`, hinter Feature-Flag `antragAufbereitung` (**nur dev**). Paket 1 (v2.201.0) = Fundament + Zeitplan; Paket 2 (v2.202.0) = die ersten **LLM-Bausteine** (Steckbrief + Abdeckung) + ein deterministischer Kapazitäts-Befund.

**Leitprinzip: alles Deterministische bleibt deterministisch.** Substanz-Anteile, Prozente, Stammdaten und Prüf-Befunde rechnet der Code; das LLM liefert nur die **Zuordnung** (Sektion → Aspekt) und die **wortnah extrahierten** Kernaussagen — jede mit Sektions-IDs als Fundstelle. Kein LLM-Baustein darf den deterministischen Teil (Zeitplan) mitreißen: jeder Fehlerpfad degradiert.

## Verortung

Alles unter [src/plugins/antraege/aufbereitung/](../../src/plugins/antraege/aufbereitung/), analog zum Muster `gutachten/`. Reine Parser-/Ernte-/Ableitungs-Funktionen sind transport- und UI-frei (vitest ohne DOM).

| Datei | Verantwortung |
|---|---|
| [gliederung.ts](../../src/plugins/antraege/aufbereitung/gliederung.ts) | `parseVbGliederung(md)` → `VbSektion[]` (stabile IDs `k-3.1`/`s<i>`/`s-intro`/`s-toc`) |
| [tabellen.ts](../../src/plugins/antraege/aufbereitung/tabellen.ts) | Pipe-Parser, Klassifikation, Zeitplan-Normalisierung, `verglichZeitplaene`, **`pruefeKapazitaet`** |
| [quellen.ts](../../src/plugins/antraege/aufbereitung/quellen.ts) | VB (`resolveVb`) + Anlage 5 (`resolveAnlage5`) |
| [types.ts](../../src/plugins/antraege/aufbereitung/types.ts) | `QuelleRef`, `RunTabelle`, `AufbereitungRun` |
| [store.ts](../../src/plugins/antraege/aufbereitung/store.ts) | `baueRun` (pur), `computeAufbereitung`, `uebernehmeOffenePunkte`, `befundKey`, … |
| [bausteine.ts](../../src/plugins/antraege/aufbereitung/bausteine.ts) | Generischer LLM-Baustein-Rahmen `getOrComputeBaustein<T>` (Cache/Degradation), Cache-Keys, Dev-Gate |
| [aspekte.ts](../../src/plugins/antraege/aufbereitung/aspekte.ts) | `PRUEF_ASPEKTE`, Prompt, Parser + deterministische Ableitungen, `computeAspekteBaustein` |
| [steckbrief.ts](../../src/plugins/antraege/aufbereitung/steckbrief.ts) | `SteckbriefDaten`, Prompt, toleranter JSON-Parser, `computeSteckbriefBaustein` |
| [useAufbereitung.ts](../../src/plugins/antraege/aufbereitung/useAufbereitung.ts) | State/IO: Run laden, „Neu aufbereiten", Bausteine sequentiell fahren, Toggle, Veraltet-Check |
| [AufbereitungPage.tsx](../../src/plugins/antraege/aufbereitung/AufbereitungPage.tsx) | Route-Seite: Kopf + Tab-Leiste |
| [ZeitplanTab.tsx](../../src/plugins/antraege/aufbereitung/ZeitplanTab.tsx) | Gantt + Kennzahlen + Plausibilitäts-Sektion (typ-agnostisch) |
| [AbdeckungTab.tsx](../../src/plugins/antraege/aufbereitung/AbdeckungTab.tsx) | Prüfaspekte-Liste + „ohne Aspekt" + offene Punkte; Umschalter Liste\|Karte |
| [StrukturKarte.tsx](../../src/plugins/antraege/aufbereitung/StrukturKarte.tsx) | Horizontaler Baum (HTML-Knoten + SVG-Verbindungen), `baueLayout` |
| [SteckbriefTab.tsx](../../src/plugins/antraege/aufbereitung/SteckbriefTab.tsx) | Zwei-Spalten-Steckbrief (Karten links, Eckdaten/Zielmärkte/Personal rechts) |
| [FundstelleChip.tsx](../../src/plugins/antraege/aufbereitung/FundstelleChip.tsx) | `§ 3.1`-Chip + `FundstellePopover` (Auszug, kein Sprung — geteilt) |

Skill-Seeds: [aufbereitung-aspekte.seed.ts](../../src/core/services/skills/registry/aufbereitung-aspekte.seed.ts) + [aufbereitung-steckbrief.seed.ts](../../src/core/services/skills/registry/aufbereitung-steckbrief.seed.ts). Mini-Eval: [aufbereitung-eval.ts](../../src/core/services/skill-eval/aufbereitung-eval.ts) + Goldset [eval/eval-goldset-aspekte.json](../../eval/eval-goldset-aspekte.json).

## Datenmodell + Persistenz

Ein `AufbereitungRun` pro Antrag im IDB-`kv`-Store unter **`aufbereitung:<antragKey>`** (raw `idb.get`/`idb.set`, Muster [relevanz-map.ts](../../src/plugins/antraege/gutachten/relevanz-map.ts)) — **KEIN neuer Object-Store** (Pitfall #29). `antragKey` = `KurzfassungContext.key`. Quell-Hashes liegen IM Objekt; Hash via `hashText` aus [runner.ts](../../src/plugins/antraege/gutachten/runner.ts) (djb2, dieselbe Funktion wie Relevanz-Map). `AufbereitungRun`: `version`, `antragKey`, `erzeugtAm`, `quellen[]`, `gliederung`, `tabellen[]`, `zeitplan{…}|null`, `befunde[]`, `offenePunkte[]`, `hinweis?`.

**Getrennte Baustein-Caches** (NICHT im Run): `aufbereitung:<antragKey>:aspekte:<vbHash>` und `aufbereitung:<antragKey>:steckbrief:<vbHash>` (im selben `kv`-Store). Der deterministische Run und die LLM-Bausteine sind damit entkoppelt: „Neu aufbereiten" rechnet den deterministischen Run immer neu (LLM-Bausteine nur bei VB-Hash-Wechsel), der dev-Button „KI-Bausteine neu berechnen" löscht beide Baustein-Caches (`loescheBausteinCaches`) und rechnet sie mit `force` neu.

**`offenePunkte`-Erhalt:** `computeAufbereitung` lädt den Vorlauf und übernimmt seine `offenePunkte` in den frisch berechneten Run (`uebernehmeOffenePunkte`) — behalten wird ein Key, wenn er einem aktuellen `befundKey` entspricht ODER mit `aspekt-fehlt:` beginnt (LLM-Kandidaten, gegen den Baustein beim Rendern validiert); verwaiste Keys werden verworfen. **Ohne diesen Schritt würde „Neu aufbereiten" die Nutzer-Markierungen löschen.**

## Zeitplan: Ernte + Normalisierung + Abgleich + Kapazität

`ApZeile{nummer, bezeichnung, istUnterAp, monatStart?, monatEnde?, pm?, maNr?}`. `normalisiereAnlage5` ist eine **1:1-Abbildung ohne Dedup** — Doppelbesetzung (gleiche AP-Nr, verschiedene MA) überlebt als getrennte Zeilen (Grundlage der Kapazitäts-Prüfung).

- `verglichZeitplaene(text, anlage)` matcht Ober-APs über normalisierte Bezeichnung → Befunde `zeitraum-abweichung` (Warnung), `nur-im-text`/`nur-in-anlage`/`horizont` (Hinweis).
- **`pruefeKapazitaet(zeilen)`** bündelt die anteiligen Personenmonate je (`maNr`, Kalendermonat): PM eines Eintrags gleichmäßig über seine Monatsspanne verteilt (Einzelmonat/Halbmonat zählt voll), **verschiedene MAs werden NIE zusammengezählt**. Summe > `KAPAZITAET_GRENZE_PM` (**1,2** PM/Monat = 1 PM Vollauslastung + 20 % Rundungs-Toleranz, Default) → Befund `kapazitaet` (Warnung) mit MA, Monat, Summe und beteiligten APs. In `baueRun` unabhängig vom Text-Vergleich eingehängt.

Die Plausibilitäts-Liste im Zeitplan-Tab rendert **typ-agnostisch** (Farbe nur aus `schwere`) → der `kapazitaet`-Befund erscheint ohne UI-Änderung.

## LLM-Bausteine (Cache/Degradation/DSGVO)

Beide Bausteine folgen dem **Relevanz-Map-Muster** (`gutachten/relevanz-map.ts`): auswählen + referenzieren statt frei formulieren, EIN interner Lauf, per VB-Hash gecacht. Der generische Rahmen `getOrComputeBaustein<T>` ([bausteine.ts](../../src/plugins/antraege/aufbereitung/bausteine.ts)):

- **Cache-Hit** nur bei passendem VB-Hash → `{status:'ok', daten}`.
- **Miss** → EIN Lauf (`runBaustein`: `submitConversation`, Fallback `submitMessage`) → `parse(raw)`. Non-null → cachen + `ok`. Null (unparsebar/leer) → `{status:'degradiert', rohtext}` (NICHT cachen). Transport-/Lauf-Fehler → `{status:'fehler'}`. **Wirft nie.** `force` überspringt den Cache-Read.

**DSGVO (Pitfall #30):** Beide Läufe tragen VB-Volltext. Die Transport-Policy leitet „intern-pflichtig" aus dem **Template-Text** ab (`skillEnthaeltDokumentInhalte` scannt `promptTemplate` literal nach `{{vbMarkdown}}`, NICHT das `slots`-Array) → die Seed-Records tragen `{{vbMarkdown}}` im Template; `enthaeltDokumentInhalte:true` ist redundant belegt. Der Transport kommt ausschließlich über `bridge.getTransportForSkillRun(skill)` (wirft bei externem Provider). Kein OpenRouter — auch nicht für die Eval aus der UI.

**Skill-Seeds `aktiv:false`:** Die geteilte `registry.json` ist über alle Build-Varianten sichtbar; ein noch nicht per Eval abgesicherter Skill startet gesperrt (Konvention: [types.ts](../../src/core/services/skills/registry/types.ts) `aktiv?`-Kommentar). Die Aufrufstelle läuft in dev über den Runtime-Override `istAufbereitungBausteinFreigeschaltet(skill, isDevContext())` (Muster `istAnonymisiererFreigeschaltet`); die Seite selbst ist ohnehin `antragAufbereitung`-gated (nur dev). Der `PRUEF_ASPEKTE`-Katalog ist bewusst eine **Code-Konstante** (Domänen-Wissen der Prüfung, nicht kuratierbarer Skill-Inhalt) — nicht in der Registry.

Die Bausteine laufen **sequentiell** (Aspekte → Steckbrief), weil der interne Transport (Streamlit-Bridge) ein einzelnes postMessage-Fenster ist ([useAufbereitung.ts](../../src/plugins/antraege/aufbereitung/useAufbereitung.ts) `laufBausteine`).

## Aspekt-Mapping (Abdeckung)

`buildAspektePrompt` gibt die nummerierte Sektionsliste (ohne `s-toc`) + den Katalog A–J + die volle VB aus; das Modell antwortet im gpt-oss-erprobten Zeilenformat (Block 1 `A: k-1, k-2`, Block 2 `A-fehlt: …`). `parseAspektMapping` liest das tolerant (unbekannte Sektions-IDs verworfen, unbekannte Buchstaben ignoriert, `I/J`-Doppelbuchstabe, Bullets). Deterministische Ableitungen:

- **Substanz** (`berechneSubstanz`): Anteil = Zeichen der einem Aspekt zugeordneten Sektionen ÷ Gesamtzeichen (ohne `s-toc`). „dünn" (`SUBSTANZ_DUENN_*`): Anteil < **3 %** ODER < **1200** Zeichen — nur wenn der Aspekt überhaupt Fundstellen hat (Aspekte ganz ohne Fundstelle sind ein eigener Zustand).
- **Invertierung** `sektionZuAspekte` (Sektion → Aspekte) für die Karten-Badges.
- **`ermittleOhneAspekt`**: Ebene-1-Sektionen, die weder selbst noch über eine nummern-verwandte Unter-Sektion zugeordnet sind (`s-intro`/`s-toc` aus) → „NICHT IM PRÜFRASTER".
- **`fehlendeAlsKandidaten`**: stabile Keys `aspekt-fehlt:<aspekt>:<slug(text)>` → speisen die bestehende `offenePunkte`-Mechanik.

**Struktur-Map** (`StrukturKarte`, `baueLayout`): horizontaler Baum, Wurzel links, Ebene-1 vertikal; ausgeklappt werden die **zwei prominentesten** Kapitel — sortiert nach (Kinderzahl desc, trägt-Aspekt desc, Dokumentreihenfolge). Der Aspekt-Tiebreak hält bei Gleichstand inhaltlich relevante Kapitel vor „ohne Aspekt"-Kapiteln (deterministisch, KEIN Hardcode auf Kapitelnummern). HTML-Knoten (Hover + dasselbe `FundstellePopover`, kein Sprung) über einer SVG-Verbindungs-Ebene.

## Steckbrief

`SteckbriefDaten` (einSatz, innovation[], fueGegenstand[], laufzeit, kernZielwert, zielmaerkte[], personal[], auftraegeDritte[]) — jedes Feld/Element mit `sektionIds`. **Hybrid:** Stammdaten (Antragsteller, FKZ, Projektform) kommen deterministisch aus dem Store; das LLM liefert nur die VB-abgeleiteten Felder. `buildSteckbriefPrompt` fordert einen JSON-Codeblock; `parseSteckbrief` liest den **letzten** JSON-Codeblock marker-tolerant (`extractLastJsonObject`: Fence → letztes balanciertes `{…}` → Brace-Walker/Truncation), feld-tolerant, Sektions-IDs gegen die Gliederung validiert (unbekannte verworfen, Aussage behalten). Kaputtes JSON → `null` = Degradation (Rohtext-Anzeige). Leere LLM-Felder zeigt das Tab als „[Im Antrag nicht gefunden]" (die Lücke ist Information).

## Mini-Eval + Baseline + Aktivierungs-Gate

`npm run eval:aufbereitung` ([aufbereitung-eval.ts](../../src/core/services/skill-eval/aufbereitung-eval.ts), vite-node) misst Precision/Recall der Sektion→Aspekt-Zuordnung gegen ein handkuratiertes **partielles** Goldset ([eval/eval-goldset-aspekte.json](../../eval/eval-goldset-aspekte.json), 3 fiktive Fixtures; Metrik nur über annotierte Sektionen). Modi: `--dump` (Gliederung ausgeben, Goldset-Authoring), `--dry-run` (Stub-Transport = Harness-Selbsttest), live (interner `NodeOpenAITransport` — **nie** OpenRouter; die Fixtures sind fiktiv, der Lauf spiegelt aber den Prod-Pfad).

**Baseline (Stand Paket 2):** Dry-Run/Harness-Selbsttest P=R=F1=1,000 über 3 Fixtures — verifiziert Prompt→Parse→Invert→Metrik. Eine **echte Live-Baseline** über den internen LLM steht aus (Umgebung ohne erreichbaren internen Endpoint). **Regel:** Eine Aktivierung der Bausteine jenseits dev (`aktiv:true`) setzt eine bestandene Live-Eval voraus — analog zum Recall-Gate des Anfragen-Anonymisierers.

## Route + Einstieg

Route `/antraege/:aktenzeichen/aufbereitung` als flag-gated **Child** unter `ShellLayout` ([Router.tsx](../../src/core/Router.tsx)). Kontext aus dem Route-Key über `useVerbundDetailData` + `buildKurzfassungContext` (deep-link-/refresh-fest). Einstieg: flag-gated Button „Antrag-Aufbereitung öffnen" auf [VerbundDetail.tsx](../../src/plugins/antraege/VerbundDetail.tsx).

## Ausblick Paket 3

Silhouette-Ansicht + Schwimmbahnen der Karte, **Risiko-Punkte** an den 3.x-Knoten (technische Risiken je Lösungsweg-Abschnitt), Zahlen-Inventar, Recherche-/Glossar-Tabs. Die Karten-/Popover-Infrastruktur (`FundstellePopover`, `baueLayout`, Baustein-Rahmen) ist darauf ausgelegt, additiv erweitert zu werden.
