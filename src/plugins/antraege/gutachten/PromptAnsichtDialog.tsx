/**
 * „Was geht wirklich an die KI?" — der zusammengesetzte Prompt eines Abschnitts.
 *
 * Der Skill-Editor zeigt die Vorlage, nicht den Lauf. Zwischen beiden liegen bis zu
 * neun angehängte Blöcke und die im Volltext eingesetzte Vorhabensbeschreibung, die
 * am Kontextfenster gekappt wird. Genau diese Differenz macht dieser Dialog sichtbar:
 * Maße zuerst (ist er zu lang?), dann die Blockliste (ist er zu komplex?), dann der
 * Wortlaut.
 *
 * Zwei Sichten: die VORSCHAU des nächsten Laufs (immer verfügbar, auch ohne KI) und
 * das ZULETZT GESENDETE (session-lokal, aus `SkillRunResult.gesendet`). Beide kommen
 * aus derselben Kette wie der echte Lauf — hier wird nichts nachgebaut.
 */
import { useState } from 'react';
import { Copy, AlertTriangle, Check, Minus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { kopiereText } from '@/core/utils/kopieren';
import { VB_KUERZEN_HINWEIS } from '@/core/services/skills';
import type { PromptAnsichtDaten } from './useGutachtenWorkflow';
import {
  beschreibeBloecke, beschrifteGesendet, promptMasse, masseVonGesendetGesamt, trennePromptAmVb,
  type GesendeterPrompt, type PromptMasse,
} from './promptAnsicht';

interface Props {
  daten: PromptAnsichtDaten;
  /** Abschnitts-Label für den Kopf-Pill (z.B. „A — Kurzfassung"). */
  sektionLabel: string;
  onClose: () => void;
  /** Der natürliche nächste Schritt: „Ich habe gesehen, was rausgeht — jetzt ändere
   *  ich es." Nur gesetzt, wo die Werkstatt zugänglich ist (`useWerkstattZugang`). */
  onBearbeiten?: () => void;
}

const zahl = (n: number): string => n.toLocaleString('de-DE');

/** Monospace-Block; `leer` beschreibt, was statt eines leeren Textes dasteht. */
function Roh({ text, leer }: { text: string; leer?: string }): React.ReactElement {
  return (
    <pre className="font-mono text-[11.5px] leading-[1.55] whitespace-pre-wrap break-words text-[var(--tf-text-secondary)] m-0">
      {text || (leer ?? '— leer —')}
    </pre>
  );
}

/** Die Maß-Leiste — die eigentliche Antwort auf „ist der Prompt zu lang?". */
function MassLeiste({ masse }: { masse: PromptMasse }): React.ReactElement {
  const zellen: { label: string; wert: string }[] = [
    { label: 'Zeichen gesamt', wert: zahl(masse.zeichen) },
    { label: 'davon Vorhabensbeschreibung', wert: zahl(masse.vbZeichen) },
    { label: 'davon Anweisungen', wert: zahl(masse.anweisungsZeichen) },
    { label: 'Tokens (geschätzt)', wert: `~${zahl(masse.tokenSchaetzung)}` },
    { label: 'Platz im Kontextfenster', wert: zahl(masse.cap) },
  ];
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-x-4 gap-y-2.5 px-3.5 py-3 bg-[var(--tf-bg-secondary)] rounded-[10px]">
      {zellen.map(z => (
        <div key={z.label} className="flex flex-col gap-0.5">
          <span className="text-[11px] leading-[1.3] text-[var(--tf-text-tertiary)]">{z.label}</span>
          <span className="font-mono text-[13px] text-[var(--tf-text)]">{z.wert}</span>
        </div>
      ))}
    </div>
  );
}

/** Ein Prompt (System + User), VB standardmäßig eingeklappt. */
function PromptBlockAnsicht({ system, user, vb }: { system: string; user: string; vb: string }): React.ReactElement {
  const teile = trennePromptAmVb(user, vb);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-[11px] uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)] mb-1.5">System-Rolle</div>
        <Roh text={system} leer="— dieser Skill führt keine System-Rolle —" />
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)] mb-1.5">Nachricht an die KI</div>
        <Roh text={teile.vor} />
        {teile.vb && (
          // Eingeklappt: ein <pre> mit sechsstelliger Zeichenzahl macht den Dialog
          // sonst unbenutzbar — und der VB-Wortlaut ist genau der Teil, den der
          // Bearbeiter ohnehin kennt.
          <div className="my-2">
            <CollapsibleSection
              label={`Vorhabensbeschreibung — ${zahl(teile.vb.length)} Zeichen`}
              defaultOpen={false}
            >
              <Roh text={teile.vb} />
            </CollapsibleSection>
          </div>
        )}
        {teile.nach && <Roh text={teile.nach} />}
      </div>
    </div>
  );
}

