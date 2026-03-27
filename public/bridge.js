// TeamFlow Bridge — Bookmarklet for Streamlit
// Paste in Streamlit tab to enable AI bridge via postMessage
(function() {
  if (window.__teamflowBridge) return;
  window.__teamflowBridge = true;

  // Status badge
  var badge = document.createElement('div');
  badge.id = 'tf-bridge-badge';
  badge.style.cssText = 'position:fixed;top:8px;right:8px;z-index:99999;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:bold;color:white;background:#22c55e;';
  badge.textContent = 'TF Bridge';
  document.body.appendChild(badge);

  function setBadgeStatus(color, text) {
    badge.style.background = color;
    badge.textContent = text || 'TF Bridge';
  }

  window.addEventListener('message', function(event) {
    var data = event.data;
    if (!data || !data.type) return;

    // Ping/Pong
    if (data.type === 'tf-ping') {
      setBadgeStatus('#22c55e', 'TF Connected');
      event.source.postMessage({ type: 'tf-pong' }, '*');
      return;
    }

    // Chat request
    if (data.type === 'tf-request') {
      setBadgeStatus('#eab308', 'TF Working...');
      var id = data.id;
      var message = data.message;

      // Try to find Streamlit chat input and submit
      var textarea = document.querySelector('textarea[data-testid="stChatInputTextArea"]');
      if (textarea) {
        var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        nativeInputValueSetter.call(textarea, message);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));

        setTimeout(function() {
          var sendBtn = document.querySelector('button[data-testid="stChatInputSubmitButton"]');
          if (sendBtn) sendBtn.click();

          // Poll for response
          var attempts = 0;
          var maxAttempts = 120;
          var pollInterval = setInterval(function() {
            attempts++;
            var messages = document.querySelectorAll('[data-testid="stChatMessage"]');
            var lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.querySelector('[data-testid="stMarkdownContainer"]')) {
              var content = lastMsg.querySelector('[data-testid="stMarkdownContainer"]').textContent;
              if (content && attempts > 2) {
                clearInterval(pollInterval);
                setBadgeStatus('#22c55e', 'TF Connected');
                event.source.postMessage({ type: 'tf-response', id: id, result: content }, '*');
              }
            }
            if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              setBadgeStatus('#ef4444', 'TF Timeout');
              event.source.postMessage({ type: 'tf-response', id: id, result: 'Timeout: Keine Antwort von Streamlit' }, '*');
            }
          }, 500);
        }, 200);
      } else {
        setBadgeStatus('#ef4444', 'TF Error');
        event.source.postMessage({ type: 'tf-response', id: id, result: 'Streamlit Chat-Input nicht gefunden' }, '*');
      }
    }
  });
})();
