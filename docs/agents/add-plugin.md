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

- **Kurator-Plugin**: ID endet auf `-kuration` (z.B. `feedback-kuration`)
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

- TypeScript: `npx tsc --noEmit`
- Tests: `npm test` (Convention-Tests laufen mit)
- Build: `npm run build:prod`
- HTML aus `dist-single/` per Doppelklick öffnen, Plugin in der Sidebar
  anklicken — URL muss sich auf `#<route>` ändern und die Page rendern.
