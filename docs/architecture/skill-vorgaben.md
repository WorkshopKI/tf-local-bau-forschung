# Skill-Vorgaben & persönliche Ebene

Wo der Umfangs-/Form-Kontrakt eines Skills lebt, wie er zur Laufzeit wirkt und wie
ein Nutzer ihn für sich verschieben darf, ohne die Kurator-Vorgaben aufzuheben.

## Warum

Bis v2.295 war jede Umfangsvorgabe ein eigener `QualitaetsRegel`-Record in der
geteilten Bibliothek: `seed-satzanzahl`, `seed-b-wortanzahl`, `seed-c-umfang`,
`seed-d-wortanzahl` … Ein solcher Record trug **zwei Ebenen gleichzeitig** — die
Art der Prüfung (Satzanzahl) und den nur für einen einzigen Skill gültigen Wert
(8–12). Folge: 25 Regeln, davon 16 Ein-Skill-Parametrisierungen und 8 Waisen aus
früheren Seed-Ständen. Wiederverwendbar war fast keine davon; die Liste war für
Kuratoren nicht mehr lesbar.

Seit v2.296 gilt die Trennung:

| Ebene | Was | Wo | Wer ändert |
|---|---|---|---|
| **Skill-Vorgabe** | Umfang & Form eines Skills (Wörter, Sätze, Zeichen, Absätze, Satzlänge, keine Aufzählungen, Pflicht-Anfang) | `SkillRecord.vorgaben` in `registry.json` | Kurator/PL — gilt für alle |
| **Bibliotheks-Regel** | mehrfach genutzte Regeln (verbotene Muster, LLM-QS, administrative Checks) | `SkillRegistryFile.regeln` | Kurator/PL — gilt für alle |
| **Persönliche Ebene** | verschobene Zahlen + Stil-Hinweise | `SkillTweak` (IDB + `ZAH/skill-tweaks.json`) | jeder Nutzer — gilt nur für ihn |

## Laufzeit: EIN Trichter

[`resolveRegeln`](../../src/core/services/skills/registry/selectors.ts) ist die
einzige Stelle, an der aus Skill + Registry eine Regelliste wird. Sie liefert:

```
[ …vorgabenZuRegeln(skill)  ,  …skill.regelIds aufgelöst ]
```

Die Vorgaben werden dabei als **synthetische `QualitaetsRegel`-Records** mit den
bekannten `typ`-Werten materialisiert ([vorgaben.ts](../../src/core/services/skills/registry/vorgaben.ts)),
IDs `vorgabe:<skillId>:<typ>`. Dadurch bleiben Check-Engine, `buildPromptVorgaben`,
`effektiveKategorie`, Judge, Eval, Batch und der Gutachten-Workflow **unverändert** —
sie sehen weiterhin nur `QualitaetsRegel[]`.

**Die Reihenfolge ist Prompt-Text.** Sie bestimmt die Zeilenfolge im Block
`## Formale Vorgaben`. Vorgaben stehen VOR den Bibliotheks-Regeln, innerhalb der
Vorgaben gilt `VORGABE_KEYS`. Beides ist per Test festgeschrieben
(`vorgaben.test.ts`, `registry.test.ts`) — nicht beiläufig umsortieren.

## Persönliche Ebene

`SkillTweak.vorgabenOverride` trägt **nur Zahlen**. Schweregrade, Struktur-Vorgaben
(keine Aufzählungen, Pflicht-Anfang) und die Freigabe selbst bleiben Kurator-Sache.

Drei harte Regeln, alle in der reinen `wendeOverrideAn`:

1. Ein Wert wird nur übernommen, wenn die Team-Vorgabe existiert **und**
   `persoenlichAnpassbar` trägt. Der Kurator gibt frei, nicht der Nutzer.
2. Ein Override kann eine Vorgabe **verschieben, nie abschalten**.
3. Der Schweregrad bleibt in jedem Fall der Team-Stand.

Der Override wird beim Lesen UND beim Schreiben strukturell gesäubert
(`sanitizeOverride`, tweaks/store.ts) — die Datei liegt im Nutzer-Ordner und ist
handeditierbar; nichts Fremdes darf in die Regel-`params` sickern.

**Prompt und Check ziehen dieselbe Liste.** Die drei Lauf-Pfade, die den Tweak
ohnehin laden, reichen ihn über `regelnMitOverride` durch:
[useKurzfassung](../../src/plugins/antraege/kurzfassung/useKurzfassung.ts),
[useGutachtenWorkflow](../../src/plugins/antraege/gutachten/useGutachtenWorkflow.ts),
[useBatchJob](../../src/plugins/antraege/gutachten-batch/useBatchJob.ts). Ohne das
bekäme der Nutzer einen Fehler für die Länge, die er selbst gewählt hat.
**Eval und Judge bekommen bewusst KEINEN Override** — sie messen den Team-Stand.

## Herkunft — warum es diese Zahl gibt (v6.26)

Eine Vorgabe sagte bis dahin, WAS gilt, aber nie WARUM. Gemessen am Zeichenlimit der
Kurzfassung: es stammt aus einem **fremden Formularfeld** der Fachprüfung, das 1.200
Zeichen fasst — das stand nirgends. Deshalb stand es gleichrangig neben der
hausgemachten Satzzahl 9–11, die ihm rechnerisch widerspricht (9–11 Sätze à ≤ 25
Wörter ≈ 1.500 Zeichen, siehe „Widersprüchliche Umfangs-Vorgaben" in
[gutachten-kurzfassung.md](gutachten-kurzfassung.md)). **Eine Regel, die ihren Grund
nicht kennt, kann niemand fallen lassen** — und genau deshalb wurde der Widerspruch
seinerzeit durch einen Vorrang-Satz überdeckt statt durch Entfernen der schwächeren
Vorgabe aufgelöst.

