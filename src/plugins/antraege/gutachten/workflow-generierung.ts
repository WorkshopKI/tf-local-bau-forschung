/**
 * Der Generierungs-Kern des Gutachten-Workflows — ohne React.
 *
 * `useGutachtenWorkflow` mischte vier Verantwortungen in 870 Zeilen: Registry laden,
 * persistieren, generieren und die Schritt-/Neben-Aktionen. Der Generierungsteil war
 * der größte und zugleich der einzige, der nichts von React braucht: er bekommt einen
 * Run herein, fährt Transport + Skill und gibt einen neuen Run zurück. Genau das
 * steht hier — der Hook bleibt die dünne Bindung (busy/abort/persist/Fehlerbanner).
 *
 * Alle Abhängigkeiten kommen als **explizites** `deps`-Objekt herein. Das ist
 * absichtlich unbequem: jede Zeile, die etwas Neues braucht, muss es hier deklarieren,
 * statt es sich still aus einer Closure zu nehmen.
 *
 * Invarianten, die beim Verschieben NICHT verrutschen durften:
 *  - Transport IMMER über `bridge.getTransportForSkillRun(skill)` (Pitfall #30/#35).
 *  - `runSkill` resettet den Chat vor dem Submit (Pitfall #36) — das liegt im Runner.
 *  - Die drei `korpusMd`-Stellen in einem Lauf MÜSSEN dieselbe Zeichenkette sehen
 *    (siehe Kommentar an der Relevanz-Map unten).
 */
import type { AIBridge } from '@/core/services/ai/bridge';
import type { IDBStore } from '@/core/services/storage/idb-store';
import {
  runSkill, runRegelChecks, splitSentences,
  type CheckResult, type SkillModifierKey, type QualitaetsRegel, type SkillRecord,
  type SkillTweak, type WorkflowStep,
} from '@/core/services/skills';
import { kontextZielFuer } from '@/core/services/ai/ki-ziel';
import { resetHatVerlaufsrisiko, type ChatResetStatus } from '@/core/services/ai/chat-reset';
import { mitZielFallback, zielWirktAuf, type ZielFallbackErgebnis } from '@/core/services/ai/ziel-fallback';
import { TEMPERATUR_STANDARD } from '@/core/services/ai/sampling';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { KiRolle } from '@/core/services/ai/modell-katalog';
import { getVbCharCap } from '@/core/services/ai/llm-context';
import type { ThinkingBudget } from '@/core/services/ai/llm-thinking';
import { kiVerbindungBereit } from '@/core/services/ai/ki-guard';
import { buildStammdaten, type SkillCtx } from './skill-context';
import type { KurzfassungContext } from '../kurzfassung/types';
import { baueSkillEingabe, tweakWirktAuf } from './laufEingabe';
import type { GesendeterPrompt, PromptBein } from './promptAnsicht';
import { buildVorherigeAbschnitte, buildVbRelevant } from './context-provider';
import { getTeilPlan, teilAufgabe, teilRegeln, mergeTeile, type TeilErgebnis } from './teilGenerierung';
import { getOrComputeRelevanzMap, vbBrauchtRelevanzMap, type RelevanzAbschnitt } from './relevanz-map';
import {
  applyGeneration, applyFeinschliffUebersprungen, applyLaufFassung, applyLaufZiel, applyLektorat, applyQsHinweise, applyZielFallback,
  type GenerationInput,
} from './runner';
import type { LaufPhase } from '../kurzfassung/useStreamingBuffer';
import { istVerdaechtigGekuerzt } from './lektorat';
import { buildQsKriterienBlock, parseQsBefunde } from './qs';
import { saetzeOhneBeleg } from './belege';
import type { QsAbnahme, QsBefund, StepId, WorkflowRun } from './types';

/** Die Streaming-Senke eines Laufs (aus `useStreamingBuffer`). */
export interface StreamSenke {
  reset: () => void;
  onContentDelta: (text: string) => void;
  onThinkingDelta: (text: string) => void;
  /** Welches Bein der Kette läuft gerade — treibt den Busy-Text. */
  setPhase: (phase: LaufPhase) => void;
}

/**
 * Alles, was ein Lauf aus der Umgebung braucht. Bewusst EIN Objekt statt vierzehn
 * Parameter — und bewusst vollständig, damit hier nichts implizit aus einer
 * React-Closure kommt.
 */
