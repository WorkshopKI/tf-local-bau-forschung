/**
 * TeamFlow Build-Konfigurator — Vanilla-JS.
 *
 * Lädt Preset-Configs vom lokalen Dev-Server (scripts/serve-config-ui.mjs),
 * bindet sie an das Formular, führt Live-Validierung aus und speichert die
 * bearbeitete Config via File System Access API zurück nach `configs/`.
 *
 * Die Validierung ist aus `scripts/config-schema.mjs` importiert — der Server
 * liefert diese Datei unter `/schema.mjs` aus.
 */

import { DEFAULT_CONFIG, validateConfig, CONFIG_SCHEMA_VERSION } from './schema.mjs';

const PRESET_PATHS = {
  dev: '/configs/dev.config.json',
  demo: '/configs/demo.config.json',
  foerderprogramm: '/configs/foerderprogramm.config.json',
};

let currentConfig = structuredClone(DEFAULT_CONFIG);

function getByPath(obj, pathStr) {
  return pathStr.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setByPath(obj, pathStr, value) {
  const parts = pathStr.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function readInputValue(input) {
  if (input.type === 'checkbox') return input.checked;
  const path = input.dataset.path;
  const raw = input.value;
  // Speziell: allowedModels als Komma-Liste
  if (path === 'ki.openrouter.allowedModels') {
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }
  // Null-Transformation für fixedDataSharePath: leerer String = null
  if (path === 'data.fixedDataSharePath') {
    return raw.trim() === '' ? null : raw;
  }
  return raw;
}

function writeInputValue(input, value) {
  const path = input.dataset.path;
  if (input.type === 'checkbox') {
    input.checked = Boolean(value);
    return;
  }
  if (path === 'ki.openrouter.allowedModels' && Array.isArray(value)) {
    input.value = value.join(',');
    return;
  }
  input.value = value == null ? '' : String(value);
}

function syncFormFromConfig() {
  const inputs = document.querySelectorAll('[data-path]');
  inputs.forEach(input => {
    const value = getByPath(currentConfig, input.dataset.path);
    writeInputValue(input, value);
  });
}

function syncConfigFromForm() {
  const inputs = document.querySelectorAll('[data-path]');
  inputs.forEach(input => {
    setByPath(currentConfig, input.dataset.path, readInputValue(input));
  });
  // configVersion immer korrekt.
  currentConfig.configVersion = CONFIG_SCHEMA_VERSION;
}

function renderValidation() {
  const panel = document.getElementById('validation-panel');
  const { errors, warnings, valid } = validateConfig(currentConfig);
  panel.innerHTML = '';
  if (valid && warnings.length === 0) {
    const div = document.createElement('div');
    div.className = 'ok';
    div.textContent = 'Config valide.';
    panel.appendChild(div);
    return;
  }
  for (const e of errors) {
    const div = document.createElement('div');
    div.className = 'error';
    div.textContent = 'FEHLER: ' + e;
    panel.appendChild(div);
  }
  for (const w of warnings) {
    const div = document.createElement('div');
    div.className = 'warn';
    div.textContent = 'WARNUNG: ' + w;
    panel.appendChild(div);
  }
}

function renderJsonPreview() {
  const pre = document.getElementById('json-output');
  pre.textContent = JSON.stringify(currentConfig, null, 2);
}

function refresh() {
  renderValidation();
  renderJsonPreview();
}

async function loadPreset(name) {
  if (!name) {
    currentConfig = structuredClone(DEFAULT_CONFIG);
    syncFormFromConfig();
    refresh();
    return;
  }
  const url = PRESET_PATHS[name];
  if (!url) return;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const json = await resp.json();
    currentConfig = json;
    syncFormFromConfig();
    refresh();
  } catch (err) {
    alert('Preset konnte nicht geladen werden: ' + err.message);
  }
}

async function loadExistingFromDisk() {
  if (typeof window.showOpenFilePicker !== 'function') {
    alert('Dein Browser unterstützt keinen Datei-Picker. Bitte Chrome/Edge 86+ verwenden.');
    return;
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'TeamFlow-Config', accept: { 'application/json': ['.json'] } }],
    });
    const file = await handle.getFile();
    const text = await file.text();
    currentConfig = JSON.parse(text);
    syncFormFromConfig();
    refresh();
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    alert('Laden fehlgeschlagen: ' + err.message);
  }
}

async function saveConfig() {
  syncConfigFromForm();
  const { valid, errors } = validateConfig(currentConfig);
  if (!valid) {
    alert('Config hat Fehler und kann nicht gespeichert werden:\n\n' + errors.join('\n'));
    return;
  }

  if (typeof window.showSaveFilePicker !== 'function') {
    alert('Dein Browser unterstützt keinen Datei-Picker. Bitte Chrome/Edge 86+ verwenden.');
    return;
  }

  const suggested = (currentConfig.build?.outputFilename || 'teamflow') + '.config.json';
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: suggested,
      types: [{ description: 'TeamFlow-Config', accept: { 'application/json': ['.json'] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(currentConfig, null, 2) + '\n');
    await writable.close();

    const filename = handle.name;
    showSaveResult(filename);
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    alert('Speichern fehlgeschlagen: ' + err.message);
  }
}

function showSaveResult(filename) {
  const result = document.getElementById('save-result');
  const command = `npm run build:variant -- --config configs/${filename}`;
  result.hidden = false;
  result.innerHTML = `
    <div><strong>Gespeichert:</strong> ${filename}</div>
    <p>Nächster Schritt — im Terminal ausführen:</p>
    <code id="build-cmd">${command}</code>
    <button type="button" id="copy-cmd">Kommando kopieren</button>
  `;
  document.getElementById('copy-cmd').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(command);
      const btn = document.getElementById('copy-cmd');
      btn.textContent = 'Kopiert!';
      setTimeout(() => { btn.textContent = 'Kommando kopieren'; }, 1500);
    } catch {
      alert('Kopieren fehlgeschlagen. Bitte manuell markieren.');
    }
  });
}

// Bindings
document.getElementById('preset-select').addEventListener('change', (e) => {
  loadPreset(e.target.value);
});
document.getElementById('load-existing').addEventListener('click', loadExistingFromDisk);
document.getElementById('save-config').addEventListener('click', saveConfig);

document.querySelectorAll('[data-path]').forEach(input => {
  input.addEventListener('input', () => { syncConfigFromForm(); refresh(); });
  input.addEventListener('change', () => { syncConfigFromForm(); refresh(); });
});

// Initial
syncFormFromConfig();
refresh();
