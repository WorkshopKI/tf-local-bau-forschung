import { useEffect, useRef, useState } from 'react';
import { useNavigate as useRouterNavigate } from 'react-router-dom';
import { ArrowRight, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ListItem } from '@/components/ui/ListItem';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useBearbeiterSicht } from '@/core/hooks/useBearbeiterSicht';
import { isKuerzelDropdownEnabled } from '@/config/feature-flags';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { bearbeiterScopeLabel } from '@/plugins/antraege/bearbeiterFilter';
import { getEingangAmpel, daysSinceEingang, AMPEL_COLOR, AMPEL_TOOLTIP } from '@/plugins/antraege/eingangAmpel';
import { schrittText } from '@/core/utils/naechsterSchritt';
import { useZeilenAufgaben } from '@/core/hooks/useBestandsAufgaben';
import { aufgabenAnzeige } from '@/core/status';
import { alterInTagen } from '@/core/utils/relativeZeit';
import { protokolliereEreignis } from '@/core/services/assistent/protokoll';
import type { AntragVorgang } from './useDashboardData';
import { MeineAntraegeBalken } from './MeineAntraegeBalken';
import { WidgetShell } from './widgets/WidgetShell';
import type { WidgetProps } from './widgets/widgetProps';

/**
 * Spaltet den Title-String in Akronym-Prefix (falls vorhanden + im Title) und
 * den Rest. Wenn der Title mit dem Akronym + " / " beginnt, wird das Akronym
 * separat zurückgegeben. Sonst wird das Akronym nicht aus dem Title entfernt
 * (Fallback: ganzer Title als rest, kein bolder Prefix).
 */
