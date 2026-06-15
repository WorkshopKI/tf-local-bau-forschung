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

  // Status-Badge (oben rechts) — bewusst klein, kein GUI-Overlay.
  var badge = document.createElement('div');
  badge.id = 'tf-bridge-badge';
  badge.style.cssText = 'position:fixed;top:8px;right:8px;z-index:99999;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:bold;color:#fff;background:#22c55e;font-family:sans-serif;';
  badge.textContent = 'TF Bridge';
  document.body.appendChild(badge);
  function setBadge(color, text) {
    badge.style.background = color;
    badge.textContent = text || 'TF Bridge';
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || !data.type) return;

    if (data.type === 'tf-ping') {
      setBadge('#22c55e', 'TF Connected');
      event.source.postMessage({ type: 'tf-pong' }, '*');
      return;
    }

    if (data.type === 'tf-request') {
      setBadge('#eab308', 'TF Working…');
      var id = data.id;
      var message = String(data.message || '');

      var ta = q1(SEL.textarea);
      if (!ta) {
        setBadge('#ef4444', 'TF Error');
        event.source.postMessage({ type: 'tf-response', id: id, result: 'Streamlit Chat-Input nicht gefunden' }, '*');
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
                  setBadge('#22c55e', 'TF Connected');
                  event.source.postMessage({ type: 'tf-response', id: id, result: txt }, '*');
                  return;
                }
              }
            }
          }
          if (attempts >= maxAttempts) {
            clearInterval(iv);
            setBadge('#ef4444', 'TF Timeout');
            event.source.postMessage({ type: 'tf-response', id: id, result: 'Timeout: Keine Antwort von Streamlit' }, '*');
          }
        }, 500);
      }, 200);
    }
  });
})();
