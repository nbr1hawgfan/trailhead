// ---------- Amenities checklist ----------
const AMENITIES = [
  ['washerDryerInUnit', 'Washer/dryer in unit'],
  ['washerDryerHookup', 'Washer/dryer hookups'],
  ['dishwasher', 'Dishwasher'],
  ['centralAC', 'Central A/C'],
  ['windowAC', 'Window A/C unit only'],
  ['assignedParking', 'Assigned parking'],
  ['garage', 'Garage available'],
  ['petFriendly', 'Pet friendly'],
  ['utilitiesIncluded', 'Utilities included'],
  ['furnished', 'Furnished'],
  ['elevatorNoStairs', 'Elevator / no stairs'],
  ['balconyPatio', 'Balcony or patio'],
  ['storageUnit', 'On-site storage unit'],
  ['gatedSecurity', 'Gated / controlled access'],
  ['onsiteLaundry', 'On-site laundry facility'],
  ['onlinePortal', 'Online rent portal'],
  ['pool', 'Pool'],
  ['fitnessCenter', 'Fitness center']
];

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

function linesToArray(text) {
  return String(text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeUrl(url) {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return 'https://' + trimmed;
}

function statusLabel(status) {
  return { interested: 'Interested', toured: 'Toured', applied: 'Applied', rejected: 'Passed' }[status] || 'Interested';
}

function escapeHTML(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function escapeAttr(str) { return escapeHTML(str); }

function emptyState(title, body, showAddBtn) {
  return `
  <div class="empty-state">
    <div class="horizon-mark"></div>
    <h3>${escapeHTML(title)}</h3>
    <p>${escapeHTML(body)}</p>
    ${showAddBtn ? '<div style="margin-top:16px;"><button class="btn-primary" id="emptyAddBtn">+ Add your first apartment</button></div>' : ''}
  </div>`;
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
    if (tab.dataset.view === 'list') renderList();
    if (tab.dataset.view === 'compare') renderCompare();
  });
});

// ---------- Editor modal ----------
const editorModal = document.getElementById('editorModal');
let editingId = null;

function buildAmenityGrid(item) {
  const grid = document.getElementById('amenityGrid');
  grid.innerHTML = AMENITIES.map(([key, label]) => `
    <label class="amenity-item ${item && item[key] ? 'checked' : ''}" data-amenity-item>
      <input type="checkbox" data-amenity="${key}" ${item && item[key] ? 'checked' : ''} />
      ${escapeHTML(label)}
    </label>`).join('');

  grid.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      cb.closest('.amenity-item').classList.toggle('checked', cb.checked);
    });
  });
}

function getFormItem() {
  const item = { id: editingId || uid() };
  item.name = document.getElementById('fName').value.trim();
  item.website = normalizeUrl(document.getElementById('fWebsite').value);
  item.address = document.getElementById('fAddress').value.trim();
  item.rent = document.getElementById('fRent').value;
  item.leaseTerm = document.getElementById('fLeaseTerm').value;
  item.beds = document.getElementById('fBeds').value;
  item.baths = document.getElementById('fBaths').value;
  item.sqft = document.getElementById('fSqft').value;
  item.status = document.getElementById('fStatus').value;
  item.deposit = document.getElementById('fDeposit').value;
  item.appFee = document.getElementById('fAppFee').value;
  item.petFee = document.getElementById('fPetFee').value;
  item.utilitiesEst = document.getElementById('fUtilities').value;
  item.otherFees = document.getElementById('fOtherFees').value;
  item.firstMonthDue = document.getElementById('fFirstMonth').checked;
  item.lastMonthDue = document.getElementById('fLastMonth').checked;
  item.pros = linesToArray(document.getElementById('fPros').value);
  item.cons = linesToArray(document.getElementById('fCons').value);
  item.notes = document.getElementById('fNotes').value.trim();

  document.querySelectorAll('#amenityGrid input[type="checkbox"]').forEach((cb) => {
    item[cb.dataset.amenity] = cb.checked;
  });

  return item;
}

