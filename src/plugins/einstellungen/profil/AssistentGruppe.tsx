/**
 * Gruppe „Persönlicher Assistent" (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`, Screenshots 01/04).
 *
 * Zwei Schalter, eine Zusicherungszeile, zwei Klappen. Die langen
 * Datenschutz-Absätze, die bis v4.27 auf der Seite standen, sind ins ⓘ
 * gewandert — die Zusicherung „Alles bleibt auf diesem Gerät" bleibt als Zeile
 * sichtbar, weil sie die Entscheidung trägt.
 *
 * Abhängigkeit: „Persönliches Gedächtnis" ist gesperrt und gedimmt, solange
 * das Arbeitsprotokoll aus ist — der Grund steht als Kurzzeile an der Zeile
 * selbst und verschwindet beim Einschalten (doppeltes Opt-in, Pitfall #38).
 *
 * Alles bleibt gerätelokal (Pitfall #37): kein Share, kein Snapshot, kein Netz.
 */
import { useCallback, useEffect, useState } from 'react';
import { Download, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  exportiereProtokoll,
  istProtokollAktiv,
  ladeLetzteEreignisse,
  ladeStatistik,
  loescheProtokollVollstaendig,
  protokolliereEreignis,
  RETENTION_TAGE,
  setzeProtokollAktiv,
  type AssistentEreignis,
  type ProtokollStatistik,
} from '@/core/services/assistent/protokoll';
import {
  istGedaechtnisAktiv,
  setzeGedaechtnisAktiv,
} from '@/core/services/assistent/gedaechtnis';
import { isAssistentGedaechtnisEnabled } from '@/config/feature-flags';
import { fmtDatum, fmtZeit, typLabel } from '../_shared/assistent-format';
import {
  SettingsGruppe,
  SettingsKennzahl,
  SettingsKlappe,
  SettingsLeer,
  SettingsOption,
  SettingsTrustZeile,
  useAbschnittSichtbar,
} from '@/components/settings';
import { GedaechtnisVerwaltung, useGedaechtnisZahl } from './GedaechtnisVerwaltung';

const HINT_PROTOKOLL =
  `Zeichnet auf, was du in der App tust: geöffnete Anträge und Dokumente, deine Suchen, gestartete KI-Läufe. Die Daten bleiben ausschließlich auf diesem Gerät, sind für niemanden sonst einsehbar und gehen nie übers Internet. Löschen kannst du jederzeit; ältere Einträge verschwinden nach ${RETENTION_TAGE} Tagen automatisch.`;
const HINT_GEDAECHTNIS =
  'Ein Hintergrundlauf fasst dein Arbeitsprotokoll gelegentlich zu wenigen, knappen Notizen über deine Arbeit zusammen (woran du arbeitest, bevorzugte Abläufe, offene Fäden). Dabei gehen Protokolldaten an das interne Modell — es läuft vor Ort, nichts verlässt dieses Gerät ins Internet, kein externer Dienst. Die Notizen sind unten einsehbar, einzeln oder komplett löschbar.';
const HINT_TRUST =
  'Protokoll und Gedächtnis liegen in der IndexedDB dieses Browsers. Sie werden nicht auf den Team-Ordner geschrieben, nicht in Sicherungen aufgenommen und nicht exportiert — außer du exportierst sie hier selbst.';

/** Wie viele Ereignisse die Tabelle zeigt — sie ist ein Auszug, kein Bestand. */
const EREIGNIS_TABELLE_MAX = 100;

