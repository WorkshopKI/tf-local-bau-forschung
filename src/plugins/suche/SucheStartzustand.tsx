/**
 * Der Einstieg, solange nichts getippt ist.
 *
 * ERWEITERT den bisherigen Leerzustand, ersetzt ihn nicht: die Beispiel-Chips,
 * der Index-Hinweis und der Kurator-Link bleiben erhalten — sie beantworten
 * Fragen, die der Handoff gar nicht kennt (ist der Dokumentenindex überhaupt
 * eingerichtet? wer richtet ihn ein?).
 *
 * Neu sind die drei Spalten: was zuletzt gesucht wurde, was gemerkt ist, was
 * häufig gesucht wird — jeweils mit der ECHTEN Trefferzahl aus einem Probelauf.
 * Eine gepflegte Zahl wäre irgendwann falsch; eine gerechnete ist es nie.
 *
 * Die Handoff-Spalte „So findest du schneller" mit `fkz:16KN* jahr:2024` fehlt
 * bewusst: eine Feldsuche-Syntax gibt es in dieser App nicht, und eine Hilfe,
 * die Nichtvorhandenes erklärt, ist schlimmer als keine.
 */
import { Search, Clock, Bookmark, TrendingUp, FileText, Info, X } from 'lucide-react';
import { veraenderungText, type GespeicherteSuche } from './gespeicherteSuchen';

/** Statische, realistische Beispiele — je Chip eine Sucheingabe-Art
 *  (thematisch · FKZ · Mehrwort-Thema · Ort). Aus dem bisherigen Leerzustand
 *  übernommen: der Ort-Chip kam mit v4.4.4 dazu und ist die einzige Stelle, an
 *  der die Standortsuche überhaupt sichtbar ist. */
const BEISPIELE = ['Bilderkennung', '16KN055710', 'additive Fertigung', 'Dresden'] as const;

export interface StartEintrag {
  query: string;
  /** Trefferzahl aus dem Probelauf. `null` = nicht ermittelbar. */
  treffer: number | null;
}

