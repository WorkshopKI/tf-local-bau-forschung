import type { AITransport, PingOptions } from './transports/streamlit';
import { StreamlitBridgeTransport } from './transports/streamlit';
import { DirectLLMTransport } from './transports/direct-llm';
import type { AIProviderConfig } from '@/core/types/config';
import { isOpenRouterEnabled } from '@/config/feature-flags';
import type { TransportKlasse } from './transport-policy';
import { classifyProvider, erlaubteTransportKlassen, skillEnthaeltDokumentInhalte } from './transport-policy';
import { BridgeMutex } from './bridge-vordergrund';
import type { TransportLease } from './bridge-vordergrund';

export class AIBridge {
  private transports = new Map<string, AITransport>();
  private activeType = 'streamlit';
  /**
   * Klasse des aktiven Providers (intern/extern) — von `switchProvider` aus dem
   * Config abgeleitet. Default `intern` (Streamlit beim App-Start). Erzwingt die
   * DSGVO-Transport-Policy in `getTransportForSkillRun`.
   */
  private activeKlasse: TransportKlasse = 'intern';

  /**
   * Bridge-Mutex (Assistent Phase 2): serialisiert die Gedächtnis-Konsolidierung
   * gegen Vordergrund-I/O (Skill-Läufe + Panel-Turns). Vordergrund hat Vorrang.
   * Eigene Klasse (unabhängig testbar), siehe bridge-vordergrund.ts.
   */
  private mutex = new BridgeMutex();

  constructor() {
    this.transports.set('streamlit', new StreamlitBridgeTransport());
  }

  switchProvider(config: AIProviderConfig): void {
    // Build-Time-Gate: OpenRouter in Builds ohne Cloud-Freigabe nie aktivieren.
    if (config.type === 'openrouter' && !isOpenRouterEnabled()) {
      console.warn('[AIBridge] OpenRouter in dieser Build-Variante deaktiviert — Provider-Wechsel wird ignoriert.');
      return;
    }
    // Weicher Heuristik-Check: Endpoint riecht nach OpenRouter, Type ist aber nicht 'openrouter'
    // (alter Storage-Eintrag). Behandeln wie oben.
    if (config.type !== 'streamlit' && typeof config.endpoint === 'string'
        && config.endpoint.includes('openrouter') && !isOpenRouterEnabled()) {
      console.warn('[AIBridge] Endpoint zeigt auf OpenRouter, OpenRouter aber deaktiviert — ignoriert.');
      return;
    }
    this.activeType = config.type;
    this.activeKlasse = classifyProvider(config);
    if (config.type === 'streamlit') {
      // Update-or-create: vorhandenen Transport per updateUrl() wiederverwenden
      // (sonst greift die geänderte URL aus den Einstellungen nie — der
      // Konstruktor legt immer schon einen mit Default-URL an —, und ein
      // Neu-Anlegen würde den globalen `message`-Listener leaken).
      const existing = this.transports.get('streamlit');
      if (existing instanceof StreamlitBridgeTransport) {
        existing.updateUrl(config.endpoint);
      } else {
        this.transports.set('streamlit', new StreamlitBridgeTransport(config.endpoint));
      }
    } else {
      this.transports.set(config.type, new DirectLLMTransport(
        config.endpoint,
        config.model,
        config.apiKey || undefined,
      ));
    }
  }

  getActiveTransport(): AITransport {
    const transport = this.transports.get(this.activeType);
    if (!transport) throw new Error(`No transport for ${this.activeType}`);
    return transport;
  }

  /** Klasse des aktiven Providers (intern/extern) — für UI-Hinweise + Tests. */
  getActiveKlasse(): TransportKlasse {
    return this.activeKlasse;
  }

  /**
   * Läuft alles über die Streamlit-Bridge? Entscheidet das wirksame
   * Kontextfenster: die Bridge-Tabs haben feste, nicht abfragbare Grössen
   * (`BRIDGE_*_CONTEXT_TOKENS`), lokal gilt der erkannte Wert.
   */
  istBridgeAktiv(): boolean {
    return this.activeType === 'streamlit';
  }

