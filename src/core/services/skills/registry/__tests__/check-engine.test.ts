import { describe, it, expect } from 'vitest';
import {
  splitSentences,
  countWords,
  runRegelChecks,
  buildPromptVorgaben,
  buildPromptHinweis,
  eingabeModusOf,
  kompiliereGruppe,
  erkennungsEintraege,
} from '../check-engine';
import type { QualitaetsRegel, Schweregrad } from '../types';

/** 9-Satz-Kurzfassung (entspricht dem Mockup), „Der Antragsteller plant" in Satz 4. */
const NEUN_SAETZE =
  'Das Vorhaben adressiert die kontinuierliche Überwachung industrieller Fertigungsprozesse durch ein adaptives Sensornetzwerk. '
  + 'Ziel ist die frühzeitige Erkennung von Prozessabweichungen, um Ausschuss und ungeplante Stillstände zu reduzieren. '
  + 'Hierzu kombiniert das Vorhaben kostengünstige MEMS-Sensoren mit einer eingebetteten Auswerteeinheit. '
  + 'Der Antragsteller plant, ein selbstkalibrierendes Verfahren zu entwickeln. '
  + 'Ein wesentlicher Innovationsschritt liegt in der Verknüpfung lokaler Anomalieerkennung mit maschinellem Lernen. '
  + 'Die Auswertung erfolgt vollständig dezentral, sodass keine sensiblen Produktionsdaten das Werksnetz verlassen. '
  + 'Im Projektverlauf sollen Labormuster aufgebaut und an einer Referenzanlage erprobt werden. '
  + 'Die angestrebte Erkennungsgenauigkeit liegt bei über 95 Prozent. '
  + 'Angaben zur geplanten Markteinführung sind [Im Antrag nicht genannt].';

function regel(
  typ: string,
  params: Record<string, unknown>,
  opts: { schweregrad?: Schweregrad; aktiv?: boolean; id?: string } = {},
): QualitaetsRegel {
  return {
    id: opts.id ?? `r-${typ}`,
    name: typ,
    typ,
    params,
    schweregrad: opts.schweregrad ?? 'fehler',
    aktiv: opts.aktiv ?? true,
    erstellt_am: 't',
    geaendert_am: 't',
  };
}

describe('splitSentences — Abkürzungen sind kein Satzende', () => {
  it('zählt „z. B." nicht als Satzgrenze', () => {
    expect(splitSentences('Das Modul nutzt z. B. MEMS-Sensoren. Es ist robust.')).toHaveLength(2);
  });
  it('zählt „z.B." (ohne Leerraum) nicht als Satzgrenze', () => {
    expect(splitSentences('Das Modul nutzt z.B. MEMS-Sensoren. Es ist robust.')).toHaveLength(2);
  });
  it('zählt „ca.", „bzw.", „d. h." nicht als Satzgrenze', () => {
    expect(splitSentences('Es werden ca. 50 Einheiten bzw. Module geprüft, d. h. alle Varianten. Fertig.')).toHaveLength(2);
  });
  it('erkennt echte Satzgrenzen mit ! und ?', () => {
    expect(splitSentences('Funktioniert das? Ja, sehr gut! Wirklich.')).toHaveLength(3);
  });
  it('zählt 9 Sätze in der Beispiel-Kurzfassung', () => {
    expect(splitSentences(NEUN_SAETZE)).toHaveLength(9);
  });
});

describe('countWords — öffentlicher Zähler für Regel UND Meta-Zeile', () => {
  it('zählt Whitespace-getrennt und ignoriert Mehrfach-Leerzeichen/Umbrüche', () => {
    expect(countWords('ein  zwei\n\tdrei')).toBe(3);
  });
  it('leerer bzw. reiner Whitespace-Text → 0', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n  ')).toBe(0);
  });
  it('deckt sich mit dem Messwert der wortanzahl-Regel (eine Zählung, zwei Konsumenten)', () => {
    const check = runRegelChecks(NEUN_SAETZE, [regel('wortanzahl', { min: 1 })])[0]!;
    expect(check.messwert).toBe(countWords(NEUN_SAETZE));
  });
});

