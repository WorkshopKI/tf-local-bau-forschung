// TeamFlow Streamlit Bridge — Bookmarklet
// Wird vom Nutzer EINMAL pro Streamlit-Tab geklickt (Black-Box-UI, die wir
// nicht kontrollieren — unter file:// koennen wir kein JS in den fremden Tab
// injizieren, das Bookmarklet ist der vom Nutzer autorisierte Weg).
// Spricht via postMessage mit dem StreamlitBridgeTransport unserer App:
//   tf-ping     -> tf-pong
//   tf-app-ping <- (App antwortet tf-app-pong; Gegenrichtungs-Test)
//   tf-request {id, message} -> tf-stream {id, content}* -> tf-response {id, result, reasoning?}
// Antwort wird per DOM-Scrape als MARKDOWN aus der Chat-UI geholt (htmlToMd),
// live gestreamt und erst finalisiert, wenn das Streamlit-Skript idle ist.
(function () {
  if (window.__teamflowBridge) return;
  window.__teamflowBridge = true;

  // Versions-Marker: bei JEDER Aenderung an diesem Snippet bumpen. So laesst sich im
  // KI-Tab pruefen, ob das NEUE Bookmarklet laeuft (haeufigste Support-Frage): Maus
  // ueber das Status-Badge (Tooltip) ODER `window.__teamflowBridgeRev` in der Konsole
  // ODER die Log-Zeile beim Aktivieren.
  var BRIDGE_REV = '2026-07-02-echo-anchor';
  window.__teamflowBridgeRev = BRIDGE_REV;
  try { console.log('[TeamFlow-Bridge] aktiv — rev ' + BRIDGE_REV); } catch (e) { /* ignore */ }

  // Selektor-Fallback-Arrays (spezifisch -> generisch). Deckt mehrere
  // Streamlit-Versionen ab; `.st-key-input_msg` setzt `key="input_msg"` voraus.
  var SEL = {
    textarea: [
      '.st-key-input_msg textarea',
      'textarea[data-testid="stChatInputTextArea"]',
      '.stChatInput textarea',
      'textarea',
    ],
    submit: [
      'button[data-testid="stChatInputSubmitButton"]',
      '.stChatInput button[type="submit"]',
    ],
    msg: ['[data-testid="stChatMessage"]'],
    content: [
      '[data-testid="stChatMessageContent"]',
      '[data-testid="stMarkdownContainer"]',
      '.stMarkdown',
    ],
    appRoot: ['[data-testid="stAppViewContainer"]', 'section.main', '.main'],
    running: ['[data-testid="stStatusWidget"]', 'button[data-testid="stChatInputStopButton"]'],
  };

  function q1(list) {
    for (var i = 0; i < list.length; i++) {
      var e = document.querySelector(list[i]);
      if (e) return e;
    }
    return null;
  }
  function qa(list) {
    for (var i = 0; i < list.length; i++) {
      var e = document.querySelectorAll(list[i]);
      if (e.length) return e;
    }
    return [];
  }
  function isUser(m) {
    return !!m.querySelector('img[alt*="user"]');
  }
  function setValue(ta, val) {
    // React/Streamlit hoert auf den nativen value-Setter + input-Event.
    var setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, val);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function submit(ta) {
    var b = q1(SEL.submit);
    if (b) { b.click(); return; }
    // st.chat_input sendet auch via Enter.
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, which: 13, bubbles: true }));
  }

  // ── HTML → Markdown ──────────────────────────────────────────────────────
  // textContent wuerde Tabellen/Listen zu Fliesstext flachdruecken. Wir wandeln
  // die gerenderte Antwort zurueck in Markdown — der TeamFlow-Chat rendert es
  // wieder via marked (gfm:true) inkl. echter Tabellen.
  function isNoise(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName;
    if (tag === 'BUTTON' || tag === 'SVG' || tag === 'STYLE' || tag === 'SCRIPT') return true;
    var tid = el.getAttribute && el.getAttribute('data-testid');
    if (tid && /avatar|toolbar|copy|tooltip|headeraction/i.test(tid)) return true;
    var al = el.getAttribute && el.getAttribute('aria-label');
    if (al && /copy|kopieren/i.test(al)) return true;
    return false;
  }
  function inlineMd(node) {
    var out = '';
    for (var i = 0; i < node.childNodes.length; i++) {
      var c = node.childNodes[i];
      if (c.nodeType === 3) { out += c.nodeValue.replace(/\s+/g, ' '); continue; }
      if (c.nodeType !== 1 || isNoise(c)) continue;
      var t = c.tagName;
      if (t === 'BR') { out += '  \n'; }
      else if (t === 'STRONG' || t === 'B') { out += '**' + inlineMd(c).trim() + '**'; }
      else if (t === 'EM' || t === 'I') { out += '*' + inlineMd(c).trim() + '*'; }
      else if (t === 'CODE') { out += '`' + (c.textContent || '') + '`'; }
      else if (t === 'A') {
        var href = c.getAttribute('href') || '';
        var label = inlineMd(c).trim();
        // In-Page-Anker (Streamlit-Heading-Links `#slug`) sind Navigation, kein
        // Inhalt → nur (oft leeres) Label, NIE die href als Text (sonst leakt
        // der Slug `#was-ist-...` in die Antwort).
        if (href && href.charAt(0) !== '#' && label) { out += '[' + label + '](' + href + ')'; }
        else { out += label; }
      } else { out += inlineMd(c); } // span/div transparent
    }
    return out;
  }
  function tableMd(tableEl) {
    var rows = [], trs = tableEl.querySelectorAll('tr');
    for (var r = 0; r < trs.length; r++) {
      var cells = trs[r].querySelectorAll('th,td');
      if (!cells.length) continue;
      var line = [];
      for (var c = 0; c < cells.length; c++) {
        line.push(inlineMd(cells[c]).trim().replace(/\|/g, '\\|').replace(/\n/g, ' '));
      }
      rows.push('| ' + line.join(' | ') + ' |');
    }
    if (!rows.length) return '';
    var firstTr = tableEl.querySelector('tr');
    var cols = firstTr ? firstTr.querySelectorAll('th,td').length : 0;
    var sep = '|' + new Array(cols + 1).join(' --- |');
    rows.splice(1, 0, sep); // GFM-Separator nach der Kopfzeile
    return rows.join('\n');
  }
  function listMd(listEl, ordered, depth) {
    var out = [], idx = 1;
    for (var i = 0; i < listEl.children.length; i++) {
      var li = listEl.children[i];
      if (li.tagName !== 'LI') continue;
      // 3 Spaces/Ebene: ein verschachteltes Item muss ≥ Marker-Breite eingerückt
      // sein (unter „1. " = Spalte 3), sonst bricht marked die Liste → „1." überall.
      var indent = new Array(depth * 3 + 1).join(' ');
      var marker = ordered ? (idx++ + '. ') : '- ';
      var inline = '', nested = [];
      for (var j = 0; j < li.childNodes.length; j++) {
        var ch = li.childNodes[j];
        if (ch.nodeType === 1 && (ch.tagName === 'UL' || ch.tagName === 'OL')) {
          nested.push(listMd(ch, ch.tagName === 'OL', depth + 1));
        } else if (ch.nodeType === 3) { inline += ch.nodeValue.replace(/\s+/g, ' '); }
        else if (ch.nodeType === 1 && !isNoise(ch)) { inline += inlineMd(ch); }
      }
      out.push(indent + marker + inline.trim());
      for (var n = 0; n < nested.length; n++) out.push(nested[n]);
    }
    return out.join('\n');
  }
  function htmlToMd(root) {
    var blocks = [];
    function walk(node) {
      for (var i = 0; i < node.childNodes.length; i++) {
        var el = node.childNodes[i];
        if (el.nodeType === 3) {
          var txt = el.nodeValue.replace(/\s+/g, ' ').trim();
          if (txt) blocks.push(txt);
          continue;
        }
        if (el.nodeType !== 1 || isNoise(el)) continue;
        var t = el.tagName;
        if (/^H[1-6]$/.test(t)) {
          blocks.push(new Array(+t[1] + 1).join('#') + ' ' + inlineMd(el).trim());
        } else if (t === 'P') {
          var p = inlineMd(el).trim(); if (p) blocks.push(p);
        } else if (t === 'PRE') {
          var codeEl = el.querySelector('code');
          var code = (codeEl ? codeEl.textContent : el.textContent) || '';
          blocks.push('```\n' + code.replace(/\n+$/, '') + '\n```');
        } else if (t === 'UL' || t === 'OL') {
          var lm = listMd(el, t === 'OL', 0); if (lm) blocks.push(lm);
        } else if (t === 'TABLE') {
          var tm = tableMd(el); if (tm) blocks.push(tm);
        } else if (t === 'BLOCKQUOTE') {
          blocks.push(inlineMd(el).trim().split('\n').map(function (l) { return '> ' + l; }).join('\n'));
        } else if (t === 'BR') { /* block-level: skip */ }
        else { walk(el); } // div/section/span-Wrapper rekursiv
      }
    }
    walk(root);
    return blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function contentOf(m) {
    for (var i = 0; i < SEL.content.length; i++) {
      var c = m.querySelector(SEL.content[i]);
      if (c) return htmlToMd(c);
    }
    return htmlToMd(m);
  }

  // ── Thinking auslesen (best-effort) ───────────────────────────────────────
  // AitisiGPT zeigt das Reasoning als Info-Icon NACH der Antwort (Hover-Tooltip).
  // Wir versuchen den Streamlit-Tooltip auszulesen; klappt es nicht → kein
  // Thinking (Antwort bleibt unberuehrt). cb(reasoningMarkdownOrEmpty).
  function extractThinking(msgEl, cb) {
    if (!msgEl) { cb(''); return; }
    var target = msgEl.querySelector('[data-testid="stTooltipHoverTarget"]');
    if (!target && msgEl.parentElement) {
      target = msgEl.parentElement.querySelector('[data-testid="stTooltipHoverTarget"]');
    }
    if (!target) { cb(''); return; }
    ['pointerover', 'pointerenter', 'mouseenter', 'mouseover'].forEach(function (t) {
      try { target.dispatchEvent(new MouseEvent(t, { bubbles: true })); } catch (e) { /* ignore */ }
    });
    setTimeout(function () {
      var tip = document.querySelector('[data-testid="stTooltipContent"]')
        || document.querySelector('[data-baseweb="tooltip"]')
        || document.querySelector('[role="tooltip"]');
      var txt = tip ? htmlToMd(tip).trim() : '';
      ['pointerout', 'pointerleave', 'mouseleave', 'mouseout'].forEach(function (t) {
        try { target.dispatchEvent(new MouseEvent(t, { bubbles: true })); } catch (e) { /* ignore */ }
      });
      cb(txt);
    }, 250);
  }

  // ── Lauf-Status ───────────────────────────────────────────────────────────
  // „Fertig" = Antwort steht + Streamlit-Skript idle. Pausen mitten im Streamen
  // (AitisiGPT pausiert ~2s) duerfen NICHT als fertig gelten:
  //   isRunning()  — sichtbarer Lauf-Indikator (deckt serverseitige Pausen);
  //                  solange true, baut runRequest KEINE Idle-Zeit auf.
  // Die eigentliche Idle-Messung haengt an der Inhalts-Stabilitaet der Antwort
  // (lastContentChange in runRequest), NICHT an globaler DOM-Aktivitaet — sonst
  // verschleppt generierungs-unabhaengige DOM-Churn der KI-Seite das Ende.
  function isRunning() {
    for (var i = 0; i < SEL.running.length; i++) {
      var el = document.querySelector(SEL.running[i]);
      if (el && el.offsetParent !== null) return true;
    }
    return false;
  }
  // ── „Prompt-Vorlagen"-Spalte ausblenden (mehr Platz fuer den ferngesteuerten Chat) ──
  // Die interne KI-Seite zeigt rechts eine breite „Prompt-Vorlagen"-Spalte (Ueberschrift +
  // Selectbox), die der von der App gesteuerte Chat nicht braucht. Wir blenden sie rein per
  // CSS aus — verankert am Streamlit-Auto-Anker `#prompt-vorlagen` (wird bei jedem Rerun neu
  // erzeugt → die Regel greift flackerfrei, ganz ohne Observer) und ziehen die Chat-Spalte auf
  // volle Breite. Fehlt der Anker mal (Streamlit-Aenderung), setzt `ensureVorlagenHook()` ihn
  // per Ueberschriften-Text nach.
  var VORLAGEN_HEAD = 'h1,h2,h3,h4,[data-testid="stHeading"],[data-testid="stHeadingWithActionElements"]';
  function ensureVorlagenHook() {
    if (document.getElementById('prompt-vorlagen')) return; // Normalfall: Anker vorhanden
    var heads = document.querySelectorAll(VORLAGEN_HEAD);
    for (var i = 0; i < heads.length; i++) {
      var t = (heads[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (/prompt[\s-]*vorlagen/i.test(t)) { heads[i].id = 'prompt-vorlagen'; return; }
    }
  }
  function installTemplateHide() {
    if (!document.getElementById('tf-bridge-layout')) {
      var css =
        '[data-testid="stColumn"]:has(#prompt-vorlagen),' +
        '.stColumn:has(#prompt-vorlagen),' +
        '[data-testid="column"]:has(#prompt-vorlagen){display:none!important}' +
        '[data-testid="stHorizontalBlock"]:has(> [data-testid="stColumn"]:has(#prompt-vorlagen))' +
        ' > [data-testid="stColumn"]:not(:has(#prompt-vorlagen))' +
        '{flex:1 1 100%!important;width:100%!important;max-width:100%!important}';
      var st = document.createElement('style');
      st.id = 'tf-bridge-layout';
      st.textContent = css;
      (document.head || document.documentElement).appendChild(st);
    }
    ensureVorlagenHook();
  }
  installTemplateHide();

  // ── Chat vertikal responsive (fenster-relative Höhe) ───────────────────────
  // Übernommen aus dem bewährten Legacy-ZIM-Bookmarklet (streamlit-theme.css):
  // der scrollbare Layout-Wrapper des Chat-Containers bekommt eine fenster-
  // relative Höhe (75vh) und scrollt — so wächst/schrumpft der Verlauf mit dem
  // Fenster statt mit toter Fläche darunter. Die App nutzt
  // `st.container(key="chat_container")`. App-spezifisch + minimal (kein generisches
  // Full-height-Flex, das das custom Layout verbiegen würde); fehlen die Selektoren,
  // greift die Regel einfach nicht (kein Schaden).
  function installVerticalFill() {
    if (document.getElementById('tf-bridge-vfill')) return;
    var css =
      '[data-testid="stLayoutWrapper"][overflow="auto"]{height:75vh!important}' +
      '.st-key-chat_container{overflow-y:auto!important}';
    var st = document.createElement('style');
    st.id = 'tf-bridge-vfill';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }
  installVerticalFill();

  // Der MutationObserver haelt nur den „Prompt-Vorlagen"-Anker aktuell (bei jedem
  // Streamlit-Rerun neu erzeugt). Er treibt NICHT den Finalisierungs-Timer — der
  // haengt an der Inhalts-Stabilitaet der Antwort (siehe runRequest).
  try {
    var appRoot = q1(SEL.appRoot) || document.body;
    new MutationObserver(function () { ensureVorlagenHook(); })
      .observe(appRoot, { childList: true, subtree: true, characterData: true });
  } catch (e) { /* ignore */ }

  // ── Status-Badge (oben rechts) ────────────────────────────────────────────
  // Toene aus dem TeamFlow-Design-System (badge.tsx / theme.css). Werte als
  // Literale, weil die fremde KI-Seite die CSS-Variablen nicht kennt.
  var TONES = {
    ready:   { bg: 'hsl(145, 60%, 94%)', fg: 'hsl(145, 60%, 30%)' }, // success
    working: { bg: 'hsl(38, 90%, 93%)',  fg: 'hsl(38, 70%, 30%)' },  // warning
    error:   { bg: 'hsl(0, 70%, 95%)',   fg: 'hsl(0, 60%, 38%)' },   // danger
  };
  // Fixierte Leiste oben rechts: Badge + Test-Button in EINER Zeile.
  // z-index am Maximum (2147483647): die fremde KI-Seite hat eine volle-Breite-
  // Streamlit-Tab-Leiste mit hohem eigenem Stacking-Context, die `z-index:99999`
  // ueberdeckt haette (Leiste war im DOM + funktional, aber unsichtbar).
  var bar = document.createElement('div');
  bar.id = 'tf-bridge-bar';
  bar.style.cssText = 'position:fixed;top:8px;right:8px;z-index:2147483647;display:flex;gap:6px;align-items:center;';
  document.body.appendChild(bar);

  var badge = document.createElement('div');
  badge.id = 'tf-bridge-badge';
  badge.style.cssText = 'padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:400;font-family:sans-serif;background:' + TONES.ready.bg + ';color:' + TONES.ready.fg + ';';
  badge.textContent = 'Interne KI';
  badge.title = 'TeamFlow-Bridge ' + BRIDGE_REV; // Hover → welche Bookmarklet-Version laeuft
  bar.appendChild(badge);
  function setBadge(tone, text) {
    var t = TONES[tone] || TONES.ready;
    badge.style.background = t.bg;
    badge.style.color = t.fg;
    badge.textContent = text || 'Interne KI';
  }

  // Kleiner Test-Button (Gegenrichtung): prueft, ob das oeffnende App-Fenster
  // (window.opener) erreichbar ist → Nutzer sieht im KI-Tab „ZAH App erreichbar".
  var testBtn = document.createElement('button');
  testBtn.id = 'tf-bridge-test';
  testBtn.textContent = 'ZAH-App testen';
  testBtn.style.cssText = 'padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:400;font-family:sans-serif;border:1px solid ' + TONES.ready.fg + ';background:#fff;color:' + TONES.ready.fg + ';cursor:pointer;';
  bar.appendChild(testBtn);
  testBtn.addEventListener('click', function () {
    if (!window.opener) { testBtn.textContent = 'Kein App-Fenster'; return; }
    testBtn.textContent = 'Teste…';
    var done = false;
    function onPong(e) {
      if (e.data && e.data.type === 'tf-app-pong') {
        done = true;
        testBtn.textContent = 'ZAH App erreichbar';
        window.removeEventListener('message', onPong);
      }
    }
    window.addEventListener('message', onPong);
    window.opener.postMessage({ type: 'tf-app-ping' }, '*');
    setTimeout(function () {
      if (!done) { testBtn.textContent = 'ZAH App nicht erreichbar'; window.removeEventListener('message', onPong); }
    }, 3000);
  });

  // Beim Aktivieren dem oeffnenden App-Fenster Bescheid geben → die App
  // uebernimmt das Fenster-Handle (event.source) und kann zuverlaessig pingen,
  // ohne den Tab per window.open neu zu laden. Kein opener (manuell geoeffnet
  // oder COOP) → klarer Hinweis.
  if (window.opener) {
    try { window.opener.postMessage({ type: 'tf-bridge-ready' }, '*'); } catch (e) { /* ignore */ }
    // Auto-Selbsttest: triggert den vorhandenen „ZAH-App testen"-Button (DRY)
    // direkt nach dem Aktivieren → der Nutzer sieht „ZAH App erreichbar", ohne
    // selbst klicken zu muessen. Kleiner Versatz, damit das opener-Fenster sicher
    // bereit ist. Der Button bleibt als manueller Fallback erhalten.
    setTimeout(function () { testBtn.click(); }, 300);
  } else {
    setBadge('error', 'Tab aus der App öffnen');
  }

  // ── Anfrage-Engine: einfuegen → absenden → live streamen → finalisieren ────
  function runRequest(source, id, message) {
    setBadge('working', 'Arbeitet…');
    var ta = q1(SEL.textarea);
    if (!ta) {
      setBadge('error', 'Fehler');
      source.postMessage({ type: 'tf-response', id: id, result: 'Eingabefeld der internen KI nicht gefunden' }, '*');
      return;
    }
    setValue(ta, message);

    setTimeout(function () {
      submit(ta);
      // SETTLE_MS = Idle-Fenster vor dem Finalisieren. Grosszuegig (5 s), damit
      // Thinking-Modelle (Reasoning immer an) eine Denk-Pause zwischen erstem Token
      // und der eigentlichen Antwort ueberleben — sonst finalisiert die Bridge zu
      // frueh mit einem kurzen Partial (z. B. "Starte…"). MIN_LEN: solange die
      // Antwort verdaechtig kurz ist, ein doppelt so langes Fenster verlangen.
      var POLL_MS = 400, MAX_MS = 180000, SETTLE_MS = 5000, MIN_LEN = 40;
      var started = Date.now(), lastMd = '', finished = false;
      // Finalisierungs-Timer haengt an der INHALTS-Stabilitaet der Assistenten-
      // Antwort, nicht an globaler DOM-Aktivitaet: die fremde KI-Seite mutiert
      // ihren DOM auch generierungs-unabhaengig (Status-Widget, Reruns) — das
      // verhinderte (seit SETTLE_MS 2500->5000) das Finalisieren, obwohl die
      // Antwort laengst vollstaendig war. `lastContentChange` wird nur von echten
      // Antwort-Aenderungen + laufendem `isRunning()` (Pausen-Schutz) beruehrt.
      var lastContentChange = Date.now();

      // Antwort = die Nachricht NACH unserem gesendeten Prompt (dem User-Echo),
      // NICHT „die letzte Assistant-Nachricht". Zaehl-Baselines sind timing-fragil:
      // die AitisiGPT-Begruessung rendert nach einem Reset ggf. erst NACH dem
      // Zaehlpunkt und wird dann faelschlich gegriffen. Der Prompt-Echo-Anker ist
      // render-timing-unabhaengig — die Begruessung steht IMMER vor unserem Prompt.
      function lastAssistant() {
        var msgs = qa(SEL.msg), lastUser = -1;
        for (var i = msgs.length - 1; i >= 0; i--) {
          if (isUser(msgs[i])) { lastUser = i; break; } // Index unseres Prompt-Echos
        }
        // letzte Nicht-User-Nachricht STRIKT nach dem Echo. Fehlt das Echo (isUser
        // greift nicht), faengt der `md !== message`-Guard im Poll das Echo ab.
        for (var j = msgs.length - 1; j > lastUser; j--) {
          if (!isUser(msgs[j])) return msgs[j];
        }
        return null;
      }

      var iv = setInterval(function () {
        if (finished) return;
        var cand = lastAssistant();
        var md = cand ? contentOf(cand) : '';
        if (md && md !== message && md !== lastMd) {
          lastMd = md;
          lastContentChange = Date.now();
          source.postMessage({ type: 'tf-stream', id: id, content: md }, '*'); // live
        }
        // Solange sichtbar laeuft, KEINE Idle-Zeit aufbauen (deckt serverseitige
        // Denk-/Stream-Pausen, in denen der Inhalt kurz stillsteht).
        if (isRunning()) lastContentChange = Date.now();

        var idle = Date.now() - lastContentChange;
        // Finalisieren erst, wenn Antwort vorhanden, nichts mehr laeuft und genug
        // Idle-Zeit verstrich. Bei leerer Antwort (Thinking-Phase vor dem ersten
        // Token) NIE finalisieren. Kurz-Inhalt-Schutz: ein verdaechtig kurzes
        // lastMd (z. B. "Starte…") bekommt das doppelte Fenster, damit das echte
        // (laengere) Resultat nach einer Denk-Pause noch nachkommen kann.
        var settle = lastMd.length < MIN_LEN ? SETTLE_MS * 2 : SETTLE_MS;
        if (lastMd && !isRunning() && idle >= settle) {
          finished = true;
          clearInterval(iv);
          setBadge('ready', 'Verbunden');
          // Diagnose-Netz: beim Finalisieren das Nachrichten-Roster loggen (Anzahl,
          // je User/Assistant + erste 30 Zeichen) + was gewaehlt wurde. Falls doch
          // das Falsche zurueckkommt, zeigt die Konsole (F12) die echte Struktur —
          // kein Blind-Patchen mehr (z. B. ob `isUser` das Prompt-Echo erkennt).
          try {
            var dbgMsgs = qa(SEL.msg), roster = [];
            for (var dk = 0; dk < dbgMsgs.length; dk++) {
              roster.push((isUser(dbgMsgs[dk]) ? 'U' : 'A') + '#' + dk + ':'
                + (contentOf(dbgMsgs[dk]) || '').slice(0, 30).replace(/\s+/g, ' '));
            }
            console.log('[TeamFlow-Bridge] finalize — ' + dbgMsgs.length + ' msgs:', roster,
              '| gewaehlt:', (lastMd || '').slice(0, 60));
          } catch (e) { /* ignore */ }
          extractThinking(cand, function (reasoning) {
            var msg = { type: 'tf-response', id: id, result: lastMd };
            if (reasoning) msg.reasoning = reasoning;
            source.postMessage(msg, '*');
          });
          return;
        }
        if (Date.now() - started >= MAX_MS) {
          finished = true;
          clearInterval(iv);
          setBadge(lastMd ? 'ready' : 'error', lastMd ? 'Verbunden' : 'Zeitüberschreitung');
          source.postMessage({ type: 'tf-response', id: id,
            result: lastMd || 'Zeitüberschreitung: Keine Antwort von der internen KI' }, '*');
        }
      }, POLL_MS);
    }, 200);
  }

  // ── Chat-Reset (frischer Kontext) ─────────────────────────────────────────
  // Klickt den „Neuer Chat"/„Zurücksetzen"-Button der Streamlit-App, damit ein
  // KI-Lauf nicht den alten Chat-Verlauf als Kontext mitschleppt. Strategie wie
  // im alten ZIM-Bookmarklet: erst Reset-Symbol, dann Reset-Text. Die EIGENE
  // Bridge-Leiste (#tf-bridge-bar) wird ausgeschlossen, damit wir nicht unseren
  // „ZAH-App testen"-Button klicken. Best-effort: liefert found=true/false.
  function resetChat() {
    var bar = document.getElementById('tf-bridge-bar');
    var allBtns = document.querySelectorAll('button');
    // Strategie 1: Button mit Reset-Symbol.
    for (var i = 0; i < allBtns.length; i++) {
      if (bar && bar.contains(allBtns[i])) continue;
      var t = (allBtns[i].textContent || '').trim();
      if (t === '⟳' || t === '↻' || t === '🔄') { allBtns[i].click(); return true; }
    }
    // Strategie 2: Button mit Reset-Text.
    var texts = ['zurücksetzen', 'reset', 'clear', 'neu starten', 'neuer chat', 'new chat'];
    for (var k = 0; k < allBtns.length; k++) {
      if (bar && bar.contains(allBtns[k])) continue;
      var lt = (allBtns[k].textContent || '').toLowerCase();
      for (var j = 0; j < texts.length; j++) {
        if (lt.indexOf(texts[j]) !== -1) { allBtns[k].click(); return true; }
      }
    }
    return false;
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || !data.type) return;

    if (data.type === 'tf-ping') {
      setBadge('ready', 'Verbunden');
      event.source.postMessage({ type: 'tf-pong' }, '*');
      return;
    }
    if (data.type === 'tf-reset') {
      var found = false;
      try { found = resetChat(); } catch (e) { found = false; }
      setBadge(found ? 'ready' : 'working', found ? 'Chat zurückgesetzt' : 'Kein Reset-Button');
      // Kurz auf den Streamlit-Rerun warten, dann bestätigen.
      setTimeout(function () {
        event.source.postMessage({ type: 'tf-reset-done', id: data.id, found: found }, '*');
      }, 500);
      return;
    }
    if (data.type === 'tf-request') {
      runRequest(event.source, data.id, String(data.message || ''));
      return;
    }
  });
})();
