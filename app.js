// ---------- Config (localStorage) ----------
const CONFIG_KEY = 'trailhead_config_v1';

function getConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {};
  } catch {
    return {};
  }
}
function saveConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

// ---------- IndexedDB ----------
const DB_NAME = 'trailhead_db';
const STORE = 'apartments';
let dbPromise;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function dbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- Utilities ----------
function uid() {
  return 'a_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function money(n) {
  if (n === null || n === undefined || n === '') return '—';
  const num = Number(n);
  if (Number.isNaN(num)) return '—';
  return '$' + num.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

function moveInTotal(item) {
  const rentDueAtSigning = item.firstMonthDue ? Number(item.rent || 0) : 0;
  const lastMonth = item.lastMonthDue ? Number(item.rent || 0) : 0;
  return (
    Number(item.deposit || 0) +
    Number(item.appFee || 0) +
    Number(item.petFee || 0) +
    Number(item.utilitiesEst || 0) +
    Number(item.otherFees || 0) +
    rentDueAtSigning +
    lastMonth
  );
}

// ---------- Tabs ----------
const tabs = document.querySelectorAll('.tab');
const views = document.querySelectorAll('.view');
tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'));
    views.forEach((v) => v.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('view-' + tab.dataset.view).classList.add('active');
    if (tab.dataset.view === 'saved') renderSaved();
    if (tab.dataset.view === 'compare') renderCompare();
  });
});

// ---------- Settings modal ----------
const settingsModal = document.getElementById('settingsModal');
document.getElementById('settingsBtn').addEventListener('click', () => {
  const cfg = getConfig();
  document.getElementById('proxyUrl').value = cfg.proxyUrl || '';
  document.getElementById('defaultCity').value = cfg.city || 'Broken Arrow';
  document.getElementById('defaultState').value = cfg.state || 'OK';
  settingsModal.classList.add('open');
});
document.getElementById('settingsCancel').addEventListener('click', () => {
  settingsModal.classList.remove('open');
});
document.getElementById('settingsSave').addEventListener('click', () => {
  const cfg = {
    proxyUrl: document.getElementById('proxyUrl').value.trim(),
    city: document.getElementById('defaultCity').value.trim() || 'Broken Arrow',
    state: (document.getElementById('defaultState').value.trim() || 'OK').toUpperCase()
  };
  saveConfig(cfg);
  document.getElementById('locationSubtitle').textContent = cfg.city + ', ' + cfg.state;
  settingsModal.classList.remove('open');
  showToast('Settings saved');
});

// ---------- Search ----------
document.getElementById('searchBtn').addEventListener('click', runSearch);

async function runSearch() {
  const cfg = getConfig();
  const statusEl = document.getElementById('searchStatus');
  const resultsEl = document.getElementById('searchResults');

  if (!cfg.proxyUrl) {
    statusEl.innerHTML = emptyState(
      'Connect your proxy first',
      'Open Settings (⚙) and paste the Google Apps Script web app URL for the RentCast proxy.'
    );
    resultsEl.innerHTML = '';
    return;
  }

  const params = new URLSearchParams();
  params.set('action', 'search');
  const address = document.getElementById('fAddress').value.trim();
  const zip = document.getElementById('fZip').value.trim();
  if (address) {
    params.set('address', address);
    const radius = document.getElementById('fRadius').value.trim();
    if (radius) params.set('radius', radius);
  } else if (zip) {
    params.set('zip', zip);
  } else {
    params.set('city', cfg.city || 'Broken Arrow');
    params.set('state', cfg.state || 'OK');
  }
  const beds = document.getElementById('fBeds').value;
  if (beds !== '') params.set('bedrooms', beds);
  const maxRent = document.getElementById('fMaxRent').value.trim();
  if (maxRent) params.set('maxRent', maxRent);

  statusEl.innerHTML = '<div class="loading-row"><span class="spinner"></span> Searching live listings…</div>';
  resultsEl.innerHTML = '';

  try {
    const res = await fetch(cfg.proxyUrl + '?' + params.toString());
    if (!res.ok) throw new Error('Proxy returned ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    statusEl.innerHTML = '';
    if (!data.length) {
      resultsEl.innerHTML = emptyState(
        'No listings matched',
        'Try widening the radius, clearing the rent cap, or removing the bedroom filter.'
      );
      return;
    }

    document.getElementById('searchStatus').outerHTML =
      '<div class="results-meta" id="searchStatus">' + data.length + ' listing' + (data.length === 1 ? '' : 's') + ' found</div>';

    const saved = await dbGetAll();
    const savedIds = new Set(saved.map((s) => s.id));

    resultsEl.innerHTML = data.map((l) => listingCardHTML(l, savedIds.has(l.id))).join('');

    resultsEl.querySelectorAll('[data-save-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const listing = data.find((d) => d.id === btn.dataset.saveId);
        await saveListing(listing);
        btn.textContent = 'Saved ✓';
        btn.disabled = true;
        updateSavedCount();
      });
    });
  } catch (err) {
    statusEl.innerHTML = emptyState('Search failed', String(err.message || err));
  }
}

