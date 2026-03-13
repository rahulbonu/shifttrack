// ================================================
// SHIFTTRACK — app.js
// ================================================

// ---- STATE ----
let state = {
  employees: [],      // { name, code }
  shifts: [],         // { id, employee, store, clockIn, clockOut, date, duration }
  activeShifts: {},   // { [employeeName]: { id, employee, store, clockIn, date } }
  managerCode: 'MANAGER2024',
  overtimeThreshold: null,
  session: null,      // { role: 'employee'|'manager', employee, store } — not persisted
};

let durationInterval = null;
let weekOffset = 0; // 0 = current week, -1 = last week, etc.

// ---- INIT ----
window.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  startLiveClock();
  setTodayDate();
  setWeekRange();
  showLogin();

  // Enter key on login inputs
  document.getElementById('loginCode').addEventListener('keydown', e => {
    if (e.key === 'Enter') loginEmployee();
  });
  document.getElementById('loginName').addEventListener('keydown', e => {
    if (e.key === 'Enter') loginEmployee();
  });
  document.getElementById('managerCodeInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') loginManager();
  });
});

// ---- STORAGE ----
function loadFromStorage() {
  try {
    const saved = localStorage.getItem('shifttrack_data');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrate old string-based employees to objects
      state.employees = (parsed.employees || []).map(e =>
        typeof e === 'string' ? { name: e, code: '' } : e
      );
      // Ensure all employees have a rate field
      state.employees = state.employees.map(e => ({ rate: 0, ...e }));
      // Load overtime threshold (null means not set)
      if (typeof parsed.overtimeThreshold === 'number' && parsed.overtimeThreshold > 0) {
        state.overtimeThreshold = parsed.overtimeThreshold;
      } else {
        state.overtimeThreshold = null;
      }
      state.shifts = parsed.shifts || [];
      // Migrate old single activeShift to activeShifts map
      if (parsed.activeShifts && typeof parsed.activeShifts === 'object') {
        state.activeShifts = parsed.activeShifts;
      } else if (parsed.activeShift) {
        state.activeShifts = { [parsed.activeShift.employee]: parsed.activeShift };
      }
      // Only use stored managerCode if it's a non-empty string
      if (typeof parsed.managerCode === 'string' && parsed.managerCode.length >= 4) {
        state.managerCode = parsed.managerCode;
      }
    }
  } catch (e) {
    console.warn('Could not load data, clearing storage:', e);
    localStorage.removeItem('shifttrack_data');
  }
}

function resetAppData() {
  if (!confirm('This will clear ALL app data (shifts, employees, settings). Continue?')) return;
  localStorage.removeItem('shifttrack_data');
  location.reload();
}

function saveToStorage() {
  try {
    localStorage.setItem('shifttrack_data', JSON.stringify({
      employees: state.employees,
      shifts: state.shifts,
      activeShifts: state.activeShifts,
      managerCode: state.managerCode,
      overtimeThreshold: state.overtimeThreshold,
    }));
  } catch (e) {
    showToast('Warning: could not save data (storage full?)', 'error');
    console.error('saveToStorage failed:', e);
  }
}

// ---- LOGIN ----
function showLogin() {
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('loginStep1').style.display = 'block';
  document.getElementById('loginStep2').style.display = 'none';
  document.getElementById('loginName').value = '';
  document.getElementById('loginCode').value = '';
  document.getElementById('managerCodeInput').value = '';
  document.getElementById('employeeLoginError').textContent = '';
  document.getElementById('managerLoginError').textContent = '';
  switchLoginTab('employee');
}

function switchLoginTab(tab) {
  const empForm = document.getElementById('employeeLoginForm');
  const mgrForm = document.getElementById('managerLoginForm');
  const tabEmp = document.getElementById('tabEmployee');
  const tabMgr = document.getElementById('tabManager');
  if (tab === 'employee') {
    empForm.style.display = 'block';
    mgrForm.style.display = 'none';
    tabEmp.classList.add('active');
    tabMgr.classList.remove('active');
  } else {
    empForm.style.display = 'none';
    mgrForm.style.display = 'block';
    tabEmp.classList.remove('active');
    tabMgr.classList.add('active');
    document.getElementById('managerCodeHint').textContent = `Default code: ${state.managerCode}`;
  }
}

function loginEmployee() {
  const name = document.getElementById('loginName').value.trim();
  const code = document.getElementById('loginCode').value.trim();
  const errEl = document.getElementById('employeeLoginError');
  if (!name || !code) {
    errEl.textContent = 'Please enter your name and access code.';
    return;
  }
  const emp = state.employees.find(
    e => e.name.toLowerCase() === name.toLowerCase() && e.code === code
  );
  if (!emp) {
    errEl.textContent = 'Invalid name or access code.';
    return;
  }
  state.session = { role: 'employee', employee: emp.name, store: null };
  document.getElementById('loginStep1').style.display = 'none';
  document.getElementById('loginStep2').style.display = 'block';
  document.getElementById('loginWelcome').textContent = `Welcome, ${emp.name}!`;
}

function loginManager() {
  const code = document.getElementById('managerCodeInput').value.trim();
  const errEl = document.getElementById('managerLoginError');
  if (!code) {
    errEl.textContent = 'Please enter the manager code.';
    return;
  }
  if (code !== state.managerCode) {
    errEl.textContent = 'Incorrect manager code.';
    return;
  }
  state.session = { role: 'manager', employee: null, store: null };
  document.getElementById('loginOverlay').style.display = 'none';
  enterManagerMode();
}

function selectStoreFromBtn(btn) {
  selectStore(btn.dataset.store);
}

function selectStore(store) {
  state.session.store = store;
  document.getElementById('loginOverlay').style.display = 'none';
  enterEmployeeMode();
}

function backToLogin() {
  document.getElementById('loginStep1').style.display = 'block';
  document.getElementById('loginStep2').style.display = 'none';
}

function logout() {
  state.session = null;
  weekOffset = 0;
  stopDurationTick();
  document.getElementById('logoutBtn').style.display = 'none';
  document.getElementById('sessionBadge').style.display = 'none';
  document.getElementById('punchCard').style.display = 'none';
  document.getElementById('managerCard').style.display = 'none';
  document.getElementById('payrollCard').style.display = 'none';
  document.getElementById('btnAddShift').style.display = 'none';
  closeShiftModal();
  showLogin();
}

// ---- EMPLOYEE MODE ----
function enterEmployeeMode() {
  const { employee, store } = state.session;

  document.getElementById('sessionBadge').style.display = 'flex';
  document.getElementById('sessionBadgeText').textContent = `${employee}  ·  ${store}`;
  document.getElementById('logoutBtn').style.display = 'block';

  document.getElementById('punchCard').style.display = 'block';
  document.getElementById('managerCard').style.display = 'none';
  document.getElementById('storeNameDisplay').textContent = store;

  document.getElementById('filterStore').style.display = 'none';

  renderAll();
}

