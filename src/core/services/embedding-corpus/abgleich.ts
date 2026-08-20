/**
 * „Was ist mit dem Korpus auf dem Datenspeicher zu tun?" — die Entscheidung,
 * einmal, ohne React.
 *
 * Bis v4.127 stand sie als `if` mitten im Autoload-Effekt und bestand aus einem
 * einzigen Vergleich: `lokal < manifest.antraegeCount`. Also **nur die Anzahl**.
 * Wer einen VOLLSTAENDIGEN, aber alten Korpus hatte, bekam den neuen nie — und
 * nichts sagte es ihm, weil der Reichweiten-Satz der Suche erst bei
 * `korpus < bestand` erscheint. Umgekehrt zog derselbe Vergleich auf einem leeren
 * Rechner bereitwillig den veralteten Raum vom Share.
 *
 * Der Vergleich, den es braucht, ist die SIGNATUR ([signatur.ts](./signatur.ts)) —
 * Modell, Dimension, Praefix und Text-Version. Sie lag schon vor, nur fragte sie
 * hier niemand.
 *
 * Rein und ohne IDB, damit die sechs Lagen als Tabelle pruefbar sind statt nur
 * im Betrieb: ein falsch entschiedener Download mischt zwei Vektorraeume, und
 * ein Kosinus-Vergleich ueber zwei Raeume liefert Zahlen, die nach Aehnlichkeit
 * AUSSEHEN.
 */
import { checkCompat, getCorpusBuildVersion, type EmbeddingCorpusManifest } from './mirror';
import {
  CORPUS_BUILD_VERSION,
  signaturAusManifest,
  signaturenGleich,
  type KorpusSignatur,
} from './signatur';

/**
 * Was der Abgleich tun soll.
 *
 *  - `nichts`      — der lokale Stand bleibt, wie er ist
 *  - `ergaenzen`   — vom Share laden und auf den lokalen Stand legen (gleicher Raum)
 *  - `ersetzen`    — lokal ERST leeren, dann voll laden (fremder Raum, nie mischen)
 *  - `lokal-neuer` — der lokale Korpus ist besser als der auf dem Share
 *  - `unbrauchbar` — der Share-Korpus passt nicht zum aktiven Modell (Pitfall #19)
 */
export type AbgleichAktion = 'nichts' | 'ergaenzen' | 'ersetzen' | 'lokal-neuer' | 'unbrauchbar';

export interface AbgleichBefund {
  aktion: AbgleichAktion;
  /** Ein Satz, der die Entscheidung traegt — geht so in die Oberflaeche. */
  grund: string;
  /**
   * Die Text-Build-Version, die nach der Aktion lokal gilt. `null` = es gibt
   * danach keinen Korpus (oder sein Raum ist unbekannt).
   */
  versionDanach: number | null;
  /**
   * Sind die Vektoren, die man danach hat, aus einer ueberholten Textfassung?
   *
   * Bewusst getrennt von `aktion`: ein Download kann richtig sein UND das
   * Ergebnis trotzdem veraltet. Der Fall „vollstaendig, aber v2" hatte bis
   * v4.127 ueberhaupt keine Stimme in der App.
   *
   * `false`, wenn es gar keinen Korpus gibt — das sagt `aktion`/`grund`.
   */
  neuaufbauNoetig: boolean;
}

export interface AbgleichLage {
  /** Wie viele Vektoren lokal liegen. */
  lokalCount: number;
  /** Aus welchem Raum die LOKALEN Vektoren stammen. `null` = nie gemerkt (vor v4.113). */
  lokalSignatur: KorpusSignatur | null;
  /** Das Manifest vom Datenspeicher. `null` = dort liegt keiner. */
  manifest: EmbeddingCorpusManifest | null;
  /** Der Raum, den DIESE App-Version mit DIESEM Modell gerade erzeugen wuerde. */
  aktiveSignatur: KorpusSignatur;
}

function befund(
  aktion: AbgleichAktion,
  grund: string,
  versionDanach: number | null,
): AbgleichBefund {
  return {
    aktion,
    grund,
    versionDanach,
    neuaufbauNoetig: versionDanach !== null && versionDanach < CORPUS_BUILD_VERSION,
  };
}

/**
 * Die Reihenfolge der Regeln ist die Entscheidung — von „geht gar nicht" ueber
 * „gleicher Raum" zu „fremder Raum".
 */