function splitTitle(title: string, acronym: string | undefined): { acronym: string | null; rest: string } {
  if (!acronym) return { acronym: null, rest: title };
  const trimmedAcr = acronym.trim();
  if (trimmedAcr.length === 0) return { acronym: null, rest: title };
  // Match "{acronym} / rest" — Akronym am Anfang gefolgt von optionalem
  // Whitespace, einem Slash, weiterem Whitespace, dann der Rest.
  const escaped = trimmedAcr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}\\s*/\\s*(.+)$`, 'i');
  const m = title.match(re);
  if (m && m[1]) return { acronym: trimmedAcr, rest: m[1] };
  return { acronym: null, rest: title };
}

/**
 * „Meine Anträge"-Widget (Home, Hauptbereich): offene eigene Förderanträge als
 * Handlungs-Zeile „Phase → nächster Schritt". Trägt seine drei Zustände selbst
 * (früher eine IIFE in HomePage): Kürzel-Onboarding-Karte, Empty-State,
 * Rückstands-Balken + Liste. Collapse lebt in der Widget-Config (Shell);
 * `visibleCount` lebt HIER (überlebt Ein-/Ausklappen, Body ist lazy).
 */
export function MeineAntraegeWidget({ instanz, ctx, onToggleEingeklappt }: WidgetProps): React.ReactElement {
  const { navigate } = useNavigation();
  const { data, initialCount } = ctx;
  const { mode: bearbeiterMode } = useBearbeiterSicht();
  const antraege = data.meineAntraege;
  const alleMode = !data.bearbeiterFilterActive;
  const [visibleCount, setVisibleCount] = useState(initialCount);

  // Wenn der Profil-Wert ändert (User passt im Einstellungs-Tab an), setzen
  // wir die in-page-Expansion zurück auf den neuen Initialwert.
  useEffect(() => {
    setVisibleCount(initialCount);
  }, [initialCount]);

  // v2.3: "Alle →" springt zu /antraege mit View "Offen" + Sort nach Frist
  // — sonst zeigt die Foerderantraege-Seite eine andere View/Sortierung als
  // die Home-Liste, was Verwirrung stiftete. Bearbeiter-Filter ist via
  // profile.bearbeiter_kuerzel sowieso automatisch aktiv.
  const handleAlle = (): void => {
    // Das Protokoll-Ereignis hing bis v2.372.2 am doppelten Knopf „Zu meinen
    // Anträgen →" im Rückstands-Balken. Mit dessen Wegfall zieht es hierher —
    // sonst verlöre das Assistent-Protokoll diesen Weg ersatzlos.
    void protokolliereEreignis({
      typ: 'frist_angesehen',
      detail: { quelle: 'home-meine-antraege', view: 'meine_offenen', sort: 'frist_asc' },
    });
    const store = useAntraegeStore.getState();
    store.setActiveView('meine_offenen');
    store.setSortForView('meine_offenen', 'frist_asc');
    navigate('antraege');
  };

  const zeigtListe = !(alleMode && !isKuerzelDropdownEnabled()) && antraege.length > 0;
  // TV-Summe über die geclusterten Einträge — dieselbe Rechnung wie im
  // Rückstands-Balken, hier für die Übersetzung im Zähler-Tooltip.
  const tvGesamt = antraege.reduce((s, v) => s + (v.tv_count ?? 1), 0);

  // Modus sichtbar in der Meta-Zeile (v1.1): „Kürzel THü" vs. „Alle Bearbeiter"
  // — ersetzt den früheren Titel-Swap; der Titel bleibt fix „Meine Anträge".
  // Der Modus kommt aus der geteilten Fassade, nicht aus einem hier
  // zusammengesetzten Teil-Objekt: nur so trägt er die Schreibweise der Kürzel
  // (`anzeigeTokens`) — und ein zweiter Bauplatz für denselben Modus lief schon
  // einmal der Sicht hinterher (Antragseingang, v4.47).
  const scopeLabel = bearbeiterScopeLabel(bearbeiterMode);
  // Dieselbe Schreibweise auch in den zwei Fließtexten darunter („Anträge mit
  // Ihrem Kürzel THü …") — sonst steht im Kopf der Karte eine andere Fassung
  // als drei Zeilen tiefer.
  const anzeigeKuerzel = bearbeiterMode.anzeigeTokens ?? data.bearbeiterTokens;

  // Kein „N sichtbar" in der Meta-Zeile mehr: dieselbe Auskunft steht als
  // „N von M" unter der Liste, dort mit der Gesamtzahl daneben (v2.372.2).
  return (
    <WidgetShell
      titel="Meine Anträge"
      meta={zeigtListe ? `${scopeLabel} · Sortierung: Frist` : undefined}
      variante="haupt"
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      instanz={instanz}
      aktion={
        zeigtListe ? (
          <button
            onClick={handleAlle}
            className="text-[11px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
          >
            Alle →
          </button>
        ) : undefined
      }
      zaehler={
        zeigtListe ? (
          // Die Einheit steht im Tooltip, weil sie sich unterwegs ändert: hier
          // sind Verbünde EIN Eintrag, im Reiter der Zielseite zählen die
          // Teilvorhaben einzeln. Wer „25" liest und drüben „32" sieht, hat
          // sonst zwei Zahlen ohne Übersetzung (v4.131).
          <span
            className="text-[12px] tabular-nums text-[var(--tf-text-tertiary)]"
            title={`${antraege.length} Einträge — Verbünde als einer gezählt. In der Förderanträge-Liste stehen sie als ${tvGesamt} Teilvorhaben.`}
          >
            {Math.min(visibleCount, antraege.length)} von {antraege.length}
          </span>
        ) : undefined
      }
    >
      {alleMode && !isKuerzelDropdownEnabled() ? (
        <KuerzelOnboardingKarte />
      ) : antraege.length === 0 ? (
        <EmptyKarte alleMode={alleMode} bearbeiterTokens={anzeigeKuerzel} />
      ) : (
        <>
          {/* Rückstands-Balken: eigene offene Anträge nach Quartals-Alter
              (Ab Q-3 · Q-2 · Q-1 · akt. Quartal) mit Hover-Detail. */}
          <MeineAntraegeBalken antraege={antraege} />
          <MeineAntraegeListe
            antraege={antraege}
            visibleCount={visibleCount}
            setVisibleCount={setVisibleCount}
            bearbeiterTokens={anzeigeKuerzel}
            alleMode={alleMode}
            erledigtLautKuerzeln={data.erledigtLautKuerzeln}
          />
        </>
      )}
    </WidgetShell>
  );
}

/** Onboarding-Karte: Bearbeiter-Kürzel noch nicht gesetzt (Varianten ohne
 *  Kürzel-Dropdown). Früher direkt in HomePage. */
function KuerzelOnboardingKarte(): React.ReactElement {
  // Router-`navigate` statt der Plugin-Navigation: nur damit lässt sich das
  // `?sektion=` mitgeben, das den Hub auf die gemeinte Karte scrollt und sie
  // markiert stehen lässt.
  const navigate = useRouterNavigate();
  return (
    <div className="bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] p-5">
      <div className="flex items-start gap-3">
        <Settings size={18} className="mt-0.5 text-[var(--tf-text-secondary)] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-[var(--tf-text)] mb-1">
            Ihr Bearbeiter-Kürzel ist noch nicht gesetzt
          </p>
          <p className="text-[12.5px] text-[var(--tf-text-secondary)] leading-snug mb-3">
            Tragen Sie in den Einstellungen Ihr Namenskürzel ein
            (z.B. <span className="font-mono">MUE</span>), damit hier automatisch
            Ihre offenen Anträge erscheinen.
          </p>
          <Button variant="secondary" size="sm" icon={ArrowRight} onClick={() => navigate('/einstellungen?sektion=sec-filter')}>
            Zu den Einstellungen
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Empty-State: Kürzel aktiv (oder „alle"-Übersicht), aber 0 offene Treffer.
 *  Früher direkt in HomePage. */
function EmptyKarte({ alleMode, bearbeiterTokens }: { alleMode: boolean; bearbeiterTokens: string[] }): React.ReactElement {
  const { navigate } = useNavigation();
  return (
    <div className="bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] p-5">
      <p className="text-[14px] font-medium text-[var(--tf-text)] mb-1">
        {alleMode ? (
          'Keine offenen Anträge'
        ) : (
          <>Keine offenen Anträge für Kürzel{' '}<span className="font-mono">{bearbeiterTokens.join(', ')}</span></>
        )}
      </p>
      <p className="text-[12.5px] text-[var(--tf-text-secondary)] leading-snug mb-3">
        {alleMode
          ? 'Aktuell sind keine offenen Förderanträge erfasst. In der Förderanträge-Liste können Sie alle Vorgänge einsehen.'
          : 'Aktuell sind keine offenen Förderanträge auf Sie zugeordnet. In der Förderanträge-Liste können Sie alle Vorgänge einsehen.'}
      </p>
      <Button variant="secondary" size="sm" icon={ArrowRight} onClick={() => navigate('antraege')}>
        Alle Förderanträge öffnen
      </Button>
    </div>
  );
}

interface ListeProps {
  /** Alle offenen eigenen Förderanträge, bereits sortiert (Frist asc → VB-Phase asc). */
  antraege: AntragVorgang[];
  visibleCount: number;
  setVisibleCount: React.Dispatch<React.SetStateAction<number>>;
  /** Die eigenen Kürzel in der Schreibweise der Daten. Nur für den Help-Text. */
  bearbeiterTokens: string[];
  /** „alle"-/Übersichtsmodus (pl/dev): MA-Kürzel je Zeile. */
  alleMode: boolean;
  /** Wie viele Zeilen einen offenen Status tragen, laut Kürzeln aber durch sind. */
  erledigtLautKuerzeln: number;
}

/** Listen-Body (Inhalte pixel-identisch zur früheren Sektion; Header/Collapse
 *  liegen jetzt in der WidgetShell). */
function MeineAntraegeListe({
  antraege, visibleCount, setVisibleCount, bearbeiterTokens, alleMode, erledigtLautKuerzeln,
}: ListeProps): React.ReactElement {
  const { navigate } = useNavigation();
  // Der Stichtag wird EINMAL gestempelt — alle Liegezeiten sind relativ zu ihm.
  const heuteRef = useRef<string>(new Date().toISOString());
  // `'leerlauf'`: die Liste steht sofort da, die Aufgaben-Spalte füllt sich, wenn
  // der Bestandslauf durch ist. Wer vorher schon auf dem Vorgangs-Board war,
  // liest dessen Ergebnis — es ist dieselbe Ablage.
  const aufgaben = useZeilenAufgaben('leerlauf', heuteRef.current);
  const visible = antraege.slice(0, visibleCount);
  const hasMore = antraege.length > visibleCount;
  const remaining = antraege.length - visibleCount;
  const nextChunk = Math.min(10, remaining);

  return (
    <div>
      <p className="text-[10.5px] text-[var(--tf-text-tertiary)] mb-1">
        {alleMode ? (
          'Offene Anträge aller aktiven MAs, sortiert nach Frist · Verbünde als ein Eintrag'
        ) : (
          <>Anträge mit Ihrem Kürzel <span className="font-mono">{bearbeiterTokens.join(', ')}</span>, sortiert nach Frist · Verbünde als ein Eintrag</>
        )}
      </p>
      {/* Der Befund gehört genannt, nicht weggeräumt: ein offener Status über
          einem gesetzten Schlussvermerk ist eine Abweichung im Fachsystem. Sie
          zählen nicht mehr als offen und stehen am Ende der Liste. */}
      {erledigtLautKuerzeln > 0 ? (
        <p className="mb-1 text-[10.5px] text-[var(--tf-text-tertiary)]">
          {erledigtLautKuerzeln === 1
            ? '1 Vorgang ist laut Kürzeln erledigt, trägt aber noch einen offenen Status — er steht am Ende und zählt nicht als offen.'
            : `${erledigtLautKuerzeln} Vorgänge sind laut Kürzeln erledigt, tragen aber noch einen offenen Status — sie stehen am Ende und zählen nicht als offen.`}
        </p>
      ) : null}
      {visible.map((v, i) => {
        // Verbund-Titel (VB_TITEL) bevorzugt, sonst TV-Titel; Akronym daraus
        // ableiten (Pattern „${akronym} / ${rest}") bzw. aus dem CSV-Feld.
        const baseTitle = v.verbund_titel ?? v.title;
        const split = splitTitle(baseTitle, v.acronym);
        // Primär-Label: Akronym (bevorzugt), sonst der (Verbund-)Titel.
        const displayLabel = split.acronym ?? (v.acronym?.trim() || null) ?? split.rest;

        // Ampel-Punkt + Eingangsalter aus demselben Datum (antragsdatum) — der
        // Punkt spiegelt die Eingangs-Ampel, „vor N Tagen" das Eingangsalter.
        const ampel = getEingangAmpel(v);
        const ageLabel = alterInTagen(daysSinceEingang(v));

        // **Die Aufgabe kommt aus derselben Kaskade wie im Vorgangs-Board**
        // (v4.132). Vorher rechnete hier `schrittText` allein aus dem Rohstatus
        // — bei 101 von 102 Vorgängen mit „Gutachten fertig" stand deshalb
        // „Gutachten freigeben", obwohl `D_AT4` gesetzt war und der Ball längst
        // bei der QS lag. Der alte Weg bleibt als Rückfall, wo die Kaskade
        // schweigt (`aufgabenAnzeige`) — nie unter den bisherigen Stand zurück.
        const anzeige = aufgabenAnzeige({
          aufgabe: aufgaben.fuer(v.tv_aktenzeichen ?? [v.id]),
          rueckfall: schrittText(v.status, v.precheck_status_label ?? ''),
          laeuftNoch: aufgaben.laeuftNoch,
          regeln: aufgaben.regeln,
        });

        const dot = ampel ? (
          <span
            className="block w-2 h-2 rounded-full"
            style={{ background: AMPEL_COLOR[ampel] }}
            title={AMPEL_TOOLTIP[ampel]}
            aria-hidden="true"
          />
        ) : (
          <span className="block w-2 h-2 rounded-full bg-[var(--tf-text-tertiary)] opacity-40" aria-hidden="true" />
        );

        return (
          <ListItem
            key={v.id}
            iconBare
            icon={dot}
            title={
              <span className="flex items-baseline gap-2 w-full min-w-0">
                <span className="font-medium text-[var(--tf-text)] shrink-0 max-w-[55%] truncate">{displayLabel}</span>
                {/* Verbund-Marke wie auf der Kanban-Karte (v4.131): die Zeile
                    steht für einen Cluster, nicht für ein Teilvorhaben. Bis
                    dahin trug nur das Kanban sie — auf derselben Bildschirmseite
                    stand „2 TV" an der einen Karte und nichts an der anderen,
                    obwohl beide denselben Verbund meinten. */}
                {(v.tv_count ?? 1) > 1 ? (
                  <span
                    className="shrink-0 rounded-full bg-[var(--tf-bg-secondary)] px-1.5 py-px text-[10px] tabular-nums text-[var(--tf-text-tertiary)]"
                    title={`Verbund mit ${v.tv_count} Teilvorhaben — hier als ein Eintrag`}
                  >
                    {v.tv_count} TV
                  </span>
                ) : null}
                {anzeige.text ? (
                  <span
                    className="flex items-baseline gap-1.5 truncate min-w-0 flex-1"
                    title={anzeige.titel}
                  >
                    <span
                      // Nur `gesperrt` wird gedämpft — dass eine Aufgabe einer
                      // anderen Rolle gehört, sagt die Adresse daneben in
                      // Worten („wartet auf QS"). Eine Graustufe wäre hier der
                      // schlechtere Träger: `--tf-text-tertiary` misst 2,62:1
                      // und liegt unter AA, und in der FB-Sicht wären es 16 von
                      // 19 Zeilen.
                      className={anzeige.quelle === 'gesperrt'
                        ? 'text-[var(--tf-text-tertiary)] shrink-0'
                        : 'text-[var(--tf-text-secondary)] shrink-0'}
                    >
                      {anzeige.text}
                    </span>
                    {/* Die Adresse steht DANEBEN, nicht im Aufgaben-Text: „in QS"
                        ist die Aufgabe, „wartet auf QS" die Auskunft, wer am Zug
                        ist. Zusammengeschrieben läse sich beides als Anweisung
                        an den Leser. */}
                    {anzeige.neben ? (
                      <span className="text-[11px] text-[var(--tf-text-tertiary)] truncate min-w-0">
                        {anzeige.neben}
                      </span>
                    ) : null}
                    {anzeige.anteil ? (
                      <span className="shrink-0 text-[10px] tabular-nums text-[var(--tf-text-tertiary)]">
                        {anzeige.anteil}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </span>
            }
            dicht
            titleClassName="text-[12.5px] leading-[1.4] min-w-0"
            meta={
              ageLabel ? (
                <span className="text-[11px] tabular-nums text-[var(--tf-text-tertiary)] whitespace-nowrap">
                  {ageLabel}
                </span>
              ) : undefined
            }
            onClick={() => navigate('antraege', { selectedId: v.id })}
            last={i === visible.length - 1}
          />
        );
      })}
      {hasMore ? (
        // Der Knopf nennt den Rest, den er NICHT zeigt. „+10 mehr anzeigen" bei
        // 628 verbleibenden las sich wie ein vollwertiger Weg durch die Liste —
        // tatsächlich wären es 63 Klicks; der Weg dorthin ist „Alle →" oben in
        // derselben Karte. Der Zähler stand hier ein zweites Mal (identisch zum
        // Karten-Kopf) und ist deshalb entfallen (v2.372.4).
        <div className="mt-2">
          <button
            onClick={() => setVisibleCount(c => Math.min(antraege.length, c + 10))}
            className="text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
            title={`Zeigt ${nextChunk} weitere hier in der Karte. Die vollständige Liste öffnet „Alle →" oben.`}
          >
            +{nextChunk} anzeigen{' '}
            <span className="text-[var(--tf-text-tertiary)]">
              ({remaining.toLocaleString('de-DE')} weitere)
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
