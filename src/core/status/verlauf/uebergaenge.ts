/**
 * Aus gesetzten Datumsfeldern werden **Übergänge**: welches Kürzel wann gesetzt
 * wurde, von wem, und ob damit ein Statuswechsel belegt ist.
 *
 * Die Chronologie baut nicht diese Datei, sondern `baueChronik` — sie parst die
 * Datumsformate, wirft `ignoriert`/`nebensaechlich` heraus und entdoppelt je
 * (Feld, Tag). Dieselbe Regel wie Chronik und Zeitstrahl, damit alle drei
 * Ansichten denselben Bestand zeigen.
 *
 * **Ein Vorwärtslauf, kein Nachschlag** (seit v3.23). C16 setzt einen Status
 * nicht bedingungslos, sondern „wenn der Status vor 59 liegt und kein ABB
 * gesetzt ist". Beides gilt für den **Zeitpunkt des Kürzels**, nicht für heute:
 *
 * - Der **laufende Status** wandert mit. Er beginnt unbekannt (`null`) — vor dem
 *   ersten Beleg weiss niemand, worauf der Vorgang stand — und übernimmt danach,
 *   was die letzte greifende Regel gesetzt hat. Am Kettenanfang ist die
 *   Status-Bedingung deshalb `unpruefbar`, nie erfunden.
 * - Die **gesetzten Kürzel** werden auf den Tag eingeschränkt. „Ohne ABB" heisst
 *   im Fachsystem „ABB war damals nicht gesetzt"; die Termine sind datiert, also
 *   ist das exakt bestimmbar statt geschätzt. Gegen den heutigen Stand geprüft
 *   verletzte jeder bewilligte Vorgang rückwirkend seine eigene Eingangsregel.
 *
 * **Tagesgranularität, keine Uhrzeit.** Der Export führt keine; mehrere Kürzel
 * am selben Tag bleiben deshalb unsortiert nebeneinander stehen und werden nie
 * in eine erfundene Reihenfolge gebracht (das erledigt `segmente.ts`). Für den
 * Vorwärtslauf heisst das: Kürzel **desselben** Tages sehen einander noch nicht
 * als gesetzt — sonst entschiede die Fundreihenfolge über das Urteil.
 *
 * Rein: keine IO, keine Uhr.
 */
import { baueChronik } from '../chronik';
import {
  heutigesKuerzel, kuerzelAuskunft, ueberlagereKuration, type Nachschlageform,
} from '../kuerzel-katalog';
import { normKey } from '../normalisierung';
import { pruefeTriggerBedingungen, type BedingungsUrteil, type TriggerKontext } from '../trigger-bedingung';
import type { FeldVorkommen } from '../feld-aufloesung';
import { statusRefVonCode } from './status-ref';
import { zeilenFuer, zielStatusFuer, type C16Index } from './c16-regeln';
import type { RollenLage, SpurArt, VerlaufsUebergang } from './typen';

/** Ein Kürzel mit dem Tag, an dem es gesetzt wurde — die Achse des Vorwärtslaufs. */
export interface GesetztesKuerzel {
  /** normKey des Codes. */
  key: string;
  /** ISO-Tag. */
  tag: string;
}

export interface UebergangsEingabe {
  vorkommen: readonly FeldVorkommen[];
  /** `null` = Form unbekannt; dann liefert der Katalog nur bei
   *  formübergreifender Übereinstimmung eine Bedeutung. `'DS'` ist keine Form
   *  der Zuarbeit, sondern eine, für die die Kuration antwortet. Betrifft
   *  ausschliesslich die BEZEICHNUNG — die Regel hängt seit v3.23 am Programm. */
  projektform: Nachschlageform | null;
  art: SpurArt;
  /** Die C16-Zeilen des Programms, nach Kürzel. */
  regeln: C16Index;
  /** Katalogfelder nach normKey — für die „ohne X"-Bedingungen. */
  felderNachCode: TriggerKontext['felderNachCode'];
  /** Alle Kürzel des Verbunds mit ihrem Tag (über ALLE Teilvorhaben). */
  verbundKuerzel: readonly GesetztesKuerzel[];
}

/** Die Kürzel, die VOR diesem Tag schon ein Datum trugen. */
function gesetztVor(kuerzel: readonly GesetztesKuerzel[], tag: string): ReadonlySet<string> {
  const out = new Set<string>();
  for (const k of kuerzel) if (k.tag < tag) out.add(k.key);
  return out;
}

/** Was die Regeln eines Kürzels an diesem Tag ergeben. */
interface RegelUrteil {
  /** Der gesetzte Statuscode, `null` = keiner. */
  code: number | null;
  urteil: BedingungsUrteil | 'keine_regel';
  gruende: string[];
}

/**
 * Die Zeilen eines Kürzels sind **Alternativen**: die erste erfüllte gewinnt.
 *
 * Gibt es keine erfüllte, aber eine unprüfbare, gilt diese — mit gesenkter
 * Konfidenz. Das ist die Lesart des Navigators (eine nicht auswertbare Bedingung
 * macht den Kandidaten nicht ungültig), nur rückwärts: der Termin steht in den
 * Daten, das Kürzel WURDE gesetzt. Ihm den Statuswechsel abzusprechen, weil wir
 * eine Bedingung nicht lesen können, wäre eine Behauptung über die Vergangenheit.
 */
