/**
 * Senkrechte Chronik des Verbunds — der Verlauf als Zeitstrahl von oben nach
 * unten, gruppiert nach Monat.
 *
 * Warum aus den Datumsfeldern: bis v3.48 stand daneben eine Lane-Ansicht auf das
 * gerätelokale Ereignis-Protokoll. Sie blieb leer, solange eine Installation noch
 * keine Änderung mitgeschrieben hatte — die Termine im Vorgang gibt es trotzdem.
 * Sie stehen in den Datumsfeldern und ergeben, chronologisch gelesen, die
 * eigentliche Geschichte des Antrags. Die Lane-Ansicht ist entfallen, ihr Name
 * („Zeitstrahl") auf das Verlaufs-Band übergegangen, das dieselben Termine als
 * Bahn zeichnet.
 *
 * **Ungekürzt, überall.** Die Liste bekommt keinen Höhendeckel und keinen
 * eigenen Scrollbereich — auch nicht im aufgeklappten Bereich der Tabelle, wo
 * sie länger wird als die Zeile. Ein Kasten, der zehn von 22 Terminen zeigt,
 * liest sich als der ganze Verlauf; die Länge fangen dort die Blöcke darunter
 * ab, indem sie zugeklappt anfangen ({@link VorgangsverlaufReiter}).
 *
 * **Deshalb ist die Höhe hier ein Entwurfsziel.** Gemessen über 13 090 Vorgänge:
 * Median 22 Termine in 6 Monaten, p90 32 in 9. Drei Entscheidungen folgen daraus
 * — der Monat steht in einer **eigenen linken Spalte** statt in einer eigenen
 * Zeile, jeder Termin belegt **genau eine** Zeile (Begleittext gekürzt, voller
 * Wortlaut im Tooltip), und die senkrechte Achse läuft durch alle Monate durch,
 * weil der Blockabstand innerhalb der Liste entsteht.
 *
 * **Das Kürzel steht dabei.** Zwischen Datum und Rolle, in einer eigenen
 * schmalen Spalte — dieselbe Anordnung wie im Fachsystem. Es ist der Bezeichner,
 * unter dem das Team einen Eintrag kennt und in C16 wiederfindet; die
 * Bezeichnung daneben sagt, was er bedeutet. Ohne das Kürzel muss man von der
 * Bezeichnung auf den Code zurückschließen, und genau das kostet die
 * Wiedererkennung, wegen der die Chronik überhaupt gelesen wird.
 *
 * **Wer hat gesetzt.** Jede Zeile trägt die Rolle ihres Feldes (`AB`, `FB`, `QS`,
 * `PA`, `Jur`) in einer eigenen schmalen Spalte. Neutrale Einträge — 143 der 505
 * Codes, die das Fachsystem von jedem setzen lässt — bleiben unbeschriftet:
 * „alle" an jeder dritten Zeile wäre Rauschen ohne Information (dieselbe Regel
 * wie in {@link StatusCodeListe}). Gelesen wird **ausschließlich** über
 * `rollenVonFeld`, nie über `feld.rollen` — sonst fallen Bestandsfassungen mit
 * `zustaendigkeit` durch (Pitfall #43).
 *
 * **Was davon meins ist**, sagt die Rolle aus dem Profil (`status_rolle`): meine
 * Zeilen tragen eine Kante auf der Achse und ihr Kürzel in der Primärfarbe —
 * dasselbe Idiom, mit dem das Feedback-Board „meins" markiert. Es wird
 * **hervorgehoben, nicht gefiltert**: wer wissen will, was der Partner gesetzt
 * hat, darf ihn nicht ausgeblendet bekommen. Steht das Profil auf „alle",
 * entfällt die Hervorhebung — die Zuordnung bleibt.
 *
 * Neutrale Zeilen zählen dabei NICHT als meine. Sie gehören jedem; wären sie
 * markiert, trüge fast jede dritte Zeile die Kante und das Signal verginge.
 *
 * **Was fehlt**, kommt aus `offenePaareJeTeilvorhaben` und steht als Fehlzeile
 * unter dem Termin, der die andere Seite gesetzt hat — hohler Ring, kein Datum.
 * Sie zählt **nicht** als Termin: die Kopfzeile verspricht „Termine aus den
 * Datumsfeldern", und eine Lücke ist keiner.
 *
 * Rein darstellend: `baueChronik` liefert die Daten, hier wird nur gerendert.
 */