function listingCardHTML(l, alreadySaved) {
  return `
  <div class="card">
    <div class="card-top">
      <div>
        <div class="card-address">${escapeHTML(l.address || 'Address unavailable')}</div>
        <div class="card-sub">${escapeHTML(l.city || '')}, ${escapeHTML(l.state || '')} ${escapeHTML(l.zip || '')}</div>
      </div>
      <div class="card-rent">${money(l.rent)}<span>/ month</span></div>
    </div>
    <div class="stat-row">
      <span><span class="stat-value">${l.beds != null ? l.beds : '—'}</span> bed</span>
      <span><span class="stat-value">${l.baths != null ? l.baths : '—'}</span> bath</span>
      <span><span class="stat-value">${l.sqft != null ? l.sqft.toLocaleString() : '—'}</span> sqft</span>
      ${l.daysOnMarket != null ? `<span><span class="stat-value">${l.daysOnMarket}</span> days listed</span>` : ''}
    </div>
    <div class="card-actions">
      <button class="btn-primary" data-save-id="${escapeAttr(l.id)}" ${alreadySaved ? 'disabled' : ''}>${alreadySaved ? 'Saved ✓' : 'Save to tracker'}</button>
      ${l.listingUrl ? `<a class="btn-secondary" href="${escapeAttr(l.listingUrl)}" target="_blank" rel="noopener">View listing</a>` : ''}
    </div>
  </div>`;
}

async function saveListing(listing) {
  const item = {
    id: listing.id,
    address: listing.address,
    city: listing.city,
    state: listing.state,
    zip: listing.zip,
    rent: listing.rent,
    beds: listing.beds,
    baths: listing.baths,
    sqft: listing.sqft,
    listingUrl: listing.listingUrl,
    status: 'interested',
    deposit: listing.rent || '',
    appFee: '',
    petFee: '',
    utilitiesEst: '',
    otherFees: '',
    firstMonthDue: true,
    lastMonthDue: false,
    notes: '',
    manual: false,
    savedDate: new Date().toISOString()
  };
  await dbPut(item);
  showToast('Saved to tracker');
}