// ---- MANAGER MODE ----
function enterManagerMode() {
  document.getElementById('sessionBadge').style.display = 'flex';
  document.getElementById('sessionBadgeText').textContent = 'Manager View';
  document.getElementById('logoutBtn').style.display = 'block';

  document.getElementById('punchCard').style.display = 'none';
  document.getElementById('managerCard').style.display = 'block';

  document.getElementById('filterStore').style.display = 'block';
  document.getElementById('btnAddShift').style.display = 'block';

  document.getElementById('payrollCard').style.display = 'block';
  document.getElementById('otThreshold').value = state.overtimeThreshold !== null ? state.overtimeThreshold : '';

  renderAll();
  renderEmployeeList();
  renderPayroll();
}

// ---- MANAGER: EMPLOYEE MANAGEMENT ----
function managerAddEmployee() {
  const name = document.getElementById('newEmpName').value.trim();
  const code = document.getElementById('newEmpCode').value.trim();
  const rateVal = parseFloat(document.getElementById('newEmpRate').value);
  const rate = isNaN(rateVal) || rateVal < 0 ? 0 : rateVal;
  if (!name || !code) {
    showToast('Enter both name and access code.', 'error');
    return;
  }
  if (code.length < 3) {
    showToast('Access code must be at least 3 characters.', 'error');
    return;
  }
  if (state.employees.find(e => e.name.toLowerCase() === name.toLowerCase())) {
    showToast('Employee already exists.', 'error');
    return;
  }
  state.employees.push({ name, code, rate });
  document.getElementById('newEmpName').value = '';
  document.getElementById('newEmpCode').value = '';
  document.getElementById('newEmpRate').value = '';
  saveToStorage();
  renderEmployeeList();
  updateFilterDropdown();
  showToast(`Employee "${name}" added!`, 'success');
}

function removeEmployee(name) {
  if (!confirm(`Remove employee "${name}"?`)) return;
  state.employees = state.employees.filter(e => e.name !== name);
  // Clean up orphaned active shift for this employee
  if (state.activeShifts[name]) {
    delete state.activeShifts[name];
  }
  saveToStorage();
  renderEmployeeList();
  updateFilterDropdown();
  renderAll();
  showToast(`Employee "${name}" removed.`, 'info');
}

function renderEmployeeList() {
  const list = document.getElementById('employeeList');
  list.innerHTML = '';
  if (!state.employees.length) {
    list.innerHTML = '<div class="emp-list-empty">No employees added yet.</div>';
    return;
  }
  state.employees.forEach(emp => {
    const row = document.createElement('div');
    row.className = 'emp-list-row';
    row.innerHTML = `
      <div class="emp-list-info">
        <span class="emp-list-name">${emp.name}</span>
        <span class="emp-list-code mono">Code: ${emp.code}</span>
      </div>
      <div class="emp-rate-wrap">
        <span class="emp-rate-sym">$</span>
        <input type="number" class="emp-rate-input" value="${(emp.rate||0).toFixed(2)}" min="0" step="0.25"
          onchange="updateEmployeeRate('${emp.name.replace(/'/g,"\\'")}', this.value)" />
        <span class="emp-rate-sym">/hr</span>
      </div>
      <button class="btn-delete" onclick="removeEmployee('${emp.name.replace(/'/g,"\\'")}')">✕</button>
    `;
    list.appendChild(row);
  });
}

function changeManagerCode() {
  const newCode = document.getElementById('newManagerCode').value.trim();
  if (!newCode || newCode.length < 4) {
    showToast('Code must be at least 4 characters.', 'error');
    return;
  }
  state.managerCode = newCode;
  saveToStorage();
  document.getElementById('newManagerCode').value = '';
  showToast('Manager code updated!', 'success');
}

function updateEmployeeRate(name, val) {
  const emp = state.employees.find(e => e.name === name);
  if (!emp) return;
  const rate = parseFloat(val);
  if (isNaN(rate) || rate < 0) {
    showToast('Rate must be a positive number.', 'error');
    return;
  }
  emp.rate = rate;
  saveToStorage();
  renderPayroll();
}

function updateOTThreshold(val) {
  const trimmed = val.trim();
  if (trimmed === '') {
    state.overtimeThreshold = null;
  } else {
    const n = parseInt(trimmed);
    if (!isNaN(n) && n > 0) {
      state.overtimeThreshold = n;
    } else {
      return;
    }
  }
  saveToStorage();
  renderPayroll();
}

function computePayroll() {
  const { sun, sat } = getWeekBounds(weekOffset);
  return state.employees.map(emp => {
    const empShifts = state.shifts.filter(s =>
      s.employee === emp.name && s.clockOut &&
      s.clockIn >= sun.getTime() && s.clockIn <= sat.getTime()
    );
    const hoursPerDay = Array(7).fill(0);
    empShifts.forEach(s => {
      hoursPerDay[new Date(s.clockIn).getDay()] += s.duration / 3600000;
    });
    const totalHours = hoursPerDay.reduce((a, b) => a + b, 0);
    const hasThreshold = state.overtimeThreshold !== null;
    const regHours = hasThreshold ? Math.min(totalHours, state.overtimeThreshold) : totalHours;
    const otHours = hasThreshold ? Math.max(0, totalHours - state.overtimeThreshold) : 0;
    const rate = emp.rate || 0;
    const grossPay = regHours * rate + otHours * rate * 1.5;
    return { name: emp.name, rate, hoursPerDay, totalHours, regHours, otHours, grossPay };
  });
}

