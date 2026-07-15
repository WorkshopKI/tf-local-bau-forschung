// Post-Build-Strip der inlined ORT-WASM data:-URLs.
//
// Die ONNX-Runtime-WASM (~21 MB) liegt im Single-File-Bundle zweimal als
// `data:application/wasm;base64,<payload>` — seit Phase 2 wird sie zur Laufzeit aber
// aus dem gzip-Blob (src/generated/ort-wasm-gz.ts) via ensureOrtWasmBinary() als
// `wasmBinary` bereitgestellt; die data:-URLs braucht niemand mehr. Wir leeren nur den
// Payload und lassen `data:application/wasm;base64,` stehen — das umgebende String-/
// Template-Literal bleibt syntaktisch intakt. Sollte ORT die URL wider Erwarten doch
// laden wollen (Bug im wasmBinary-Pfad), schlaegt das sofort laut fehl statt still
// 30 MB zu ziehen — gewollt.
//
// Reine Funktion (String -> {html, report}); Aufruf sitzt in build-with-config.mjs
// zwischen `vite build` und dem Kopieren nach dist-single/<variante>.

import { pathToFileURL } from 'node:url';
import { argv } from 'node:process';

const WASM_PREFIX = 'data:application/wasm;base64,';
const MIN_PAYLOAD = 1_000_000; // nur wirklich grosse Payloads treffen die inlined WASM

// base64-Zeichen: A-Z a-z 0-9 + / =
function isBase64Code(code) {
  return (
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    (code >= 48 && code <= 57) ||
    code === 43 ||
    code === 47 ||
    code === 61
  );
}

/**
 * Linearer Scan (kein Regex-Backtracking — ein `{1000000,}`-Quantor sprengt bei ~30-Mio-Zeichen
 * den V8-Stack). Findet jedes `data:application/wasm;base64,`, misst den folgenden base64-Lauf und
 * leert nur Payloads >= 1 Mio Zeichen. Der ~7-MB-gzip-Blob steht ohne `data:`-Praefix im Bundle und
 * bleibt unberuehrt.
 * @param {string} html
 * @returns {{ html: string, report: { count: number, removedBytes: number, before: number, after: number } }}
 */
export function stripInlineWasm(html) {
  const parts = [];
  let count = 0;
  let removedBytes = 0;
  let searchFrom = 0;
  let idx;
  while ((idx = html.indexOf(WASM_PREFIX, searchFrom)) !== -1) {
    const payloadStart = idx + WASM_PREFIX.length;
    let end = payloadStart;
    while (end < html.length && isBase64Code(html.charCodeAt(end))) end++;
    const payloadLen = end - payloadStart;
    // bis inkl. Praefix immer uebernehmen
    parts.push(html.slice(searchFrom, payloadStart));
    if (payloadLen >= MIN_PAYLOAD) {
      count++;
      removedBytes += payloadLen;
      searchFrom = end; // Payload ueberspringen (geleert)
    } else {
      searchFrom = payloadStart; // kleinen Payload behalten, weitersuchen
    }
  }
  parts.push(html.slice(searchFrom));
  const out = parts.join('');
  return { html: out, report: { count, removedBytes, before: html.length, after: out.length } };
}

function runSelfTest() {
  const assert = (cond, msg) => {
    if (!cond) {
      console.error(`✗ strip-inline-wasm Selbst-Test: ${msg}`);
      process.exit(1);
    }
  };
  const big = 'A'.repeat(1_500_000);
  const small = 'B'.repeat(10);
  const html =
    'x=`data:application/wasm;base64,' + big + '`;' +
    ' y="data:application/wasm;base64,' + big + '";' +
    " z='data:application/wasm;base64," + small + "';";
  const { html: out, report } = stripInlineWasm(html);
  assert(report.count === 2, `erwartet 2 grosse Blobs, war ${report.count}`);
  assert(!out.includes(big), 'grosser Payload noch vorhanden');
  assert(out.includes('data:application/wasm;base64,`'), 'Backtick-Praefix nicht erhalten');
  assert(out.includes('data:application/wasm;base64,' + small), 'kleiner Blob faelschlich gestrippt');
  assert(report.removedBytes === big.length * 2, `removedBytes falsch: ${report.removedBytes}`);
  console.log(`✓ strip-inline-wasm Selbst-Test ok (2 Blobs, ${report.removedBytes} Bytes entfernt)`);
}

// Selbst-Test nur bei Direktaufruf: node scripts/strip-inline-wasm.mjs
if (import.meta.url === pathToFileURL(argv[1] ?? '').href) {
  runSelfTest();
}
