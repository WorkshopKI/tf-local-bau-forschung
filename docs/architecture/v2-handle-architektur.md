# v2.0 — 2-Handle-Architektur (Persönlicher Ordner + Offline-Modus + Feedback-Inbox)

Daten-Modell-Änderungen, die einen Re-Pick beim Start erzwingen:

- **Neuer Handle-Slot `SMB_HANDLE_PERSOENLICH`** in der `smb-handles`-Map ([smb-handle.ts](../../src/core/services/infrastructure/smb-handle.ts)). Pflegt `ZAH/profile.json`, `ZAH/einstellungen.json` und `ZAH/feedback/outbox/*.json` auf dem User-Home-Laufwerk. Optional — Skip im Onboarding ist erlaubt, Fallback ist IDB.
- **Neuer Handle-Slot `SMB_HANDLE_USER_FOLDERS_ROOT`** für den Kurator (einmaliger Pick) zum Einsammeln der User-Outboxen via `FeedbackInboxTab`.
- **`pickAndStoreDatenShareHandle(idb, { mode })`** ist jetzt mode-parametrisiert. Kurator pickt `readwrite` (wie bisher), Nicht-Kurator pickt `read` (Hardening). `refreshAllPermissions(idb, { isKurator })` aktualisiert beim Start in einer User-Gesture-Kette die Permissions aller Slots.
- **Migrations-Flag `NEEDS_HANDLE_DOWNGRADE_IDB_KEY`**: bestehende Nicht-Kurator-User mit `readwrite`-Daten-Share-Handle werden auf dem `StartupScreen` ([src/core/StartupScreen.tsx](../../src/core/StartupScreen.tsx)) in einen Re-Pick mit `read`-Mode geführt. Single-Klick mit Banner-Erklärung.
- **Config-Schema-Bump `CONFIG_SCHEMA_VERSION = 2`** in [scripts/config-schema.mjs](../../scripts/config-schema.mjs). Neue Felder: `data.expectedFolderName` (optional Ordner-Name-Validation beim Daten-Share-Picker) und `personalFolder` (`subfolder`/`required`/`promptAfterProfile`/`snapshotAgeWarningDays`). Alle `configs/*.json` wurden aktualisiert.
- **Feedback-Dispatch in `feedbackService.submitFeedback`**: Kurator → direkt nach `_intern/feedback/feedback.json`; Nicht-Kurator → in die Outbox auf dem pers. Laufwerk. Kein automatischer Sync (out-of-scope; manueller "Feedback einsammeln"-Schritt im Kurator-Tab).
- **`ConnectionMode`** lebt in [src/core/services/connection-status.ts](../../src/core/services/connection-status.ts). Werte `'online' | 'offline'` (kein `'citrix'` — funktional identisch). Setzt auf den bestehenden `useSmbStatus` auf. `OfflineBanner` ([src/core/OfflineBanner.tsx](../../src/core/OfflineBanner.tsx)) ist nicht-dismissbar, amber, zeigt das letzte Snapshot-Datum.
- **Pfad-Konstanten** in [src/core/services/infrastructure/types.ts](../../src/core/services/infrastructure/types.ts):
  - `PERSOENLICH_ZAH_DIR = 'ZAH'` (seit v2.6.2 — vorher `PERSOENLICH_TEAMFLOW_DIR = 'teamflow'`, ohne Auto-Migration)
  - `PERSOENLICH_FEEDBACK_OUTBOX_DIR = 'ZAH/feedback/outbox'`
  - `PERSOENLICH_PROFILE_FILE = 'ZAH/profile.json'`
  - `PERSOENLICH_EINSTELLUNGEN_FILE = 'ZAH/einstellungen.json'`
  - `PERSOENLICH_MEINE_FEEDBACKS_FILE = 'ZAH/feedback/meine-feedbacks.json'`
  - `PERSOENLICH_AUSLASTUNG_PROFIL_FILE = 'ZAH/auslastung-profil.json'` (v2.6)

## v2.6 — MA-Selbst-Profil über den persönlichen Ordner

Zweiter Personal-Ordner-Flow neben der Feedback-Outbox, gleiche Begründung (Nicht-Kuratoren haben nur `read` auf dem Daten-Share und können `_intern/auslastung.json` nicht schreiben):

- **Schreiben (User)**: Der Tab „Meine Technologien" ([MeineTechnologienTab.tsx](../../src/plugins/einstellungen/MeineTechnologienTab.tsx)) schreibt die MA-pflegbaren Felder (`manuelleTechnologien`, `ausgeblendeteAutoTags`, `hauptKategorie`, `nebenKategorien`, `antragstypBevorzugt`) via `writeAuslastungProfil` ([persoenliches-profil.ts](../../src/plugins/auslastung/services/persoenliches-profil.ts)) nach `ZAH/auslastung-profil.json` + IDB-Cache. Kein Direktschreiben mehr nach `auslastung.json`.
- **Cross-Browser-Hydration**: `loadAuslastungProfil` liest beim Tab-Mount aus dem persönlichen Ordner (Source-of-Truth) → IDB-Cache → null, LWW über `updatedAt`. Hat Vorrang vor dem aus `auslastung.json` abgeleiteten Record (der erst nach PL-Aggregation aktuell ist). Wichtig, weil User mobil + vor Ort zwei Browser nutzen.
- **Einsammeln (PL)**: `collectUserProfiles` + `mergeProfilesIntoMitarbeiter` ([profil-einsammeln.ts](../../src/plugins/auslastung/services/profil-einsammeln.ts)) lesen über `SMB_HANDLE_USER_FOLDERS_ROOT` alle Profile ein (Iterations-Muster wie `FeedbackInboxTab`) und mergen sie via `kuerzel → anonId` in `auslastung.json`. PL-only-Felder (`jahresKapazitaet`, `abschlagProzent`, `aktiv`, `abgemeldet`, `antragstypUeberschreibung`) bleiben erhalten; unbekannte Kürzel legen neue MAs an. Trigger: Button „Team-Profile einsammeln" in der Auslastungs-Übersicht ([MaListSection.tsx](../../src/plugins/auslastung/views/uebersicht/MaListSection.tsx)) — manuell, EIN `setState` + EIN `persist` (Pitfall #16/#20).

UI-Touchpoints: `Onboarding.tsx` (Kürzel-Feld optional + Step 2 Pers. Ordner), `WelcomeScreen.tsx` (`expectedFolderName`-Validation + Mode-Default abhängig von `is_kurator`), `StartupScreen.tsx` (neu), `OfflineBanner.tsx` (neu), `ShellLayout.tsx` (Banner eingehängt), `EinstellungenPage`/`SpeicherTab` (Section "Persönlicher Ordner" + Verbinden/Ändern/Trennen).