// ---------- Saved / tracker view ----------
async function renderSaved() {
  const list = document.getElementById('savedList');
  const items = await dbGetAll();
  updateSavedCount(items.length);

  if (!items.length) {
    list.innerHTML =
      emptyState('Nothing saved yet', 'Search for listings or add one manually to start tracking costs.') +
      `<div style="text-align:center; margin-top:14px;">
         <button class="btn-secondary" id="addManualBtn">+ Add manually</button>
       </div>`;
    document.getElementById('addManualBtn').addEventListener('click', addManualListing);
    return;
  }

  items.sort((a, b) => new Date(b.savedDate) - new Date(a.savedDate));

  list.innerHTML =
    `<div style="text-align:right; margin-bottom:12px;">
       <button class="btn-secondary" id="addManualBtn">+ Add manually</button>
     </div>` +
    items.map(savedCardHTML).join('');

  document.getElementById('addManualBtn').addEventListener('click', addManualListing);

  items.forEach((item) => {
    const card = list.querySelector(`[data-card-id="${cssEscape(item.id)}"]`);
    if (!card) return;

    card.querySelectorAll('[data-field]').forEach((input) => {
      input.addEventListener('input', () => {
        const field = input.dataset.field;
        let val = input.type === 'checkbox' ? input.checked : input.value;
        item[field] = val;
        dbPut(item);
        card.querySelector('.total-banner .value').textContent = money(moveInTotal(item));
      });
    });

    card.querySelector('[data-status]').addEventListener('change', (e) => {
      item.status = e.target.value;
      dbPut(item);
    });

    card.querySelector('[data-delete]').addEventListener('click', async () => {
      if (!confirm('Remove this apartment from your tracker?')) return;
      await dbDelete(item.id);
      renderSaved();
    });
  });
}

function updateSavedCount(n) {
  if (n !== undefined) {
    document.getElementById('savedCount').textContent = n;
    return;
  }
  dbGetAll().then((items) => {
    document.getElementById('savedCount').textContent = items.length;
  });
}

function savedCardHTML(item) {
  const total = moveInTotal(item);
  return `
  <div class="card saved-card" data-card-id="${escapeAttr(item.id)}">
    <div class="card-top">
      <div>
        <div class="card-address">${escapeHTML(item.address || 'Untitled listing')}</div>
        <div class="card-sub">${escapeHTML(item.city || '')}${item.city ? ', ' : ''}${escapeHTML(item.state || '')}
          ${item.listingUrl ? ` · <a href="${escapeAttr(item.listingUrl)}" target="_blank" rel="noopener">listing ↗</a>` : ''}
        </div>
      </div>
      <span class="badge badge-${item.status}">${statusLabel(item.status)}</span>
    </div>

    <div class="stat-row">
      <span><span class="stat-value">${money(item.rent)}</span> rent</span>
      <span><span class="stat-value">${item.beds != null && item.beds !== '' ? item.beds : '—'}</span> bed</span>
      <span><span class="stat-value">${item.baths != null && item.baths !== '' ? item.baths : '—'}</span> bath</span>
      <span><span class="stat-value">${item.sqft ? Number(item.sqft).toLocaleString() : '—'}</span> sqft</span>
    </div>

    <div class="fields-grid">
      <div class="field">
        <label>Status</label>
        <select data-status>
          <option value="interested" ${item.status === 'interested' ? 'selected' : ''}>Interested</option>
          <option value="toured" ${item.status === 'toured' ? 'selected' : ''}>Toured</option>
          <option value="applied" ${item.status === 'applied' ? 'selected' : ''}>Applied</option>
          <option value="rejected" ${item.status === 'rejected' ? 'selected' : ''}>Passed / rejected</option>
        </select>
      </div>
      <div class="field">
        <label>Monthly rent</label>
        <input type="number" data-field="rent" value="${item.rent ?? ''}" step="1" />
      </div>
      <div class="field">
        <label>Security deposit</label>
        <input type="number" data-field="deposit" value="${item.deposit ?? ''}" step="1" />
      </div>
      <div class="field">
        <label>Application fee</label>
        <input type="number" data-field="appFee" value="${item.appFee ?? ''}" step="1" />
      </div>
      <div class="field">
        <label>Pet fee / deposit</label>
        <input type="number" data-field="petFee" value="${item.petFee ?? ''}" step="1" />
      </div>
      <div class="field">
        <label>Utility setup est.</label>
        <input type="number" data-field="utilitiesEst" value="${item.utilitiesEst ?? ''}" step="1" />
      </div>
      <div class="field field-full">
        <label>Other move-in fees (admin, parking, etc.)</label>
        <input type="number" data-field="otherFees" value="${item.otherFees ?? ''}" step="1" />
      </div>
      <div class="field">
        <label><input type="checkbox" data-field="firstMonthDue" ${item.firstMonthDue ? 'checked' : ''} style="width:auto; margin-right:6px;" />First month due at signing</label>
      </div>
      <div class="field">
        <label><input type="checkbox" data-field="lastMonthDue" ${item.lastMonthDue ? 'checked' : ''} style="width:auto; margin-right:6px;" />Last month due at signing</label>
      </div>
      <div class="field field-full">
        <label>Notes</label>
        <textarea data-field="notes" placeholder="Move-in specials, contact name, tour impressions…">${escapeHTML(item.notes || '')}</textarea>
      </div>
    </div>

    <div class="total-banner">
      <span class="label">Estimated total to move in</span>
      <span class="value">${money(total)}</span>
    </div>

    <div class="card-actions">
      <button class="btn-text" data-delete>Remove from tracker</button>
    </div>
  </div>`;
}