export interface GenerierungsDeps {
  idb: IDBStore;
  bridge: AIBridge;
  ctx: KurzfassungContext;
  /** Verbund-Key (Cache-Key der Relevanz-Map). */
  key: string;
  /** Skill + Regeln je Schritt (aus der Registry aufgelöst). */
  skillMap: Map<StepId, SkillCtx>;
  /** Geordnete Generierungs-Schritte des aktiven Workflows. */
  steps: WorkflowStep[];
  /** Der Text, der tatsächlich ins Modell geht (VB oder VB+Korpus-Auswahl). */
  korpusMd: string;
  /** Ist eine maßgebliche VB aufgelöst? Ohne sie wird nicht generiert. */
  vbVorhanden: boolean;
  relevanzSkill: SkillRecord;
  lektorSkill: SkillRecord;
  thinkingBudget: ThinkingBudget;
  /** Pro-Lauf-Override „vollständigen Kontext erzwingen" (ignoriert die Relevanz-Map). */
  forceFullContext: boolean;
  stream: StreamSenke;
  /** Regeln eines Schritts inkl. persönlichem Vorgaben-Override. */
  regelnFuer: (sc: SkillCtx, tw: SkillTweak | null) => QualitaetsRegel[];
  setLlmAvailable: (ok: boolean) => void;
  setError: (msg: string) => void;
  /**
   * Hält fest, was für diesen Abschnitt tatsächlich gesendet wurde (Prompt-Ansicht,
   * „zuletzt gesendet"). Session-lokal im Hook — der Text trägt Dokumentinhalt und
   * wird NIE persistiert. Optional: der Eval-/Test-Pfad reicht ihn nicht durch.
   *
   * `bein` sagt, WELCHES Bein der Kette gesendet hat: `'generierung'` beginnt eine
   * neue Kette (ersetzt alles Gemerkte), `'feinschliff'` tritt daneben. Die
   * Slot-Logik liegt beim Hook — hier wird nur gemeldet.
   */
  merkeGesendet?: (stepId: StepId, prompts: GesendeterPrompt[], bein: PromptBein) => void;
}

/**
 * Überarbeitet dieser Lauf einen VORHANDENEN Text, statt den Abschnitt frisch zu
 * erzeugen? Modifier (Neu/Kürzer/Länger) und freie Anweisung sind beides
 * Überarbeitungen — sie setzen auf dem angezeigten Text auf.
 *
 * Die Unterscheidung trägt zwei Entscheidungen, die deshalb NICHT auseinanderlaufen
 * dürfen: die Teil-Generierung entfällt (sonst entstünde der Abschnitt frisch in
 * Teilen, der bisherige Text wäre weg), und der Feinschliff wird nicht angehängt
 * (der Text ist bereits lektoriert; ein zweiter Lektor-Lauf zöge eine bewusste
 * Kürzung wieder glatt und kostete einen Lauf).
 */
export function istUeberarbeitung(o: Pick<GenerateIntoOptions, 'modifier' | 'anweisung'>): boolean {
  return !!(o.modifier || o.anweisung);
}

export interface GenerateIntoOptions {
  modifier?: SkillModifierKey;
  quelle: 'freigegeben' | 'entwurf';
  tweak: SkillTweak | null;
  signal: AbortSignal;
  /** Journey-Paket 3: regel-gebundene Zusatz-Anweisung + auslösende Regel-ID. */
  zusatzAnweisung?: string;
  korrekturRegelId?: string;
  /**
   * Freie Überarbeitungs-Anweisung des Bearbeiters („Bearbeiten mit KI"). Wirkt
   * wie ein Modifier, nur mit selbst formuliertem Auftrag: der Lauf bekommt den
   * bisherigen Text als Referenz und überspringt die Teil-Generierung (siehe
   * `generiereEinmal`).
   */
  anweisung?: string;
  /**
   * Erzwingt die interne KI dieses Laufs statt der globalen Präferenz
   * („Zweitfassung mit der anderen KI"). Schaltet den Ziel-Fallback aus — sonst
   * käme bei einem Ausfall wieder die Fassung der ersten KI heraus, und der
   * Vergleich wäre keiner.
   */
  ziel?: KiRolle;
  /**
   * Erzwingt die Sampling-Temperatur dieses Laufs („Zweitfassung mit anderer
   * Einstellung"). Der Gegenpart zu `ziel` bei einer direkt angebundenen KI, wo es
   * keinen zweiten Tab gibt. Fehlt sie → Standard aus `runSkill`.
   */
  temperatur?: number;
}

/**
 * Fährt einen Lauf mit Ziel-Fallback (agentisch → standard, `ziel-fallback.ts`)
 * und PUFFERT dabei `setError`/`setLlmAvailable`: ein gescheiterter erster
 * Versuch darf kein Fehlerbanner hinterlassen, wenn der zweite trägt. Nur die
 * Meldungen des zuletzt gelaufenen Versuchs erreichen die UI.
 *
 * Der Puffer wird zu Beginn JEDES Versuchs geleert; nach dem Lauf wird einmal
 * geflusht. Wirft der Retry, propagiert der Fehler ungeflusht — dann setzt der
 * Orchestrator im Hook das Banner.
 */
