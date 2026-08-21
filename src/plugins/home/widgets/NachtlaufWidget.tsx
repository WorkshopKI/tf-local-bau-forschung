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
import { eintragText } from '@/plugins/antraege/status/journalTexte';
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
 * Die beiden Status-Spalten stehen nicht als `feldId` im Katalog; ihre
 * kanonischen Gegenstücke schon. Zwei Zeilen statt einer Handtabelle mit
 * Klartexten — die stünden sonst neben denen des Katalogs und liefen auseinander.
 */
const KANONISCH: Record<string, string> = {
  STATUS_TV: 'status',
  STATUS_VB: 'verbund_status',
};

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

  // Klartext je Kürzel: EINE Map statt `feldLabel` je Zeile — das läuft linear
  // über ~505 Katalog-Felder und stünde sonst in jedem Render mal zehn.
  const klartext = useMemo(() => {
    const version = getAktiveVersion();
    if (!version) return new Map<string, string>();
    const proFeldId = new Map<string, string>();
    for (const f of version.felder) {
      const label = f.label.trim();
      if (label) proFeldId.set(f.feldId, label);
    }
    const out = new Map(proFeldId);
    for (const [spalte, feldId] of Object.entries(KANONISCH)) {
      const label = proFeldId.get(feldId);
      if (label) out.set(spalte, label);
    }
    return out;
  }, []);

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

  if (!isVorgangssystemEnabled()) return null;

  const sichtbar = zeilen.slice(0, Math.max(1, cfg.maxZeilen));
  const rest = zeilen.length - sichtbar.length;
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
            <ul className="flex flex-col">
              {sichtbar.map(z => (
                <ZeileView
                  key={z.antragId}
                  zeile={z}
                  klartext={klartext}
                  onOeffnen={() => navigate('antraege', { selectedId: z.antragId })}
                />
              ))}
              {cfg.fusszeilen && rest > 0 && (
                <li className="pt-0.5 text-[11px] leading-[1.35] text-[var(--tf-text-tertiary)]">
                  … und {rest.toLocaleString('de-DE')} weitere {rest === 1 ? 'Vorgang' : 'Vorgänge'}
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

/** Die Geste, die einen Tooltip ankündigt — einmal beschrieben, dreimal benutzt. */
const GESTE = 'cursor-help underline decoration-dotted decoration-[var(--tf-text-tertiary)] underline-offset-2';

/** Titelzeile + graue Detailzeilen — die Form aller Blasen dieser Karte. */
function Blase({ titel, zeilen }: { titel: string; zeilen: readonly string[] }): React.ReactElement {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-medium">{titel}</span>
      {zeilen.map((t, i) => (
        <span key={i} className="text-[11px] text-[var(--tf-text-tertiary)]">{t}</span>
      ))}
    </span>
  );
}

/** Ein Kürzel: Klartext als Titel, darunter jeder Journal-Eintrag als Satz. */
function KuerzelView({ kuerzel, klartext }: {
  kuerzel: NachtlaufKuerzel;
  klartext: ReadonlyMap<string, string>;
}): React.ReactElement {
  const name = klartext.get(kuerzel.feld);
  return (
    <Tooltip
      maxWidth={340}
      content={
        <Blase
          // Ohne Katalog-Treffer bleibt der Code die Überschrift — geraten wird
          // nicht, und die Einträge darunter sind die eigentliche Auskunft.
          titel={name ? `${kuerzel.feld} · ${name}` : kuerzel.feld}
          zeilen={kuerzel.eintraege.map(eintragText)}
        />
      }
    >
      <span className={GESTE}>{kuerzel.feld}</span>
    </Tooltip>
  );
}

/** Ein Segment: „D_AB, D_ABB +2 gesetzt" — jedes Kürzel einzeln aufgehängt. */
function SegmentView({ segment, klartext }: {
  segment: NachtlaufSegment;
  klartext: ReadonlyMap<string, string>;
}): React.ReactElement {
  return (
    <>
      {segment.kuerzel.map((k, i) => (
        <span key={k.feld}>
          {i > 0 ? ', ' : ''}
          <KuerzelView kuerzel={k} klartext={klartext} />
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
                  const name = klartext.get(k.feld);
                  return name ? `${k.feld} · ${name}` : k.feld;
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
function ZeileView({ zeile, klartext, onOeffnen }: {
  zeile: NachtlaufZeile;
  klartext: ReadonlyMap<string, string>;
  onOeffnen: () => void;
}): React.ReactElement {
  return (
    <li>
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
        className="flex w-full items-center gap-1.5 rounded-[6px] px-1 py-0 text-left text-[12px] leading-[16px] hover:bg-[var(--tf-hover)] cursor-pointer"
      >
        <span className="w-[22px] shrink-0 text-right font-mono text-[11px] tabular-nums text-[var(--tf-text)]">
          {zeile.anzahl.toLocaleString('de-DE')}
        </span>
        {/* Das Aktenzeichen lief bis v4.135 im Sammel-Tooltip der Zeile mit.
            Der ist weg — verloren gehen darf es nicht, denn das Akronym trägt
            es nur dort, wo zwei Teilvorhaben es sich teilen. */}
        <Tooltip
          text={`${zeile.antragId} — öffnen`}
          wrapperClassName="max-w-[34%] shrink-0 truncate text-[12px] font-medium text-[var(--tf-text)]"
        >
          <span className="truncate">{zeile.label}</span>
        </Tooltip>
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--tf-text-tertiary)]">
          {zeile.segmente.map((s, i) => (
            <span key={s.art}>
              {i > 0 ? ' · ' : ''}
              <SegmentView segment={s} klartext={klartext} />
            </span>
          ))}
        </span>
        {zeile.unscharf && (
          <Tooltip
            maxWidth={280}
            text={'Zeitraum statt Tag: zwischen den beiden verglichenen Exporten lagen mehrere '
              + 'Tage (Wochenende, Ausfall). Der genaue Tag der Änderung ist nicht belegt — der '
              + 'Zeitraum steht im Tooltip des jeweiligen Kürzels.'}
            wrapperClassName="shrink-0 text-[11px] text-[var(--tf-text-tertiary)]"
          >
            <span className={GESTE}>~</span>
          </Tooltip>
        )}
      </button>
    </li>
  );
}
