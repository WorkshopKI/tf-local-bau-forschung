/**
 * „Lage & Aufgaben" — die Landeseite der Kuration.
 *
 * Sie beantwortet die Frage, die vor v4.34 keine Seite beantwortete: *was ist
 * der Zustand, und was ist zu tun?* Bis dahin stand jede Teilaussage auf einer
 * anderen Seite, und man musste sie aufsuchen, um zu erfahren, dass dort nichts
 * zu tun war.
 *
 * Zwei Regeln halten die Seite ehrlich:
 *
 *  1. **Nichts wird hier hergeleitet.** Jede Zeile liest die Aussage des
 *     Moduls, das sie verantwortet (`useKurationLage`, `useCsvFreshness`).
 *  2. **Auch der Ruhezustand steht da.** Eine Zeile, die nur bei Problemen
 *     erscheint, macht Abwesenheit mehrdeutig — „nichts zu sehen" hiesse dann
 *     entweder „alles gut" oder „noch nicht geladen". Aus demselben Grund sagt
 *     eine Zeile, die ihren Stand gerade NICHT pruefen konnte, genau das —
 *     statt „noch kein Import" zu behaupten.
 *
 * Die Beta-/Experten-Achse steht ueber beiden Regeln: was sie verbirgt, faellt
 * ganz weg (heute „CSV-Datenimport", `sec-lage-csv` traegt seit v4.117 die
 * Experten-Marke). Das ist kein Ruhezustand, sondern eine Kurations-Entscheidung
 * — halb dargestellt waere sie schlimmer als gar nicht.
 */
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { restlaufzeitLabel, useKuratorSession } from '@/core/hooks/useKuratorSession';
import { hatModulSchloss } from '@/config/feature-flags';
import { spiegleKuratorSchalterInSession } from '@/core/modul-freischaltung';
import { useCsvFreshness } from '@/components/ui/CsvFreshnessIndicator';
import { csvFreshnessAussage, type CsvFreshnessTon } from '@/plugins/csv-sources-kuration/services/csv-freshness-state';
import {
  SettingsGruppe,
  SettingsOption,
  SettingsStatusBadge,
  SettingsTrustZeile,
  SettingsZweiSpalten,
  useHubNavigation,
  type SettingsBadgeTon,
} from '@/components/settings';
import { useKurationLage } from './useKurationLage';

/**
 * Der CSV-Check kennt „nicht pruefbar" (offline, kein Handle) — das Badge nennt
 * das `neutral`. Die Index-Ampel braucht keine Abbildung, ihre drei Toene
 * heissen schon so wie die des Badges.
 */
const CSV_ZU_TON: Record<CsvFreshnessTon, SettingsBadgeTon> = {
  ok: 'ok',
  warnung: 'warnung',
  fehler: 'fehler',
  unbekannt: 'neutral',
};

function datum(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('de-DE') : '—';
}