function renderPayroll() {
  const tbody = document.getElementById('payrollBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const payroll = computePayroll();
  if (!payroll.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="12">No employees added yet.</td></tr>`;
    return;
  }
  let totalGross = 0;
  payroll.forEach(row => {
    const tr = document.createElement('tr');
    totalGross += row.grossPay;
    tr.innerHTML = `
      <td class="pay-name">${row.name}</td>
      ${row.hoursPerDay.map(h => `<td class="pay-day">${h > 0 ? h.toFixed(2) : '—'}</td>`).join('')}
      <td class="pay-total">${row.totalHours.toFixed(2)}</td>
      <td class="pay-ot${row.otHours > 0 ? ' has-ot' : ''}">${row.otHours > 0 ? row.otHours.toFixed(2) : '—'}</td>
      <td class="pay-rate">$${row.rate.toFixed(2)}</td>
      <td class="pay-gross">$${row.grossPay.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
  const tfoot = document.createElement('tr');
  tfoot.className = 'pay-total-row';
  tfoot.innerHTML = `
    <td colspan="10" style="text-align:right;padding-right:16px">Total Payroll</td>
    <td></td>
    <td class="pay-gross" style="font-size:15px">$${totalGross.toFixed(2)}</td>
  `;
  tbody.appendChild(tfoot);
}

function exportPayrollCSV() {
  const payroll = computePayroll();
  if (!payroll.length) { showToast('No employees to export.', 'info'); return; }
  const { sun, sat } = getWeekBounds(weekOffset);
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const weekStr = `${fmt(sun)}-${fmt(sat)}`.replace(/\s/g,'');
  const headers = ['Employee','Sun','Mon','Tue','Wed','Thu','Fri','Sat','Total Hrs','OT Hrs','Rate ($/hr)','Reg Pay','OT Pay','Gross Pay'];
  const rows = payroll.map(r => [
    r.name,
    ...r.hoursPerDay.map(h => h.toFixed(2)),
    r.totalHours.toFixed(2), r.otHours.toFixed(2),
    r.rate.toFixed(2),
    (r.regHours * r.rate).toFixed(2),
    (r.otHours * r.rate * 1.5).toFixed(2),
    r.grossPay.toFixed(2),
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `payroll_${weekStr}.csv`;
  a.click();
  showToast('Payroll CSV exported!', 'success');
}

function printPayroll() {
  const payroll = computePayroll();
  const { sun, sat } = getWeekBounds(weekOffset);
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const weekStr = `${fmt(sun)} – ${fmt(sat)}`;
  const totalGross = payroll.reduce((s, r) => s + r.grossPay, 0);
  const rows = payroll.map(r => `
    <tr>
      <td>${r.name}</td>
      ${r.hoursPerDay.map(h => `<td>${h > 0 ? h.toFixed(2) : '—'}</td>`).join('')}
      <td>${r.totalHours.toFixed(2)}</td>
      <td>${r.otHours > 0 ? r.otHours.toFixed(2) : '—'}</td>
      <td>$${r.rate.toFixed(2)}</td>
      <td><strong>$${r.grossPay.toFixed(2)}</strong></td>
    </tr>
  `).join('');
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Payroll ${weekStr}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:24px;color:#000}
    h2{margin-bottom:4px}
    .sub{color:#666;font-size:13px;margin-bottom:20px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{background:#f2f2f2;border:1px solid #ccc;padding:7px 10px;text-align:left}
    td{border:1px solid #ddd;padding:6px 10px}
    .tot{background:#f9f9f9;font-weight:700}
    @media print{body{padding:0}}
  </style></head><body>
  <h2>ShiftTrack — Payroll Report</h2>
  <div class="sub">Week: ${weekStr}</div>
  <table>
    <thead><tr>
      <th>Employee</th><th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th>
      <th>Total Hrs</th><th>OT Hrs</th><th>Rate</th><th>Gross Pay</th>
    </tr></thead>
    <tbody>${rows}
      <tr class="tot">
        <td colspan="10" align="right">Total Payroll</td>
        <td></td>
        <td><strong>$${totalGross.toFixed(2)}</strong></td>
      </tr>
    </tbody>
  </table>
  </body></html>`);
  win.document.close();
  win.print();
}

// ---- LIVE CLOCK ----
function startLiveClock() {
  function tick() {
    const now = new Date();
    document.getElementById('liveClock').textContent = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const punchEl = document.getElementById('punchTime');
    if (punchEl) punchEl.textContent = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  }
  tick();
  setInterval(tick, 1000);
}

// ---- DATE HELPERS ----
function setTodayDate() {
  const now = new Date();
  document.getElementById('todayDate').textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric'
  });
}

function setWeekRange() {
  const { sun, sat } = getWeekBounds(weekOffset);
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const rangeStr = `${fmt(sun)} – ${fmt(sat)}`;
  document.getElementById('weekRange').textContent = rangeStr;
  const label = weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : `${Math.abs(weekOffset)} Weeks Ago`;
  document.getElementById('weekTitle').textContent = label;
  document.getElementById('logWeekLabel').textContent = `${label}  ·  ${rangeStr}`;
  const payrollLbl = document.getElementById('payrollWeekLabel');
  if (payrollLbl) payrollLbl.textContent = `${label}  ·  ${rangeStr}`;
  document.getElementById('btnNextWeek').disabled = weekOffset >= 0;
}

function changeWeek(delta) {
  weekOffset = Math.min(0, weekOffset + delta);
  setWeekRange();
  renderWeekStats();
  renderLog();
  renderPayroll();
}

function getWeekBounds(offset) {
  const now = new Date();
  const day = now.getDay();
  const sun = new Date(now);
  sun.setDate(now.getDate() - day + offset * 7);
  sun.setHours(0, 0, 0, 0);
  const sat = new Date(sun);
  sat.setDate(sun.getDate() + 6);
  sat.setHours(23, 59, 59, 999);
  return { sun, sat };
}

function formatDuration(ms) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m.toString().padStart(2,'0')}m`;
}

function hoursFromMs(ms) {
  return (ms / 3600000).toFixed(2);
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

function getThisWeekBounds() {
  return getWeekBounds(weekOffset);
}

function minutesToTimeStr(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2,'0')} ${ampm}`;
}

// ---- CLOCK IN/OUT ----
function updateClockButtons() {
  if (!state.session || state.session.role !== 'employee') return;

  const inBtn = document.getElementById('clockInBtn');
  const outBtn = document.getElementById('clockOutBtn');
  const badge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const sessionInfo = document.getElementById('sessionInfo');

  const myShift = state.activeShifts[state.session.employee] || null;
  const isActive = !!myShift;
  inBtn.disabled = isActive;
  outBtn.disabled = !isActive;

  if (isActive) {
    badge.classList.add('active');
    statusText.textContent = `Working: ${myShift.employee}`;
    sessionInfo.style.display = 'flex';
    document.getElementById('sessionStart').textContent = formatTime(myShift.clockIn);
    startDurationTick();
  } else {
    badge.classList.remove('active');
    statusText.textContent = `Ready: ${state.session.employee}`;
    sessionInfo.style.display = 'none';
    stopDurationTick();
  }
}

function startDurationTick() {
  stopDurationTick();
  durationInterval = setInterval(() => {
    if (!state.session) return;
    const myShift = state.activeShifts[state.session.employee];
    if (!myShift) return;
    const ms = Date.now() - myShift.clockIn;
    document.getElementById('sessionDuration').textContent = formatDuration(ms);
  }, 1000);
}

function stopDurationTick() {
  if (durationInterval) { clearInterval(durationInterval); durationInterval = null; }
}

function clockIn() {
  if (!state.session || state.session.role !== 'employee') return;
  if (state.activeShifts[state.session.employee]) {
    showToast('Already clocked in!', 'error');
    return;
  }
  const now = Date.now();
  state.activeShifts[state.session.employee] = {
    id: now.toString(),
    employee: state.session.employee,
    store: state.session.store,
    clockIn: now,
    date: new Date().toDateString(),
  };
  saveToStorage();
  updateClockButtons();
  renderLog();
  showToast(`Clocked in at ${formatTime(now)}`, 'success');
}

function clockOut() {
  const myShift = state.session && state.activeShifts[state.session.employee];
  if (!myShift) {
    showToast('Not currently clocked in.', 'error');
    return;
  }
  const now = Date.now();
  const shift = {
    id: myShift.id,
    employee: myShift.employee,
    store: myShift.store,
    clockIn: myShift.clockIn,
    clockOut: now,
    date: myShift.date,
    duration: now - myShift.clockIn,
  };
  state.shifts.unshift(shift);
  delete state.activeShifts[state.session.employee];
  saveToStorage();
  updateClockButtons();
  renderAll();
  showToast(`Clocked out! ${hoursFromMs(shift.duration)} hours logged`, 'success');
}

function deleteShift(id) {
  if (!confirm('Delete this shift record?')) return;
  state.shifts = state.shifts.filter(s => s.id !== id);
  saveToStorage();
  renderAll();
  showToast('Shift deleted.', 'info');
}

// ---- SHIFT MODAL ----
let _shiftModalMode = null; // 'edit' | 'add' | 'active'
let _shiftModalId = null;

function tsToDatetimeLocal(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function populateModalEmployeeSelect(selected, disabled) {
  const sel = document.getElementById('smEmployee');
  if (!state.employees.length) {
    sel.innerHTML = '<option value="">No employees added</option>';
  } else {
    sel.innerHTML = state.employees.map(e =>
      `<option value="${e.name}" ${e.name === selected ? 'selected' : ''}>${e.name}</option>`
    ).join('');
  }
  sel.disabled = disabled;
}

function openEditShiftModal(id) {
  const shift = state.shifts.find(s => s.id === id);
  if (!shift) return;
  _shiftModalMode = 'edit';
  _shiftModalId = id;

  document.getElementById('shiftModalTitle').textContent = 'Edit Shift';
  populateModalEmployeeSelect(shift.employee, true);
  document.getElementById('smStore').value = shift.store;
  document.getElementById('smStore').disabled = false;
  document.getElementById('smClockIn').value = tsToDatetimeLocal(shift.clockIn);
  document.getElementById('smClockOut').value = shift.clockOut ? tsToDatetimeLocal(shift.clockOut) : '';
  document.getElementById('smClockOutLabel').textContent = 'Clock Out';
  document.getElementById('smClockOutHint').textContent = '';
  document.getElementById('smError').textContent = '';
  document.getElementById('shiftModal').style.display = 'flex';
}

function openAddShiftModal() {
  _shiftModalMode = 'add';
  _shiftModalId = null;

  document.getElementById('shiftModalTitle').textContent = 'Add Shift';
  populateModalEmployeeSelect(null, false);
  document.getElementById('smStore').value = 'Loteria Store';
  document.getElementById('smStore').disabled = false;
  document.getElementById('smClockIn').value = tsToDatetimeLocal(Date.now());
  document.getElementById('smClockOut').value = '';
  document.getElementById('smClockOutLabel').textContent = 'Clock Out';
  document.getElementById('smClockOutHint').textContent = 'Leave blank if shift is still in progress.';
  document.getElementById('smError').textContent = '';
  document.getElementById('shiftModal').style.display = 'flex';
}

function openActiveShiftModal(employeeName) {
  const activeShift = state.activeShifts[employeeName];
  if (!activeShift) return;
  _shiftModalMode = 'active';
  _shiftModalId = employeeName;

  document.getElementById('shiftModalTitle').textContent = `Fix Shift · ${employeeName}`;
  populateModalEmployeeSelect(employeeName, true);
  document.getElementById('smStore').value = activeShift.store;
  document.getElementById('smStore').disabled = true;
  document.getElementById('smClockIn').value = tsToDatetimeLocal(activeShift.clockIn);
  document.getElementById('smClockOut').value = '';
  document.getElementById('smClockOutLabel').textContent = 'Clock Out';
  document.getElementById('smClockOutHint').textContent = 'Fill in to manually complete this shift.';
  document.getElementById('smError').textContent = '';
  document.getElementById('shiftModal').style.display = 'flex';
}

function saveShiftModal() {
  const empName = document.getElementById('smEmployee').value;
  const store = document.getElementById('smStore').value;
  const clockInVal = document.getElementById('smClockIn').value;
  const clockOutVal = document.getElementById('smClockOut').value;
  const errEl = document.getElementById('smError');

  if (!empName || !clockInVal) {
    errEl.textContent = 'Employee and Clock In are required.';
    return;
  }

  const clockIn = new Date(clockInVal).getTime();
  const clockOut = clockOutVal ? new Date(clockOutVal).getTime() : null;

  if (isNaN(clockIn)) { errEl.textContent = 'Invalid Clock In time.'; return; }
  if (clockOut && isNaN(clockOut)) { errEl.textContent = 'Invalid Clock Out time.'; return; }
  if (clockOut && clockOut <= clockIn) {
    errEl.textContent = 'Clock Out must be after Clock In.';
    return;
  }
  if (clockOut && (clockOut - clockIn) > 24 * 3600000) {
    errEl.textContent = 'Shift duration cannot exceed 24 hours. Please check the times.';
    return;
  }

  if (_shiftModalMode === 'edit') {
    if (!clockOut) { errEl.textContent = 'Clock Out is required for a completed shift.'; return; }
    const shift = state.shifts.find(s => s.id === _shiftModalId);
    if (!shift) return;
    shift.store = store;
    shift.clockIn = clockIn;
    shift.clockOut = clockOut;
    shift.duration = clockOut - clockIn;
    shift.date = new Date(clockIn).toDateString(); // keep date in sync with clockIn

  } else if (_shiftModalMode === 'add') {
    const newShift = {
      id: Date.now().toString(),
      employee: empName,
      store,
      clockIn,
      clockOut: clockOut || null,
      date: new Date(clockIn).toDateString(),
      duration: clockOut ? clockOut - clockIn : null,
    };
    if (clockOut) {
      state.shifts.unshift(newShift);
    } else {
      // Add as active shift
      if (state.activeShifts[empName]) {
        errEl.textContent = `${empName} already has an active shift.`;
        return;
      }
      state.activeShifts[empName] = { id: newShift.id, employee: empName, store, clockIn, date: newShift.date };
    }

  } else if (_shiftModalMode === 'active') {
    const activeShift = state.activeShifts[_shiftModalId];
    if (!activeShift) return;
    // Update clock-in and keep date in sync
    activeShift.clockIn = clockIn;
    activeShift.date = new Date(clockIn).toDateString();
    // If clock-out provided, complete the shift
    if (clockOut) {
      const completed = {
        id: activeShift.id,
        employee: activeShift.employee,
        store: activeShift.store,
        clockIn,
        clockOut,
        date: new Date(clockIn).toDateString(),
        duration: clockOut - clockIn,
      };
      state.shifts.unshift(completed);
      delete state.activeShifts[_shiftModalId];
    }
  }

  saveToStorage();
  renderAll();
  closeShiftModal();
  showToast('Shift saved.', 'success');
}

function closeShiftModal() {
  document.getElementById('shiftModal').style.display = 'none';
  document.getElementById('smStore').disabled = false;
  document.getElementById('smEmployee').disabled = false;
}

function handleModalOverlayClick(e) {
  if (e.target === document.getElementById('shiftModal')) closeShiftModal();
}

// ---- RENDER ALL ----
function renderAll() {
  updateFilterDropdown();
  updateClockButtons();
  renderWeekStats();
  renderLog();
  renderAnalytics();
  if (state.session && state.session.role === 'manager') renderPayroll();
}

function updateFilterDropdown() {
  const sel = document.getElementById('filterEmployee');
  const current = sel.value;
  sel.innerHTML = '<option value="all">All Employees</option>';
  state.employees.forEach(emp => {
    const opt = document.createElement('option');
    opt.value = emp.name; opt.textContent = emp.name;
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
}

// ---- WEEK STATS ----
function renderWeekStats() {
  const { sun, sat } = getThisWeekBounds();
  let weekShifts = state.shifts.filter(s =>
    s.clockOut && s.clockIn >= sun.getTime() && s.clockIn <= sat.getTime()
  );
  // Employee sees only their store
  if (state.session && state.session.role === 'employee' && state.session.store) {
    weekShifts = weekShifts.filter(s => s.store === state.session.store);
  }

  const totalMs = weekShifts.reduce((sum, s) => sum + s.duration, 0);
  document.getElementById('totalHours').textContent = hoursFromMs(totalMs);

  const days = new Set(weekShifts.map(s => new Date(s.clockIn).toDateString()));
  document.getElementById('totalDays').textContent = days.size;

  if (weekShifts.length) {
    const opens = weekShifts.map(s => {
      const d = new Date(s.clockIn);
      return d.getHours() * 60 + d.getMinutes();
    });
    const closes = weekShifts.map(s => {
      const d = new Date(s.clockOut);
      return d.getHours() * 60 + d.getMinutes();
    });
    const avgO = opens.reduce((a,b)=>a+b,0) / opens.length;
    const avgC = closes.reduce((a,b)=>a+b,0) / closes.length;
    document.getElementById('avgOpen').textContent = minutesToTimeStr(avgO);
    document.getElementById('avgClose').textContent = minutesToTimeStr(avgC);
  } else {
    document.getElementById('avgOpen').textContent = '--';
    document.getElementById('avgClose').textContent = '--';
  }

  renderBarChart(weekShifts, sun);
}

// ---- WEEK CALENDAR ----
function renderBarChart(_weekShifts, weekStart) {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cal = document.getElementById('weekCalendar');
  cal.innerHTML = '';

  DAYS.forEach((label, i) => {
    const cellDate = new Date(weekStart);
    cellDate.setDate(weekStart.getDate() + i);
    cellDate.setHours(0, 0, 0, 0);
    const isToday = cellDate.getTime() === today.getTime();

    const cell = document.createElement('div');
    cell.className = 'cal-cell' + (isToday ? ' cal-today' : '');

    cell.innerHTML = `
      <div class="cal-day">${label}</div>
      <div class="cal-date">${cellDate.getDate()}</div>
    `;
    cal.appendChild(cell);
  });
}

// ---- SHIFT LOG ----
function renderLog() {
  const filterEmp = document.getElementById('filterEmployee').value;
  const filterStoreEl = document.getElementById('filterStore');
  const filterStore = filterStoreEl.style.display !== 'none' ? filterStoreEl.value : 'all';
  const isManager = state.session && state.session.role === 'manager';
  const tbody = document.getElementById('shiftBody');
  tbody.innerHTML = '';

  const { sun, sat } = getWeekBounds(weekOffset);
  let rows = state.shifts.filter(s => s.clockIn >= sun.getTime() && s.clockIn <= sat.getTime());

  // Show active shifts only for current week
  if (weekOffset === 0) {
    Object.values(state.activeShifts).forEach(s => {
      rows.unshift({ ...s, clockOut: null, duration: null, _active: true });
    });
  }

  // Employee sees only their store
  if (!isManager && state.session && state.session.store) {
    rows = rows.filter(s => s.store === state.session.store);
  }

  // Manager filters
  if (filterStore !== 'all') rows = rows.filter(s => s.store === filterStore);
  if (filterEmp !== 'all') rows = rows.filter(s => s.employee === filterEmp);

  // Sort by date descending (newest first), active shifts always on top
  rows.sort((a, b) => {
    if (a._active && !b._active) return -1;
    if (!a._active && b._active) return 1;
    return b.clockIn - a.clockIn;
  });

  if (!rows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No shifts recorded yet. Clock in to get started!</td></tr>`;
    return;
  }

  rows.forEach(shift => {
    const tr = document.createElement('tr');
    const hrs = shift.duration ? `${hoursFromMs(shift.duration)} hrs` : '—';
    const status = shift._active
      ? `<span class="status-pill active">Active</span>`
      : `<span class="status-pill complete">Complete</span>`;

    let actions = '';
    if (isManager) {
      const empSafe = shift.employee.replace(/'/g, "\\'");
      if (shift._active) {
        actions = `<button class="btn-edit-shift" onclick="openActiveShiftModal('${empSafe}')" title="Fix clock-in / add clock-out">✎</button>`;
      } else {
        actions = `
          <button class="btn-edit-shift" onclick="openEditShiftModal('${shift.id}')" title="Edit shift">✎</button>
          <button class="btn-delete" onclick="deleteShift('${shift.id}')" title="Delete">✕</button>
        `;
      }
    }

    tr.innerHTML = `
      <td style="color:var(--text);font-family:var(--font-head)">${shift.employee}</td>
      <td><span class="store-pill">${shift.store || '—'}</span></td>
      <td>${formatDate(shift.clockIn)}</td>
      <td>${formatTime(shift.clockIn)}</td>
      <td>${shift.clockOut ? formatTime(shift.clockOut) : '<span style="color:var(--accent3)">In progress…</span>'}</td>
      <td style="color:var(--accent)">${hrs}</td>
      <td>${status}</td>
      <td class="td-actions">${actions}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ---- ANALYTICS ----
function renderAnalytics() {
  const isManager = state.session && state.session.role === 'manager';
  if (isManager) {
    renderManagerAnalytics();
  } else {
    renderEmployeeAnalytics();
  }
}

function renderEmployeeAnalytics() {
  const empName = state.session && state.session.employee;
  const empData = state.employees.find(e => e.name === empName);
  const rate = empData ? (empData.rate || 0) : 0;

  // This week's shifts for this employee
  const { sun, sat } = getWeekBounds(weekOffset);
  const myWeekShifts = state.shifts.filter(s =>
    s.employee === empName && s.clockOut &&
    s.clockIn >= sun.getTime() && s.clockIn <= sat.getTime()
  );

  // Last week for comparison
  const { sun: prevSun, sat: prevSat } = getWeekBounds(weekOffset - 1);
  const myLastWeekShifts = state.shifts.filter(s =>
    s.employee === empName && s.clockOut &&
    s.clockIn >= prevSun.getTime() && s.clockIn <= prevSat.getTime()
  );

  // All-time shifts for this employee
  const myAllShifts = state.shifts.filter(s => s.employee === empName && s.clockOut);

  // Hours this week
  const thisWeekHrs = myWeekShifts.reduce((sum, s) => sum + s.duration / 3600000, 0);
  const lastWeekHrs = myLastWeekShifts.reduce((sum, s) => sum + s.duration / 3600000, 0);
  const wowDiff = lastWeekHrs > 0 ? ((thisWeekHrs - lastWeekHrs) / lastWeekHrs * 100) : null;

  // Estimated earnings this week
  const estPay = thisWeekHrs * rate;

  // Work streak — count consecutive days backwards from today with at least one shift
  let streak = 0;
  const checkDay = new Date();
  checkDay.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const dayStart = checkDay.getTime();
    const dayEnd = dayStart + 86400000;
    const hasShift = state.shifts.some(s =>
      s.employee === empName && s.clockOut &&
      s.clockIn >= dayStart && s.clockIn < dayEnd
    );
    const hasActive = i === 0 && state.activeShifts[empName];
    if (hasShift || hasActive) {
      streak++;
      checkDay.setDate(checkDay.getDate() - 1);
    } else { break; }
  }

  // Avg clock-in time this week
  const clockInMins = myWeekShifts.map(s => {
    const d = new Date(s.clockIn);
    return d.getHours() * 60 + d.getMinutes();
  });
  const avgClockIn = clockInMins.length
    ? Math.round(clockInMins.reduce((a, b) => a + b, 0) / clockInMins.length)
    : null;

  // Personal records (all time)
  const allTimeHrs = myAllShifts.reduce((sum, s) => sum + s.duration / 3600000, 0);
  const longestShift = myAllShifts.length
    ? myAllShifts.reduce((a, b) => a.duration > b.duration ? a : b)
    : null;
  const avgShiftMs = myAllShifts.length
    ? myAllShifts.reduce((sum, s) => sum + s.duration, 0) / myAllShifts.length
    : 0;

  // Best week — group all-time shifts by week start (Sunday), find max
  const weekMap = {};
  myAllShifts.forEach(s => {
    const d = new Date(s.clockIn);
    const dayOfWeek = d.getDay();
    const weekSun = new Date(d);
    weekSun.setDate(d.getDate() - dayOfWeek);
    weekSun.setHours(0, 0, 0, 0);
    const key = weekSun.getTime();
    weekMap[key] = (weekMap[key] || 0) + s.duration / 3600000;
  });
  const bestWeekHrs = Object.values(weekMap).length ? Math.max(...Object.values(weekMap)) : 0;

  // Hours per day this week (for visual)
  const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayHrs = Array(7).fill(0);
  myWeekShifts.forEach(s => { dayHrs[new Date(s.clockIn).getDay()] += s.duration / 3600000; });
  // Also count active shift for today
  if (weekOffset === 0 && state.activeShifts[empName]) {
    const active = state.activeShifts[empName];
    dayHrs[new Date(active.clockIn).getDay()] += (Date.now() - active.clockIn) / 3600000;
  }
  const maxDayHrs = Math.max(...dayHrs, 0.01);
  const todayIdx = new Date().getDay();

  // Stores worked this week
  const storeIcons = { 'Loteria Store': '🏪', "Maria's Groceries": '🛒', "Sam's 24/7": '🌙' };
  const storesWorked = [...new Set(myWeekShifts.map(s => s.store))];

  document.getElementById('analyticsContent').innerHTML = `
    <div class="emp-analytics">

      <div class="mgr-kpi-row">
        <div class="mgr-kpi ${rate > 0 && estPay > 0 ? 'kpi-perfect' : ''}">
          <div class="mgr-kpi-icon">💰</div>
          <div class="mgr-kpi-body">
            <div class="mgr-kpi-label">Est. Earnings</div>
            <div class="mgr-kpi-val ${rate > 0 ? 'accent-green' : ''}">
              ${rate > 0 ? '$' + estPay.toFixed(2) : thisWeekHrs.toFixed(1) + 'h'}
            </div>
            <div class="mgr-kpi-sub">
              ${rate > 0 ? `@ $${rate.toFixed(2)}/hr · ${thisWeekHrs.toFixed(1)}h this week`
                         : 'Rate not set — showing hours'}
            </div>
          </div>
        </div>

        <div class="mgr-kpi">
          <div class="mgr-kpi-icon">⏱</div>
          <div class="mgr-kpi-body">
            <div class="mgr-kpi-label">Hours This Week</div>
            <div class="mgr-kpi-val">${thisWeekHrs > 0 ? thisWeekHrs.toFixed(1) + 'h' : '--'}</div>
            <div class="mgr-kpi-sub ${wowDiff !== null ? (wowDiff >= 0 ? 'up' : 'down') : ''}">
              ${wowDiff !== null
                ? (wowDiff >= 0 ? '▲' : '▼') + ' ' + Math.abs(wowDiff).toFixed(0) + '% vs last week'
                : thisWeekHrs === 0 ? 'No shifts yet this week' : 'No prior week to compare'}
            </div>
          </div>
        </div>

        <div class="mgr-kpi ${streak >= 3 ? 'kpi-active' : ''}">
          <div class="mgr-kpi-icon">${streak >= 5 ? '🔥' : streak >= 3 ? '⚡' : '📅'}</div>
          <div class="mgr-kpi-body">
            <div class="mgr-kpi-label">Work Streak</div>
            <div class="mgr-kpi-val ${streak >= 3 ? 'accent-green' : ''}">${streak} day${streak !== 1 ? 's' : ''}</div>
            <div class="mgr-kpi-sub">
              ${streak === 0 ? 'Clock in to start a streak!'
                : streak === 1 ? 'Good start — keep it going!'
                : streak < 5 ? 'Building momentum!'
                : 'On a roll! 🎉'}
            </div>
          </div>
        </div>

        <div class="mgr-kpi">
          <div class="mgr-kpi-icon">⏰</div>
          <div class="mgr-kpi-body">
            <div class="mgr-kpi-label">Avg Clock-In</div>
            <div class="mgr-kpi-val">${avgClockIn !== null ? minutesToTimeStr(avgClockIn) : '--'}</div>
            <div class="mgr-kpi-sub">
              ${avgClockIn !== null ? `across ${myWeekShifts.length} shift${myWeekShifts.length !== 1 ? 's' : ''} this week`
                                   : 'No shifts this week'}
            </div>
          </div>
        </div>
      </div>

      <div class="emp-analytics-lower">

        <div class="emp-week-panel">
          <div class="mgr-panel-title">My Week — Day by Day</div>
          <div class="emp-day-bars">
            ${DAY_SHORT.map((d, i) => {
              const h = dayHrs[i];
              const pct = Math.round((h / maxDayHrs) * 100);
              const isToday = weekOffset === 0 && i === todayIdx;
              const isActive = isToday && state.activeShifts[empName];
              return `
                <div class="emp-day-col ${isToday ? 'emp-day-today' : ''}">
                  <div class="emp-day-hrs-label">${h > 0 ? h.toFixed(1) : ''}</div>
                  <div class="emp-day-bar-track">
                    <div class="emp-day-bar-fill ${isActive ? 'emp-bar-active' : ''}"
                         style="height:${h > 0 ? Math.max(pct, 6) : 0}%"></div>
                  </div>
                  <div class="emp-day-label">${d}</div>
                  ${storesWorked.length > 1
                    ? `<div class="emp-day-store-dot" title="${myWeekShifts.filter(s => new Date(s.clockIn).getDay() === i).map(s => s.store).join(', ')}"
                          style="opacity:${h > 0 ? 1 : 0.15}">
                        ${myWeekShifts.filter(s => new Date(s.clockIn).getDay() === i).length > 0
                          ? storeIcons[myWeekShifts.find(s => new Date(s.clockIn).getDay() === i).store] || '🏪'
                          : '·'}
                       </div>`
                    : ''}
                </div>
              `;
            }).join('')}
          </div>
          ${storesWorked.length > 0 ? `
            <div class="emp-stores-worked">
              ${storesWorked.map(s => `<span class="emp-store-tag">${storeIcons[s] || '🏪'} ${s}</span>`).join('')}
            </div>` : ''}
        </div>

        <div class="emp-records-panel">
          <div class="mgr-panel-title">My All-Time Records</div>
          <div class="emp-records-grid">
            <div class="emp-record-row">
              <span class="emp-record-icon">📋</span>
              <span class="emp-record-label">Total Shifts</span>
              <span class="emp-record-val">${myAllShifts.length}</span>
            </div>
            <div class="emp-record-row">
              <span class="emp-record-icon">⏳</span>
              <span class="emp-record-label">Total Hours</span>
              <span class="emp-record-val">${allTimeHrs > 0 ? allTimeHrs.toFixed(1) + 'h' : '--'}</span>
            </div>
            <div class="emp-record-row">
              <span class="emp-record-icon">🏆</span>
              <span class="emp-record-label">Longest Shift</span>
              <span class="emp-record-val">${longestShift ? formatDuration(longestShift.duration) : '--'}</span>
            </div>
            <div class="emp-record-row">
              <span class="emp-record-icon">📊</span>
              <span class="emp-record-label">Avg Shift Length</span>
              <span class="emp-record-val">${myAllShifts.length ? formatDuration(avgShiftMs) : '--'}</span>
            </div>
            <div class="emp-record-row">
              <span class="emp-record-icon">🌟</span>
              <span class="emp-record-label">Best Week</span>
              <span class="emp-record-val">${bestWeekHrs > 0 ? bestWeekHrs.toFixed(1) + 'h' : '--'}</span>
            </div>
            <div class="emp-record-row">
              <span class="emp-record-icon">💰</span>
              <span class="emp-record-label">All-Time Earnings</span>
              <span class="emp-record-val ${rate > 0 ? 'accent-green' : ''}">
                ${rate > 0 ? '$' + (allTimeHrs * rate).toFixed(2) : 'Rate not set'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
}

function renderManagerAnalytics() {
  const { sun, sat } = getWeekBounds(weekOffset);
  const weekShifts = state.shifts.filter(s =>
    s.clockOut && s.clockIn >= sun.getTime() && s.clockIn <= sat.getTime()
  );

  // Store config — open times in minutes from midnight, null = 24/7
  const STORES = ['Loteria Store', "Maria's Groceries", "Sam's 24/7"];
  const STORE_ICONS = { 'Loteria Store': '🏪', "Maria's Groceries": '🛒', "Sam's 24/7": '🌙' };
  // Scheduled open time per store (minutes from midnight). null = 24/7 (always covered).
  const STORE_OPEN_MIN = {
    'Loteria Store': 9 * 60,       // 9:00 AM
    "Maria's Groceries": 9 * 60,   // 9:00 AM
    "Sam's 24/7": null,            // 24/7
  };
  const GRACE_MIN = 15; // 15-minute grace window

  const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Payroll totals
  const payroll = computePayroll();
  const totalCost = payroll.reduce((sum, p) => sum + p.grossPay, 0);

  // Top performer (most hours this week)
  const topPerformer = payroll.reduce((best, p) =>
    p.totalHours > (best ? best.totalHours : -1) ? p : best, null
  );

  // Active now
  const activeEntries = Object.entries(state.activeShifts);
  const activeCount = activeEntries.length;

  // On-time openings: for each day × store (excluding 24/7), did first clock-in hit before open + grace?
  let onTimeCount = 0, lateCount = 0, unstaffedCount = 0;
  // Per-day per-store status for the opening grid: 'ontime' | 'late' | 'unstaffed' | '24h'
  const openingGrid = DAY_SHORT.map((dayLabel, dayIdx) => {
    const dayStart = new Date(sun);
    dayStart.setDate(sun.getDate() + dayIdx);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);

    return {
      day: dayLabel,
      stores: STORES.map(store => {
        const openMin = STORE_OPEN_MIN[store];
        if (openMin === null) return { store, status: '24h' };

        const dayStoreShifts = weekShifts.filter(s =>
          s.store === store &&
          s.clockIn >= dayStart.getTime() && s.clockIn < dayEnd.getTime()
        );
        if (!dayStoreShifts.length) {
          unstaffedCount++;
          return { store, status: 'unstaffed' };
        }
        const firstIn = Math.min(...dayStoreShifts.map(s => s.clockIn));
        const firstInMin = new Date(firstIn).getHours() * 60 + new Date(firstIn).getMinutes();
        if (firstInMin <= openMin + GRACE_MIN) {
          onTimeCount++;
          return { store, status: 'ontime', time: minutesToTimeStr(firstInMin) };
        } else {
          lateCount++;
          return { store, status: 'late', time: minutesToTimeStr(firstInMin) };
        }
      }),
    };
  });
  const totalTracked = onTimeCount + lateCount; // unstaffed days excluded from rate
  const onTimePct = totalTracked > 0 ? Math.round(onTimeCount / totalTracked * 100) : null;

  // Store hours
  const storeHours = {};
  STORES.forEach(s => { storeHours[s] = 0; });
  weekShifts.forEach(s => {
    if (storeHours[s.store] !== undefined) storeHours[s.store] += s.duration / 3600000;
  });
  const maxStoreHrs = Math.max(...Object.values(storeHours), 0.01);

  // OT watch
  const otOver = payroll.filter(p => p.otHours > 0);
  const otNear = state.overtimeThreshold !== null
    ? payroll.filter(p => p.totalHours >= state.overtimeThreshold * 0.75 && p.otHours === 0 && p.totalHours > 0)
    : [];

  // Week-over-week hours
  const { sun: prevSun, sat: prevSat } = getWeekBounds(weekOffset - 1);
  const prevShifts = state.shifts.filter(s =>
    s.clockOut && s.clockIn >= prevSun.getTime() && s.clockIn <= prevSat.getTime()
  );
  const thisWeekHrs = weekShifts.reduce((sum, s) => sum + s.duration / 3600000, 0);
  const lastWeekHrs = prevShifts.reduce((sum, s) => sum + s.duration / 3600000, 0);
  const wowDiff = lastWeekHrs > 0 ? ((thisWeekHrs - lastWeekHrs) / lastWeekHrs * 100) : null;

  document.getElementById('analyticsContent').innerHTML = `
    <div class="mgr-analytics">

      <div class="mgr-kpi-row">
        <div class="mgr-kpi">
          <div class="mgr-kpi-icon">💰</div>
          <div class="mgr-kpi-body">
            <div class="mgr-kpi-label">Weekly Payroll</div>
            <div class="mgr-kpi-val ${totalCost > 0 ? 'accent-green' : ''}">$${totalCost.toFixed(2)}</div>
            ${wowDiff !== null ? `<div class="mgr-kpi-sub ${wowDiff >= 0 ? 'up' : 'down'}">${wowDiff >= 0 ? '▲' : '▼'} ${Math.abs(wowDiff).toFixed(0)}% vs last week</div>` : '<div class="mgr-kpi-sub">No prior week data</div>'}
          </div>
        </div>
        <div class="mgr-kpi">
          <div class="mgr-kpi-icon">🏆</div>
          <div class="mgr-kpi-body">
            <div class="mgr-kpi-label">Top Performer</div>
            <div class="mgr-kpi-val">${topPerformer && topPerformer.totalHours > 0 ? topPerformer.name : '--'}</div>
            <div class="mgr-kpi-sub">${topPerformer && topPerformer.totalHours > 0 ? topPerformer.totalHours.toFixed(1) + 'h this week' : 'No shifts yet'}</div>
          </div>
        </div>
        <div class="mgr-kpi ${activeCount > 0 ? 'kpi-active' : ''}">
          <div class="mgr-kpi-icon">🟢</div>
          <div class="mgr-kpi-body">
            <div class="mgr-kpi-label">Active Now</div>
            <div class="mgr-kpi-val ${activeCount > 0 ? 'accent-green' : ''}">${activeCount}</div>
            <div class="mgr-kpi-sub">${activeCount === 0 ? 'Everyone clocked out' : activeEntries.map(([name, shift]) => `${name} @ ${shift.store}`).join(', ')}</div>
          </div>
        </div>
        <div class="mgr-kpi ${lateCount > 0 ? 'kpi-warn' : (onTimePct === 100 ? 'kpi-perfect' : '')}">
          <div class="mgr-kpi-icon">⏰</div>
          <div class="mgr-kpi-body">
            <div class="mgr-kpi-label">On-Time Openings</div>
            <div class="mgr-kpi-val ${onTimePct === 100 ? 'accent-green' : lateCount > 0 ? 'accent-warn' : ''}">
              ${onTimePct !== null ? `${onTimeCount}/${totalTracked}` : '--'}
            </div>
            <div class="mgr-kpi-sub">
              ${onTimePct === null ? 'No staffed opens yet'
                : onTimePct === 100 ? 'All opens on schedule ✓'
                : `${lateCount} late open${lateCount > 1 ? 's' : ''} · ${onTimePct}% on time`}
            </div>
          </div>
        </div>
      </div>

      <div class="mgr-analytics-lower">
        <div class="mgr-stores-panel">
          <div class="mgr-panel-title">Hours by Store</div>
          ${STORES.map(store => {
            const hrs = storeHours[store];
            const pct = Math.round((hrs / maxStoreHrs) * 100);
            return `
              <div class="mgr-store-row">
                <div class="mgr-store-name">${STORE_ICONS[store]} ${store}</div>
                <div class="mgr-store-track">
                  <div class="mgr-store-fill" style="width:${hrs > 0 ? Math.max(pct, 4) : 0}%"></div>
                </div>
                <div class="mgr-store-hrs">${hrs > 0 ? hrs.toFixed(1) + 'h' : '--'}</div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="mgr-ot-panel ${otOver.length > 0 ? 'has-ot' : ''}">
          <div class="mgr-panel-title">OT Watch ${state.overtimeThreshold !== null ? `<span class="ot-threshold-note">(threshold: ${state.overtimeThreshold}h)</span>` : '<span class="ot-threshold-note">(no threshold set)</span>'}</div>
          ${state.overtimeThreshold === null
            ? '<div class="mgr-ot-clear"><span class="ot-check">—</span> Set an OT threshold in Payroll to track overtime</div>'
            : otOver.length === 0 && otNear.length === 0
            ? '<div class="mgr-ot-clear"><span class="ot-check">✓</span> No overtime issues this week</div>'
            : `
              ${otOver.map(p => `
                <div class="mgr-ot-row ot-over">
                  <span class="ot-name">⚠ ${p.name}</span>
                  <span class="ot-badge over">${p.otHours.toFixed(1)}h OT</span>
                </div>
              `).join('')}
              ${otNear.map(p => `
                <div class="mgr-ot-row ot-near">
                  <span class="ot-name">~ ${p.name}</span>
                  <span class="ot-badge near">${p.totalHours.toFixed(1)}/${state.overtimeThreshold}h</span>
                </div>
              `).join('')}
            `
          }
        </div>

        <div class="mgr-opening-panel">
          <div class="mgr-panel-title">
            Store Opening Status
            <span class="ot-threshold-note">&nbsp;· opens 9 AM · ±${GRACE_MIN}min grace</span>
          </div>
          <div class="mgr-opening-grid">
            <div class="mgr-og-header">
              <div class="mgr-og-cell mgr-og-store-label"></div>
              ${DAY_SHORT.map(d => `<div class="mgr-og-cell mgr-og-day">${d}</div>`).join('')}
            </div>
            ${STORES.map((store, si) => `
              <div class="mgr-og-row">
                <div class="mgr-og-cell mgr-og-store-label">
                  ${STORE_ICONS[store]} <span class="mgr-og-store-name">${store.replace("Maria's Groceries", "Maria's")}</span>
                </div>
                ${openingGrid.map(day => {
                  const s = day.stores[si];
                  if (s.status === '24h') return `<div class="mgr-og-cell"><span class="og-dot og-24h" title="Open 24/7">∞</span></div>`;
                  if (s.status === 'ontime') return `<div class="mgr-og-cell"><span class="og-dot og-ontime" title="Opened ${s.time} ✓">✓</span></div>`;
                  if (s.status === 'late') return `<div class="mgr-og-cell"><span class="og-dot og-late" title="Late open: ${s.time}">!</span></div>`;
                  return `<div class="mgr-og-cell"><span class="og-dot og-unstaffed" title="No staff">—</span></div>`;
                }).join('')}
              </div>
            `).join('')}
          </div>
          <div class="mgr-og-legend">
            <span class="og-dot og-ontime sm">✓</span> On time &nbsp;
            <span class="og-dot og-late sm">!</span> Late &nbsp;
            <span class="og-dot og-unstaffed sm">—</span> No staff &nbsp;
            <span class="og-dot og-24h sm">∞</span> 24/7
          </div>
        </div>
      </div>

    </div>
  `;
}

// ---- EXPORT CSV ----
function exportCSV() {
  const isManager = state.session && state.session.role === 'manager';
  let rows = state.shifts.filter(s => s.clockOut);
  if (!isManager && state.session && state.session.store) {
    rows = rows.filter(s => s.store === state.session.store);
  }
  if (!rows.length) {
    showToast('No shifts to export yet!', 'info');
    return;
  }
  const headers = ['Employee','Store','Date','Clock In','Clock Out','Hours','Duration'];
  const data = rows.map(s => [
    s.employee, s.store || '—',
    formatDate(s.clockIn), formatTime(s.clockIn), formatTime(s.clockOut),
    hoursFromMs(s.duration), formatDuration(s.duration),
  ]);
  const csv = [headers, ...data].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `shifttrack_export_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  showToast('CSV exported!', 'success');
}

// ---- TOAST ----
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  void t.offsetWidth;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
