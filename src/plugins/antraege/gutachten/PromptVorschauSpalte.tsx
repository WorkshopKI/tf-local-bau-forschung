/**
 * „Was daraus wirklich an die KI geht" — direkt unter dem Prompt-Feld der
 * Inline-Werkstatt.
 *
 * Der Grund steht im Kopf von [PromptAnsichtDialog](./PromptAnsichtDialog.tsx):
 * die Vorlage ist nicht der Lauf. Dahinter hängen bis zu neun Blöcke — die
 * formalen Vorgaben aus den Regeln, die Teil-Aufgabe, die Abnahme-Kriterien — und
 * sie stehen NACH dem Template, können es also überstimmen. Wer eine Zeile in die
 * Vorlage schreibt und nicht sieht, dass ein späterer Block sie aufhebt, ändert
 * den Prompt und wundert sich über das gleiche Ergebnis.
 *
 * Rein gerechnet: `renderSkillPrompt` macht kein IO und keinen Transport, der
 * ganze Block kostet keinen KI-Aufruf. Der 300-ms-Debounce des MarkdownEditor
 * sorgt dafür, dass nicht pro Tastendruck neu gerechnet wird.
 *
 * Die Bausteine (Maße, Blockliste, VB-Trennung) kommen aus `promptAnsicht.ts` —
 * dieselbe Quelle wie die große Prompt-Ansicht, kein zweiter Rechenweg.
 */
import { Check, Minus } from 'lucide-react';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import type { PromptAnsichtDaten } from './useGutachtenWorkflow';
import { beschreibeBloecke, promptMasse, trennePromptAmVb } from './promptAnsicht';

const zahl = (n: number): string => n.toLocaleString('de-DE');

export function PromptVorschauSpalte({ daten }: { daten: PromptAnsichtDaten | null }): React.ReactElement {
  if (!daten) {
    return (
      <CollapsibleSection label="Was daraus wirklich an die KI geht" defaultOpen={false}>
        <p className="text-[12px] text-[var(--tf-text-tertiary)] py-2 m-0">
          Für diesen Skill lässt sich gerade keine Vorschau rechnen — er hängt an keinem Schritt
          des offenen Gutachtens.
        </p>
      </CollapsibleSection>
    );
  }

  const masse = promptMasse(daten.vorschau, daten.cap);
  const bloecke = beschreibeBloecke(daten.skill, daten.regeln, daten.eingabe);
  const teile = trennePromptAmVb(daten.vorschau.user, daten.vorschau.vb);
  const zellen: { label: string; wert: string }[] = [
    { label: 'Zeichen gesamt', wert: zahl(masse.zeichen) },
    { label: 'davon Vorhabensbeschreibung', wert: zahl(masse.vbZeichen) },
    { label: 'davon Anweisungen', wert: zahl(masse.anweisungsZeichen) },
    { label: 'Platz im Kontextfenster', wert: zahl(masse.cap) },
  ];

  return (
    <CollapsibleSection
      label="Was daraus wirklich an die KI geht"
      subtitle={`${zahl(masse.zeichen)} Zeichen`}
      defaultOpen={false}
    >
      <div className="flex flex-col gap-3 py-1">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-x-4 gap-y-2.5 px-3.5 py-3 bg-[var(--tf-bg-secondary)] rounded-[10px]">
          {zellen.map(z => (
            <div key={z.label} className="flex flex-col gap-0.5">
              <span className="text-[11px] leading-[1.3] text-[var(--tf-text-tertiary)]">{z.label}</span>
              <span className="font-mono text-[13px] text-[var(--tf-text)]">{z.wert}</span>
            </div>
          ))}
        </div>

        {/* Die Reihenfolge IST die Aussage: was weiter unten steht, hat das letzte Wort. */}
        <div className="border-[0.5px] border-[var(--tf-border)] rounded-[10px] overflow-hidden">
          <div className="px-3.5 py-2 bg-[var(--tf-bg-secondary)] text-[11px] uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)]">
            Bausteine — in dieser Reihenfolge angehängt
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

        {/* Wortlaut ohne die VB — die kennt der Bearbeiter, und sechsstellige
            Zeichenzahlen machen den Dialog unbenutzbar. */}
        <div>
          <div className="text-[11px] uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)] mb-1.5">
            Nachricht an die KI{teile.vb ? ` (ohne die ${zahl(teile.vb.length)} Zeichen Vorhabensbeschreibung)` : ''}
          </div>
          <pre className="font-mono text-[11.5px] leading-[1.55] whitespace-pre-wrap break-words text-[var(--tf-text-secondary)] m-0 max-h-[320px] overflow-auto">
            {`${teile.vor}${teile.vb ? '\n\n[… Vorhabensbeschreibung …]\n\n' : ''}${teile.nach}`}
          </pre>
        </div>

        {daten.relevanzOffen && (
          <p className="m-0 text-[11.5px] leading-[1.5] text-[var(--tf-text-tertiary)]">
            Dieser Abschnitt nutzt die Relevanz-Map: im echten Lauf steht statt der vollständigen
            Vorhabensbeschreibung nur der einschlägige Ausschnitt. Die Maße oben rechnen mit dem Volltext.
          </p>
        )}
      </div>
    </CollapsibleSection>
  );
}
