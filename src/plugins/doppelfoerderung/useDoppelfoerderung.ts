/**
 * Das State-Wiring der Doppelförderungs-Prüfung: drei Phasen, ein Stapellauf.
 *
 * Alles Rechnende steht in `services/` und ist React-frei; hier wohnen nur der
 * Zustand, der Abbruch und die Reihenfolge.
 *
 * **Kein Ping beim Mount.** Der Streamlit-Transport öffnet in einem offenen Ping
 * ungefragt ein Fenster; die Verbindung wird deshalb erst beim Klick auf
 * „Prüfung starten" geprüft — und zwar von `fuehreEinSchussLauf` selbst
 * (passiver Ping, sonst der app-weite Verbinden-Dialog). Dieselbe Lehre wie in
 * [useAnalysePipeline.ts](src/plugins/suche/useAnalysePipeline.ts).
 *
 * **Ein Verbindungsabbruch beendet den Stapel.** Bricht der KI-Lauf einer Zeile
 * mit `verbindungFehlt` ab, laufen die übrigen Zeilen nicht auch noch gegen
 * dieselbe Wand — die fertigen Zeilen bleiben stehen, der Rest wartet auf einen
 * neuen Anlauf. Ein fachlicher Fehler EINER Zeile (kein Schlagwort ableitbar)
 * stoppt dagegen nichts: die Zeile bekommt ihren Vermerk und der Stapel läuft
 * weiter.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { listAntraegeListViewByProgramm } from '@/core/services/csv/idb-csv';
import type { AntragListItem } from '@/core/services/csv/types';
import { embedQueryCached } from '@/core/services/search/query-embedder';
import { embeddingService } from '@/core/services/search/embedding-service';
import { getActiveModelId, getModelById } from '@/core/services/search/model-registry';
import {
  getEmbeddings, getProgrammCaches,
} from '@/plugins/antraege/services/antraege-search-service';
import type { AntragTextEntry } from '@/plugins/antraege/services/search-corpus';
import { bereichsAktenzeichen } from './services/bereich';
import {
  aehnlichkeitsStufe, aehnlichkeitsText, faelleUrteil, vereineBefunde,
  wortlautAbdeckung, zuWeiteSchlagworte,
  type AbgleichKontext, type WortlautErgebnis,
} from './services/abgleich';
import { baueTraegerIndex, traegerAbgleich } from './services/traeger';
import { ermittleSchlagworte } from './services/schlagworte-lauf';
import type {
  BereichsWahl, MeldungsZeile, SchlagwortTreffer, TraegerBezug, TrefferBefund, ZeilenErgebnis,
} from './types';

export type Phase = 'aufnehmen' | 'pruefen' | 'ergebnis';

export interface Fortschritt {
  fertig: number;
  gesamt: number;
  /** Was gerade läuft — steht in der Leiste, damit die Wartezeit erklärt ist. */
  zeile: string;
}

/**
 * Was ein Lauf über eine Zeile WIRKLICH herausgefunden hat — ohne Urteil.
 *
 * Das Urteil steht bewusst nicht hier: es hängt an der Schwelle, und die stellt
 * der Nutzer nach dem Lauf um. Läge es im Zustand, gäbe es nach dem ersten Zug
 * am Regler zwei Wahrheiten — die gespeicherte und die eingestellte. Die Befunde
 * sind der Fund, das Urteil ist eine Ansicht darauf und wird beim Rendern
 * gebildet.
 */
interface RohErgebnis {
  zeile: MeldungsZeile;
  schlagworte: readonly string[];
  schlagwortTreffer: readonly SchlagwortTreffer[];
  befunde: readonly TrefferBefund[];
  fehler?: string;
}

/**
 * Die drei Stufen einer Zeile zu einem Rohergebnis zusammenlegen.
 *
 * Steht ausserhalb des Hooks, weil `starte` und `ersetzeSchlagworte` beide
 * denselben Weg gehen müssen — sonst zeigt eine von Hand korrigierte Zeile
 * andere Befunde als dieselbe Zeile aus dem Stapellauf.
 */