  /**
   * Transport für einen dokument-tragenden Skill-Lauf — die **gegatete** Wahl.
   * Erzwingt die DSGVO-Transport-Policy: verarbeitet der Skill Dokumentinhalte
   * (Ableitung schlägt Flag, siehe `transport-policy.ts`), darf der aktive
   * Transport nur `intern` sein — sonst **wirft** diese Methode statt den Inhalt
   * an einen externen Provider zu schicken. Inhaltsfreie Skills laufen überall.
   *
   * Param strukturell (kein `SkillRecord`-Import → kein Zyklus ai↔skills).
   */
  getTransportForSkillRun(
    skill: { promptTemplate: string; lektorPromptTemplate?: string; enthaeltDokumentInhalte?: boolean },
  ): AITransport {
    const erlaubt = erlaubteTransportKlassen({
      enthaeltDokumentInhalte: skillEnthaeltDokumentInhalte(skill),
    });
    if (!erlaubt.includes(this.activeKlasse)) {
      throw new Error(
        'DSGVO-Transport-Policy: Dieser Skill verarbeitet Dokumentinhalte und darf nur über '
        + `einen internen Transport laufen — aktiver Provider „${this.getActiveProviderName()}" `
        + 'ist extern. Bitte auf die interne KI wechseln.',
      );
    }
    // Vordergrund-Lease: markiert die Bridge als belegt (Mutex ggü. Konsolidierung).
    return this.mutex.wrapVordergrund(this.getActiveTransport());
  }

  /**
   * Transport für einen dokument-tragenden Lauf OHNE Skill-Record (v4.12).
   *
   * `getTransportForSkillRun` leitet die DSGVO-Klasse aus dem `promptTemplate`
   * des Skills ab (Pitfall #35) — es gibt aber Batch-Läufe, die Antragsdaten ans
   * Modell geben, ohne dass ein `SkillRecord` das Policy-Subjekt wäre: die
   * Auslastungs-Klassifizierung schickt Verbund-/TV-Titel und Antragsteller,
   * also genau die Klasse, die `INHALTS_SLOTS` als `stammdaten` führt. Für die
   * gilt dieselbe Regel wie für den Assistenten: **nur intern**, sonst wirft es.
   *
   * `zweck` benennt den Lauf in der Fehlermeldung (der Nutzer soll wissen, was
   * gerade blockiert wurde).
   */
  getTransportForDatenLauf(zweck: string): AITransport {
    const erlaubt = erlaubteTransportKlassen({ enthaeltDokumentInhalte: true });
    if (!erlaubt.includes(this.activeKlasse)) {
      throw new Error(
        `DSGVO-Transport-Policy: ${zweck} verarbeitet Antragsdaten und darf nur über `
        + `einen internen Transport laufen — aktiver Provider „${this.getActiveProviderName()}" `
        + 'ist extern. Bitte auf die interne KI wechseln.',
      );
    }
    return this.mutex.wrapVordergrund(this.getActiveTransport());
  }

  /**
   * Transport für einen Assistenten-Turn — die **gegatete** Wahl des Assistenz-
   * Panels (Phase 1). Der Assistenten-Kontext enthält regelmäßig Dokumentinhalte
   * (Orama-Auszüge aus VBs), daher gilt jeder Aufruf pauschal als dokument-tragend:
   * `enthaeltDokumentInhalte` ist hier **hart `true`**. Ist der aktive Provider
   * extern, **wirft** diese Methode — OpenRouter/extern ist strukturell unerreichbar,
   * auch nicht als Fallback.
   *
   * TODO(assistent-transport-policy): sobald eine zentrale Assistenten-Policy
   * existiert (spätere Phase), hierüber ableiten statt hart `true` zu setzen.
   */
  getTransportForAssistent(): AITransport {
    const erlaubt = erlaubteTransportKlassen({ enthaeltDokumentInhalte: true });
    if (!erlaubt.includes(this.activeKlasse)) {
      throw new Error(
        'DSGVO-Transport-Policy: Der Assistent verarbeitet Dokumentinhalte und darf nur über '
        + `einen internen Transport laufen — aktiver Provider „${this.getActiveProviderName()}" `
        + 'ist extern. Bitte auf die interne KI wechseln.',
      );
    }
    // Vordergrund-Lease: markiert die Bridge als belegt (Mutex ggü. Konsolidierung).
    return this.mutex.wrapVordergrund(this.getActiveTransport());
  }

