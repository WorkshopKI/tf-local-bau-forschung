/**
 * Der Vektorindex der Ähnlichkeitssuche — bauen, holen, nachziehen (v4.127).
 *
 * Bis v4.127 stand hier nur eine **Statuskarte**, die auf das Auslastungs-Modul
 * verwies („die eigentliche Build/Sync-UI lebt dort, weil sie tief mit der
 * Centroid-Berechnung verflochten ist"). Die Begründung stimmt technisch bis
 * heute — nur war die Schlussfolgerung falsch: der Korpus ist der Vektorindex
 * der Suche und damit ein Kurations-Gegenstand, nicht Interna eines Moduls, das
 * ihn zweitverwertet. Er lag hinter dem Auslastungs-Zusatzpasswort UND dem
 * Experten-Schalter, und sein Aufbau-Knopf existierte in `zah-pl` überhaupt
 * nicht (`isDevContext()`), während drei Texte in der App dazu aufforderten,
 * ihn zu klicken.
 *
 * Die Mechanik liegt in [useKorpusBau](../hooks/useKorpusBau.ts); hier wird nur
 * gezeigt und geschaltet.
 */
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useStorage } from '@/core/hooks/useStorage';
import { useEmbeddingCorpusMirror } from '@/core/hooks/useEmbeddingCorpusMirror';
import {
  CORPUS_BUILD_VERSION, getCorpusBuildVersion, GERAET_DATIV,
} from '@/core/services/embedding-corpus';
import {
  istNachlaufAn, setzeNachlauf, ladeNachlaufStand, schaetzeVollbauSekunden,
} from '@/plugins/auslastung/services/matching';
import { useKorpusBau } from '../hooks/useKorpusBau';
import { PHASEN_LABEL, istZaehlbar } from '../hooks/bauFortschritt';