describe('runRegelChecks — pro Regel-Typ', () => {
  it('zeichen_max: ok unter Limit, Schweregrad bei Überschreitung', () => {
    expect(runRegelChecks('kurz', [regel('zeichen_max', { max: 10 })])[0]!.level).toBe('ok');
    const fail = runRegelChecks('x'.repeat(20), [regel('zeichen_max', { max: 10, })])[0]!;
    expect(fail.level).toBe('fehler');
    expect(fail.regelId).toBe('r-zeichen_max');
  });

  it('wortanzahl: prüft min/max', () => {
    expect(runRegelChecks('ein zwei drei', [regel('wortanzahl', { min: 3, max: 5 })])[0]!.level).toBe('ok');
    expect(runRegelChecks('ein', [regel('wortanzahl', { min: 3, max: 5 })])[0]!.level).toBe('fehler');
  });

  it('satzanzahl: ok bei 9 (8–12), fehler außerhalb', () => {
    expect(runRegelChecks(NEUN_SAETZE, [regel('satzanzahl', { min: 8, max: 12 })])[0]!.level).toBe('ok');
    expect(runRegelChecks('Ein Satz.', [regel('satzanzahl', { min: 8, max: 12 })])[0]!.level).toBe('fehler');
  });

  it('satzlaenge_max: meldet zu lange Sätze mit Schweregrad', () => {
    const lang = 'Dies ist ein bewusst sehr ausführlich formulierter Satz mit deutlich mehr als fünf Wörtern.';
    const r = runRegelChecks(lang, [regel('satzlaenge_max', { maxWoerter: 5 }, { schweregrad: 'hinweis' })])[0]!;
    expect(r.level).toBe('hinweis');
    expect(runRegelChecks('Kurz und knapp.', [regel('satzlaenge_max', { maxWoerter: 5 })])[0]!.level).toBe('ok');
  });

  it('verbotenes_muster: erkennt Regex- und Literal-Muster mit Satz-Nr.', () => {
    const r = runRegelChecks(NEUN_SAETZE, [
      regel('verbotenes_muster', { muster: ['Der Antragsteller plant', '\\bAP\\s?\\d+'], istRegex: true }, { schweregrad: 'hinweis' }),
    ])[0]!;
    expect(r.level).toBe('hinweis');
    expect(r.detail).toContain('Satz 4');
    const lit = runRegelChecks('Das ist klar verboten.', [
      regel('verbotenes_muster', { muster: ['verboten'], istRegex: false })],
    )[0]!;
    expect(lit.level).toBe('fehler');
  });

  it('pflicht_anfang: prüft exakten Textbeginn', () => {
    expect(runRegelChecks('Das Vorhaben wirkt.', [regel('pflicht_anfang', { text: 'Das Vorhaben' })])[0]!.level).toBe('ok');
    expect(runRegelChecks('Etwas anderes.', [regel('pflicht_anfang', { text: 'Das Vorhaben' })])[0]!.level).toBe('fehler');
  });

  it('keine_aufzaehlungen: erkennt Listen-Marker', () => {
    expect(runRegelChecks('Fließtext ohne Liste.', [regel('keine_aufzaehlungen', {})])[0]!.level).toBe('ok');
    expect(runRegelChecks('Ziele:\n- Punkt eins', [regel('keine_aufzaehlungen', {})])[0]!.level).toBe('fehler');
  });

  it('absatz_min: zählt durch Doppel-Zeilenumbruch getrennte Absätze', () => {
    const vier = 'Erster Absatz.\n\nZweiter Absatz.\n\nDritter Absatz.\n\nVierter Absatz.';
    expect(runRegelChecks(vier, [regel('absatz_min', { min: 4 })])[0]!.level).toBe('ok');
    expect(runRegelChecks(vier, [regel('absatz_min', { min: 4 })])[0]!.label).toBe('Absätze 4 (min 4)');
  });

  it('absatz_min: fehler bei zu wenigen Absätzen, einzelne Zeilenumbrüche trennen nicht', () => {
    const zwei = 'Absatz eins\nmit Zeilenumbruch.\n\nAbsatz zwei.';
    expect(runRegelChecks(zwei, [regel('absatz_min', { min: 4 })])[0]!.level).toBe('fehler');
    expect(runRegelChecks('Nur ein Absatz.', [regel('absatz_min', { min: 1 })])[0]!.level).toBe('ok');
    expect(runRegelChecks('', [regel('absatz_min', { min: 1 })])[0]!.level).toBe('fehler');
  });

  it('absatz_min: hint nennt die Mindestzahl', () => {
    expect(buildPromptHinweis(regel('absatz_min', { min: 4 }))).toContain('mindestens 4 Absätze');
  });
});