import { Fragment } from 'react';
import { Milestone } from 'lucide-react';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { useProfile } from '@/core/hooks/useProfile';
import {
  baueChronik, gruppiereNachMonat, kategoriePfadLabel, monateDazwischen, teileChronik,
  traegerLabel, zahPhaseLabel,
  ROLLE_LABEL, ROLLE_LANG, leseStatusRolle, normKey, rollenVonFeld, sortiereRollen,
  type ChronikEintrag, type FeldVorkommen, type MappingVersion,
  type OffenesPaarJeTv, type Rolle,
} from '@/core/status';
import { formatDatumsWert } from '@/core/services/csv/dateParse';

/** Ab wann eine Pause eigens benannt wird — ein übersprungener Monat ist Alltag. */
const LUECKE_AB = 2;

const LEISE = 'text-[var(--tf-text-tertiary)]';

/** Die Rollenspalte. Schmal genug für `AB/FB`; was länger ist, kürzt und steht
 *  im Tooltip — nur 32 der 505 Codes tragen drei Rollen oder mehr. */
const ROLLEN_SPALTE = 'w-[38px] shrink-0 truncate text-[11px]';

/** Die Tagesspalte — hier steht bei einer Fehlzeile der Gedankenstrich. */
const TAG_SPALTE = 'w-[42px] shrink-0 font-mono text-[11px]';

/**
 * Die Kürzelspalte. Steht zwischen Datum und Rolle — dieselbe Lesereihenfolge
 * wie im Fachsystem, wo das Kürzel der Bezeichner ist, unter dem das Team einen
 * Eintrag kennt. Die Bezeichnung sagt, WAS passiert ist; das Kürzel sagt, wo im
 * Fachsystem man es wiederfindet.
 *
 * 46 px: der längste Code des Katalogs hat **sechs** Zeichen (`XSPDOK`,
 * `WRWZG+`), gemessen über alle 505. `truncate` bleibt als Netz für eine
 * künftige Zuarbeit stehen, greift heute aber bei keinem Eintrag.
 */
const CODE_SPALTE = 'w-[46px] shrink-0 truncate font-mono text-[11px]';

