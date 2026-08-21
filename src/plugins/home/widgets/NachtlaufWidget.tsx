/**
 * „Änderungen der letzten Nacht" — was der jüngste Export gebracht hat.
 *
 * Die Frage, mit der ein Arbeitstag anfängt: *was ist über Nacht passiert?* Der
 * Export selbst kann sie nicht beantworten, er zeigt nur den Endzustand; das
 * Import-Diff-Journal kann es.
 *
 * **Keine Personen-Achse.** Keine Zeile sagt, WER etwas gesetzt hat — das
 * Journal führt keine Kürzel, und diese Ansicht darf auch keine erfinden. Ein
 * „wer hat heute Nacht was gesetzt" wäre ein Aktivitätsprotokoll und damit
 * mitbestimmungspflichtig; das ist eine bewusste Gestaltungsentscheidung
 * (Pitfall #48).
 *
 * **Der Bearbeiter-Ausschnitt ist davon unberührt** (v4.134): er wählt aus, an
 * WELCHEN Vorgängen Änderungen gezeigt werden — dieselbe Sicht wie in „Meine
 * Anträge", im Kanban und in der Liste, umschaltbar über den Chip im Seitenkopf.
 * Das ist eine Aussage über Anträge, keine über Personen: wer in der eigenen
 * Sicht sitzt, sieht auch, was AB, QS oder Juristen an seinen Vorgängen geändert
 * haben. Ohne diesen Ausschnitt standen hier 400 Zeilen, von denen 7 den Leser
 * angingen (gemessen 20.08.2026).
 *
 * **Jedes Kürzel erklärt sich selbst** (v4.135). Bis dahin bündelte ein
 * `title=` an der Zeile Aktenzeichen und Unschärfe in einer Blase, und die
 * Kürzel selbst — das eigentlich Erklärungsbedürftige — sagten gar nichts. Jetzt
 * trägt jedes seinen Klartext aus dem Status-Katalog plus seine Journal-Einträge
 * (Datum bzw. Zeitraum, alter → neuer Wert); auch das „+N" und die Tilde haben
 * ihre eigene Erklärung. Kein Tooltip ohne Geste: was eine Blase hat, ist
 * gepunktet unterstrichen.
 *
 * **Der Klartext gilt je Projektform** (v6.2). Bis dahin las die Karte flach das
 * Label der Fassung: `D_AB` hieß hier „Bewilligungsempfehlung durch
 * Haushaltsbeauftragte" — die DL-Bedeutung, gezeigt an einem FuE-Vorgang, wo sie
 * „bewilligungsreif/Akte an Euronorm" heißt. Drei Spalten (`D_AAE`, `D_ABB`,
 * `D_AZ1_1`) standen zudem ganz ohne Beschreibung da, weil sie kanonisch
 * angebunden sind. Beides löst `journalSpalten.ts`; ein Statuswechsel steht
 * seither außerdem als Überschrift in seiner Blase, nicht als Nachsatz.
 *
 * **Die Fußzeile deckt auf** (v6.2): „… und 10 weitere Vorgänge" war eine tote
 * Auskunft. Sie zeigt jetzt schrittweise mehr, ab 20 Zeilen auf einen Schlag
 * alle — und trägt den Rückweg mit.
 *
 * Opt-in: der Katalog liefert das Widget mit, `reconcileVerfuegbareWidgets`
 * ergänzt es mit `sichtbar: false`. Wer es sehen will, schaltet es ein.
 */
import { useEffect, useMemo, useState } from 'react';
import { Tooltip } from '@/components/ui/Tooltip';
import { useStorage } from '@/core/hooks/useStorage';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useBearbeiterSicht } from '@/core/hooks/useBearbeiterSicht';
import { isVorgangssystemEnabled } from '@/config/feature-flags';
import {
  getAktiveVersion, letzterNachtLauf, nachtLaeufeSeit,
  type JournalEintrag,
} from '@/core/status';
import {
  baueSpaltenAufloesung, spaltenAuskunft,
  type SpaltenAufloesung,
} from '@/plugins/antraege/status/journalSpalten';
import { ART_TEXT, eintragText, wannText, wertText } from '@/plugins/antraege/status/journalTexte';
import { useAntraegeStore } from '@/plugins/antraege/store';
import {
  antragMatchesBearbeiter, bearbeiterScopeLabel,
  type BearbeiterFilterMode,
} from '@/plugins/antraege/bearbeiterFilter';
import {
  gruppiereNachAntrag, nachtlaufBilanz, zeileText,
  type NachtlaufKuerzel, type NachtlaufSegment, type NachtlaufZeile,
} from './nachtlaufGruppen';
import { WidgetShell } from './WidgetShell';
import type { NachtlaufWidgetConfig, WidgetSpezifischeConfig } from './types';
import type { WidgetProps } from './widgetProps';

