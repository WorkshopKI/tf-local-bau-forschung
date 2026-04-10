#Requires -Version 5.1
param(
    [string]$Config = ""
)
# TeamFlow Local - Metadata-Extraktion Server
# Startet einen lokalen LLM-Server fuer Dokumenten-Metadaten.
# Keine Installation noetig. Einmalig ~6 GB Download.

$ErrorActionPreference = "Stop"

# --- Konfiguration (Defaults) ---
$SERVER_DIR = Join-Path $PSScriptRoot "metadata-server"
$LLAMA_DIR = Join-Path $SERVER_DIR "llama-cpp"
$MODEL_DIR = Join-Path $SERVER_DIR "models"
$SERVER_EXE = Join-Path $LLAMA_DIR "llama-server.exe"

# Modell: Gemma 4 E4B Q4_K_M (5.34 GB, beste Qualitaet fuer 6 GB VRAM)
$MODEL_URL = "https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-e4b-it-Q4_K_M.gguf"
$MODEL_FILE = Join-Path $MODEL_DIR "gemma-4-e4b-it-Q4_K_M.gguf"

# llama.cpp — wird automatisch von GitHub Releases geladen
$LLAMA_ZIP = Join-Path $SERVER_DIR "llama-cpp.zip"

# Server-Parameter
$PORT = 8081
$CONTEXT_SIZE = 8192     # Tokens. Erhoehen auf 16384/32768 wenn genug VRAM
$GPU_LAYERS = 99         # 99 = alle Layers auf GPU. Reduzieren wenn OOM
$THREADS = 4             # CPU-Threads fuer Nicht-GPU-Operationen

# --- Config-Datei laden (ueberschreibt Defaults) ---
if ($Config -and $Config -ne "") {
    $configFile = Resolve-Path $Config -ErrorAction SilentlyContinue
    if (-not $configFile) { $configFile = $Config }
} else {
    $configFile = Join-Path $PSScriptRoot "metadata-server-config.json"
}
if (Test-Path $configFile) {
    $config = Get-Content $configFile -Raw | ConvertFrom-Json
    if ($config.port) { $PORT = $config.port }
    if ($config.context_size) { $CONTEXT_SIZE = $config.context_size }
    if ($config.gpu_layers -ne $null) { $GPU_LAYERS = $config.gpu_layers }
    if ($config.threads) { $THREADS = $config.threads }
    if ($config.model_url) { $MODEL_URL = $config.model_url }
    if ($config.model) {
        $MODEL_FILE = Join-Path $MODEL_DIR $config.model
    }
    Write-Host "  [i] Konfiguration geladen: $configFile" -ForegroundColor DarkGray
    Write-Host "  [i] Modell: $($config.model)" -ForegroundColor DarkGray
}

# --- Funktionen ---

function Write-Header {
    $modelName = [System.IO.Path]::GetFileNameWithoutExtension($MODEL_FILE)
    Write-Host ""
    Write-Host "  =====================================================" -ForegroundColor Cyan
    Write-Host "    TeamFlow Local - Metadata-Server" -ForegroundColor Cyan
    Write-Host "    $modelName auf localhost:$PORT" -ForegroundColor Cyan
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
    # Aktuelle Release-URL von GitHub API ermitteln
    Write-Host "  [..] Suche aktuelles llama.cpp Release..." -ForegroundColor Yellow
    try {
        $releaseJson = Invoke-RestMethod -Uri "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest" -UseBasicParsing
        $asset = $releaseJson.assets | Where-Object { $_.name -match "bin-win-cuda-12.*x64\.zip$" -and $_.name -notmatch "cudart" } | Select-Object -First 1
        if (-not $asset) {
            Write-Host "  [!] Kein passendes CUDA-12 Windows-Asset gefunden." -ForegroundColor Red
            Write-Host "      Bitte manuell herunterladen: https://github.com/ggml-org/llama.cpp/releases" -ForegroundColor Red
            exit 1
        }
        $LLAMA_RELEASE_URL = $asset.browser_download_url
        Write-Host "  [OK] Gefunden: $($asset.name)" -ForegroundColor Green
    } catch {
        Write-Host "  [!] GitHub API nicht erreichbar: $_" -ForegroundColor Red
        exit 1
    }
    Download-File $LLAMA_RELEASE_URL $LLAMA_ZIP "llama.cpp CUDA"

    Write-Host "  [..] Entpacke llama.cpp..." -ForegroundColor Yellow
    Expand-Archive -Path $LLAMA_ZIP -DestinationPath $LLAMA_DIR -Force

    # llama-server.exe kann in einem Unterordner sein
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
$modelName = [System.IO.Path]::GetFileNameWithoutExtension($MODEL_FILE)
Download-File $MODEL_URL $MODEL_FILE "$modelName"

# Schritt 3: Server starten
Write-Host ""
Write-Host "  Server wird gestartet..." -ForegroundColor Cyan
Write-Host "  ---------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Modell:     $modelName" -ForegroundColor White
Write-Host "  Kontext:    $CONTEXT_SIZE Tokens" -ForegroundColor White
Write-Host "  GPU-Layers: $GPU_LAYERS (99 = alle)" -ForegroundColor White
Write-Host "  Port:       http://localhost:$PORT" -ForegroundColor White
Write-Host "  ---------------------------------------------" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  In TeamFlow: Einstellungen > KI-Assistent" -ForegroundColor Yellow
Write-Host "  Provider: Intern API" -ForegroundColor Yellow
Write-Host "  Endpoint: http://localhost:$PORT" -ForegroundColor Yellow
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
    "--cache-type-k", "q4_0",
    "--cache-type-v", "q4_0",
    "-fa", "on",
    "--jinja"
)

& $SERVER_EXE @serverArgs
