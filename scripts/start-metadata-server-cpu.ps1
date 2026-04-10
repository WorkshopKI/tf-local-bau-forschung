#Requires -Version 5.1
# TeamFlow Local - Metadata-Extraktion Server (CPU-Modus)
# Wie die GPU-Variante, aber alles auf CPU. Langsamer, braucht kein VRAM.

$ErrorActionPreference = "Stop"

# --- Konfiguration (CPU-optimiert) ---
$SERVER_DIR = Join-Path $PSScriptRoot "metadata-server"
$LLAMA_DIR = Join-Path $SERVER_DIR "llama-cpp"
$MODEL_DIR = Join-Path $SERVER_DIR "models"
$SERVER_EXE = Join-Path $LLAMA_DIR "llama-server.exe"

$MODEL_URL = "https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_K_M.gguf"
$MODEL_FILE = Join-Path $MODEL_DIR "gemma-4-E4B-it-Q4_K_M.gguf"

$LLAMA_RELEASE_URL = "https://github.com/ggml-org/llama.cpp/releases/latest/download/llama-bin-win-cuda-cu12.4-x64.zip"
$LLAMA_ZIP = Join-Path $SERVER_DIR "llama-cpp.zip"

# CPU-optimierte Parameter
$PORT = 8081
$CONTEXT_SIZE = 16384    # Mehr Kontext moeglich ohne VRAM-Limit
$GPU_LAYERS = 0          # 0 = alles auf CPU
$THREADS = 8             # Mehr CPU-Threads

# --- Config-Datei laden (ueberschreibt Defaults) ---
$configFile = Join-Path $PSScriptRoot "metadata-server-config.json"
if (Test-Path $configFile) {
    $config = Get-Content $configFile -Raw | ConvertFrom-Json
    if ($config.port) { $PORT = $config.port }
    if ($config.context_size) { $CONTEXT_SIZE = $config.context_size }
    if ($config.threads) { $THREADS = $config.threads }
    if ($config.model_url) { $MODEL_URL = $config.model_url }
    if ($config.model) {
        $MODEL_FILE = Join-Path $MODEL_DIR $config.model
    }
    $GPU_LAYERS = 0
    Write-Host "  [i] Konfiguration geladen (CPU-Modus): $configFile" -ForegroundColor DarkGray
}

# --- Funktionen ---

function Write-Header {
    Write-Host ""
    Write-Host "  =====================================================" -ForegroundColor Cyan
    Write-Host "    TeamFlow Local - Metadata-Server (CPU)" -ForegroundColor Cyan
    Write-Host "    Gemma 4 E4B (Q4_K_M) auf localhost:$PORT" -ForegroundColor Cyan
    Write-Host "  =====================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Ensure-Directory($path) {
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
        Write-Host "  [+] Ordner erstellt: $path" -ForegroundColor Green
    }
}

function Download-File($url, $output, $description) {
    if (Test-Path $output) {
        $sizeMB = [math]::Round((Get-Item $output).Length / 1MB, 0)
        Write-Host "  [OK] $description vorhanden (${sizeMB} MB)" -ForegroundColor Green
        return
    }
    Write-Host "  [DL] $description wird heruntergeladen..." -ForegroundColor Yellow
    Write-Host "       URL: $url" -ForegroundColor DarkGray
    Write-Host "       Ziel: $output" -ForegroundColor DarkGray
    Write-Host "       Das kann einige Minuten dauern..." -ForegroundColor DarkGray

    $ProgressPreference = 'Continue'
    try {
        Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing
    } catch {
        Write-Host "  [!] Download fehlgeschlagen: $_" -ForegroundColor Red
        Write-Host "      Bitte manuell herunterladen und ablegen in:" -ForegroundColor Red
        Write-Host "      $output" -ForegroundColor Red
        exit 1
    }
    $sizeMB = [math]::Round((Get-Item $output).Length / 1MB, 0)
    Write-Host "  [OK] $description heruntergeladen (${sizeMB} MB)" -ForegroundColor Green
}

# --- Hauptprogramm ---

Write-Header
Ensure-Directory $SERVER_DIR
Ensure-Directory $LLAMA_DIR
Ensure-Directory $MODEL_DIR

# Schritt 1: llama.cpp herunterladen + entpacken
if (-not (Test-Path $SERVER_EXE)) {
    Download-File $LLAMA_RELEASE_URL $LLAMA_ZIP "llama.cpp CUDA"

    Write-Host "  [..] Entpacke llama.cpp..." -ForegroundColor Yellow
    Expand-Archive -Path $LLAMA_ZIP -DestinationPath $LLAMA_DIR -Force

    $found = Get-ChildItem -Path $LLAMA_DIR -Recurse -Filter "llama-server.exe" | Select-Object -First 1
    if ($found -and $found.DirectoryName -ne $LLAMA_DIR) {
        Get-ChildItem -Path $found.DirectoryName -File | Copy-Item -Destination $LLAMA_DIR -Force
        Get-ChildItem -Path $found.DirectoryName -Directory | Copy-Item -Destination $LLAMA_DIR -Recurse -Force
    }

    if (-not (Test-Path $SERVER_EXE)) {
        Write-Host "  [!] llama-server.exe nicht gefunden nach Entpacken." -ForegroundColor Red
        Write-Host "      Bitte manuell von GitHub Releases herunterladen:" -ForegroundColor Red
        Write-Host "      https://github.com/ggml-org/llama.cpp/releases" -ForegroundColor Red
        exit 1
    }
    Write-Host "  [OK] llama.cpp bereit" -ForegroundColor Green
} else {
    Write-Host "  [OK] llama-server.exe vorhanden" -ForegroundColor Green
}

# Schritt 2: Modell herunterladen
Download-File $MODEL_URL $MODEL_FILE "Gemma 4 E4B Q4_K_M, ca. 5.3 GB"

# Schritt 3: Server starten (CPU-Modus)
Write-Host ""
Write-Host "  Server wird gestartet (CPU-Modus)..." -ForegroundColor Cyan
Write-Host "  ---------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Modell:     Gemma 4 E4B (Q4_K_M)" -ForegroundColor White
Write-Host "  Kontext:    $CONTEXT_SIZE Tokens" -ForegroundColor White
Write-Host "  GPU-Layers: $GPU_LAYERS (CPU only)" -ForegroundColor White
Write-Host "  Threads:    $THREADS" -ForegroundColor White
Write-Host "  Port:       http://localhost:$PORT" -ForegroundColor White
Write-Host "  ---------------------------------------------" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  HINWEIS: CPU-Modus ist deutlich langsamer als GPU!" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Druecke Ctrl+C zum Beenden." -ForegroundColor DarkGray
Write-Host ""

$serverArgs = @(
    "-m", $MODEL_FILE,
    "-c", $CONTEXT_SIZE,
    "-ngl", $GPU_LAYERS,
    "-t", $THREADS,
    "--port", $PORT,
    "--host", "127.0.0.1",
    "--chat-template-kwargs", "{`"enable_thinking`":false}",
    "--cors", "*"
)

& $SERVER_EXE @serverArgs