async function mitFallbackLauf<R>(
  deps: GenerierungsDeps,
  transport: AITransport,
  signal: AbortSignal,
  lauf: (deps: GenerierungsDeps, ziel: KiRolle) => Promise<R>,
  istUnbrauchbar?: (ergebnis: R) => boolean,
  zielOverride?: KiRolle,
): Promise<ZielFallbackErgebnis<R>> {
  let fehler: string | null = null;
  let verfuegbar: boolean | null = null;
  const gepuffert: GenerierungsDeps = {
    ...deps,
    setError: (msg) => { fehler = msg; },
    setLlmAvailable: (ok) => { verfuegbar = ok; },
  };
  const ergebnis = await mitZielFallback<R>(
    (ziel) => {
      fehler = null;
      verfuegbar = null;
      return lauf(gepuffert, ziel);
    },
    {
      zielWirkt: zielWirktAuf(transport),
      signal,
      // Der Retry ist ein FRISCHER Lauf — sonst hinge der Teil-Stream des
      // gescheiterten Versuchs vor der neuen Antwort.
      vorRetry: () => deps.stream.reset(),
      ...(istUnbrauchbar ? { istUnbrauchbar } : {}),
      ...(zielOverride ? { zielOverride } : {}),
    },
  );
  if (verfuegbar !== null) deps.setLlmAvailable(verfuegbar);
  if (fehler !== null) deps.setError(fehler);
  return ergebnis;
}

/**
 * Generierungs-Kern für EINEN Abschnitt — gegen einen ÜBERGEBENEN `base`-Run
 * (kein Closure-Run, damit der Bulk-Lauf den frischen Stand durchreichen kann).
 * Liefert `{ next, checks }` oder `null` (Transport nicht erreichbar → `setError`
 * gerufen). Wirft bei echten Fehlern/Abbruch — der jeweilige Orchestrator im Hook
 * fängt das und besitzt busy/abort/persist. Der Tweak wird ÜBERGEBEN (nicht aus einer
 * Closure), damit der Bulk-Lauf pro Schritt den zum jeweiligen Skill gehörenden nutzt.
 *
 * Preflight + Ping laufen EINMAL in dieser Hülle (der Verbinden-Dialog darf sich
 * nicht pro Fallback-Versuch öffnen, und `ping` ist ziel-agnostisch); der eigentliche
 * Lauf steckt in `generiereEinmal` und wird bei Bedarf genau einmal mit der
 * gpt-oss-120b wiederholt.
 */
export async function generateInto(
  base: WorkflowRun,
  stepId: StepId,
  o: GenerateIntoOptions,
  deps: GenerierungsDeps,
): Promise<{ next: WorkflowRun; checks: CheckResult[] } | null> {
  const sc = deps.skillMap.get(stepId);
  if (!sc || !deps.vbVorhanden) return null;
  // KI-Preflight: nicht verbunden → Verbinden-Prompt statt stiller Tab-Öffnung (ping).
  if (!kiVerbindungBereit(deps.bridge)) return null;
  deps.stream.reset();
  const transport = deps.bridge.getTransportForSkillRun(sc.skill);
  const ok = await transport.ping();
  deps.setLlmAvailable(ok);
  if (!ok) { deps.setError('KI nicht erreichbar — Generierung derzeit nicht möglich.'); return null; }

  const { result, zielFallback, ziel } = await mitFallbackLauf(
    deps, transport, o.signal,
    (d, z) => generiereEinmal(base, stepId, o, d, sc, transport, z),
    // Ein leerer finaler Text ist das, was ein nicht erreichbarer Qwen3.6
    // typischerweise liefert — für den Nutzer ein Ausfall, also fallback-würdig.
    (r) => !r.next.schritte[stepId]?.finalerText.trim(),
    o.ziel,
  );
  const jetzt = new Date().toISOString();
  // Der Stempel gilt nur, wo das Ziel überhaupt etwas bewirkt: ohne Bridge gibt es
  // keine „Standard"- und keine Qwen3.6-35B (siehe `applyLaufZiel`).
  const gestempelt = {
    ...result,
    next: applyLaufFassung(
      applyLaufZiel(result.next, stepId, zielWirktAuf(transport) ? ziel : null, jetzt),
      stepId,
      o.temperatur !== undefined && o.temperatur !== TEMPERATUR_STANDARD,
      jetzt,
    ),
  };
  const roh = zielFallback
    ? { ...gestempelt, next: applyZielFallback(gestempelt.next, stepId, jetzt) }
    : gestempelt;

  // Zweites Bein derselben Busy-Phase: der Feinschliff. Der Nutzer soll als
  // Ergebnis der Generierung direkt den polierten Text sehen — der Rohentwurf
  // landet dabei über `applyLektorat` automatisch im Versionsverlauf.
  // Fehler-Meldungen des Feinschliffs werden verschluckt (`stilleDeps`): ein
  // Rohentwurf ist ein brauchbares Ergebnis, kein Fehlerfall.
  // Der angehängte Feinschliff bleibt auf DERSELBEN KI und derselben Temperatur wie
  // die Generierung — sonst trüge eine Zweitfassung am Ende den Schliff der ersten.
  //
  // Bei einer ÜBERARBEITUNG entfällt das zweite Bein (`null`): der Text kam bereits
  // poliert aus dem vorigen Lauf, und ein Lektor über eine bewusst gekürzte Fassung
  // zieht sie wieder glatt. Manuell bleibt der Feinschliff im ⋯-Menü erreichbar.
  return mitFeinschliff(
    roh, stepId,
    istUeberarbeitung(o)
      ? null
      : () => laufLektorat(roh.next, stepId, sc, o.tweak, o.signal, stilleDeps(deps), o.ziel, o.temperatur),
  );
}