/** Der Auslieferungszustand, falls eine Instanz ihre Config (noch) nicht trägt. */
const STANDARD: NachtlaufWidgetConfig = {
  art: 'nachtlauf',
  maxZeilen: 10,
  rueckblickTage: 0,
  maxKuerzel: 3,
  sortierung: 'anzahl',
  fusszeilen: true,
  ausschnitt: 'chip',
};

function configVon(c: WidgetSpezifischeConfig): NachtlaufWidgetConfig {
  return c.art === 'nachtlauf' ? c : STANDARD;
}

/** „Alle Vorgänge" als Filter-Modus — der Ausschnitt ist damit aus. */
const ALLE: BearbeiterFilterMode = { active: false, tokens: [], includeBegleitung: false };

/**
 * Das Spaltenraster der Liste — Bezeichnung, Anzahl, Kürzel, Tilde.
 *
 * `fit-content(34%)` statt fester 34 %: die Bezeichnungs-Spalte wird so breit wie
 * ihr **längster** Eintrag und nicht breiter als ein Drittel. Am echten Bestand
 * ist der Median 77 px und der längste 170 px — eine feste Spalte ließ die Zahl
 * bei jeder zweiten Zeile über 100 px Leere allein stehen. Dass alle Zeilen
 * dieselbe Spaltenbreite bekommen, macht `subgrid`: die Zeile ist ein `<button>`
 * über die volle Breite und kann deshalb nicht selbst Rasterzeile sein.
 */
const RASTER = 'grid-cols-[fit-content(34%)_22px_minmax(0,1fr)_auto] gap-x-1.5';

/**
 * Luft zwischen Bezeichnung und Zahl — 30 px über die Fuge hinaus.
 *
 * Als Innenabstand der Bezeichnungs-Spalte, nicht als größerer `column-gap`:
 * der gälte für alle drei Fugen gleich und schöbe die Kürzel von ihrer Zahl weg.
 * Er zählt zur `fit-content`-Breite, eine sehr lange Bezeichnung kürzt also
 * 30 px früher — das ist der Preis und er ist gewollt.
 */
const ZAHL_ABSTAND = 'pr-[30px]';

/** Wie viele Zeilen ein Klick auf die Fußzeile zusätzlich aufdeckt. */
const SCHRITT = 10;

/** Ab so vielen gezeigten Zeilen deckt der Link nicht mehr schrittweise auf. */
const ALLE_AB = 20;

