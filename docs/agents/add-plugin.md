# Neues Plugin anlegen

> **Wenn etwas falsch läuft (Symptom → Ursache):**
>
> - **Sidebar-Klick auf neues Plugin springt zur Homepage** → vergessener Eintrag in `PLUGIN_ROUTES` (Schritt 3 unten). Ohne diesen Eintrag liefert `pluginIdToRoute()` den Fallback `'/'` zurück und die Hash-Route lautet `#/` statt `#/<route>`.
> - **URL `#/<route>` zeigt leere Seite (oder springt durch den `*`-Fallback auf Home)** → vergessener Eintrag in `flatIds[]` (Schritt 4 unten). Der Router rendert nur Plugins, deren ID in diesem Array steht.
>
> Beides ist beim Auslastungs-Plugin (Prompt 1, Mai 2026) genau einmal passiert. Symptom war: "Klicke auf Auslastung → Homepage öffnet sich".

## Touch-Points (Pflicht)

1. **Plugin-Verzeichnis** `src/plugins/<name>/` mit `index.ts` als Barrel:
   ```ts
   import type { TeamFlowPlugin } from '@/core/types/plugin';
   import MyPluginPage from './MyPluginPage';
   export const myPlugin: TeamFlowPlugin = {
     id: 'mein-plugin',          // siehe ID-Konvention unten
     name: 'Mein Plugin',
     icon: 'FileText',           // Lucide-Icon-Name
     category: 'workflow',       // 'workflow' | 'tools' | 'kuration'
     order: 50,
     component: MyPluginPage,
     kuratorOnly: false,         // true → nur sichtbar wenn profile.is_kurator
   };
   ```
2. **Registrierung in `src/plugins.config.ts`**:
   - Import oben ergänzen
   - Plugin in `allPlugins[]` einfügen (Reihenfolge bestimmt Sidebar)
   - Falls Plugin Feature-Flag-gated: zusätzlichen Filter in `passesFeatureFlags()`
3. **🔴 PFLICHT — Route in `src/core/routes.ts`**: neuen Eintrag in `PLUGIN_ROUTES` mit
   `<plugin-id>: '/<route>'` ergänzen. **Ohne diesen Eintrag landet jeder
   Sidebar-Klick auf der Homepage** (Fallback `'/'` in `pluginIdToRoute()`).
   Konvention: Kurator-Plugins unter `/kuration/<slug>`, Nutzer-Plugins
   unter `/<slug>`, Dev-Plugins unter `/<plugin-id>`.
4. **🔴 PFLICHT — Route-Render in `src/core/Router.tsx`**: Plugin-ID ins
   `flatIds`-Array eintragen. **Ohne diesen Eintrag rendert die Route nichts
   und der `*`-Fallback redirected auf Home.** Plugins mit Detail-Routen
   (Listen + Detail-View per `:id`) stattdessen wie `bauantraege`/`antraege`
   als eigene `RouteObject`-Blöcke anlegen.

## ID-Konvention

- **Kurator-Plugin** (`category: 'kuration'`, `kuratorOnly: true`): ID endet auf `-kuration` (z.B. `feedback-kuration`, `programme-kuration`)
- **Nutzer-Plugin** (workflow/tools): Domain-Name pur (z.B. `home`, `chat`, `antraege`)
- **Dev-Plugin**: ID-Präfix `dev-` (z.B. `dev-infrastructure-test`)

## Optional

- **Tour-Step** ergänzen, wenn Plugin im Onboarding sichtbar gemacht werden soll: `src/core/components/tour/tourSteps.ts` → neuen Step zu `TOUR_STEPS` hinzufügen, `data-tour="..."`-Attribut auf Ziel-Element setzen
- **Badge-Counter**: `badge: () => myStore.count` in der Plugin-Definition
- **Init-Hook**: aktuell nicht im `TeamFlowPlugin`-Interface — wenn benötigt, im Plugin-Component selbst per `useEffect`

## Sichtbarkeits-Regeln (zur Orientierung)

`ShellLayout` filtert die `enabledPlugins` zur Laufzeit:
- `kuratorOnly`-Plugins erscheinen nur bei `profile.is_kurator === true` (Fallback liest auch `is_admin`)
- `category: 'kuration'` wird global gegen `features.kuratorMenus` gegated

## Verifikation

- TypeScript: `npx tsc --noEmit`
- Build: `npm run build:dev`
- **Hash-Routing-Smoke-Test** (Pflicht für neue Plugins):
  - HTML aus `dist-single/` per Doppelklick öffnen
  - Sidebar zeigt das neue Plugin
  - Klick darauf → **URL muss sich auf `#/<route>` ändern UND die Plugin-Page muss rendern**
  - Wenn die URL unverändert bleibt oder wieder auf `#/` zurückspringt: Schritt 3 vergessen
  - Wenn die URL stimmt aber die Page leer ist: Schritt 4 vergessen
  - Direkter URL-Aufruf (`…html#/<route>` in Browser-Adressleiste) muss ebenfalls die Plugin-Page laden
