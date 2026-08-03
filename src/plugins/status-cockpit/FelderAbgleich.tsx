/**
 * Die Abgleich-Banner über dem Kürzel-Verzeichnis: wo die Fassung von den
 * Fremddaten abweicht.
 *
 * Eigene Datei, weil das eine andere Frage ist als die des Tabs darunter. Der
 * Tab **kuratiert** (Ordner, Rollen, Relevanz); diese Banner **melden Drift**
 * gegen zwei Quellen, die uns nicht gehören: die Auslieferung (Kürzel-Zuarbeit,
 * Build-Zeit) und die CSV-Quellen (was der Export tatsächlich führt).
 *
 * Rein darstellend — jede Übernahme geht über die `api`-Aktionen in den Entwurf
 * und wird erst mit der Speicherleiste team-weit.
 */
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { isVorgangssystemEnabled } from '@/config/feature-flags';
import { AB_DASHBOARD_RELEVANZ, NICHT_ZUGEORDNET_ID, ROLLE_LABEL } from '@/core/status';
import type { StatusCockpitApi } from './useStatusCockpit';
import { EBENE_LABEL, feldStil } from './labels';

/** Was die Auslieferung mitbringt und der Fassung fehlt. */
function SeedLuecke({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  if (api.seedLuecke.felder === 0) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded px-2.5 py-2" style={feldStil}>
      <span className="text-[12.5px] text-[var(--tf-text)]">
        Die Auslieferung führt {api.seedLuecke.felder} Statusfelder
        {api.seedLuecke.kategorien > 0 ? ` und ${api.seedLuecke.kategorien} Ordner` : ''}, die dieser
        Fassung fehlen.
      </span>
      <Button variant="secondary" size="sm" onClick={api.seedNachziehen}>Nachziehen</Button>
    </div>
  );
}

