/**
 * Der Einstieg, solange nichts getippt ist — EIN Panel mit Reitern.
 *
 * Bis v4.72 standen hier sechs gleichrangige Blöcke untereinander: vier Spalten
 * (Letzte Suchen, Gespeicherte Suchen, Häufig gesucht, Aus dem Index) und zwei
 * Sektionen über die volle Breite. Nichts stach heraus, die Seite scrollte, und
 * der Blick musste sich jedes Mal neu orientieren. Zwei der Blöcke trugen dabei
 * nichts Eigenes: „Aus dem Index" nannte die Zahlen, die seit v4.69 ohnehin am
 * rechten Ende der Optionszeile stehen, und „Häufig gesucht" ist die zweite
 * Hälfte derselben Verlaufsliste wie „Letzte Suchen".
 *
 * Jetzt: ein Ort, fünf Reiter, feste Fläche. Die Rubriken bleiben, sie
 * konkurrieren nur nicht mehr um dieselbe.
 *
 * **Diese Datei ist die Hülle** — Rahmen, Reiterleiste, Verteilung. Was in
 * einem Reiter steht, lebt in `start/` je in einer eigenen Datei; das Panel
 * weiß davon nur, wie es sie aufruft.
 *
 * **Das Panel filtert NICHT mit, während getippt wird.** Der Handoff schlug das
 * vor; die Vervollständigung im Suchfeld beantwortet denselben Tastendruck seit
 * v4.71 und tut mehr — Feldnamen, echte Werte des Bestands, Trefferzahlen — und
 * ihre Liste liegt ohnehin über dieser Fläche. Zwei Antworten auf eine Eingabe
 * wären eine zu viel.
 */