`VorgabeBasis.herkunft` und `QualitaetsRegel.herkunft` tragen dafür je einen Satz.
Vier Eigenschaften, die zusammengehören:

1. **Er geht NICHT in den Prompt.** Das Modell braucht die Zahl, nicht ihre
   Geschichte. Gezeigt wird er im Kurator-Editor und an der Prüfung.
2. **Er reist bis ans `CheckResult`.** `runRegelChecks` stempelt ihn — aus demselben
   Grund wie `kategorie`: die Check-Liste sieht nur `CheckResult[]` und käme sonst nie
   an den Skill heran. Nebenwirkung: er wird mit `StepRun.checks` persistiert, ein
   Alt-Run trägt ihn also nicht (dieselbe Eigenschaft wie `kategorie`).
3. **Drei Stationen bauen feldweise neu** und hätten ihn je einzeln verloren:
   `normalizeVorgaben` (`basis()`), `vorgabenZuRegeln` und `runRegelChecks`. Alle drei
   sind einzeln getestet ([herkunft.test.ts](../../src/core/services/skills/registry/__tests__/herkunft.test.ts));
   jeder Zweig wurde einmal ROT gesehen.
4. **Leer heißt kein Feld** — ein weißer String wird beim Laden verworfen, damit die
   Registry-Daten nicht mit leeren Schlüsseln wachsen.

Erster gepflegter Fall: das Zeichenlimit von A steht auf **1.100** („900 ± 200",
hundert Zeichen Luft zum harten Rand) und nennt das Formularfeld. Rollout über
`ga-a-zeichen-herkunft-2026-08`; **Wert und Grund sind unabhängig geschützt** — ein
selbst verschobener Wert bleibt stehen und bekommt trotzdem seinen Grund, ein selbst
geschriebener Grund wird nie überschrieben.

## UI

- Kurator: Sektion „Umfang & Form" im Skill-Editor
  ([VorgabenEditor.tsx](../../src/plugins/skill-verwaltung-kuration/VorgabenEditor.tsx),
  `modus: 'team'`) — An/Aus-Pille je Vorgabe, Zahlenfelder, Fehler/Hinweis,
  Häkchen „persönlich anpassbar".
- Nutzer: Umschalter „Team | Persönlich" in der Detail-Kopfzeile →
  [PersoenlichePanel.tsx](../../src/plugins/skill-verwaltung-kuration/PersoenlichePanel.tsx).
  Gesperrte Vorgaben erscheinen mit Schloss und Team-Wert.
- Die Regel-Bibliothek kann nur noch `verbotenes_muster` neu anlegen (`ADD_TYPEN`).
  Die Umfangs-/Form-Typen bleiben in `TYP_LABEL` — sie beschriften Bestandsdaten.

## Bestandsdaten

Die einmalige, marker-gesicherte Migration `SKILL_VORGABEN_MIGRATION`
([migrations.ts](../../src/core/services/skills/registry/migrations.ts)) überführt
Ein-Skill-Regeln in `skill.vorgaben` und löscht danach unreferenzierte Records
dieser Typen (samt der Alt-Waisen). Drei Schutzregeln:

1. Von **mehreren** Skills genutzte Regeln bleiben Bibliotheks-Regeln.
2. **Inaktive** Regeln werden nicht überführt (sie wirkten nie) — Zuordnung bleibt.
3. Eine bereits gesetzte Vorgabe wird **nicht überschrieben**.

QS-/NF-Regeln tragen keinen der migrierenden Typen und sind unberührt. Die
Migration ist idempotent; ausgeführt wird sie vom bestehenden Shell-Hook
`useAnfrageAnonAktivierung` (nur schreibberechtigte Clients, Audit-Log).

`normalizeSkill` (storage.ts) trägt `vorgaben` **explizit** durch — ohne diese
Zeile verlöre ein Skill beim Laden seinen gesamten Umfangs-Kontrakt (gleiche
Klasse wie `kategorie`/`teilStruktur`/`aktiv`).

## Abnahme-Kriterien (`qsKriterien`, v2.336)

Neben „Umfang & Form" (was der Skill produzieren SOLL) trägt ein Skill optional
**prüfbare Abnahme-Kriterien** — woran ein Mensch erkennt, ob das Ergebnis taugt
(„Aussagen durch den Antrag belegt", „Risiken auf den Lösungsweg bezogen, nicht
allgemein"). Sie sind bewusst getrennt von `vorgaben`: Vorgaben sind
deterministisch messbar und gehen als „Formale Vorgaben" in den Prompt, Kriterien
sind qualitativ und steuern die **beratende LLM-QS**.

- Gepflegt im Skill-Editor (eine Zeile = ein Kriterium), nie über einen Seed
  (Kuration ist Menschen-Arbeit, und ein Seed-Write wäre prod-wirksam).
- Knopf „Kriterien aus Prompt ableiten" liefert nur **Vorschläge** über einen
  einmaligen internen Lauf
  ([qsKriterienAbleitung.ts](../../src/plugins/skill-verwaltung-kuration/qsKriterienAbleitung.ts));
  gespeichert wird erst mit der nächsten Skill-Version.
- Wie `vorgaben` trägt `normalizeSkill` sie **explizit** durch — und zwar VOR der
  `historie`-Zeile, weil der Baseline-Snapshot aus dem gerade gebauten Record
  entsteht. Snapshot, Diff und Rollback führen sie mit; ein Rollback holt die
  Kriterien des Snapshots zurück, sonst liefe der Skill mit einer Kombination, die
  es nie gab.
- Wirkung + Satz-Referenzen: siehe
  [gutachten-kurzfassung.md](gutachten-kurzfassung.md) („Abnahme-Kriterien am Skill").