/** Bezeichnung/Rollen weichen von der Kürzel-Zuarbeit ab (Fremddaten, #43). */
function TextAbweichungen({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  const [offen, setOffen] = useState(false);
  if (api.textAbweichungen.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded px-2.5 py-2" style={feldStil}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] text-[var(--tf-text)]">
          Bei {api.textAbweichungen.length} Feldern weichen Bezeichnung oder Rollen von der
          Kürzel-Zuarbeit des Fachsystems ab. Ordner, Phase und Rang bleiben unangetastet.
        </span>
        <Button variant="secondary" size="sm" onClick={api.texteUebernehmen}>
          Zuarbeit übernehmen
        </Button>
      </div>
      <button
        type="button" onClick={() => setOffen(v => !v)} aria-expanded={offen}
        className="self-start text-[12px] text-[var(--tf-text-tertiary)] cursor-pointer underline"
      >
        {offen ? 'Vorschau ausblenden' : 'Vorschau anzeigen'}
      </button>
      {offen && (
        <ul className="flex flex-col gap-0.5 max-h-[220px] overflow-y-auto">
          {api.textAbweichungen.map(a => (
            <li key={a.feldId} className="text-[11.5px] text-[var(--tf-text-secondary)] flex gap-2">
              <span className="font-mono text-[var(--tf-text-tertiary)] shrink-0 w-[72px] truncate">
                {a.code ?? a.feldId}
              </span>
              <span className="min-w-0">
                <span className="line-through">{a.altesLabel}</span>
                {' → '}
                <span className="text-[var(--tf-text)]">{a.neuesLabel}</span>
                {a.alteRollen.join('/') !== a.neueRollen.join('/') && (
                  <span className="text-[var(--tf-text-tertiary)]">
                    {' · '}
                    {a.alteRollen.length ? a.alteRollen.map(r => ROLLE_LABEL[r]).join('/') : 'alle'}
                    {' → '}
                    {a.neueRollen.length ? a.neueRollen.map(r => ROLLE_LABEL[r]).join('/') : 'alle'}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Kürzel, die im Export vorkommen, aber im Katalog fehlen. */
function UnkuratierteFelder({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  if (api.unkuratierteFelder.length === 0) return null;
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-[12px] font-medium text-[var(--tf-text-secondary)] uppercase tracking-wide">
        In den CSV-Quellen gefunden — noch nicht im Katalog
      </h3>
      {/* Der Kürzel-Katalog wird zur Build-Zeit aus der Zuarbeit-CSV erzeugt
          (`npm run gen:status-codes`) und hat bewusst KEINEN Laufzeit-Import.
          Damit dieser Verzicht nicht stumm bleibt, sagt der Hinweis, was
          wirklich zu tun ist — „Übernehmen" unten ist die Zwischenlösung,
          die dem Feld noch Bezeichnung und Rollen schuldig bleibt. */}
      <p className="text-[12.5px] text-[var(--tf-warning-text)]">
        {api.unkuratierteFelder.length} Kürzel im Export ohne Katalog-Eintrag — Zuarbeit-CSV
        aktualisieren und Build erneuern. Bis dahin lassen sie sich einzeln übernehmen; sie
        kommen dann ohne Bezeichnung aus der Zuarbeit und ohne Rollen (= neutral).
      </p>
      {api.unkuratierteFelder.map(f => (
        <div key={f.feldId} className="flex items-center justify-between gap-2 rounded px-2.5 py-2" style={feldStil}>
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <Badge variant="warning">neu</Badge>
            <span className="text-[11px] font-mono text-[var(--tf-text-tertiary)]">{f.feldId}</span>
            <span className="text-[12.5px] text-[var(--tf-text)]">{f.label}</span>
            <span className="text-[11px] text-[var(--tf-text-tertiary)]">{EBENE_LABEL[f.ebene]}</span>
          </div>
          <Button
            variant="secondary" size="sm"
            onClick={() => api.uebernehmeFeld(f, NICHT_ZUGEORDNET_ID[f.ebene])}
          >
            Übernehmen
          </Button>
        </div>
      ))}
    </section>
  );
}

/**
 * Der Startvorschlag für die Relevanz-Häkchen: die Spalten, mit denen das
 * AB-Dashboard heute rechnet.
 *
 * Erscheint nur, solange er etwas bewirkt — eine Aktion anzubieten, die nichts
 * ändert, ist eine Einladung zum Ratespiel. Sie setzt nur Häkchen und nimmt
 * keine weg (siehe `markiereRelevanz`).
 */
function RelevanzVorschlag({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  if (!isVorgangssystemEnabled() || api.relevanzLuecke === 0) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded px-2.5 py-2" style={feldStil}>
      <span className="text-[12.5px] text-[var(--tf-text)]">
        {api.relevanzLuecke} der {AB_DASHBOARD_RELEVANZ.length} Kürzel des AB-Dashboards sind noch
        nicht als relevant markiert. Die Relevanz-Liste grenzt Navigator und Wächter ein.
      </span>
      <Button variant="secondary" size="sm" onClick={api.relevanzAusAbDashboard}>
        AB-Spalten markieren
      </Button>
    </div>
  );
}

/**
 * Dasselbe für die anderen Rollen — aber **aus dem Katalog gespeist**, nicht aus
 * einer Liste.
 *
 * Für den AB gibt es die kuratierte Spaltenauswahl der Mappe. Für den FB gibt es
 * nichts dergleichen, und eine Liste zu erfinden hieße raten. Die Zuarbeit weiß
 * es aber bereits: sie führt je Code, wer ihn setzt. Neutrale Codes bleiben
 * draußen — sie darf jeder setzen (Pitfall #43), als Vorschlag gelesen wären sie
 * ein Häkchen bei allem.
 *
 * `markiereRelevanz` nimmt nie ein Häkchen weg: zwei Vorschläge nacheinander
 * ergänzen sich, statt sich gegenseitig zu löschen.
 */
function RelevanzJeRolle({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  const offen = (['fb', 'qs'] as const)
    .map(rolle => ({ rolle, luecke: api.relevanzLueckeRolle(rolle) }))
    .filter(x => x.luecke > 0);
  if (!isVorgangssystemEnabled() || offen.length === 0) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded px-2.5 py-2" style={feldStil}>
      <span className="text-[12.5px] text-[var(--tf-text)]">
        Weitere Rollen: {offen.map(x => `${x.luecke} Kürzel mit Rolle ${ROLLE_LABEL[x.rolle]}`).join(' · ')}{' '}
        noch ohne Relevanz-Häkchen. Die Liste kommt aus der Kürzel-Zuarbeit („wird gesetzt von"),
        nicht aus einer erfundenen Auswahl.
      </span>
      <span className="flex items-center gap-1.5 shrink-0">
        {offen.map(x => (
          <Button
            key={x.rolle} variant="secondary" size="sm"
            onClick={() => api.relevanzAusRolle(x.rolle)}
          >
            {ROLLE_LABEL[x.rolle]}-Kürzel markieren
          </Button>
        ))}
      </span>
    </div>
  );
}

export function FelderAbgleich({ api }: { api: StatusCockpitApi }): React.ReactElement {
  return (
    <>
      <SeedLuecke api={api} />
      <TextAbweichungen api={api} />
      <RelevanzVorschlag api={api} />
      <RelevanzJeRolle api={api} />
      <UnkuratierteFelder api={api} />
    </>
  );
}