function tagDe(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** „Export vom 21.08.2026" bzw. „Exporte vom 15.–21.08.2026". */
function exportText(daten: readonly string[]): string {
  if (daten.length === 0) return '';
  const sortiert = [...daten].sort();
  const von = sortiert[0]!;
  const bis = sortiert[sortiert.length - 1]!;
  return von === bis ? `Export vom ${tagDe(von)}` : `Exporte vom ${tagDe(von)}–${tagDe(bis)}`;
}

/** Was die Karte an Daten zeigt — beide Quellen auf eine Form gebracht. */
interface Bestand {
  eintraege: readonly JournalEintrag[];
  journalAb: string;
  /** Die Kopfzeile über die Herkunft („Export vom …"). */
  quelleText: string;
  /** Nur beim Ein-Lauf-Modus: der jüngste Export brachte nichts. */
  ersatzFuer?: { datum: string };
}

export function NachtlaufWidget({ instanz, onToggleEingeklappt }: WidgetProps): React.ReactElement | null {
  const idb = useStorage().idb;
  const { navigate } = useNavigation();
  const { mode, eigenerModus, ausFrage, kannUmschalten } = useBearbeiterSicht();
  const antraege = useAntraegeStore(s => s.antraege);
  const cfg = configVon(instanz.config);
  const aktiv = !instanz.eingeklappt;
  const [bestand, setBestand] = useState<Bestand | null>(null);
  const [laden, setLaden] = useState(false);
  const [geladen, setGeladen] = useState(false);
  /** Wie viele Zeilen über die eingestellte Anzahl hinaus aufgedeckt sind. */
  const [mehr, setMehr] = useState(0);

  // Der Stichtag wird einmal je Mount genommen und dann durchgereicht — eine
  // Uhr mitten in der Anzeige machte die Fenstergrenze vom Render-Zeitpunkt
  // abhängig.
  const heute = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const tage = cfg.rueckblickTage;

  useEffect(() => {
    if (!aktiv || geladen) return;
    let abgebrochen = false;
    setLaden(true);
    void (async () => {
      try {
        if (tage > 0) {
          const f = await nachtLaeufeSeit(idb, tage, heute);
          if (!abgebrochen) {
            setBestand(f && {
              eintraege: f.eintraege,
              journalAb: f.journalAb,
              quelleText: f.laeufe.length > 0
                ? exportText(f.laeufe.map(l => l.datum))
                : `Ab ${tagDe(f.vonDatum)} kein Export mit Änderungen`,
            });
          }
          return;
        }
        const l = await letzterNachtLauf(idb);
        if (!abgebrochen) {
          setBestand(l && {
            eintraege: l.eintraege,
            journalAb: l.journalAb,
            quelleText: exportText([l.datum]),
            ...(l.ersatzFuer ? { ersatzFuer: { datum: l.ersatzFuer.datum } } : {}),
          });
        }
      } finally {
        if (!abgebrochen) { setLaden(false); setGeladen(true); }
      }
    })();
    return () => { abgebrochen = true; };
  }, [idb, aktiv, geladen, tage, heute]);

  // Ein Wechsel des Zeitraums muss neu laden — sonst zeigte die Karte weiter
  // den Lauf, mit dem sie geöffnet wurde, und der Titel behauptete etwas anderes.
  useEffect(() => { setGeladen(false); }, [tage]);

  // Aktenzeichen → Antrag. Das Journal keyt auf `aktenzeichen` (im Export die
  // FKZ-Spalte), der Store also direkt der Join-Partner.
  const index = useMemo(
    () => new Map(antraege.map(a => [a.aktenzeichen, a])),
    [antraege],
  );

  // Die Nachschlage-Indizes der Fassung: EINMAL gebaut, nicht je Zeile — die
  // Suche läuft sonst linear über ~509 Katalog-Felder, mal zehn Zeilen.
  const aufloesung = useMemo(
    () => baueSpaltenAufloesung(getAktiveVersion()?.felder ?? []),
    [],
  );

  // Der Ausschnitt der Karte. Die Einstellung übersteuert NUR den Umschalter im
  // Seitenkopf: ein Ausschnitt aus einer Frage und eine per Anmeldung
  // festgezurrte Identität bleiben stärker, sonst machte eine Widget-Einstellung
  // genau den Bestand auf, den die Anmeldung zugeschnitten hat.
  const effMode = cfg.ausschnitt === 'chip' || ausFrage || !kannUmschalten
    ? mode
    : (cfg.ausschnitt === 'meine' ? eigenerModus : ALLE);

  const alle: readonly JournalEintrag[] = bestand?.eintraege ?? [];
  const eigene = useMemo(
    () => (effMode.active
      ? alle.filter(e => {
        const a = index.get(e.antragId);
        return a !== undefined && antragMatchesBearbeiter(a, effMode);
      })
      : alle),
    [alle, index, effMode],
  );
  const zeilen = useMemo(
    () => gruppiereNachAntrag(eigene, id => index.get(id)?.akronym, {
      maxKuerzel: cfg.maxKuerzel,
      sortierung: cfg.sortierung,
    }),
    [eigene, index, cfg.maxKuerzel, cfg.sortierung],
  );

  // Aufgedecktes gilt für DIESE Liste. Wechselt der Zeitraum, der Ausschnitt
  // oder die Sortierung, stünden sonst 40 Zeilen einer Einstellung da, die 10
  // sagt — der Regler wäre damit wirkungslos, bis die Karte neu gemountet wird.
  useEffect(() => { setMehr(0); }, [zeilen]);

  if (!isVorgangssystemEnabled()) return null;

  const basis = Math.max(1, cfg.maxZeilen);
  const grenze = Math.min(zeilen.length, basis + mehr);
  const sichtbar = zeilen.slice(0, grenze);
  // Der Verbund je gezeigter Zeile. Ohne Verbund steht der Antrag für sich —
  // dann ist sein Aktenzeichen die Gruppe, und die Linie bindet nur ihn.
  const verbuende = sichtbar.map(z => index.get(z.antragId)?.verbund_id || z.antragId);
  const rest = zeilen.length - sichtbar.length;
  // Schrittweise, solange die Liste kurz ist; ab 20 Zeilen ist das Abzählen
  // ohnehin vorbei, dann deckt ein Klick den Rest auf.
  const aufDeckenAlle = grenze >= ALLE_AB;
  // Wie viel der Lauf INSGESAMT brachte — sonst liest sich eine leere eigene
  // Liste als „der Import hat nichts gebracht".
  const fremde = alle.length - eigene.length;
  const titel = tage > 0
    ? `Änderungen der letzten ${tage} Tage`
    : 'Änderungen der letzten Nacht';

  return (
    <WidgetShell
      instanz={instanz}
      titel={titel}
      meta={bestand
        ? `${bestand.quelleText} · ${bearbeiterScopeLabel(effMode)}`
        : bearbeiterScopeLabel(effMode)}
      variante={instanz.bereich === 'seite' ? 'seite' : 'haupt'}
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      zaehler={
        // Eingeklappt wird nicht gelesen — dann steht hier „—", keine 0
        // (dieselbe Regel wie im Fristen-Widget, v4.131).
        <span
          className="text-[12px] tabular-nums text-[var(--tf-text-tertiary)]"
          title={!aktiv ? 'Zum Zählen aufklappen — eingeklappt wird das Journal nicht gelesen.' : undefined}
        >
          {!aktiv ? '—' : laden ? '…' : nachtlaufBilanz(zeilen)}
        </span>
      }
    >
      {laden && <p className="text-[12px] text-[var(--tf-text-tertiary)]">Lädt …</p>}
      {!laden && bestand === null && (
        // Kein Journal ⇒ das sagen, statt eine leere Liste zu zeigen.
        <p className="text-[12px] text-[var(--tf-text-secondary)]">
          Es wird noch kein Änderungs-Journal geführt. Es entsteht mit dem nächsten Import auf einem
          Gerät mit Schreibrecht.
        </p>
      )}
      {!laden && bestand !== null && (
        <>
          {/* Das Export-Datum steht in der Kopfzeile der Shell; hier nur der
              Nullpunkt — er gehört an jede Journal-Anzeige, sonst wird eine
              Teil-Historie als vollständige gelesen. Dazu, falls der jüngste
              Export nichts brachte, WELCHER Lauf hier steht (v4.134). */}
          <p className="text-[11px] leading-[1.35] text-[var(--tf-text-tertiary)] mb-1">
            Historie ab {tagDe(bestand.journalAb)}
            {bestand.ersatzFuer
              ? ` · der Export vom ${tagDe(bestand.ersatzFuer.datum)} hat nichts geändert — gezeigt ist der letzte Lauf mit Änderungen`
              : ''}
          </p>
          {zeilen.length === 0 ? (
            <p className="text-[12px] text-[var(--tf-text-secondary)]">
              {fremde > 0
                ? `An Ihren Vorgängen hat sich nichts geändert — ${fremde.toLocaleString('de-DE')} Änderungen betrafen andere.`
                : 'An den erfassten Kürzeln hat sich nichts geändert.'}
            </p>
          ) : (
            <ul className={`grid ${RASTER}`}>
              {sichtbar.map((z, i) => (
                <ZeileView
                  key={z.antragId}
                  zeile={z}
                  aufloesung={aufloesung}
                  vbPhase={index.get(z.antragId)?.vb_phase}
                  // Die Haarlinie trennt, was nicht zusammengehört: sie steht
                  // unter der LETZTEN Zeile eines Verbunds — hinter der letzten
                  // sichtbaren Zeile trennte sie nichts mehr.
                  trennlinie={verbuende[i] !== verbuende[i + 1] && i < sichtbar.length - 1}
                  onOeffnen={() => navigate('antraege', { selectedId: z.antragId })}
                />
              ))}
              {cfg.fusszeilen && rest > 0 && (
                // Der Rest war bis v6.2 eine tote Auskunft: er sagte, wie viele
                // fehlen, und ließ den Leser mit dem Regler in den Einstellungen
                // allein.
                <li className="col-span-full pt-0.5">
                  <Fusslink
                    onClick={() => setMehr(m => (aufDeckenAlle ? zeilen.length : m + SCHRITT))}
                    text={aufDeckenAlle
                      ? `Alle ${zeilen.length.toLocaleString('de-DE')} Vorgänge anzeigen`
                      : `… und ${rest.toLocaleString('de-DE')} weitere ${rest === 1 ? 'Vorgang' : 'Vorgänge'}`}
                  />
                </li>
              )}
              {cfg.fusszeilen && grenze > basis && (
                // Jeder Einbahn-Zustand braucht seinen Rückweg — sonst bleibt
                // die Karte für den Rest der Sitzung lang.
                <li className="col-span-full pt-0.5">
                  <Fusslink onClick={() => setMehr(0)} text="Weniger anzeigen" />
                </li>
              )}
            </ul>
          )}
          {cfg.fusszeilen && zeilen.length > 0 && fremde > 0 && (
            // Der Ausschnitt nennt seinen Rest (v4.131-Regel): ohne das läse
            // sich die eigene Liste als der ganze Lauf.
            <p className="pt-1 text-[11px] leading-[1.35] text-[var(--tf-text-tertiary)]">
              {fremde.toLocaleString('de-DE')} weitere Änderungen betrafen Vorgänge außerhalb
              Ihres Ausschnitts.
            </p>
          )}
        </>
      )}
    </WidgetShell>
  );
}

/** Die Geste, die einen Tooltip ankündigt — einmal beschrieben, viermal benutzt. */
const GESTE = 'cursor-help underline decoration-dotted decoration-[var(--tf-text-tertiary)] underline-offset-2';

/** Eine Fußzeile, die etwas tut — als Link gesetzt, damit sie danach aussieht. */
function Fusslink({ text, onClick }: { text: string; onClick: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left text-[11px] leading-[1.35] text-[var(--tf-text-tertiary)] underline underline-offset-2 hover:text-[var(--tf-text)] cursor-pointer"
    >
      {text}
    </button>
  );
}

/** Titelzeile, optionale Unterzeile, graue Detailzeilen — die Form aller Blasen. */
function Blase({ titel, unter, zeilen }: {
  titel: string;
  unter?: string;
  zeilen: readonly string[];
}): React.ReactElement {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-medium">{titel}</span>
      {unter !== undefined && (
        <span className="text-[11px] text-[var(--tf-text-secondary)]">{unter}</span>
      )}
      {zeilen.map((t, i) => (
        <span key={i} className="text-[11px] text-[var(--tf-text-tertiary)]">{t}</span>
      ))}
    </span>
  );
}

