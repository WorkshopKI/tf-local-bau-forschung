// TeamFlow Streamlit Bridge — Bookmarklet
// Wird vom Nutzer EINMAL pro Streamlit-Tab geklickt (Black-Box-UI, die wir
// nicht kontrollieren — unter file:// koennen wir kein JS in den fremden Tab
// injizieren, das Bookmarklet ist der vom Nutzer autorisierte Weg).
// Spricht via postMessage mit dem StreamlitBridgeTransport unserer App:
//   tf-ping   -> tf-pong
//   tf-request {id, message} -> tf-response {id, result}
// Antwort wird per DOM-Scrape aus der Chat-UI geholt (siehe Haertung unten).
(function () {
  if (window.__teamflowBridge) return;
  window.__teamflowBridge = true;

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
  function contentOf(m) {
    for (var i = 0; i < SEL.content.length; i++) {
      var c = m.querySelector(SEL.content[i]);
      if (c) return (c.textContent || '').trim();
    }
    return (m.textContent || '').trim();
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

  // Status-Badge (oben rechts) — bewusst klein, kein GUI-Overlay. Toene aus dem
  // TeamFlow-Design-System (badge.tsx / theme.css): weiche Pastell-Flaeche +
  // dunkler Text gleicher Tonart, kein greller Vollton. Werte als Literale, weil
  // die fremde KI-Seite die CSS-Variablen (var(--tf-*)) nicht kennt.
  var TONES = {
    ready:   { bg: 'hsl(145, 60%, 94%)', fg: 'hsl(145, 60%, 30%)' }, // success
    working: { bg: 'hsl(38, 90%, 93%)',  fg: 'hsl(38, 70%, 30%)' },  // warning
    error:   { bg: 'hsl(0, 70%, 95%)',   fg: 'hsl(0, 60%, 38%)' },   // danger
  };
  var badge = document.createElement('div');
  badge.id = 'tf-bridge-badge';
  badge.style.cssText = 'position:fixed;top:8px;right:8px;z-index:99999;padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:400;font-family:sans-serif;background:' + TONES.ready.bg + ';color:' + TONES.ready.fg + ';';
  badge.textContent = 'Interne KI';
  document.body.appendChild(badge);
  function setBadge(tone, text) {
    var t = TONES[tone] || TONES.ready;
    badge.style.background = t.bg;
    badge.style.color = t.fg;
    badge.textContent = text || 'Interne KI';
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || !data.type) return;

    if (data.type === 'tf-ping') {
      setBadge('ready', 'Verbunden');
      event.source.postMessage({ type: 'tf-pong' }, '*');
      return;
    }

    if (data.type === 'tf-request') {
      setBadge('working', 'Arbeitet…');
      var id = data.id;
      var message = String(data.message || '');

      var ta = q1(SEL.textarea);
      if (!ta) {
        setBadge('error', 'Fehler');
        event.source.postMessage({ type: 'tf-response', id: id, result: 'Eingabefeld der internen KI nicht gefunden' }, '*');
        return;
      }

      var baseline = qa(SEL.msg).length;
      setValue(ta, message);

      setTimeout(function () {
        submit(ta);
        var attempts = 0;
        var maxAttempts = 240; // 240 * 500ms = 120s
        var last = '';
        var stable = 0;
        var needStable = 3; // ~1.5s unveraendert = Streaming fertig
        var iv = setInterval(function () {
          attempts++;
          var msgs = qa(SEL.msg);
          if (msgs.length > baseline) {
            // Letzte ASSISTENT-Nachricht (User-Echo ueberspringen).
            var cand = null;
            for (var i = msgs.length - 1; i >= 0; i--) {
              if (!isUser(msgs[i])) { cand = msgs[i]; break; }
            }
            if (cand) {
              var txt = contentOf(cand);
              if (txt && txt !== message) {
                if (txt === last) { stable++; } else { stable = 0; last = txt; }
                if (stable >= needStable) {
                  clearInterval(iv);
                  setBadge('ready', 'Verbunden');
                  event.source.postMessage({ type: 'tf-response', id: id, result: txt }, '*');
                  return;
                }
              }
            }
          }
          if (attempts >= maxAttempts) {
            clearInterval(iv);
            setBadge('error', 'Zeitüberschreitung');
            event.source.postMessage({ type: 'tf-response', id: id, result: 'Zeitüberschreitung: Keine Antwort von der internen KI' }, '*');
          }
        }, 500);
      }, 200);
    }
  });
})();
