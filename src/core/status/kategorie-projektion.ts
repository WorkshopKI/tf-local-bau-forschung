/**
 * Auflösung der Ordner des Statuskatalogs zu Spalten der Fördertabelle: je
 * Ordner die Datumsfelder, die ihm zugeordnet sind, aufgelöst gegen die
 * Programm-Schemas.
 *
 * Die Projektion (`toAntragListItem`) berechnet daraus je Ordner das jüngste
 * gültige Datum und schreibt es in das Slim-Feld `kat_status` — dieselbe
 * Mechanik wie bei den fest verdrahteten FB-/PreCheck-Gruppen, nur eben
 * kuratiert statt im Code.
 *
 * Rein: keine IO. Fassung und Schemas reicht der Aufrufer herein.
 */
import type { CsvSchema } from '@/core/services/csv/types';
import type { ResolvedKategorieSpalten, StatusDatumFeld } from '@/core/services/csv/status-datum-gruppen';
import { baueFeldAufloesung, spaltenSchluessel } from './feld-aufloesung';
import type { MappingVersion, StatusFeldEintrag } from './typen';

/**
 * Trägt die Spalte in DIESEM Programm überhaupt Daten? Ein Code-Feld tut das
 * nur, wenn das Schema seine Spalte mappt — sonst fällt die Auflösung auf den
 * Spaltennamen zurück und die Spalte bliebe garantiert leer. Kanonische Felder
 * (ohne `code`) sind per Definition Record-Keys und zählen immer.
 *
 * Gefragt wird mit **demselben Schlüssel wie die Auflösung**
 * (`spaltenSchluessel`), sonst antworten die beiden verschieden: mit dem
 * unscharfen `normCode` galten `D_ARQ-`, `D_GZ-`, `D_VQK-` und `D_VQT-` als
 * gemappt, obwohl keiner von ihnen eine eigene Spalte im Export hat — sie
 * belegten je einen Platz im Spaltenpicker und blieben garantiert leer.
 */
function istImProgramm(feld: StatusFeldEintrag, gemappt: ReadonlySet<string>): boolean {
  if (feld.code === undefined) return true;
  return gemappt.has(spaltenSchluessel(feld.feldId));
}

/**
 * Baut die Spalten-Auflösung je aktivem Ordner.
 *
 * Nur **Datumsfelder** zählen: die Spalte zeigt „wann zuletzt etwas passiert
 * ist", und ein Texteintrag hat keinen Termin, nach dem sich sortieren ließe.
 * Stillgelegte Ordner und Felder fallen weg, ebenso die auf „Ignoriert"
 * gesetzten — die Kuration wirkt hier unmittelbar.
 *
 * Ordner ohne auflösbare Spalte erscheinen gar nicht: eine Spalte, die in
 * diesem Programm nie einen Wert tragen kann, ist nur Rauschen im Spaltenpicker.
 */
export function loeseKategorieSpalten(
  version: MappingVersion, schemas: readonly CsvSchema[],
): ResolvedKategorieSpalten[] {
  const kategorien = (version.kategorien ?? []).filter(k => k.aktiv);
  if (kategorien.length === 0) return [];
  const aufloesung = baueFeldAufloesung(schemas, version.felder);
  const gemappt = new Set<string>();
  for (const s of schemas) {
    for (const [spalte, entry] of Object.entries(s.column_mapping ?? {})) {
      if (entry && !entry.ignore) gemappt.add(spaltenSchluessel(spalte));
    }
  }

  const proKategorie = new Map<string, StatusDatumFeld[]>();
  for (const feld of version.felder) {
    if (!feld.aktiv || feld.typ !== 'datum') continue;
    if (feld.prominenzDefault === 'ignoriert') continue;
    if (!feld.kategorieId) continue;
    if (!istImProgramm(feld, gemappt)) continue;
    const treffer = aufloesung.get(feld.feldId);
    if (!treffer) continue;
    const liste = proKategorie.get(feld.kategorieId) ?? [];
    liste.push({ feld: treffer.recordKey, code: feld.code ?? feld.feldId, label: feld.label });
    proKategorie.set(feld.kategorieId, liste);
  }

  const out: ResolvedKategorieSpalten[] = [];
  for (const k of kategorien) {
    const felder = proKategorie.get(k.id);
    if (!felder || felder.length === 0) continue;
    out.push({ kategorieId: k.id, label: k.label, felder });
  }
  // Stabile Reihenfolge — sonst springt die Spaltenliste bei jedem Import.
  return out.sort((a, b) => a.kategorieId.localeCompare(b.kategorieId, 'de'));
}

/**
 * Die Ordner, für die es überhaupt eine Spalte geben kann — ohne Schema-Zugriff,
 * allein aus dem Katalog. Das ist die Liste für den Spaltenpicker: sie muss
 * schon stehen, bevor irgendein Programm geladen ist, und darf nicht springen,
 * wenn der Nutzer das Programm wechselt.
 *
 * Die tatsächliche Befüllung entscheidet `loeseKategorieSpalten` je Programm;
 * ein Ordner ohne gemappte Spalte bleibt hier sichtbar, aber leer.
 */
export function kategorienMitDatumsfeldern(
  version: MappingVersion,
): { kategorieId: string; label: string }[] {
  const belegt = new Set(
    version.felder
      .filter(f => f.aktiv && f.typ === 'datum' && f.prominenzDefault !== 'ignoriert' && f.kategorieId)
      .map(f => f.kategorieId!),
  );
  return (version.kategorien ?? [])
    .filter(k => k.aktiv && belegt.has(k.id))
    .sort((a, b) => a.id.localeCompare(b.id, 'de'))
    .map(k => ({ kategorieId: k.id, label: k.label }));
}

/**
 * Deterministische Signatur der aufgelösten Ordner-Spalten. Geht in den
 * Projektions-Guard ein: ändert die PL den Katalog (Ordner umbenannt, Feld
 * umgehängt, Rang egal), muss die Slim-Projektion neu gebaut werden — sonst
 * blieben die Spalten auf dem alten Stand stehen, ohne dass ein Record sich
 * geändert hätte.
 */
export function kategorieSpaltenSignatur(spalten: readonly ResolvedKategorieSpalten[]): string {
  return spalten
    // Das FELD-Label gehört dazu: genau es landet als `kat_status[...].l` in der
    // Projektion und erscheint in der Zelle, im XLSX-Export und in der
    // Filter-Werteliste. Ohne `#${f.label}` änderte eine Feld-Umbenennung
    // (Ordner, Code, Zuordnung unverändert) weder einen Record noch die
    // Projektionsversion noch die Signatur — der Boot-Guard baute nicht neu,
    // und die Zelle zeigte auf unbestimmte Zeit den alten Text, während
    // Katalog-Verwaltung und Spaltenkopf den neuen führten. Der FB/PC-Teil
    // derselben Signatur führt das Label seit je.
    .map(s => `${s.kategorieId}#${s.label}=${s.felder.map(f => `${f.code}>${f.feld}#${f.label}`).join('|')}`)
    .join(';');
}