describe('runRegelChecks — richtung (Auto-Retry-Signal, eine Quelle)', () => {
  it('zeichen_max über Limit ⇒ zu_lang; ok ⇒ keine richtung', () => {
    expect(runRegelChecks('x'.repeat(20), [regel('zeichen_max', { max: 10 })])[0]!.richtung).toBe('zu_lang');
    expect(runRegelChecks('kurz', [regel('zeichen_max', { max: 10 })])[0]!.richtung).toBeUndefined();
  });

  it('wortanzahl: zu wenig ⇒ zu_kurz, zu viel ⇒ zu_lang', () => {
    expect(runRegelChecks('ein', [regel('wortanzahl', { min: 3, max: 5 })])[0]!.richtung).toBe('zu_kurz');
    expect(runRegelChecks('ein zwei drei vier fünf sechs', [regel('wortanzahl', { min: 3, max: 5 })])[0]!.richtung).toBe('zu_lang');
  });

  it('satzanzahl: zu kurz ⇒ zu_kurz, zu lang ⇒ zu_lang', () => {
    expect(runRegelChecks('Ein Satz.', [regel('satzanzahl', { min: 8, max: 12 })])[0]!.richtung).toBe('zu_kurz');
    expect(runRegelChecks(NEUN_SAETZE, [regel('satzanzahl', { min: 1, max: 3 })])[0]!.richtung).toBe('zu_lang');
  });

  it('Nicht-Größen-Regeln tragen keine richtung (→ Auto-Retry „neu")', () => {
    const r = runRegelChecks('Ziele:\n- Punkt eins', [regel('keine_aufzaehlungen', {})])[0]!;
    expect(r.level).toBe('fehler');
    expect(r.richtung).toBeUndefined();
  });
});

describe('runRegelChecks — messwert (Ist-Wert für Korrektur/Anzeige, eine Quelle)', () => {
  it('zeichen_max: Ist = Zeichenzahl (auch bei ok)', () => {
    expect(runRegelChecks('x'.repeat(20), [regel('zeichen_max', { max: 10 })])[0]!.messwert).toBe(20);
    expect(runRegelChecks('kurz', [regel('zeichen_max', { max: 10 })])[0]!.messwert).toBe(4);
  });
  it('wortanzahl/satzanzahl/absatz_min: Ist = gemessene Anzahl', () => {
    expect(runRegelChecks('ein zwei drei', [regel('wortanzahl', { min: 3, max: 5 })])[0]!.messwert).toBe(3);
    expect(runRegelChecks(NEUN_SAETZE, [regel('satzanzahl', { min: 1, max: 3 })])[0]!.messwert).toBe(9);
    expect(runRegelChecks('Nur ein Absatz.', [regel('absatz_min', { min: 2 })])[0]!.messwert).toBe(1);
  });
  it('Nicht-Größen-Regeln tragen keinen messwert', () => {
    expect(runRegelChecks('Ziele:\n- Punkt eins', [regel('keine_aufzaehlungen', {})])[0]!.messwert).toBeUndefined();
    expect(runRegelChecks('irgendwas', [regel('verbotenes_muster', { muster: ['x'] })])[0]!.messwert).toBeUndefined();
  });
});

describe('verbotenes_muster — fundstellen (lokalisierbar, „Anzeigen"-Sprung)', () => {
  const ZWEI_TREFFER = 'Der Antragsteller plant eine Lösung. Das Vorhaben ist innovativ. Der Antragsteller beabsichtigt Tests.';
  const passiv = { muster: ['Der Antragsteller plant', 'Der Antragsteller beabsichtigt'], istRegex: true };

  it('ein Treffer: fundstellen mit dem 0-basierten Satz-Index; Detail byte-identisch', () => {
    const r = runRegelChecks(NEUN_SAETZE, [regel('verbotenes_muster', { muster: ['Der Antragsteller plant'], istRegex: true }, { schweregrad: 'hinweis' })])[0]!;
    expect(r.fundstellen).toEqual([{ satzIndex: 3, muster: 'Der Antragsteller plant' }]);
    expect(r.detail).toBe('„Der Antragsteller plant" in Satz 4.');
  });

  it('mehrere Treffer: eine fundstelle je Satz (erster + letzter Satz), Anzahl im Detail', () => {
    const r = runRegelChecks(ZWEI_TREFFER, [regel('verbotenes_muster', passiv, { schweregrad: 'hinweis' })])[0]!;
    expect(r.fundstellen?.map(f => f.satzIndex)).toEqual([0, 2]);
    expect(r.detail).toContain('2 Stellen');
  });

  it('Segmentierer-Gleichheit Engine↔UI: der satzIndex zeigt auf denselben splitSentences-Satz', () => {
    const r = runRegelChecks(ZWEI_TREFFER, [regel('verbotenes_muster', passiv, { schweregrad: 'hinweis' })])[0]!;
    const saetze = splitSentences(ZWEI_TREFFER);
    for (const f of r.fundstellen ?? []) {
      expect(saetze[f.satzIndex]).toContain('Der Antragsteller');
    }
  });

  it('kein Treffer → ok, keine fundstellen', () => {
    const r = runRegelChecks('Ein neutraler Satz ohne Befund.', [regel('verbotenes_muster', passiv, { schweregrad: 'hinweis' })])[0]!;
    expect(r.level).toBe('ok');
    expect(r.fundstellen).toBeUndefined();
  });
});

