import { describe, it, expect } from 'vitest';
import {
  formatBausteinKatalog, pruefeNf, nfFreigabereif, gueltigeBausteinIds, mergeNfFuerTv,
  buildNfMailto, VERBUND_BLOCK_TITEL, TV_BLOCK_TITEL,
} from '../nf-service';
import { nfBausteineByScope } from '@/core/services/skills';

describe('formatBausteinKatalog', () => {
  it('formatiert ID + Thema + Kategorie + wortgetreuen Text', () => {
    const text = formatBausteinKatalog(nfBausteineByScope('verbund'));
    expect(text).toContain('### G1.1');
    expect(text).toContain('Zur geplanten Entwicklung');
    expect(text).toContain('Ihre gemeinsame Projektbeschreibung'); // verbatim
  });
});

describe('pruefeNf — administratives Tor (kein ungefüllter Platzhalter)', () => {
  it('Text mit Platzhalter-Resten → Fehler, nicht freigabereif', () => {
    const checks = pruefeNf('Bitte beschreiben Sie {das / die} Lösung mit x €.');
    expect(checks.some(c => c.level === 'fehler' && c.regelId === 'nf-keine-platzhalter')).toBe(true);
    expect(nfFreigabereif('Bitte beschreiben Sie {das / die} Lösung mit x €.')).toBe(false);
  });

  it('vollständig gefüllter Text → kein Fehler, freigabereif', () => {
    const sauber = 'Bitte beschreiben Sie das Verfahren mit einer Auftragssumme von 12.000 €.';
    expect(pruefeNf(sauber).every(c => c.level !== 'fehler')).toBe(true);
    expect(nfFreigabereif(sauber)).toBe(true);
  });

  it('Befehls-/Meta-Reste der Konversations-Schicht werden als Hinweis erkannt', () => {
    const checks = pruefeNf('Fertige Nachforderung. ⌨ W=Weiter · N=Neu');
    expect(checks.some(c => c.regelId === 'nf-keine-meta' && c.level === 'hinweis')).toBe(true);
  });
});

describe('gueltigeBausteinIds', () => {
  it('trennt bekannte von unbekannten IDs', () => {
    const { gueltig, unbekannt } = gueltigeBausteinIds(['G1.1', 'T2.1.2', 'X9.9', 'erfunden']);
    expect(gueltig).toEqual(['G1.1', 'T2.1.2']);
    expect(unbekannt).toEqual(['X9.9', 'erfunden']);
  });
});

describe('mergeNfFuerTv — Verbund-Block wortgleich in jeder TV-NF', () => {
  const gBlock = 'G-Frage: Bitte erläutern Sie die Arbeitsteilung.';
  it('fügt den IDENTISCHEN Verbund-Block in jede TV-NF ein', () => {
    const nf1 = mergeNfFuerTv(gBlock, 'TV1-spezifische Frage.');
    const nf2 = mergeNfFuerTv(gBlock, 'TV2-andere Frage.');
    const verbundTeil = `## ${VERBUND_BLOCK_TITEL}\n\n${gBlock}`;
    expect(nf1).toContain(verbundTeil);
    expect(nf2).toContain(verbundTeil); // byte-gleich in beiden
    expect(nf1).toContain('TV1-spezifische Frage.');
    expect(nf2).toContain('TV2-andere Frage.');
    expect(nf1).toContain(`## ${TV_BLOCK_TITEL}`);
  });

  it('lässt leere Blöcke aus', () => {
    expect(mergeNfFuerTv('', 'nur TV')).toBe(`## ${TV_BLOCK_TITEL}\n\nnur TV`);
    expect(mergeNfFuerTv('nur G', '')).toBe(`## ${VERBUND_BLOCK_TITEL}\n\nnur G`);
  });
});

describe('buildNfMailto — E-Mail-Entwurf (sendet nichts)', () => {
  it('baut eine mailto-URL mit interpoliertem Betreff + Body', () => {
    const url = buildNfMailto({ fkz: '16EP000001', nachforderungen: 'NF-Text' });
    expect(url.startsWith('mailto:?')).toBe(true); // kein Empfänger → Adresse editierbar
    expect(decodeURIComponent(url)).toContain('16EP000001'); // {fkz} im Betreff
    expect(decodeURIComponent(url)).toContain('NF-Text'); // {nachforderungen} im Body
  });

  it('setzt den Empfänger, wenn eine Adresse vorliegt', () => {
    const url = buildNfMailto({ email: 'a@b.de', fkz: 'X', nachforderungen: 'Y' });
    expect(url.startsWith('mailto:a%40b.de?')).toBe(true);
  });
});