export function UebersichtPanel(): React.ReactElement {
  const lage = useKurationLage();
  const csv = useCsvFreshness();
  const csvAussage = csvFreshnessAussage({ state: csv.state, misconfig: csv.misconfig });
  const { navigate } = useNavigation();
  // Ziele im eigenen Hub werden als PANEL angesprungen, nicht als Route: ein
  // `navigate('/kuration')` montierte den Hub neu. Bis v4.35 stand hier
  // `navigate('kurator')` — die Id des Plugins, das in eben diesem Umbau zum
  // Panel geworden war; `pluginIdToRoute` fiel auf `/` zurueck und der Knopf
  // landete auf der Startseite.
  const hub = useHubNavigation();
  const storage = useStorage();
  const session = useKuratorSession();
  const sperren = useAsyncAction(async () => {
    await session.deactivate(storage.idb);
  });
  /**
   * Der Rückweg — nur in Builds OHNE Kurator-Schloss.
   *
   * „Sperren" war dort bis v4.119 eine Einbahn: es beendet die Sitzung, lässt
   * `profile.is_kurator` aber stehen, und der genannte Weg zurück
   * („Einstellungen → Mein Profil → Zusatz-Module") zeigt genau dann einen
   * Schalter, der bereits AN steht — zurück kam man nur über Aus/An oder einen
   * Neustart. Wo ein Zusatzpasswort existiert, bleibt der Weg dorthin richtig:
   * aufschließen heißt dort, das Passwort einzugeben.
   */
  const ohneSchloss = !hatModulSchloss('kurator');
  const freischalten = useAsyncAction(async () => {
    await spiegleKuratorSchalterInSession(storage.idb, true);
  });

  const zahl = (n: number): string => n.toLocaleString('de-DE');

  return (
    <SettingsZweiSpalten
      haupt={
        <SettingsGruppe
          id="sec-lage"
          titel="Zu tun"
          unterzeile="Der Stand der Daten, die das ganze Team sieht."
        >
          <SettingsOption
            id="sec-lage-index"
            label="Suchindex"
            hint="Der Index trägt die Volltext- und die semantische Suche. Er veraltet nicht von selbst, sondern wenn neue Dokumente dazukommen oder das Embedding-Modell wechselt — beides steht hier, sobald es zutrifft."
            badge={
              lage.index && (
                <SettingsStatusBadge ton={lage.index.ampel.ton}>
                  {lage.index.ampel.label}
                </SettingsStatusBadge>
              )
            }
            kurzzeile={
              lage.index
                ? `${zahl(lage.index.docCount)} Dokumente · ${zahl(lage.index.chunkCount)} Textabschnitte · zuletzt ${datum(lage.index.lastUpdate)}`
                : 'wird gelesen …'
            }
          >
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => hub.geheZuPanel('suche-index')}
            >
              Öffnen
            </Button>
          </SettingsOption>

          <SettingsOption
            id="sec-lage-csv"
            label="CSV-Datenimport"
            hint="Die Fördertabelle kommt als CSV-Export aus dem Fachsystem. Der Stand hier ist derselbe, den der Punkt ● CSV in der Fußzeile zeigt; ein Klick dort importiert."
            badge={<SettingsStatusBadge ton={CSV_ZU_TON[csvAussage.ton]}>{csvAussage.label}</SettingsStatusBadge>}
            kurzzeile={
              csv.lastImport
                ? `Letzter Import: ${new Date(csv.lastImport).toLocaleString('de-DE')}`
                // `state: 'offline'` heisst „konnte nicht geprueft werden"
                // (Startlauf noch nicht fertig oder Share nicht verbunden) —
                // das ist etwas anderes als „es gab nie einen Import".
                : csv.state === 'offline'
                  ? 'Stand nicht prüfbar — der Daten-Share ist nicht verbunden.'
                  : 'Noch kein Import verzeichnet.'
            }
          >
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => hub.geheZuPanel('csv-quellen')}
            >
              Öffnen
            </Button>
          </SettingsOption>

          {lage.offeneReviews != null && (
            <SettingsOption
              id="sec-lage-review"
              label="Dokument-Prüfung"
              hint="Die Triage entscheidet je Datei: relevant, irrelevant oder unsicher. Nur die unsicheren landen in der Warteschlange — hier steht, wie viele davon offen sind."
              badge={
                <SettingsStatusBadge ton={lage.offeneReviews > 0 ? 'warnung' : 'ok'}>
                  {lage.offeneReviews > 0
                    ? `${zahl(lage.offeneReviews)} offen`
                    : 'nichts offen'}
                </SettingsStatusBadge>
              }
              kurzzeile={`${zahl(lage.reviewGesamt ?? 0)} Dokumente klassifiziert`}
            >
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => navigate('dokument-review')}
              >
                Öffnen
              </Button>
            </SettingsOption>
          )}
        </SettingsGruppe>
      }
      neben={
        <SettingsGruppe
          id="sec-sitzung"
          titel="Kurator-Sitzung"
          unterzeile="Solange sie läuft, sind die Schreib-Aktionen offen."
        >
          <SettingsOption
            label="Freigeschaltet"
            badge={
              <SettingsStatusBadge ton={session.isActive ? 'ok' : 'neutral'}>
                {session.isActive ? `noch ${restlaufzeitLabel(session.expiresAt)}` : 'gesperrt'}
              </SettingsStatusBadge>
            }
            kurzzeile={
              sperren.error || freischalten.error
                ? <span className="text-[var(--tf-danger-text)]">Fehler: {sperren.error ?? freischalten.error}</span>
                : session.isActive
                  ? session.kuratorName
                    ? `Angemeldet als ${session.kuratorName}.`
                    : undefined
                  : ohneSchloss
                    ? 'Diese Programmfassung braucht kein Zusatzpasswort — der Knopf schaltet direkt wieder frei.'
                    : 'Freischalten läuft über Einstellungen → Mein Profil → Zusatz-Module.'
            }
          >
            {session.isActive ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => sperren.run()}
                loading={sperren.busy}
              >
                Sperren
              </Button>
            ) : ohneSchloss ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => freischalten.run()}
                loading={freischalten.busy}
              >
                Freischalten
              </Button>
            ) : null}
          </SettingsOption>

          <SettingsTrustZeile icon={<Globe size={14} />}>
            Was du hier änderst, sehen alle — es liegt auf dem Daten-Share, nicht auf diesem Gerät.
          </SettingsTrustZeile>
        </SettingsGruppe>
      }
    />
  );
}
