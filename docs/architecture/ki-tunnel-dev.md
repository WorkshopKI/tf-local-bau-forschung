# Interne KI von der Dev-Maschine aus erreichen (Tunnel)

Die interne KI (`gpt.vdivde-it.de`) liegt hinter dem VPN, und das VPN hat nur der Firmenlaptop.
Damit war jeder Use-Case, der sie braucht — Gutachten-Abschnitte, Aufbereitung, Nachforderungen,
Assistent —, von der Dev-Maschine aus **gar nicht** prüfbar und blieb Handarbeit auf dem zweiten
Rechner. Dieses Dokument beschreibt den Weg, der ihn hierher holt.

## Was hier NICHT gebaut wurde — und warum das der Kern ist

Es entsteht **keine zweite Bridge**. Die [KI-Bridge](ki-bridge.md) ist bereits eine
Zwei-Tab-Konstruktion:

```
App-Tab  ⟷  postMessage  ⟷  KI-Tab (Lesezeichen)  ⟷  HTTP/SSE  ⟷  interne KI
```

Tab eins liefert [`npm run dev:local`](local-variante.md) längst. Tab zwei fehlte allein deshalb,
weil der Host von hier aus nicht auflösbar ist. Gebraucht wird also ein **Netzweg**, kein Protokoll —
und der kostet **keine Zeile Produktivcode**.

Möglich wird das durch den Zugangsweg der internen KI: sie fragt nicht nach einer Anmeldung. Wer im
Netz ist, ist drin (belegt im Inkognito-Fenster: der Chat kommt sofort). Damit reicht eine reine
TCP-Weiterleitung; der Umweg über den Browser des Laptops — Relais im Lesezeichen, neues Protokoll,
neues Lesezeichen für das ganze Team — entfällt ersatzlos.

## Der Aufbau

```
Firmenlaptop (VPN aktiv)                    Dev-Maschine WIN11CORE6
  laptop-tunnel.cmd
  ssh -N -R 443:gpt.vdivde-it.de:443 ──┐
        ausgehend, Port 22             │
                                       ▼
                              sshd bindet 127.0.0.1:443
                                       ▲
                              hosts: 127.0.0.1 gpt.vdivde-it.de
                                       │
                              Chrome / Browser-Pane
                                Tab 1  App   localhost:5175
                                Tab 2  KI    https://gpt.vdivde-it.de/
```

Vier Eigenschaften, die diesen Zuschnitt tragen:

- **Nichts zu konfigurieren.** Die App behält ihren Vorgabewert `https://gpt.vdivde-it.de/`
  ([connect-ki.ts](../../src/core/services/ai/connect-ki.ts)). Origin-Pinning, `classifyProvider`
  (→ `intern`) und das Lesezeichen bleiben unangetastet. Ein Tunnel auf einen Loopback-Port wäre
  auch gegangen — der Endpunkt ist im Dev-Kontext editierbar —, hätte aber einen lokalen Proxy
  gebraucht und die Origin gegenüber der Produktion verschoben.
- **TLS bleibt Ende-zu-Ende.** Der Browser handelt direkt mit dem echten Server; die Dev-Maschine
  terminiert nichts und sieht keinen Klartext. Ein Proxy täte genau das.
- **Produktionsgleich.** Dieselbe Adresse, dieselbe Origin, dasselbe Zertifikat.
- **Ein Host, ein Port.** `-R 443:gpt.vdivde-it.de:443` führt genau ein Ziel. Kein `-D`, kein SOCKS,
  kein allgemeiner Weg ins Firmennetz.

> Der Laptop braucht **keine** Admin-Rechte und bekommt nichts installiert: `ssh.exe` ist Teil von
> Windows, und die Verbindung ist ausgehend — es lauscht dort kein Port, also fragt auch keine
> Firewall. Die erhöhten Rechte fallen alle auf der Dev-Maschine an, einmalig.

## Einrichtung

### 1 · SSH-Server auf der Dev-Maschine

