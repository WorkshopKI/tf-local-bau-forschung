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
import { CORPUS_BUILD_VERSION, getCorpusBuildVersion } from '@/core/services/embedding-corpus';
import { istNachlaufAn, setzeNachlauf, ladeNachlaufStand } from '@/plugins/auslastung/services/matching';
import { useKorpusBau, PHASEN_LABEL } from '../hooks/useKorpusBau';

function formatiereEta(sek: number): string {
  if (sek < 60) return `${Math.round(sek)} s`;
  const min = Math.round(sek / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
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
  const spiegelFehler = useEmbeddingCorpusMirror(s => s.error);

  const [nachlaufAn, setNachlaufAn] = useState(false);
  const [nachlaufStand, setNachlaufStand] = useState<string | null>(null);

  // Pitfall #15: die Läufe dauern Minuten, und ein roher Fire-and-forget-Handler
  // schluckt die Rejection — der Knopf sähe dann aus, als täte er nichts.
  const holen = useAsyncAction(bau.ladeVomSpeicher);
  const neuBauen = useAsyncAction(() => bau.baue(true));
  const nachziehen = useAsyncAction(() => bau.baue(false));
  const zuruecksetzen = useAsyncAction(bau.leere);
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

  // Während des Laufs tickt der Fortschritt pro Vorhaben; der Bestand wird erst
  // danach neu gelesen. Die Leiste darf nicht erst am Ende auf 100 springen.
  const zeigeIst = p ? p.done : lokal;
  const zeigeSoll = p ? p.total : embedbar;
  const prozent = p?.phase === 'centroids'
    ? 100
    : zeigeSoll > 0 ? Math.min(100, (zeigeIst / zeigeSoll) * 100) : 0;

  const shareVersion = manifest ? getCorpusBuildVersion(manifest) : null;
  const minutenVoll = Math.max(1, Math.ceil(embedbar * 0.2 / 60));

  return (
    <div className="pt-1">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[12px] text-[var(--tf-text-secondary)]">
          {p
            ? (p.phase === 'centroids'
                ? PHASEN_LABEL.centroids
                : `${PHASEN_LABEL[p.phase]}: ${zeigeIst} von ${zeigeSoll}`)
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

      {p && p.phase !== 'centroids' && (
        <div className="text-[11.5px] text-[var(--tf-text-secondary)] mb-2">
          {p.last && <span className="font-mono mr-2">{p.last}</span>}
          {p.etaSec != null && (
            <span className="text-[var(--tf-text-tertiary)]">≈ {formatiereEta(p.etaSec)} verbleibend</span>
          )}
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

      {bau.befund?.neuaufbauNoetig && (
        <div className={HINWEIS_KLASSE} style={HINWEIS_WARN}>
          <strong>Neuaufbau nötig, nicht nur empfohlen.</strong> Die Vektoren stammen aus
          Textfassung v{bau.befund.versionDanach} (aktuell wäre v{CORPUS_BUILD_VERSION}). Bis v2
          las der Embedding-Text seine Quell-Spalten unter geratenen Schlüsseln, und am echten
          Bestand war die Projektbeschreibung in <strong>0 von 14 225</strong> Sätzen darunter zu
          finden — der Vektor eines Vorhabens kennt dort nur seinen Titel und die Deskriptoren,
          nie seinen Inhalt. Seit v3 wird die Spalte aus dem CSV-Schema aufgelöst.
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
            „Nachziehen“ holt genau diese {offen.toLocaleString('de-DE')} nach (≈ {formatiereEta(offen * 0.2)}).
          </div>
        )
      )}

      {/* Was der letzte Lauf getan hat — vorher verfiel dieses Ergebnis
          ungelesen, und ein Lauf mit Lücke sah aus wie einer ohne. */}
      {bau.bilanz && !bau.laeuft && (
        <div className="text-[11px] text-[var(--tf-text-tertiary)] mb-2">
          Letzter Lauf: {bau.bilanz.eingebettet.toLocaleString('de-DE')} Vorhaben eingebettet
          {bau.bilanz.uebersprungen > 0
            ? `, ${bau.bilanz.uebersprungen.toLocaleString('de-DE')} übersprungen (kein Text oder Fehler)`
            : ''}
          {bau.bilanz.vollErzwungen ? ' · voll gebaut statt nachgezogen (fremder Vektorraum)' : ''}
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
              {/* Die Dauer haengt am Bestand — vor dessen Aufnahme waere „~1 min"
                  eine Zusage aus einer Division durch nichts. */}
              {ermittelt ? `Neu aufbauen (~${minutenVoll} min)` : 'Neu aufbauen'}
            </Button>
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