function updateEditorTotal() {
  const item = getFormItem();
  document.getElementById('editorTotal').textContent = money(moveInTotal(item));
}

document.querySelectorAll('#editorModal input, #editorModal select, #editorModal textarea').forEach((el) => {
  el.addEventListener('input', updateEditorTotal);
  el.addEventListener('change', updateEditorTotal);
});

function openEditor(item) {
  editingId = item ? item.id : null;
  document.getElementById('editorTitle').textContent = item ? 'Edit apartment' : 'Add apartment';
  document.getElementById('deleteBtn').style.display = item ? 'inline-block' : 'none';

  document.getElementById('fName').value = item?.name || '';
  document.getElementById('fWebsite').value = item?.website || '';
  document.getElementById('fAddress').value = item?.address || '';
  document.getElementById('fRent').value = item?.rent ?? '';
  document.getElementById('fLeaseTerm').value = item?.leaseTerm || '';
  document.getElementById('fBeds').value = item?.beds ?? '';
  document.getElementById('fBaths').value = item?.baths ?? '';
  document.getElementById('fSqft').value = item?.sqft ?? '';
  document.getElementById('fStatus').value = item?.status || 'interested';
  document.getElementById('fDeposit').value = item?.deposit ?? '';
  document.getElementById('fAppFee').value = item?.appFee ?? '';
  document.getElementById('fPetFee').value = item?.petFee ?? '';
  document.getElementById('fUtilities').value = item?.utilitiesEst ?? '';
  document.getElementById('fOtherFees').value = item?.otherFees ?? '';
  document.getElementById('fFirstMonth').checked = item ? !!item.firstMonthDue : true;
  document.getElementById('fLastMonth').checked = item ? !!item.lastMonthDue : false;
  document.getElementById('fPros').value = (item?.pros || []).join('\n');
  document.getElementById('fCons').value = (item?.cons || []).join('\n');
  document.getElementById('fNotes').value = item?.notes || '';

  buildAmenityGrid(item);
  updateEditorTotal();
  editorModal.classList.add('open');
  document.getElementById('fName').focus();
}

function closeEditor() {
  editorModal.classList.remove('open');
  editingId = null;
}

document.getElementById('addBtn').addEventListener('click', () => openEditor(null));
document.getElementById('editorCancel').addEventListener('click', closeEditor);

document.getElementById('editorSave').addEventListener('click', async () => {
  const item = getFormItem();
  if (!item.name && !item.address) {
    showToast('Add at least a name or address');
    return;
  }
  if (!editingId) item.savedDate = new Date().toISOString();
  else {
    const existing = (await dbGetAll()).find((i) => i.id === editingId);
    item.savedDate = existing?.savedDate || new Date().toISOString();
  }
  await dbPut(item);
  closeEditor();
  showToast('Saved');
  renderList();
});

document.getElementById('deleteBtn').addEventListener('click', async () => {
  if (!editingId) return;
  if (!confirm('Delete this apartment from your list?')) return;
  await dbDelete(editingId);
  closeEditor();
  showToast('Removed');
  renderList();
});

