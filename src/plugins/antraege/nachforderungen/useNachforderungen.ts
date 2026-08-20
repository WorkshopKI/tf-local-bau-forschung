/**
 * Orchestriert die NF-Erzeugung pro Teilvorhaben (Artefakt-Engine, dev-Flag
 * `nfNachforderungen`). Reuse des Skill-Runners + Baustein-Katalogs: die
 * G-Bausteine werden EINMAL am Verbund-Kontext gefüllt und in JEDE TV-NF gemerged,
 * die T-Bausteine je TV. Ausgabe je TV: gemergter NF-Text + Checks + E-Mail-Entwurf
 * (mailto). Persistenz pro TV unter `workflow-run:nf:<tv-az>`.
 *
 * DSGVO: der Transport kommt über `bridge.getTransportForSkillRun(skill)` (NF ist
 * dokument-tragend → intern erzwungen, Pitfall #30). Es wird NICHTS versendet —
 * der Mensch öffnet/prüft/sendet die Entwürfe (Entwurf ≠ Entscheidung).
 */
import { useEffect, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { kiVerbindungGeprueft } from '@/core/services/ai/ki-guard';
import {
  runSkill, loadSkillRegistry, getSkillById, resolveRegeln, capVbMarkdown,
  loadTextbausteinKatalog, freigegebeneBausteine,
  type CheckResult, type SkillRegistryFile,
  type KatalogRef, type TextbausteinRecord,
} from '@/core/services/skills';
import { SKILL_ID_BY_TYP, type BescheidTyp } from './artefakt-typ';
import type { KonsistenzWarnung } from './bescheid-freigabe';
import { getVbCharCap } from '@/core/services/ai/llm-context';
import { aktivesZielFuerLauf, kontextZielFuerLauf } from '@/core/services/ai/ki-ziel';
import type { DocumentFull } from '@/plugins/dokumente/store';
import { resolveVb } from '../kurzfassung/vbDokument';
import { buildStammdaten } from '../gutachten/skill-context';
import { putWorkflowRun } from '../gutachten/workflow-store';
import { logArbeitskontext } from '@/core/services/personal-storage/arbeitskontext-log';
import type { StepRun, WorkflowRun } from '../gutachten/types';
import type { KurzfassungContext } from '../kurzfassung/types';
import { formatBausteinKatalog, pruefeNf, nfFreigabereif, mergeNfFuerTv, buildNfMailto } from './nf-service';

/** Ein fertiger Bescheid-Entwurf für ein Teilvorhaben (NF/RNE/ABL). */
export interface NfEntwurf {
  aktenzeichen: string;
  titel: string | null;
  antragsteller: string | null;
  text: string;
  checks: CheckResult[];
  freigabereif: boolean;
  mailto: string;
  /** Bescheid-Typ dieses Entwurfs (Default `nf`) — steuert Export-Vorlage + Label. */
  artefaktTyp: BescheidTyp;
  /**
   * Der Prüfstand **zum Zeitpunkt der Erzeugung**: Konsistenz-Warnungen gegen die
   * MAP-Fachbewertung und die Zahl der Punkte ohne Baustein.
   *
   * Der Entwurf trägt ihn selbst, so wie er seinen `artefaktTyp` trägt. Bis
   * v4.122 verrechnete das Freigabe-Tor die AKTUELLE Bearbeitungs-Auswahl: es
   * genügte, die Punkte in Schritt 1 abzuwählen oder den Artefakt-Schalter
   * umzustellen, und die Karte meldete „✓ Konsistenz-Checks bestanden" — ohne
   * dass ein Check erneut gelaufen wäre. Danach stand der DOCX-Export über einem
   * Tor offen, das gerade leergeräumt wurde.
   */
  pruefstand?: { warnungen: KonsistenzWarnung[]; offeneTodos: number };
}

/**
 * Auftrag der Artefakt-Werkbank: die vom Menschen **bestätigte** Baustein-Vorauswahl
 * (nach Scope getrennt) + der Kontext der adressierten offenen Punkte. Ist er gesetzt,
 * bekommt das LLM NICHT den ganzen Katalog zur freien Wahl, sondern genau diese
 * Bausteine — es füllt nur noch deren Platzhalter. `punktKeys` landet im Audit-Stempel
 * des Runs (welche Punkte adressiert wurden).
 */
export interface WerkbankAuftrag {
  /** Welcher Bescheid erzeugt wird (bestimmt Skill + Ausgabe-Rahmung). */
  artefaktTyp: BescheidTyp;
  verbundBausteine: TextbausteinRecord[];
  tvBausteine: TextbausteinRecord[];
  /** Menschlich formulierte Punkt-Texte (mit Aspekt) — was adressiert werden soll. */
  punktKontext: string;
  punktKeys: string[];
  /** Texte der Punkte OHNE zugeordneten Baustein — sie tragen im Entwurf die
   *  zugesagte TODO-Markierung (siehe `mergeNfFuerTv`). */
  offenePunkte?: string[];
  /**
   * Der Prüfstand beim Erzeugen — wandert unverändert in jeden Entwurf
   * (`NfEntwurf.pruefstand`). Der Aufrufer kennt ihn; die Generierung reicht ihn
   * nur durch, damit das Freigabe-Tor später nicht die inzwischen geänderte
   * Bearbeitungs-Auswahl verrechnet.
   */
  pruefstand?: { warnungen: KonsistenzWarnung[]; offeneTodos: number };
}

export interface NachforderungenController {
  loading: boolean;
  busy: boolean;
  error: string | null;
  llmAvailable: boolean | null;
  vbVorhanden: boolean;
  vbDokument: DocumentFull | null;
  entwuerfe: NfEntwurf[];
  /** Erzeugt für JEDES TV einen NF-Entwurf (G-Block einmal + je TV-Block). */
  generiereAlle: () => void;
  /** Wie `generiereAlle`, aber mit bestätigter Baustein-Vorauswahl aus der Werkbank. */
  generiereWerkbank: (auftrag: WerkbankAuftrag) => void;
  refreshVb: () => void;
  stop: () => void;
  clearError: () => void;
}

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function useNachforderungen(ctx: KurzfassungContext): NachforderungenController {
  const storage = useStorage();
  const bridge = useAIBridge();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [llmAvailable, setLlmAvailable] = useState<boolean | null>(null);
  const [vb, setVb] = useState<{ dokument: DocumentFull | null; markdown: string } | null>(null);
  const [regFile, setRegFile] = useState<SkillRegistryFile | null>(null);
  const [katalog, setKatalog] = useState<{ stand: string; bausteine: TextbausteinRecord[] } | null>(null);
  const [entwuerfe, setEntwuerfe] = useState<NfEntwurf[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Der Verbund wechselt — die Entwürfe des VORIGEN gehören hier nicht mehr
    // hin. `VerbundDetail` wird beim Wechsel nicht neu gemountet (kein `key` an
    // der Route), die Sektion behielt also ihren Hook-Zustand: „Schritt 4 —
    // Entwürfe" zeigte auf B die Karten der Teilvorhaben von A, samt fremdem
    // Aktenzeichen, `mailto:`-Entwurf mit dem FKZ von A und aktivem
    // „In Vorlage exportieren" (v4.124). Ein laufender Lauf wird dabei
    // abgebrochen, sonst schriebe seine Schleife weiter in die neue Ansicht.
    abortRef.current?.abort();
    abortRef.current = null;
    setEntwuerfe([]);
    setError(null);
    (async () => {
      setLoading(true);
      try {
        const [vbRes, reg, kat] = await Promise.all([
          resolveVb(storage.idb, ctx), loadSkillRegistry(storage), loadTextbausteinKatalog(storage),
        ]);
        if (cancelled) return;
        setVb(vbRes ? { dokument: vbRes.dokument, markdown: vbRes.markdown } : null);
        setRegFile(reg.file);
        setKatalog({ stand: kat.katalog.updated_at, bausteine: kat.katalog.bausteine });
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // Nur auf den Verbund-Key reagieren (ctx wird je Render neu gebaut — sonst
    // Reload-Schleife). storage/bridge sind Context-stabil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.key]);

  /**
   * Kern der NF-Generierung. `auftrag` fehlt → voller Katalog, LLM wählt frei
   * (bisheriges Verhalten, byte-identisch). `auftrag` gesetzt → nur die bestätigten
   * Werkbank-Bausteine + Punkt-Kontext; das LLM füllt nur noch Platzhalter.
   */
  async function generiere(auftrag?: WerkbankAuftrag): Promise<void> {
    if (!vb || !regFile || !katalog) return;
    const typ: BescheidTyp = auftrag?.artefaktTyp ?? 'nf';
    // Skill je Bescheid-Typ auflösen (Default NF). Der Werkbank-Pfad kann RNE/ABL wählen.
    const aktSkill = getSkillById(regFile, SKILL_ID_BY_TYP[typ]) ?? null;
    if (!aktSkill) { setError('Der zugehörige Füll-Skill ist nicht verfügbar.'); return; }
    const aktRegeln = resolveRegeln(regFile, aktSkill);
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true); setError(null); setEntwuerfe([]);
    try {
      const transport = bridge.getTransportForSkillRun(aktSkill);
      // Erst der Guard, dann der Ping (Muster: workflow-generierung.ts). Hier
      // stand bis v4.19.0 ein ausdrückliches `openIfNeeded: true` — der Klick
      // auf „Generieren" riss bei getrennter KI einen Tab ohne Bookmarklet auf,
      // der den Lauf ohnehin nie beantwortet hätte. Jetzt der Verbinden-Dialog.
      if (!(await kiVerbindungGeprueft(bridge, transport.name))) { setLlmAvailable(false); return; }
      const reachable = await transport.ping({ openIfNeeded: false }).catch(() => false);
      setLlmAvailable(reachable);
      if (!reachable) { setError('KI nicht erreichbar — NF-Generierung derzeit nicht möglich.'); return; }

      const cap = getVbCharCap(kontextZielFuerLauf(bridge));
      const { text: vbCapped } = capVbMarkdown(vb.markdown, cap);
      const stammdaten = buildStammdaten(ctx);
      const modell = (transport as { name?: string }).name ?? 'intern';
      // NUR freigegebene Bausteine — Entwürfe (frisch importiert, in Arbeit) und
      // Stillgelegte dürfen nie in einen Nachforderungs-Entwurf geraten. Der Werkbank-
      // Auftrag trägt bereits eine kuratierte (freigegebene) Auswahl.
      const gBausteine = auftrag ? auftrag.verbundBausteine : freigegebeneBausteine(katalog.bausteine, typ, 'verbund');
      const tvBausteine = auftrag ? auftrag.tvBausteine : freigegebeneBausteine(katalog.bausteine, typ, 'tv');
      const gKatalog = formatBausteinKatalog(gBausteine);
      const tvKatalog = formatBausteinKatalog(tvBausteine);
      // Punkt-Kontext der Werkbank an den VB-Kontext hängen: sagt dem Modell, WELCHE
      // Lücken die vorgegebenen Bausteine adressieren (statt sie selbst zu suchen).
      const punktBlock = auftrag?.punktKontext.trim()
        ? `\n\n## Zu adressierende offene Punkte\n${auftrag.punktKontext.trim()}`
        : '';
      // Audit: mit WELCHEM Katalog-Stand und welchen Baustein-Fassungen erzeugt wurde.
      // Muster `vorlageRef` — ohne diesen Stempel liesse sich ein alter Entwurf später
      // nicht mehr gegen die dann geltenden Bausteine halten.
      const katalogRef: KatalogRef = {
        stand: katalog.stand,
        bausteinVersionen: Object.fromEntries(
          [...gBausteine, ...tvBausteine].map(b => [b.id, b.version]),
        ),
      };

      // 1) Verbund-Block EINMAL (G-Bausteine am Gesamtvorhaben-Kontext).
      //    Die Bedingung steht VOR dem Aufruf, nicht dahinter: ohne bestätigten
      //    Verbund-Baustein fuhr der Lauf die volle gekappte VB samt Stammdaten
      //    ans Modell und warf das Ergebnis eine Zeile später weg — Wartezeit,
      //    ein verbrauchter Chat-Reset, und beim Scheitern brach der `catch` die
      //    GANZE Generierung ab, obwohl der Lauf bedeutungslos war. Der TV-Zweig
      //    darunter macht es seit je richtig herum (v4.124).
      const gBlock = gBausteine.length > 0
        ? (await runSkill(transport, aktSkill, aktRegeln, {
          ziel: aktivesZielFuerLauf(),
          stammdaten, vbMarkdown: '', vbCharCap: cap, signal: ac.signal,
          verbundKontext: vbCapped + punktBlock, tvKontext: '', nfBausteine: gKatalog,
        })).parsed.finalerText
        : '';

      // 2) Je TV der TV-Block (T-Bausteine), dann G-Block + TV-Block mergen.
      const ergebnisse: NfEntwurf[] = [];
      const now = new Date().toISOString();
      for (const tv of ctx.teilvorhaben) {
        if (ac.signal.aborted) break;
        const tvKontext = `Teilvorhaben ${tv.nr}: ${tv.titel ?? '[ohne Titel]'} `
          + `(Antragsteller: ${tv.antragsteller ?? '[Im Antrag nicht genannt]'})\n\n${vbCapped}${punktBlock}`;
        const tvBlock = tvBausteine.length > 0
          ? (await runSkill(transport, aktSkill, aktRegeln, {
            ziel: aktivesZielFuerLauf(),
            stammdaten, vbMarkdown: '', vbCharCap: cap, signal: ac.signal,
            verbundKontext: '', tvKontext, nfBausteine: tvKatalog,
          })).parsed
          : { quellenanalyse: '', entwurf: '', finalerText: '' };
        const merged = mergeNfFuerTv(gBlock, tvBlock.finalerText, auftrag?.offenePunkte ?? []);
        const checks = pruefeNf(merged);
        const step: StepRun = {
          quellenanalyse: tvBlock.quellenanalyse,
          entwurf: tvBlock.entwurf,
          finalerText: merged,
          checks,
          status: 'entwurf',
          erstellt_am: now,
          modell,
          skillId: aktSkill.id,
          skillVersion: aktSkill.version,
        };
        // Der WorkflowRun wird je Bescheid-Typ disjunkt gekeyt (`workflow-run:<typ>:<az>`);
        // der Schritt-Key bleibt 'NF' (ein einstufiger Bescheid-Workflow, StepId-Reuse).
        const run: WorkflowRun = {
          aktenzeichen: tv.aktenzeichen, schritte: { NF: step }, aktiverSchritt: 'NF',
          erstellt_am: now, geaendert_am: now, katalogRef,
          ...(auftrag ? { werkbankPunkte: auftrag.punktKeys } : {}),
          schemaVersion: 1,
        };
        await putWorkflowRun(storage.idb, run, typ);
        ergebnisse.push({
          aktenzeichen: tv.aktenzeichen,
          titel: tv.titel,
          antragsteller: tv.antragsteller,
          text: merged,
          checks,
          freigabereif: nfFreigabereif(merged),
          mailto: buildNfMailto({ fkz: tv.aktenzeichen, nachforderungen: merged }),
          artefaktTyp: typ,
          // Der Prüfstand friert mit dem Entwurf ein (siehe `NfEntwurf.pruefstand`).
          ...(auftrag?.pruefstand ? { pruefstand: auftrag.pruefstand } : {}),
        });
        setEntwuerfe([...ergebnisse]); // inkrementell anzeigen
      }
      // Arbeitskontext-Log (Home-„Weitermachen") — rein lokal (IDB), fire-and-forget.
      // Ein Eintrag je Verbund (ctx.key), sobald mindestens ein TV-Entwurf steht.
      if (ergebnisse.length > 0) {
        void logArbeitskontext(storage.idb, {
          typ: 'nachforderung', verbundKey: ctx.key, ts: new Date().toISOString(),
        }).catch(() => {});
      }
    } catch (e) {
      if (!ac.signal.aborted) setError(errMsg(e));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  async function refreshVb(): Promise<void> {
    const vbRes = await resolveVb(storage.idb, ctx);
    setVb(vbRes ? { dokument: vbRes.dokument, markdown: vbRes.markdown } : null);
  }

  return {
    loading,
    busy,
    error,
    llmAvailable,
    vbVorhanden: vb !== null,
    vbDokument: vb?.dokument ?? null,
    entwuerfe,
    generiereAlle: () => { void generiere(); },
    generiereWerkbank: (auftrag: WerkbankAuftrag) => { void generiere(auftrag); },
    refreshVb: () => { void refreshVb(); },
    stop: () => abortRef.current?.abort(),
    clearError: () => setError(null),
  };
}