Einmalig, in einer **PowerShell als Administrator**:

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0; Set-Service sshd -StartupType Manual; Start-Service sshd
```

`StartupType Manual` ist Absicht: der Dienst läuft, wenn er gebraucht wird, nicht dauerhaft.
Die Installation legt die Firewall-Regel `OpenSSH-Server-In-TCP` gleich mit an — das ist der Grund,
diesen Schritt **vor** die Messung zu ziehen: sonst wäre ein fehlgeschlagener Verbindungstest nicht
zuzuordnen (VPN oder eigene Firewall?).

Nachgemessen, damit das kein Argument bleibt: ein Verbindungsversuch auf `192.168.2.125:22` läuft
vor der Installation in einen **Timeout**. Ein geschlossener Port antwortet mit RST („Connection
refused"); ein Timeout heißt, die Firewall verwirft die Pakete still. Eine Messung vom Laptop aus
hätte vorher also in jedem Fall `False` geliefert — unabhängig davon, was das VPN tut.

**Dieselbe Stille tritt später wieder auf, und das ist der Punkt:** die Regel ist an das *Programm*
`%SystemRoot%\system32\OpenSSH\sshd.exe` gebunden, nicht an Port 22 allein. Steht der Dienst — nach
jedem Neustart, siehe `StartupType Manual` —, greift sie nicht, und der Laptop sieht wieder einen
**Timeout**. Ein Timeout belegt also **nicht**, dass es am Netz liegt; `Get-Service sshd` steht vor
jeder Suche nach DHCP-Wechsel oder VPN.

### 2 · Netzweg messen

Auf dem **Firmenlaptop, bei aufgebautem VPN**:

```powershell
Test-NetConnection 192.168.2.125 -Port 22
```

- `TcpTestSucceeded : True` → weiter mit Schritt 3.
- `False` → denselben Test **ohne** VPN wiederholen. Klappt er dann, kappt der VPN-Client das
  lokale Netz; viele Clients haben dafür einen Schalter in der Art „local LAN access". Klappt er
  auch ohne VPN nicht, liegt es am Netz zwischen den Geräten.

`ping` ist als Gegenprobe untauglich — ICMP wird oft geblockt, während TCP durchgeht (und
umgekehrt).

### 3 · Öffentlichen Schlüssel hinterlegen

Auf dem Laptop, falls noch kein Schlüssel existiert:

```powershell
ssh-keygen -t ed25519
```

Der **öffentliche** Teil (`%USERPROFILE%\.ssh\id_ed25519.pub`) gehört auf die Dev-Maschine.

> **Der Fallstrick, der hier zuverlässig zuschlägt:** `tom` ist auf `WIN11CORE6` Mitglied der
> Administratoren. Für solche Konten liest Windows-OpenSSH **nicht** `~/.ssh/authorized_keys`,
> sondern `C:\ProgramData\ssh\administrators_authorized_keys` (die `Match Group administrators`-Regel
> am Ende von `sshd_config`). Der falsche Ort ist die häufigste Ursache für „der Schlüssel wird
> ignoriert, es fragt weiter nach dem Passwort". Zusätzlich verweigert sshd die Datei
> **kommentarlos**, wenn ihre Rechte zu weit sind — nur `SYSTEM` und `Administratoren` dürfen darauf.
> Deshalb `icacls` mit **SIDs** statt Gruppennamen: `Administratoren` heißt auf einem englischen
> Windows `Administrators`, und die Zeile schlüge dort fehl.

Die gesetzten Rechte prüfen sich selbst: danach ist die Datei **ohne Erhöhung nicht mehr lesbar**
(`Get-Content` wirft `UnauthorizedAccessException`, `icacls` meldet „Zugriff verweigert"). Das ist
das erwartete Ergebnis, kein Fehlschlag.

In einer PowerShell als Administrator auf der Dev-Maschine (Schlüsseltext vorher einfügen):

```powershell
$k = 'ssh-ed25519 AAAA... laptop'; $f = "$env:ProgramData\ssh\administrators_authorized_keys"; Add-Content -Path $f -Value $k -Encoding ascii; icacls $f /inheritance:r /grant '*S-1-5-18:F' /grant '*S-1-5-32-544:F'
```

Danach die Passwort-Anmeldung schließen — **zwei** Direktiven, nicht eine:

```powershell
$c = "$env:ProgramData\ssh\sshd_config"; $t = @(Get-Content $c) -notmatch '^\s*#?\s*(PasswordAuthentication|KbdInteractiveAuthentication|ChallengeResponseAuthentication)\b'; (@('PasswordAuthentication no', 'KbdInteractiveAuthentication no') + $t) | Set-Content $c -Encoding ascii; Restart-Service sshd
```

**Das ist kein Feinschliff, und die zweite Zeile ist der Punkt.** Frisch installiert bietet sshd
`publickey,password,keyboard-interactive` an — Port 22 steht im LAN offen und nimmt Passwörter
entgegen. Setzt man nur `PasswordAuthentication no`, meldet der Server danach
`publickey,keyboard-interactive`, und das sieht aus wie erledigt: Windows-OpenSSH bedient
`keyboard-interactive` aber **ebenfalls mit dem Konto-Passwort**. Die Passwort-Anmeldung wäre
halb geschlossen und der Zustand nicht von „zu" zu unterscheiden.

Die neuen Zeilen kommen an den **Anfang** der Datei: hinter dem `Match Group administrators`-Block
am Dateiende gälten sie nur für diesen Block, und bei OpenSSH gewinnt ohnehin der zuerst gefundene
Wert. Kontrolle: `ssh -o BatchMode=yes tom@<ip> exit` muss `Permission denied (publickey)` melden —
**nur** das eine Wort in der Klammer.

### 4 · hosts-Eintrag auf der Dev-Maschine

Eine Zeile in `C:\Windows\System32\drivers\etc\hosts` (Editor als Administrator):

```
127.0.0.1 gpt.vdivde-it.de
```

Solange die Zeile steht und der Tunnel **nicht** läuft, ist die Adresse von hier aus tot statt
unauflösbar. Das sieht anders aus als vorher, ist aber derselbe Zustand: erreichbar war sie hier nie.

### 5 · Firmen-CA importieren

Die interne KI trägt **kein öffentliches Zertifikat**: ausgestellt von `CN=vdivde-it-CA, DC=vdivde-it, DC=de`,
der firmeneigenen Stelle. Der Firmenlaptop kennt sie über die Domäne, die Dev-Maschine nicht — dort
scheitert die Verbindung mit `SEC_E_UNTRUSTED_ROOT`, und der Browser zeigt eine Warnseite.

Das ist **keine** Folge des Tunnels: TLS läuft Ende-zu-Ende, es terminiert nichts dazwischen. Der
Name im Zertifikat (`CN=gpt.vdivde-it.de`) stimmt, es fehlt allein die Wurzel im Speicher.

Auf dem Laptop exportieren — `$env:TEMP` statt Desktop, der ist auf Firmengeräten oft umgeleitet:

```powershell
$c = @(Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Subject -like '*vdivde-it-CA*' }); $p = Join-Path $env:TEMP 'vdivde-it-CA.cer'; Export-Certificate -Cert $c[0] -FilePath $p -ErrorAction Stop | Out-Null; "OK -> $p"
```

Herüberkopieren (`scp` läuft über dieselbe Verbindung), dann auf der Dev-Maschine **prüfen, bevor
vertraut wird**: Fingerabdruck gegen den vom Laptop halten, und die Kette der KI gegen die Datei
bauen (`X509Chain` mit `ExtraStore` + `AllowUnknownCertificateAuthority`). Erst wenn die Wurzel der
Kette diese CA ist, ist belegt, dass es die richtige ist.

Der Import selbst ist **Handarbeit und muss es sein**: `Import-Certificate` in
`Cert:\CurrentUser\Root` verlangt eine Bestätigung am Bildschirm und bricht in einer nicht
interaktiven Sitzung mit „Die Benutzeroberfläche ist für diesen Vorgang nicht zulässig" ab. Genau
dafür ist die Sperre da — kein Hintergrundprozess soll still einen Stamm hinzufügen.

```powershell
Import-Certificate -FilePath "<pfad>\vdivde-it-CA.cer" -CertStoreLocation Cert:\CurrentUser\Root
```

**Benutzer-Speicher, nicht maschinenweit** — die Wirkung bleibt auf ein Konto begrenzt und es
braucht keine Admin-Rechte. Bewusst abwägen: eine importierte CA darf Zertifikate für **jede**
Domain ausstellen, denen dieser Speicher glaubt, nicht nur für die interne KI.

**Nachwirkung, die kein Fehler ist:** die Sperrlisten-Prüfung bleibt offline — der CRL-Server liegt
im Firmennetz, und der Tunnel führt bewusst nur den einen Host. `curl`s schannel-Backend wertet das
hart (`CRYPT_E_REVOCATION_OFFLINE`) und braucht `--ssl-revoke-best-effort`; Browser werten es weich
und verbinden ohne Zutun.

### 6 · Tunnel starten

[`scripts/ki-tunnel/laptop-tunnel.cmd`](../../scripts/ki-tunnel/laptop-tunnel.cmd) auf den Laptop
kopieren und per Doppelklick starten, solange das VPN steht. Das Fenster bleibt offen; `Strg+C`
beendet den Tunnel. Bricht die Verbindung ab (VPN-Neuaufbau, Standby), baut die Schleife sie neu auf.

## Abnahme

Aufsteigend. Jeder Schritt schließt eine Fehlerursache aus, bevor der nächste sie verdecken kann.

**1 · Der ganze Netzweg, ohne Browser** — auf der Dev-Maschine:

```
curl.exe -sS -o NUL -w "%{http_code}\n" https://gpt.vdivde-it.de/
```

`200` belegt in einem Kommando vier Dinge auf einmal: der hosts-Eintrag greift, sshd leitet weiter,
der Laptop erreicht die interne KI, und das Zertifikat validiert gegen den **echten** Namen. Ein
Zertifikatsfehler an dieser Stelle hieße, dass etwas dazwischen TLS terminiert — dann stimmt der
Aufbau nicht.

**2 · Auflösung im Browser** — die Adresse aufrufen, die Seite muss laden. Chromium bringt einen
eigenen Resolver mit und je nach Einstellung Secure DNS (DoH); dass er die hosts-Datei
berücksichtigt, ist der eine Punkt, den kein Vorab-Test klärt. Lädt sie nicht, ist Secure DNS der
erste Verdacht (in den Chrome-Einstellungen abschaltbar).

**3 · Bridge** — in der App: Einstellungen → KI → „Verbindung testen". Im KI-Tab prüft
`pruefeAnschluss()` die sechs Voraussetzungen einzeln (Sitzungs-Id, Chat-Formular, Sende-Adresse,
Modell-Auswahl, Reset-Weg, Kontextleiste) und benennt die erste fehlende.

**4 · Ein echter Lauf** — einen Gutachten-Abschnitt erzeugen. Er belegt in einem Durchgang genau
die drei Dinge, die laut [ki-bridge.md](ki-bridge.md) **kein** lokaler Test abdecken kann: dass die
aus der Seite abgelesenen Endpunkte stimmen, dass der Modellwechsel durchschlägt und dass `done`
den Lauf beendet.

## Eine Abnahme-Sitzung fahren — und wo die Automatisierung endet

**Genau ein Handgriff bleibt — und zwar nur einmal pro Sitzung: den KI-Tab öffnen.** Alles danach,
das Lesezeichen eingeschlossen, läuft automatisch.

Die Werkzeuge unterscheiden sich dabei deutlich; gemessen, damit niemand die falsche Oberfläche
wählt:

| | `window.open` aus der App | `fetch` der KI-Seite | Skript in den KI-Tab |
|---|---|---|---|
| **Browser-Pane** von Claude Code | `null`, auch aus echter Geste ([Bug-Klasse](recurring-bug-classes.md)) | `net::ERR_BLOCKED_BY_CLIENT` | unerreichbar |
| **Claude in Chrome** | öffnet aus echter Geste; ein Skript-`.click()` wird geblockt | frei | **möglich** — der Popup landet in derselben Tab-Gruppe |

Die Pane scheidet damit aus. In der Chrome-Anbindung nimmt Chrome den von der App geöffneten Popup
in dieselbe Tab-Gruppe auf, und ab da ist er steuerbar wie jeder andere Tab.

**Das Lesezeichen lässt sich nachschießen**, ohne es anzuklicken und ohne den 50 kB großen
Snippet-Text durch den Agenten zu schleifen: die beiden Tabs reichen ihn sich **browserintern**
weiter. Im App-Tab einen Beantworter registrieren, im KI-Tab über `window.opener` danach fragen und
das Ergebnis auswerten:

```js
// App-Tab: Anker aus der offenen Klappe lesen, dann auf Anfrage herausgeben
window.__snippetSrc = decodeURIComponent(
  document.querySelector('a[href^="javascript:"]').getAttribute('href').slice('javascript:'.length));
