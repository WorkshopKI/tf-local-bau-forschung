// TeamFlow Streamlit Bridge — Bookmarklet
// Wird vom Nutzer EINMAL pro Streamlit-Tab geklickt (Black-Box-UI, die wir
// nicht kontrollieren — unter file:// koennen wir kein JS in den fremden Tab
// injizieren, das Bookmarklet ist der vom Nutzer autorisierte Weg).
// Spricht via postMessage mit dem StreamlitBridgeTransport unserer App:
//   tf-ping     -> tf-pong
//   tf-app-ping <- (App antwortet tf-app-pong; Gegenrichtungs-Test)
//   tf-request {id, message, ziel?, erwarte?} -> tf-progress {id}* + tf-stream {id, content}*
//                                   -> tf-response {id, result, reasoning?}
// `erwarte` (optional): Abschluss-Marker — finalisiert nicht auf dem kurzen SETTLE-
// Fenster, solange die Antwort diesen Text nicht enthaelt (Schutz gegen zu fruehen
// Abbruch langer, zweiteiliger Antworten).
// `ziel` ('standard'|'agentisch') schaltet optional den Streamlit-Tab um
// (Zweit-LLM „Agentischer Chat"); ohne `ziel` bleibt der aktive Tab.
// tf-progress ist ein ~10-s-Heartbeat waehrend des Laufs (App-Idle-Timeout).
// Antwort wird per DOM-Scrape als MARKDOWN aus der Chat-UI geholt (htmlToMd),
// live gestreamt und erst finalisiert, wenn das Streamlit-Skript idle ist.
(function () {
  if (window.__teamflowBridge) return;
  window.__teamflowBridge = true;

  // Versions-Marker: bei JEDER Aenderung an diesem Snippet bumpen. So laesst sich im
  // KI-Tab pruefen, ob das NEUE Bookmarklet laeuft (haeufigste Support-Frage): Maus
  // ueber das Status-Badge (Tooltip) ODER `window.__teamflowBridgeRev` in der Konsole
  // ODER die Log-Zeile beim Aktivieren.
  var BRIDGE_REV = '2026-07-13-tail';
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
    // Spinner-Fallbacks (v2.203): stStatusWidget verschwindet in manchen
    // Embed-/Toolbar-Modi — der Chat-„Denk"-Spinner deckt diese Faelle. Nicht
    // generischer werden (stuck-true-Risiko; HARD_MAX_MS ist der Backstop).
    running: ['[data-testid="stStatusWidget"]', 'button[data-testid="stChatInputStopButton"]',
      '[data-testid="stSpinner"]', '.stSpinner'],
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
  function isVisible(el) {
    if (!el) return false;
    if (el.offsetParent !== null) return true;
    // position:fixed-Elemente haben offsetParent null → ueber Client-Rects
    // pruefen (display:none liefert keine Rects).
    return !!(el.getClientRects && el.getClientRects().length > 0);
  }
  // Sichtbarkeits-bevorzugte Varianten von q1/qa (v2.203): Streamlit-Tabs halten
  // ggf. BEIDE Chat-Panels im DOM — globale Queries wuerden ins versteckte Panel
  // greifen (Cross-Tab-Bleed). q1v sucht erst ALLE Selektoren nach einem
  // sichtbaren Treffer ab (ein sichtbarer generischer Treffer schlaegt einen
  // versteckten spezifischen); findet sich keiner, faellt es auf den ersten
  // Treffer ueberhaupt zurueck (Regression-Guard: degradiert schlimmstenfalls
  // aufs alte Verhalten, nie auf „nichts gefunden").
  function q1v(list) {
    var fallback = null;
    for (var i = 0; i < list.length; i++) {
      var els = document.querySelectorAll(list[i]);
      for (var j = 0; j < els.length; j++) {
        if (isVisible(els[j])) return els[j];
        if (!fallback) fallback = els[j];
      }
    }
    return fallback;
  }
  // Optionales `root` scoped die Suche (z. B. aufs Tab-Panel des Ziel-Chats) —
  // ohne root wie bisher dokumentweit.
  function qav(list, root) {
    var r = root || document;
    for (var i = 0; i < list.length; i++) {
      var els = r.querySelectorAll(list[i]);
      if (!els.length) continue;
      var vis = [];
      for (var j = 0; j < els.length; j++) { if (isVisible(els[j])) vis.push(els[j]); }
      return vis.length ? vis : Array.prototype.slice.call(els);
    }
    return [];
  }
  // Tab-Panel-Scope einer textarea (Prod-Dump 2026-07-09: BEIDE Chat-Panels
  // bleiben gemountet). Nachrichten-Queries werden darauf gescoped, damit der
  // Scrape auch beim manuellen Tab-Wechsel MITTEN im Lauf am richtigen Chat
  // bleibt: Panel unsichtbar → qav-Sichtbarkeits-Fallback liefert trotzdem die
  // Panel-EIGENEN Nachrichten, nie die des anderen Chats. Kein Panel gefunden
  // → document (bisheriges Verhalten).
  function panelScopeOf(ta) {
    if (!ta || !ta.closest) return document;
    return ta.closest('[data-testid="stTabPanel"]') || ta.closest('[role="tabpanel"]') || document;
  }
  function isUser(m) {
    return !!m.querySelector('img[alt*="user"]');
  }
  // Inhaltsbasierte Echo-Erkennung — Stufe-2-Fallback in findAnswerMsg, wenn die
  // Avatar-Heuristik (isUser) nach einem UI-Umbau KEIN Prompt-Echo mehr findet.
  // WORTGLEICH gespiegelt in echo-match.ts (Drift-Test: echo-match.test.ts).
  // <echo-match-core> keep in sync with echo-match.ts
  function normForEcho(s) {
    return String(s || '').normalize('NFC').toLowerCase().replace(/[^a-z0-9äöüß]/g, '').slice(0, 64);
  }
  function isEchoText(msgText, promptText) {
    var np = normForEcho(promptText);
    if (!np) return false;
    var nm = normForEcho(msgText);
    if (np.length < 12) return nm === np;
    return nm.indexOf(np) === 0;
  }
  // </echo-match-core>
  function setValue(ta, val) {
    // React/Streamlit hoert auf den nativen value-Setter + input-Event.
    var setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, val);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function submit(ta) {
    // Submit-Button zuerst im EIGENEN Chat-Input-Container der textarea suchen —
    // bei zwei gemounteten Chat-Panels (Tabs) traefe eine globale Suche sonst den
    // Button des falschen Panels. OHNE Container KEIN dokumentweiter Erst-Treffer
    // (waere in DOM-Ordnung der ggf. versteckte Standard-Button), sondern direkt
    // der sichtbarkeits-bevorzugte q1v-Fallback.
    var scope = (ta.closest && (ta.closest('[data-testid="stChatInput"]') || ta.closest('.stChatInput'))) || null;
    var b = null;
    if (scope) {
      for (var i = 0; i < SEL.submit.length && !b; i++) b = scope.querySelector(SEL.submit[i]);
    }
    if (!b) b = q1v(SEL.submit);
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
    // Primaer (v2.203.2): Streamlit stempelt den Skript-Zustand als Attribut auf
    // den App-Root — UI-unabhaengig. Noetig, weil AitisiGPT das Status-Widget
    // per CSS ausblendet (Prod-Dump 2026-07-09: WAEHREND der Generierung war
    // KEIN Lauf-Indikator sichtbar → lange Agent-Reasoning-Pausen haetten
    // verfrueht finalisiert). Fehlt das Attribut (andere Streamlit-Version),
    // greifen die sichtbaren Indikatoren unten wie bisher; Stuck-true-Backstop
    // bleibt HARD_MAX_MS.
    if (document.querySelector('[data-testid="stApp"][data-test-script-state="running"]')) return true;
    for (var i = 0; i < SEL.running.length; i++) {
      var els = document.querySelectorAll(SEL.running[i]);
      for (var j = 0; j < els.length; j++) {
        if (isVisible(els[j])) return true;
      }
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

  // ── Status-Badge (unten rechts) ───────────────────────────────────────────
  // Toene aus dem TeamFlow-Design-System (badge.tsx / theme.css). Werte als
  // Literale, weil die fremde KI-Seite die CSS-Variablen nicht kennt.
  var TONES = {
    ready:   { bg: 'hsl(145, 60%, 94%)', fg: 'hsl(145, 60%, 30%)' }, // success
    working: { bg: 'hsl(38, 90%, 93%)',  fg: 'hsl(38, 70%, 30%)' },  // warning
    error:   { bg: 'hsl(0, 70%, 95%)',   fg: 'hsl(0, 60%, 38%)' },   // danger
  };
  // Fixierte Leiste UNTEN rechts: EINE dezente Status-Pill (v2.212).
  // Unten statt oben (v2.203): oben rechts sitzt der Streamlit-Header-/Status-
  // Bereich der fremden KI-Seite — dort wurde die Leiste wiederholt ueberdeckt.
  // right:220px statt 12px (v2.212): Chrome zeichnet seine Bildschirmfreigabe-
  // Anzeige unten rechts (ausserhalb der Seite, nicht messbar) — die Pill wird
  // nach links eingerueckt, damit sie frei daneben sitzt.
  // z-index am Maximum (2147483647): die fremde KI-Seite hat Container mit hohem
  // eigenem Stacking-Context, die `z-index:99999` ueberdeckt haetten (Leiste war
  // im DOM + funktional, aber unsichtbar).
  var BAR_CSS = 'position:fixed;bottom:12px;right:220px;z-index:2147483647;display:flex;gap:6px;align-items:center;';
  var bar = document.createElement('div');
  bar.id = 'tf-bridge-bar';
  bar.style.cssText = BAR_CSS;
  document.body.appendChild(bar);
  // Watchdog (v2.203): haelt die Leiste sichtbar, egal was die KI-Seite umbaut —
  // (a) re-append, wenn ein Umbau sie entfernt hat; (b) ans body-ENDE ruecken,
  // damit sie bei z-index-Gleichstand die Paint-Order gewinnt; (c) Inline-Styles
  // re-asserten. Verglichen wird gegen die BROWSER-normalisierte cssText-Fassung
  // (nie gegen das Literal — der Browser formatiert Inline-Styles um).
  var BAR_CSS_NORM = bar.style.cssText;
  setInterval(function () {
    try {
      if (!bar.isConnected) { document.body.appendChild(bar); return; }
      if (document.body.lastElementChild !== bar) document.body.appendChild(bar);
      if (bar.style.cssText !== BAR_CSS_NORM) bar.style.cssText = BAR_CSS;
    } catch (e) { /* ignore */ }
  }, 4000);

  // Dezente Status-Pill (v2.212): EIN Element statt Badge + zwei Test-Buttons.
  // Farbiger Punkt (Ton) + neutraler Text auf hellem Grund — faellt in der fremden
  // KI-Seite nicht auf, zeigt aber im Zeitverlauf alle Zustaende (Verbunden /
  // Pruefe ZAH-App… / ZAH App erreichbar / Chat-Test laeuft… / Arbeitet… / Fehler).
  // Klick loest beide Selbsttests erneut aus (ersetzt die frueheren Test-Buttons).
  var PILL_CSS = 'display:inline-flex;align-items:center;gap:6px;padding:4px 11px;'
    + 'border-radius:9999px;font-size:11px;font-weight:400;font-family:sans-serif;'
    + 'background:#fff;color:hsl(0,0%,25%);border:1px solid hsl(0,0%,88%);'
    + 'box-shadow:0 1px 3px rgba(0,0,0,.12);opacity:.85;cursor:pointer;'
    + 'transition:opacity .15s;user-select:none;';
  var badge = document.createElement('div');
  badge.id = 'tf-bridge-badge';
  badge.style.cssText = PILL_CSS;
  badge.title = 'TeamFlow-Bridge ' + BRIDGE_REV + ' — Klicken: Verbindung neu pruefen';
  var dot = document.createElement('span');
  dot.style.cssText = 'width:8px;height:8px;border-radius:9999px;flex:none;background:' + TONES.ready.fg + ';';
  var label = document.createElement('span');
  label.textContent = 'Interne KI';
  badge.appendChild(dot);
  badge.appendChild(label);
  bar.appendChild(badge);
  badge.addEventListener('mouseenter', function () { badge.style.opacity = '1'; });
  badge.addEventListener('mouseleave', function () { badge.style.opacity = '.85'; });
  // Setzt Punkt-Farbe (Ton) + Text; die Pill-Flaeche bleibt neutral (dezent).
  function setBadge(tone, text) {
    var t = TONES[tone] || TONES.ready;
    dot.style.background = t.fg;
    label.textContent = text || 'Interne KI';
  }

  // ZAH-App-Erreichbarkeit (Gegenrichtung): prueft, ob das oeffnende App-Fenster
  // (window.opener) antwortet → Pill zeigt „ZAH App erreichbar".
  function runAppReachTest() {
    if (!window.opener) { setBadge('error', 'Kein App-Fenster'); return; }
    setBadge('working', 'Prüfe ZAH-App…');
    var done = false;
    function onPong(e) {
      if (e.data && e.data.type === 'tf-app-pong') {
        done = true;
        setBadge('ready', 'ZAH App erreichbar');
        window.removeEventListener('message', onPong);
      }
    }
    window.addEventListener('message', onPong);
    window.opener.postMessage({ type: 'tf-app-ping' }, '*');
    setTimeout(function () {
      if (!done) { setBadge('error', 'ZAH App nicht erreichbar'); window.removeEventListener('message', onPong); }
    }, 3000);
  }

  // Klick auf die Pill: beide Selbsttests erneut ausloesen (manueller Fallback,
  // ersetzt die frueheren „ZAH-App testen"/„Chat-Test"-Buttons). „Chat-Test"
  // (runSelfTest) schickt eine harmlose Rechenfrage durch den ECHTEN Scrape-Pfad
  // und erkennt so eine geaenderte KI-Oberflaeche.
  badge.addEventListener('click', function () {
    if (!window.opener) { setBadge('error', 'Tab aus der App öffnen'); return; }
    runAppReachTest();
    setTimeout(function () { runSelfTest(); }, 300);
  });

  // Beim Aktivieren dem oeffnenden App-Fenster Bescheid geben → die App
  // uebernimmt das Fenster-Handle (event.source) und kann zuverlaessig pingen,
  // ohne den Tab per window.open neu zu laden. Kein opener (manuell geoeffnet
  // oder COOP) → klarer Hinweis.
  if (window.opener) {
    try { window.opener.postMessage({ type: 'tf-bridge-ready' }, '*'); } catch (e) { /* ignore */ }
    // Auto-Selbsttest direkt nach dem Aktivieren → der Nutzer sieht „ZAH App
    // erreichbar", ohne selbst klicken zu muessen. Kleiner Versatz, damit das
    // opener-Fenster sicher bereit ist. Ein Klick auf die Pill loest beide
    // Selbsttests manuell erneut aus.
    setTimeout(function () { runAppReachTest(); }, 300);
    // Chat-Selbsttest: unauffaelliger Rundlauf durch den ECHTEN Scrape-Pfad, damit eine
    // geaenderte KI-Oberflaeche sofort beim Start auffaellt (raeumt danach per Reset auf).
    setTimeout(function () { runSelfTest(); }, 1500);
  } else {
    setBadge('error', 'Tab aus der App öffnen');
  }

  // Antwort-Nachricht im Chat-DOM finden: die ERSTE Assistant-Nachricht NACH unserem
  // Prompt-Echo (der letzten User-Nachricht) — NICHT die letzte. AitisiGPT haengt NACH
  // der Antwort noch eine kanned Folge-Begruessung an; DOM-Roster real:
  //   [0] Begruessung · [1] User-Prompt · [2] Antwort · [3] Folge-Begruessung
  // Die erste nach dem Echo ist die Antwort; [0] steht davor, [3] danach — beide raus.
  // Geteilt von runRequest UND runSelfTest (damit der Selbsttest denselben Pfad prueft).
  //
  // Die reine Index-Auswahl steht zwischen den Sync-Markern unten und ist WORTGLEICH
  // in answer-selection.ts gespiegelt (das Bookmarklet muss standalone bleiben:
  // ?raw-Inlining → kein Import). Der Drift-Test (answer-selection.test.ts) extrahiert
  // `selectAnswerIndex` zwischen den Markern und laesst sie gegen dieselben Fixtures wie
  // die TS-Fassung laufen. Aenderung hier = Aenderung dort.
  // <answer-selection-core> keep in sync with answer-selection.ts
  function selectAnswerIndex(flags) {
    var lastUser = -1;
    for (var i = flags.length - 1; i >= 0; i--) {
      if (flags[i]) { lastUser = i; break; } // Index unseres Prompt-Echos
    }
    if (lastUser < 0) return -1; // Prompt-Echo nicht gefunden → nicht raten
    for (var j = lastUser + 1; j < flags.length; j++) {
      if (!flags[j]) return j; // erste Nicht-User-Nachricht danach
    }
    return -1;
  }
  // </answer-selection-core>
  // Zweistufig (v2.203): Stufe 1 = bewaehrte Avatar-Heuristik (unveraendert).
  // NUR wenn sie GAR KEIN Prompt-Echo findet (UI-Drift am Avatar-Markup — die
  // Fehlerklasse hinter „Ende der Response nicht erkannt"), markiert Stufe 2 das
  // Echo ueber den gesendeten Text selbst (isEchoText) und waehlt erneut.
  // Bewusst NICHT inhalts-primaer: eine Antwort, die mit einem Prompt-Zitat
  // beginnt, wuerde sonst faelschlich zum Anker.
  function findAnswerMsg(message, root) {
    var msgs = qav(SEL.msg, root), flags = [], k;
    for (k = 0; k < msgs.length; k++) flags.push(isUser(msgs[k]));
    var idx = selectAnswerIndex(flags);
    if (idx < 0 && message) {
      for (k = 0; k < msgs.length; k++) {
        if (!flags[k] && isEchoText(msgs[k].textContent || '', message)) flags[k] = true;
      }
      idx = selectAnswerIndex(flags);
    }
    return idx < 0 ? null : msgs[idx];
  }

  // ── Ziel-Routing (Zweit-LLM „Agentischer Chat", Erprobung) ────────────────
  // tf-request/tf-reset koennen ein optionales `ziel` tragen:
  //   'standard'  → Tab „Chat" (klassisches AitisiGPT)
  //   'agentisch' → Tab „Agentischer Chat" (Qwen-Agent, groesserer Kontext)
  // Ohne `ziel` bleibt ALLES beim bisherigen Verhalten (aktiver Tab) — alte
  // App-Builds funktionieren gegen dieses Snippet und umgekehrt. Tab-lose
  // Oberflaechen: 'standard' laeuft ohne Tab weiter, 'agentisch' meldet Fehler.
  var TAB_SELECTOR = 'button[role="tab"], [data-baseweb="tab"]';
  var TAB_SWITCH_TIMEOUT_MS = 10000;
  function tabMatches(ziel, text) {
    if (ziel === 'agentisch') return /agentisch/i.test(text);
    // 'standard': ein Chat-Tab, der NICHT der agentische ist (Labels real:
    // „Chat" vs. „Agentischer Chat"; Anker/Wortgrenzen waeren gegen Icons bruechig).
    if (ziel === 'standard') return /chat/i.test(text) && !/agentisch/i.test(text);
    return false;
  }
  function findTabButton(ziel) {
    var tabs = document.querySelectorAll(TAB_SELECTOR);
    for (var i = 0; i < tabs.length; i++) {
      var t = (tabs[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (tabMatches(ziel, t)) return tabs[i];
    }
    return null;
  }
  function ensureZiel(ziel, cb) {
    if (!ziel) { cb(null); return; }
    var tab = findTabButton(ziel);
    if (!tab) {
      // Kein Tab-UI: 'standard' = bisheriges Verhalten; 'agentisch' braucht den Tab.
      cb(ziel === 'agentisch'
        ? 'Tab "Agentischer Chat" nicht gefunden — Oberflaeche der internen KI geaendert?'
        : null);
      return;
    }
    if (tab.getAttribute('aria-selected') !== 'true') tab.click();
    var t0 = Date.now();
    (function waitInput() {
      var ta = q1v(SEL.textarea);
      if (ta && isVisible(ta)) { cb(null); return; }
      if (Date.now() - t0 >= TAB_SWITCH_TIMEOUT_MS) {
        cb('Eingabefeld fuer Ziel "' + ziel + '" nicht gefunden');
        return;
      }
      setTimeout(waitInput, 400);
    })();
  }

  // ── Anfrage-Engine: einfuegen → absenden → live streamen → finalisieren ────
  function runRequest(source, id, message, ziel, erwarte) {
    setBadge('working', 'Arbeitet…');
    ensureZiel(ziel, function (zielErr) {
      if (zielErr) {
        setBadge('error', 'Fehler');
        source.postMessage({ type: 'tf-response', id: id, result: zielErr }, '*');
        return;
      }
      var ta = q1v(SEL.textarea);
      if (!ta) {
        setBadge('error', 'Fehler');
        source.postMessage({ type: 'tf-response', id: id, result: 'Eingabefeld der internen KI nicht gefunden' }, '*');
        return;
      }
      // Nachrichten-Roster ans Tab-Panel der Ziel-textarea binden (s. panelScopeOf).
      var msgScope = panelScopeOf(ta);
      setValue(ta, message);

      setTimeout(function () {
        submit(ta);
        // SETTLE_MS = Idle-Fenster vor dem Finalisieren. Grosszuegig (5 s), damit
        // Thinking-Modelle (Reasoning immer an) eine Denk-Pause zwischen erstem Token
        // und der eigentlichen Antwort ueberleben — sonst finalisiert die Bridge zu
        // frueh mit einem kurzen Partial (z. B. "Starte…"). MIN_LEN: solange die
        // Antwort verdaechtig kurz ist, ein doppelt so langes Fenster verlangen.
        //
        // Deadlines PROGRESS-bewusst statt absolut (v2.203): der alte 180-s-Deckel
        // kappte unter Server-Last auch noch WACHSENDE Antworten. NO_PROGRESS_MS
        // greift nur, wenn sich weder Inhalt noch sichtbarer Lauf-Indikator ruehren
        // (beide resetten lastContentChange); HARD_MAX_MS ist der absolute Backstop
        // gegen einen stuck-true isRunning()-Indikator.
        var POLL_MS = 400, SETTLE_MS = 5000, MIN_LEN = 40;
        var NO_PROGRESS_MS = 150000, HARD_MAX_MS = 600000;
        // Abschluss-Marker-Schutz: Gibt die App einen `erwarte`-Marker mit (die Antwort
        // ist erst vollstaendig, wenn sie diesen Text enthaelt, z. B. "Finaler Text"),
        // finalisieren wir NICHT auf dem kurzen SETTLE-Fenster, solange der Marker fehlt —
        // sonst schneidet ein langer, zweiteiliger Lauf (grosser erster Abschnitt, Pause,
        // dann der Schluss-Abschnitt) den Schluss ab, wenn isRunning() in der Pause faelsch-
        // lich false liest. Bis MISSING_TAIL_MS Idle-Zeit warten, dann mit dem Stand
        // finalisieren (fail-open); die 150-/600-s-Backstops bleiben unveraendert.
        var MISSING_TAIL_MS = 45000;
        var PROGRESS_EVERY_TICKS = 25; // 25 × 400 ms ≈ 10 s Heartbeat an die App
        var started = Date.now(), lastMd = '', finished = false, tick = 0;
        // Finalisierungs-Timer haengt an der INHALTS-Stabilitaet der Assistenten-
        // Antwort, nicht an globaler DOM-Aktivitaet: die fremde KI-Seite mutiert
        // ihren DOM auch generierungs-unabhaengig (Status-Widget, Reruns) — das
        // verhinderte (seit SETTLE_MS 2500->5000) das Finalisieren, obwohl die
        // Antwort laengst vollstaendig war. `lastContentChange` wird nur von echten
        // Antwort-Aenderungen + laufendem `isRunning()` (Pausen-Schutz) beruehrt.
        var lastContentChange = Date.now();

        // Diagnose-Netz: Nachrichten-Roster loggen (Anzahl, je User/Assistant +
        // Echo-Flag `~E` + erste 30 Zeichen) + was gewaehlt wurde. Laeuft beim
        // Finalisieren UND beim Timeout — gerade dort braucht man die echte
        // DOM-Struktur in der Konsole (F12), statt blind zu patchen.
        function logRoster(tag, chosen) {
          try {
            var dbgMsgs = qav(SEL.msg, msgScope), roster = [];
            for (var dk = 0; dk < dbgMsgs.length; dk++) {
              var fl = isUser(dbgMsgs[dk]) ? 'U' : 'A';
              if (isEchoText(dbgMsgs[dk].textContent || '', message)) fl += '~E';
              roster.push(fl + '#' + dk + ':'
                + (contentOf(dbgMsgs[dk]) || '').slice(0, 30).replace(/\s+/g, ' '));
            }
            console.log('[TeamFlow-Bridge] ' + tag + ' — ' + dbgMsgs.length + ' msgs:', roster,
              '| gewaehlt:', (chosen || '').slice(0, 60));
          } catch (e) { /* ignore */ }
        }

        var iv = setInterval(function () {
          if (finished) return;
          tick++;
          // Heartbeat: auch OHNE Inhalt (Server-Queue vor dem ersten Token) weiss
          // die App, dass der Lauf lebt — ihr Idle-Timeout resettet auf tf-progress.
          if (tick % PROGRESS_EVERY_TICKS === 0) {
            source.postMessage({ type: 'tf-progress', id: id }, '*');
          }
          var cand = findAnswerMsg(message, msgScope);
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
          // Erwarteter Schluss-Abschnitt (erwarte) noch nicht in der Antwort → nicht auf
          // dem kurzen Fenster finalisieren; dem Rest bis MISSING_TAIL_MS Zeit geben.
          // Kommt der Text, erfasst ihn der naechste Tick → Marker vorhanden → normales
          // settle → voller Text. Fail-open: erscheint der Marker nie, finalisieren wir
          // nach MISSING_TAIL_MS mit dem Stand (nie schlechter als ohne Marker).
          var unvollstaendig = !!erwarte && !!lastMd
            && lastMd.toLowerCase().indexOf(erwarte.toLowerCase()) === -1;
          var reif = idle >= settle && (!unvollstaendig || idle >= MISSING_TAIL_MS);
          if (lastMd && !isRunning() && reif) {
            finished = true;
            clearInterval(iv);
            setBadge('ready', 'Verbunden');
            logRoster('finalize idle=' + idle + ' settle=' + settle
              + (erwarte ? ' erwarte=' + (unvollstaendig ? 'FEHLT' : 'ok') : ''), lastMd);
            extractThinking(cand, function (reasoning) {
              var msg = { type: 'tf-response', id: id, result: lastMd };
              if (reasoning) msg.reasoning = reasoning;
              source.postMessage(msg, '*');
            });
            return;
          }
          if (idle >= NO_PROGRESS_MS || Date.now() - started >= HARD_MAX_MS) {
            finished = true;
            clearInterval(iv);
            logRoster('timeout ' + (idle >= NO_PROGRESS_MS ? 'no-progress' : 'hard-max')
              + ' idle=' + idle + (erwarte ? ' erwarte=' + (lastMd && lastMd.toLowerCase().indexOf(erwarte.toLowerCase()) === -1 ? 'FEHLT' : 'ok') : ''), lastMd);
            setBadge(lastMd ? 'ready' : 'error', lastMd ? 'Verbunden' : 'Zeitüberschreitung');
            source.postMessage({ type: 'tf-response', id: id,
              result: lastMd || 'Zeitüberschreitung: Keine Antwort von der internen KI' }, '*');
          }
        }, POLL_MS);
      }, 200);
    });
  }

  // ── Chat-Selbsttest (Start-Rundlauf + „Chat-Test"-Knopf) ─────────────────
  // Schickt EINE harmlose, variierende Rechenfrage durch denselben Scrape-Pfad wie
  // echte Anfragen (findAnswerMsg + contentOf) und prueft, ob die Antwort die erwartete
  // Summe enthaelt. So faellt eine geaenderte AitisiGPT-Oberflaeche (Selektor/Reihenfolge/
  // neue Zwischennachricht) SOFORT beim Start auf — statt spaeter als stille Fehl-
  // klassifizierung. Unauffaellig fuers Server-Log: sieht wie ein trivialer Verbindungs-
  // test aus. Raeumt danach per „Neuer Chat" auf. (resetChat ist per Hoisting sichtbar.)
  var selfTestRunning = false;
  function runSelfTest() {
    if (selfTestRunning) return;
    var ta = q1v(SEL.textarea);
    if (!ta) { setBadge('error', 'Chat-Test: kein Eingabefeld'); return; }
    var msgScope = panelScopeOf(ta);
    selfTestRunning = true;
    var a = 10 + Math.floor(Math.random() * 80);
    var b = 10 + Math.floor(Math.random() * 80);
    var erwartet = String(a + b);
    var frage = 'Was ist ' + a + ' + ' + b + '?';
    setBadge('working', 'Chat-Test läuft…');
    setValue(ta, frage);
    setTimeout(function () {
      submit(ta);
      var started = Date.now(), lastMd = '', lastChange = Date.now(), done = false;
      var iv = setInterval(function () {
        if (done) return;
        var cand = findAnswerMsg(frage, msgScope);
        var md = cand ? contentOf(cand) : '';
        if (md && md !== frage && md !== lastMd) { lastMd = md; lastChange = Date.now(); }
        if (isRunning()) lastChange = Date.now();
        var settled = lastMd && !isRunning() && (Date.now() - lastChange) >= 4000;
        if (!settled && Date.now() - started < 60000) return; // weiter warten
        done = true;
        clearInterval(iv);
        var seen = (lastMd || '').replace(/\s+/g, ' ').trim();
        var ok = seen.indexOf(erwartet) !== -1;
        // "keine Antwort" (leer) vs. "falsche Antwort erkannt" (Oberflaeche geaendert)
        // getrennt melden, damit ein langsamer/getrennter Server nicht als UI-Aenderung
        // fehlgedeutet wird.
        var warnText = seen ? 'Chat-Test: Oberfläche evtl. geändert' : 'Chat-Test: keine Antwort';
        try {
          console.log('[TeamFlow-Bridge] Chat-Test ' + (ok ? 'OK' : 'FEHLGESCHLAGEN')
            + ' — Frage "' + frage + '", erwartet "' + erwartet + '", gesehen: "' + seen.slice(0, 100) + '"');
        } catch (e) { /* ignore */ }
        setBadge(ok ? 'ready' : 'working', ok ? 'Chat-Test OK' : warnText);
        // Aufraeumen: Test-Chat zuruecksetzen (frischer Kontext fuer echte Anfragen).
        setTimeout(function () {
          try { resetChat(); } catch (e) { /* ignore */ }
          setBadge(ok ? 'ready' : 'working', ok ? 'Verbunden' : warnText);
          selfTestRunning = false;
        }, 500);
      }, 400);
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
    // Strategie 1: Button mit Reset-Symbol. Unsichtbare Buttons (verstecktes
    // Tab-Panel) ueberspringen — sonst reseten wir den falschen Chat.
    for (var i = 0; i < allBtns.length; i++) {
      if (bar && bar.contains(allBtns[i])) continue;
      if (!isVisible(allBtns[i])) continue;
      var t = (allBtns[i].textContent || '').trim();
      if (t === '⟳' || t === '↻' || t === '🔄') { allBtns[i].click(); return true; }
    }
    // Strategie 2: Button mit Reset-Text. 'zuruecksetzen' (ue) zusaetzlich zur
    // Umlaut-Form — der Button des Agentischer-Chat-Tabs heisst real
    // „Chat zuruecksetzen" (ue-Schreibweise, matcht das ü-Muster NICHT).
    var texts = ['zurücksetzen', 'zuruecksetzen', 'reset', 'clear', 'neu starten', 'neuer chat', 'new chat'];
    for (var k = 0; k < allBtns.length; k++) {
      if (bar && bar.contains(allBtns[k])) continue;
      if (!isVisible(allBtns[k])) continue;
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
      // Optionales `ziel` (Zweit-LLM): erst den passenden Tab aktivieren, dann
      // den (sichtbaren) Reset-Button klicken.
      ensureZiel(typeof data.ziel === 'string' ? data.ziel : null, function (zielErr) {
        var found = false;
        if (!zielErr) {
          try { found = resetChat(); } catch (e) { found = false; }
        }
        setBadge(found ? 'ready' : 'working', found ? 'Chat zurückgesetzt' : 'Kein Reset-Button');
        // Kurz auf den Streamlit-Rerun warten, dann bestätigen.
        setTimeout(function () {
          event.source.postMessage({ type: 'tf-reset-done', id: data.id, found: found }, '*');
        }, 500);
      });
      return;
    }
    if (data.type === 'tf-request') {
      runRequest(event.source, data.id, String(data.message || ''),
        typeof data.ziel === 'string' ? data.ziel : null,
        typeof data.erwarte === 'string' ? data.erwarte : null);
      return;
    }
  });
})();