function formatiereEta(sek: number): string {
  if (sek < 60) return `${Math.round(sek)} s`;
  const min = Math.round(sek / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

function formatiereMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(0);
}

const HINWEIS_KLASSE = 'rounded p-2 mb-2 text-[11.5px]';
const HINWEIS_INFO = {
  background: 'var(--tf-info-bg, #dbeafe)',
  color: 'var(--tf-info-text, #1e40af)',
  border: '0.5px solid var(--tf-info-border, #bfdbfe)',
};
const HINWEIS_WARN = {
  background: 'var(--tf-warning-bg, #fef3c7)',
  color: 'var(--tf-warning-text, #92400e)',
  border: '0.5px solid var(--tf-warning-border, #fde68a)',
};

export function EmbeddingKorpusSection(): React.ReactElement {
  const storage = useStorage();
  const bau = useKorpusBau();
  const manifest = useEmbeddingCorpusMirror(s => s.manifest);
  const laedtRunter = useEmbeddingCorpusMirror(s => s.downloading);
  const downloadFortschritt = useEmbeddingCorpusMirror(s => s.downloadProgress);
  const laedtHoch = useEmbeddingCorpusMirror(s => s.uploading);
  const uploadFortschritt = useEmbeddingCorpusMirror(s => s.uploadProgress);
  const spiegelFehler = useEmbeddingCorpusMirror(s => s.error);

  const [nachlaufAn, setNachlaufAn] = useState(false);
  const [nachlaufStand, setNachlaufStand] = useState<string | null>(null);

  // Pitfall #15: die Läufe dauern Minuten, und ein roher Fire-and-forget-Handler
  // schluckt die Rejection — der Knopf sähe dann aus, als täte er nichts.
  const holen = useAsyncAction(bau.ladeVomSpeicher);
  const neuBauen = useAsyncAction(() => bau.baue(true));
  const nachziehen = useAsyncAction(() => bau.baue(false));
  const zuruecksetzen = useAsyncAction(bau.leere);
  const spiegeln = useAsyncAction(bau.spiegle);
  const grafikkarte = useAsyncAction(bau.wiederMitGrafikkarte);
  const schalten = useAsyncAction(async (an: boolean) => {
    setNachlaufAn(an);
    await setzeNachlauf(storage.idb, an);
  });

  useEffect(() => {
    let abgebrochen = false;
    void (async () => {
      const [an, stand] = await Promise.all([
        istNachlaufAn(storage.idb),
        ladeNachlaufStand(storage.idb),
      ]);
      if (abgebrochen) return;
      setNachlaufAn(an);
      setNachlaufStand(stand);
    })();
    return () => { abgebrochen = true; };
  }, [storage]);

  // Die Bestandsaufnahme streamt ~14 k Records und braucht ein paar Sekunden.
  // Solange sie laeuft, ist NICHTS bekannt — und „0 von 0 · Nachziehen: nichts
  // offen" waere kein Platzhalter, sondern eine falsche Auskunft.
  const ermittelt = bau.bestand !== null;
  const lokal = bau.bestand?.lokal ?? 0;
  const embedbar = bau.bestand?.embeddableAz.length ?? 0;
  const offen = bau.bestand?.zuEmbedden.length ?? 0;
  const p = bau.fortschritt;

  // Der Balken trägt den GANZEN Lauf (`p.prozent`, gerechnet in
  // [bauFortschritt.ts](../hooks/bauFortschritt.ts)); die Zeile darüber die
  // laufende Phase. Vorher war beides dasselbe — deshalb lief der Balken je
  // Phase einmal von vorne los.
  const prozent = p ? p.prozent : (embedbar > 0 ? Math.min(100, (lokal / embedbar) * 100) : 0);

  const shareVersion = manifest ? getCorpusBuildVersion(manifest) : null;
  // Eine Messung von der Grafikkarte sagt über einen Lauf auf dem
  // Hauptprozessor nichts — dann steht am Knopf wieder die Anzahl.
  const vollbauSek = schaetzeVollbauSekunden(bau.rate, embedbar, bau.geraet);
  const rateGilt = schaetzeVollbauSekunden(bau.rate, 1, bau.geraet) !== null;

  return (
    <div className="pt-1">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[12px] text-[var(--tf-text-secondary)]">
          {p
            ? (istZaehlbar(p.phase)
                ? `${PHASEN_LABEL[p.phase]}: ${p.done.toLocaleString('de-DE')} von ${p.total.toLocaleString('de-DE')}`
                : PHASEN_LABEL[p.phase])
            : ermittelt
              ? `${lokal.toLocaleString('de-DE')} von ${embedbar.toLocaleString('de-DE')} Vorhaben haben einen Vektor`
              : 'Bestand wird ermittelt…'}
        </span>
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {Math.round(prozent)} %
        </span>
      </div>

      <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: 'var(--tf-bg-secondary)' }}>
        <div className="h-full bg-[var(--tf-primary)] transition-all" style={{ width: `${prozent}%` }} />
      </div>

      {p && istZaehlbar(p.phase) && (
        <div className="text-[11.5px] text-[var(--tf-text-secondary)] mb-2">
          {p.last && <span className="font-mono mr-2">{p.last}</span>}
          {p.etaSec != null && (
            <span className="text-[var(--tf-text-tertiary)]">≈ {formatiereEta(p.etaSec)} verbleibend</span>
          )}
        </div>
      )}

      {/* Ein Nachladen sind mehrere Sekunden ohne einen einzigen Tick. Ohne
          diese Zeile sähe die stärkste Rettung, die der Lauf kennt, aus wie ein
          Hänger — und der Nutzer bräche ab, kurz bevor es weitergeht. */}
      {bau.nachladen && (
        <div className={HINWEIS_KLASSE} style={HINWEIS_WARN}>
          Der Grafik-Kontext ist weggebrochen — das Modell wird neu geladen
          {bau.nachladen.nummer > 1 ? ` (${bau.nachladen.nummer}. Mal)` : ''}, und zwar auf
          {' '}{GERAET_DATIV[bau.nachladen.geraet]}. Der Lauf setzt danach dort fort, wo er
          stehengeblieben ist; bitte nicht abbrechen.
        </div>
      )}

      {laedtRunter && downloadFortschritt && (
        <div className="text-[11.5px] text-[var(--tf-text-secondary)] mb-2">
          Lade vom Datenspeicher: {downloadFortschritt.done}/{downloadFortschritt.total} Vektoren
        </div>
      )}
      {laedtHoch && (
        <div className="text-[11.5px] text-[var(--tf-text-secondary)] mb-2">
          Spiegle den Korpus auf den Datenspeicher…
          {uploadFortschritt && ` ${formatiereMB(uploadFortschritt.geschrieben)} von `
            + `${formatiereMB(uploadFortschritt.gesamt)} MB`}
        </div>
      )}

      {/* Der Befund des Abgleichs — dieselbe Regel, die auch der Start-Abgleich
          und die Zeile unter dem Suchfeld benutzen. */}
      {bau.befund && bau.befund.aktion !== 'nichts' && (
        <div
          className={HINWEIS_KLASSE}
          style={bau.befund.aktion === 'unbrauchbar' ? HINWEIS_WARN : HINWEIS_INFO}
        >
          {bau.befund.grund}
        </div>
      )}

      {/* Was FRÜHER schiefging, interessiert hier niemanden — nur, was die
          Vektoren von heute nicht können. Der zweite Halbsatz gilt für v1/v2;
          eine spätere Fassung bekommt ihren eigenen oder gar keinen. */}
      {bau.befund?.neuaufbauNoetig && (
        <div className={HINWEIS_KLASSE} style={HINWEIS_WARN}>
          <strong>Neuaufbau nötig, nicht nur empfohlen.</strong> Die Vektoren stammen aus
          Textfassung v{bau.befund.versionDanach} (aktuell v{CORPUS_BUILD_VERSION})
          {(bau.befund.versionDanach ?? 0) <= 2
            && ' — sie kennen nur Titel und Deskriptoren eines Vorhabens, nicht die Projektbeschreibung'}.
        </div>
      )}

      {/* Eine Festlegung, die aus einer Messung an DIESEM Rechner entstand —
          also gehört sie sichtbar hierher, samt Rückweg. Eine stille
          Verlangsamung wäre schlimmer als der Absturz, den sie verhindert. */}
      {bau.geraetPraeferenz?.geraet === 'wasm' && !bau.laeuft && (
        <div className={HINWEIS_KLASSE} style={HINWEIS_INFO}>
          Dieser Rechner baut die Vektoren auf dem <strong>Hauptprozessor</strong> — die
          Grafikkarte hat am{' '}
          {new Date(bau.geraetPraeferenz.am).toLocaleDateString('de-DE')} mitten im Lauf
          aufgegeben. Das ist rund <strong>30-mal langsamer</strong> (gemessen: 2,0 statt
          0,07 Sekunden je Vektor); ein voller Neuaufbau dauert damit über zwölf Stunden.
          Für einen vollständigen Korpus ist <em>Vom Datenspeicher laden</em> hier der
          bessere Weg.{' '}
          <Button
            type="button" variant="link" size="xs" className="px-0 h-auto align-baseline"
            onClick={() => grafikkarte.run()} disabled={grafikkarte.busy}
            title="Lädt das Modell sofort wieder auf die Grafikkarte — die Oberfläche steht dabei kurz."
          >
            Wieder mit Grafikkarte versuchen
          </Button>
        </div>
      )}

      {/* „Synchron mit dem Datenspeicher" und „vollständig für diesen Bestand"
          sind ZWEI Fragen. Bis v4.128 beantwortete die Karte die erste mit einem
          ✓ und die zweite still über die Zahl am Knopf — was sich für den Leser
          widersprach: gerade gebaut, synchron, und trotzdem 136 offen. Ein
          Korpus deckt immer den Bestand ab, den SEIN Erbauer hatte; jede
          Build-Variante hat ihre eigene IndexedDB und damit ihren eigenen. */}
      {bau.befund?.aktion === 'nichts' && manifest && lokal > 0 && !bau.befund.neuaufbauNoetig && (
        offen === 0 ? (
          <div className="text-[11px] text-[var(--tf-text-tertiary)] mb-2">
            ✓ Mit dem Datenspeicher synchron ({manifest.antraegeCount.toLocaleString('de-DE')} Vektoren,
            Textfassung v{shareVersion}, Stand {new Date(manifest.builtAt).toLocaleDateString('de-DE')}
            {manifest.builderProfile ? ` von ${manifest.builderProfile}` : ''}) — und vollständig für
            diesen Bestand.
          </div>
        ) : (
          <div className={HINWEIS_KLASSE} style={HINWEIS_INFO}>
            Gleicher Stand wie der Datenspeicher ({manifest.antraegeCount.toLocaleString('de-DE')} Vektoren,
            gebaut am {new Date(manifest.builtAt).toLocaleDateString('de-DE')}
            {manifest.builderProfile ? ` von ${manifest.builderProfile}` : ''}) —{' '}
            <strong>
              für {offen.toLocaleString('de-DE')} Vorhaben aus diesem Bestand hat er trotzdem keinen
              aktuellen Vektor
            </strong>
            {' '}(sie fehlen ihm, oder ihr Text hat sich seit seinem Bau geändert). Ein Korpus deckt den
            Bestand ab, den sein Erbauer beim Bau hatte, nicht den, der hier liegt.
            „Nachziehen“ holt genau diese {offen.toLocaleString('de-DE')} nach
            {bau.rate && rateGilt && ` (≈ ${formatiereEta(offen * bau.rate.sekProItem)})`}.
          </div>
        )
      )}

      {/* Ein Lauf, dem die Einbettung wegbricht, ist kein Nebensatz in der
          Bilanzzeile. Bis v6.15 stand er dort als „13.418 übersprungen (kein
          Text oder Fehler)" — dieselbe Formulierung wie für einen Bestand ohne
          Texte, und der einzige Hinweis auf den echten Grund lag in der
          Browser-Konsole. */}
      {bau.bilanz && bau.bilanz.fehlgeschlagen > 0 && !bau.laeuft && (
        <div className={HINWEIS_KLASSE} style={HINWEIS_WARN}>
          <strong>
            {bau.bilanz.fehlgeschlagen.toLocaleString('de-DE')} Vorhaben konnten nicht
            eingebettet werden.
          </strong>{' '}
          {bau.bilanz.abbruchGrund === 'fehlerserie'
            ? 'Nach einer Serie von Fehlschlägen wurde der Lauf abgebrochen — das Modell antwortet nicht mehr (Speicher voll oder Grafik-Kontext verloren). '
            : ''}
          {/* Die Erholung ist die erste Verteidigungslinie; was hier ankommt,
              hat sie nicht halten können. Das gehört gesagt — sonst liest sich
              der Abbruch, als hätte es niemand versucht. */}
          {bau.bilanz.erholungen > 0
            ? `Das Modell wurde dabei ${bau.bilanz.erholungen}× neu geladen`
              + `${bau.bilanz.geraet === 'wasm' ? ', zuletzt auf dem Hauptprozessor' : ''} `
              + '— ohne Erfolg. '
            : ''}
          {/* Der Versuch, der selbst misslang. Ohne diesen Satz ist „es wurde
              nichts versucht" von „der Versuch scheiterte" nicht zu
              unterscheiden — und dann sagt die Karte nichts darüber, ob diese
              Fassung die Erholung überhaupt kennt. */}
          {bau.bilanz.erholungGescheitert && (
            <>
              Das Nachladen des Modells wurde versucht und schlug fehl — weder auf der
              Grafikkarte noch auf dem Hauptprozessor ließ es sich neu aufbauen (
              <span className="font-mono">{bau.bilanz.erholungGescheitert}</span>).{' '}
            </>
          )}
          Der Korpus behält für diese Vorhaben seine alten Vektoren
          {/* Nur behaupten, was passiert ist: im GLEICHEN Vektorraum stempelt
              der Lauf auch mit Einzelfehlern, weil er nichts ablöst. */}
          {!bau.bilanz.signaturGestempelt && '; die Textfassung wurde deshalb nicht als aktuell vermerkt'}
          , und der Datenspeicher wurde nicht überschrieben.{' '}
          {bau.bilanz.ersterFehler && (
            <>Erster Fehler: <span className="font-mono">{bau.bilanz.ersterFehler}</span>. </>
          )}
          Tab neu laden und erneut bauen.
        </div>
      )}

      {/* Was der letzte Lauf getan hat — vorher verfiel dieses Ergebnis
          ungelesen, und ein Lauf mit Lücke sah aus wie einer ohne. */}
      {bau.bilanz && !bau.laeuft && (
        <div className="text-[11px] text-[var(--tf-text-tertiary)] mb-2">
          Letzter Lauf: {bau.bilanz.eingebettet.toLocaleString('de-DE')} Vektoren erzeugt
          {bau.bilanz.ohneText > 0
            ? `, ${bau.bilanz.ohneText.toLocaleString('de-DE')} ohne Text übersprungen`
            : ''}
          {bau.bilanz.fehlgeschlagen > 0
            ? `, ${bau.bilanz.fehlgeschlagen.toLocaleString('de-DE')} fehlgeschlagen`
            : ''}
          {bau.bilanz.vollErzwungen ? ' · voll gebaut statt nachgezogen (fremder Vektorraum)' : ''}
          {/* Ein Lauf mit Erholungen ist gelungen — aber er hat länger gedauert,
              als die Rate erwarten ließ, und das soll nicht unerklärt bleiben. */}
          {bau.bilanz.erholungen > 0
            ? ` · ${bau.bilanz.erholungen}× Modell neu geladen`
              + `${bau.bilanz.geraet ? ` (zuletzt auf ${GERAET_DATIV[bau.bilanz.geraet]})` : ''}`
            : ''}
          {bau.bilanz.abgebrochen ? ' · abgebrochen' : ''}.
        </div>
      )}

      {bau.fehler && <div className="text-[11.5px] text-rose-700 mb-2">{bau.fehler}</div>}
      {spiegelFehler && !bau.fehler && <div className="text-[11.5px] text-rose-700 mb-2">{spiegelFehler}</div>}

      <div className="flex flex-wrap gap-2 items-center">
        {!bau.laeuft ? (
          <>
            {(bau.befund?.aktion === 'ergaenzen' || bau.befund?.aktion === 'ersetzen') && manifest && (
              <Button
                type="button" variant="primary" size="sm"
                onClick={() => holen.run()} disabled={holen.busy}
              >
                Vom Datenspeicher laden (~{manifest.antraegeCount.toLocaleString('de-DE')} Vektoren, ≈10 s)
              </Button>
            )}
            {/* v4.127: kein `isDevContext()` mehr. Der Knopf lag dadurch in
                `zah-pl` gar nicht vor, während die App zum Klicken aufforderte.
                Das Kurator-Schloss dieser Seite ist die schärfere Grenze. */}
            <Button
              type="button"
              variant={bau.befund?.neuaufbauNoetig ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => neuBauen.run()}
              disabled={embedbar === 0 || neuBauen.busy}
            >
              {/* Eine Minutenzahl gibt es erst, wenn dieser Rechner einmal
                  gebaut hat. Vorher stand hier „~48 min", gerechnet aus einem
                  Literal von 0,2 s je Vorhaben, das nie an einem Lauf geprüft
                  war — die Dauer hängt an WebGPU/WASM, Maschine und Textlänge,
                  und eine erfundene Zusage ist schlechter als eine Anzahl. */}
              {!ermittelt
                ? 'Neu aufbauen'
                : vollbauSek !== null
                  ? `Neu aufbauen (~${formatiereEta(vollbauSek)})`
                  : `Neu aufbauen (${embedbar.toLocaleString('de-DE')} Vorhaben)`}
            </Button>
            {/* Der Bau steht lokal, nur der Weg zum Team ist gescheitert — über
                VPN reißt der Verzeichnis-Handle mitten im 42-MB-Write. Ohne
                diesen Knopf war ein kompletter Neubau die einzige Wiederholung
                für eine Datei, die fertig danebenlag. */}
            {(bau.spiegelungOffen || bau.befund?.aktion === 'lokal-neuer') && lokal > 0 && (
              <Button
                type="button"
                variant={bau.spiegelungOffen ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => spiegeln.run()}
                disabled={spiegeln.busy}
                title="Lädt den fertigen lokalen Korpus hoch, ohne einen Vektor neu zu rechnen."
              >
                Erneut spiegeln
              </Button>
            )}
            {/* „Nachziehen" steht nur da, wenn es auch nachzieht. Weicht der
                lokale Vektorraum ab, erzwingt `buildEmbeddingCorpus` einen
                Vollbau (`vollErzwungen`) — ein Knopf mit „156 Vorhaben" wäre dann
                eine Zusage über 40 Minuten Laufzeit, die er nicht hält. Für den
                Fall gibt es „Neu aufbauen“ daneben, und der Hinweis darüber sagt
                warum. Ein Tooltip, der den Knopf geraderücken muss, wäre das
                Eingeständnis, dass die Beschriftung ihre Arbeit nicht tut. */}
            {bau.raumAktuell && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => nachziehen.run()}
                disabled={!ermittelt || embedbar === 0 || offen === 0 || nachziehen.busy}
                title="Bettet nur ein, was fehlt oder dessen Text sich geändert hat."
              >
                {!ermittelt
                  ? 'Nachziehen — wird geprüft…'
                  : offen > 0
                    ? `Nachziehen (${offen.toLocaleString('de-DE')} Vorhaben)`
                    : 'Nachziehen — nichts offen'}
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => zuruecksetzen.run()}
              disabled={lokal === 0 || zuruecksetzen.busy}
            >
              Lokal zurücksetzen
            </Button>
          </>
        ) : (
          <Button type="button" variant="secondary" size="sm" onClick={bau.abbrechen}>
            Abbrechen
          </Button>
        )}
      </div>

      <div className="mt-4 pt-3" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[12.5px] text-[var(--tf-text)]">
              Nach neuen CSV-Daten automatisch nachziehen
            </div>
            <div className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-0.5">
              Nur dieser Rechner. Läuft beim Start, wenn Vorhaben fehlen oder ihr Text sich
              geändert hat — und nur, solange der lokale Vektorraum aktuell ist; ein
              Fassungswechsel bleibt Handarbeit.
              {nachlaufStand && ` Zuletzt: ${new Date(nachlaufStand).toLocaleDateString('de-DE')}.`}
            </div>
          </div>
          <Switch checked={nachlaufAn} onCheckedChange={(v) => { void schalten.run(v); }} />
        </div>
      </div>

      <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-3 leading-relaxed">
        Die Vektoren tragen die Stufe „auch ähnliche Themen“ der Suche und die automatische
        Zuordnung neuer Anträge zu Überkategorien. Der Bau läuft in Phasen (Vorhaben → Verbünde
        → Centroids → Spiegeln) und lädt ein ~200-MB-Modell in diesen Browser-Tab. Der Cache
        liegt lokal (~{Math.round(embedbar * 768 * 4 / 1024 / 1024)} MB) und wird nach jedem
        erfolgreichen Bau auf den Datenspeicher gespiegelt
        (<code>_intern/auslastung-embedding-corpus.*</code>) — andere Teammitglieder holen ihn
        dann in ~10 s, statt selbst zu bauen.
      </p>
    </div>
  );
}
