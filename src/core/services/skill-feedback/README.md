# skill-feedback — File-first Feedback-/Telemetrie-/Reifegrad-Substrat (S1)

Reine Datenschicht für die sozialen Skill-Signale — **ohne Backend**, kollisionsarm
auf der SMB-Share. Fundament für **S2** (Verwaltung/Kurator-UI) und **S3** (Anwendung/
👍👎-Buttons + „meistgenutzt"-Ranking), die dieses Substrat konsumieren. S1 selbst
enthält **kein UI** und verdrahtet **keine** Emission in den Skill-Run-Pfad — es stellt
nur die Funktionen bereit (`appendUsage`/`appendFeedback`/`readAggregate`/
`suggestReifegrad`/`exportFeedback`).

## Was hier liegt

| Datei | Inhalt |
|-------|--------|
| `types.ts` | `FeedbackEvent`, `UsageEvent`, `Rating`, `MAX_NOTIZ_LENGTH`, Re-Export `Reifegrad` |
| `guard.ts` | DSGVO-Inhalts-Guard (`sanitizeEvent`/`sanitizeFeedbackEvent`/`sanitizeUsageEvent`) |
| `identity.ts` | `getUserId` (rein), `resolveInstallId` (per-Installation-ID im `kv`) |
| `layout.ts` | Pfad-Helfer (gemeinsam + persönlich), `SignalKind` |
| `write.ts` | `appendFeedback`/`appendUsage` (Guard → JSONL-Append → Cache-Invalidierung) |
| `read.ts` | `readAggregate` (Cache), `collectAllEvents`, `collectPersonalEvents`, `parseJsonlEvents` |
| `aggregate.ts` | `aggregate` (rein) → `SkillAggregat` je Skill |
| `maturity.ts` | `suggestReifegrad` (beratend) |
| `cache.ts` | Aggregat-Cache-Key + `invalidateAggregateCache` (kv-Store) |
| `export.ts` | `exportFeedback` (Degradations-Bündel zum Kurator-Merge) |

Der Reifegrad selbst ist **kuratierte Entscheidung** und lebt am `SkillRecord`
(`reifegrad?`, Default `'entwurf'`) in der Skill-Registry — **nicht** in den
Signal-Dateien. `suggestReifegrad` liefert dazu nur einen **Vorschlag**; das Setzen
bleibt ein Kurator-Registry-Write (S2).

## Verzeichnis-Layout

Pro-Nutzer-JSONL — **jeder Nutzer schreibt NUR seine eigene Datei**. Das ist die
tragende Eigenschaft: `appendToFile` ist ein Read-modify-write der ganzen Datei und
nur kollisionssicher, wenn keine zwei Schreiber auf dieselbe Datei treffen. Es gibt
**keinen** gemeinsamen mutierbaren Zähler.

```
# Gemeinsam (Daten-Share-Root) — das team-weite Aggregat
_intern/skills/feedback/<userId>.jsonl
_intern/skills/usage/<userId>.jsonl

# Persönlicher Fallback (Persoenlich-Handle) — Degradationspfad
ZAH/skills/feedback/<userId>.jsonl
ZAH/skills/usage/<userId>.jsonl
ZAH/skills/export/skill-feedback-export.json   # Bündel zum manuellen Kurator-Merge
```

`<userId>` = bestehendes Kürzel (`useMeinKuerzel()`, von S2/S3 injiziert) oder, wenn
keins vorliegt, eine stabile per-Installation-ID (`resolveInstallId`). Kein hartes
Auth — Honor-System für 5–30 vertraute Nutzer.

## Schreibbarkeits-Annahme & Degradation

Schreibziel wird über die **Handle-Permission** erkannt, nicht über React-State:
`getDatenShareHandle` → `queryPermission === 'granted'`. Rollen mit readwrite
(Kurator/PL/dev) schreiben ins gemeinsame Verzeichnis; **Prod-End-User haben den Share
read-only** (v2.0-Hardening) → für sie ist der persönliche Fallback der Normalfall.
Ist das gemeinsame Verzeichnis nicht beschreibbar (oder ein Write schlägt fehl),
schreibt die Schicht in die persönliche Ablage — **nie ein Throw** (Telemetrie darf
keine UI-Aktion kippen). Der Kurator führt die persönlichen Bündel (`exportFeedback`)
später manuell in die Share-Aggregation zurück.

## DSGVO-Inhalts-Guard (hart)

Ein Event enthält **ausschließlich** `skillId`, `skillVersion`, `rating`/`event`,
optionale **kurze** `notiz` (≤ 140 Zeichen, qualitativ), `ts`, `userId`. Der Guard baut
das Ergebnis per **Whitelist-Konstruktion** neu auf (nie `...raw`), kürzt die Notiz und
verwirft alles andere — strukturell unmöglich, dass generierter Abschnittstext,
VB-Inhalt, FKZ, Aktenzeichen o.ä. in die (ggf. team-weit lesbaren) Dateien gelangen.
Der Guard greift beim **Schreiben** und erneut beim **Lesen** (Defense-in-Depth).

## Aggregation & Cache

`readAggregate` vereinigt alle Nutzer-Dateien (gemeinsam + persönlich), parst JSONL
(defekte/verbotene Zeilen werden übersprungen) und faltet sie zu
`skillId → { nutzung, up, down, letzteNutzung, kommentare }`. Das Ergebnis wird im
generischen IDB-`kv`-Store gecacht (Pitfall #29 — **kein** eigener Object-Store, kein
Versions-Bump). Invalidierung über `invalidateAggregateCache`:

- nach **jedem Write** (`write.ts`),
- beim **Daten-Sync** (`runDataUpdate` in `csv-sources-kuration/services/data-update.ts`)
  → nach dem Share-Sync können neue Signal-Dateien anderer Nutzer vorliegen.

So gibt es **keinen** synchronen Vollscan bei jedem Render — nur ein Recompute beim
nächsten Lesen nach einer Invalidierung.

## Anti-Patterns (bewusst vermieden)

- Gemeinsamer mutierbarer Zähler / eine geteilte Datei für alle → **Pro-Nutzer-Append**.
- Antragsbezug in Events → **DSGVO-Guard** erzwingt die Whitelist.
- Reifegrad automatisch setzen → nur Kurator setzt; `suggestReifegrad` ist **beratend**.
- Neuer IDB-Object-Store → Aggregat im **`kv`** gecacht.
- Synchroner Vollscan bei jedem Render → **Cache** + Invalidierung beim Sync.