/**
 * Der EINE Wertwechsel dieses Kürzels — sonst `null`.
 *
 * Nur dann darf der Wechsel in die Überschrift: trägt das Kürzel im Zeitfenster
 * mehrere Einträge, ist jeder davon eine eigene Änderung, und einer davon als
 * Titel machte die anderen zur Fußnote.
 */
function einzelnerWechsel(eintraege: readonly JournalEintrag[]): JournalEintrag | null {
  const e = eintraege.length === 1 ? eintraege[0]! : null;
  return e !== null && e.art === 'geaendert' && e.nach !== undefined ? e : null;
}

/**
 * Ein Kürzel und was es sagt.
 *
 * Bei einem Statuswechsel steht **der Wechsel** in der Überschrift — er ist die
 * Auskunft, hinter der man den Tooltip überhaupt öffnet; der Name des Feldes
 * rückt darunter. Bei einem gesetzten Termin gibt es keinen Wechsel, dann bleibt
 * der Name oben.
 */
function KuerzelView({ kuerzel, aufloesung, vbPhase }: {
  kuerzel: NachtlaufKuerzel;
  aufloesung: SpaltenAufloesung;
  vbPhase: unknown;
}): React.ReactElement {
  const { bezeichnung, eindeutig } = spaltenAuskunft(aufloesung, kuerzel.feld, vbPhase);
  // Ohne Klartext bleibt der Code die Überschrift — geraten wird nicht, und die
  // Einträge darunter sind die eigentliche Auskunft.
  const name = bezeichnung ? `${kuerzel.feld} · ${bezeichnung}` : kuerzel.feld;
  const wechsel = einzelnerWechsel(kuerzel.eintraege);
  const zeilen = [
    // Steht der Wechsel schon im Titel, sagt die Zeile nur noch das Wann —
    // zweimal derselbe Pfeil in einer Blase liest sich wie zwei Änderungen.
    ...(wechsel
      ? [`${ART_TEXT[wechsel.art]} ${wannText(wechsel)}`]
      : kuerzel.eintraege.map(eintragText)),
    ...(eindeutig
      ? []
      : ['Die Bedeutung ist je Projektform verschieden — die dieses Vorgangs ist nicht bekannt.']),
  ];
  return (
    <Tooltip
      maxWidth={340}
      content={
        wechsel
          ? <Blase titel={`${wertText(wechsel.von)} → ${wertText(wechsel.nach)}`} unter={name} zeilen={zeilen} />
          : <Blase titel={name} zeilen={zeilen} />
      }
    >
      <span className={GESTE}>{kuerzel.feld}</span>
    </Tooltip>
  );
}

