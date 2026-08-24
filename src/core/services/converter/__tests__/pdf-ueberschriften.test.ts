import { describe, it, expect } from 'vitest';
import {
  ermittleUeberschriftsSkala,
  ueberschriftStufe,
  type GroessenZeile,
} from '../pdf-ueberschriften';

const z = (text: string, groesse: number): GroessenZeile => ({ text, groesse });

/** Fließtext-Rauschen, damit die Grundgröße einen echten Zeichen-Vorsprung hat. */
function fliesstext(anzahl: number, groesse = 11): GroessenZeile[] {
  return Array.from({ length: anzahl }, (_, i) =>
    z(`Absatz ${i} mit ausreichend Text, damit die Grundgröße die Mehrheit der Zeichen trägt.`, groesse));
}

describe('ermittleUeberschriftsSkala — Überschriften ohne Tag-Baum schätzen', () => {
  it('trennt Fließtext von größer gesetzten Überschriften', () => {
    const zeilen = [z('Ausgangssituation und Marktbedarf', 16), ...fliesstext(20)];
    const skala = ermittleUeberschriftsSkala(zeilen);
    expect(skala.grundgroesse).toBe(11);
    expect(skala.stufen).toEqual([16]);
    expect(ueberschriftStufe(z('Ausgangssituation und Marktbedarf', 16), skala)).toBe(1);
    expect(ueberschriftStufe(z('Ein normaler Satz im Fließtext.', 11), skala)).toBeNull();
  });

  it('nimmt die ZEICHENSTÄRKSTE Größe als Grundgröße, nicht die häufigste Zeile', () => {
    // 30 kurze Kopfzeilen (Größe 9) gegen 12 lange Fließtext-Zeilen (Größe 11):
    // nach Zeilen gewinnt die Kopfzeile, nach Zeichen der Fließtext. Zählte man
    // Zeilen, gälte 11 als Überschrift — und mit 15 von 45 Treffern (33 %) fiele
    // die Skala unter die Anteils-Grenze und wäre ganz weg.
    const kopfzeilen = Array.from({ length: 30 }, () => z('Projektbeschreibung', 9));
    const skala = ermittleUeberschriftsSkala([
      ...kopfzeilen,
      ...fliesstext(12),
      z('Ausgangssituation und Marktbedarf', 16),
      z('Projektgegenstand', 16),
      z('Projektplan', 16),
    ]);
    expect(skala.grundgroesse).toBe(11);
    expect(skala.stufen).toEqual([16]);
    expect(ueberschriftStufe(z('Projektbeschreibung', 9), skala)).toBeNull();
  });

  it('vergibt bis zu drei Ebenen absteigend nach Größe', () => {
    const zeilen = [
      z('Kapitel eins', 20), z('Unterkapitel', 16), z('Unterunterkapitel', 13),
      ...fliesstext(40),
    ];
    const skala = ermittleUeberschriftsSkala(zeilen);
    expect(skala.stufen).toEqual([20, 16, 13]);
    expect(ueberschriftStufe(z('Kapitel eins', 20), skala)).toBe(1);
    expect(ueberschriftStufe(z('Unterkapitel', 16), skala)).toBe(2);
    expect(ueberschriftStufe(z('Unterunterkapitel', 13), skala)).toBe(3);
  });

  it('liefert KEINE Skala, wenn alles dieselbe Größe hat', () => {
    expect(ermittleUeberschriftsSkala(fliesstext(30)).stufen).toEqual([]);
  });

  it('liefert KEINE Skala, wenn zu viele Zeilen als Überschrift gälten', () => {
    // Hälfte/Hälfte: das Größen-Signal trennt hier nichts — lieber gar nichts sagen.
    const gross = Array.from({ length: 20 }, (_, i) => z(`Zeile ${i}`, 16));
    const klein = Array.from({ length: 20 }, (_, i) => z(`Zeile ${i}`, 11));
    expect(ermittleUeberschriftsSkala([...gross, ...klein]).stufen).toEqual([]);
  });

  it('verwirft groß gesetzte Zeilen, die nach Fließtext aussehen', () => {
    const skala = ermittleUeberschriftsSkala([z('Kurze Überschrift', 16), ...fliesstext(20)]);
    // Satzende → kein Titel.
    expect(ueberschriftStufe(z('Das ist ein ganzer Satz.', 16), skala)).toBeNull();
    // Zu lang → kein Titel.
    expect(ueberschriftStufe(z('W'.repeat(200), 16), skala)).toBeNull();
    // Ohne Buchstaben → kein Titel.
    expect(ueberschriftStufe(z('12 / 2026', 16), skala)).toBeNull();
  });

  it('bleibt still, wenn keine Zeile eine Größe trägt', () => {
    const skala = ermittleUeberschriftsSkala([z('Text', 0), z('Mehr', 0)]);
    expect(skala).toEqual({ grundgroesse: 0, stufen: [] });
    expect(ueberschriftStufe(z('Text', 0), skala)).toBeNull();
  });
});