/**
 * Hängt den Feinschliff an ein Generierungs-Ergebnis. Der Lektor-Lauf wird als
 * Thunk hereingereicht — damit ist die Degradations-Logik ohne Transport/Bridge
 * testbar, und sie ist der einzige Ort, an dem entschieden wird, was der Nutzer
 * am Ende sieht.
 *
 * `lektorat === null` heißt **nicht vorgesehen** (Überarbeitungs-Lauf): der Stand
 * geht unverändert zurück, insbesondere OHNE `feinschliffUebersprungen` — die Marke
 * sagt „der Feinschliff hat nicht getragen", nicht „er war nicht geplant". Die Karte
 * zeigt dann schlicht „Formuliert".
 *
 * JEDES Scheitern eines VORGESEHENEN Laufs degradiert zum Rohentwurf, keines blockiert:
 *  - `null` (Tor gezogen: leer / verdächtig gekürzt / Transport weg)
 *  - Wurf (Transport-Policy, Netz)
 *  - **Abbruch** — der Rohentwurf ist bereits berechnet; ihn wegen eines Stopps
 *    im zweiten Bein zu verwerfen, wäre Arbeitsverlust. Deshalb fängt diese
 *    Funktion auch `AbortError` und gibt den Generierungsstand zurück.
 *
 * Die zurückgegebenen `checks` stammen IMMER vom final angezeigten Text (nach
 * erfolgreichem Feinschliff also die des Lektor-Laufs) — sonst entschiede der
 * Auto-Retry-Orchestrator über einen Text, der gar nicht mehr sichtbar ist.
 */
export async function mitFeinschliff(
  gen: { next: WorkflowRun; checks: CheckResult[] },
  stepId: StepId,
  lektorat: (() => Promise<WorkflowRun | null>) | null,
): Promise<{ next: WorkflowRun; checks: CheckResult[] }> {
  if (!lektorat) return gen;
  let poliert: WorkflowRun | null = null;
  try {
    poliert = await lektorat();
  } catch {
    poliert = null;
  }
  if (!poliert) {
    return {
      next: applyFeinschliffUebersprungen(gen.next, stepId, new Date().toISOString()),
      checks: gen.checks,
    };
  }
  return { next: poliert, checks: poliert.schritte[stepId]?.checks ?? gen.checks };
}

/**
 * `deps`-Derivat ohne Fehlerbanner — für Läufe, deren Scheitern der Nutzer als
 * Degradation und nicht als Fehler erleben soll (angehängter Feinschliff).
 * `setLlmAvailable` bleibt scharf: die Erreichbarkeit ist echte Information.
 */
function stilleDeps(deps: GenerierungsDeps): GenerierungsDeps {
  return { ...deps, setError: () => {} };
}