window.addEventListener('message', e => {
  if (e.data === 'tf-gib-snippet' && e.source) e.source.postMessage({ tfSnippet: window.__snippetSrc }, '*');
});

// KI-Tab: annehmen und ausführen — das IST der Lesezeichen-Klick
window.addEventListener('message', e => {
  if (typeof e.data?.tfSnippet === 'string') (0, eval)(e.data.tfSnippet);
});
window.opener.postMessage('tf-gib-snippet', '*');
```

Gemessen: 49.675 Zeichen übertragen, `window.__teamflowBridge` vorhanden, Pille „Verbunden",
Tab-Titel `✅ Verbunden · AitisiGPT`, App-Seite meldet „Interne KI verbunden" — und ein
Assistenten-Turn danach antwortete in 4,5 s. Das trägt auch **nach einem Neuladen** des KI-Tabs:
`window.opener` überlebt es, der Weg ist also wiederholbar.

**Der Ablauf:**

1. `npm run dev:local` → App auf 5175, `await window.__tf.bereit()`. Bei frischer IDB dieses
   Browserprofils erst das Umzugs-Banner wegklicken (synthetisches Handle, kein Dialog).
2. Einstellungen → Daten & Verbindungen → „Interne KI" → Klappe **„Verbindung einrichten"**
   aufklappen. Der `javascript:`-Anker wird erst dabei montiert (Callback-Ref statt Mount-Effekt);
   bei geschlossener Klappe steht er nicht im DOM. **Zustand prüfen statt toggeln** — ein blinder
   Klick auf eine offene Klappe schließt sie, und der Anker verschwindet wieder.
3. „Interne KI öffnen" als **echte** Geste klicken (`computer` mit `ref`). Das ist der eine Schritt,
   der einen Menschen oder die Maus-Schnittstelle braucht.
4. Snippet nachschießen wie oben. Kein Ziehen in die Lesezeichenleiste nötig — die braucht nur, wer
   die Bridge von Hand benutzt.
5. Ab hier läuft alles über den App-Tab: Skill-Läufe starten, Ergebnisse und `window.__tf.fehler()`
   auslesen.

> Ein Gutachten-Abschnitt braucht zusätzlich eine **Vorhabensbeschreibung** am Verbund — ohne sie
> zeigt die Sektion nur ihre Ablagefläche. Für einen reinen Verbindungsnachweis ist ein
> Assistenten-Turn der kürzere Weg: shell-weit eingehängt, ein Prompt, ein Lauf.

## Fehlersuche

| Bild | Ursache zuerst prüfen |
|---|---|
| `ssh` bricht sofort ab, „remote port forwarding failed" | Auf der Dev-Maschine belegt etwas Port 443 (`Get-NetTCPConnection -State Listen`). Genau dafür steht `ExitOnForwardFailure=yes` in der `.cmd`: **ohne** den Schalter käme die Sitzung zustande und der Tunnel wäre trotzdem tot — eine lebende Verbindung, die nichts weiterleitet. |
| `ssh` läuft, aber `curl` meldet „Connection refused" | Die Weiterleitung bindet nicht auf Loopback (`Get-NetTCPConnection -State Listen` → Port 443 auf `127.0.0.1` **und** `::1`). Am Dienst liegt es hier nicht: steht eine SSH-Sitzung, läuft `sshd` per Definition. |
| Nach einem **Neustart der Dev-Maschine** verbindet der Laptop nicht mehr | `sshd` steht bewusst auf `StartupType Manual` — der Dienst läuft, wenn er gebraucht wird, nicht dauerhaft. `Start-Service sshd` (erhöht). Von außen sieht dieser Zustand wie ein **Timeout** aus, nicht wie „Connection refused" (Zeile darunter). Wer den Tunnel täglich nutzt, stellt auf `Automatic` um und nimmt die dauerhaft offene Tür in Kauf. |
| „Connection timed out" beim Verbinden | **Zuerst `Get-Service sshd`.** `Stopped` ist bereits die Antwort — die Firewall-Regel hängt am Programm (Schritt 1), greift ohne laufenden Dienst nicht und verwirft die Pakete still. Erst danach die Leitung verdächtigen: IP der Dev-Maschine per DHCP gewechselt (im Router reservieren oder in der `.cmd` nachziehen), oder ein VPN-Client kappt das lokale Netz (Schritt 2). Gemessen: ein aktiver NordVPN-Tunnel **auf der Dev-Maschine** stört nicht — der Weg lief mit `NordLynx` oben. |
| Schlüssel wird ignoriert, es fragt nach dem Passwort | `administrators_authorized_keys` statt `~/.ssh/authorized_keys`, oder die Rechte an der Datei sind zu weit (Schritt 3). |
| **„REMOTE HOST IDENTIFICATION HAS CHANGED!"** beim ersten Verbinden | Erwartbar: `sshd` erzeugt seine Host-Schlüssel bei der Installation neu, und die Adresse kommt per DHCP — im `known_hosts` des Laptops kann noch ein Eintrag eines Vorgängers stehen. **Nicht blind bestätigen**, die Meldung sieht bei einem Angriff genauso aus. Den echten Fingerabdruck auf der Dev-Maschine über **Loopback** holen (nicht über das LAN, sonst prüft man die Leitung mit sich selbst): `ssh-keyscan -t ecdsa,ed25519 127.0.0.1 \| ssh-keygen -lf -`. Stimmt er mit dem gemeldeten überein, auf dem Laptop `ssh-keygen -R <ip>` und neu verbinden. |
| Port lässt sich nicht binden, obwohl frei | Windows reserviert Portbereiche vorab (Hyper-V/WSL): `netsh interface ipv4 show excludedportrange protocol=tcp`. Für 443 und 22 auf dieser Maschine geprüft — beide liegen außerhalb. |
| Browser lädt die Seite nicht, `curl` schon | Secure DNS (DoH) im Browser umgeht die hosts-Datei — abschalten. |

## Was das nicht ersetzt

- **Den `file://`-Smoke.** Der Dev-Server ist permissiver als ein Single-File-Build; die
  `file://`-Constraints fallen hier nicht auf. Nach jedem `BRIDGE_REV`-Bump bleibt der Handtest
  gegen `dist-single/` Pflicht — mit dem Unterschied, dass er jetzt **hier** stattfinden kann und
  nicht auf dem zweiten Rechner.
