/**
 * Einstellungs-Seitenform als geteilte Layout-Schicht.
 *
 * „Settings" ist hier ein MUSTER, kein Plugin: eine Seite aus Gruppen von
 * Optionen, deren Erklaerungen hinter ⓘ liegen, mit Navigationsspalte, Suche
 * und Sprungmarke. Wirte sind `plugins/einstellungen` und der Kuration-Hub
 * `plugins/kuration`.
 *
 * Neue Abschnitte: [docs/agents/add-settings-section.md].
 */
export { SettingsHubPage, useHubNavigation } from './SettingsHubPage';
export { SettingsNav } from './SettingsNav';
export { InfoHint } from './InfoHint';
export {
  buildSearchIndex,
  searchSettings,
  type SettingsPanel,
  type SettingsSectionRef,
  type SettingsSearchEntry,
} from './panels';
export {
  SettingsSprungProvider,
  useSprungTreffer,
  SettingsKopfStatusAnker,
  SettingsKopfStatus,
  SettingsZweiSpalten,
  SettingsGruppe,
  SettingsGruppenAktion,
  SettingsOption,
  SettingsBlock,
  SettingsKlappe,
  SettingsStepper,
  SettingsStatusBadge,
  type SettingsBadgeTon,
  SettingsTrustZeile,
  SettingsKennzahl,
  SettingsLeer,
  SettingsKbd,
  type SettingsSprungZiel,
} from './settings-layout';
