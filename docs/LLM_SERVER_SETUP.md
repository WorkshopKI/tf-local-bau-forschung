# LLM-Server-Setup & Tuning (llama.cpp)

Ops-Guide für die lokalen llama.cpp-Server, gegen die TeamFlow spricht. Zwei
getrennte Server-Profile, bewusst nicht mischen:

| | **Chat** | **Indexierung** |
|---|---|---|
| Script | [Chat-Server-Qwen.bat](../Chat-Server-Qwen.bat) | [Dokumentenindex-aktualisieren-Qwen.bat](../Dokumentenindex-aktualisieren-Qwen.bat) |
| Port | **9090** (App-Default „Intern API") | 9091 |
| Kontext | 49152 | 8192 |
| Reasoning | `auto` (Denkprozess an, App-Toggle) | `off` (Metadaten-Extraktion braucht kein Thinking) |
| KV-Cache | q8_0 | q4_0 |
| Threads | auto (physische Kerne) | 4 |
| Parallel-Slots | 1 | auto |
| `-b`/`-ub` | 2048/2048 | Default (2048/512) |

Beide teilen `dokumentenindex-dateien/` (gleiche `llama-server.exe`, gleiches
GGUF — kein doppelter 18-GB-Download). **Nicht gleichzeitig laufen lassen** —
zwei Server à ~10 GB VRAM passen nicht auf eine 12-GB-Karte.

Die Indexier-Settings sind bewusst so (kleiner Kontext = wenig VRAM pro Slot,
Reasoning off = schnelle strukturierte Extraktion). Fürs Chatten waren sie die
Bremse: Kontext 8192 läuft mit App-Anhängen sofort über → Context-Shift
invalidiert den Prompt-Cache jede Runde → kompletter Re-Prozess pro Turn.

## Warum Kontext 49152?

Die Chat-App sendet pro Turn bis zu:

- 24.000 Zeichen Historie (`HISTORY_CHAR_BUDGET`, [conversation-context.ts](../src/plugins/chat/conversation-context.ts))
- 60.000 Zeichen Anhänge (`MAX_TOTAL_ATTACHMENT_CHARS`, [attachment-context.ts](../src/plugins/chat/attachments/attachment-context.ts))

Real gemessen: 39.105 Prompt-Tokens bei einer Dokument-Zusammenfassung.
32768 wäre zu klein; 49152 hat Luft. Passt der Prompt nicht in den Kontext,
shiftet llama.cpp und der Prefix-Cache ist tot — dann zahlt man das volle
Prompt-Processing bei *jeder* Folgefrage statt nur beim ersten Turn.

## Symptom → Stellschraube

| Symptom | Schraube | Wirkung |
|---|---|---|
| Lange Wartezeit vor dem ersten Token (TTFT) | `-ub 2048 -b 2048` | Batched Prompt-Processing auf GPU trotz CPU-Experten — größter Einzelhebel bei MoE-CPU-Offload |
| TTFT bei *Folgefragen* im selben Gespräch | Kontext groß genug (`-c`) + Prompt-Cache (Server-Default an) | Folge-Turn verarbeitet nur den neuen Suffix → nahezu sofort |
| Text tröpfelt (niedrige t/s) | `--n-cpu-moe` senken, `-t` = physische Kerne, `--no-mmap --mlock` | Mehr Experten-Layer auf GPU, CPU-GEMMs voll parallel, keine Page-Fault-Stalls |
| Antwort dauert trotz allem Minuten | Denkprozess (Qwen-Thinking) | In der App per Gehirn-Icon in der Chat-Leiste abschalten — Thinking schreibt oft tausende Tokens vor der Antwort |
| Aw-Snap / OOM beim Serverstart | `--n-cpu-moe` erhöhen, notfalls `cache_type_v` auf q4_0 | Weniger VRAM-Bedarf |

## `n_cpu_moe` tasten (MoE-Experten auf CPU)

`--n-cpu-moe N` legt die Experten-Tensoren der ersten N Layer auf die CPU —
Attention + Dense bleiben auf GPU. Referenzpunkt: **RTX 3060 12 GB → 26**
(mit Kontext 49152 + KV q8_0).

1. Server starten, `nvidia-smi` beobachten.
2. ≥ 1 GB VRAM frei → N in `config-chat-qwen.json` um 2 senken (mehr t/s).
3. OOM / Absturz → N um 2–4 erhöhen.
4. Mehr VRAM (16 GB+): Startwert ~20; weniger (8 GB): Startwert ~36.

## Erwartungswerte (Qwen 3.6 35B-A3B Q4_K_M, RTX 3060 12 GB, i5-9600K)

Gemessen mit Indexier-Profil (Baseline) — Chat-Profil-Ziele in Klammern:

- Prompt-Processing: ~360 t/s (Ziel mit `-ub 2048`: deutlich darüber; 39k-Token-Dokument von ~108 s Richtung ~40–60 s)
- Generierung: ~20 t/s — das ist auf dieser Hardware **nahe am Maximum**
  (3B aktive Parameter auf 6-Kern-CPU); Threads 4→6 und kleineres
  `n_cpu_moe` bringen einstellige bis niedrige zweistellige Prozente
- Thinking-Antwort mit 4096 Tokens: ~3,5 min Generierung — by design;
  wer es eilig hat, schaltet den Denkprozess in der App aus

## App-Seite

- Der DirectLLM-Transport sendet `cache_prompt: true` (Absicherung — aktuelle
  llama.cpp-Builds haben den Prompt-Cache ohnehin default-an) und übersetzt
  den Denkprozess-Toggle in `chat_template_kwargs.enable_thinking = false`
  ([direct-llm.ts](../src/core/services/ai/transports/direct-llm.ts)).
- Endpoint-Wechsel: Einstellungen → KI-Provider → „Intern API",
  `http://localhost:9090/v1`.
