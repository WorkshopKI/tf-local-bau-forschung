/**
 * Wer darf die Skill-Registry ändern — und wo taucht die Tür dazu auf?
 *
 * Beides hing bisher an ZWEI Prädikaten, die sich nur in dev zufällig deckten:
 * `canEditSkillRegistry` entschied über die Editierbarkeit, `isDevContext()` am
 * Aufrufer über die Sichtbarkeit der Inline-Werkstatt in der Gutachten-Ansicht.
 * pl und as durften die Registry damit schreiben, sahen den kurzen Weg dorthin
 * aber nicht.
 *
 * Hier steht die Entscheidung als REINE Funktion — Konfig-Lesen bleibt in
 * `feature-flags.ts` (Muster: `erlaubeWorkflowEntwuerfe()` → `istWorkflowVerfuegbar`).
 * Der Grund ist nicht Ästhetik: Vitest verdrahtet `__TEAMFLOW_CONFIG__` fest auf
 * `variant: 'development'`, ein Prädikat mit `runtimeConfig`-Zugriff ist über die
 * Varianten-Matrix also gar nicht testbar.
 *
 * KEIN neuer Feature-Flag — die Umgebung besteht ausschließlich aus bestehenden
 * Primitiven. Physischer Guard bleibt `queryPermission` in `writeSkillRegistry`.
 */

/** Die Konfig-Fakten, aus denen sich der Zugang ableitet. Kein `runtimeConfig`
 *  hier drin — der Aufrufer liest, diese Datei entscheidet. */
export interface RegistryUmgebung {
  /** `variant` ist `development` oder `custom` (dazu zählt die Variante „local"). */
  devKontext: boolean;
  /** `features.skillVerwaltung` — schaltet das Kuration-Plugin frei. */
  skillVerwaltung: boolean;
  /** `features.datenShareSchreibrecht` — der Build darf den Share schreiben. */
  datenShareSchreibrecht: boolean;
  /** Läuft gerade eine Kurator-Session? */
  sessionAktiv: boolean;
}

/**
 * Darf der Build/Nutzer die Skill-Registry SCHREIBEN?
 *
 *  - dev/local: immer — der Entwickler muss alles testen können, ohne erst eine
 *    Kurator-Session zu aktivieren.
 *  - pl: direkt, über `datenShareSchreibrecht`.
 *  - prod: nie (kein Schreibrecht, keine Session).
 *
 * **v3.0 — der Term `&& !u.kuratorMenus` ist entfallen.** Er hieß wörtlich
 * „pl/as, aber nicht kurator" und war der einzige verkappte Varianten-Test im
 * `src/`-Baum. Mit der Zusammenlegung muss `kuratorMenus` auch in pl auf `true`
 * stehen (sonst wirft `plugins.config.ts` die Kuration-Plugins schon zur Bauzeit
 * raus) — der Term hätte PL-Nutzern also still das Schreibrecht auf die
 * Skill-Registry genommen und eine Kurator-Freischaltung dafür verlangt. Die
 * Skill-Verwaltung ist ein PL-Werkzeug, kein Kurations-Bereich.
 *
 * prod bleibt ohne Sonderfall draußen: `datenShareSchreibrecht` ist dort `false`,
 * eine Session unerreichbar — und `werkstattZugang` verlangt zusätzlich
 * `skillVerwaltung`, das prod ebenfalls nicht hat.
 */
export function registryEditierbar(u: RegistryUmgebung): boolean {
  if (u.devKontext) return true;
  if (u.datenShareSchreibrecht) return true;
  return u.sessionAktiv;
}

/**
 * Ist die Inline-Werkstatt am Gutachten-Abschnitt sichtbar?
 *
 * Bewusst `sichtbar === editierbar`: eine read-only-Tür in ein Formular voller
 * `disabled`-Felder wäre Rauschen. Wer nur LESEN will, ist mit „Prompt an die KI
 * ansehen" (⋯-Menü) besser bedient — die zeigt den ZUSAMMENGESETZTEN Prompt
 * inklusive der angehängten Blöcke, also mehr als das Template im Editor.
 *
 * Die Kopplung an `skillVerwaltung` hält prod draußen, ohne dass dieser Zweig ein
 * eigenes Varianten-Wissen braucht: wer das Kuration-Plugin nicht hat, bekommt
 * auch die Abkürzung dorthin nicht.
 */
export function werkstattZugang(u: RegistryUmgebung): { sichtbar: boolean } {
  return { sichtbar: u.skillVerwaltung && registryEditierbar(u) };
}
