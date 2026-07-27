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
    hue: number;
    dark: boolean;
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
   * Anzahl Anträge, die auf der Home-Seite in "Meine Anträge" initial gezeigt
   * werden. Range 5–15. Default 5 (wenn unset). Der "+10 mehr"-Button am
   * Listenende erweitert in-page (nicht persistent).
   */
  home_meine_antraege_count?: number;
  /**
   * Eigene Rolle in der Antragsbearbeitung: administrativ (AB) oder fachlich
   * (FB). Das Statusvokabular des Fachsystems trennt beide durchgängig
   * (`[ARK]` adm. gegen `[ART]` techn., `[AK4]` kaufmännisch gegen `[AT4]`
   * technisch).
   *
   * Wirkung ist eine **Vorauswahl, keine Sperre**: die Statusliste der
   * Detailseite startet auf die eigene Rolle gefiltert, „alle" ist ein Klick
   * entfernt. Unset ⇒ `beide`, damit ohne gesetzte Rolle nichts verschwindet.
   */
  status_rolle?: 'ab' | 'fb' | 'beide';
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