// ---------- List view ----------
async function renderList() {
  const list = document.getElementById('savedList');
  const items = await dbGetAll();
  updateSavedCount(items.length);

  if (!items.length) {
    list.innerHTML = emptyState(
      'Nothing saved yet',
      'Add an apartment to start tracking cost, features, and your own notes.',
      true
    );
    document.getElementById('emptyAddBtn')?.addEventListener('click', () => openEditor(null));
    return;
  }

  items.sort((a, b) => new Date(b.savedDate) - new Date(a.savedDate));
  list.innerHTML = items.map(cardHTML).join('');

  items.forEach((item) => {
    document.querySelector(`[data-open-id="${cssEscape(item.id)}"]`)
      ?.addEventListener('click', () => openEditor(item));
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

function cssEscape(str) { return String(str).replace(/([^a-zA-Z0-9_-])/g, '\\$1'); }

function cardHTML(item) {
  const total = moveInTotal(item);
  const matchedAmenities = AMENITIES.filter(([key]) => item[key]).map(([, label]) => label);
  return `
  <div class="card" data-open-id="${escapeAttr(item.id)}" style="cursor:pointer;">
    <div class="card-top">
      <div>
        <div class="card-address">${escapeHTML(item.name || 'Untitled apartment')}</div>
        <div class="card-sub">
          ${escapeHTML(item.address || 'No address yet')}
          ${item.website ? ` · <a href="${escapeAttr(item.website)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">website ↗</a>` : ''}
        </div>
      </div>
      <span class="badge badge-${item.status}">${statusLabel(item.status)}</span>
    </div>

    <div class="stat-row">
      <span><span class="stat-value">${money(item.rent)}</span> rent</span>
      <span><span class="stat-value">${item.beds !== '' && item.beds != null ? item.beds : '—'}</span> bed</span>
      <span><span class="stat-value">${item.baths !== '' && item.baths != null ? item.baths : '—'}</span> bath</span>
      <span><span class="stat-value">${item.sqft ? Number(item.sqft).toLocaleString() : '—'}</span> sqft</span>
      <span><span class="stat-value">${item.leaseTerm || '—'}</span></span>
    </div>

    ${matchedAmenities.length ? `<div class="card-sub">${matchedAmenities.slice(0, 4).map(escapeHTML).join(' · ')}${matchedAmenities.length > 4 ? ` +${matchedAmenities.length - 4} more` : ''}</div>` : ''}

    <div class="total-banner">
      <span class="label">Estimated total to move in</span>
      <span class="value">${money(total)}</span>
    </div>
  </div>`;
}

// ---------- Compare view ----------
async function renderCompare() {
  const content = document.getElementById('compareContent');
  const items = await dbGetAll();

  if (items.length < 2) {
    content.innerHTML = emptyState(
      'Add at least two apartments',
      'Compare rent, size, move-in cost, and features side by side once you have a couple saved.'
    );
    return;
  }

  const withTotals = items.map((i) => ({ ...i, total: moveInTotal(i) }));
  const lowestTotal = Math.min(...withTotals.map((i) => i.total));

  const keyAmenities = ['washerDryerInUnit', 'dishwasher', 'centralAC', 'petFriendly', 'utilitiesIncluded', 'garage'];
  const amenityLabelMap = Object.fromEntries(AMENITIES);

  const rows = withTotals
    .sort((a, b) => a.total - b.total)
    .map((i) => `
      <tr class="${i.total === lowestTotal ? 'best-value' : ''}">
        <td>${escapeHTML(i.name || i.address || 'Untitled')}</td>
        <td class="mono-cell">${money(i.rent)}</td>
        <td class="mono-cell">${i.sqft ? Number(i.sqft).toLocaleString() : '—'}</td>
        <td class="mono-cell">${i.rent && i.sqft ? '$' + (i.rent / i.sqft).toFixed(2) : '—'}</td>
        <td class="mono-cell total">${money(i.total)}</td>
        ${keyAmenities.map((key) => `<td>${i[key] ? '<span class="amenity-tick">✓</span>' : '<span class="amenity-cross">–</span>'}</td>`).join('')}
        <td><span class="badge badge-${i.status}">${statusLabel(i.status)}</span></td>
      </tr>`)
    .join('');

  content.innerHTML = `
    <div class="compare-scroll">
      <table class="compare">
        <thead>
          <tr>
            <th>Name</th>
            <th>Rent</th>
            <th>Sqft</th>
            <th>$/sqft</th>
            <th>Move-in total</th>
            ${keyAmenities.map((key) => `<th>${escapeHTML(amenityLabelMap[key])}</th>`).join('')}
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="card-sub" style="margin-top:10px;">Lowest total move-in cost highlighted in green. Tap an apartment in "My List" to see its full feature checklist, pros/cons, and notes.</p>
  `;
}

// ---------- Init ----------
(function init() {
  updateSavedCount();
  renderList();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
