# Neues Plugin anlegen

Seit der Plugin-Registry-Konsolidierung sind Route + Feature-Flag Teil der
Plugin-Definition. Das heisst: **eine Stelle pflegen**, die Registries werden
automatisch generiert.

## Touch-Points (Pflicht)

1. **Plugin-Verzeichnis** `src/plugins/<name>/` mit `index.ts` als Barrel:
   ```ts
   import type { TeamFlowPlugin } from '@/core/types/plugin';
   import MyPluginPage from './MyPluginPage';

   export const myPlugin: TeamFlowPlugin = {
     id: 'mein-plugin',           // siehe ID-Konvention unten
     route: '/mein-plugin',       // HashRouter-Pfad ohne '#', siehe Konvention
     featureFlag: 'meinFeature',  // optional, key aus PluginFeatureKey
     name: 'Mein Plugin',
     icon: 'FileText',            // Lucide-Icon-Name
     category: 'erprobung',       // NEUE Plugins starten hier — siehe unten
     order: 48,                   // in der Gruppe hinten anstellen
     component: MyPluginPage,
     kuratorOnly: false,          // true → nur sichtbar wenn profile.is_kurator
   };
   ```

2. **Registrierung in `src/plugins.config.ts`**:
   - Import oben ergänzen
   - Plugin in `allPlugins[]` einfügen (Reihenfolge bestimmt Sidebar)
   - **Sonst nichts** — `PLUGIN_ROUTES`, `FLAT_ROUTE_PLUGIN_IDS` und der
     Feature-Flag-Filter werden aus den Plugin-Definitionen abgeleitet.

3. **Falls neuer `featureFlag`-Key gebraucht wird** (existing Keys siehe
   `PluginFeatureKey` in `src/core/types/plugin.ts`): das Feature-Flag in
   [add-feature-flag.md](add-feature-flag.md) anlegen UND den neuen Key in
   `PluginFeatureKey` ergaenzen — sonst TS-Error.

4. **Custom-Route-Handler (selten)**: wenn das Plugin Sub-Routen mit
   Parametern braucht (`antraege/verbund/:verbundId`, `antraege/:aktenzeichen`),
   im Router (`src/core/Router.tsx`) explizit verdrahten und die Plugin-ID
   in `PLUGINS_WITH_CUSTOM_ROUTE` (siehe `src/plugins.config.ts`) eintragen
   — sonst kollidiert die generierte Flat-Route mit den Detail-Routen.

5. **Sichtbarkeits-Katalog** `src/core/sichtbarkeit/katalog.ts`: ein
   `seite('<id>', '<Name>', BETA)`-Eintrag — neue Seiten starten als `beta`.
   Guard `sichtbarkeit-katalog-deckt-plugins` schlägt sonst rot
   ([sichtbarkeitsstufen.md](../architecture/sichtbarkeitsstufen.md)).