/** Ein einzelner Generierungs-Versuch mit festem `ziel` (siehe `generateInto`). */
async function generiereEinmal(
  base: WorkflowRun,
  stepId: StepId,
  o: GenerateIntoOptions,
  deps: GenerierungsDeps,
  sc: SkillCtx,
  transport: AITransport,
  ziel: KiRolle,
): Promise<{ next: WorkflowRun; checks: CheckResult[] }> {
  const tw = o.tweak;
  const scRegeln = deps.regelnFuer(sc, tw);
  const tweakWirksam = tweakWirktAuf(sc.skill.id, tw);
  const prevText = base.schritte[stepId]?.finalerText;
  // Relevanz-Map: nur wenn der Schritt `kontextBedarf: 'relevant'` trägt UND die
  // VB groß genug ist. JEDER Fehlerpfad (Map leer / Lauf gescheitert) degradiert
  // still zu Volltext — kein `vbRelevant` → der Skill nutzt {{vbMarkdown}} wie bisher.
  let vbRelevant: string | undefined;
  const stepDef = deps.steps.find(s => s.id === stepId);
  // ACHTUNG: die drei `korpusMd`-Stellen hier MÜSSEN dieselbe Zeichenkette sehen.
  // `getOrComputeRelevanzMap` rechnet Heading-SPANS in den übergebenen String, und
  // `buildVbRelevant` sliced später mit genau diesen Offsets. Wer nur einen der
  // Aufrufe umstellt, bekommt keinen Fehler — nur stillschweigend den falschen
  // Textausschnitt im Prompt (siehe korpus-kontext.test.ts).
  if (!deps.forceFullContext && stepDef?.kontextBedarf === 'relevant' && vbBrauchtRelevanzMap(deps.korpusMd)) {
    try {
      const abschnitte: RelevanzAbschnitt[] = deps.steps.map(s => ({ id: s.id, label: s.label }));
      const relevanz = await getOrComputeRelevanzMap(deps.idb, transport, deps.relevanzSkill, deps.key, deps.korpusMd, abschnitte, ziel);
      const block = buildVbRelevant(relevanz, deps.korpusMd, stepId, getVbCharCap(kontextZielFuer(deps.bridge, ziel)));
      if (block) vbRelevant = block;
    } catch {
      // Relevanz-Lauf gescheitert → Volltext-Fallback (nie scheitern).
    }
  }
  // Teil-Generierung (unsichtbar): B (Hintergrund/Stand der Technik/Lösungsweg,
  // ≥ 750 Wörter) sprengt das feste Output-Budget des internen LLM → der finale Text
  // wird abgeschnitten. Daher B in mehreren kürzeren Läufen erzeugen und zu EINEM
  // Abschnitt zusammenführen. Nur bei frischer Generierung (kein Modifier/Korrektur-
  // Lauf); im Teil-Prompt fallen die Gesamt-Größen-Regeln weg, der finale Check läuft
  // mit dem VOLLEN Regelsatz gegen den gemergten Text.
  //
  // Die freie Anweisung schließt den Zweig ebenso aus wie ein Modifier: sie ist eine
  // ÜBERARBEITUNG des vorhandenen Textes. Über den Teil-Pfad würde der Abschnitt
  // stattdessen frisch in Teilen neu entstehen — der bisherige Text wäre weg.
  const teilPlan = getTeilPlan(sc.skill.id);
  if (teilPlan && !istUeberarbeitung(o)) {
    const vorherige = buildVorherigeAbschnitte(base, stepId, deps.steps, 2000, o.quelle);
    const teilRegelSatz = teilRegeln(scRegeln);
    const teilErgebnisse: TeilErgebnis[] = [];
    // Ein Teil-Lauf sendet MEHRERE Prompts je Abschnitt — die Ansicht zeigt sie
    // alle, sonst sähe man den Kontext nur eines Bruchstücks.
    const gesendet: GesendeterPrompt[] = [];
    let letztesResult: Awaited<ReturnType<typeof runSkill>> | null = null;
    /** Der schlechteste Reset-Status über alle Teile; `null` = keiner riskant. */
    let resetRisiko: ChatResetStatus | null = null;
    let vorText = '';
    for (const teil of teilPlan) {
      const eingabe = baueSkillEingabe({
        ctx: deps.ctx,
        korpusMd: deps.korpusMd,
        vbCharCap: getVbCharCap(kontextZielFuer(deps.bridge, ziel)),
        thinkingBudget: deps.thinkingBudget,
        ziel,
        vorherigeAbschnitte: vorherige,
        teilAufgabe: teilAufgabe(teil, vorText),
        stream: deps.stream,
        signal: o.signal,
        ...(o.temperatur !== undefined ? { temperatur: o.temperatur } : {}),
        ...(vbRelevant ? { vbRelevant } : {}),
        ...(tweakWirksam ? { tweak: tw, tweakWirksam } : {}),
        ...(o.zusatzAnweisung ? { zusatzAnweisung: o.zusatzAnweisung } : {}),
      });
      const r = await runSkill(transport, sc.skill, teilRegelSatz, eingabe);
      if (r.gesendet) gesendet.push(r.gesendet);
      teilErgebnisse.push({
        quellenanalyse: r.parsed.quellenanalyse,
        finalerText: r.parsed.finalerText,
        ...(r.thinking ? { thinking: r.thinking } : {}),
        vbGekuerzt: r.vbGekuerzt,
        ...(r.parsed.warnung ? { warnung: r.parsed.warnung } : {}),
      });
      letztesResult = r;
      // Der SCHLECHTESTE Reset-Status über alle Teile gewinnt — wie `vbGekuerzt`
      // und `warnung` in `mergeTeile` („irgendein Teil war betroffen"). Jeder
      // Teil fährt seinen eigenen `starteFrischenChat` (Pitfall #36); nur den
      // letzten zu merken hieß, dass ein gescheiterter Reset vor Teil 1 spurlos
      // verschwindet und die Karte einen halb kontaminierten Abschnitt als
      // sauber ausweist (v4.124).
      if (r.chatResetStatus && resetHatVerlaufsrisiko(r.chatResetStatus)) {
        resetRisiko = r.chatResetStatus;
      }
      vorText = [vorText, r.parsed.finalerText].map(t => t.trim()).filter(Boolean).join('\n\n');
    }
    const merged = mergeTeile(teilErgebnisse);
    deps.merkeGesendet?.(stepId, gesendet, 'generierung');
    const checks = runRegelChecks(merged.finalerText, scRegeln);
    const gen: GenerationInput = {
      quellenanalyse: merged.quellenanalyse,
      entwurf: merged.entwurf,
      finalerText: merged.finalerText,
      checks,
      modell: transport.displayName ?? transport.name,
      skillId: sc.skill.id,
      skillVersion: sc.skill.version,
      vbGekuerzt: merged.vbGekuerzt,
      ...(merged.warnung ? { warnung: merged.warnung } : {}),
      ...((resetRisiko ?? letztesResult?.chatResetStatus)
        ? { chatResetStatus: resetRisiko ?? letztesResult!.chatResetStatus! }
        : {}),
      ...(tweakWirksam ? { mitTweak: true, tweakGeaendertAm: tw!.geaendert_am } : {}),
      ...(merged.thinking ? { denkprozess: merged.thinking } : {}),
      ...(deps.thinkingBudget !== 'none' ? { denkprozessAngefordert: true } : {}),
    };
    return { next: applyGeneration(base, stepId, gen, new Date().toISOString()), checks };
  }

  const eingabe = baueSkillEingabe({
    ctx: deps.ctx,
    korpusMd: deps.korpusMd,
    vbCharCap: getVbCharCap(kontextZielFuer(deps.bridge, ziel)),
    thinkingBudget: deps.thinkingBudget,
    ziel,
    vorherigeAbschnitte: buildVorherigeAbschnitte(base, stepId, deps.steps, 2000, o.quelle),
    stream: deps.stream,
    signal: o.signal,
    ...(o.temperatur !== undefined ? { temperatur: o.temperatur } : {}),
    ...(vbRelevant ? { vbRelevant } : {}),
    ...(tweakWirksam ? { tweak: tw, tweakWirksam } : {}),
    ...(o.modifier ? { modifier: o.modifier } : {}),
    // Der bisherige Text ist bei der freien Anweisung nicht Beiwerk, sondern ihr
    // Gegenstand („die anderen entfernen") — dieselbe Bedingung wie beim Modifier.
    ...((o.modifier || o.anweisung) && prevText ? { vorherigerText: prevText } : {}),
    ...(o.anweisung ? { anweisung: o.anweisung } : {}),
    ...(o.zusatzAnweisung ? { zusatzAnweisung: o.zusatzAnweisung } : {}),
  });
  const result = await runSkill(transport, sc.skill, scRegeln, eingabe);
  deps.merkeGesendet?.(stepId, result.gesendet ? [result.gesendet] : [], 'generierung');
  const checks = runRegelChecks(result.parsed.finalerText, scRegeln);
  const gen: GenerationInput = {
    quellenanalyse: result.parsed.quellenanalyse,
    entwurf: result.parsed.entwurf,
    finalerText: result.parsed.finalerText,
    ...(result.parsed.teile?.length ? { teile: result.parsed.teile } : {}),
    ...(result.parsed.belege?.length ? { belege: result.parsed.belege } : {}),
    checks,
    modell: transport.displayName ?? transport.name,
    skillId: sc.skill.id,
    skillVersion: sc.skill.version,
    vbGekuerzt: result.vbGekuerzt,
    ...(result.parsed.warnung ? { warnung: result.parsed.warnung } : {}),
    ...(result.chatResetStatus ? { chatResetStatus: result.chatResetStatus } : {}),
    ...(o.modifier ? { modifier: o.modifier } : {}),
    ...(o.anweisung ? { anweisung: o.anweisung } : {}),
    ...(o.korrekturRegelId ? { korrekturRegelId: o.korrekturRegelId } : {}),
    ...(tweakWirksam ? { mitTweak: true, tweakGeaendertAm: tw!.geaendert_am } : {}),
    ...(result.thinking ? { denkprozess: result.thinking } : {}),
    ...(deps.thinkingBudget !== 'none' ? { denkprozessAngefordert: true } : {}),
  };
  return { next: applyGeneration(base, stepId, gen, new Date().toISOString()), checks };
}