/** Ein Segment: „D_AB, D_ABB +2 gesetzt" — jedes Kürzel einzeln aufgehängt. */
function SegmentView({ segment, aufloesung, vbPhase }: {
  segment: NachtlaufSegment;
  aufloesung: SpaltenAufloesung;
  vbPhase: unknown;
}): React.ReactElement {
  return (
    <>
      {segment.kuerzel.map((k, i) => (
        <span key={k.feld}>
          {i > 0 ? ', ' : ''}
          <KuerzelView kuerzel={k} aufloesung={aufloesung} vbPhase={vbPhase} />
        </span>
      ))}
      {segment.versteckt.length > 0 && (
        <>
          {' '}
          {/* Ein Auszug muss sich als Auszug zu erkennen geben: was hier
              weggelassen ist, steht namentlich in seiner eigenen Blase. */}
          <Tooltip
            maxWidth={340}
            content={
              <Blase
                titel={`${segment.versteckt.length} weitere ${segment.artText}`}
                zeilen={segment.versteckt.map(k => {
                  const { bezeichnung } = spaltenAuskunft(aufloesung, k.feld, vbPhase);
                  return bezeichnung ? `${k.feld} · ${bezeichnung}` : k.feld;
                })}
              />
            }
          >
            <span className={GESTE}>+{segment.versteckt.length}</span>
          </Tooltip>
        </>
      )}
      {segment.kuerzel.length > 0 ? ' ' : ''}
      {segment.artText}
    </>
  );
}

