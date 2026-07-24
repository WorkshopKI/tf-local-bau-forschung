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
import {
  runSkill, loadSkillRegistry, getSkillById, resolveRegeln, capVbMarkdown,
  loadTextbausteinKatalog, freigegebeneBausteine,
  NF_SKILL_ID, type CheckResult, type SkillRecord, type QualitaetsRegel,
  type KatalogRef, type TextbausteinRecord,
} from '@/core/services/skills';
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

/** Ein fertiger NF-Entwurf für ein Teilvorhaben. */
export interface NfEntwurf {
  aktenzeichen: string;
  titel: string | null;
  antragsteller: string | null;
  text: string;
  checks: CheckResult[];
  freigabereif: boolean;
  mailto: string;
}

/**
 * Auftrag der Artefakt-Werkbank: die vom Menschen **bestätigte** Baustein-Vorauswahl
 * (nach Scope getrennt) + der Kontext der adressierten offenen Punkte. Ist er gesetzt,
 * bekommt das LLM NICHT den ganzen Katalog zur freien Wahl, sondern genau diese
 * Bausteine — es füllt nur noch deren Platzhalter. `punktKeys` landet im Audit-Stempel
 * des Runs (welche Punkte adressiert wurden).
 */
export interface WerkbankAuftrag {
  verbundBausteine: TextbausteinRecord[];
  tvBausteine: TextbausteinRecord[];
  /** Menschlich formulierte Punkt-Texte (mit Aspekt) — was adressiert werden soll. */
  punktKontext: string;
  punktKeys: string[];
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
  const [skill, setSkill] = useState<SkillRecord | null>(null);
  const [regeln, setRegeln] = useState<QualitaetsRegel[]>([]);
  const [katalog, setKatalog] = useState<{ stand: string; bausteine: TextbausteinRecord[] } | null>(null);
  const [entwuerfe, setEntwuerfe] = useState<NfEntwurf[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [vbRes, reg, kat] = await Promise.all([
          resolveVb(storage.idb, ctx), loadSkillRegistry(storage), loadTextbausteinKatalog(storage),
        ]);
        if (cancelled) return;
        setVb(vbRes ? { dokument: vbRes.dokument, markdown: vbRes.markdown } : null);
        const sk = getSkillById(reg.file, NF_SKILL_ID) ?? null;
        setSkill(sk);
        setRegeln(sk ? resolveRegeln(reg.file, sk) : []);
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
    if (!vb || !skill || !katalog) return;
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true); setError(null); setEntwuerfe([]);
    try {
      const transport = bridge.getTransportForSkillRun(skill);
      const reachable = await transport.ping({ openIfNeeded: true }).catch(() => false);
      setLlmAvailable(reachable);
      if (!reachable) { setError('KI nicht erreichbar — NF-Generierung derzeit nicht möglich.'); return; }

      const cap = getVbCharCap(kontextZielFuerLauf(bridge));
      const { text: vbCapped } = capVbMarkdown(vb.markdown, cap);
      const stammdaten = buildStammdaten(ctx);
      const modell = (transport as { name?: string }).name ?? 'intern';
      // NUR freigegebene Bausteine — Entwürfe (frisch importiert, in Arbeit) und
      // Stillgelegte dürfen nie in einen Nachforderungs-Entwurf geraten. Der Werkbank-
      // Auftrag trägt bereits eine kuratierte (freigegebene) Auswahl.
      const gBausteine = auftrag ? auftrag.verbundBausteine : freigegebeneBausteine(katalog.bausteine, 'nf', 'verbund');
      const tvBausteine = auftrag ? auftrag.tvBausteine : freigegebeneBausteine(katalog.bausteine, 'nf', 'tv');
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
      const gRes = await runSkill(transport, skill, regeln, {
        ziel: aktivesZielFuerLauf(),
        stammdaten, vbMarkdown: '', vbCharCap: cap, signal: ac.signal,
        verbundKontext: vbCapped + punktBlock, tvKontext: '', nfBausteine: gKatalog,
      });
      const gBlock = gBausteine.length > 0 ? gRes.parsed.finalerText : '';

      // 2) Je TV der TV-Block (T-Bausteine), dann G-Block + TV-Block mergen.
      const ergebnisse: NfEntwurf[] = [];
      const now = new Date().toISOString();
      for (const tv of ctx.teilvorhaben) {
        if (ac.signal.aborted) break;
        const tvKontext = `Teilvorhaben ${tv.nr}: ${tv.titel ?? '[ohne Titel]'} `
          + `(Antragsteller: ${tv.antragsteller ?? '[Im Antrag nicht genannt]'})\n\n${vbCapped}${punktBlock}`;
        const tvBlock = tvBausteine.length > 0
          ? (await runSkill(transport, skill, regeln, {
            ziel: aktivesZielFuerLauf(),
            stammdaten, vbMarkdown: '', vbCharCap: cap, signal: ac.signal,
            verbundKontext: '', tvKontext, nfBausteine: tvKatalog,
          })).parsed
          : { quellenanalyse: '', entwurf: '', finalerText: '' };
        const merged = mergeNfFuerTv(gBlock, tvBlock.finalerText);
        const checks = pruefeNf(merged);
        const step: StepRun = {
          quellenanalyse: tvBlock.quellenanalyse,
          entwurf: tvBlock.entwurf,
          finalerText: merged,
          checks,
          status: 'entwurf',
          erstellt_am: now,
          modell,
          skillId: skill.id,
          skillVersion: skill.version,
        };
        const run: WorkflowRun = {
          aktenzeichen: tv.aktenzeichen, schritte: { NF: step }, aktiverSchritt: 'NF',
          erstellt_am: now, geaendert_am: now, katalogRef,
          ...(auftrag ? { werkbankPunkte: auftrag.punktKeys } : {}),
          schemaVersion: 1,
        };
        await putWorkflowRun(storage.idb, run, 'nf');
        ergebnisse.push({
          aktenzeichen: tv.aktenzeichen,
          titel: tv.titel,
          antragsteller: tv.antragsteller,
          text: merged,
          checks,
          freigabereif: nfFreigabereif(merged),
          mailto: buildNfMailto({ fkz: tv.aktenzeichen, nachforderungen: merged }),
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
