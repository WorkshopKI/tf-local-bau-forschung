/**
 * Dubletten-Erkennung der Dokumenten-Aufnahme (rein, node-testbar).
 *
 * Hintergrund: `useDokumenteStore.add` vergibt pro Aufnahme eine frische UUID — wer
 * dieselbe Datei ein zweites Mal ablegte (typisch: schlechte Konvertierung, korrigierte
 * Fassung, oder schlicht ein zweiter Testlauf), bekam einen ZWEITEN Record statt einer
 * Aktualisierung. Sichtbar wurde das nie, weil der Gutachten-Pfad ohnehin nur ein
 * Dokument las; erst das Inventar (v2.282) zeigt den angesammelten Bestand.
 *
 * Das widerspricht dem ausformulierten Prinzip „einmal hochladen → überall verfügbar"
 * (siehe `dokumentAufnahmeFkz`): eine Datei ist EIN Dokument des Verbundes, kein Stapel
 * von Fassungen. Zwei Konsequenzen, die dieses Modul trägt:
 *  - beim Aufnehmen: gleicher Verbund + gleicher Dateiname ⇒ vorhandenen Record
 *    überschreiben (docId bleibt, damit VB-Wahl und Korpus-Auswahl nicht ins Leere zeigen);
 *  - im Bestand: Altfassungen gruppieren, damit der Bearbeiter sie bewusst entfernen kann.
 *
 * Identität ist der **Dateiname innerhalb des Verbundes**, nicht der Inhalt. Über den
 * Inhalt zu deduplizieren wäre falsch herum: die korrigierte Neu-Konvertierung derselben
 * Datei hat anderen Inhalt und ist trotzdem dasselbe Dokument.
 */

/** Minimal-Form, die beide Aufrufer erfüllen (Aufnahme: `DocumentFull`, Inventar: `KorpusKandidat`). */
export interface DublettenEintrag {
  docId: string;
  filename: string;
  created: string;
}

/** Vergleichsform des Dateinamens — Groß-/Kleinschreibung und Randleerraum sind kein Unterschied. */
export function dublettenSchluessel(filename: string): string {
  return filename.trim().toLowerCase();
}

/**
 * Existiert zu diesem Verbund bereits ein Dokument dieses Namens? Bei mehreren (Altbestand
 * aus der Zeit vor der Ersetzung) gewinnt die jüngste Fassung — sie ist die, die der
 * Bearbeiter zuletzt gesehen hat.
 */
export function findeGleichnamiges<T extends { id: string; filename: string; created?: string; tags?: string[] }>(
  docs: readonly T[], relationTag: string, filename: string,
): T | null {
  const gesucht = dublettenSchluessel(filename);
  const treffer = docs.filter(d =>
    (Array.isArray(d.tags) ? d.tags : []).includes(relationTag)
    && dublettenSchluessel(d.filename ?? '') === gesucht);
  if (treffer.length === 0) return null;
  return [...treffer].sort((a, b) => (b.created ?? '').localeCompare(a.created ?? ''))[0] ?? null;
}

/** Eine Gruppe gleichnamiger Dokumente: eine bleibt, der Rest sind Altfassungen. */
export interface DublettenGruppe {
  filename: string;
  /** docId der jüngsten Fassung — die bleibt erhalten. */
  behalten: string;
  /** docIds der älteren Fassungen, in Inventar-Reihenfolge. */
  entfernen: string[];
}

/**
 * Gruppiert gleichnamige Dokumente. Nur echte Dubletten (≥2 Fassungen) kommen zurück;
 * die Reihenfolge folgt dem übergebenen Inventar, damit die UI nicht springt.
 */
export function gruppiereDubletten(eintraege: readonly DublettenEintrag[]): DublettenGruppe[] {
  const nachName = new Map<string, DublettenEintrag[]>();
  for (const e of eintraege) {
    const k = dublettenSchluessel(e.filename);
    const liste = nachName.get(k);
    if (liste) liste.push(e); else nachName.set(k, [e]);
  }

  const gruppen: DublettenGruppe[] = [];
  for (const liste of nachName.values()) {
    if (liste.length < 2) continue;
    const juengste = [...liste].sort((a, b) => b.created.localeCompare(a.created))[0]!;
    gruppen.push({
      filename: juengste.filename,
      behalten: juengste.docId,
      entfernen: liste.filter(e => e.docId !== juengste.docId).map(e => e.docId),
    });
  }
  return gruppen;
}

/** Wie viele Altfassungen liegen insgesamt herum? (Zahl für den Aufräum-Hinweis.) */
export function zaehleAltfassungen(gruppen: readonly DublettenGruppe[]): number {
  return gruppen.reduce((n, g) => n + g.entfernen.length, 0);
}

/**
 * Zeigt eine docId auf eine Altfassung, wird sie auf die behaltene umgezogen — sonst
 * verlöre der Bearbeiter beim Aufräumen still seine VB-Wahl bzw. Korpus-Auswahl.
 */
export function ziehePickUm(docId: string | null, gruppen: readonly DublettenGruppe[]): string | null {
  if (!docId) return null;
  const gruppe = gruppen.find(g => g.entfernen.includes(docId));
  return gruppe ? gruppe.behalten : docId;
}

/** Dasselbe für die Korpus-Mitgliedschaft — dublettenfrei, Reihenfolge stabil. */
export function zieheAuswahlUm(aufgenommen: readonly string[], gruppen: readonly DublettenGruppe[]): string[] {
  const out: string[] = [];
  for (const id of aufgenommen) {
    const neu = ziehePickUm(id, gruppen);
    if (neu && !out.includes(neu)) out.push(neu);
  }
  return out;
}