- **Das Team.** Der Tunnel ist ein Werkzeug dieser einen Maschine. Am Weg der Nutzer zur internen
  KI ändert sich nichts.
- **Pitfall #36.** Der Chat bleibt zustandsbehaftet; jeder Einzel-Lauf resettet weiterhin zuerst.

## Stand

**Der Weg steht und ist gemessen** (August 2026, `WIN11CORE6` ↔ Laptop `V3283`):

| Prüfung | Ergebnis |
|---|---|
| TCP vom Laptop (VPN aktiv) auf `192.168.2.125:22` | `TcpTestSucceeded : True` |
| Nur noch Schlüssel-Anmeldung | `Permission denied (publickey)` — ein Wort in der Klammer |
| Weiterleitung | `remote forward success for: listen 443, connect gpt.vdivde-it.de:443` |
| `curl` mit voller Zertifikatsprüfung | **HTTP 200**, TLS-Handshake 0,22 s, gesamt 0,42 s |
| Seite im Browser | `https://gpt.vdivde-it.de/` · „AitisiGPT" · `#shell[data-sid]` · `#sendform` → `/send` · Modelle gpt-oss-120b / Qwen3.6-35B / Qwen3-VL-30B · „Chatlänge [Token]: 0k von 62k" |

Chromium berücksichtigt die hosts-Datei; Secure DNS läuft **nicht** daran vorbei — das war vorab
nicht messbar und ist damit erledigt.

**Nachgemessen am 09.09.2026**, nachdem der Laptop nur noch Timeouts sah: `sshd` stand auf
`Stopped`. Ein `Start-Service sshd` (erhöht) genügte — die Schleife in der `.cmd` baute den Tunnel
binnen Sekunden selbst wieder auf, `curl` meldete erneut **HTTP 200** (TLS 0,17 s, gesamt 0,34 s).
Der Weg trägt also über Neustarts hinweg; er braucht nur den einen Handgriff.

**Ein vollständiger Lauf ist durch**: Assistenten-Turn aus dem App-Tab → `postMessage` → KI-Tab →
`/send` + SSE → Tunnel → VPN → interne KI → Antwort zurück, 0 Konsolenfehler. Die Bridge wurde dabei
einmal absichtlich zerstört (Neuladen des KI-Tabs) und **vom Agenten selbst** wieder eingesetzt.

Zwei Dinge fielen dabei an, die vorher niemand wissen konnte: die interne KI hängt an einer
firmeneigenen CA (Schritt 5), und die Sperrlisten-Prüfung bleibt naturgemäß offline.