  /**
   * Transport-Lease für die Gedächtnis-Konsolidierung (Assistent Phase 2) — die
   * **gegatete** Wahl des Hintergrundlaufs. Wie der Assistent gilt der Lauf pauschal
   * als dokument-tragend (Ereignisse enthalten Suchanfragen/Entitätsbezüge):
   * `enthaeltDokumentInhalte` ist hart `true`, externer Provider **wirft**.
   *
   * Bridge-Mutex: liefert **nur** einen Lease, wenn KEIN Vordergrund-I/O aktiv ist
   * (`vordergrundAktiv === 0`) und nicht bereits ein Konsolidierungs-Lease läuft;
   * sonst `null` (der Lauf wartet auf den nächsten Trigger). Der zurückgegebene
   * `signal` feuert, sobald ein Skill/Panel-Turn die Bridge belegt → der Lauf
   * bricht ab (Vordergrund hat Vorrang). Der Transport ist der ROHE aktive Transport
   * (zählt selbst nicht als Vordergrund); `freigeben()` im finally aufrufen.
   */
  getTransportForKonsolidierung(): TransportLease | null {
    const erlaubt = erlaubteTransportKlassen({ enthaeltDokumentInhalte: true });
    if (!erlaubt.includes(this.activeKlasse)) {
      throw new Error(
        'DSGVO-Transport-Policy: Die Gedächtnis-Konsolidierung verarbeitet Protokolldaten und '
        + `darf nur über einen internen Transport laufen — aktiver Provider „${this.getActiveProviderName()}" `
        + 'ist extern.',
      );
    }
    return this.mutex.versucheKonsolidierungsLease(() => this.getActiveTransport());
  }

  /** Verfügbarkeits-Check auf dem aktiven Transport (sauberer als rohes
   *  `getActiveTransport().ping()` — trägt keinen Inhalt, Convention-konform).
   *  `opts.openIfNeeded: false` → passiver Check (öffnet kein Bridge-Fenster). */
  pingActive(opts?: PingOptions): Promise<boolean> {
    return this.getActiveTransport().ping(opts);
  }

  /** Den PERSISTENTEN Streamlit-Transport holen (nicht den aktiven) — für den
   *  Verbindungstest + „Interne KI öffnen". Wichtig: nur diese eine Instanz lebt
   *  seit App-Start und hat über ihren `message`-Listener das Fenster-Handle aus
   *  dem `tf-bridge-ready`-Announce des Bookmarklets übernommen. Ein frisch
   *  angelegter Transport hätte das Handle NICHT → würde per `window.open` den
   *  KI-Tab neu laden und das Bookmarklet löschen. `url` synchronisiert die
   *  Origin-Prüfung; ändert activeType NICHT. */
  getStreamlitTransport(url?: string): StreamlitBridgeTransport {
    const existing = this.transports.get('streamlit');
    if (existing instanceof StreamlitBridgeTransport) {
      if (url) existing.updateUrl(url);
      return existing;
    }
    const created = new StreamlitBridgeTransport(url);
    this.transports.set('streamlit', created);
    return created;
  }

  /** Endnutzer-tauglicher Anzeige-Name des aktiven Providers (Tooltips,
   *  Status-Dialoge). Nutzt `displayName`, fällt auf den Logik-`name` zurück. */
  getActiveProviderName(): string {
    const t = this.getActiveTransport();
    return t.displayName ?? t.name;
  }
}
