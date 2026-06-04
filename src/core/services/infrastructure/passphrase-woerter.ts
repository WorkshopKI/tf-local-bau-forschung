/**
 * Kuratierte Wortliste fuer MA-Zugangs-Passphrases (v2.11).
 *
 * Kurze, eindeutige deutsche Substantive — KEINE Umlaute (ä/ö/ü) oder ß
 * (Tipp-Stolperfallen beim Eingeben), keine leicht verwechselbaren Woerter.
 * ~320 Woerter → bei 2 Woertern ~100.000 geordnete Kombinationen; fuer das
 * Online-Bedrohungsmodell (beilaeufiges Fremd-Eintragen verhindern, KEIN
 * GPU-Offline-Schutz) mehr als ausreichend.
 *
 * Statische Daten-Datei — bewusste Ausnahme vom Groessen-Richtwert
 * (CLAUDE.md "Architecture Principles / File Size Limit": Groesse ergibt sich
 * aus den Daten, nicht aus Logik-Struktur).
 *
 * INVARIANTE: nur [A-Za-z], keine Umlaute/ß, keine Duplikate — vom Unit-Test
 * geprueft (`__tests__/passphrase-woerter.test.ts`).
 */
import { randomBytes } from './crypto';

export const PASSPHRASE_WOERTER: readonly string[] = [
  'Anker', 'Wolke', 'Lampe', 'Fuchs', 'Stern', 'Hafen', 'Pfeil', 'Turm', 'Welle', 'Garten',
  'Spiegel', 'Feder', 'Kanal', 'Korb', 'Nadel', 'Riegel', 'Schacht', 'Brunnen', 'Hammer', 'Insel',
  'Kerze', 'Leiter', 'Magnet', 'Nebel', 'Ofen', 'Palme', 'Quelle', 'Rakete', 'Segel', 'Tanne',
  'Ufer', 'Vase', 'Wagen', 'Zelt', 'Acker', 'Balken', 'Damm', 'Esche', 'Faden', 'Granit',
  'Hecke', 'Jacke', 'Kessel', 'Lanze', 'Mantel', 'Notiz', 'Orden', 'Pfanne', 'Quarz', 'Rampe',
  'Schild', 'Tunnel', 'Vogel', 'Wiese', 'Zange', 'Ampel', 'Birke', 'Distel', 'Eimer', 'Flagge',
  'Gabel', 'Halm', 'Insekt', 'Kabel', 'Linse', 'Motor', 'Narbe', 'Oase', 'Posten', 'Radar',
  'Salbe', 'Taste', 'Wabe', 'Zitrone', 'Apfel', 'Banane', 'Wald', 'Bach', 'Berg', 'Tal',
  'Fluss', 'Strand', 'Klippe', 'Schlucht', 'Gipfel', 'Hang', 'Moor', 'Heide', 'Feld', 'Pfad',
  'Steg', 'Zaun', 'Pforte', 'Saal', 'Halle', 'Kammer', 'Keller', 'Boden', 'Dach', 'Giebel',
  'Sims', 'Stufe', 'Treppe', 'Diele', 'Flur', 'Nische', 'Kran', 'Bagger', 'Pumpe', 'Ventil',
  'Kolben', 'Achse', 'Speiche', 'Felge', 'Reifen', 'Bremse', 'Hebel', 'Kupplung', 'Zahnrad', 'Schraube',
  'Bolzen', 'Niete', 'Draht', 'Spule', 'Funke', 'Blitz', 'Donner', 'Regen', 'Schnee', 'Frost',
  'Wind', 'Sturm', 'Brise', 'Hagel', 'Dunst', 'Glut', 'Asche', 'Kohle', 'Flamme', 'Docht',
  'Fackel', 'Laterne', 'Zunder', 'Span', 'Scheit', 'Block', 'Brett', 'Latte', 'Pfosten', 'Stamm',
  'Zweig', 'Blatt', 'Knospe', 'Dorn', 'Ranke', 'Wurzel', 'Rinde', 'Harz', 'Moos', 'Farn',
  'Klee', 'Nessel', 'Schilf', 'Binse', 'Rohr', 'Korn', 'Saat', 'Garbe', 'Stroh', 'Heu',
  'Mehl', 'Teig', 'Laib', 'Krume', 'Kruste', 'Brot', 'Brezel', 'Kuchen', 'Torte', 'Keks',
  'Waffel', 'Honig', 'Sirup', 'Zucker', 'Salz', 'Pfeffer', 'Senf', 'Essig', 'Gurke', 'Bohne',
  'Erbse', 'Kohl', 'Lauch', 'Zwiebel', 'Knolle', 'Tomate', 'Paprika', 'Kresse', 'Salat', 'Spinat',
  'Anis', 'Kamille', 'Minze', 'Salbei', 'Thymian', 'Dill', 'Lorbeer', 'Nelke', 'Zimt', 'Mandel',
  'Nuss', 'Rosine', 'Feige', 'Dattel', 'Pflaume', 'Kirsche', 'Birne', 'Traube', 'Beere', 'Melone',
  'Mango', 'Ananas', 'Limette', 'Orange', 'Pfirsich', 'Pinsel', 'Palette', 'Rahmen', 'Leinwand', 'Kreide',
  'Stift', 'Tinte', 'Schere', 'Lineal', 'Zirkel', 'Winkel', 'Heft', 'Mappe', 'Ordner', 'Klammer',
  'Marker', 'Stempel', 'Siegel', 'Bogen', 'Rolle', 'Tube', 'Dose', 'Flasche', 'Krug', 'Becher',
  'Tasse', 'Teller', 'Schale', 'Kanne', 'Sieb', 'Trichter', 'Kelle', 'Topf', 'Deckel', 'Messer',
  'Spaten', 'Harke', 'Rechen', 'Schaufel', 'Sense', 'Sichel', 'Beil', 'Axt', 'Feile', 'Raspel',
  'Klemme', 'Zwinge', 'Bohrer', 'Haken', 'Ring', 'Kette', 'Glied', 'Schlinge', 'Knoten', 'Boje',
  'Kahn', 'Ruder', 'Paddel', 'Kompass', 'Leuchtturm', 'Mole', 'Pier', 'Werft', 'Dock', 'Schleuse',
  'Wehr', 'Furt', 'Planke', 'Bohle', 'Mast', 'Wimpel', 'Reiher', 'Storch', 'Schwan', 'Ente',
  'Gans', 'Taube', 'Falke', 'Adler', 'Specht', 'Hirsch', 'Hase', 'Igel', 'Dachs', 'Biber',
  'Otter', 'Marder', 'Robbe', 'Muschel', 'Schnecke', 'Krabbe', 'Hecht', 'Forelle', 'Karpfen', 'Lachs',
];

/**
 * Liefert eine gleichverteilte Zufalls-Position. 4 Zufalls-Bytes → Uint32 mod
 * Listenlaenge. Modulo-Bias ist bei dieser Listengroesse vernachlaessigbar.
 */
function pickIndex(max: number): number {
  const b = randomBytes(4);
  const n = new DataView(b.buffer, b.byteOffset, 4).getUint32(0);
  return n % max;
}

/**
 * Generiert eine 2-Wort-Passphrase, mit "-" getrennt (z.B. "Anker-Wolke").
 * Beide Woerter sind garantiert verschieden.
 */
export function generatePassphrase(): string {
  const n = PASSPHRASE_WOERTER.length;
  const i = pickIndex(n);
  let j = pickIndex(n);
  if (j === i) j = (j + 1) % n;
  return `${PASSPHRASE_WOERTER[i]}-${PASSPHRASE_WOERTER[j]}`;
}