export function entscheideAbgleich(lage: AbgleichLage): AbgleichBefund {
  const { lokalCount, lokalSignatur, manifest, aktiveSignatur } = lage;
  const lokalVersion = lokalSignatur?.buildVersion ?? null;

  // 1. Kein Korpus auf dem Datenspeicher.
  if (manifest === null) {
    return befund(
      'nichts',
      lokalCount === 0
        ? 'Auf dem Datenspeicher liegt kein Korpus, und lokal auch keiner.'
        : `Auf dem Datenspeicher liegt kein Korpus — die ${lokalCount.toLocaleString('de-DE')} lokalen Vektoren bleiben.`,
      lokalCount === 0 ? null : lokalVersion,
    );
  }

  // 2. Modell-/Dimensions-Bruch: die Vektoren sind nicht vergleichbar, egal wie
  //    aktuell sie sind (Pitfall #19).
  const compat = checkCompat(manifest, aktiveSignatur.modellId, aktiveSignatur.dim);
  if (compat.kind !== 'compatible') {
    const detail = compat.kind === 'modell-mismatch'
      ? `mit Modell „${compat.shareModell}" gebaut, aktiv ist „${compat.lokalModell}"`
      : `hat Dimension ${compat.shareDim}, das aktive Modell liefert ${compat.lokalDim}`;
    return befund(
      'unbrauchbar',
      `Der Korpus auf dem Datenspeicher ${detail} — er kann nicht geladen werden. Neuaufbau nötig.`,
      lokalCount === 0 ? null : lokalVersion,
    );
  }

  const shareSignatur = signaturAusManifest(manifest);
  const shareVersion = getCorpusBuildVersion(manifest);

  // 3. Lokal leer — es gibt nichts, womit gemischt werden koennte.
  if (lokalCount === 0) {
    return befund(
      'ergaenzen',
      `Lokal liegen keine Vektoren; der Datenspeicher hält ${manifest.antraegeCount.toLocaleString('de-DE')}.`,
      shareVersion,
    );
  }

  // 4. Gleicher Raum — die einzige Lage, in der aufgefuellt werden darf.
  if (lokalSignatur !== null && signaturenGleich(lokalSignatur, shareSignatur)) {
    if (lokalCount < manifest.antraegeCount) {
      return befund(
        'ergaenzen',
        `Lokal ${lokalCount.toLocaleString('de-DE')} von ${manifest.antraegeCount.toLocaleString('de-DE')} Vektoren — der Rest liegt auf dem Datenspeicher.`,
        lokalVersion,
      );
    }
    return befund('nichts', 'Lokaler Korpus und Datenspeicher sind auf demselben Stand.', lokalVersion);
  }

  // 5. Der lokale Raum ist UNBEKANNT (Bestand vor v4.113). Die einzige Aussage,
  //    die wir haben, ist die des Share — ihm folgen wir, wenn er aktuell ist.
  if (lokalVersion === null) {
    if (shareVersion >= CORPUS_BUILD_VERSION) {
      return befund(
        'ersetzen',
        'Der lokale Korpus stammt aus einem unbekannten Vektorraum; der Datenspeicher trägt die aktuelle Textfassung.',
        shareVersion,
      );
    }
    return befund(
      'nichts',
      `Weder der lokale Korpus (unbekannter Vektorraum) noch der auf dem Datenspeicher (v${shareVersion}) sind auf der aktuellen Textfassung v${CORPUS_BUILD_VERSION}. Neuaufbau nötig.`,
      shareVersion,
    );
  }

  // 6. Zwei bekannte, verschiedene Raeume — die Textversion entscheidet.
  if (shareVersion > lokalVersion) {
    return befund(
      'ersetzen',
      `Der Datenspeicher trägt Textfassung v${shareVersion}, lokal liegt v${lokalVersion} — die alten Vektoren werden verworfen, nicht ergänzt.`,
      shareVersion,
    );
  }
  if (shareVersion < lokalVersion) {
    return befund(
      'lokal-neuer',
      `Der lokale Korpus (v${lokalVersion}) ist neuer als der auf dem Datenspeicher (v${shareVersion}) — er wird nicht überschrieben.`,
      lokalVersion,
    );
  }

  // 7. Gleiche Textversion, gleiches Modell, gleiche Dimension — bleibt nur der
  //    Dokument-Praefix. Er bestimmt den Raum mit, also wird nicht gemischt.
  return befund(
    'unbrauchbar',
    'Der Korpus auf dem Datenspeicher wurde mit einem anderen Dokument-Präfix gebaut — die Vektoren sind nicht vergleichbar. Neuaufbau nötig.',
    lokalVersion,
  );
}