function urteileUeberKuerzel(
  code: string, art: SpurArt, regeln: C16Index, ktx: TriggerKontext,
): RegelUrteil {
  const zeilen = zeilenFuer(regeln, code);
  if (zeilen.length === 0) return { code: null, urteil: 'keine_regel', gruende: [] };

  let unpruefbar: RegelUrteil | null = null;
  const verletzt: string[] = [];
  for (const z of zeilen) {
    const p = z.geparst;
    if (!p) continue;
    const ziel = zielStatusFuer(z, art);
    if (ziel === null) continue;              // wirkt auf der anderen Ebene
    const befund = pruefeTriggerBedingungen(p, ktx);
    if (befund.urteil === 'erfuellt') return { code: ziel, urteil: 'erfuellt', gruende: [] };
    if (befund.urteil === 'unpruefbar' && unpruefbar === null) {
      unpruefbar = { code: ziel, urteil: 'unpruefbar', gruende: befund.gruende };
    }
    if (befund.urteil === 'verletzt') verletzt.push(...befund.gruende);
  }
  if (unpruefbar) return unpruefbar;
  if (verletzt.length > 0) return { code: null, urteil: 'verletzt', gruende: verletzt };
  // Zeilen gibt es, aber keine wirkt auf DIESER Ebene.
  return { code: null, urteil: 'keine_regel', gruende: [] };
}

/**
 * Alle Übergänge einer Ebene, aufsteigend nach Tag.
 *
 * **Die Regel wird unter beiden Kürzel-Formen gesucht** — erst unter der im
 * Export gefundenen, dann unter der heutigen. Die Trigger-Tabelle ist auf dem
 * Stand des Fachsystems; eine Spalte aus 2018 trägt den alten Namen. Ohne den
 * zweiten Versuch bliebe ein umbenanntes Kürzel für immer ohne Statuswechsel.
 */
export function baueUebergaenge(e: UebergangsEingabe): VerlaufsUebergang[] {
  const chronik = baueChronik(e.vorkommen, { zeigeNebensaechlich: false });
  const eigene: GesetztesKuerzel[] = [];
  for (const eintrag of chronik) {
    const c = eintrag.feld.code;
    if (c) eigene.push({ key: normKey(c), tag: eintrag.tag });
  }

  const out: VerlaufsUebergang[] = [];
  let laufenderStatus: number | null = null;

  for (const eintrag of chronik) {
    const roh = eintrag.feld.code?.normalize('NFC');
    if (!roh) continue;                       // kanonische Felder ohne Kürzel-Code
    const heute = heutigesKuerzel(roh);
    // `eintrag.feld` IST das Feld, dessen Bezeichnung die Chronik zeigt. Beide
    // Ansichten lesen damit dieselbe Zeichenkette, statt sie zufällig gleich zu
    // haben — der Grund steht bei `ueberlagereKuration`.
    const auskunft = ueberlagereKuration(
      kuerzelAuskunft(roh, e.projektform), eintrag.feld.label,
    );

    const rollenLage: RollenLage = auskunft.bezeichnung === null || !auskunft.eindeutig
      ? 'unbekannt'
      : auskunft.rollen.length > 0 ? 'benannt' : 'neutral';

    const uebergang: VerlaufsUebergang = {
      kuerzel: heute ?? roh,
      ...(heute ? { kuerzelHistorisch: roh } : {}),
      datum: eintrag.tag,
      rollen: rollenLage === 'benannt' ? auskunft.rollen : [],
      rollenLage,
      konfidenz: 'kein_kuerzel',
      bezeichnung: auskunft.bezeichnung,
      bezeichnungEindeutig: auskunft.eindeutig,
      ...(auskunft.quelle ? { bezeichnungQuelle: auskunft.quelle } : {}),
    };

    const ktx: TriggerKontext = {
      felderNachCode: e.felderNachCode,
      gesetztTv: gesetztVor(eigene, eintrag.tag),
      gesetztVerbund: gesetztVor(e.verbundKuerzel, eintrag.tag),
      statusCode: laufenderStatus,
      zeitpunkt: eintrag.tag,
    };

    const urteil = urteileUeberKuerzel(roh, e.art, e.regeln, ktx);
    const wirksam = urteil.urteil === 'keine_regel' && heute
      ? urteileUeberKuerzel(heute, e.art, e.regeln, ktx)
      : urteil;

    if (wirksam.code !== null) {
      uebergang.konfidenz = wirksam.urteil === 'erfuellt' ? 'trigger_bestaetigt' : 'trigger_bedingt';
      uebergang.setztStatus = statusRefVonCode(wirksam.code);
      laufenderStatus = wirksam.code;
    }
    if (wirksam.urteil !== 'keine_regel') {
      uebergang.bedingung = { urteil: wirksam.urteil, gruende: wirksam.gruende };
    }

    out.push(uebergang);
  }
  return out;
}