function statusLabel(status) {
  return { interested: 'Interested', toured: 'Toured', applied: 'Applied', rejected: 'Passed' }[status] || 'Interested';
}

async function addManualListing() {
  const item = {
    id: uid(),
    address: 'New listing — tap to edit address in notes',
    city: getConfig().city || 'Broken Arrow',
    state: getConfig().state || 'OK',
    zip: '',
    rent: '',
    beds: '',
    baths: '',
    sqft: '',
    listingUrl: '',
    status: 'interested',
    deposit: '',
    appFee: '',
    petFee: '',
    utilitiesEst: '',
    otherFees: '',
    firstMonthDue: true,
    lastMonthDue: false,
    notes: '',
    manual: true,
    savedDate: new Date().toISOString()
  };
  await dbPut(item);
  renderSaved();
}

// ---------- Compare view ----------
async function renderCompare() {
  const content = document.getElementById('compareContent');
  const items = await dbGetAll();

  if (items.length < 2) {
    content.innerHTML = emptyState(
      'Save at least two apartments',
      'Compare rent, size, and total move-in cost side by side once you have a couple saved.'
    );
    return;
  }

  const withTotals = items.map((i) => ({ ...i, total: moveInTotal(i) }));
  const lowestTotal = Math.min(...withTotals.map((i) => i.total));

  const rows = withTotals
    .sort((a, b) => a.total - b.total)
    .map((i) => `
      <tr class="${i.total === lowestTotal ? 'best-value' : ''}">
        <td>${escapeHTML(i.address || 'Untitled')}</td>
        <td class="mono-cell">${money(i.rent)}</td>
        <td class="mono-cell">${i.sqft ? Number(i.sqft).toLocaleString() : '—'}</td>
        <td class="mono-cell">${i.rent && i.sqft ? '$' + (i.rent / i.sqft).toFixed(2) : '—'}</td>
        <td class="mono-cell total">${money(i.total)}</td>
        <td><span class="badge badge-${i.status}">${statusLabel(i.status)}</span></td>
      </tr>`)
    .join('');

  content.innerHTML = `
    <div class="compare-scroll">
      <table class="compare">
        <thead>
          <tr>
            <th>Address</th>
            <th>Rent</th>
            <th>Sqft</th>
            <th>$/sqft</th>
            <th>Move-in total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="card-sub" style="margin-top:10px;">Lowest total move-in cost highlighted in green.</p>
  `;
}

// ---------- Helpers ----------
function emptyState(title, body) {
  return `
  <div class="empty-state">
    <div class="horizon-mark"></div>
    <h3>${escapeHTML(title)}</h3>
    <p>${escapeHTML(body)}</p>
  </div>`;
}

function escapeHTML(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function escapeAttr(str) { return escapeHTML(str); }
function cssEscape(str) { return String(str).replace(/([^a-zA-Z0-9_-])/g, '\\$1'); }

// ---------- Init ----------
(function init() {
  const cfg = getConfig();
  document.getElementById('locationSubtitle').textContent = (cfg.city || 'Broken Arrow') + ', ' + (cfg.state || 'OK');
  updateSavedCount();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
