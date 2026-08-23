/**
 * Wann ein Rechenwerk als tot gilt — und was dann geschieht.
 *
 * Der Anlass: zwei Rechner verloren beim Vollbau nach ~810 Vektoren den
 * WebGPU-Kontext (807 beim Nutzer, 827 in der Abnahme). Hier steht der Beweis,
 * dass die Erholung diesen Fehler erkennt, an einem harmlosen Fehler NICHT
 * anspringt, und weder endlos laedt noch ewig auf einer toten Grafikkarte
 * beharrt.
 */
import { describe, it, expect } from 'vitest';
import {
  istGeraeteverlust,
  planeErholung,
  ERHOLUNG_MAX,
  ERTRAG_MINDEST,
  type ErholungsLage,
} from '../geraet';

/** Der gemeldete Wortlaut, ungekuerzt aus der Karte des Nutzers. */
const ECHTER_FEHLER =
  "failed to call OrtRun(). ERROR_CODE: 1, ERROR_MESSAGE: "
  + "/mnt/vss/_work/1/s/onnxruntime/core/providers/webgpu/buffer_manager.cc:543 "
  + "auto onnxruntime::webgpu::BufferManager::Download(WGPUBuffer, void *, size_t)"
  + "::(lambda)::operator()(wgpu::MapAsyncStatus, wgpu::StringView) const status == "
  + "wgpu::MapAsyncStatus::Success was false. Failed to download data from buffer: "
  + "Failed to execute 'mapAsync' on 'GPUBuffer': [Device] is lost. ";

describe('istGeraeteverlust — der gemeldete Fehler wird erkannt', () => {
  it('erkennt den Wortlaut aus dem Fehlerbericht', () => {
    expect(istGeraeteverlust(new Error(ECHTER_FEHLER))).toBe(true);
  });

  it('erkennt die knappen Varianten derselben Sache', () => {
    for (const wortlaut of [
      'GPUDevice was lost',
      'Device is destroyed',
      'Out of memory',
      'Failed to allocate buffer',
      'memory access out of bounds',
    ]) {
      expect(istGeraeteverlust(new Error(wortlaut)), wortlaut).toBe(true);
    }
  });

  it('springt NICHT an, wo ein einzelner Datensatz schuld ist', () => {
    // Sonst laedt ein Lauf vierzigmal ein 200-MB-Modell nach, nur weil ein
    // Datensatz reproduzierbar nicht passt.
    for (const wortlaut of [
      'Model output has neither sentence_embedding nor last_hidden_state',
      'Aborted',
      'Model not initialized',
      'Cannot read properties of undefined',
    ]) {
      expect(istGeraeteverlust(new Error(wortlaut)), wortlaut).toBe(false);
    }
  });

  it('kommt auch mit einem geworfenen Nicht-Fehler zurecht', () => {
    expect(istGeraeteverlust('Device is lost')).toBe(true);
    expect(istGeraeteverlust(undefined)).toBe(false);
  });
});

describe('planeErholung — die Leiter', () => {
  it('gibt der Grafikkarte beim ERSTEN Verlust einen frischen Kontext', () => {
    expect(planeErholung({ geraet: 'webgpu', seitErholung: 827, erholungen: 0 }))
      .toEqual({ art: 'neuladen', geraet: 'webgpu' });
  });

  it('bleibt auf der Grafikkarte, solange ein Neuladen etwas einbringt', () => {
    expect(planeErholung({ geraet: 'webgpu', seitErholung: 810, erholungen: 7 }))
      .toEqual({ art: 'neuladen', geraet: 'webgpu' });
  });

  it('wechselt auf den Hauptprozessor, sobald ein Neuladen nichts mehr bringt', () => {
    // Der eigentliche Zweck der Leiter: keine zwanzig Ladelaeufe fuer je drei
    // Vektoren.
    expect(planeErholung({
      geraet: 'webgpu', seitErholung: ERTRAG_MINDEST - 1, erholungen: 1,
    })).toEqual({ art: 'neuladen', geraet: 'wasm' });
  });

  it('haelt am gemessenen Break-even fest: dreissig Vektoren tragen noch einen Ladelauf', () => {
    // Grafikkarte 0,067 s/Vektor, Hauptprozessor 2,02 s/Vektor, Ladelauf 38 s
    // (alle drei in der Abnahme 08/2026 gemessen). Ein Ladelauf lohnt damit ab
    // ~20 Vektoren Ertrag — bei dreissig also klar. Frueher aufzugeben
    // verurteilt einen Vollbau zu zwoelf Stunden.
    expect(planeErholung({ geraet: 'webgpu', seitErholung: 30, erholungen: 3 }))
      .toEqual({ art: 'neuladen', geraet: 'webgpu' });
    expect(planeErholung({ geraet: 'webgpu', seitErholung: 20, erholungen: 3 }))
      .toEqual({ art: 'neuladen', geraet: 'wasm' });
  });

  it('gibt auf dem Hauptprozessor auf, statt ein zweites Modell dagegen zu laden', () => {
    expect(planeErholung({ geraet: 'wasm', seitErholung: 5000, erholungen: 3 }))
      .toEqual({ art: 'aufgeben', grund: 'hauptprozessor' });
  });

  it('haelt die Obergrenze ein — ein Lauf laedt nicht endlos nach', () => {
    expect(planeErholung({ geraet: 'webgpu', seitErholung: 800, erholungen: ERHOLUNG_MAX }))
      .toEqual({ art: 'aufgeben', grund: 'obergrenze' });
  });

  it('kommt ueber einen Vollbau hinweg, ohne die Obergrenze zu reissen', () => {
    // 14.221 Vorhaben bei ~810 je Geraeteleben — die Leiter muss das tragen,
    // sonst ist die Erholung eine Zusage, die sie nicht halten kann.
    let lage: ErholungsLage = { geraet: 'webgpu', seitErholung: 0, erholungen: 0 };
    let erledigt = 0;
    let ladelaeufe = 0;
    while (erledigt < 14_221 && ladelaeufe <= ERHOLUNG_MAX) {
      const ertrag = 810;
      erledigt += ertrag;
      const plan = planeErholung({ ...lage, seitErholung: ertrag });
      if (plan.art === 'aufgeben') break;
      ladelaeufe++;
      lage = { geraet: plan.geraet, seitErholung: 0, erholungen: ladelaeufe };
    }
    expect(erledigt).toBeGreaterThanOrEqual(14_221);
    expect(ladelaeufe).toBeLessThanOrEqual(ERHOLUNG_MAX);
    expect(ladelaeufe).toBe(18); // gemessen: 14.221 / 810, aufgerundet
  });
});