/**
 * Beratende LLM-QS über den FINALEN Text eines Generierungs-Schritts. Nutzt
 * denselben (internen) Transport + Runner wie die Generierung; die Befunde landen
 * via `applyQsHinweise` am Ziel-Schritt (kein Text-Overwrite). Transport weg → `null`
 * (Fehler ist gesetzt), sonst der neue Run.
 */
export async function laufQs(
  run: WorkflowRun,
  zielStepId: StepId,
  qsCtx: SkillCtx,
  signal: AbortSignal,
  deps: GenerierungsDeps,
): Promise<WorkflowRun | null> {
  const zielStep = run.schritte[zielStepId];
  if (!zielStep) return null;
  deps.stream.reset();
  const transport = deps.bridge.getTransportForSkillRun(qsCtx.skill);
  const ok = await transport.ping();
  deps.setLlmAvailable(ok);
  if (!ok) { deps.setError('KI nicht erreichbar — QS derzeit nicht möglich.'); return null; }
  // Kriterien hängen am ABSCHNITTS-Skill (A–G), der Lauf fährt weiter über
  // `qs-basis`. Fehlen sie, bleibt alles beim Alten (Default-Dimensionen).
  const kriterien = deps.skillMap.get(zielStepId)?.skill.qsKriterien ?? [];
  const satzAnzahl = splitSentences(zielStep.finalerText).length;
  const kriterienBlock = kriterien.length > 0
    ? buildQsKriterienBlock(kriterien, saetzeOhneBeleg(zielStep.belege ?? [], satzAnzahl))
    : '';

  // Kein `zielFallback`-Stempel: die QS ändert den Text nicht, das Badge an der
  // Karte beschreibt die Herkunft des angezeigten Textes.
  const { result: befunde } = await mitFallbackLauf(
    deps, transport, signal,
    (d, ziel) => qsEinmal(zielStep.finalerText, zielStepId, qsCtx, transport, d, ziel, signal, kriterienBlock, satzAnzahl),
    (b) => b.length === 0,
  );
  const now = new Date().toISOString();
  // Abnahme nur bei kuratierten Kriterien: ohne sie bewertet die QS generische
  // Dimensionen — daraus eine „Abnahme" abzuleiten wäre eine Überhöhung.
  // …und nur bei einem Befund: `every` ist auf dem leeren Array `true`, null
  // Befunde ergäben also „bestanden" — über eine Antwort, die derselbe Lauf zwei
  // Zeilen darüber als unbrauchbar definiert (`b.length === 0`). Eine Abnahme
  // ohne einen einzigen Befund ist dieselbe Überhöhung wie eine ohne Kriterien
  // (v4.124).
  const abnahme: QsAbnahme | undefined = kriterien.length > 0 && befunde.length > 0
    ? {
        status: befunde.every(b => b.bewertung === 'ok') ? 'bestanden' : 'hinweise',
        am: now,
        kriterienVersion: deps.skillMap.get(zielStepId)?.skill.version ?? 0,
      }
    : undefined;
  return applyQsHinweise(run, zielStepId, befunde, now, abnahme);
}

