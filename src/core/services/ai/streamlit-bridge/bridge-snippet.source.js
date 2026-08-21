// TeamFlow AitisiGPT-Bridge — Bookmarklet
// Wird vom Nutzer EINMAL pro KI-Tab geklickt (fremde Oberflaeche, die wir nicht
// kontrollieren — unter file:// koennen wir kein JS in den fremden Tab injizieren,
// das Bookmarklet ist der vom Nutzer autorisierte Weg).
// Spricht via postMessage mit dem BridgeTransport unserer App:
//   tf-ping     -> tf-pong {rev, modelle, kontextText}
//   tf-app-ping <- (App antwortet tf-app-pong; Gegenrichtungs-Test)
//   tf-request {id, message, modell?} -> tf-progress {id}* + tf-stream {id, content}*
//                                     -> tf-response {id, result, reasoning?, modell?,
//                                                     modelle?, kontextText?, kontextVoll?}
//   tf-reset {id, modell?} -> tf-reset-done {id, found, modelle}
//
// ── Wer hier was weiss ──────────────────────────────────────────────────────
// `modell` ist der SICHTBARE Optionstext der Auswahlliste, nicht eine Kennung.
// Dieses Snippet kennt keine Modellnamen und keine Rollen; es meldet mit
// `modelle` die Liste, die die Seite anbietet, und waehlt aus, was die App ihm
// nennt. Die Zuordnung (welches Modell taugt wofuer, wie gross ist sein Fenster)
// liegt in `modell-katalog.ts`.
//
// Der Schnitt liegt genau hier, weil er die Kosten eines Modellwechsels der
// internen KI bestimmt: Wissen IM SNIPPET kostet ein neues Lesezeichen fuer jeden
// im Team, Wissen in der App nur einen Build. Bis v5 lagen Zuordnungsregel und
// Token-Parser gespiegelt hier drin — beides ist ersatzlos weg.
//
// ── Warum das hier keine DOM-Steuerung mehr ist ──────────────────────────────
// Die interne KI lief bis 2026-08 auf Streamlit; die Bridge fuellte Textfelder,
// klickte Knoepfe und riet aus DOM-Bewegung, wann eine Antwort fertig war. Seit
// dem Neubau (htmx + servergerendertes HTML) hat die Seite eine echte
// HTTP-Schnittstelle und einen SSE-Strom mit `done`-Ereignis. Wir sprechen sie
// direkt an. Damit entfallen ersatzlos: Echo-Erkennung, Antwort-Auswahl im
// Nachrichten-Roster, Lauf-Indikator-Polling, Ruhefenster-Heuristik und der
// Abschluss-Marker — allesamt Umgehungen eines fehlenden Fertig-Signals.
//
// Die Endpunkte werden aus den `hx-post`-Attributen der Seite GELESEN, nicht
// verdrahtet: die Seite beschreibt sich selbst, eine Route-Umbenennung bricht uns
// dadurch nicht.
//
// ── Warum wir trotzdem in die Seite schreiben ────────────────────────────────
// Wer an htmx vorbei sendet, uebernimmt dessen zweite Haelfte mit: das Einhaengen
// der Antwort. Ohne das bleibt der sichtbare Chat der KI-Seite LEER, obwohl Frage
// und Antwort laengst durchgelaufen sind (Befund aus dem Echtbetrieb, v6.0).
// Das kostet zwei belegbare Dinge — der Nutzer kann nicht nachlesen, WAS die App
// gesendet hat, und die Kontextleiste bleibt auf ihrem alten Stand stehen, aus der
// wir `data-over` („Fenster voll") an die App melden.
//
// Wir erfuellen deshalb den Renderauftrag, den die Seite selbst am Formular
// notiert (`hx-target` / `hx-swap`) — mit IHREM eigenen Fragment. Es wird kein
// Markup erfunden: eingehaengt wird, was der Server geliefert hat.
(function () {
  if (window.__teamflowBridge) return;
  window.__teamflowBridge = true;

  // Versions-Marker: bei JEDER Aenderung an diesem Snippet bumpen. So laesst sich im
  // KI-Tab pruefen, ob das NEUE Bookmarklet laeuft (haeufigste Support-Frage): Maus
  // ueber das Status-Badge (Tooltip) ODER `window.__teamflowBridgeRev` in der Konsole
  // ODER die Log-Zeile beim Aktivieren. Die App liest ihn zusaetzlich aus dem
  // tf-pong und warnt bei einem zu alten Snippet — seit dem Umbau ist ein altes
  // Bookmarklet nicht mehr harmlos: es ignoriert das Modellfeld still.
  var BRIDGE_REV = '2026-08-21-chat-sichtbar';
  // Kurzversion für den LESEZEICHEN-NAMEN („interne-KI v1"). Sie ist das
  // Einzige, was der Nutzer ohne Klick sieht — an ihr erkennt er in der
  // Lesezeichenleiste, ob er die aktuelle Bridge hat.
  //
  // ZUSAMMEN mit BRIDGE_REV hochzählen. Kein Guard kann das erzwingen (ob jemand
  // beide Zeilen angefasst hat, steht nirgends im Code) — geprüft wird nur, dass
  // beide Marker lesbar sind und der Name kurz genug für die Leiste bleibt.
  var BRIDGE_VERSION = 3;
  window.__teamflowBridgeRev = BRIDGE_REV;
  window.__teamflowBridgeVersion = BRIDGE_VERSION;
  try { console.log('[TeamFlow-Bridge] aktiv — rev ' + BRIDGE_REV); } catch (e) { /* ignore */ }

  // Selektor-Fallback-Arrays (spezifisch -> generisch) fuer AitisiGPT.
  // Die Seite vergibt keine data-testid-Attribute; Anker sind Formular-Ids,
  // Feldnamen und Klassen. Wo ein Endpunkt gebraucht wird, steht er als
  // `hx-post` am Element — den lesen wir, statt Routen zu verdrahten.
  var SEL = {
    shell: ['#shell'],
    sendform: ['#sendform'],
    message: ['#sendform textarea[name=message]', 'textarea[name=message]'],
    resetform: ['form.resetform'],
    resetbtn: ['form.resetform button[type=submit]', 'form.resetform button'],
    modelsel: ['select.modelsel', 'select[name=model]'],
    datasource: ['select[name=datasource]'],
    tokenbar: ['#tokenbar'],
    tokentext: ['#tokenbar .tokenbar-text'],
    // Der sichtbare Verlauf. Wir lesen ihn nie aus (die Antwort kommt aus dem
    // Strom) — wir schreiben nur hinein, damit der Nutzer sieht, was lief.
    log: ['#log'],
    chattab: ['.tabs .tab.active', '.tabs .tab'],
  };

  function q1(list, root) {
    var r = root || document;
    for (var i = 0; i < list.length; i++) {
      var e = r.querySelector(list[i]);
      if (e) return e;
    }
    return null;
  }
  function isVisible(el) {
    if (!el) return false;
    if (el.offsetParent !== null) return true;
    // position:fixed-Elemente haben offsetParent null → ueber Client-Rects
    // pruefen (display:none liefert keine Rects).
    return !!(el.getClientRects && el.getClientRects().length > 0);
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
    var cls = el.getAttribute && el.getAttribute('class');
    // AitisiGPT haengt an die Antwort Bedien-Beiwerk: die Reasoning-Blase (wird
    // separat ueber das SSE-Ereignis geholt), Kopier-Knoepfe, Status-Zeilen.
    if (cls && /reasoning-help|reasoning-pop|doccopy|copybtn|genbar/i.test(cls)) return true;
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
        // In-Page-Anker sind Navigation, kein Inhalt → nur (oft leeres) Label,
        // NIE die href als Text (sonst leakt der Slug in die Antwort).
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
  // HTML-Zeichenkette (SSE-Nutzlast, Antwort-Fragment) → Markdown.
  // Ueber <template>, NICHT ueber ein div im Dokument: der Inhalt bleibt inert —
  // keine Skripte, keine nachgeladenen Bilder aus fremdem Markup.
  function mdAusHtml(html) {
    try {
      var tpl = document.createElement('template');
      tpl.innerHTML = String(html || '');
      return htmlToMd(tpl.content);
    } catch (e) { return ''; }
  }
  // Wie mdAusHtml, aber liefert zusaetzlich den geparsten Baum (fuer Fragment-
  // Auswertung: `.sse`-Element finden, Fehlermeldung lesen).
  function parseFragment(html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = String(html || '');
    return tpl.content;
  }

  // ── Tab-Titel: KI-Status ohne Tab-Wechsel sichtbar (v2.280) ───────────────
  // Die Status-Pill unten rechts sieht nur, wer IN diesem Tab ist. Wer in der App
  // arbeitet, soll am Tab-Titel in der Chrome-Tab-Leiste ablesen koennen, ob die
  // KI vorankommt. Laufzeit UND Umfang, weil nur der wachsende Umfang „kommt
  // voran" belegt — eine Uhr tickt auch bei totem Server weiter. Symbol VORNE,
  // damit es sichtbar bleibt, wenn Chrome den Tab-Text abschneidet.
  // WORTGLEICH gespiegelt in tab-titel.ts (Drift-Test: tab-titel.test.ts).
  // <tab-titel-core> keep in sync with tab-titel.ts
  var TAB_SYMBOL = { laeuft: '⏳', fertig: '✅', fehler: '⚠️' };
  function basisTitel(roh) {
    var s = String(roh || '');
    var praefix = /^[⏳✅⚠]️?\s(?:\d+:\d{2}(?:\s·\s\d+(?:,\d)?k?)?|[^·]*?)\s·\s+/;
    while (praefix.test(s)) s = s.replace(praefix, '');
    return s.trim();
  }
  function formatiereLaufzeit(ms) {
    var sekGesamt = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    var min = Math.floor(sekGesamt / 60);
    var sek = sekGesamt % 60;
    return min + ':' + (sek < 10 ? '0' : '') + sek;
  }
  function formatiereUmfang(zeichen) {
    var n = Math.max(0, Math.floor(Number(zeichen) || 0));
    if (n < 100) return '';
    if (n < 1000) return String(n);
    if (n < 10000) return String(Math.round(n / 100) / 10).replace('.', ',') + 'k';
    return Math.round(n / 1000) + 'k';
  }
  function formatiereTabTitel(art, basis, opts) {
    opts = opts || {};
    var rein = basisTitel(basis);
    if (art === 'ruhe') return rein;
    var teile = [];
    if (art === 'laeuft') {
      if (opts.seit) {
        teile.push(formatiereLaufzeit((opts.jetzt || 0) - opts.seit));
        var umfang = formatiereUmfang(opts.zeichen || 0);
        if (umfang) teile.push(umfang);
      } else {
        teile.push(opts.text || 'Arbeitet…');
      }
    } else {
      teile.push(opts.text || (art === 'fertig' ? 'Fertig' : 'Fehler'));
    }
    var kopf = TAB_SYMBOL[art] + ' ' + teile.join(' · ');
    return rein ? kopf + ' · ' + rein : kopf;
  }
  // </tab-titel-core>

  // ── Modell-Liste melden ───────────────────────────────────────────────────
  // Dieses Snippet kennt KEINE Modellnamen mehr. Es liest die Auswahlliste ab und
  // meldet sie; welches Modell wofuer taugt, entscheidet die App
  // (`modell-katalog.ts`), und sie nennt beim Auftrag den gewuenschten Optionstext.
  //
  // Das ist der Grund fuer den Schnitt: jede Zeile Modellwissen hier waere bei
  // einem Modellwechsel der internen KI ein neues Lesezeichen fuer das GANZE Team.
  // Wissen, das die App haelt, kostet dagegen nur einen Build. Bis v5 lief hier
  // eine gespiegelte Zuordnungsregel mit — die ist ersatzlos weg.
  function modelleListe() {
    var sel = q1(SEL.modelsel);
    if (!sel) return [];
    var out = [];
    for (var i = 0; i < sel.options.length; i++) {
      var o = sel.options[i];
      out.push({
        text: (o.text || '').trim(),
        value: o.value || '',
        aktiv: i === sel.selectedIndex,
      });
    }
    return out;
  }

  // ── Status-Badge (unten rechts) ───────────────────────────────────────────
  // Toene aus dem TeamFlow-Design-System (badge.tsx / theme.css). Werte als
  // Literale, weil die fremde KI-Seite die CSS-Variablen nicht kennt.
  var TONES = {
    ready:   { bg: 'hsl(145, 60%, 94%)', fg: 'hsl(145, 60%, 30%)' }, // success
    working: { bg: 'hsl(38, 90%, 93%)',  fg: 'hsl(38, 70%, 30%)' },  // warning
    error:   { bg: 'hsl(0, 70%, 95%)',   fg: 'hsl(0, 60%, 38%)' },   // danger
  };
  // Originaltitel der fremden Seite EINMALIG sichern (basisTitel schuetzt gegen
  // ein bereits vorhandenes Praefix, falls die Seite mit gesetztem Titel neu laedt).
  var BASIS_TITEL = basisTitel(document.title);
  // Quittung nach einem Lauf: „Fertig" verschwindet nach 60 s wieder, damit im Tab
  // keine stundenalte Aussage stehen bleibt. FEHLER bleiben stehen (bis zum
  // naechsten setBadge) — Probleme sollen nicht wegflackern.
  var QUITTUNG_MS = 60000;
  var tabZustand = { art: 'ruhe', seit: 0, zeichen: 0, text: '', quittungSeit: 0 };
  var wunschTitel = BASIS_TITEL;
  // Schreibt nur bei echter Aenderung — der 4-s-Watchdog ruft das im Leerlauf mit.
  function setzeTabTitel() {
    try {
      wunschTitel = formatiereTabTitel(tabZustand.art, BASIS_TITEL, {
        seit: tabZustand.seit, jetzt: Date.now(),
        zeichen: tabZustand.zeichen, text: tabZustand.text,
      });
      if (document.title !== wunschTitel) document.title = wunschTitel;
    } catch (e) { /* ignore */ }
  }

  // Fixierte Leiste UNTEN rechts: EINE dezente Status-Pill (v2.212).
  // right:220px statt 12px: Chrome zeichnet seine Bildschirmfreigabe-Anzeige
  // unten rechts (ausserhalb der Seite, nicht messbar) — die Pill wird nach links
  // eingerueckt, damit sie frei daneben sitzt. z-index am Maximum: die fremde
  // Seite stapelt bis 120 (Aktenpruefungs-Lupe) und wuerde 99999 nicht, aber
  // kuenftige Schichten schon ueberdecken.
  var BAR_CSS = 'position:fixed;bottom:12px;right:220px;z-index:2147483647;display:flex;gap:6px;align-items:center;';
  var bar = document.createElement('div');
  bar.id = 'tf-bridge-bar';
  bar.style.cssText = BAR_CSS;
  document.body.appendChild(bar);
  // Watchdog: haelt die Leiste sichtbar, egal was die KI-Seite umbaut —
  // (a) re-append, wenn ein Umbau sie entfernt hat; (b) ans body-ENDE ruecken,
  // damit sie bei z-index-Gleichstand die Paint-Order gewinnt; (c) Inline-Styles
  // re-asserten. Verglichen wird gegen die BROWSER-normalisierte cssText-Fassung
  // (nie gegen das Literal — der Browser formatiert Inline-Styles um).
  var BAR_CSS_NORM = bar.style.cssText;
  setInterval(function () {
    // Tab-Titel im selben Takt mitpflegen (kein eigener Timer): Fertig-Quittung
    // ablaufen lassen und den Titel re-asserten — die fremde Seite setzt
    // document.title bei einem htmx-Tabwechsel auf ihren eigenen zurueck.
    try {
      if (tabZustand.art === 'fertig' && tabZustand.quittungSeit
        && Date.now() - tabZustand.quittungSeit >= QUITTUNG_MS) {
        tabZustand.art = 'ruhe';
        tabZustand.text = '';
        tabZustand.quittungSeit = 0;
      }
      setzeTabTitel();
    } catch (e) { /* ignore */ }
    try {
      if (!bar.isConnected) { document.body.appendChild(bar); return; }
      if (document.body.lastElementChild !== bar) document.body.appendChild(bar);
      if (bar.style.cssText !== BAR_CSS_NORM) bar.style.cssText = BAR_CSS;
    } catch (e) { /* ignore */ }
  }, 4000);

  // Dezente Status-Pill: EIN Element statt Badge + zwei Test-Buttons.
  // Farbiger Punkt (Ton) + neutraler Text auf hellem Grund — faellt in der fremden
  // KI-Seite nicht auf, zeigt aber im Zeitverlauf alle Zustaende.
  // Klick loest beide Selbsttests erneut aus.
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
    // Tab-Titel mitziehen: setBadge ist der EINZIGE Statuswechsel-Punkt im Snippet
    // — haengt der Tab hier, kann er nicht von der Pill wegdriften, und kuenftige
    // setBadge-Aufrufe sind automatisch abgedeckt.
    tabZustand.art = tone === 'working' ? 'laeuft' : (tone === 'error' ? 'fehler' : 'fertig');
    tabZustand.text = text || '';
    // Uhr/Umfang gehoeren nur zu einem echten Lauf — runRequest setzt sie danach.
    tabZustand.seit = 0;
    tabZustand.zeichen = 0;
    tabZustand.quittungSeit = tabZustand.art === 'fertig' ? Date.now() : 0;
    setzeTabTitel();
  }

  // Nach einem echten Lauf: im Tab „Fertig" statt des Pill-Texts („Verbunden").
  // Die Pill beschreibt die VERBINDUNG, der Tab den LAUF.
  function tabQuittung(text) {
    tabZustand.text = text;
    setzeTabTitel();
  }

  // ── HTTP-Schicht ──────────────────────────────────────────────────────────
  // Die Seite fuehrt ihre Sitzung PRO BROWSER-TAB: die Id steht als data-sid am
  // persistenten #shell und reist als X-Session-Id-Header bei jedem htmx-Request
  // mit. Ohne diesen Header traefe unser Aufruf eine FREMDE Sitzung — der Chat
  // liefe dann gegen einen anderen Verlauf als der, den der Nutzer sieht.
  function sitzungsId() {
    try {
      var shell = q1(SEL.shell);
      if (shell && shell.dataset && shell.dataset.sid) return shell.dataset.sid;
      return sessionStorage.getItem('sid') || '';
    } catch (e) { return ''; }
  }
  function kopfzeilen(extra) {
    var h = { 'X-Requested-With': 'XMLHttpRequest', 'HX-Request': 'true' };
    var sid = sitzungsId();
    if (sid) h['X-Session-Id'] = sid;
    if (extra) { for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) h[k] = extra[k]; } }
    return h;
  }
  // Ein htmx-Attribut am Element oder am naechsten Traeger darueber.
  function hxAttr(el, name, rueckfall) {
    if (!el) return rueckfall;
    var direkt = el.getAttribute && el.getAttribute(name);
    if (direkt) return direkt;
    var traeger = el.closest && el.closest('[' + name + ']');
    return (traeger && traeger.getAttribute(name)) || rueckfall;
  }
  // Endpunkt eines Formulars/Feldes: die Seite traegt ihn selbst als hx-post.
  function hxPost(el) { return hxAttr(el, 'hx-post', ''); }

  // ── Renderauftrag der Seite nachholen ─────────────────────────────────────
  // Ein fremdes Fragment, das wir einhaengen, darf NICHTS anstossen: steht die
  // Strom-Adresse noch drin, koennte die Seitenmechanik daran einen ZWEITEN
  // EventSource oeffnen — derselbe Lauf zweimal, auf Kosten der internen KI. Wir
  // benennen sie deshalb um; gelesen haben wir sie vorher aus dem Original.
  function entschaerfe(wurzel) {
    try {
      var offen = wurzel.querySelectorAll('[data-url]');
      for (var i = 0; i < offen.length; i++) {
        offen[i].setAttribute('data-tf-url', offen[i].getAttribute('data-url') || '');
        offen[i].removeAttribute('data-url');
      }
    } catch (e) { /* ignore */ }
    return wurzel;
  }
  // Nur nachfuehren, wenn der Nutzer ohnehin unten steht: wer hochgescrollt hat,
  // um mitzulesen, soll nicht bei jedem Token zurueckgerissen werden.
  function amEnde(log) {
    if (!log) return true;
    return log.scrollHeight - log.scrollTop - log.clientHeight < 120;
  }
  function scrolleAnsEnde(el) {
    try {
      var log = q1(SEL.log);
      if (log && log.scrollHeight > log.clientHeight) { log.scrollTop = log.scrollHeight; return; }
      // Scrollt nicht der Kasten, sondern die Seite → das Element selbst zeigen.
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'end' });
    } catch (e) { /* ignore */ }
  }
  // Haengt das Server-Fragment dort ein, wo die Seite es selbst hinhaengen wuerde.
  // Rueckfall fuer `hx-swap` ist bewusst 'beforeend' und NICHT htmx' echter
  // Standard 'innerHTML': fehlt das Attribut, steht das Eingehaengte hoechstens an
  // der falschen Stelle — Ersetzen wuerde den sichtbaren Verlauf loeschen.
  // Liefert die eingehaengten Elemente (VOR dem Anhaengen eingesammelt: das
  // Anhaengen leert das Fragment).
  function wendeSwapAn(quelleEl, html, zielRueckfall) {
    var zielSel = hxAttr(quelleEl, 'hx-target', zielRueckfall || '');
    var ziel = zielSel ? document.querySelector(zielSel) : null;
    if (!ziel) return null;
    var art = String(hxAttr(quelleEl, 'hx-swap', 'beforeend')).split(' ')[0];
    var frag = entschaerfe(parseFragment(html));
    var eingehaengt = [];
    for (var i = 0; i < frag.children.length; i++) eingehaengt.push(frag.children[i]);
    try {
      if (art === 'innerHTML') { ziel.innerHTML = ''; ziel.appendChild(frag); }
      else if (art === 'outerHTML') { ziel.replaceWith(frag); }
      else if (art === 'afterbegin') { ziel.insertBefore(frag, ziel.firstChild); }
      else { ziel.appendChild(frag); }   // beforeend
    } catch (e) { return null; }
    scrolleAnsEnde(eingehaengt[eingehaengt.length - 1]);
    return eingehaengt;
  }
  // Geruest eines Fragments fuer die Konsole: Tags + Klassen der obersten Ebene.
  // NIE Inhalt — hier stuende sonst der Prompt in der Konsole der fremden Seite.
  // Zweck: die Abnahme am echten System soll BELEGEN, was der POST liefert
  // (bringt er die eigene Frage mit? wo sitzt die Antwortblase?), statt dass wir
  // es aus der Ferne annehmen.
  function geruest(frag) {
    var teile = [];
    try {
      for (var i = 0; i < frag.children.length; i++) {
        var c = frag.children[i];
        var cls = String(c.className || '').trim();
        teile.push(c.tagName.toLowerCase() + (cls ? '.' + cls.split(/\s+/).join('.') : ''));
      }
    } catch (e) { /* ignore */ }
    return teile.join(' + ') || '(leer)';
  }
  // Haengt das Fragment ein und liefert das Element, in das die Antwort gehoert —
  // die Seite markiert es mit der Strom-Adresse (nach dem Entschaerfen data-tf-url).
  function zeigeImChat(quelleEl, html) {
    var eingehaengt = wendeSwapAn(quelleEl, html, '#log');
    if (!eingehaengt) return null;
    for (var i = 0; i < eingehaengt.length; i++) {
      var el = eingehaengt[i];
      if (el.matches && el.matches('[data-tf-url]')) return el;
      var innen = el.querySelector && el.querySelector('[data-tf-url]');
      if (innen) return innen;
    }
    return null;
  }
  // Formular-POST wie htmx ihn schickt (urlencoded). Liefert {ok, status, text}.
  function postForm(url, felder, cb) {
    var body = new URLSearchParams();
    for (var k in felder) {
      if (Object.prototype.hasOwnProperty.call(felder, k)) body.append(k, String(felder[k]));
    }
    var h = kopfzeilen({ 'Content-Type': 'application/x-www-form-urlencoded' });
    fetch(url, { method: 'POST', headers: h, body: body.toString(), credentials: 'same-origin' })
      .then(function (r) {
        return r.text().then(function (t) { cb({ ok: r.ok, status: r.status, text: t }); });
      })
      .catch(function (e) { cb({ ok: false, status: 0, text: String(e && e.message || e) }); });
  }

  // ── Kontextfenster der Seite ablesen ──────────────────────────────────────
  // Die Seite zeigt es sichtbar an („Chatlänge [Token]: 0k von 62k") und pflegt
  // `data-over` am #tokenbar, wenn das Fenster voll ist. Das ist die einzige
  // ehrliche Quelle: unsere Konstanten sind nur der Rueckfall, und sie sind in
  // der Vergangenheit still gedriftet (262k im Code gegen 259k in der Seite).
  //
  // Der ROHE Text geht an die App; ausgewertet wird dort (`leseKontextTokens` in
  // bridge-modelle.ts). Bis v5 lief die Zahlen-Regel hier mit — und haette die
  // Seite ihre Beschriftung geaendert, waere die Korrektur ein neues Lesezeichen
  // fuer jeden im Team gewesen.
  function kontextStand() {
    var el = q1(SEL.tokentext);
    var box = q1(SEL.tokenbar);
    return {
      text: el ? String(el.textContent || '').trim() : '',
      voll: !!(box && box.dataset && box.dataset.over),
    };
  }
  // Der Strom meldet die Leiste waehrend des Laufs — bisher haben wir das Ereignis
  // nur als Lebenszeichen gewertet und die Nutzlast weggeworfen. Ohne sie zieht die
  // Leiste der Seite NIE nach (htmx sieht unseren Lauf nicht): sie stuende bis zum
  // naechsten Modellwechsel oder Neuladen auf ihrem alten Wert. Das ist mehr als
  // Anzeige — `kontextStand()` liest genau sie, und daraus kommt das
  // „Fenster voll"-Signal an die App.
  //
  // Die Form der Nutzlast ist nicht garantiert, deshalb drei abgestufte Wege und
  // im Zweifel KEINE Aenderung: ein alter Wert ist besser als eine zerschossene
  // Kopfzeile der fremden Seite.
  function aktualisiereTokenleiste(nutzlast) {
    try {
      var alt = q1(SEL.tokenbar);
      if (!alt) return;
      var frag = entschaerfe(parseFragment(nutzlast));
      var ganz = frag.querySelector('#tokenbar');
      if (ganz) { alt.replaceWith(ganz); return; }          // (a) ganze Leiste
      var ziel = q1(SEL.tokentext);
      if (!ziel) return;
      var text = frag.querySelector('.tokenbar-text');
      if (text) { ziel.textContent = String(text.textContent || '').trim(); return; } // (b) nur der Text
      var roh = String(nutzlast || '').trim();              // (c) reiner Text
      if (roh && roh.indexOf('<') === -1 && /\d/.test(roh)) ziel.textContent = roh;
    } catch (e) { /* ignore */ }
  }

  // ── Modell setzen ─────────────────────────────────────────────────────────
  // Bewusst ueber das native <select> + change-Ereignis statt per fetch: die
  // Wahl loest serverseitig ein volles Neu-Rendern aus, das htmx als #app-Swap
  // eintauscht. Laesst man htmx das machen, bleibt die Seite in sich stimmig
  // (Modellname, Kontextleiste, Sperren) — ein stiller fetch wuerde die
  // Anzeige von der Server-Sitzung wegdriften lassen.
  var SWAP_TIMEOUT_MS = 15000;
  function gleicherText(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }
  function ensureModell(wunsch, cb) {
    if (!wunsch) { cb(null); return; }                // kein Wunsch → Modell nicht anfassen
    var sel = q1(SEL.modelsel);
    if (!sel) { cb('Modell-Auswahl der internen KI nicht gefunden'); return; }
    var treffer = -1;
    for (var i = 0; i < sel.options.length; i++) {
      if (gleicherText(sel.options[i].text, wunsch)) { treffer = i; break; }
    }
    // Nicht gefunden ist ein FEHLER, kein Achselzucken: die App hat ihre Nutzlast
    // bereits auf das Fenster dieses Modells zugeschnitten. Auf einem anderen
    // weiterzufahren hiesse, den Anfang des Prompts still herausschieben zu
    // lassen. Die Liste faehrt im Fehler mit, damit die App neu aufloesen kann.
    if (treffer < 0) { cb('Modell "' + wunsch + '" steht in der internen KI nicht zur Wahl'); return; }
    if (sel.selectedIndex === treffer) { cb(null); return; }   // steht schon richtig
    if (sel.disabled) { cb('Modellwechsel gerade gesperrt (es laeuft eine Generierung)'); return; }

    // Das alte Feld markieren: der #app-Swap ersetzt es durch ein NEUES Element,
    // die Markierung ist also weg, sobald der Tausch durch ist. Ohne diesen
    // Anker liesse sich „schon gesetzt" nicht von „Swap noch unterwegs"
    // unterscheiden — wir haben den Wert ja selbst vorher gesetzt.
    try { sel.dataset.tfPending = '1'; } catch (e) { /* ignore */ }
    sel.selectedIndex = treffer;
    sel.dispatchEvent(new Event('change', { bubbles: true }));

    var t0 = Date.now();
    (function warte() {
      var neu = q1(SEL.modelsel);
      if (neu && !(neu.dataset && neu.dataset.tfPending)) {
        var opt = neu.options[neu.selectedIndex];
        var txt = opt ? opt.text : '';
        // Verifizieren statt vertrauen: ein nicht durchgeschlagener Wechsel muss
        // ein Fehler sein, keine stille Abweichung — sonst laeuft der Auftrag auf
        // einem anderen Modell (und Kontextfenster) als die App annimmt.
        if (gleicherText(txt, wunsch)) { cb(null); return; }
        cb('Modellwechsel auf "' + wunsch + '" hat nicht gegriffen (gewaehlt: ' + txt + ')');
        return;
      }
      if (Date.now() - t0 >= SWAP_TIMEOUT_MS) { cb('Modellwechsel: Zeitueberschreitung'); return; }
      setTimeout(warte, 200);
    })();
  }

  // ── Datenquelle neutralisieren ────────────────────────────────────────────
  // Die Seite kann eigenen RAG-Kontext beimischen (ZIM-Hotline, PTplus-Hilfe …).
  // Unsere Auftraege bringen ihren Kontext vollstaendig selbst mit; eine fremde
  // Quelle wuerde ihn unbemerkt ergaenzen. Nur anfassen, wenn wirklich eine
  // gewaehlt ist — sonst kostet jeder Lauf einen Rundlauf umsonst.
  function ensureDatenquelleAus(cb) {
    var sel = q1(SEL.datasource);
    if (!sel || !sel.value || sel.disabled) { cb(); return; }
    try {
      sel.value = '';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) { /* ignore */ }
    setTimeout(cb, 400);
  }

  // Sicherstellen, dass wir im Chat-Tab stehen (nur dort gibt es #sendform).
  function ensureChatTab(cb) {
    if (q1(SEL.sendform)) { cb(null); return; }
    var tabs = document.querySelectorAll('.tabs .tab');
    for (var i = 0; i < tabs.length; i++) {
      var t = (tabs[i].textContent || '').toLowerCase();
      if (t.indexOf('chat') !== -1 && t.indexOf('agentisch') === -1) {
        try { tabs[i].click(); } catch (e) { /* ignore */ }
        break;
      }
    }
    var t0 = Date.now();
    (function warte() {
      if (q1(SEL.sendform)) { cb(null); return; }
      if (Date.now() - t0 >= SWAP_TIMEOUT_MS) { cb('Chat-Bereich der internen KI nicht gefunden'); return; }
      setTimeout(warte, 200);
    })();
  }

  // ── Anfrage-Engine ────────────────────────────────────────────────────────
  // Ablauf: Chat-Tab → Modell → Datenquelle aus → POST /send → SSE lauschen.
  // Die Antwort des POST ist das Nachrichten-Fragment; darin steht das
  // .sse-Element mit der Strom-Adresse. Der Strom liefert `message`
  // (Voll-Snapshots des Antwort-HTML), `reasoning` und schliesst mit `done`.
  //
  // Die Seite braucht fuer den Strom KEINEN Sitzungs-Header (eine EventSource
  // kann keine Header senden) — die Adresse ist auftragsgebunden.
  var PROGRESS_MS = 10000;   // Heartbeat an die App (deren Idle-Timeout)
  var TITEL_MS = 1200;       // Tab-Titel-Ticker
  var HARD_MAX_MS = 600000;  // Backstop gegen einen Strom, der nie `done` sendet
  var STILL_MS = 180000;     // kein Ereignis mehr, aber auch kein `done`

  function runRequest(source, id, message, modellWunsch) {
    setBadge('working', 'Arbeitet…');
    ensureChatTab(function (tabErr) {
      if (tabErr) { fehler(tabErr); return; }
      ensureModell(modellWunsch, function (modellErr) {
        if (modellErr) { fehler(modellErr); return; }
        ensureDatenquelleAus(function () { sende(); });
      });
    });

    // Die Liste faehrt AUCH im Fehlerfall mit: scheiterte der Lauf daran, dass ein
    // Modell nicht mehr zur Wahl steht, ist genau sie das, was die App braucht, um
    // neu aufzuloesen — und ohne sie wuesste sie nur, dass etwas nicht ging.
    function fehler(text) {
      setBadge('error', 'Fehler');
      source.postMessage({ type: 'tf-response', id: id, result: text,
        modell: aktuellerModellName(), modelle: modelleListe(), fehlschlag: true }, '*');
    }

    function sende() {
      var form = q1(SEL.sendform);
      var url = hxPost(form);
      if (!url) { fehler('Sende-Adresse der internen KI nicht gefunden'); return; }
      var stand = kontextStand();
      var aktivesModell = aktuellerModellName();

      postForm(url, { message: message }, function (res) {
        if (!res.ok) {
          fehler('Die interne KI hat die Anfrage abgelehnt (HTTP ' + res.status + ').');
          return;
        }
        // Erst LESEN, dann einhaengen: das Eingehaengte ist entschaerft (ohne
        // data-url) — die Adresse steht nur im frisch geparsten Original.
        var frag = parseFragment(res.text);
        var sse = frag.querySelector('.sse[data-url], [data-url]');
        // Die Seite zeigen lassen, was sie selbst gezeigt haette: die Frage, die
        // Antwortblase — oder eine Fehlermeldung.
        var antwortEl = zeigeImChat(form, res.text);
        try {
          console.log('[TeamFlow-Bridge] Antwort-Fragment: ' + geruest(frag)
            + ' | Strom: ' + (sse ? 'ja' : 'nein')
            + ' | Antwortblase: ' + (antwortEl ? 'gefunden' : 'KEINE')
            + ' | Ziel: ' + (hxAttr(form, 'hx-target', '?') + ' / ' + hxAttr(form, 'hx-swap', '(Rueckfall beforeend)')));
        } catch (e) { /* ignore */ }
        if (!sse) {
          // Kein Strom → das Fragment IST die Antwort (Fehlermeldung der Seite,
          // z. B. „Maximale Chatlänge überschritten"). Als Ergebnis zurueckgeben
          // statt zu schweigen: der Nutzer soll den Grund lesen.
          var direkt = mdAusHtml(res.text);
          setBadge(direkt ? 'ready' : 'error', direkt ? 'Verbunden' : 'Keine Antwort');
          source.postMessage({ type: 'tf-response', id: id,
            result: direkt || 'Die interne KI hat keinen Antwortstrom geliefert.',
            modell: aktivesModell, modelle: modelleListe(),
            kontextText: stand.text, kontextVoll: stand.voll }, '*');
          return;
        }
        lausche(sse.getAttribute('data-url'), aktivesModell, stand, antwortEl);
      });
    }

    function lausche(streamUrl, aktivesModell, stand, antwortEl) {
      var es, fertig = false, lastMd = '', reasoningMd = '';
      var started = Date.now(), letztesEreignis = Date.now();

      var titelIv = setInterval(function () {
        tabZustand.zeichen = lastMd.length;
        setzeTabTitel();
      }, TITEL_MS);
      var progressIv = setInterval(function () {
        // Heartbeat: auch OHNE Inhalt (Server-Queue vor dem ersten Token) weiss
        // die App, dass der Lauf lebt — ihr Idle-Timeout resettet auf tf-progress.
        try { source.postMessage({ type: 'tf-progress', id: id }, '*'); } catch (e) { /* ignore */ }
      }, PROGRESS_MS);
      var wachIv = setInterval(function () {
        if (fertig) return;
        var still = Date.now() - letztesEreignis;
        if (still >= STILL_MS || Date.now() - started >= HARD_MAX_MS) {
          abschluss(lastMd, still >= STILL_MS ? 'Stille' : 'Zeitueberschreitung');
        }
      }, 2000);

      function aufraeumen() {
        clearInterval(titelIv); clearInterval(progressIv); clearInterval(wachIv);
        try { if (es) es.close(); } catch (e) { /* ignore */ }
      }
      function abschluss(md, grund) {
        if (fertig) return;
        fertig = true;
        aufraeumen();
        var jetzt = kontextStand();
        var text = md || (grund
          ? grund + ': Keine Antwort von der internen KI'
          : 'Keine Antwort von der internen KI');
        setBadge(md ? 'ready' : 'error', md ? 'Verbunden' : (grund || 'Keine Antwort'));
        if (md) tabQuittung('Fertig');
        var nachricht = { type: 'tf-response', id: id, result: text,
          modell: aktivesModell,
          modelle: modelleListe(),
          // Nach dem Lauf gemessen, nicht davor: die Seite zieht die Leiste am
          // Ende der Runde nach, und der Wert nach dem Lauf ist der, der die
          // naechste Anfrage begrenzt.
          kontextText: jetzt.text || stand.text,
          kontextVoll: jetzt.voll };
        if (reasoningMd) nachricht.reasoning = reasoningMd;
        try { source.postMessage(nachricht, '*'); } catch (e) { /* ignore */ }
      }

      tabZustand.seit = started;
      tabZustand.zeichen = 0;

      try {
        es = new EventSource(streamUrl);
      } catch (e) {
        abschluss('', 'Antwortstrom nicht erreichbar');
        return;
      }
      es.addEventListener('message', function (ev) {
        letztesEreignis = Date.now();
        // Die Seite mitschreiben lassen: `message` ist ein VOLL-Snapshot des
        // Antwort-HTML — genau das, was die Seitenmechanik hier hineinschriebe.
        // Deshalb Ersetzen, nicht Anhaengen.
        if (antwortEl) {
          try {
            var folgen = amEnde(q1(SEL.log));
            antwortEl.innerHTML = String(ev.data || '');
            if (folgen) scrolleAnsEnde(antwortEl);
          } catch (e) { /* ignore */ }
        }
        var md = mdAusHtml(ev.data);
        if (md && md !== lastMd) {
          lastMd = md;
          try { source.postMessage({ type: 'tf-stream', id: id, content: md }, '*'); } catch (e) { /* ignore */ }
        }
      });
      es.addEventListener('reasoning', function (ev) {
        letztesEreignis = Date.now();
        reasoningMd = mdAusHtml(ev.data);
      });
      // status haelt nur den Wachhund wach — angezeigt wird nichts davon.
      es.addEventListener('status', function () { letztesEreignis = Date.now(); });
      es.addEventListener('tokenbar', function (ev) {
        letztesEreignis = Date.now();
        aktualisiereTokenleiste(ev.data);
      });
      es.addEventListener('done', function () {
        letztesEreignis = Date.now();
        abschluss(lastMd, '');
      });
      es.onerror = function () {
        // Ein Strom-Abbruch NACH vollstaendiger Antwort ist der Normalfall (der
        // Server schliesst); ohne Inhalt ist er ein echter Fehler.
        if (lastMd) abschluss(lastMd, '');
        else abschluss('', 'Verbindung zum Antwortstrom abgebrochen');
      };
    }
  }

  function aktuellerModellName() {
    var sel = q1(SEL.modelsel);
    if (!sel) return '';
    var o = sel.options[sel.selectedIndex];
    return o ? (o.text || '').trim() : '';
  }

  // ── Chat-Reset (frischer Kontext) ─────────────────────────────────────────
  // Der Chat ist zustandsbehaftet (serverseitige Sitzung) — ein Lauf darf nicht
  // den alten Verlauf als Kontext mitschleppen (Pitfall #36). Bevorzugt ueber den
  // Endpunkt, den das Reset-Formular selbst nennt; ohne Attribut wird der Knopf
  // geklickt (die eigene Bridge-Leiste ist dabei ausgeschlossen).
  function resetChat(cb) {
    var form = q1(SEL.resetform);
    var url = hxPost(form);
    if (url) {
      postForm(url, {}, function (res) {
        // Auch hier den Renderauftrag erfuellen — und hier am dringendsten: sonst
        // steht der GELOESCHTE Verlauf weiter sichtbar da, waehrend der Server ihn
        // schon vergessen hat. Ein falscher Verlauf ist irrefuehrender als keiner.
        if (res.ok) wendeSwapAn(form, res.text, '#log');
        cb(!!res.ok);
      });
      return;
    }
    var btn = q1(SEL.resetbtn);
    if (btn && isVisible(btn) && !(bar && bar.contains(btn))) {
      try { btn.click(); } catch (e) { cb(false); return; }
      setTimeout(function () { cb(true); }, 500);
      return;
    }
    cb(false);
  }

  // ── Selbsttest ────────────────────────────────────────────────────────────
  // Prueft, was die Bridge wirklich braucht: Sitzungs-Id, Sende-Endpunkt,
  // Modell-Auswahl, Reset-Weg und Kontextleiste. Benennt EINZELN, was fehlt —
  // ein stiller Teilausfall (wie beim Streamlit→htmx-Wechsel: senden ging,
  // Antworten lesen nicht) darf sich nicht wiederholen.
  function pruefeAnschluss() {
    var mangel = [];
    if (!sitzungsId()) mangel.push('Sitzungs-Id');
    if (!q1(SEL.sendform)) mangel.push('Chat-Formular');
    else if (!hxPost(q1(SEL.sendform))) mangel.push('Sende-Adresse');
    if (!q1(SEL.modelsel)) mangel.push('Modell-Auswahl');
    if (!q1(SEL.resetform) && !q1(SEL.resetbtn)) mangel.push('Reset');
    if (!q1(SEL.tokentext)) mangel.push('Kontextleiste');
    return mangel;
  }
  var selfTestRunning = false;
  function runSelfTest() {
    if (selfTestRunning) return;
    selfTestRunning = true;
    var mangel = pruefeAnschluss();
    try {
      console.log('[TeamFlow-Bridge] Anschluss-Test — '
        + (mangel.length ? 'FEHLT: ' + mangel.join(', ') : 'alles gefunden')
        + ' | Modell: ' + (aktuellerModellName() || '?')
        + ' | Kontext: ' + (kontextStand().text || '?'));
    } catch (e) { /* ignore */ }
    if (mangel.length) {
      setBadge('error', 'Oberfläche geändert: ' + mangel[0]);
      selfTestRunning = false;
      return;
    }
    setBadge('ready', 'Verbunden');
    selfTestRunning = false;
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

  // Klick auf die Pill: beide Selbsttests erneut ausloesen.
  badge.addEventListener('click', function () {
    if (!window.opener) { setBadge('error', 'Tab aus der App öffnen'); return; }
    runAppReachTest();
    setTimeout(function () { runSelfTest(); }, 300);
  });

  // Beim Aktivieren dem oeffnenden App-Fenster Bescheid geben → die App
  // uebernimmt das Fenster-Handle (event.source) und kann zuverlaessig pingen,
  // ohne den Tab per window.open neu zu laden.
  if (window.opener) {
    try {
      window.opener.postMessage({ type: 'tf-bridge-ready', rev: BRIDGE_REV,
        modelle: modelleListe(), kontextText: kontextStand().text }, '*');
    } catch (e) { /* ignore */ }
    setTimeout(function () { runAppReachTest(); }, 300);
    setTimeout(function () { runSelfTest(); }, 1500);
  } else {
    setBadge('error', 'Tab aus der App öffnen');
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || !data.type) return;

    if (data.type === 'tf-ping') {
      setBadge('ready', 'Verbunden');
      // `rev` mitschicken: die App erkennt daran ein veraltetes Bookmarklet und
      // rechnet bis zur Neuinstallation mit dem kleinen Kontextfenster.
      // `modelle` bei JEDEM Ping: so erfaehrt die App von einer geaenderten
      // Auswahlliste, bevor ein Auftrag daran scheitert — und nicht erst mittendrin.
      event.source.postMessage({ type: 'tf-pong', rev: BRIDGE_REV,
        modelle: modelleListe(), kontextText: kontextStand().text }, '*');
      return;
    }
    if (data.type === 'tf-reset') {
      // Optionales `modell`: erst das Modell setzen, dann zuruecksetzen. Die
      // Reihenfolge ist unkritisch (ein Modellwechsel loescht den Verlauf nicht),
      // aber so steht schon vor dem Reset fest, welches Fenster gilt.
      ensureModell(typeof data.modell === 'string' ? data.modell : null, function (zielErr) {
        if (zielErr) {
          setBadge('working', 'Kein Reset: ' + zielErr);
          event.source.postMessage({ type: 'tf-reset-done', id: data.id, found: false,
            modelle: modelleListe(), grund: zielErr }, '*');
          return;
        }
        resetChat(function (found) {
          setBadge(found ? 'ready' : 'working', found ? 'Chat zurückgesetzt' : 'Kein Reset-Weg');
          event.source.postMessage({ type: 'tf-reset-done', id: data.id, found: found,
            modelle: modelleListe() }, '*');
        });
      });
      return;
    }
    if (data.type === 'tf-request') {
      // `data.erwarte` (Abschluss-Marker) wird bewusst IGNORIERT: er war der
      // Ersatz fuer ein fehlendes Fertig-Signal, und das liefert der Strom jetzt
      // als `done`. Das Feld bleibt app-seitig vorerst bestehen, damit ein
      // aelterer Build gegen dieses Snippet weiterlaeuft.
      runRequest(event.source, data.id, String(data.message || ''),
        typeof data.modell === 'string' ? data.modell : null);
      return;
    }
  });
})();