6. **Seitenkopf mit Hilfe-Knopf**: `PageHeader` mit
   `actions={<SeitenHilfeButton pluginId="<id>" />}` — der Guard in
   `conventions-ui` und `seitenHilfe.test.ts` („kein Einbau ohne Doc, kein Doc
   ohne Einbau") verlangen den Knopf zusammen mit Punkt 7.

7. **Bildschirmseiten-Kontext-Doc** `docs/feedback-kontext/<id>.md` nach der
   Schablone in [update-screen-context.md](update-screen-context.md), plus eine
   Zeile in `docs/feedback-kontext/_app.md` unter „Hauptbereiche". Guard
   `screen-context-coverage`.

8. **Sichtbarkeits-Matrix** in [build-varianten.md](../architecture/build-varianten.md):
   eine Zeile für das Plugin (welche Variante zeigt es) — die Quelle für
   [which-build-to-run.md](which-build-to-run.md).

## Sidebar-Gruppe wählen

Die Sidebar zeigt drei beschriftete Blöcke ([groupNavPlugins.ts](../../src/core/nav/groupNavPlugins.ts)):

| `category` | Sidebar | wofür |
|---|---|---|
| `workflow` | oben, **ohne** Beschriftung | der tägliche Weg (Home, Förderanträge, Auslastung) |
| `tools` | „Werkzeuge" | stabil, aber seltener gebraucht |
| `erprobung` | „In Erprobung" (zuklappbar) | **Startgruppe jedes neuen Plugins** |
| `kuration` | „Kuration" (nur Kurator-Builds) | Verwaltungs-Seiten |
| `system` | unten, ohne Beschriftung | derzeit nur `hideFromNav`-Seiten (Einstellungen) |

Ein neues Plugin gehört nach `erprobung`, bis es sich bewährt hat — dort weiß der Nutzer,
dass er Neuland betritt. Der Umzug nach `workflow`/`tools` ist später eine Zeile im Manifest.
Die Gruppe wird bewusst **nicht** aus dem `featureFlag` abgeleitet: „in Erprobung" ist eine
Aussage über Reife, nicht über Sichtbarkeit.

`order` staffelt gruppenweise (workflow 0–9, tools 20–29, erprobung 40–49, kuration 80–99),
damit ein neuer Eintrag nicht versehentlich zwischen zwei Gruppen rutscht.

## Route-Konventionen

- **Kurator-Plugin** (`category: 'kuration'`): `/kuration/<slug>`
- **Nutzer-Plugin** (workflow/tools/erprobung): `/<slug>`
- **Dev-Plugin**: `/<plugin-id>`
- **Home**: `/`

## ID-Konvention

- **Kurator-Seite**: in aller Regel **kein** eigenes Plugin mehr — sie wird ein Panel des Hubs `/kuration` ([add-settings-section.md](add-settings-section.md)). Ein eigenes Plugin nur, wenn die Seite eine eigene Arbeitsfläche ist (Vorbild `dokument-review`: Tastatursteuerung, 50/50-Split); dann endet die ID auf `-kuration` und die ID gehört in `KURATION_PLUGIN_IDS`
- **Nutzer-Plugin**: Domain-Name pur (z.B. `home`, `chat`, `antraege`)
- **Dev-Plugin**: ID-Präfix `dev-` (z.B. `dev-infrastructure-test`)

## Optional

- **Tour-Step** ergänzen, wenn Plugin im Onboarding sichtbar gemacht werden
  soll: `src/core/components/tour/tourSteps.ts` → neuen Step zu `TOUR_STEPS`
  hinzufügen, `data-tour="..."`-Attribut auf Ziel-Element setzen
- **Badge-Counter**: `badge: () => myStore.count` in der Plugin-Definition
- **Init-Hook**: `onInit?: (services: PluginInitServices) => Promise<void>`
  im Plugin-Objekt. Wird non-blocking nach `storage.init()` aus
  [src/core/App.tsx](../../src/core/App.tsx) parallel zu anderen Plugin-Inits
  aufgerufen — gut für Pre-Cache von Sidecar-Dateien, IDB-Migrationen oder
  Default-Seeds. Spielregeln + Beispiel: [optimize-remount-latency.md](optimize-remount-latency.md)
  (Hebel B1).

## Sichtbarkeits-Regeln (zur Orientierung)

`ShellLayout` filtert die `enabledPlugins` zur Laufzeit zusaetzlich:
- `kuratorOnly`-Plugins erscheinen nur bei `profile.is_kurator === true`
  (Fallback liest auch `is_admin`)
- `category: 'kuration'` wird zur Build-Zeit gegen `features.kuratorMenus`
  gegated (passiert in `passesFeatureFlags()`)

## Verifikation

- Innerer Loop `npm run check:quick`, vor dem Commit `npm run check` (Convention-Guards laufen mit).
- Abnahme selbst in `npm run dev:local`: Sidebar-Eintrag anklicken (Gruppe „In Erprobung"; trägt die Seite `beta`, mit **eingeschaltetem** Beta-Schalter), URL wechselt auf `#<route>`, Seite rendert, `window.__tf.fehler()` = 0.
- Build laut [which-build-to-run.md](which-build-to-run.md): ohne `featureFlag` landet das Plugin auch in prod → `npm run build:all`; mit Flag (prod `false`) reicht `npm run build:devpl`. Beim Nutzer bleibt der `file://`-Doppelklick auf die HTML unter `dist-single/`.