/** Ein einzelner QS-Versuch mit festem `ziel` (siehe `laufQs`). */
async function qsEinmal(
  zielText: string,
  zielStepId: StepId,
  qsCtx: SkillCtx,
  transport: AITransport,
  deps: GenerierungsDeps,
  ziel: KiRolle,
  signal: AbortSignal,
  kriterienBlock: string,
  satzAnzahl: number,
): Promise<QsBefund[]> {
  const zielDef = deps.steps.find(s => s.id === zielStepId);
  const result = await runSkill(transport, qsCtx.skill, qsCtx.regeln, {
    ziel,
    stammdaten: buildStammdaten(deps.ctx),
    vbMarkdown: deps.korpusMd,
    vbCharCap: getVbCharCap(kontextZielFuer(deps.bridge, ziel)),
    thinkingBudget: deps.thinkingBudget,
    onContentDelta: deps.stream.onContentDelta,
    onThinkingDelta: deps.stream.onThinkingDelta,
    zielText,
    abschnittszweck: zielDef?.label ?? zielStepId,
    ...(kriterienBlock ? { qsKriterien: kriterienBlock } : {}),
    signal,
  });
  return parseQsBefunde(result.raw, satzAnzahl);
}

/**
 * Sprachlicher Feinschliff eines Entwurfs (Lektor-Skill). Bewusst KEIN
 * Generierungs-Lauf: der Prompt trägt nur den Abschnittstext (`zielText`) +
 * den Abschnittszweck — die Vorhabensbeschreibung bleibt draußen, damit der
 * Lauf strukturell nichts hinzuerfinden kann. Geprüft wird danach mit den
 * Regeln DES ABSCHNITTS (Umfang bleibt die maßgebliche Instanz).
 *
 * Zwei Abbruch-Tore VOR dem Schreiben: leeres Ergebnis und
 * `istVerdaechtigGekuerzt` (abgeschnittene Antwort) → Fehlermeldung, Abschnitt
 * bleibt unverändert (`null` zurück). Transport intern-pflichtig über
 * `getTransportForSkillRun` (Pitfall #30).
 */