function baueRohErgebnis(
  zeile: MeldungsZeile,
  schlagworte: readonly string[],
  wortlaut: WortlautErgebnis,
  vektor: ReadonlyMap<string, number> | null,
  ctx: AbgleichKontext,
  bereichsGroesse: number,
): RohErgebnis {
  const zuWeit = zuWeiteSchlagworte(wortlaut.treffer, bereichsGroesse);
  const traeger = ctx.traegerIndex
    ? traegerAbgleich(zeile.zuwendungsempfaenger, ctx.traegerIndex)
    : new Map<string, TraegerBezug>();
  return {
    zeile,
    schlagworte: [...schlagworte],
    schlagwortTreffer: wortlaut.treffer,
    befunde: vereineBefunde(wortlaut.proAktenzeichen, vektor ?? new Map(), ctx, zuWeit, traeger),
  };
}

export interface UseDoppelfoerderung {
  phase: Phase;
  laeuft: boolean;
  fortschritt: Fortschritt | null;
  ergebnisse: readonly ZeilenErgebnis[];
  /** Wie viele Anträge der Betrachtungsbereich trägt; `null` = noch nicht geladen. */
  bereichsGroesse: number | null;
  /** Gesamtzahl der Anträge im Bestand — der Bezug zur Bereichszahl. */
  bestandsGroesse: number | null;
  /** Lief die Ähnlichkeitsstufe? `false` = ohne Embedding-Modell gefahren. */
  mitAehnlichkeit: boolean;
  fehler: string | null;
  starte: (zeilen: readonly MeldungsZeile[], wahl: BereichsWahl) => void;
  brichAb: () => void;
  zuruecksetzen: () => void;
  /** Schlagworte einer Zeile ersetzen; Wortlaut + Träger sofort, Ähnlichkeit falls sie fehlt. */
  ersetzeSchlagworte: (zeilenNr: number, schlagworte: readonly string[]) => void;
}