export function PromptAnsichtDialog({ daten, sektionLabel, onClose, onBearbeiten }: Props): React.ReactElement {
  const [sicht, setSicht] = useState<'vorschau' | 'gesendet'>(
    daten.gesendet.length > 0 ? 'gesendet' : 'vorschau',
  );

  const bloecke = beschreibeBloecke(daten.skill, daten.regeln, daten.eingabe);
  const vorschauMasse = promptMasse(daten.vorschau, daten.cap);
  const aktiveGesendet: GesendeterPrompt[] = daten.gesendet;
  // ALLE gesendeten Prompts messen, nicht nur den ersten: bei einer
  // Teil-Generierung trägt jeder Lauf die volle VB, das Feinschliff-Bein gar keine —
  // und die Leiste ist mit „Zeichen gesamt" beschriftet.
  const masse = sicht === 'gesendet'
    ? masseVonGesendetGesamt(aktiveGesendet, daten.cap) ?? vorschauMasse
    : vorschauMasse;

  // Ein Lauf kann MEHRERE Prompts senden — Teil-Generierung (mehrere Generierungs-
  // Läufe) und das angehängte Feinschliff-Bein. Die Beschriftung kommt aus der reinen
  // `beschrifteGesendet`, damit Überschrift und Kopier-Text dieselbe Sprache sprechen.
  const beschriftungen = beschrifteGesendet(aktiveGesendet);
  const volltext = sicht === 'gesendet' && aktiveGesendet.length > 0
    ? aktiveGesendet.map((p, i) => {
        const kopf = beschriftungen[i] ? `===== ${beschriftungen[i]} =====\n` : '';
        return `${kopf}${p.system ? `${p.system}\n\n` : ''}${p.user}`;
      }).join('\n\n')
    : `${daten.vorschau.system ? `${daten.vorschau.system}\n\n` : ''}${daten.vorschau.user}`;

  const kopieren = useAsyncAction(async () => { await kopiereText(volltext); });

  const title = (
    <span className="flex items-center gap-2.5 flex-wrap">
      Prompt an die KI
      <span className="h-[22px] inline-flex items-center px-2.5 rounded-full bg-[var(--tf-bg-secondary)] border-[0.5px] border-[var(--tf-border)] text-[11.5px] font-medium text-[var(--tf-text-secondary)]">
        {sektionLabel}
      </span>
    </span>
  );

  const footer = (
    <>
      {/* Die Fußzeile beschreibt IMMER den nächsten Lauf. Im Reiter „Zuletzt
          gesendet" steht darüber ein alter Lauf, dessen Modell-Einstellungen
          andere gewesen sein können (Zweitfassung: Temperatur 0,4) — deshalb
          nennt sie dort ausdrücklich den nächsten Lauf, statt die Werte als die
          des gezeigten auszugeben (v4.124). */}
      <span className="mr-auto text-[11px] font-mono text-[var(--tf-text-tertiary)]">
        {sicht === 'gesendet' ? 'Nächster Lauf: ' : ''}
        {daten.skill.name} v{daten.skill.version} · Ausgabe-Budget {zahl(daten.vorschau.maxTokens)} Tokens
        {/* Immer mit Nachkommastelle: „Temperatur 1" liest sich wie eine Stufe,
            „Temperatur 1,0" wie der Messwert, der es ist — und passt zu „0,4". */}
        {' · '}Temperatur {daten.vorschau.temperatur.toLocaleString('de-DE', { minimumFractionDigits: 1 })}
      </span>
      <Button variant="ghost" icon={Copy} onClick={() => kopieren.run()} loading={kopieren.busy}>
        Kopieren
      </Button>
      {onBearbeiten && (
        <Button variant="secondary" icon={Pencil} onClick={onBearbeiten}>
          Anweisung bearbeiten
        </Button>
      )}
      <Button variant="primary" onClick={onClose}>Schließen</Button>
    </>
  );

  return (
    <Dialog open onClose={onClose} title={title} footer={footer} size="lg" className="max-w-[860px]">
      <MassLeiste masse={masse} />

      {masse.vbGekuerzt && (
        <div className="flex items-start gap-2 mt-2.5 px-3.5 py-3 rounded-[10px] bg-[var(--tf-danger-bg)]">
          <AlertTriangle size={15} className="shrink-0 mt-[1px] text-[var(--tf-danger-text)]" />
          <span className="text-[12.5px] leading-[1.5] text-[var(--tf-text)]">
            <b className="font-medium">Die Vorhabensbeschreibung passt nicht vollständig ins Kontextfenster</b> — der
            Schluss wird abgeschnitten und fließt nicht in den Text ein. {VB_KUERZEN_HINWEIS}
          </span>
        </div>
      )}

      {kopieren.error && (
        <div className="mt-2.5 text-[12px] text-[var(--tf-danger-text)] bg-[var(--tf-danger-bg)] rounded-[8px] px-3 py-2">
          {kopieren.error}
        </div>
      )}

      <div className="mt-4">
        <ScopeTabs
          variant="pills"
          aria-label="Prompt-Sicht"
          activeKey={sicht}
          onChange={(k) => setSicht(k as 'vorschau' | 'gesendet')}
          items={[
            { key: 'vorschau', label: 'Vorschau — nächster Lauf' },
            {
              key: 'gesendet',
              label: 'Zuletzt gesendet',
              ...(aktiveGesendet.length > 1 ? { count: aktiveGesendet.length } : {}),
              disabled: aktiveGesendet.length === 0,
              ...(aktiveGesendet.length === 0
                ? { title: 'Noch kein Lauf in dieser Sitzung — die Vorschau zeigt, was gesendet würde.' }
                : {}),
            },
          ]}
        />
      </div>

      {sicht === 'vorschau' && (
        <>
          {daten.teilAnzahl !== undefined && daten.teilAnzahl > 1 && (
            <p className="mt-2 text-[11.5px] text-[var(--tf-text-tertiary)]">
              Dieser Abschnitt wird in {daten.teilAnzahl} Läufen erzeugt — die Vorschau
              zeigt den ersten Teil. Umfangs- und Absatz-Vorgaben werden dabei durch die
              Teil-Vorgabe ersetzt.
            </p>
          )}
          <div className="mt-3.5 border-[0.5px] border-[var(--tf-border)] rounded-[10px] overflow-hidden">
            <div className="px-3.5 py-2 bg-[var(--tf-bg-secondary)] text-[11px] uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)]">
              Bausteine dieses Prompts
            </div>
            <ul className="m-0 p-0 list-none">
              {bloecke.map(b => (
                <li
                  key={b.key}
                  className={`flex items-start gap-2.5 px-3.5 py-2 border-t-[0.5px] border-[var(--tf-border)] ${b.vorhanden ? '' : 'opacity-55'}`}
                >
                  {b.vorhanden
                    ? <Check size={14} className="shrink-0 mt-[2px] text-[var(--tf-primary)]" />
                    : <Minus size={14} className="shrink-0 mt-[2px] text-[var(--tf-text-tertiary)]" />}
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[12.5px] leading-[1.35] text-[var(--tf-text)]">{b.label}</span>
                    <span className="text-[11.5px] leading-[1.45] text-[var(--tf-text-tertiary)]">{b.hinweis}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {daten.relevanzOffen && (
            <p className="mt-2.5 mb-0 text-[11.5px] leading-[1.5] text-[var(--tf-text-tertiary)]">
              Dieser Abschnitt nutzt die Relevanz-Map: im echten Lauf steht statt der vollständigen
              Vorhabensbeschreibung nur der als einschlägig markierte Ausschnitt. Die Vorschau zeigt den Volltext,
              weil die Map erst zur Laufzeit berechnet wird.
            </p>
          )}

          <div className="mt-4">
            <PromptBlockAnsicht system={daten.vorschau.system} user={daten.vorschau.user} vb={daten.vorschau.vb} />
          </div>
        </>
      )}

      {sicht === 'gesendet' && (
        <div className="mt-4 flex flex-col gap-5">
          {aktiveGesendet.map((p, i) => (
            <div key={i}>
              {beschriftungen[i] && (
                <div className="text-[12px] font-medium text-[var(--tf-text)] mb-2">
                  {beschriftungen[i]}
                </div>
              )}
              <PromptBlockAnsicht system={p.system} user={p.user} vb={p.vb} />
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