describe('runRegelChecks — Aktiv/Schweregrad/Unbekannt', () => {
  it('überspringt deaktivierte Regeln', () => {
    const results = runRegelChecks('Ein Satz.', [regel('satzanzahl', { min: 8, max: 12 }, { aktiv: false })]);
    expect(results).toHaveLength(0);
  });

  it('überspringt unbekannte Typen (behält sie aber im Datensatz)', () => {
    const results = runRegelChecks('egal', [regel('zukunfts_typ', { irgendwas: 1 })]);
    expect(results).toHaveLength(0);
  });

  it('mappt Schweregrad nur im Fehlerfall (ok bleibt ok)', () => {
    const okRes = runRegelChecks('kurz', [regel('zeichen_max', { max: 100 }, { schweregrad: 'hinweis' })])[0]!;
    expect(okRes.level).toBe('ok');
  });
});

describe('buildPromptVorgaben / buildPromptHinweis', () => {
  it('listet nur aktive, bekannte Regeln unter „Formale Vorgaben"', () => {
    const block = buildPromptVorgaben([
      regel('satzanzahl', { min: 8, max: 12 }),
      regel('zeichen_max', { max: 1000 }),
      regel('keine_aufzaehlungen', {}, { aktiv: false }),
      regel('zukunfts_typ', {}),
    ]);
    expect(block).toContain('## Formale Vorgaben');
    expect(block).toContain('Schreibe 8 bis 12 Sätze.');
    expect(block).toContain('maximal 1000 Zeichen');
    expect(block).not.toContain('Aufzählungen');
  });

  it('liefert Leerstring ohne aktive bekannte Regeln', () => {
    expect(buildPromptVorgaben([regel('keine_aufzaehlungen', {}, { aktiv: false })])).toBe('');
  });

  it('buildPromptHinweis: null für unbekannte Typen', () => {
    expect(buildPromptHinweis(regel('zukunfts_typ', {}))).toBeNull();
    expect(buildPromptHinweis(regel('satzanzahl', { min: 8, max: 12 }))).toContain('8 bis 12');
  });
});

/* -------------------------------------------------------------------------- */
/* verbotenes_muster — Eingabe-Modi, eine Erkennungs-Quelle, regexfreier Hinweis */
/* -------------------------------------------------------------------------- */

describe('eingabeModusOf — explizit vor Legacy-Ableitung', () => {
  it('nimmt einen gültigen expliziten Modus', () => {
    expect(eingabeModusOf({ eingabeModus: 'synonym' })).toBe('synonym');
    expect(eingabeModusOf({ eingabeModus: 'phrasen' })).toBe('phrasen');
    expect(eingabeModusOf({ eingabeModus: 'regex' })).toBe('regex');
  });
  it('leitet aus Legacy-`istRegex` ab, wenn `eingabeModus` fehlt', () => {
    expect(eingabeModusOf({ istRegex: true })).toBe('regex');
    expect(eingabeModusOf({ istRegex: false })).toBe('phrasen');
  });
  it('fällt auf `phrasen` zurück (fehlt / ungültiger Wert)', () => {
    expect(eingabeModusOf({})).toBe('phrasen');
    expect(eingabeModusOf({ eingabeModus: 'quatsch' })).toBe('phrasen');
  });
});

