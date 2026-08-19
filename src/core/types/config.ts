import type { Rolle as StatusRolle } from '@/core/status/typen';

/**
 * „Meine Anträge" auf der Startseite: Grenzen und Vorgabe der initialen Länge.
 *
 * Steht hier neben dem Feld, weil bis v4.116 ZWEI Stellen dieselbe Vorgabe
 * getrennt setzten: der Stepper in den Einstellungen zeigte 5, die Startseite
 * rechnete mit 10. Solange niemand die Einstellung angefasst hatte, sagte die
 * Oberfläche also 5 und zeigte 10 — und der erste Klick auf „Mehr" schrieb 6
 * und verkürzte die Liste von zehn auf sechs.
 *
 * 10 ist die bewusste Vorgabe (v2.372.2): mit 5 Zeilen endete die Startseite
 * bei 726 von 1262 px, also 43 % Leerraum bei 909 offenen Vorgängen.
 */
export const HOME_ANTRAEGE_MIN = 5;
export const HOME_ANTRAEGE_MAX = 15;
export const HOME_ANTRAEGE_STANDARD = 10;

export interface UserProfile {
  name: string;
  /**
   * Abteilung. Seit v2.88 (Entfernen der Bauantrag-Demo-Domäne) gibt es nur
   * noch den Förderanträge-Bereich → effektiv konstant `'antraege'`. Feld
   * bleibt für Persistenz-Kompatibilität: alte IDB-Profile mit `'beide'`/
   * `'bauantraege'` sind inert (werden nirgends mehr ausgewertet).
   */
  department: 'antraege';
  theme: {
    /** Farbton der Primärfarbe (`--tf-primary-h`). */
    hue: number;
    dark: boolean;
    /**
     * Sättigung und Helligkeit der Primärfarbe (`--tf-primary-s` / `-l`),
     * jeweils als CSS-Prozentwert („8%").
     *
     * Bis v4.116 speicherte das Profil NUR den Farbton — die sieben Vorgaben
     * unterscheiden sich aber in allen drei Werten. Der Klick wendete alle drei
     * an, gespeichert wurde einer, und nach dem Neustart zeigte die App
     * `hsl(hue, 25%, 42%)`: sechs der sieben Farben überlebten den Neustart
     * nicht, während das Häkchen weiter an der gewählten stand.
     *
     * Optional, weil Bestands-Profile sie nicht führen; `farbeAusProfil()`
     * holt sie dann aus der Vorgabe mit demselben Farbton.
     */
    sat?: string;
    lit?: string;
  };
  /** Wenn true, sind Plugins mit kuratorOnly: true sichtbar (z.B. Suchindex, Feedback-Verwaltung). */
  is_kurator?: boolean;
  /** @deprecated Legacy-Feld vor v1.9; beim Laden als Fallback für is_kurator berücksichtigt. */
  is_admin?: boolean;
  /**
   * ID des aktuell aktiven Förderprogramms. Steuert welches Programm in
   * Antraege-Liste, Home-Dashboard und Kurations-Tools sichtbar ist. Ein
   * User kann zwischen seinen 1–5 Programmen umschalten.
   * Wenn nicht gesetzt: Auto-Pick (erstes existierendes Programm).
   */
  activeProgrammId?: string;
  /**
   * Bearbeiter-Namenskürzel (z.B. "MUE" oder mehrere "MUE, SCH" für Vertretung).
   * Wird gegen die CSV-Spalten TiB_KUERZ / BIB_KUERZ (Bearbeiter) und
   * — wenn `bearbeiter_inkl_begleitung` true ist — zusätzlich ZTP_KUERZ /
   * PFM_KUERZ (Begleitung) gematcht.
   *
   * Spezialwert "alle" (case-insensitive) deaktiviert den Filter — nützlich
   * für PL/Übersicht. Leer/unset → Filter inaktiv (zeigt alle).
   *
   * Filtert in: Förderanträge-Liste (`/antraege`) + Home-Dashboard.
   */
  bearbeiter_kuerzel?: string;
  /**
   * Wenn true, schließt der Bearbeiter-Filter zusätzlich die Begleitungs-
   * Spalten (ZTP_KUERZ, PFM_KUERZ) ein. Default false — nur direkte
   * Bearbeiter-Spalten (TiB_KUERZ, BIB_KUERZ).
   */
  bearbeiter_inkl_begleitung?: boolean;
  /**
   * Zeigt Seiten, Reiter, Abschnitte und Widgets, die als „in Erprobung"
   * gekennzeichnet sind. Default aus.
   *
   * Zusammen mit `experten_modus` die vierte Sichtbarkeits-Achse — sie
   * beantwortet „will ich das sehen?", nicht „darf ich das?" (siehe
   * `@/core/sichtbarkeit`). Nie direkt lesen: die Frage stellt man über
   * `useSichtbar()`, sonst entstehen zwei Regeln (Guard
   * `sichtbarkeit-eine-mechanik`).
   */
  beta_features?: boolean;
  /**
   * Zeigt seltene Tiefen-Werkzeuge (Verwaltung, Rohfelder, Diagnose). Default
   * aus. Unabhängig von `beta_features`: was beide Marken trägt, braucht beide
   * Schalter.
   */
  experten_modus?: boolean;
  /**
   * Anzahl Anträge, die auf der Home-Seite in "Meine Anträge" initial gezeigt
   * werden. Bereich {@link HOME_ANTRAEGE_MIN}–{@link HOME_ANTRAEGE_MAX}, ohne
   * eigenen Wert {@link HOME_ANTRAEGE_STANDARD}. Der "+10 mehr"-Button am
   * Listenende erweitert in-page (nicht persistent).
   */
  home_meine_antraege_count?: number;
  /**
   * Eigene Rolle in der Antragsbearbeitung — die Rollen, die auch das
   * Fachsystem führt (AB, FB, QS, PA, Juristen; siehe `status/rollen.ts`).
   *
   * Wirkung ist eine **Vorauswahl, keine Sperre**: die Statusliste der
   * Detailseite startet auf die eigene Rolle gefiltert, „alle" ist ein Klick
   * entfernt. Unset ⇒ `alle`, damit ohne gesetzte Rolle nichts verschwindet.
   *
   * `beide` ist der abgelöste Wert aus v2.344 (nur AB/FB-Achse) und wird beim
   * Lesen wie `alle` behandelt — immer über `leseStatusRolle` (`status/rollen.ts`).
   */
  status_rolle?: StatusRolle | 'alle' | 'beide';
}

export interface AIProviderConfig {
  type: 'streamlit' | 'openrouter' | 'internal' | 'cloud';
  endpoint: string;
  model: string;
  apiKey: string;
}

export interface DirectoryEntry {
  id: string;
  label: string;
  type: 'documents' | 'data' | 'models';
  folderName?: string;
  /** 'opfs' = Origin Private File System (Browser-Sandbox, kein echtes Sharing). 'real' (default) = vom User gewählter Ordner. */
  kind?: 'opfs' | 'real';
}

export interface AppConfig {
  profile: UserProfile;
  aiProvider: AIProviderConfig;
  activeProvider: string;
}