/**
 * Eine Zeile — ein `<button>` über die volle Breite.
 *
 * Die Blasen hängen an reinen `<span>`s DARIN: `Tooltip` reagiert auf Maus und
 * Fokus, bringt aber selbst kein interaktives Element mit. Ein `tabIndex` auf
 * den Spans hätte im Button eine Fokusfalle erzeugt; die Vorlesesoftware bekommt
 * stattdessen den ganzen Satz über `aria-label`.
 */
function ZeileView({ zeile, aufloesung, vbPhase, trennlinie, onOeffnen }: {
  zeile: NachtlaufZeile;
  aufloesung: SpaltenAufloesung;
  vbPhase: unknown;
  trennlinie: boolean;
  onOeffnen: () => void;
}): React.ReactElement {
  return (
    <li className="relative col-span-full grid grid-cols-subgrid">
      {/* Die Trennlinie kostet keine Zeilenhöhe: sie liegt als 1-px-Streifen
          NEBEN dem Fluss auf der Unterkante, statt als Rahmen die Zeile um ein
          Pixel wachsen zu lassen. Sonst wären 15 Gruppen 15 px höher. */}
      {trennlinie && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[var(--tf-border)]"
        />
      )}
      <button
        type="button"
        onClick={onOeffnen}
        aria-label={`${zeile.label} (${zeile.antragId}): ${zeileText(zeile)}`}
        // Zwei Messungen stecken in dieser Zeile (v4.135, gemessen am echten
        // Bestand):
        //  1. Die Schriftgröße steht am Button, nicht nur an den Kindern — die
        //     Tooltip-Hüllen sind eigene Flex-Items und erbten sonst die 16 px
        //     der Seite: eine leere Zeilenbox von 21,6 px, die die Zeile aufblies.
        //  2. `items-center` statt `items-baseline` — bei Baseline-Ausrichtung
        //     ist die Zeilenhöhe die VEREINIGUNG der Über- und Unterlängen aller
        //     Schriftgrößen (11 / 12 / 10,5 px) und damit 1,6 px höher als das
        //     höchste Element. Ein fester `leading` macht daraus eine Zeile,
        //     deren Höhe man ausrechnen kann.
        className="col-span-full grid grid-cols-subgrid items-center rounded-[6px] px-1 py-0 text-left text-[12px] leading-[16px] hover:bg-[var(--tf-hover)] cursor-pointer"
      >
        {/* Das Aktenzeichen lief bis v4.135 im Sammel-Tooltip der Zeile mit.
            Der ist weg — verloren gehen darf es nicht, denn das Akronym trägt
            es nur dort, wo zwei Teilvorhaben es sich teilen.
            KEINE Breite an der Hülle: die Spaltenbreite bestimmt das Raster
            (`RASTER`), und eine eigene Breite hier machte die Rechnung zirkulär.
            `overflow-clip` statt `truncate`: ein Scroll-Container (`hidden`)
            steuert zur `fit-content`-Rechnung NICHTS bei — die Spalte fiel damit
            auf die Breite der Auslassungspunkte zusammen (gemessen: 6 px).
            `clip` schneidet genauso ab, ist aber kein Scroll-Container.
            Der Abstand zur Zahl steht als Innenabstand HIER, nicht als größerer
            Spalten-Abstand: `column-gap` gilt für alle Fugen gleich, und die
            Kürzel sollen dicht an ihrer Zahl bleiben. */}
        <Tooltip
          text={`${zeile.antragId} — öffnen`}
          wrapperClassName={`min-w-0 overflow-clip text-ellipsis whitespace-nowrap ${ZAHL_ABSTAND} text-[12px] font-medium text-[var(--tf-text)]`}
        >
          {zeile.label}
        </Tooltip>
        <span className="text-right font-mono text-[11px] tabular-nums text-[var(--tf-text)]">
          {zeile.anzahl.toLocaleString('de-DE')}
        </span>
        <span className="min-w-0 truncate font-mono text-[11px] text-[var(--tf-text-tertiary)]">
          {zeile.segmente.map((s, i) => (
            <span key={s.art}>
              {i > 0 ? ' · ' : ''}
              <SegmentView segment={s} aufloesung={aufloesung} vbPhase={vbPhase} />
            </span>
          ))}
        </span>
        {zeile.unscharf && (
          <Tooltip
            maxWidth={280}
            text={'Zeitraum statt Tag: zwischen den beiden verglichenen Exporten lagen mehrere '
              + 'Tage (Wochenende, Ausfall). Der genaue Tag der Änderung ist nicht belegt — der '
              + 'Zeitraum steht im Tooltip des jeweiligen Kürzels.'}
            wrapperClassName="text-[11px] text-[var(--tf-text-tertiary)]"
          >
            <span className={GESTE}>~</span>
          </Tooltip>
        )}
      </button>
    </li>
  );
}