/** `2026-03` → „März 2026" in der Kurzform, die in die schmale Spalte passt. */
function monatLabel(monat: string): string {
  const d = new Date(`${monat}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return monat;
  return d.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' });
}

/** `2026-03-10` → „10.03." — das Jahr steht schon in der Monatsspalte.
 *  Über die zentrale Kette, damit hier nicht ein zweites Datumsformat entsteht. */
function tagLabel(tag: string): string {
  return formatDatumsWert(tag).slice(0, 6);
}

/**
 * Was der Tooltip einer Zeile trägt: Bezeichnung, Begleittext im **vollen**
 * Wortlaut, Ordnerpfad. Die Zeile selbst kürzt — der Titel darf das nicht.
 */
function zeilenTitel(e: ChronikEintrag, pfad: string): string {
  return [e.feld.label, e.text, pfad].filter(t => t !== undefined && t !== '').join('\n');
}

/** Punkt auf der Achse, Größe nach Prominenz (gleiche Sprache wie die Lane-Ansicht). */
function Punkt({ eintrag }: { eintrag: ChronikEintrag }): React.ReactElement {
  const p = eintrag.feld.prominenzDefault;
  if (p === 'meilenstein') {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full"
        style={{ width: 14, height: 14, background: 'var(--tf-primary)', color: 'var(--tf-on-primary)' }}
      >
        <Milestone size={9} aria-hidden="true" />
      </span>
    );
  }
  if (p === 'nebensaechlich') {
    return (
      <span
        className="inline-block rounded-full"
        style={{ width: 7, height: 7, border: '1px solid var(--tf-text-tertiary)', background: 'var(--tf-bg)' }}
      />
    );
  }
  return (
    <span
      className="inline-block rounded-full"
      style={{ width: 9, height: 9, background: 'var(--tf-text-tertiary)' }}
    />
  );
}

/**
 * Die Kante, die eine Zeile als „meine" markiert — 2 px auf der Achse, in der
 * Primärfarbe. Sie liegt UNTER dem Punkt (DOM-Reihenfolge), damit ein
 * Meilenstein-Punkt sie überdeckt statt umgekehrt.
 */
function Kante(): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className="absolute bottom-0 left-0 top-0 w-[2px] -translate-x-1/2"
      style={{ background: 'var(--tf-primary)' }}
    />
  );
}

/** Das Rollen-Kürzel einer Zeile; neutral bleibt leer, meins wird kräftig. */
function RollenZelle({ rollen, meins }: {
  rollen: readonly Rolle[]; meins: boolean;
}): React.ReactElement {
  // Kanonisch sortiert, damit `FB/AB` und `AB/FB` dieselbe Zeichenkette ergeben.
  const sortiert = sortiereRollen(rollen);
  return (
    <span
      className={`${ROLLEN_SPALTE} ${meins ? 'font-medium' : ''}`}
      style={{ color: meins ? 'var(--tf-primary)' : 'var(--tf-text-tertiary)' }}
      title={sortiert.length === 0 ? undefined : sortiert.map(r => ROLLE_LANG[r]).join('\n')}
    >
      {sortiert.map(r => ROLLE_LABEL[r]).join('/')}
    </span>
  );
}

/** Eine Zeile: Punkt · Tag · Rolle · Bezeichnung (+ Notiz) · Phase · Träger. */
function Zeile({ e, version, meins }: {
  e: ChronikEintrag; version: MappingVersion; meins: boolean;
}): React.ReactElement {
  const pfad = kategoriePfadLabel(version.kategorien ?? [], e.feld.kategorieId);
  return (
    <li className="relative pl-4">
      {meins && <Kante />}
      <span
        className="absolute left-0 flex -translate-x-1/2 items-center justify-center"
        style={{ width: 14, height: 14, top: 3 }}
      >
        <Punkt eintrag={e} />
      </span>
      {/* Kein senkrechtes Padding: die Zeilenhöhe trägt den Abstand allein —
          bei 28 Terminen sind 3 px je Zeile ein ganzer Eintrag. Und sie steht
          in **px**, nicht als Faktor: ein Faktor rechnet gegen die geerbte
          Schriftgröße, und die ist im Ausklapp eine andere als auf der
          Detailseite (gemessen: 20 px hier, 24 px dort). Dieselbe Ansicht darf
          nicht je nach Umgebung eine andere Dichte haben. */}
      <div className="flex items-baseline gap-2 leading-[18px]">
        <span className={`${TAG_SPALTE} ${LEISE}`}>
          {tagLabel(e.tag)}
        </span>
        {/* Jedes Datumsfeld trägt einen Code — auch die kanonischen (`AAE`,
            `ABB`, `AZ1`, `VBE` in `seed-kanonisch.ts`). Der Fallback bleibt
            trotzdem stehen: `code` ist am Typ optional, und ein künftiges
            entdecktes Feld könnte ohne kommen. Dann bleibt die Spalte leer,
            statt die Spur der Codes darunter zu verschieben. */}
        <span className={`${CODE_SPALTE} ${LEISE}`}>{e.feld.code ?? ''}</span>
        <RollenZelle rollen={rollenVonFeld(e.feld)} meins={meins} />
        <span className="min-w-0 flex-1 truncate" title={zeilenTitel(e, pfad)}>
          <span
            className="text-[12.5px] text-[var(--tf-text)]"
            style={e.feld.prominenzDefault === 'meilenstein' ? { fontWeight: 500 } : undefined}
          >
            {e.feld.label}
          </span>
          {e.text ? (
            <span className={`text-[11.5px] ${LEISE}`}>{' · '}{e.text}</span>
          ) : null}
        </span>
        {e.feld.zahPhaseId ? (
          <span className="shrink-0 rounded-full bg-[var(--tf-bg-secondary)] px-1.5 text-[10.5px] text-[var(--tf-text-secondary)]">
            {zahPhaseLabel(e.feld.zahPhaseId, version.zahPhasen)}
          </span>
        ) : null}
        <span className={`shrink-0 min-w-[72px] text-right text-[11px] ${LEISE}`}>
          {traegerLabel(e.tvIds)}
        </span>
      </div>
    </li>
  );
}

/**
 * Ein fehlendes Gegenstück: die eine Seite eines Kürzel-Paares ist gesetzt, die
 * andere nicht. Kein Datum — es gibt keines; die Standzeit steht stattdessen da.
 */
function FehlZeile({ p, meins }: { p: OffenesPaarJeTv; meins: boolean }): React.ReactElement {
  return (
    <li className="relative pl-4">
      {meins && <Kante />}
      <span
        className="absolute left-0 flex -translate-x-1/2 items-center justify-center"
        style={{ width: 14, height: 14, top: 3 }}
      >
        <span
          className="inline-block rounded-full"
          style={{
            width: 9, height: 9,
            border: '1px dashed var(--tf-text-tertiary)', background: 'var(--tf-bg)',
          }}
        />
      </span>
      <div className="flex items-baseline gap-2 leading-[18px]">
        <span className={`${TAG_SPALTE} ${LEISE}`} aria-hidden="true">—</span>
        {/* Das FEHLENDE Kürzel, nicht das gesetzte: die Zeile sagt „hier müsste
            `p.fehlt` stehen". Genau dieses Kürzel wird in C16 gesucht. */}
        <span className={`${CODE_SPALTE} ${LEISE}`}>{p.fehlt}</span>
        <RollenZelle rollen={p.rolle === null ? [] : [p.rolle]} meins={meins} />
        <span
          className="min-w-0 flex-1 truncate"
          title={`${p.fehlt} — ${p.fehltLabel}\nfehlt, seit ${p.gesetzt} gesetzt wurde`}
        >
          <span className={`text-[12.5px] ${LEISE}`}>{p.fehltLabel}</span>
          <span className={`text-[11.5px] ${LEISE}`}>{` · fehlt seit ${p.tage} T`}</span>
        </span>
        <span className={`min-w-[72px] shrink-0 text-right text-[11px] ${LEISE}`}>{p.tvId}</span>
      </div>
    </li>
  );
}

/** Schlüssel, unter dem eine Fehlzeile an ihren Termin gehängt wird. */
function ankerKey(code: string, tag: string): string {
  return `${normKey(code)}|${tag}`;
}

export function StatusChronik({
  vorkommen,
  version,
  zeigeNebensaechlich,
  onToggleNebensaechlich,
  offenePaare = [],
}: {
  /** `readonly`, weil der Ausklapp seine Vorkommen unveränderlich durchreicht
   *  (`ZeilenVerlauf.vorkommen`) — gelesen wird hier ohnehin nur. */
  vorkommen: readonly FeldVorkommen[];
  version: MappingVersion;
  zeigeNebensaechlich: boolean;
  onToggleNebensaechlich: () => void;
  /**
   * Halb offene Kürzel-Paare, **je Teilvorhaben** gerechnet
   * (`offenePaareJeTeilvorhaben`). Fertig hereingereicht, weil hier keine Uhr
   * ticken darf — und weil nur der Aufrufer weiß, welche Teilvorhaben seine
   * Zeile trägt.
   */
  offenePaare?: readonly OffenesPaarJeTv[];
}): React.ReactElement {
  // EIN Aufbau, danach geteilt: die Anzeige muss wissen, ob der Schalter
  // überhaupt etwas bewirkt, bevor sie ihn anbietet (`teileChronik`). Die
  // volle Liste wird NICHT neu sortiert — sie kommt bereits geordnet, und eine
  // zweite Sortierregel wäre eine zweite Ordnung über denselben Daten.
  const alle = baueChronik(vorkommen, { zeigeNebensaechlich: true });
  const { haupt, neben } = teileChronik(alle);
  const eintraege = zeigeNebensaechlich ? alle : haupt;
  const monate = gruppiereNachMonat(eintraege);

  const { profile } = useProfile();
  // Vorauswahl, keine Sperre — dieselbe Lesart wie in der Ordner-Liste. `alle`
  // heißt „nichts hervorheben"; die Rollenspalte steht trotzdem.
  const meineRolle = leseStatusRolle(profile?.status_rolle);
  const istMeins = (rollen: readonly Rolle[]): boolean =>
    meineRolle !== 'alle' && rollen.includes(meineRolle);

  // Fehlzeilen hängen an dem Termin, der die andere Seite gesetzt hat. Findet
  // sich der nicht — sein Feld kann `ignoriert` sein oder als nebensächlich
  // gerade ausgeblendet —, geht die Lücke NICHT verloren: sie landet am Ende
  // ihres Monats, und fehlt auch der, ganz am Schluss.
  const vorhanden = new Set(
    eintraege.filter(e => e.feld.code).map(e => ankerKey(e.feld.code!, e.tag)),
  );
  const anTermin = new Map<string, OffenesPaarJeTv[]>();
  const anMonat = new Map<string, OffenesPaarJeTv[]>();
  const heimatlos: OffenesPaarJeTv[] = [];
  const monatsNamen = new Set(monate.map(m => m.monat));
  for (const p of offenePaare) {
    const key = ankerKey(p.gesetzt, p.seit);
    const monat = p.seit.slice(0, 7);
    const ziel = vorhanden.has(key) ? anTermin : monatsNamen.has(monat) ? anMonat : null;
    if (ziel === null) { heimatlos.push(p); continue; }
    const unter = ziel === anTermin ? key : monat;
    const liste = ziel.get(unter);
    if (liste) liste.push(p); else ziel.set(unter, [p]);
  }

  const ersterMonat = monate[0]?.monat;
  const letzterMonat = monate[monate.length - 1]?.monat;
  const spanne = ersterMonat === undefined || letzterMonat === undefined
    ? null
    : ersterMonat === letzterMonat
      ? monatLabel(ersterMonat)
      : `${monatLabel(ersterMonat)} – ${monatLabel(letzterMonat)}`;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {neben.length > 0 && (
          <ToggleChip
            label={`Nebensächliches ${neben.length}`}
            selected={zeigeNebensaechlich}
            onToggle={onToggleNebensaechlich}
          />
        )}
        <span className={`text-[11.5px] ${LEISE}`}>
          {eintraege.length} {eintraege.length === 1 ? 'Termin' : 'Termine'} aus den Datumsfeldern
          {spanne === null ? '' : ` · ${spanne}`}
          {/* Die Lücken zählen NICHT als Termine — sie stehen daneben, damit
              eine Fehlzeile tief in der Liste nicht übersehen wird. */}
          {offenePaare.length === 0 ? '' : ` · ${offenePaare.length} ${
            offenePaare.length === 1 ? 'fehlendes Gegenstück' : 'fehlende Gegenstücke'}`}
          {meineRolle === 'alle' ? '' : ` · hervorgehoben: ${ROLLE_LABEL[meineRolle]}`}
        </span>
      </div>

      {/* Auch ohne einen einzigen Termin kann es eine Lücke geben — dann ist sie
          das Einzige, was zu sagen ist, und darf nicht mit der Liste wegfallen. */}
      {eintraege.length === 0 && heimatlos.length === 0 ? (
        <div className={`py-6 text-[12px] ${LEISE}`}>
          Keine datierten Statuseinträge. Wert- und Textfelder stehen unten in der Ordner-Ansicht.
        </div>
      ) : (
        <div className="flex flex-col">
          {monate.map((m, i) => {
            const vorheriger = monate[i - 1]?.monat;
            const luecke = vorheriger === undefined ? 0 : monateDazwischen(vorheriger, m.monat);
            const abstand = i === 0 ? '' : 'pt-2';
            return (
              <div key={m.monat} className="flex">
                <div className={`w-[84px] shrink-0 pr-2 ${abstand}`}>
                  <div className={`text-[11px] font-medium uppercase tracking-wide ${LEISE}`}>
                    {monatLabel(m.monat)}
                  </div>
                  {luecke >= LUECKE_AB ? (
                    <div className={`text-[10px] leading-tight ${LEISE}`} style={{ opacity: 0.75 }}>
                      {luecke} Monate ohne Termin
                    </div>
                  ) : null}
                </div>
                <ol className={`min-w-0 flex-1 border-l border-[var(--tf-border)] ${abstand}`}>
                  {m.eintraege.map(e => (
                    <Fragment key={`${e.feld.feldId}:${e.tag}`}>
                      <Zeile e={e} version={version} meins={istMeins(rollenVonFeld(e.feld))} />
                      {(e.feld.code ? anTermin.get(ankerKey(e.feld.code, e.tag)) ?? [] : []).map(p => (
                        <FehlZeile
                          key={`${p.tvId}:${p.fehlt}`} p={p}
                          meins={istMeins(p.rolle === null ? [] : [p.rolle])}
                        />
                      ))}
                    </Fragment>
                  ))}
                  {/* Lücken ohne sichtbaren Termin: der Monat stimmt, die Stelle
                      darin nicht — besser als sie zu verschlucken. */}
                  {(anMonat.get(m.monat) ?? []).map(p => (
                    <FehlZeile
                      key={`rest:${p.tvId}:${p.fehlt}`} p={p}
                      meins={istMeins(p.rolle === null ? [] : [p.rolle])}
                    />
                  ))}
                </ol>
              </div>
            );
          })}
          {heimatlos.length > 0 && (
            <div className="flex">
              <div className={`w-[84px] shrink-0 pr-2 pt-2 text-[11px] font-medium uppercase tracking-wide ${LEISE}`}>
                ohne Bezug
              </div>
              <ol className="min-w-0 flex-1 border-l border-[var(--tf-border)] pt-2">
                {heimatlos.map(p => (
                  <FehlZeile
                    key={`heimatlos:${p.tvId}:${p.fehlt}`} p={p}
                    meins={istMeins(p.rolle === null ? [] : [p.rolle])}
                  />
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