export function useDoppelfoerderung(schwelle: number): UseDoppelfoerderung {
  const bridge = useAIBridge();
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);

  const [phase, setPhase] = useState<Phase>('aufnehmen');
  const [laeuft, setLaeuft] = useState(false);
  const [fortschritt, setFortschritt] = useState<Fortschritt | null>(null);
  const [roh, setRoh] = useState<readonly RohErgebnis[]>([]);
  const [bereichsGroesse, setBereichsGroesse] = useState<number | null>(null);
  const [bestandsGroesse, setBestandsGroesse] = useState<number | null>(null);
  const [mitAehnlichkeit, setMitAehnlichkeit] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  /** Der zuletzt gebaute Abgleich-Kontext — für das Nachrechnen einer Zeile. */
  const kontextRef = useRef<AbgleichKontext | null>(null);
  /**
   * Der aktuelle Stand der Rohergebnisse, ohne den Umweg über `setRoh`.
   *
   * `ersetzeSchlagworte` muss die Zeile LESEN, bevor es asynchron einbettet —
   * innerhalb eines funktionalen `setRoh` ginge das nur, wenn der Updater
   * nebenbei etwas anstösst, und das darf er nicht (StrictMode ruft ihn zweimal).
   */
  const rohRef = useRef<readonly RohErgebnis[]>([]);
  rohRef.current = roh;

  /**
   * Eine Zeile einbetten — die eine Stelle, die das Modell kennt.
   *
   * Steht hier statt in `starte`, weil `ersetzeSchlagworte` sie ebenfalls
   * braucht: eine Zeile, deren KI-Lauf scheiterte, holt ihre Ähnlichkeit erst
   * beim Nachtragen der Schlagworte.
   */
  const embedden = useCallback(async (text: string): Promise<number[] | null> => {
    try {
      const cfg = getModelById(await getActiveModelId(storage.idb));
      return await embedQueryCached(text, cfg, 'query');
    } catch {
      return null;
    }
  }, [storage]);

  const brichAb = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLaeuft(false);
    setFortschritt(null);
  }, []);

  const zuruecksetzen = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    kontextRef.current = null;
    setPhase('aufnehmen');
    setLaeuft(false);
    setFortschritt(null);
    setRoh([]);
    setFehler(null);
    setMitAehnlichkeit(false);
  }, []);

  const starte = useCallback((zeilen: readonly MeldungsZeile[], wahl: BereichsWahl) => {
    if (laeuft || zeilen.length === 0) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase('pruefen');
    setLaeuft(true);
    setFehler(null);
    setRoh([]);
    setFortschritt({ fertig: 0, gesamt: zeilen.length, zeile: 'Bestand wird geladen…' });

    void (async () => {
      try {
        const programmId = activeProgrammId;
        if (!programmId) {
          setFehler('Es ist kein Förderprogramm geladen — ohne Bestand gibt es nichts zu vergleichen.');
          setLaeuft(false); setFortschritt(null); setPhase('aufnehmen');
          return;
        }

        const [caches, items] = await Promise.all([
          getProgrammCaches(storage.idb, programmId),
          listAntraegeListViewByProgramm(storage.idb, programmId) as Promise<AntragListItem[]>,
        ]);
        if (ctrl.signal.aborted) return;

        const heuteJahr = new Date().getFullYear();
        const imBereich = bereichsAktenzeichen(items, wahl, heuteJahr);
        // Der Korpus wird EINMAL auf den Bereich geschnitten, nicht je Zeile
        // gefiltert: die Wortlaut-Stufe läuft dann über 4.327 statt 14.225
        // Einträge und ist damit gut dreimal schneller — bei drei Läufen je
        // Zeile über womöglich siebzig Zeilen ist das der Unterschied zwischen
        // „sofort" und „spürbar".
        const korpus = new Map<string, AntragTextEntry>();
        for (const akz of imBereich) {
          const e = caches.textCorpus.get(akz);
          if (e) korpus.set(akz, e);
        }
        setBestandsGroesse(caches.textCorpus.size);
        setBereichsGroesse(korpus.size);

        const embeddings = embeddingService.isReady()
          ? await getEmbeddings(storage.idb).catch(() => new Map<string, number[]>())
          : new Map<string, number[]>();
        if (ctrl.signal.aborted) return;
        setMitAehnlichkeit(embeddings.size > 0);

        const ctx: AbgleichKontext = {
          korpus,
          listeNachAkz: new Map(items.map(it => [it.aktenzeichen, it])),
          embeddings,
          // Einmal je Lauf gebaut, nicht je Zeile: der Index über 4.327
          // Trägernamen kostet Millisekunden, 45-mal gebaut wäre er Wartezeit.
          traegerIndex: baueTraegerIndex(items, imBereich),
        };
        kontextRef.current = ctx;

        const gesammelt: RohErgebnis[] = [];
        for (const [i, zeile] of zeilen.entries()) {
          if (ctrl.signal.aborted) return;
          setFortschritt({
            fertig: i,
            gesamt: zeilen.length,
            zeile: zeile.thema.slice(0, 90) || zeile.fkz,
          });

          const lauf = await ermittleSchlagworte(
            bridge, zeile.thema, zeile.aufgabenbeschreibung, ctrl.signal,
          );
          if (ctrl.signal.aborted) return;

          if (!lauf.ok) {
            gesammelt.push({ zeile, schlagworte: [], schlagwortTreffer: [], befunde: [], fehler: lauf.fehler });
            setRoh([...gesammelt]);
            // Ein Verbindungsabbruch trifft jede weitere Zeile genauso — den
            // Stapel weiterlaufen zu lassen kostete nur Wartezeit. Die übrigen
            // Zeilen bekommen trotzdem ihre Karte: ohne sie gäbe es keinen Ort,
            // an dem sich Schlagworte von Hand nachtragen liessen, und die
            // ganze Seite wäre bei nicht erreichbarer KI unbenutzbar.
            if (lauf.verbindungFehlt) {
              setFehler(lauf.fehler);
              for (const rest of zeilen.slice(i + 1)) {
                gesammelt.push({
                  zeile: rest, schlagworte: [], schlagwortTreffer: [], befunde: [],
                  fehler: 'Nicht geprüft — die Verbindung brach vorher ab. Schlagworte lassen sich von Hand eintragen.',
                });
              }
              setRoh([...gesammelt]);
              break;
            }
            continue;
          }

          const wortlaut = wortlautAbdeckung(lauf.schlagworte, korpus);
          const vektor = await aehnlichkeitsStufe(
            aehnlichkeitsText(zeile.thema, zeile.aufgabenbeschreibung),
            ctx, embedden, new Set(wortlaut.proAktenzeichen.keys()), ctrl.signal,
          );
          if (ctrl.signal.aborted) return;

          gesammelt.push(baueRohErgebnis(zeile, lauf.schlagworte, wortlaut, vektor, ctx, korpus.size));
          setRoh([...gesammelt]);
        }

        setFortschritt(null);
        setLaeuft(false);
        setPhase('ergebnis');
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setFehler(err instanceof Error ? err.message : String(err));
        setLaeuft(false);
        setFortschritt(null);
      }
    })();
  }, [activeProgrammId, bridge, embedden, laeuft, storage]);

  /**
   * Schlagworte von Hand ändern.
   *
   * Der KI-Lauf wiederholt sich NICHT — er hat seine Arbeit getan, und die
   * Ähnlichkeitsstufe hängt am Text der Zeile, nicht an den Schlagworten. Hatte
   * die Zeile schon Ähnlichkeitswerte, werden sie übernommen; die Korrektur
   * kostet dann Millisekunden.
   *
   * **Hat sie noch keine, läuft die Stufe jetzt nach.** Das ist der Fall, in dem
   * die KI gar nicht erreichbar war: dort kam der Stapel nie bis zur
   * Ähnlichkeit, und ohne sie liesse sich das Träger-Urteil nicht auslösen —
   * genau das, was diesen Eingabeweg lohnt. Die Stufe braucht keine KI, nur das
   * Embedding-Modell; fehlt auch das, bleibt es beim Wortlaut.
   */
  const ersetzeSchlagworte = useCallback((zeilenNr: number, schlagworte: readonly string[]) => {
    const k = kontextRef.current;
    if (!k) return;
    const alt = rohRef.current.find(e => e.zeile.zeilenNr === zeilenNr);
    if (!alt) return;

    const wortlaut = wortlautAbdeckung(schlagworte, k.korpus);
    const schonDa = new Map(
      alt.befunde.filter(b => b.aehnlichkeit !== null)
        .map(b => [b.aktenzeichen, b.aehnlichkeit as number]),
    );

    const uebernimm = (vektor: ReadonlyMap<string, number>): void => {
      setRoh(liste => liste.map(e => (
        e.zeile.zeilenNr === zeilenNr
          // Der Fehlervermerk fällt weg: die Zeile hat jetzt Schlagworte, auch
          // wenn die KI keine liefern konnte. Genau dafür ist der Weg da.
          ? baueRohErgebnis(e.zeile, schlagworte, wortlaut, vektor, k, k.korpus.size)
          : e
      )));
    };

    if (schonDa.size > 0 || k.embeddings.size === 0) { uebernimm(schonDa); return; }

    // Erst die Wortlaut-Stufe zeigen, dann die Ähnlichkeit nachreichen: das
    // Einbetten dauert rund 100 ms, und ein Feld, das nach dem Übernehmen kurz
    // leer bliebe, sähe aus wie ein verschluckter Klick.
    uebernimm(schonDa);
    void (async () => {
      const vektor = await aehnlichkeitsStufe(
        aehnlichkeitsText(alt.zeile.thema, alt.zeile.aufgabenbeschreibung),
        k, embedden, new Set(wortlaut.proAktenzeichen.keys()), new AbortController().signal,
      );
      if (vektor && vektor.size > 0) uebernimm(vektor);
    })();
  }, [embedden]);

  // Das Urteil entsteht hier, beim Rendern — nicht beim Lauf. Ein Zug am Regler
  // wirkt damit sofort auf alle Zeilen, ohne dass ein einziger KI-Aufruf oder
  // eine einzige Suche wiederholt wird.
  const ergebnisse = useMemo<readonly ZeilenErgebnis[]>(
    () => roh.map(e => ({
      zeile: e.zeile,
      schlagworte: e.schlagworte,
      schlagwortTreffer: e.schlagwortTreffer,
      befunde: e.befunde,
      ...faelleUrteil(e.befunde, schwelle, undefined, e.schlagwortTreffer),
      ...(e.fehler ? { fehler: e.fehler } : {}),
    })),
    [roh, schwelle],
  );

  return {
    phase, laeuft, fortschritt, ergebnisse, bereichsGroesse, bestandsGroesse,
    mitAehnlichkeit, fehler, starte, brichAb, zuruecksetzen, ersetzeSchlagworte,
  };
}
