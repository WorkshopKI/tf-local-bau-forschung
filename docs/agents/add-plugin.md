# Neues Plugin anlegen

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
- Smoke-Test: HTML öffnen → Sidebar zeigt das neue Plugin → Navigation funktioniert
