/**
 * Die Vorschlagsliste des Frage-Modus (v4.106).
 *
 * Geprüft wird das, was die Liste zusagt: drei Abschnitte in fester Reihenfolge,
 * die Trennlinie zwischen fertiger und halber Frage (`fertig`), die Lücken-
 * Mechanik — und dass keine Beispielfrage eine Achse anspricht, die der
 * Antragsplan gar nicht kennt.
 */
import { describe, it, expect } from 'vitest';
import {
  baueFrageAbschnitte, ersteLuecke, flacheListe, hatLuecke, LUECKE_AUF, LUECKE_ZU,
} from '../frage/vorschlagsAbschnitte';
import { VB_PHASE_LABELS } from '@/core/utils/vb-phase-mappings';

describe('baueFrageAbschnitte', () => {
  it('zeigt ohne Verlauf zwei Abschnitte: Beispiele und Vorlagen', () => {
    const a = baueFrageAbschnitte('', []);
    expect(a.map(x => x.titel)).toEqual(['Beispielfragen', 'Zum Ausfüllen']);
  });

  it('stellt den Verlauf voran — die eigene Frage von gestern schlägt jedes Beispiel', () => {
    const a = baueFrageAbschnitte('', ['alle Anträge von THÜ']);
    expect(a.map(x => x.titel)).toEqual(['Zuletzt gefragt', 'Beispielfragen', 'Zum Ausfüllen']);
    expect(a[0]?.eintraege[0]?.text).toBe('alle Anträge von THÜ');
  });

  it('kappt den Verlauf bei drei — sonst rutscht „Zum Ausfüllen" unter die Kante', () => {
    const lang = ['eins', 'zwei', 'drei', 'vier', 'fünf'];
    const a = baueFrageAbschnitte('', lang);
    expect(a[0]?.eintraege.map(e => e.text)).toEqual(['eins', 'zwei', 'drei']);
  });

  it('liefert je drei Beispiele und drei Vorlagen', () => {
    const a = baueFrageAbschnitte('', []);
    expect(a[0]?.eintraege).toHaveLength(3);
    expect(a[1]?.eintraege).toHaveLength(3);
  });

  it('gibt Verlauf und Beispiele als fertig aus, Vorlagen nicht', () => {
    const a = baueFrageAbschnitte('', ['alte Frage']);
    const nachArt = new Map(flacheListe(a).map(v => [v.art, v.fertig]));
    expect(nachArt.get('verlauf')).toBe(true);
    expect(nachArt.get('beispiel')).toBe(true);
    expect(nachArt.get('vorlage')).toBe(false);
  });

  it('filtert alle drei Abschnitte am getippten Text', () => {
    const a = baueFrageAbschnitte('PreCheck', ['alle Anträge mit PreCheck von gestern', 'ganz was anderes']);
    expect(a.map(x => x.titel)).toEqual(['Zuletzt gefragt', 'Beispielfragen', 'Zum Ausfüllen']);
    expect(a[0]?.eintraege).toHaveLength(1);
    for (const abschnitt of a) {
      for (const e of abschnitt.eintraege) {
        expect(e.text.toLowerCase()).toContain('precheck');
      }
    }
  });

  it('kommt bei einer eigenen Frage leer zurück — die Liste verdeckt die Eingabe nicht', () => {
    expect(baueFrageAbschnitte('welche Anträge kommen aus Bremerhaven?', [])).toEqual([]);
  });

  it('zählt die flache Liste über alle Abschnitte hinweg (EINE Auswahlmarke)', () => {
    const a = baueFrageAbschnitte('', ['eine', 'zwei']);
    expect(flacheListe(a)).toHaveLength(2 + 3 + 3);
  });

  it('nennt im Varianten-Hinweis die Beschriftungen aus VB_PHASE_LABELS, ohne den Irrläufer', () => {
    const abschnitte = baueFrageAbschnitte('', []);
    const vorlagen = abschnitte[abschnitte.length - 1]?.eintraege ?? [];
    const hinweis = vorlagen.map(v => v.erklaerung ?? '').join(' | ');
    expect(hinweis).toContain(VB_PHASE_LABELS[3]);
    expect(hinweis).toContain(VB_PHASE_LABELS[1]);
    expect(hinweis).not.toContain(VB_PHASE_LABELS[9]);
  });

  it('spricht in keiner Frage eine Achse an, die der Antragsplan nicht kennt', () => {
    // Der Antragsplan filtert nach Status, Variante, Jahr, Projektart, PreCheck,
    // Bearbeiter, Stillstand und Thema — nach Ort, Bundesland oder Fördersumme
    // NICHT. Eine Beispielfrage danach landete geradewegs in „nicht
    // berücksichtigt" und lehrte das Falsche.
    //
    // Als GANZE Wörter geprüft: „Ort" steckt sonst in „Stichwort" und der Guard
    // schlüge dort an, wo er nichts zu suchen hat.
    const fremd = /\b(ort|orte|bundesland|fördersumme|summe|plz|branche)\b/;
    for (const v of flacheListe(baueFrageAbschnitte('', []))) {
      expect(v.text.toLowerCase()).not.toMatch(fremd);
    }
  });
});

describe('Lücken einer Vorlage', () => {
  it('findet die erste Lücke samt ihrer Marken', () => {
    const text = `alle ${LUECKE_AUF}Variante${LUECKE_ZU}-Anträge aus ${LUECKE_AUF}Jahr${LUECKE_ZU}`;
    const l = ersteLuecke(text);
    expect(l).not.toBeNull();
    expect(text.slice(l!.start, l!.ende)).toBe(`${LUECKE_AUF}Variante${LUECKE_ZU}`);
  });

  it('meldet keine Lücke in einer ausgefüllten Frage', () => {
    expect(hatLuecke('alle FuE-Anträge aus 2025')).toBe(false);
    expect(ersteLuecke('alle FuE-Anträge aus 2025')).toBeNull();
  });

  it('hält ein einzelnes Winkelzeichen nicht für eine Lücke', () => {
    expect(hatLuecke(`alle Anträge ${LUECKE_AUF}ohne Ende`)).toBe(false);
  });

  it('gibt jeder Vorlage mindestens eine Lücke — sonst wäre sie ein Beispiel', () => {
    const abschnitte = baueFrageAbschnitte('', []);
    const vorlagen = abschnitte[abschnitte.length - 1]?.eintraege ?? [];
    expect(vorlagen).toHaveLength(3);
    for (const v of vorlagen) expect(hatLuecke(v.text)).toBe(true);
  });

  it('lässt keine Lücke in einer fertigen Frage stehen', () => {
    const fertige = flacheListe(baueFrageAbschnitte('', ['alte Frage'])).filter(v => v.fertig);
    for (const v of fertige) expect(hatLuecke(v.text)).toBe(false);
  });
});
