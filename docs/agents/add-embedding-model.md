# Neues Embedding-Modell hinzufügen

Embedding-Modelle werden zentral in einer Registry geführt; das aktive Modell prägt sowohl den lokalen Suchindex als auch den team-weiten Auslastungs-Stage-2-Korpus (siehe CLAUDE.md Pitfall #19). Ein Modell-Wechsel ist ein team-weiter Bruch — beim **Hinzufügen** eines neuen Modells gilt aber: das aktive Modell bleibt vorerst gleich, neue Modelle sind nur in der Auswahlliste sichtbar.

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

- **Kurator-UI** [src/plugins/kurator/actions/ActionCardModels.tsx](../../src/plugins/kurator/actions/ActionCardModels.tsx): rendert `EMBEDDING_MODELS` als Select. Kein Code-Change nötig wenn nur ein Eintrag dazukommt — neue Modelle erscheinen automatisch. Wenn das neue Modell besondere Hinweise braucht (z.B. "GPU empfohlen"), eigene `<p>`-Zeile im JSX bei Auswahl ergänzen.

- **Bestätigungs-Dialog** ([ConfirmModelSwitch oder analog]): wenn das neue Modell strukturell von bisherigen abweicht (z.B. andere Dimension, anderes Pooling), den Warntext aktualisieren — Pitfall #19 listet die drei Konsequenzen (Suchindex + Auslastungs-Korpus + Kategorie-Centroids). Bei gleicher Dimension nur "lokaler Suchindex neu bauen" nötig.

- **Auslastungs-Stage-2-Korpus**: wird automatisch bei nächstem Build neu erzeugt wenn `useActiveModelId()` sich ändert — kein expliziter Reset nötig. Der `.bin`-Spiegel auf SMB enthält die Modell-ID im Manifest, mismatching Clients laden automatisch neu (CLAUDE.md Pitfall #19).

## Modell entfernen

Wenn ein Modell aus `EMBEDDING_MODELS` gelöscht werden soll, aber Nutzer es bereits aktiv haben: `getModelById()` returnt automatisch das erste Modell (Fallback) — ungiftig. Aber bestehende IDB-Caches passen dann ggf. nicht mehr zur Dimension. Sicherer: Modell drinlassen, optional `deprecated: true`-Flag einführen (heute nicht im Schema).

## Verifikation

- `npm run typecheck` grün.
- `npm run build:devprod` — der Build darf nicht durch ungültige Modell-Configs brechen (keine harten Asserts, aber `getActiveModelId` fällt sonst auf DEFAULT).
- Manueller Smoke: dev-Build öffnen, Kuration → Suchindex → Modell-Dropdown — neuer Eintrag sichtbar, Beschreibung wird im UI gerendert.
- Wenn das Modell aktiviert werden soll: Kurator-UI Modell-Wechsel-Dialog testen (zeigt die drei Konsequenzen), dann Index neu bauen.

---

## CLAUDE.md-Pitfalls (Detail)

### Pitfall #19 — Embedding-Modell-Wechsel ist team-weiter Bruch

Wenn ein Kurator das Embedding-Modell via [ActionCardModels.tsx](../../src/plugins/kurator/actions/ActionCardModels.tsx) wechselt, werden ALLE bestehenden Embedding-Caches strukturell inkompatibel: der lokale Suchindex muss neu gebaut werden, der gespiegelte Auslastungs-Stage-2-Korpus auf SMB (`_intern/auslastung-embedding-corpus.bin`) ist für alle anderen Teammitglieder unbrauchbar bis er von einem PL mit dem neuen Modell neu gebaut wird (~46 min), und die Kategorie-Centroids in `auslastung.json` sind falsch dimensioniert. Die UI zeigt vor dem Wechsel einen Confirm-Dialog mit allen drei Konsequenzen — Wechsel nicht leichtfertig durchführen. Das *Hinzufügen* eines Modells (ohne Aktivierung) ist in den Abschnitten oben beschrieben.