export async function laufLektorat(
  run: WorkflowRun,
  stepId: StepId,
  sc: SkillCtx,
  tweak: SkillTweak | null,
  signal: AbortSignal,
  deps: GenerierungsDeps,
  /** Erzwungene KI (folgt der Generierung bei der Zweitfassung); sonst globale Präferenz. */
  zielOverride?: KiRolle,
  /** Erzwungene Temperatur — folgt derselben Zweitfassung wie `zielOverride`. */
  temperatur?: number,
): Promise<WorkflowRun | null> {
  const step = run.schritte[stepId];
  if (!step) return null;
  deps.stream.reset();
  const transport = deps.bridge.getTransportForSkillRun(deps.lektorSkill);
  const ok = await transport.ping();
  deps.setLlmAvailable(ok);
  if (!ok) { deps.setError('KI nicht erreichbar — Feinschliff derzeit nicht möglich.'); return null; }
  const { result, zielFallback, ziel } = await mitFallbackLauf(
    deps, transport, signal,
    (d, z) => lektoriereEinmal(run, stepId, sc, tweak, transport, d, z, signal, temperatur),
    // Ein gezogenes Tor (leer / verdächtig gekürzt) ist ein unbrauchbares Ergebnis —
    // beim Qwen3.6-Modell genau der Fall, den gpt-oss-120b retten soll.
    (r) => r === null,
    zielOverride,
  );
  if (!result) return null;
  const jetzt = new Date().toISOString();
  const gestempelt = applyLaufZiel(result, stepId, zielWirktAuf(transport) ? ziel : null, jetzt);
  return zielFallback ? applyZielFallback(gestempelt, stepId, jetzt) : gestempelt;
}

/** Ein einzelner Feinschliff-Versuch mit festem `ziel` (siehe `laufLektorat`). */
async function lektoriereEinmal(
  run: WorkflowRun,
  stepId: StepId,
  sc: SkillCtx,
  tweak: SkillTweak | null,
  transport: AITransport,
  deps: GenerierungsDeps,
  ziel: KiRolle,
  signal: AbortSignal,
  temperatur?: number,
): Promise<WorkflowRun | null> {
  const step = run.schritte[stepId];
  if (!step) return null;
  // Je VERSUCH setzen, nicht in der Hülle: `mitFallbackLauf` resettet die Senke vor
  // einem Retry (und `reset` fällt auf `'formulieren'` zurück).
  deps.stream.setPhase('feinschliff');
  const zielDef = deps.steps.find(s => s.id === stepId);
  const result = await runSkill(transport, deps.lektorSkill, [], {
    ziel,
    stammdaten: '',
    vbMarkdown: '',
    thinkingBudget: deps.thinkingBudget,
    erwarteAbschluss: 'Finaler Text',
    onContentDelta: deps.stream.onContentDelta,
    onThinkingDelta: deps.stream.onThinkingDelta,
    zielText: step.finalerText,
    abschnittszweck: zielDef?.label ?? stepId,
    signal,
    ...(temperatur !== undefined ? { temperatur } : {}),
  });
  // Auch das zweite Bein gehört in die Prompt-Ansicht: im Chat der internen KI ist
  // vom Generierungs-Prompt nichts mehr zu sehen (jeder Lauf startet einen frischen
  // Chat, Pitfall #36) — wer nur den Lektor-Prompt dort stehen sieht, hält ihn sonst
  // für den einzigen gesendeten.
  deps.merkeGesendet?.(stepId, result.gesendet ? [result.gesendet] : [], 'feinschliff');
  const text = result.parsed.finalerText.trim();
  if (!text) {
    deps.setError('Der Feinschliff lieferte keinen Text — der Abschnitt bleibt unverändert.');
    return null;
  }
  if (istVerdaechtigGekuerzt(step.finalerText, text)) {
    deps.setError('Der Feinschliff wirkt abgeschnitten (deutlich kürzer als der Abschnitt) — der Abschnitt bleibt unverändert. Bitte erneut versuchen.');
    return null;
  }
  return applyLektorat(run, stepId, {
    finalerText: text,
    checks: runRegelChecks(text, deps.regelnFuer(sc, tweak)),
    modell: transport.displayName ?? transport.name,
    ...(result.chatResetStatus ? { chatResetStatus: result.chatResetStatus } : {}),
  }, new Date().toISOString());
}