export function SucheStartzustand({
  antraegeGeladen,
  textabschnitteImIndex,
  letzte,
  haeufig,
  gespeichert,
  gespeicherteTreffer,
  onSuche,
  onEntferneLetzte,
  onEntferneGespeicherte,
  kuratorVariant,
  onOpenDokumentenquellen,
}: {
  antraegeGeladen: number;
  textabschnitteImIndex: number;
  letzte: readonly StartEintrag[];
  haeufig: readonly StartEintrag[];
  gespeichert: readonly GespeicherteSuche[];
  /** Aktuelle Trefferzahl je gespeicherter Suche (Probelauf). */
  gespeicherteTreffer: ReadonlyMap<string, number>;
  onSuche: (query: string) => void;
  onEntferneLetzte: (query: string) => void;
  onEntferneGespeicherte: (id: string) => void;
  kuratorVariant: boolean;
  onOpenDokumentenquellen: () => void;
}): React.ReactElement {
  const indexLeer = textabschnitteImIndex === 0;

  return (
    <div className="py-6">
      <div className="grid gap-x-10 gap-y-7 md:grid-cols-2">
        <Spalte titel="Letzte Suchen" leer="Noch nichts gesucht.">
          {letzte.map(e => (
            <Zeile
              key={e.query}
              icon={<Clock size={12} aria-hidden />}
              text={e.query}
              rechts={trefferText(e.treffer)}
              onClick={() => onSuche(e.query)}
              onEntfernen={() => onEntferneLetzte(e.query)}
            />
          ))}
        </Spalte>

        <Spalte titel="Gespeicherte Suchen" leer="Noch nichts gemerkt.">
          {gespeichert.map(g => {
            const aktuell = gespeicherteTreffer.get(g.id) ?? null;
            const diff = veraenderungText(g, aktuell);
            return (
              <Zeile
                key={g.id}
                icon={<Bookmark size={12} aria-hidden />}
                text={g.name}
                rechts={
                  <>
                    {diff && (
                      <span className="mr-2 text-[var(--tf-success-text)]">{diff}</span>
                    )}
                    {trefferText(aktuell)}
                  </>
                }
                onClick={() => onSuche(g.query)}
                onEntfernen={() => onEntferneGespeicherte(g.id)}
              />
            );
          })}
        </Spalte>

        <Spalte titel="Häufig gesucht" leer="Zu wenig Verlauf.">
          {haeufig.map(e => (
            <Zeile
              key={e.query}
              icon={<TrendingUp size={12} aria-hidden />}
              text={e.query}
              rechts={trefferText(e.treffer)}
              onClick={() => onSuche(e.query)}
            />
          ))}
        </Spalte>

        <Spalte titel="Aus dem Index">
          <div className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-[var(--tf-text)]">
            <FileText size={12} className="text-[var(--tf-text-tertiary)]" aria-hidden />
            <span className="flex-1">
              {antraegeGeladen.toLocaleString('de-DE')} Anträge
            </span>
            <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">durchsuchbar</span>
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-[var(--tf-text)]">
            <FileText size={12} className="text-[var(--tf-text-tertiary)]" aria-hidden />
            <span className="flex-1">
              {textabschnitteImIndex.toLocaleString('de-DE')} Textabschnitte
            </span>
            <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">im Volltext</span>
          </div>

          <p className="mt-2 px-2 text-[12px] leading-relaxed text-[var(--tf-text-secondary)]">
            Nach Titel, Akronym, FKZ, Antragsteller oder Ort — mit
            Ähnlichkeitssuche findest du auch thematisch verwandte Vorhaben.
          </p>

          {/* Beispiele — starten die Suche über den regulären Pfad. */}
          <div className="mt-2 flex flex-wrap items-center gap-2 px-2">
            {BEISPIELE.map(b => (
              <button
                key={b}
                type="button"
                onClick={() => onSuche(b)}
                title={`„${b}" suchen`}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] cursor-pointer"
                style={{ border: '0.5px solid var(--tf-border)' }}
              >
                <Search size={11} className="text-[var(--tf-text-tertiary)]" aria-hidden />
                {b}
              </button>
            ))}
          </div>
        </Spalte>
      </div>

      {/* Index-Hinweis — NUR bei leerem Dokumentenindex, dezent, keine CTA.
          Index-Einrichtung ist Kurator-Aufgabe, nicht Nutzer-Aufgabe. */}
      {indexLeer && (
        <div className="mt-8 max-w-2xl pt-4" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
          <p className="inline-flex items-start gap-1.5 text-[11.5px] leading-relaxed text-[var(--tf-text-tertiary)]">
            <Info size={12} className="mt-[2px] shrink-0" aria-hidden />
            <span>
              Volltextsuche in Dokumenten ist noch nicht eingerichtet — sobald der
              Dokumentenindex vorliegt, erscheinen auch Treffer aus Vorhabensbeschreibungen.
              {kuratorVariant && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={onOpenDokumentenquellen}
                    className="underline underline-offset-2 hover:text-[var(--tf-text-secondary)] cursor-pointer"
                  >
                    Dokumentenquellen öffnen
                  </button>
                </>
              )}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

function Spalte({ titel, leer, children }: {
  titel: string;
  leer?: string;
  children?: React.ReactNode;
}): React.ReactElement {
  const hatInhalt = Array.isArray(children) ? children.length > 0 : children !== undefined;
  return (
    <section>
      <h2 className="mb-1 px-2 text-[10.5px] uppercase tracking-[0.1em] text-[var(--tf-text-tertiary)]">
        {titel}
      </h2>
      {hatInhalt
        ? <div className="flex flex-col">{children}</div>
        : <p className="px-2 py-1.5 text-[12.5px] text-[var(--tf-text-tertiary)]">{leer}</p>}
    </section>
  );
}

function Zeile({ icon, text, rechts, onClick, onEntfernen }: {
  icon: React.ReactNode;
  text: string;
  rechts: React.ReactNode;
  onClick: () => void;
  onEntfernen?: () => void;
}): React.ReactElement {
  return (
    <div className="group flex items-center gap-2 rounded-[6px] hover:bg-[var(--tf-hover)]">
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left cursor-pointer"
      >
        <span className="shrink-0 text-[var(--tf-text-tertiary)]">{icon}</span>
        <span className="truncate text-[13px] text-[var(--tf-text)]">{text}</span>
      </button>
      <span className="shrink-0 pr-1 text-[11.5px] text-[var(--tf-text-tertiary)]">{rechts}</span>
      {onEntfernen && (
        <button
          type="button"
          onClick={onEntfernen}
          title="Aus der Liste entfernen"
          className="mr-1 rounded p-0.5 text-[var(--tf-text-tertiary)] opacity-0 transition-opacity hover:text-[var(--tf-text)] group-hover:opacity-100 cursor-pointer"
        >
          <X size={12} aria-hidden />
        </button>
      )}
    </div>
  );
}

/** „6 Treffer" — oder gar nichts, solange die Zahl nicht feststeht. Ein
 *  Platzhalter wie „—" liest sich wie „null Treffer". */
function trefferText(n: number | null): React.ReactNode {
  return n === null ? null : `${n.toLocaleString('de-DE')} Treffer`;
}