import { useCallback, useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import type { WertIndex } from '@/plugins/antraege/services/wert-index';
import type { GespeicherteSuche } from './gespeicherteSuchen';
import {
  baueStartReiter, leseStartReiter, START_REITER_KEY, type StartReiterId,
} from './start/startReiter';
import { StartZuletzt, type StartEintrag } from './start/StartZuletzt';
import { StartSuchsprache } from './start/StartSuchsprache';
import { StartFragen, FRAGEN } from './start/StartFragen';
import { StartStoebern } from './start/StartStoebern';
import { STOEBER_FELDER } from './start/stoebern';
import { SUCHARTEN } from './start/suchsprache';

export type { StartEintrag };

/**
 * Wie viele Zeilen je Rubrik im Reiter „Alle" stehen.
 *
 * Vier, weil vier Zeilen eine Rubrik erkennbar machen, ohne dass eine von ihnen
 * die Fläche gewinnt.
 */
const KURZ = 4;

/**
 * Damit der Reiterwechsel die Fläche nicht springen lässt.
 *
 * In dev:local am echten Bestand gemessen: „Alle" 420 px, „Suchsprache" 408,
 * die übrigen drei kämen mit rund 300 aus. Ohne festes Maß wanderte die
 * Unterkante bei jedem Reiterwechsel um gut 120 px — genau das, was ein Panel
 * mit fester Fläche verhindern soll. Der leere Rest auf einem dünn besetzten
 * Reiter ist der Preis dafür; der Standard-Reiter „Alle" füllt ihn ohnehin.
 */
const PANEL_MIN_HOEHE = 420;

export function SucheStartzustand({
  textabschnitteImIndex,
  letzte,
  haeufig,
  gespeichert,
  gespeicherteTreffer,
  wertIndex,
  zaehle,
  onSuche,
  onWiederholen,
  onFrage,
  gewuenschterReiter,
  onEntferneLetzte,
  onEntferneGespeicherte,
  kuratorVariant,
  onOpenDokumentenquellen,
}: {
  textabschnitteImIndex: number;
  letzte: readonly StartEintrag[];
  haeufig: readonly StartEintrag[];
  gespeichert: readonly GespeicherteSuche[];
  /** Aktuelle Trefferzahl je gespeicherter Suche (Probelauf). */
  gespeicherteTreffer: ReadonlyMap<string, number>;
  /** Der Wertevorrat des Bestands — Grundlage des Reiters „Stöbern". */
  wertIndex: WertIndex | null;
  /** Probelauf für die Zahlen im Reiter „Stöbern". */
  zaehle?: (anfrage: string) => number | null;
  onSuche: (query: string) => void;
  /**
   * Eine SCHON GELAUFENE Anfrage wieder aufnehmen — Verlauf, häufig Gesuchtes,
   * Gemerktes.
   *
   * Getrennt von `onSuche`, weil sie etwas anderes ist als ein Beispiel aus der
   * Suchsprache: sie ist fertig und war schon einmal ein Auftrag. Deshalb läuft
   * sie auch gleich, statt im Feld auf eine zweite Geste zu warten. Fehlt sie,
   * bleibt es beim reinen Übernehmen.
   */
  onWiederholen?: (query: string) => void;
  /** Eine Frage stellen (setzt Text UND Modus). Fehlt, wenn der Build die
   *  natürlichsprachige Suche nicht mitbringt — dann entfällt der Reiter. */
  onFrage?: (frage: string) => void;
  /**
   * Ein von außen gewünschter Reiter — z. B. „Fragen", wenn gerade auf die
   * Suchart „einer Frage" umgeschaltet wurde.
   *
   * Der `nonce` macht denselben Wunsch wiederholbar; ohne ihn öffnete das
   * zweite Umschalten auf dieselbe Id nichts mehr. Der Wunsch überschreibt den
   * aktiven Reiter, aber NICHT den gemerkten: was der Nutzer selbst gewählt
   * hat, steht beim nächsten Besuch wieder da.
   */
  gewuenschterReiter?: { id: StartReiterId; nonce: number } | null;
  onEntferneLetzte: (query: string) => void;
  onEntferneGespeicherte: (id: string) => void;
  kuratorVariant: boolean;
  onOpenDokumentenquellen: () => void;
}): React.ReactElement {
  const mitFragen = onFrage !== undefined;
  const [aktiv, setAktiv] = useState<StartReiterId>(() => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(START_REITER_KEY); } catch { /* ignore */ }
    return leseStartReiter(raw, mitFragen);
  });

  const waehle = useCallback((key: string): void => {
    const id = leseStartReiter(key, mitFragen);
    setAktiv(id);
    try { localStorage.setItem(START_REITER_KEY, id); } catch { /* ignore */ }
  }, [mitFragen]);

  // Der Wunsch von außen wirkt auf den ANGEZEIGTEN Reiter, nicht auf den
  // gemerkten — deshalb `setAktiv` statt `waehle`. Ein Reiter, den der Build
  // gar nicht führt, wird ignoriert statt auf „alle" umgebogen: der Wunsch käme
  // dann von einer Stelle, die es hier nicht gibt.
  useEffect(() => {
    if (!gewuenschterReiter) return;
    if (gewuenschterReiter.id === 'fragen' && !mitFragen) return;
    setAktiv(gewuenschterReiter.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- der nonce IST der Auslöser
  }, [gewuenschterReiter?.nonce]);

  const reiter = baueStartReiter({
    zuletzt: letzte.length + haeufig.length + gespeichert.length,
    suchsprache: SUCHARTEN.length,
    fragen: FRAGEN.length,
    stoebern: wertIndex === null ? 0 : STOEBER_FELDER.length,
  }, mitFragen);

  const zuletzt = (max?: number): React.ReactElement => (
    <StartZuletzt
      letzte={letzte}
      haeufig={haeufig}
      gespeichert={gespeichert}
      gespeicherteTreffer={gespeicherteTreffer}
      onSuche={onWiederholen ?? onSuche}
      onEntferneLetzte={onEntferneLetzte}
      onEntferneGespeicherte={onEntferneGespeicherte}
      max={max}
      onMehr={() => waehle('zuletzt')}
    />
  );

  return (
    <div className="py-6">
      <div
        className="w-full max-w-6xl overflow-hidden rounded-[var(--tf-radius-lg)]"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <div
          className="px-3 py-2"
          style={{
            borderBottom: '0.5px solid var(--tf-border)',
            background: 'var(--tf-bg-secondary)',
          }}
        >
          <ScopeTabs
            items={reiter}
            activeKey={aktiv}
            onChange={waehle}
            variant="pills"
            aria-label="Einstieg in die Suche"
          />
        </div>

        <div className="px-3 py-4" style={{ minHeight: PANEL_MIN_HOEHE }}>
          {aktiv === 'alle' && (
            <div className="flex flex-col gap-6">
              {zuletzt(KURZ)}
              <StartSuchsprache onSuche={onSuche} max={KURZ} onMehr={() => waehle('suchsprache')} />
              {onFrage && (
                <StartFragen onFrage={onFrage} max={KURZ} onMehr={() => waehle('fragen')} />
              )}
              <StartStoebern
                index={wertIndex}
                onSuche={onSuche}
                kurz
                onMehr={() => waehle('stoebern')}
              />
            </div>
          )}

          {aktiv === 'zuletzt' && zuletzt()}
          {aktiv === 'suchsprache' && <StartSuchsprache onSuche={onSuche} />}
          {aktiv === 'fragen' && onFrage && <StartFragen onFrage={onFrage} />}
          {aktiv === 'stoebern' && (
            <StartStoebern index={wertIndex} zaehle={zaehle} onSuche={onSuche} />
          )}
        </div>
      </div>

      {/* Index-Hinweis — NUR bei leerem Dokumentenindex, dezent, keine CTA.
          Steht UNTER dem Panel, weil er eine andere Frage beantwortet als die
          Reiter: nicht „womit fange ich an", sondern „warum fehlt etwas".
          Index-Einrichtung ist Kurator-Aufgabe, nicht Nutzer-Aufgabe. */}
      {textabschnitteImIndex === 0 && (
        <div className="mt-4 max-w-2xl">
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