describe('kompiliereGruppe — escapete Regex-Quelle aus Synonym-Gruppe', () => {
  it('Stamm + Varianten → Stamm\\s*(?:a|b)', () => {
    expect(kompiliereGruppe({ stamm: 'Der Antragsteller', varianten: ['plant', 'beabsichtigt'] }))
      .toBe('Der Antragsteller\\s*(?:plant|beabsichtigt)');
  });
  it('escapet Sonderzeichen in Stamm und Varianten', () => {
    expect(kompiliereGruppe({ stamm: 'a.b', varianten: ['c(d)'] })).toBe('a\\.b\\s*(?:c\\(d\\))');
  });
  it('nur Stamm → escape(stamm); nur Varianten → (?:a|b); leer → ""', () => {
    expect(kompiliereGruppe({ stamm: 'Nur Stamm', varianten: [] })).toBe('Nur Stamm');
    expect(kompiliereGruppe({ stamm: '', varianten: ['plant', 'beabsichtigt'] })).toBe('(?:plant|beabsichtigt)');
    expect(kompiliereGruppe({ stamm: '', varianten: [] })).toBe('');
  });
});

describe('erkennungsEintraege — die EINE Match-Quelle', () => {
  it('Synonym: kompiliert + menschenlesbares Label, case-insensitiv mit \\s*', () => {
    const e = erkennungsEintraege({
      eingabeModus: 'synonym',
      gruppen: [{ stamm: 'Der Antragsteller', varianten: ['plant', 'beabsichtigt'] }],
    });
    expect(e).toHaveLength(1);
    expect(e[0]!.label).toBe('Der Antragsteller plant/beabsichtigt');
    expect(e[0]!.regex.test('der antragsteller   plant')).toBe(true);
    expect(e[0]!.regex.test('Das Vorhaben verfolgt')).toBe(false);
  });
  it('leere Synonym-Gruppen werden übersprungen', () => {
    expect(erkennungsEintraege({ eingabeModus: 'synonym', gruppen: [{ stamm: '', varianten: [] }] })).toHaveLength(0);
  });
  it('Phrasen (Legacy, kein eingabeModus): wörtlich escaped, Label = Muster', () => {
    const ph = erkennungsEintraege({ muster: ['Maßnahme'], istRegex: false });
    expect(ph[0]!.label).toBe('Maßnahme');
    expect(ph[0]!.regex.test('eine Maßnahme')).toBe(true);
  });
  it('Regex (Legacy `istRegex:true`): Muster wird als Regex interpretiert', () => {
    const rx = erkennungsEintraege({ muster: ['\\bAP\\s?\\d+'], istRegex: true });
    expect(rx[0]!.regex.test('siehe AP 12')).toBe(true);
  });
  it('ungültige User-Regex → Literal-Fallback statt Crash', () => {
    expect(() => erkennungsEintraege({ eingabeModus: 'regex', muster: ['(unbalanced'] })).not.toThrow();
    const bad = erkennungsEintraege({ eingabeModus: 'regex', muster: ['(unbalanced'] });
    expect(bad[0]!.regex.test('(unbalanced')).toBe(true);
  });
});

describe('verbotenes_muster.check — Synonym + Legacy byte-identisch', () => {
  it('Synonym matcht „Der Antragsteller beabsichtigt …", Detail = Label', () => {
    const r = runRegelChecks('Der Antragsteller beabsichtigt eine Lösung.', [
      regel('verbotenes_muster', {
        eingabeModus: 'synonym',
        gruppen: [{ stamm: 'Der Antragsteller', varianten: ['plant', 'beabsichtigt'] }],
      }, { schweregrad: 'hinweis' }),
    ])[0]!;
    expect(r.level).toBe('hinweis');
    expect(r.detail).toBe('„Der Antragsteller plant/beabsichtigt" in Satz 1.');
  });
  it('Regression: Synonym-Gruppe findet denselben Befund wie die heutige Regex-Regel (Satz 4)', () => {
    const r = runRegelChecks(NEUN_SAETZE, [
      regel('verbotenes_muster', {
        eingabeModus: 'synonym',
        gruppen: [{ stamm: 'Der Antragsteller', varianten: ['plant', 'beabsichtigt'] }],
      }, { schweregrad: 'hinweis' }),
    ])[0]!;
    expect(r.level).toBe('hinweis');
    expect(r.detail).toContain('Satz 4');
  });
  it('leere Synonym-Gruppen → ok', () => {
    expect(runRegelChecks('egal', [regel('verbotenes_muster', { eingabeModus: 'synonym', gruppen: [] })])[0]!.level).toBe('ok');
  });
  it('Phrasen-Bestand: Detail byte-identisch (Label = Muster)', () => {
    const lit = runRegelChecks('Das ist klar verboten.', [
      regel('verbotenes_muster', { muster: ['verboten'], istRegex: false }),
    ])[0]!;
    expect(lit.level).toBe('fehler');
    expect(lit.detail).toBe('„verboten" in Satz 1.');
  });
});

