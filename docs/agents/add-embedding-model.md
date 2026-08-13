# Neues Embedding-Modell hinzufügen

Embedding-Modelle werden zentral in einer Registry geführt; das aktive Modell prägt sowohl den lokalen Suchindex als auch den team-weiten Auslastungs-Stage-2-Korpus (siehe CLAUDE.md Pitfall #19). Ein Modell-Wechsel ist ein team-weiter Bruch — beim **Hinzufügen** eines neuen Modells gilt aber: das aktive Modell bleibt vorerst gleich, neue Modelle sind nur in der Auswahlliste sichtbar.

> **Stand seit v4.14.0**: `EMBEDDING_MODELS` führt **genau einen** Eintrag (EmbeddingGemma 300M), mit dem der gesamte Bestand gebaut ist. Das Kurator-UI zeigt bei einem einzigen Modell deshalb eine **Angabe statt eines Dropdowns** — ein Aufklapper mit einer Zeile sieht nach Wahl aus und ist keine. Wer ein Modell ergänzt, bekommt das Dropdown automatisch zurück (Abschnitt „Kurator-UI").

## Touch-Points (Pflicht)

1. **Registry-Eintrag** in [src/core/services/search/model-registry.ts](../../src/core/services/search/model-registry.ts):
   ```ts
   {
     id: 'mein-modell',          // stabile ID — wird in IDB als activeModelId persistiert
     name: 'org/model-name-ONNX', // HuggingFace-Repo (ONNX-Format Pflicht)
     label: 'Mein Modell (q8)',
     dimensions: 768,
     sizeLabel: '300M',
     downloadSize: '~200 MB (q8)',
     strategy: 'automodel',       // 'pipeline' für einfache, 'automodel' für custom-pooling
     dtype: 'q8',
     pooling: 'mean',             // 'mean' | 'cls' | 'last-token'
     normalize: true,
     queryPrefix: '…',            // modellspezifisch, oft mit "task: …" oder "Instruct: …"
     documentPrefix: '…',
     description: 'Kurze Beschreibung (rendert im Select-Dropdown des Kurator-UI).',
   }
   ```
   Bei Matryoshka-Modellen zusätzlich `matryoshka: [768, 512, ...]` setzen.

2. **Modell-Test** — vor dem Eintragen lokal validieren:
   - HF-Repo muss ONNX-Files in `onnx/` haben, dtype-Suffix muss zu `dtype` passen (`model_q8.onnx` etc.).
   - In Browser/WebGPU + WASM testen (CLAUDE.md Pitfall #8 — läuft Main-Thread).
   - Tokenizer muss bundle-bar sein (sonst Lade-Error im Single-File-Build).

## Optional, je nach Use-Case

- **Kurator-UI** [src/plugins/kurator/actions/ActionCardModels.tsx](../../src/plugins/kurator/actions/ActionCardModels.tsx): rendert `EMBEDDING_MODELS` als Select, sobald **mehr als ein** Modell geführt wird (bei genau einem steht dort nur dessen Label). Kein Code-Change nötig wenn ein Eintrag dazukommt — das Dropdown samt Wechsel-Dialog erscheint automatisch. Wenn das neue Modell besondere Hinweise braucht (z.B. "GPU empfohlen"), eigene `<p>`-Zeile im JSX bei Auswahl ergänzen.

- **Bestätigungs-Dialog** ([ConfirmModelSwitch oder analog]): wenn das neue Modell strukturell von bisherigen abweicht (z.B. andere Dimension, anderes Pooling), den Warntext aktualisieren — Pitfall #19 listet die drei Konsequenzen (Suchindex + Auslastungs-Korpus + Kategorie-Centroids). Bei gleicher Dimension nur "lokaler Suchindex neu bauen" nötig.

- **Auslastungs-Stage-2-Korpus**: wird automatisch bei nächstem Build neu erzeugt wenn `useActiveModelId()` sich ändert — kein expliziter Reset nötig. Der `.bin`-Spiegel auf SMB enthält die Modell-ID im Manifest, mismatching Clients laden automatisch neu (CLAUDE.md Pitfall #19).

## Modell entfernen

Mit v4.14.0 einmal durchgespielt (MiniLM + beide Harrier raus). Was ein entferntes Modell auffängt:

- **Aktive Wahl**: `getActiveModelId()` prüft den persistierten Wert gegen die Liste und fällt sonst auf `DEFAULT_MODEL_ID` — der Nutzer landet stillschweigend beim geführten Modell. `getModelById()` fällt zusätzlich auf den ersten Eintrag zurück.
- **Bestehender Index**: `BatchIndexer.indexAll` vergleicht `index-model-id` mit dem aktiven Modell, verwirft bei Abweichung `orama-db` + Manifest und baut neu — die Dimensions-Inkompatibilität kommt also gar nicht erst zum Tragen. Der Kurator-Bereich meldet den Zustand vorher als „Modell gewechselt".
- **Korpus vom Share**: `checkCompat` liefert `modell-mismatch` (Test in [embedding-corpus-mirror.test.ts](../../src/plugins/auslastung/__tests__/embedding-corpus-mirror.test.ts)).
- **Index vom Share**: [index-persistence.ts](../../src/core/services/search/index-persistence.ts) sucht die Modell-Id **ohne Raten** in der Registry; eine unbekannte Id lässt die Dimensions-Angabe ungeschrieben, statt eine falsche zu setzen.

Zu prüfen bleibt eine harte Stelle: **Startwerte im UI dürfen keine Modell-Id nennen**, sondern `DEFAULT_MODEL_ID` (siehe `IndexManager.tsx` — dort stand bis v4.14.0 eine feste Id und ließ die Ampel für einen Wimpernschlag „Modell gewechselt" melden). `grep -rn "'<entfernte-id>'" src` vor dem Commit.

## Verifikation

- `npm run typecheck` grün.
- `npm run build:devpl` — der Build darf nicht durch ungültige Modell-Configs brechen (keine harten Asserts, aber `getActiveModelId` fällt sonst auf DEFAULT).
- Manueller Smoke: dev-Build öffnen, Kuration → Suchindex → Modell-Dropdown — neuer Eintrag sichtbar, Beschreibung wird im UI gerendert.
- Wenn das Modell aktiviert werden soll: Kurator-UI Modell-Wechsel-Dialog testen (zeigt die drei Konsequenzen), dann Index neu bauen.

---

## CLAUDE.md-Pitfalls (Detail)

### Pitfall #19 — Embedding-Modell-Wechsel ist team-weiter Bruch

Wenn ein Kurator das Embedding-Modell via [ActionCardModels.tsx](../../src/plugins/kurator/actions/ActionCardModels.tsx) wechselt, werden ALLE bestehenden Embedding-Caches strukturell inkompatibel: der lokale Suchindex muss neu gebaut werden, der gespiegelte Auslastungs-Stage-2-Korpus auf SMB (`_intern/auslastung-embedding-corpus.bin`) ist für alle anderen Teammitglieder unbrauchbar bis er von einem PL mit dem neuen Modell neu gebaut wird (~46 min), und die Kategorie-Centroids in `auslastung.json` sind falsch dimensioniert. Die UI zeigt vor dem Wechsel einen Confirm-Dialog mit allen drei Konsequenzen — Wechsel nicht leichtfertig durchführen. Das *Hinzufügen* eines Modells (ohne Aktivierung) ist in den Abschnitten oben beschrieben.