export function AssistentGruppe(): React.ReactElement | null {
  // Die Karte lebt für den Protokoll-Schalter. Ist der von der Beta-Achse
  // verborgen, sind es auch alle anderen Zeilen darin — übrig bliebe eine
  // Karte, die nur noch „Alles bleibt auf diesem Gerät" verspricht, ohne dass
  // es etwas gäbe, worauf sich das bezieht.
  const zeigeKarte = useAbschnittSichtbar('sec-assistent-protokoll');
  const [aktiv, setAktiv] = useState<boolean>(istProtokollAktiv());
  const [gedAktiv, setGedAktiv] = useState<boolean>(istGedaechtnisAktiv());
  const [stats, setStats] = useState<ProtokollStatistik | null>(null);
  const [letzte, setLetzte] = useState<AssistentEreignis[]>([]);
  const [loeschBestaetigung, setLoeschBestaetigung] = useState(false);

  const gedaechtnisAn = isAssistentGedaechtnisEnabled();
  const gedZahl = useGedaechtnisZahl(gedaechtnisAn && gedAktiv);

  const laden = useCallback(async () => {
    setStats(await ladeStatistik());
    setLetzte(await ladeLetzteEreignisse(EREIGNIS_TABELLE_MAX));
  }, []);

  useEffect(() => { void laden(); }, [laden]);

  const umschalten = useAsyncAction<[boolean]>(async next => {
    await setzeProtokollAktiv(next);
    setAktiv(next);
    // `einstellung_geaendert` nur beim Einschalten sinnvoll — danach greift das
    // Gate, beim Ausschalten wird ohnehin nichts mehr geschrieben.
    if (next) {
      void protokolliereEreignis({
        typ: 'einstellung_geaendert',
        detail: { schluessel: 'protokoll-optin', wert: true },
      });
    }
    await laden();
  });

  const gedUmschalten = useAsyncAction<[boolean]>(async next => {
    if (next && !aktiv) return; // doppeltes Opt-in — UI-seitig zusätzlich gesperrt
    await setzeGedaechtnisAktiv(next);
    setGedAktiv(next);
    if (next) {
      void protokolliereEreignis({
        typ: 'einstellung_geaendert',
        detail: { schluessel: 'gedaechtnis-optin', wert: true },
      });
    }
  });

  const exportieren = useAsyncAction(async () => { await exportiereProtokoll(); });

  const loeschen = useAsyncAction(async () => {
    await loescheProtokollVollstaendig();
    setLoeschBestaetigung(false);
    await laden();
  });

  const gesamt = stats?.gesamt ?? 0;
  const jeTyp = Object.entries(stats?.jeTyp ?? {}).sort((a, b) => b[1] - a[1]);

  if (!zeigeKarte) return null;

  return (
    <SettingsGruppe
      titel="Persönlicher Assistent"
      unterzeile="Merkt sich deine Arbeit, um dir später Vorschläge zu machen. Standardmäßig aus."
    >
      <SettingsOption
        id="sec-assistent-protokoll"
        label="Arbeitsprotokoll"
        hint={HINT_PROTOKOLL}
        kurzzeile={
          umschalten.error
            ? <span className="text-[var(--tf-danger-text)]">Konnte die Einstellung nicht speichern: {umschalten.error}</span>
            : 'Zeichnet Anträge, Suchen und KI-Läufe lokal auf'
        }
      >
        <Switch
          checked={aktiv}
          onCheckedChange={v => umschalten.run(v)}
          disabled={umschalten.busy}
          aria-label="Arbeitsprotokoll für den persönlichen Assistenten"
        />
      </SettingsOption>

      {gedaechtnisAn && (
        <SettingsOption
          id="sec-assistent-gedaechtnis"
          label="Persönliches Gedächtnis"
          hint={HINT_GEDAECHTNIS}
          // Die Sperre haengt am ARBEITSPROTOKOLL, nicht am Zusammenspiel
          // beider Schalter: die Konsolidierung prueft `istProtokollAktiv()`
          // und meldet sonst „deaktiviert". Bis v4.116 griff die Erklaerung nur,
          // wenn BEIDE aus waren — im Zustand „Gedaechtnis an, Protokoll aus"
          // stand der Schalter unkommentiert auf AN und versprach etwas, das
          // nicht galt.
          gesperrt={!aktiv}
          kurzzeile={
            gedUmschalten.error
              ? <span className="text-[var(--tf-danger-text)]">Konnte die Einstellung nicht speichern: {gedUmschalten.error}</span>
              : !aktiv
                ? (gedAktiv
                  ? 'Ruht, solange das Arbeitsprotokoll aus ist — es liefert die Grundlage'
                  : 'Erst möglich, wenn das Arbeitsprotokoll an ist')
                : undefined
          }
        >
          <Switch
            checked={gedAktiv}
            onCheckedChange={v => gedUmschalten.run(v)}
            disabled={gedUmschalten.busy || (!gedAktiv && !aktiv)}
            aria-label="Persönliches Gedächtnis (KI-Auswertung des Arbeitsprotokolls)"
          />
        </SettingsOption>
      )}

      <SettingsTrustZeile icon={<ShieldCheck size={14} />} hint={HINT_TRUST}>
        Alles bleibt auf diesem Gerät — keine Cloud, kein externer Dienst.
      </SettingsTrustZeile>

      <SettingsKlappe
        id="sec-assistent-daten"
        label="Aufgezeichnete Daten"
        storageKey="teamflow_settings_assistent_daten_collapsed"
        zaehler={`${gesamt.toLocaleString('de-DE')} ${gesamt === 1 ? 'Ereignis' : 'Ereignisse'}`}
      >
        <div className="grid grid-cols-2 gap-2 mb-3">
          <SettingsKennzahl label="Ereignisse" wert={gesamt.toLocaleString('de-DE')} />
          <SettingsKennzahl label="Typen" wert={String(jeTyp.length)} />
          <SettingsKennzahl label="Ältestes" wert={fmtDatum(stats?.aeltester ?? null)} />
          <SettingsKennzahl label="Neuestes" wert={fmtDatum(stats?.neuester ?? null)} />
        </div>

        {jeTyp.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 mb-3">
            {jeTyp.map(([typ, n]) => (
              <li
                key={typ}
                className="text-[11.5px] rounded-full px-2.5 py-[3px] bg-[var(--tf-bg)] text-[var(--tf-text-secondary)]"
              >
                {typLabel(typ)} · <span className="tabular-nums text-[var(--tf-text)]">{n}</span>
              </li>
            ))}
          </ul>
        )}

        {gesamt > 0 ? (
          <>
          {/* Die Tabelle zeigt die jüngsten EREIGNIS_TABELLE_MAX, der Zähler
              oben alle. Ohne diese Zeile las sich der Ausschnitt wie der ganze
              Bestand — der Export liefert dagegen wirklich alles. */}
          {gesamt > EREIGNIS_TABELLE_MAX && (
            <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mb-1">
              Auszug: die {EREIGNIS_TABELLE_MAX} neuesten von {gesamt.toLocaleString('de-DE')} Ereignissen.
              Der Export enthält alle.
            </p>
          )}
          <div
            className="rounded-[var(--tf-radius)] overflow-hidden max-h-72 overflow-y-auto bg-[var(--tf-bg)] mb-3"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <table className="w-full text-[11.5px]">
              <thead className="sticky top-0 bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]">
                <tr>
                  <th className="text-left font-medium px-2.5 py-1.5">Zeit</th>
                  <th className="text-left font-medium px-2.5 py-1.5">Typ</th>
                  <th className="text-left font-medium px-2.5 py-1.5">Entität</th>
                </tr>
              </thead>
              <tbody>
                {letzte.map((e, i) => (
                  <tr key={e.id} style={{ borderTop: i === 0 ? 'none' : '0.5px solid var(--tf-border)' }}>
                    <td className="px-2.5 py-1 text-[var(--tf-text-secondary)] tabular-nums whitespace-nowrap">
                      {fmtZeit(e.zeitstempel)}
                    </td>
                    <td className="px-2.5 py-1 text-[var(--tf-text)]">{typLabel(e.typ)}</td>
                    <td className="px-2.5 py-1 text-[var(--tf-text-secondary)] truncate max-w-[14rem]">
                      {e.entitaet ? `${e.entitaet.art}: ${e.entitaet.id}` : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        ) : (
          <SettingsLeer>
            {aktiv
              ? 'Noch nichts aufgezeichnet — der Verlauf füllt sich beim Arbeiten.'
              : 'Aufzeichnung ist aus, es liegen keine Ereignisse vor.'}
          </SettingsLeer>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            icon={Download}
            loading={exportieren.busy}
            disabled={gesamt === 0}
            onClick={() => exportieren.run()}
          >
            Als JSON exportieren
          </Button>
          {!loeschBestaetigung ? (
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              disabled={gesamt === 0}
              onClick={() => setLoeschBestaetigung(true)}
            >
              Alles löschen
            </Button>
          ) : (
            <>
              <span className="text-[12px] text-[var(--tf-text-secondary)]">
                Wirklich alle {gesamt.toLocaleString('de-DE')} Einträge löschen?
              </span>
              <Button variant="danger" size="sm" loading={loeschen.busy} onClick={() => loeschen.run()}>
                Ja, alles löschen
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setLoeschBestaetigung(false)}>
                Abbrechen
              </Button>
            </>
          )}
        </div>
        {(exportieren.error || loeschen.error) && (
          <p className="text-[12px] text-[var(--tf-danger-text)] mt-2">
            {exportieren.error ?? loeschen.error}
          </p>
        )}
      </SettingsKlappe>

      {gedaechtnisAn && gedAktiv && (
        <SettingsKlappe
          id="sec-gedaechtnis-eintraege"
          label="Gedächtnis-Einträge"
          storageKey="teamflow_settings_gedaechtnis_collapsed"
          zaehler={`${gedZahl} ${gedZahl === 1 ? 'Notiz' : 'Notizen'}`}
        >
          <GedaechtnisVerwaltung />
        </SettingsKlappe>
      )}
    </SettingsGruppe>
  );
}