describe('verbotenes_muster.hint — zweiseitig + REGEXFREI', () => {
  it('nur `hinweisVermeiden` → „Vermeide X."', () => {
    expect(buildPromptHinweis(regel('verbotenes_muster', { hinweisVermeiden: 'Passiv-Formulierungen' })))
      .toBe('Vermeide Passiv-Formulierungen.');
  });
  it('`hinweisVermeiden` + `hinweisStattdessen` → „… Formuliere stattdessen Y."', () => {
    expect(buildPromptHinweis(regel('verbotenes_muster', {
      hinweisVermeiden: 'Passiv-Formulierungen',
      hinweisStattdessen: 'aktiv und konkret',
    }))).toBe('Vermeide Passiv-Formulierungen. Formuliere stattdessen aktiv und konkret.');
  });
  it('Synonym ohne `hinweisVermeiden`: menschenlesbare Labels, KEIN roher Regex', () => {
    const h = buildPromptHinweis(regel('verbotenes_muster', {
      eingabeModus: 'synonym',
      gruppen: [{ stamm: 'Der Antragsteller', varianten: ['plant', 'beabsichtigt'] }],
    }))!;
    expect(h).toContain('Der Antragsteller plant/beabsichtigt');
    expect(h).not.toContain('(?:');
    expect(h).not.toContain('\\s');
    expect(h).not.toContain('\\b');
  });
  // Prompt-Audit 2026-07: der frühere Fallback „Vermeide die hinterlegten verbotenen
  // Formulierungen." verwies auf etwas, das im Prompt NICHT steht (roher Regex bleibt
  // bewusst draußen). Das Modell konnte ihn weder befolgen noch verifizieren und suchte
  // die Referenz. Ohne nennbaren Inhalt gibt es daher gar keinen Hinweis mehr — der
  // deterministische Check läuft unberührt weiter.
  it('Regex-Modus ohne `hinweisVermeiden` → KEIN Hinweis (statt inhaltsleerer Forderung)', () => {
    expect(buildPromptHinweis(regel('verbotenes_muster', { muster: ['\\bAP\\d+'], istRegex: true })))
      .toBeNull();
  });
  it('leere Musterliste → KEIN Hinweis', () => {
    expect(buildPromptHinweis(regel('verbotenes_muster', { muster: [], istRegex: false })))
      .toBeNull();
  });
  it('Legacy-Phrasen: Hinweis byte-identisch zur heutigen Ausgabe', () => {
    expect(buildPromptHinweis(regel('verbotenes_muster', { muster: ['Maßnahme', 'Synergie'], istRegex: false })))
      .toBe('Vermeide Formulierungen wie „Maßnahme", „Synergie".');
  });
  it('inhaltsleere Regeln erzeugen keinen leeren Bullet im Vorgaben-Block', () => {
    const nurRegex = regel('verbotenes_muster', { muster: ['\\bAP\\d+'], istRegex: true });
    const block = buildPromptVorgaben([nurRegex, regel('keine_aufzaehlungen', {})]);
    expect(block).not.toContain('hinterlegten');
    expect(block).not.toMatch(/^-\s*$/m);
    expect(block).toBe('## Formale Vorgaben\n- Der finale Text ist Fließtext ohne Aufzählungen.');
  });
  it('greift KEIN Hinweis, entfällt der Vorgaben-Block ganz', () => {
    expect(buildPromptVorgaben([regel('verbotenes_muster', { muster: ['x'], istRegex: true })])).toBe('');
  });
  it('mehrzeiliger Hinweis steht als eigener Absatz, nicht als aufgebrochener Bullet', () => {
    const block = buildPromptVorgaben([
      regel('keine_aufzaehlungen', {}),
      regel('pflicht_anfang', { text: 'Das Vorhaben wird die Kompetenz im Bereich' }),
    ]);
    // Der Bullet-Teil bleibt einzeilig; der Pflicht-Anfang folgt als eigener Absatz.
    expect(block).toContain('## Formale Vorgaben\n- Der finale Text ist Fließtext ohne Aufzählungen.\n\n');
    expect(block).not.toContain('- Der finale Text muss mit genau diesem Wortlaut beginnen');
    // Der Wortlaut steht unzitiert auf eigener Zeile (die Zeilengrenze IST die Grenze).
    expect(block).toContain('\n\nDas Vorhaben wird die Kompetenz im Bereich\n\n');
  });
});
