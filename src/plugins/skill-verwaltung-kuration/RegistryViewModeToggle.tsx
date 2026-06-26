/**
 * @deprecated In `@/components/ui/ViewModeToggle` promoviert (store-agnostisch,
 * von mehreren Modulen genutzt). Bleibt als dünner Re-Export, damit die
 * bestehenden Skill-Verwaltung-Importe (SkillsTab/RegelnTab/SkillVerwaltungPage)
 * unverändert weiterlaufen. Neuer Code importiert direkt `@/components/ui/ViewModeToggle`.
 */
export { ViewModeToggle as RegistryViewModeToggle } from '@/components/ui/ViewModeToggle';
export type { ViewMode as RegistryViewMode } from '@/components/ui/ViewModeToggle';
