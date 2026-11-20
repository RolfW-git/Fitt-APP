/**
 * Tretmann Web-App (PWA)
 * Ergometer Trainingserfassung & Statistik
 * Vollständige Offline-Fähigkeit via IndexedDB
 */

const DB_NAME = 'tretmann_web_db';
const DB_VERSION = 1;
let db = null;

// Anwendungsstatus
let appState = {
  currentLoadedProfile: {},
  editingTrainingId: null,
  selectedTrainingId: null,
  selectedFilterName: null,
  selectedFilterYear: new Date().getFullYear(),
  selectedFilterMonth: new Date().getMonth() + 1,
  selectedFilterDay: null,
  monthNames: {
    1: '01 - Jan', 2: '02 - Feb', 3: '03 - Mär', 4: '04 - Apr',
    5: '05 - Mai', 6: '06 - Jun', 7: '07 - Jul', 8: '08 - Aug',
    9: '09 - Sep', 10: '10 - Okt', 11: '11 - Nov', 12: '12 - Dez'
  }
};

// -------------------------------------------------------------
// 1. IndexedDB Datenbank-Initialisierung
// -------------------------------------------------------------
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Tabelle: Profile (Voreinstellungen)
      if (!database.objectStoreNames.contains('profiles')) {
        database.createObjectStore('profiles', { keyPath: 'name' });
      }

      // Tabelle: Trainings
      if (!database.objectStoreNames.contains('trainings')) {
        const tStore = database.createObjectStore('trainings', { keyPath: 'id', autoIncrement: true });
        tStore.createIndex('name', 'name', { unique: false });
        tStore.createIndex('date', 'date', { unique: false });
      }

      // Tabelle: App-Einstellungen
      if (!database.objectStoreNames.contains('app_settings')) {
        database.createObjectStore('app_settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      console.error('IndexedDB Fehler:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Datenbank-Transaktions-Helfer
function dbGet(storeName, key) {
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

function dbGetAll(storeName) {
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

function dbPut(storeName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbDelete(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// -------------------------------------------------------------
// 2. Datum & Formatierungs-Hilfsfunktionen
// -------------------------------------------------------------
function getTodayString() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function convertDisplayToIso(displayDate) {
  if (!displayDate || !displayDate.includes('.')) return '';
  const parts = displayDate.split('.');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return '';
}

function cleanDateField(inputEl) {
  let val = inputEl.value.trim();
  if (!val) return;

  // Ersetze Kommas, Leerzeichen, Bindestriche und Doppelpunkte durch Punkte
  val = val.replace(/[\s,\-:]+/g, '.');

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = String(now.getMonth() + 1).padStart(2, '0');

  const parts = val.split('.').filter(p => p.length > 0);

  if (parts.length === 1) {
    // Nur Tag eingegeben (z.B. "19" oder "5")
    const d = parseInt(parts[0], 10);
    if (!isNaN(d) && d >= 1 && d <= 31) {
      inputEl.value = `${String(d).padStart(2, '0')}.${curMonth}.${curYear}`;
    }
  } else if (parts.length === 2) {
    // Tag und Monat eingegeben (z.B. "19.11")
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(d) && !isNaN(m) && d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      inputEl.value = `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${curYear}`;
    }
  } else if (parts.length >= 3) {
    // Tag, Monat, Jahr
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    let y = parseInt(parts[2], 10);
    if (!isNaN(y) && y < 100) {
      y += 2000; // 2-stelliges Jahr wie "26" -> 2026
    }
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
      inputEl.value = `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
    }
  }
}

function cleanDurationField(inputEl) {
  let val = inputEl.value.trim();
  if (!val) return;

  // Ersetze Leerzeichen, Punkte, Kommas, Bindestriche durch Doppelpunkte
  val = val.replace(/[\s.,\-]+/g, ':');
  const parts = val.split(':').filter(p => p.length > 0);

  if (parts.length === 1) {
    const num = parseInt(parts[0], 10);
    if (!isNaN(num)) {
      inputEl.value = `${String(num).padStart(2, '0')}:00`;
    }
  } else if (parts.length === 2) {
    const m = parseInt(parts[0], 10) || 0;
    const s = parseInt(parts[1], 10) || 0;
    inputEl.value = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  } else if (parts.length >= 3) {
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    const s = parseInt(parts[2], 10) || 0;
    inputEl.value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}

function parseDurationSeconds(durationStr) {
  if (!durationStr) return 0;
  const parts = durationStr.split(':').map(p => parseInt(p, 10) || 0);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

function formatSecondsToDuration(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function cleanNumberField(inputEl, isFloat = false) {
  let val = inputEl.value.trim().replace(',', '.');
  if (!val) return;
  if (isFloat) {
    const num = parseFloat(val);
    inputEl.value = isNaN(num) ? '' : num.toFixed(2).replace(/\.00$/, '');
  } else {
    const num = parseInt(val, 10);
    inputEl.value = isNaN(num) ? '' : String(num);
  }
}

// -------------------------------------------------------------
// 3. UI-Initialisierung & Navigation
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  await openDatabase();
  setupEventListeners();
  await loadInitialState();
  initServiceWorker();
});

function setupEventListeners() {
  // Input Blur-Formatierungen
  document.getElementById('field-date').addEventListener('blur', (e) => cleanDateField(e.target));
  document.getElementById('field-duration').addEventListener('blur', (e) => cleanDurationField(e.target));
  document.getElementById('field-distance').addEventListener('blur', (e) => cleanNumberField(e.target, true));
  document.getElementById('field-speed').addEventListener('blur', (e) => cleanNumberField(e.target, true));
  document.getElementById('field-rpm').addEventListener('blur', (e) => cleanNumberField(e.target, false));
  document.getElementById('field-calories').addEventListener('blur', (e) => cleanNumberField(e.target, false));
  document.getElementById('field-pulse').addEventListener('blur', (e) => cleanNumberField(e.target, false));

  // Name Input & Dropdown
  document.getElementById('field-name').addEventListener('change', () => onNameChanged());

  // Buttons Hauptoberfläche
  document.getElementById('btn-personalize').addEventListener('click', personalizeCurrentProfile);
  document.getElementById('btn-save').addEventListener('click', saveTraining);
  document.getElementById('btn-cancel-input').addEventListener('click', cancelInput);
  document.getElementById('btn-switch-data').addEventListener('click', () => switchToDataScreen());

  // Combobox Buttons
  document.getElementById('btn-name-menu').addEventListener('click', openNameSelectModal);
  document.getElementById('btn-delete-person').addEventListener('click', () => promptDeletePerson('input'));

  // Buttons Datenoberfläche
  document.getElementById('btn-back-input').addEventListener('click', switchToInputScreen);
  document.getElementById('btn-edit-training').addEventListener('click', editSelectedTraining);
  document.getElementById('btn-delete-training').addEventListener('click', promptDeleteSelectedTraining);
  document.getElementById('btn-calendar-search').addEventListener('click', openCalendarSearchModal);
  document.getElementById('btn-clear-day-filter').addEventListener('click', clearDayFilter);
  document.getElementById('btn-delete-person-data').addEventListener('click', () => promptDeletePerson('data'));

  // Filter Dropdowns
  document.getElementById('filter-name').addEventListener('change', (e) => {
    appState.selectedFilterName = e.target.value === 'ALL' ? null : e.target.value;
    appState.selectedFilterDay = null;
    checkAndJumpToLatest(true);
    refreshDataScreen();
  });

  document.getElementById('filter-month').addEventListener('change', (e) => {
    appState.selectedFilterMonth = parseInt(e.target.value, 10);
    appState.selectedFilterDay = null;
    refreshDataScreen();
  });

  document.getElementById('filter-year').addEventListener('change', (e) => {
    appState.selectedFilterYear = parseInt(e.target.value, 10);
    appState.selectedFilterDay = null;
    refreshDataScreen();
  });

  // Backup & Import
  document.getElementById('btn-backup-export').addEventListener('click', exportDataBackup);
  document.getElementById('btn-backup-import').addEventListener('click', () => document.getElementById('file-import').click());
  document.getElementById('file-import').addEventListener('change', importDataBackup);
}

// -------------------------------------------------------------
// 4. Initialer Ladeprozess & Profilverwaltung
// -------------------------------------------------------------
async function loadInitialState() {
  // Datum vorbelegen
  document.getElementById('field-date').value = getTodayString();

  // Filter-Monate befüllen
  const monthSelect = document.getElementById('filter-month');
  monthSelect.innerHTML = '';
  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = appState.monthNames[m];
    if (m === appState.selectedFilterMonth) opt.selected = true;
    monthSelect.appendChild(opt);
  }

  // Filter-Jahre befüllen
  updateYearSelectOptions();

  // Zuletzt aktiven Namen oder erstes Profil laden
  const setting = await dbGet('app_settings', 'last_active_name');
  let activeName = setting ? setting.value : null;

  const allProfiles = await dbGetAll('profiles');
  if (!activeName && allProfiles.length > 0) {
    activeName = allProfiles[0].name;
  }

  if (activeName) {
    document.getElementById('field-name').value = activeName;
    await loadProfileForName(activeName);
  }
}

async function updateYearSelectOptions() {
  const allTrainings = await dbGetAll('trainings');
  const years = new Set([new Date().getFullYear()]);
  allTrainings.forEach(t => {
    if (t.date) {
      const y = parseInt(t.date.split('-')[0], 10);
      if (!isNaN(y)) years.add(y);
    }
  });

  const sortedYears = Array.from(years).sort((a, b) => b - a);
  const yearSelect = document.getElementById('filter-year');
  yearSelect.innerHTML = '';
  sortedYears.forEach(y => {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === appState.selectedFilterYear) opt.selected = true;
    yearSelect.appendChild(opt);
  });
}

async function onNameChanged() {
  const name = document.getElementById('field-name').value.trim();
  if (name) {
    await dbPut('app_settings', { key: 'last_active_name', value: name });
    await loadProfileForName(name);
  }
}

async function loadProfileForName(name) {
  if (!name) return;
  const profile = await dbGet('profiles', name);
  if (profile) {
    appState.currentLoadedProfile = profile;
    document.getElementById('field-resistance').value = profile.resistance || '';
    document.getElementById('field-distance').value = profile.distance || '';
    document.getElementById('field-rpm').value = profile.rpm || '';
    document.getElementById('field-duration').value = profile.duration || '';
    document.getElementById('field-speed').value = profile.speed || '';
    document.getElementById('field-calories').value = profile.calories || '';
    document.getElementById('field-pulse').value = profile.pulse || '';
  } else {
    appState.currentLoadedProfile = {};
  }
}

async function personalizeCurrentProfile() {
  const name = document.getElementById('field-name').value.trim();
  if (!name) {
    showToast('Bitte zuerst einen Namen eingeben!');
    return;
  }

  const profile = {
    name: name,
    resistance: document.getElementById('field-resistance').value.trim(),
    distance: parseFloat(document.getElementById('field-distance').value) || 0,
    rpm: parseInt(document.getElementById('field-rpm').value, 10) || 0,
    duration: document.getElementById('field-duration').value.trim(),
    speed: parseFloat(document.getElementById('field-speed').value) || 0,
    calories: parseInt(document.getElementById('field-calories').value, 10) || 0,
    pulse: parseInt(document.getElementById('field-pulse').value, 10) || 0,
    updated_at: new Date().toISOString()
  };

  await dbPut('profiles', profile);
  await dbPut('app_settings', { key: 'last_active_name', value: name });
  showToast(`Voreinstellungen für "${name}" gespeichert!`);
}

// -------------------------------------------------------------
// 5. Training Speichern & Bearbeiten
// -------------------------------------------------------------
async function saveTraining() {
  const name = document.getElementById('field-name').value.trim();
  if (!name) {
    showToast('Bitte einen Namen angeben!');
    return;
  }

  const displayDate = document.getElementById('field-date').value.trim();
  const isoDate = convertDisplayToIso(displayDate);
  if (!isoDate) {
    showToast('Bitte ein gültiges Datum im Format TT.MM.JJJJ angeben!');
    return;
  }

  const durationStr = document.getElementById('field-duration').value.trim();
  const durationSec = parseDurationSeconds(durationStr);

  const trainingData = {
    name: name,
    date: isoDate,
    display_date: displayDate,
    resistance: document.getElementById('field-resistance').value.trim(),
    distance: parseFloat(document.getElementById('field-distance').value) || 0,
    rpm: parseInt(document.getElementById('field-rpm').value, 10) || 0,
    duration: durationStr,
    duration_seconds: durationSec,
    speed: parseFloat(document.getElementById('field-speed').value) || 0,
    calories: parseInt(document.getElementById('field-calories').value, 10) || 0,
    pulse: parseInt(document.getElementById('field-pulse').value, 10) || 0
  };

  if (appState.editingTrainingId) {
    trainingData.id = appState.editingTrainingId;
    await dbPut('trainings', trainingData);
    showToast('Training erfolgreich aktualisiert!');
    exitEditMode();
  } else {
    trainingData.created_at = new Date().toISOString();
    await dbPut('trainings', trainingData);
    showToast('Training erfolgreich gespeichert!');
  }

  await dbPut('app_settings', { key: 'last_active_name', value: name });
  document.getElementById('field-date').value = getTodayString();
}

function cancelInput() {
  if (appState.editingTrainingId) {
    exitEditMode();
    showToast('Bearbeitung abgebrochen');
  } else {
    const curName = document.getElementById('field-name').value.trim();
    if (curName) {
      loadProfileForName(curName);
    } else {
      document.querySelectorAll('#screen-input input').forEach(inp => inp.value = '');
      document.getElementById('field-date').value = getTodayString();
    }
  }
}

function exitEditMode() {
  appState.editingTrainingId = null;
  document.getElementById('banner-edit-mode').classList.add('hidden');
  document.getElementById('btn-save').textContent = 'Speichern';
}

// -------------------------------------------------------------
// 6. Daten-Screen & Statistiken
// -------------------------------------------------------------
async function switchToDataScreen() {
  document.getElementById('screen-input').classList.add('hidden');
  document.getElementById('screen-data').classList.remove('hidden');

  const curName = document.getElementById('field-name').value.trim();
  appState.selectedFilterName = curName || null;
  appState.selectedTrainingId = null;
  appState.selectedFilterDay = null;

  await updateFilterNameDropdown();
  await checkAndJumpToLatest(false);
  await refreshDataScreen();
}

function switchToInputScreen() {
  document.getElementById('screen-data').classList.add('hidden');
  document.getElementById('screen-input').classList.remove('hidden');
}

async function updateFilterNameDropdown() {
  const allTrainings = await dbGetAll('trainings');
  const allProfiles = await dbGetAll('profiles');
  const names = new Set();
  allTrainings.forEach(t => names.add(t.name));
  allProfiles.forEach(p => names.add(p.name));

  const filterSelect = document.getElementById('filter-name');
  filterSelect.innerHTML = '<option value="ALL">Name: Alle</option>';

  Array.from(names).sort().forEach(n => {
    const opt = document.createElement('option');
    opt.value = n;
    opt.textContent = `Name: ${n}`;
    if (n === appState.selectedFilterName) opt.selected = true;
    filterSelect.appendChild(opt);
  });
}

async function checkAndJumpToLatest(force = false) {
  const all = await dbGetAll('trainings');
  let filtered = all;
  if (appState.selectedFilterName) {
    filtered = all.filter(t => t.name === appState.selectedFilterName);
  }

  if (filtered.length > 0) {
    // Sortieren nach Datum absteigend
    filtered.sort((a, b) => b.date.localeCompare(a.date));
    const latest = filtered[0];

    const curMonthKey = `${appState.selectedFilterYear}-${String(appState.selectedFilterMonth).padStart(2, '0')}`;
    const hasDataInCurrent = filtered.some(t => t.date.startsWith(curMonthKey));

    if (force || !hasDataInCurrent) {
      const parts = latest.date.split('-');
      appState.selectedFilterYear = parseInt(parts[0], 10);
      appState.selectedFilterMonth = parseInt(parts[1], 10);

      document.getElementById('filter-year').value = appState.selectedFilterYear;
      document.getElementById('filter-month').value = appState.selectedFilterMonth;

      const banner = document.getElementById('banner-data-info');
      banner.classList.remove('hidden');
      document.getElementById('lbl-data-info-text').textContent = `ℹ️ Letztes Training: ${latest.display_date} (${latest.name})`;
      document.getElementById('btn-clear-day-filter').classList.add('hidden');
    }
  }
}

async function refreshDataScreen() {
  const all = await dbGetAll('trainings');
  const monthKey = `${appState.selectedFilterYear}-${String(appState.selectedFilterMonth).padStart(2, '0')}`;

  let list = all.filter(t => t.date && t.date.startsWith(monthKey));

  if (appState.selectedFilterName) {
    list = list.filter(t => t.name === appState.selectedFilterName);
  }

  if (appState.selectedFilterDay !== null) {
    const dayStr = `${monthKey}-${String(appState.selectedFilterDay).padStart(2, '0')}`;
    list = list.filter(t => t.date === dayStr);

    const banner = document.getElementById('banner-data-info');
    banner.classList.remove('hidden');
    document.getElementById('lbl-data-info-text').textContent = `📅 Filter aktiv: Tag ${appState.selectedFilterDay}`;
    document.getElementById('btn-clear-day-filter').classList.remove('hidden');
  } else if (!document.getElementById('lbl-data-info-text').textContent.startsWith('ℹ️')) {
    document.getElementById('banner-data-info').classList.add('hidden');
  }

  // Sortierung: neueste zuerst
  list.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  // Statistiken berechnen
  computeAndDisplayStats(all, list);

  // Trainingsliste rendern
  renderTrainingsList(list);
}

function computeAndDisplayStats(allTrainings, currentList) {
  // Gesamt-km über alle jemals gespeicherten Trainings der Person
  let totalAllKm = 0;
  allTrainings.forEach(t => {
    if (!appState.selectedFilterName || t.name === appState.selectedFilterName) {
      totalAllKm += (parseFloat(t.distance) || 0);
    }
  });

  const count = currentList.length;
  let dist = 0;
  let sec = 0;
  let cal = 0;
  let pulseSum = 0;
  let pulseCount = 0;
  let speedSum = 0;
  let speedCount = 0;

  currentList.forEach(t => {
    dist += (parseFloat(t.distance) || 0);
    sec += (parseInt(t.duration_seconds, 10) || 0);
    cal += (parseInt(t.calories, 10) || 0);

    const p = parseInt(t.pulse, 10);
    if (!isNaN(p) && p > 0) {
      pulseSum += p;
      pulseCount++;
    }

    const s = parseFloat(t.speed);
    if (!isNaN(s) && s > 0) {
      speedSum += s;
      speedCount++;
    }
  });

  const avgPulse = pulseCount > 0 ? (pulseSum / pulseCount).toFixed(1) : '0.0';
  const avgSpeed = speedCount > 0 ? (speedSum / speedCount).toFixed(1) : '0.0';

  document.getElementById('stat-total-all-km').textContent = `Gesamt: ${totalAllKm.toFixed(2)} km`;
  document.getElementById('stat-count').textContent = count;
  document.getElementById('stat-dist').textContent = `${dist.toFixed(2)} km`;
  document.getElementById('stat-time').textContent = formatSecondsToDuration(sec);
  document.getElementById('stat-calories').textContent = `${cal} kcal`;
  document.getElementById('stat-pulse').textContent = `${avgPulse} bpm`;
  document.getElementById('stat-speed').textContent = `${avgSpeed} km/h`;
}

function renderTrainingsList(list) {
  const container = document.getElementById('trainings-list');
  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state">Keine Trainingsdaten für diesen Zeitraum vorhanden.</div>';
    return;
  }

  list.forEach(t => {
    const card = document.createElement('div');
    card.className = `training-item ${t.id === appState.selectedTrainingId ? 'selected' : ''}`;
    card.dataset.id = t.id;

    card.innerHTML = `
      <div class="training-top">
        <span class="training-name">${t.name}</span>
        <span class="training-date">${t.display_date}</span>
      </div>
      <div class="training-stats">
        <div>Distanz: <span>${t.distance || 0} km</span></div>
        <div>Zeit: <span>${t.duration || '00:00'}</span></div>
        <div>Widerst.: <span>${t.resistance || '-'}</span></div>
        <div>RPM: <span>${t.rpm || '-'}</span></div>
        <div>Kalorien: <span>${t.calories || 0} kcal</span></div>
        <div>Puls: <span>${t.pulse || '-'} bpm</span></div>
        <div>Ø km/h: <span>${t.speed || '-'}</span></div>
      </div>
    `;

    card.addEventListener('click', () => {
      document.querySelectorAll('.training-item').forEach(el => el.classList.remove('selected'));
      if (appState.selectedTrainingId === t.id) {
        appState.selectedTrainingId = null;
      } else {
        appState.selectedTrainingId = t.id;
        card.classList.add('selected');
      }
    });

    container.appendChild(card);
  });
}

function clearDayFilter() {
  appState.selectedFilterDay = null;
  document.getElementById('banner-data-info').classList.add('hidden');
  refreshDataScreen();
}

// -------------------------------------------------------------
// 7. Training Ändern & Löschen
// -------------------------------------------------------------
async function editSelectedTraining() {
  if (!appState.selectedTrainingId) {
    showToast('Bitte zuerst ein Training aus der Liste antippen!');
    return;
  }

  const training = await dbGet('trainings', appState.selectedTrainingId);
  if (!training) return;

  appState.editingTrainingId = training.id;

  document.getElementById('field-name').value = training.name || '';
  document.getElementById('field-date').value = training.display_date || '';
  document.getElementById('field-resistance').value = training.resistance || '';
  document.getElementById('field-distance').value = training.distance || '';
  document.getElementById('field-rpm').value = training.rpm || '';
  document.getElementById('field-duration').value = training.duration || '';
  document.getElementById('field-speed').value = training.speed || '';
  document.getElementById('field-calories').value = training.calories || '';
  document.getElementById('field-pulse').value = training.pulse || '';

  document.getElementById('banner-edit-mode').classList.remove('hidden');
  document.getElementById('lbl-edit-status').textContent = `✏️ Bearbeite Training vom ${training.display_date} (${training.name})`;
  document.getElementById('btn-save').textContent = 'Aktualisieren';

  switchToInputScreen();
}

async function promptDeleteSelectedTraining() {
  if (!appState.selectedTrainingId) {
    showToast('Bitte zuerst ein Training aus der Liste antippen!');
    return;
  }

  const training = await dbGet('trainings', appState.selectedTrainingId);
  if (!training) return;

  showModal(
    'Training löschen?',
    `Möchtest du das Training vom ${training.display_date} (${training.name}) wirklich unwiderruflich löschen?`,
    async () => {
      await dbDelete('trainings', training.id);
      appState.selectedTrainingId = null;
      showToast('Training gelöscht');
      await refreshDataScreen();
    }
  );
}

// -------------------------------------------------------------
// 8. Person Löschen & Profilauswahl-Modal
// -------------------------------------------------------------
async function promptDeletePerson(origin) {
  const allProfiles = await dbGetAll('profiles');
  const allTrainings = await dbGetAll('trainings');
  const names = new Set();
  allProfiles.forEach(p => names.add(p.name));
  allTrainings.forEach(t => names.add(t.name));

  if (names.size === 0) {
    showToast('Keine Personen zum Löschen vorhanden.');
    return;
  }

  let curName = '';
  if (origin === 'input') {
    curName = document.getElementById('field-name').value.trim();
  } else {
    curName = appState.selectedFilterName || '';
  }

  const nameToDelete = curName || Array.from(names)[0];

  showModal(
    'Person löschen?',
    `Möchtest du "${nameToDelete}" inklusive ALLER zugehörigen Voreinstellungen und gespeicherten Trainingsdaten löschen?`,
    async () => {
      // Profil löschen
      await dbDelete('profiles', nameToDelete);

      // Zugehörige Trainings löschen
      const trainings = await dbGetAll('trainings');
      for (const t of trainings) {
        if (t.name === nameToDelete) {
          await dbDelete('trainings', t.id);
        }
      }

      showToast(`"${nameToDelete}" wurde vollständig gelöscht.`);

      // Zurücksetzen
      document.getElementById('field-name').value = '';
      appState.selectedFilterName = null;
      await loadInitialState();
      await switchToDataScreen();
    }
  );
}

async function openNameSelectModal() {
  const allProfiles = await dbGetAll('profiles');
  const allTrainings = await dbGetAll('trainings');
  const names = new Set();
  allProfiles.forEach(p => names.add(p.name));
  allTrainings.forEach(t => names.add(t.name));

  const sorted = Array.from(names).sort();
  if (sorted.length === 0) {
    showToast('Noch keine Namen gespeichert.');
    return;
  }

  let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
  sorted.forEach(n => {
    html += `<button class="btn btn-outline" style="text-align:left; justify-content:flex-start;" onclick="selectName('${n}')">👤 ${n}</button>`;
  });
  html += '</div>';

  showCustomModal('Person auswählen', html);
}

window.selectName = function(name) {
  document.getElementById('field-name').value = name;
  closeModal();
  onNameChanged();
};

// -------------------------------------------------------------
// 9. Kalender-Such-Dialog (Tagesfilter)
// -------------------------------------------------------------
async function openCalendarSearchModal() {
  const all = await dbGetAll('trainings');
  const monthKey = `${appState.selectedFilterYear}-${String(appState.selectedFilterMonth).padStart(2, '0')}`;

  const daysWithData = new Set();
  all.forEach(t => {
    if (!appState.selectedFilterName || t.name === appState.selectedFilterName) {
      if (t.date && t.date.startsWith(monthKey)) {
        const d = parseInt(t.date.split('-')[2], 10);
        if (!isNaN(d)) daysWithData.add(d);
      }
    }
  });

  const daysInMonth = new Date(appState.selectedFilterYear, appState.selectedFilterMonth, 0).getDate();

  let html = `<p style="margin-bottom:8px;">Tage mit Trainings im ${appState.monthNames[appState.selectedFilterMonth]} ${appState.selectedFilterYear} sind hervorgehoben:</p>`;
  html += '<div class="calendar-days">';

  for (let d = 1; d <= daysInMonth; d++) {
    const hasData = daysWithData.has(d);
    html += `
      <button class="day-btn ${hasData ? 'has-data' : ''}" onclick="selectCalendarDay(${d})">
        ${d}
      </button>
    `;
  }
  html += '</div>';

  showCustomModal('Tag im Monat filtern', html);
}

window.selectCalendarDay = function(day) {
  appState.selectedFilterDay = day;
  closeModal();
  refreshDataScreen();
};

// -------------------------------------------------------------
// 10. Daten-Backup Export & Import (JSON)
// -------------------------------------------------------------
async function exportDataBackup() {
  const trainings = await dbGetAll('trainings');
  const profiles = await dbGetAll('profiles');
  const settings = await dbGetAll('app_settings');

  const backupData = {
    app: 'Tretmann',
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    profiles: profiles,
    trainings: trainings,
    app_settings: settings
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `tretmann_backup_${getTodayString().replace(/\./g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Datensicherung erfolgreich heruntergeladen!');
}

async function importDataBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.trainings || !data.profiles) {
        showToast('Ungültige Tretmann-Sicherungsdatei!');
        return;
      }

      // Profile importieren
      for (const p of data.profiles) {
        await dbPut('profiles', p);
      }

      // Trainings importieren
      for (const t of data.trainings) {
        await dbPut('trainings', t);
      }

      showToast(`Import erfolgreich: ${data.trainings.length} Trainings geladen!`);
      await loadInitialState();
      await refreshDataScreen();
    } catch (err) {
      console.error(err);
      showToast('Fehler beim Lesen der Datei!');
    }
  };
  reader.readAsText(file);
}

// -------------------------------------------------------------
// 11. Modale Dialoge & Toasts
// -------------------------------------------------------------
function showModal(title, text, confirmCallback) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').textContent = text;
  document.getElementById('modal-overlay').classList.remove('hidden');

  const confirmBtn = document.getElementById('modal-btn-confirm');
  const cancelBtn = document.getElementById('modal-btn-cancel');

  confirmBtn.onclick = () => {
    closeModal();
    if (confirmCallback) confirmCallback();
  };

  cancelBtn.onclick = () => closeModal();
}

function showCustomModal(title, contentHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = contentHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');

  document.getElementById('modal-btn-confirm').style.display = 'none';
  document.getElementById('modal-btn-cancel').textContent = 'Schließen';
  document.getElementById('modal-btn-cancel').onclick = () => {
    closeModal();
    document.getElementById('modal-btn-confirm').style.display = 'inline-flex';
    document.getElementById('modal-btn-cancel').textContent = 'Abbrechen';
  };
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

// -------------------------------------------------------------
// 12. PWA Service Worker Registrierung
// -------------------------------------------------------------
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('Tretmann Service Worker bereit (Offline-Modus aktiv)'))
      .catch(err => console.log('Service Worker Registrierung:', err));
  }
}
