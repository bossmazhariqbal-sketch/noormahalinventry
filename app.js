import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.APP_CONFIG || {};
const configured = config.supabaseUrl?.startsWith('https://') && config.supabaseAnonKey && !config.supabaseAnonKey.includes('YOUR_');
const supabase = configured ? createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
const state = { user: null, page: 'dashboard', items: [], categories: [], suppliers: [], purchases: [], purchaseItems: [], adjustments: [], demands: [], demandItems: [], employees: [], attendance: [], candidates: [], advances: [], marketLists: [], marketItems: [], billPayments: [], marketRange: [], expenses: [], jazzcashPayments: [], jazzcashToday: [], expenseRangeCount: 0, expenseTotalCount: 0, expFrom: '', expTo: '', expenseSearch: '', cashFrom: '', cashTo: '', paymentRangeInitialized: false, showSalary: false, staffMonth: '', attDate: '', search: '', purchaseFilter: { date: '', supplier: '' }, reportFilter: 'month', customFrom: '', customTo: '' };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const pageNames = { dashboard: 'Dashboard', inventory: 'Inventory', purchases: 'Purchases', demand: 'Daily Demand', suppliers: 'Suppliers', categories: 'Categories', reports: 'Reports', employees: 'Employees', attendance: 'Attendance', staffreport: 'Staff Report', candidates: 'Hiring', market: 'Market Purchase', payables: 'Pending Bills', expenses: 'Expenses', jazzcash: 'JazzCash Payments', advances: 'Advances', settings: 'Settings' };
const money = value => `Rs. ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
const salaryText = v => state.showSalary ? money(v) : 'Rs. ****';
const salaryButton = () => `<button class="button" data-action="toggle-salary">${state.showSalary ? 'Hide salary' : 'Show salary'}</button>`;
const fmtDate = v => v ? v.split('-').reverse().join('/') : '—';
const salaryInput = (name, v, editing) => `<input name="${name}" ${editing && !state.showSalary ? 'type="password" inputmode="decimal" pattern="[0-9]+(\\.[0-9]{1,2})?" title="Sirf number likhein"' : 'type="number" min="0" step="0.01"'} required value="${esc(v ?? '')}">`;
const billDue = p => Number(p.total_amount) - Number(p.paid_amount);
const payBadge = p => { const due = billDue(p); return due <= 0 ? '<span class="badge badge-good">Paid</span>' : `<span class="badge ${Number(p.paid_amount) > 0 ? 'badge-low' : 'badge-out'}">${Number(p.paid_amount) > 0 ? 'Partial' : 'Pending'}</span><span class="cell-sub">${money(due)} baqi</span>`; };
const costLabel = item => Number(item.cost_per_unit) > 0 ? money(item.cost_per_unit) : '—';
const number = value => Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const monthStart = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const idMap = (rows, key = 'id') => new Map(rows.map(row => [row[key], row]));

function toast(message, error = false) {
  const node = document.createElement('div');
  node.className = `toast${error ? ' error' : ''}`;
  node.textContent = message;
  $('#toast-region').append(node);
  window.setTimeout(() => node.remove(), 3800);
}

function statusFor(item) {
  if (Number(item.current_stock) <= 0) return ['Out of Stock', 'out'];
  if (Number(item.current_stock) <= Number(item.minimum_stock)) return ['Low Stock', 'low'];
  return ['In Stock', 'good'];
}

function badge(item) {
  const [label, tone] = statusFor(item);
  return `<span class="badge badge-${tone}">${label}</span>`;
}

function showAuth(message = '') {
  $('#app-view').hidden = true;
  $('#auth-view').hidden = false;
  $('#auth-message').textContent = message;
}

function showApp(user) {
  state.user = user;
  $('#auth-view').hidden = true;
  $('#app-view').hidden = false;
  $('#profile-email').textContent = user.email || 'Shop account';
  $('#today-label').textContent = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date());
  loadData().then(render).catch(error => toast(error.message, true));
}

async function loadData() {
  if (!state.expFrom) state.expFrom = state.expTo = today();
  if (!state.attDate) { state.attDate = today(); state.staffMonth = today().slice(0, 7); }
  if (!state.paymentRangeInitialized) { state.cashFrom = state.cashTo = today(); state.paymentRangeInitialized = true; }
  const range = monthRange(state.staffMonth);
  let jazzcashQuery = supabase.from('jazzcash_payments').select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
  if (state.cashFrom) jazzcashQuery = jazzcashQuery.gte('date', state.cashFrom);
  if (state.cashTo) jazzcashQuery = jazzcashQuery.lte('date', state.cashTo);
  const [items, categories, suppliers, purchases, purchaseItems, adjustments, demands, demandItems, employees, attendance, candidates, advances, marketLists, marketRange, expenses, expenseTotalCount, jazzcashPayments, jazzcashToday, billPayments] = await Promise.all([
    supabase.from('inventory_items').select('*').order('name'),
    supabase.from('categories').select('*').order('name'),
    supabase.from('suppliers').select('*').order('name'),
    supabase.from('purchases').select('*').order('date', { ascending: false }),
    supabase.from('purchase_items').select('*'),
    supabase.from('stock_adjustments').select('*').order('created_at', { ascending: false }),
    supabase.from('daily_demands').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('demand_items').select('*'),
    supabase.from('employees').select('*').order('name'),
    supabase.from('attendance').select('*').gte('date', range[0]).lte('date', range[1]),
    supabase.from('candidates').select('*').order('created_at', { ascending: false }),
    supabase.from('advances').select('*').order('date', { ascending: false }),
    supabase.from('market_lists').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }).limit(100),
    supabase.from('market_lists').select('*').eq('status', 'bought').gte('date', state.expFrom).lte('date', state.expTo),
    supabase.from('expenses').select('*', { count: 'exact' }).gte('date', state.expFrom).lte('date', state.expTo).order('date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('expenses').select('id', { count: 'exact', head: true }),
    jazzcashQuery,
    supabase.from('jazzcash_payments').select('*').eq('date', today()),
    supabase.from('bill_payments').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }).limit(200)
  ]);
  const marketIds = (marketLists.data || []).map(l => l.id), marketItems = marketIds.length ? await supabase.from('market_items').select('*').in('list_id', marketIds) : { data: [] };
  for (const result of [items, categories, suppliers, purchases, purchaseItems, adjustments, demands, demandItems, employees, attendance, candidates, advances, marketLists, marketRange, expenses, expenseTotalCount, jazzcashPayments, jazzcashToday, marketItems, billPayments]) if (result.error) throw result.error;
  Object.assign(state, { items: items.data, categories: categories.data, suppliers: suppliers.data, purchases: purchases.data, purchaseItems: purchaseItems.data, adjustments: adjustments.data, demands: demands.data, demandItems: demandItems.data, employees: employees.data, attendance: attendance.data, candidates: candidates.data, advances: advances.data, marketLists: marketLists.data, marketRange: marketRange.data, expenses: expenses.data, expenseRangeCount: expenses.count ?? expenses.data.length, expenseTotalCount: expenseTotalCount.count ?? 0, jazzcashPayments: jazzcashPayments.data, jazzcashToday: jazzcashToday.data, marketItems: marketItems.data, billPayments: billPayments.data });
}

function heading(title, description, actions = '') {
  return `<div class="page-heading"><div><p class="eyebrow">SHOP INVENTORY</p><h1>${title}</h1><p>${description}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</div>`;
}

function panel(title, subtitle, content, action = '') {
  return `<section class="panel"><header class="panel-header"><div><h2 class="panel-title">${title}</h2>${subtitle ? `<p class="panel-subtitle">${subtitle}</p>` : ''}</div>${action}</header><div class="panel-body">${content}</div></section>`;
}

function render() {
  $('#page-crumb').textContent = pageNames[state.page];
  $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.page === state.page));
  const views = { dashboard: renderDashboard, inventory: renderInventory, purchases: renderPurchases, demand: renderDemand, employees: renderEmployees, attendance: renderAttendance, staffreport: renderStaffReport, candidates: renderCandidates, market: renderMarket, payables: renderPayables, expenses: renderExpenses, jazzcash: renderJazzcash, advances: renderAdvances, suppliers: renderSuppliers, categories: renderCategories, reports: renderReports, settings: renderSettings };
  $('#page-content').innerHTML = views[state.page]();
  if (state.page === 'dashboard') drawCharts();
  $('#global-search').value = state.search;
  const tw = $('#thermal-width'); if (tw) tw.value = thermalWidth();
}

function renderDashboard() {
  const value = state.items.reduce((sum, item) => sum + Number(item.current_stock) * Number(item.cost_per_unit), 0);
  const currentMonth = state.purchases.filter(purchase => purchase.date >= monthStart()).reduce((sum, purchase) => sum + Number(purchase.total_amount), 0);
  const totalPurchases = state.purchases.reduce((sum, purchase) => sum + Number(purchase.total_amount), 0);
  const lowItems = state.items.filter(item => Number(item.current_stock) <= Number(item.minimum_stock)).sort((a, b) => Number(a.current_stock) - Number(b.current_stock));
  const allStock = state.items.reduce((sum, item) => sum + Number(item.current_stock), 0);
  const cashToday = state.jazzcashToday.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const metrics = [
    ['Total items', number(state.items.length), 'Active inventory lines', 'I'],
    ['Total stock', number(allStock), 'Across all inventory items', 'S'],
    ['Inventory value', money(value), 'Current stock at unit cost', 'V'],
    ['This month purchase', money(currentMonth), 'Purchases this month', 'P'],
    ['Low stock', number(lowItems.length), 'Items at or below minimum', '!'],
    ['JazzCash today', money(cashToday), 'JazzCash and QR received', 'J']
  ].map(([label, amount, note, mark]) => `<article class="metric-card"><div class="metric-top"><span>${label}</span><span class="metric-mark">${mark}</span></div><strong class="metric-value">${amount}</strong><span class="metric-note">${note}</span></article>`).join('');
  const lowList = lowItems.length ? lowItems.slice(0, 6).map(item => `<div class="low-row"><div class="low-item"><strong>${esc(item.name)}</strong><span>${number(item.current_stock)} ${esc(item.unit)}</span></div><div class="stock-level"><strong>${Number(item.current_stock) === 0 ? 'Out of stock' : 'Low stock'}</strong><span>Min. ${number(item.minimum_stock)} ${esc(item.unit)}</span></div></div>`).join('') : '<div class="empty-state"><strong>All stocked up</strong>No items are below their minimum level.</div>';
  return `${heading('Dashboard', 'A quick read on what is in your kitchen today.', `<button class="button button-primary" data-action="open-purchase">+ Add purchase</button>`)}<section class="metrics-grid">${metrics}</section><div class="dashboard-grid"><div class="dashboard-column">${panel('Purchase summary', 'Spend recorded against inventory', `<div class="purchase-summary"><div class="summary-cell"><span class="summary-label">Today</span><strong class="summary-value">${money(sumPurchasesOn(today()))}</strong><span class="summary-period">${today()}</span></div><div class="summary-cell"><span class="summary-label">This month</span><strong class="summary-value">${money(currentMonth)}</strong><span class="summary-period">Since ${monthStart()}</span></div><div class="summary-cell"><span class="summary-label">All time</span><strong class="summary-value">${money(totalPurchases)}</strong><span class="summary-period">${state.purchases.length} purchase${state.purchases.length === 1 ? '' : 's'}</span></div></div>`)}${panel('Monthly purchases', 'Last 6 months · purchase total by month', '<div class="chart-wrap"><canvas id="purchase-chart" aria-label="Monthly purchases chart"></canvas></div>')}</div><div class="dashboard-column">${panel('Stock status', 'Items grouped by current stock level', '<div class="stock-chart-wrap"><canvas id="stock-chart" aria-label="Stock status chart"></canvas><div id="stock-legend" class="chart-legend"></div></div>')}${panel('Needs attention', `${lowItems.length} item${lowItems.length === 1 ? '' : 's'} at or below minimum stock`, `<div class="low-list">${lowList}</div>`, `<button class="text-button" data-page="inventory">View inventory</button>`)}</div></div>`;
}

function sumPurchasesOn(date) { return state.purchases.filter(purchase => purchase.date === date).reduce((sum, purchase) => sum + Number(purchase.total_amount), 0); }

function renderInventory() {
  const categories = idMap(state.categories);
  const filtered = state.items.filter(item => `${item.name} ${categories.get(item.category_id)?.name || ''}`.toLowerCase().includes(state.search.toLowerCase()));
  const categoryOptions = state.categories.map(category => `<option value="${esc(category.id)}">${esc(category.name)}</option>`).join('');
  const rows = filtered.length ? filtered.map(item => `<tr><td><strong>${esc(item.name)}</strong><span class="cell-sub">${esc(categories.get(item.category_id)?.name || 'Uncategorized')}</span></td><td>${esc(item.unit)}</td><td>${number(item.current_stock)}</td><td>${number(item.minimum_stock)}</td><td>${costLabel(item)}</td><td><strong>${money(Number(item.current_stock) * Number(item.cost_per_unit))}</strong></td><td>${badge(item)}</td><td><div class="table-actions"><button class="action-button" data-action="adjust-stock" data-id="${item.id}">Adjust</button><button class="action-button" data-action="edit-item" data-id="${item.id}">Edit</button><button class="action-button danger" data-action="delete-item" data-id="${item.id}" aria-label="Delete ${esc(item.name)}">Delete</button></div></td></tr>`).join('') : `<tr><td colspan="8"><div class="empty-state"><strong>${state.items.length ? 'No matching items' : 'Your inventory is empty'}</strong>${state.items.length ? 'Try another search or category.' : 'Add your first item to get started.'}</div></td></tr>`;
  return `${heading('Inventory', 'Keep an eye on quantities, costs, and stock levels.', '<button class="button" data-action="open-adjustment">Adjust stock</button><button class="button button-primary" data-action="add-item">+ Add item</button>')}<section class="panel"><div class="table-toolbar"><label class="field-search"><input id="inventory-search" type="search" value="${esc(state.search)}" placeholder="Search item name..."></label><select id="inventory-category-filter" class="filter-control"><option value="">All categories</option>${categoryOptions}</select><select id="inventory-status-filter" class="filter-control"><option value="">All stock status</option><option value="good">In Stock</option><option value="low">Low Stock</option><option value="out">Out of Stock</option></select></div><div class="table-scroll"><table><thead><tr><th>ITEM</th><th>UNIT</th><th>STOCK</th><th>MINIMUM</th><th>COST / UNIT</th><th>TOTAL VALUE</th><th>STATUS</th><th></th></tr></thead><tbody id="inventory-rows">${rows}</tbody></table></div><div class="table-footer">${filtered.length} of ${state.items.length} items</div></section>`;
}

function renderPurchases() {
  const suppliers = idMap(state.suppliers), items = idMap(state.items), linesByPurchase = new Map();
  state.purchaseItems.forEach(line => { const list = linesByPurchase.get(line.purchase_id) || []; list.push(line); linesByPurchase.set(line.purchase_id, list); });
  const rowsData = state.purchases.filter(purchase => (!state.purchaseFilter.date || purchase.date === state.purchaseFilter.date) && (!state.purchaseFilter.supplier || purchase.supplier_id === state.purchaseFilter.supplier));
  const rows = rowsData.length ? rowsData.map(purchase => {
    const lines = linesByPurchase.get(purchase.id) || [];
    const labels = lines.map(line => `${items.get(line.item_id)?.name || 'Item'} × ${number(line.quantity)}`).join(', ');
    return `<tr><td>${esc(purchase.date)}</td><td><strong>${esc(suppliers.get(purchase.supplier_id)?.name || 'No supplier')}</strong></td><td>${esc(labels || 'No items')}</td><td>${lines.reduce((sum, line) => sum + Number(line.quantity), 0)}</td><td><strong>${money(purchase.total_amount)}</strong></td><td>${payBadge(purchase)}</td><td>${billDue(purchase) > 0 ? `<button class="action-button" data-action="pay-bill" data-id="${purchase.id}">Pay</button>` : ''}</td></tr>`;
  }).join('') : '<tr><td colspan="7"><div class="empty-state"><strong>No purchases found</strong>Saved purchases will appear here.</div></td></tr>';
  return `${heading('Purchases', 'Every purchase updates inventory stock automatically.', '<button class="button button-primary" data-action="open-purchase">+ Add purchase</button>')}<section class="panel"><div class="table-toolbar"><input id="purchase-date-filter" class="filter-control" type="date" value="${esc(state.purchaseFilter.date)}" aria-label="Filter by date"><select id="purchase-supplier-filter" class="filter-control"><option value="">All suppliers</option>${state.suppliers.map(supplier => `<option value="${esc(supplier.id)}" ${state.purchaseFilter.supplier === supplier.id ? 'selected' : ''}>${esc(supplier.name)}</option>`).join('')}</select><button class="button button-small" data-action="clear-purchase-filter">Clear filters</button></div><div class="table-scroll"><table><thead><tr><th>DATE</th><th>SUPPLIER</th><th>ITEMS</th><th>QUANTITY</th><th>AMOUNT</th><th>PAYMENT</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="table-footer">${rowsData.length} purchase${rowsData.length === 1 ? '' : 's'}</div></section>`;
}

function thermalWidth() { try { return localStorage.getItem('thermalWidth') === '58' ? '58' : '80'; } catch { return '80'; } }

function renderDemand() {
  const items = idMap(state.items), lines = new Map(), pending = state.demands.filter(d => d.status === 'open').length;
  state.demandItems.forEach(l => { const a = lines.get(l.demand_id) || []; a.push(l); lines.set(l.demand_id, a); });
  const rows = state.demands.length ? state.demands.map(d => {
    const ls = lines.get(d.id) || [], open = d.status === 'open';
    const text = ls.map(l => `${items.get(l.item_id)?.name || 'Item'} × ${number(l.quantity)}`).join(', ');
    return `<tr><td><strong>${esc(d.date)}</strong>${d.note ? `<span class="cell-sub">${esc(d.note)}</span>` : ''}</td><td>${esc(text || '—')}</td><td>${ls.length}</td><td><span class="badge ${open ? 'badge-low' : 'badge-good'}">${open ? 'Pending' : 'Done'}</span></td><td><div class="table-actions"><button class="action-button" data-action="print-demand" data-id="${d.id}">Print</button>${open ? `<button class="action-button" data-action="done-demand" data-id="${d.id}">Done</button><button class="action-button danger" data-action="delete-demand" data-id="${d.id}">Delete</button>` : ''}</div></td></tr>`;
  }).join('') : '<tr><td colspan="5"><div class="empty-state"><strong>Abhi koi demand nahi</strong>Roz ki demand yahan banayein aur print karein.</div></td></tr>';
  return `${heading('Daily Demand', 'Roz ki demand banayein, thermal printer par print karein, phir Done karein.', `${pending ? `<button class="button" data-action="print-all-demand">Print all (${pending})</button><button class="button" data-action="done-all-demand">Done all</button>` : ''}<select id="thermal-width" class="filter-control" aria-label="Printer size"><option value="80">80mm printer</option><option value="58">58mm printer</option></select><button class="button button-primary" data-action="add-demand">+ New demand</button>`)}<section class="panel"><div class="table-scroll"><table><thead><tr><th>DATE</th><th>ITEMS</th><th>LINES</th><th>STATUS</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="table-footer">${state.demands.length} demand${state.demands.length === 1 ? '' : 's'}</div></section>`;
}

function demandRow() {
  const options = state.items.map(i => `<option value="${i.id}" data-unit="${esc(i.unit)}">${esc(i.name)} (stock ${number(i.current_stock)} ${esc(i.unit)})</option>`).join('');
  return `<div class="demand-row"><select name="item_id" required>${options}</select><div class="qty-wrap"><input name="quantity" type="number" min="0.001" step="0.001" required placeholder="Qty"><span class="qty-unit">${esc(state.items[0]?.unit || '')}</span></div><button class="action-button danger" type="button" data-action="remove-demand-row" aria-label="Remove row">×</button></div>`;
}

function demandForm() {
  if (!state.items.length) return toast('Pehle inventory item add karein.', true);
  openModal('New daily demand', 'Jo saman aaj chahiye uski list', `<form id="demand-form"><div class="form-grid"><label>Date<input name="date" type="date" value="${today()}" required></label><label>Note<input name="note" maxlength="120" placeholder="Optional"></label></div><div id="demand-rows" class="demand-rows">${demandRow()}</div><button class="button button-small" type="button" data-action="add-demand-row">+ Add item</button>${modalFooter('Save demand')}</form>`);
}

function printDemands(ids) {
  const ds = state.demands.filter(d => ids.includes(d.id)); if (!ds.length) return;
  const items = idMap(state.items), totals = new Map(), w = thermalWidth();
  state.demandItems.filter(l => ids.includes(l.demand_id)).forEach(l => totals.set(l.item_id, (totals.get(l.item_id) || 0) + Number(l.quantity)));
  const dates = [...new Set(ds.map(d => d.date))].sort().join(', '), notes = ds.map(d => d.note).filter(Boolean).join(' | ');
  $('#thermal-page')?.remove();
  document.head.insertAdjacentHTML('beforeend', `<style id="thermal-page">@page thermal{size:${w}mm auto;margin:1mm}</style>`);
  let box = $('#thermal'); if (!box) { box = document.createElement('div'); box.id = 'thermal'; document.body.append(box); }
  box.style.width = `${w === '58' ? 55 : 77}mm`;
  const fmt = v => v.split('-').reverse().join('/'), days = [...new Set(ds.map(d => d.date))].sort();
  const dateText = days.length > 1 ? `${fmt(days[0])} - ${fmt(days[days.length - 1])}` : fmt(days[0]);
  const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit'});
  const code = ds.length === 1 ? `DM-${ds[0].id.slice(0, 6).toUpperCase()}` : `DM-ALL (${ds.length})`, status = ds.every(d => d.status === 'done') ? 'Done' : 'Pending';
  const rows = [...totals].map(([itemId, qty], index) => { const it = items.get(itemId); return `<div class="t-line-row t-item"><span class="t-count">${index + 1}</span><span class="t-desc">${esc(it?.name || 'Item')}</span><span class="t-q">${number(qty)}</span><span class="t-u">${esc(it?.unit || '')}</span></div>`; }).join('');
  box.innerHTML = `<div class="t-name">NOOR MEHAL<br>PIZZA HUT</div><div class="t-addr">Sargodha Road, Sacha Sauda Farooqabad, Lahore, Pakistan<br>0304-6006494 | 0347-1144404</div><div class="t-dash"></div><div class="t-line-row"><span>Prepared by: Admin</span><strong>${dateText}</strong></div><div class="t-dash"></div><div class="t-title">DAILY DEMAND</div><div class="t-line-row"><strong>Demand ID: ${code}</strong><strong>${time}</strong></div>${notes ? `<div>Note: ${esc(notes)}</div>` : ''}<div class="t-solid"></div><div class="t-line-row t-head"><span class="t-count">#</span><span class="t-desc">Item</span><span class="t-q">Qty</span><span class="t-u">Unit</span></div><div class="t-solid"></div>${rows}<div class="t-dash"></div><div class="t-line-row t-total"><span>Total Items :</span><span>${totals.size}</span></div><div class="t-line-row"><span>Status :</span><span>${status}</span></div><div class="t-dash"></div><div class="t-sign">Received by: ____________</div>`;
  document.body.classList.add('print-thermal'); window.print();
}
window.addEventListener('afterprint', () => document.body.classList.remove('print-thermal'));

function monthRange(ym) { const [y, m] = ym.split('-').map(Number); return [`${ym}-01`, `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`]; }

function renderEmployees() {
  const rows = state.employees.length ? state.employees.map(e => `<tr><td><strong>${esc(e.name)}</strong><span class="cell-sub">${esc(e.role || '')}</span></td><td>${esc(e.phone || '—')}</td><td>${fmtDate(e.join_date)}</td><td>${salaryText(e.salary)} <span class="cell-sub">${e.salary_type === 'daily' ? 'per day' : 'per month'}</span></td><td><span class="badge ${e.active ? 'badge-good' : 'badge-out'}">${e.active ? 'Active' : 'Left'}</span></td><td><div class="table-actions"><button class="action-button" data-action="edit-employee" data-id="${e.id}">Edit</button><button class="action-button danger" data-action="delete-employee" data-id="${e.id}">Delete</button></div></td></tr>`).join('') : '<tr><td colspan="6"><div class="empty-state"><strong>Abhi koi employee nahi</strong>+ Add employee se shuru karein.</div></td></tr>';
  return `${heading('Employees', 'Staff ki list aur salary.', `${salaryButton()}<button class="button button-primary" data-action="add-employee">+ Add employee</button>`)}<section class="panel"><div class="table-scroll"><table><thead><tr><th>NAME</th><th>PHONE</th><th>JOINED</th><th>SALARY</th><th>STATUS</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="table-footer">${state.employees.length} employees</div></section>`;
}

function employeeForm(e) {
  const sel = v => e?.salary_type === v ? 'selected' : '';
  openModal(e ? 'Edit employee' : 'Add employee', 'Staff member ki details', `<form id="employee-form" data-id="${e?.id || ''}"><div class="form-grid"><label class="span-2">Name<input name="name" required maxlength="100" value="${esc(e?.name || '')}"></label><label>Phone<input name="phone" value="${esc(e?.phone || '')}"></label><label>Role<input name="role" placeholder="Cook, Waiter, Rider" value="${esc(e?.role || '')}"></label><label>Joining date<input name="join_date" type="date" value="${esc(e?.join_date || today())}"></label><label>Salary type<select name="salary_type"><option value="monthly" ${sel('monthly')}>Monthly</option><option value="daily" ${sel('daily')}>Daily</option></select></label><label>Salary (Rs.)<input name="salary" ${e && !state.showSalary ? 'type="password" inputmode="decimal" pattern="[0-9]+(\\.[0-9]{1,2})?" title="Sirf number likhein"' : 'type="number" min="0" step="0.01"'} required value="${esc(e?.salary ?? '')}"></label>${e ? `<label class="span-2"><span><input type="checkbox" name="active" ${e.active ? 'checked' : ''}> Abhi kaam kar raha hai</span></label>` : ''}</div>${modalFooter(e ? 'Save changes' : 'Add employee')}</form>`);
}

function renderAttendance() {
  const marks = new Map(state.attendance.filter(a => a.date === state.attDate).map(a => [a.employee_id, a])), staff = state.employees.filter(e => e.active);
  let paidAmt = 0, unpaidAmt = 0;
  const rows = staff.length ? staff.map(e => {
    const m = marks.get(e.id), here = m && ['on_time', 'late'].includes(m.status), daily = e.salary_type === 'daily', opt = (v, t) => `<option value="${v}" ${m?.status === v ? 'selected' : ''}>${t}</option>`;
    if (daily && here) { if (m.paid) paidAmt += Number(e.salary); else unpaidAmt += Number(e.salary); }
    const pay = daily ? `<select class="att-paid filter-control" ${here ? '' : 'disabled'}><option value="false">Unpaid</option><option value="true" ${m?.paid ? 'selected' : ''}>Paid</option></select> <span class="cell-sub">${salaryText(e.salary)} / day</span>` : '<span class="cell-sub">Monthly salary</span>';
    return `<tr data-emp="${e.id}"><td><strong>${esc(e.name)}</strong><span class="cell-sub">${esc(e.role || '')}</span></td><td><select class="att-status filter-control"><option value="">Not marked</option>${opt('on_time', 'On time')}${opt('late', 'Late')}${opt('absent', 'Absent')}${opt('leave', 'Leave')}</select></td><td><input class="att-late filter-control" type="number" min="0" step="1" placeholder="Late minutes" value="${m?.status === 'late' ? m.late_minutes : ''}" ${m?.status === 'late' ? '' : 'disabled'}></td><td>${pay}</td></tr>`;
  }).join('') : '<tr><td colspan="4"><div class="empty-state"><strong>Koi active employee nahi</strong>Pehle Employees page par employee add karein.</div></td></tr>';
  return `${heading('Attendance', 'Roz ki hazri aur daily pay lagayein.', `<input id="att-date" class="filter-control" type="date" value="${state.attDate}" max="${today()}">${salaryButton()}<button class="button" data-action="all-on-time">Sab On time</button><button class="button button-primary" data-action="save-attendance">Save attendance</button>`)}<section class="panel"><div class="table-scroll"><table><thead><tr><th>EMPLOYEE</th><th>STATUS</th><th>LATE (MINUTES)</th><th>DAILY PAY</th></tr></thead><tbody>${rows}</tbody></table></div><div class="table-footer">${marks.size} of ${staff.length} marked · Daily pay: <strong>${salaryText(paidAmt)}</strong> Paid · <strong>${salaryText(unpaidAmt)}</strong> Unpaid · Total <strong>${salaryText(paidAmt + unpaidAmt)}</strong></div></section>`;
}

function staffStats(e) {
  const rows = state.attendance.filter(a => a.employee_id === e.id), c = st => rows.filter(a => a.status === st).length, [from, to] = monthRange(state.staffMonth);
  const onTime = c('on_time'), late = c('late'), absent = c('absent'), leave = c('leave'), present = onTime + late, daily = e.salary_type === 'daily';
  const lateMins = rows.filter(a => a.status === 'late').reduce((t, a) => t + a.late_minutes, 0), days = Number(to.slice(8));
  const earned = Math.round(daily ? Number(e.salary) * present : Math.max(0, Number(e.salary) - Number(e.salary) / days * absent));
  const advance = state.advances.filter(a => a.employee_id === e.id && a.date >= from && a.date <= to).reduce((t, a) => t + Number(a.amount), 0);
  const paid = daily ? Number(e.salary) * rows.filter(a => ['on_time', 'late'].includes(a.status) && a.paid).length : 0;
  return { onTime, late, absent, leave, present, daily, earned, advance, paid, balance: earned - advance - paid, attPct: present + absent ? present / (present + absent) * 100 : null, onTimePct: present ? onTime / present * 100 : null, avgLate: late ? lateMins / late : null };
}

function printStaffSlip(employeeId) {
  if (!state.showSalary) return toast('Pehle Show salary dabayein.', true);
  const employee = state.employees.find(e => e.id === employeeId); if (!employee) return;
  const stats = staffStats(employee), [from, to] = monthRange(state.staffMonth);
  const rows = [
    [`Salary rate (${employee.salary_type === 'daily' ? 'per day' : 'per month'})`, number(employee.salary), ''],
    ['Present', `${stats.present} days`, ''],
    ['Absent', `${stats.absent} days`, ''],
    ['Leave', `${stats.leave} days`, ''],
    ['Earned salary', number(stats.earned), ''],
    ['Advance taken', number(stats.advance), ''],
    ['Already paid', number(stats.paid), '']
  ];
  printSlip({ title: 'STAFF ACCOUNT', code: `ST-${employee.id.slice(0, 6).toUpperCase()}`, dateText: `${fmtDate(from)} - ${fmtDate(to)}`, note: `${employee.name}${employee.role ? ` | ${employee.role}` : ''}`, head: ['Description', 'Amount', ''], rows, totals: [['Remaining :', number(stats.balance)]], className: 'thermal-account' });
}

function renderStaffReport() {
  const staff = state.employees.filter(e => e.active || state.attendance.some(a => a.employee_id === e.id)), pct = v => v === null ? '—' : `${v.toFixed(0)}%`, sum = { earned: 0, advance: 0, paid: 0, balance: 0 };
  const rows = staff.length ? staff.map(e => { const t = staffStats(e); Object.keys(sum).forEach(k => sum[k] += t[k]); return `<tr><td><strong>${esc(e.name)}</strong><span class="cell-sub">${esc(e.role || '')}</span></td><td>${t.present} <span class="cell-sub">${t.onTime} on time · ${t.late} late</span></td><td>${t.absent}</td><td>${t.leave}</td><td>${pct(t.attPct)}</td><td>${pct(t.onTimePct)}</td><td>${t.avgLate === null ? '—' : `${t.avgLate.toFixed(0)} min`}</td><td>${salaryText(t.earned)}</td><td>${t.advance ? salaryText(t.advance) : '—'}</td><td>${t.daily ? salaryText(t.paid) : '—'}</td><td><strong>${salaryText(t.balance)}</strong></td><td><button class="action-button" data-action="print-staff-slip" data-id="${e.id}">Print</button></td></tr>`; }).join('') : '<tr><td colspan="12"><div class="empty-state"><strong>Abhi koi data nahi</strong>Employees add karke attendance lagayein.</div></td></tr>';
  return `${heading('Staff Report', 'Mahine ki hazri, average, advance aur salary ka hisab.', `<input id="staff-month" class="filter-control" type="month" value="${state.staffMonth}"><select id="thermal-width" class="filter-control" aria-label="Printer size"><option value="80">80mm printer</option><option value="58">58mm printer</option></select>${salaryButton()}<button class="button" data-action="print-page">Print report</button>`)}<section class="panel"><div class="table-scroll"><table><thead><tr><th>EMPLOYEE</th><th>PRESENT</th><th>ABSENT</th><th>LEAVE</th><th>ATTENDANCE</th><th>ON TIME</th><th>AVG LATE</th><th>EARNED</th><th>ADVANCE</th><th>PAID</th><th>BALANCE</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="table-footer">Earned <strong>${salaryText(sum.earned)}</strong> · Advance <strong>${salaryText(sum.advance)}</strong> · Paid <strong>${salaryText(sum.paid)}</strong> · Balance (dena baqi) <strong>${salaryText(sum.balance)}</strong></div></section>`;
}

function renderAdvances() {
  const emps = idMap(state.employees), total = state.advances.reduce((t, a) => t + Number(a.amount), 0);
  const rows = state.advances.length ? state.advances.map(a => `<tr><td>${fmtDate(a.date)}</td><td><strong>${esc(emps.get(a.employee_id)?.name || '—')}</strong></td><td>${salaryText(a.amount)}</td><td>${esc(a.note || '—')}</td><td><div class="table-actions"><button class="action-button danger" data-action="delete-advance" data-id="${a.id}">Delete</button></div></td></tr>`).join('') : '<tr><td colspan="5"><div class="empty-state"><strong>Abhi koi advance nahi</strong>+ Add advance se likhein.</div></td></tr>';
  return `${heading('Advances', 'Kis ne kab advance liya. Ye mahine ki salary se katta hai.', `${salaryButton()}<button class="button button-primary" data-action="add-advance">+ Add advance</button>`)}<section class="panel"><div class="table-scroll"><table><thead><tr><th>DATE</th><th>EMPLOYEE</th><th>AMOUNT</th><th>NOTE</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="table-footer">${state.advances.length} advances · Total <strong>${salaryText(total)}</strong></div></section>`;
}

function advanceForm() {
  const staff = state.employees.filter(e => e.active); if (!staff.length) return toast('Pehle employee add karein.', true);
  openModal('Add advance', 'Employee ne jo advance liya', `<form id="advance-form"><div class="form-grid"><label class="span-2">Employee<select name="employee_id" required>${staff.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></label><label>Date<input name="date" type="date" value="${today()}" required></label><label>Amount (Rs.)<input name="amount" type="number" min="1" step="0.01" required></label><label class="span-2">Note<input name="note" maxlength="120" placeholder="Optional"></label></div>${modalFooter('Save advance')}</form>`);
}

function renderCandidates() {
  const tone = { pending: ['badge-low', 'Pending'], joined: ['badge-good', 'Joined'], rejected: ['badge-out', 'Rejected'] };
  const rows = state.candidates.length ? state.candidates.map(c => `<tr><td><strong>${esc(c.name)}</strong><span class="cell-sub">${esc(c.role || '')}</span></td><td>${esc(c.phone || '—')}</td><td>${salaryText(c.expected_salary)} <span class="cell-sub">${c.salary_type === 'daily' ? 'per day' : 'per month'}</span></td><td>${fmtDate(c.join_date)}</td><td><span class="badge ${tone[c.status][0]}">${tone[c.status][1]}</span></td><td>${esc(c.note || '—')}</td><td><div class="table-actions">${c.status === 'pending' ? `<button class="action-button" data-action="join-candidate" data-id="${c.id}">Join</button>` : ''}<button class="action-button" data-action="edit-candidate" data-id="${c.id}">Edit</button><button class="action-button danger" data-action="delete-candidate" data-id="${c.id}">Delete</button></div></td></tr>`).join('') : '<tr><td colspan="7"><div class="empty-state"><strong>Abhi koi pending banda nahi</strong>Jo log aage join karenge unka data yahan likhein.</div></td></tr>';
  return `${heading('Hiring', 'Jo log aage join karne wale hain.', `${salaryButton()}<button class="button button-primary" data-action="add-candidate">+ Add person</button>`)}<section class="panel"><div class="table-scroll"><table><thead><tr><th>NAME</th><th>PHONE</th><th>EXPECTED SALARY</th><th>JOIN DATE</th><th>STATUS</th><th>NOTE</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="table-footer">${state.candidates.filter(c => c.status === 'pending').length} pending</div></section>`;
}

function candidateForm(c) {
  const sel = v => c?.salary_type === v ? 'selected' : '', st = v => c?.status === v ? 'selected' : '';
  openModal(c ? 'Edit person' : 'Add person', 'Jo banda join karna chahta hai', `<form id="candidate-form" data-id="${c?.id || ''}"><div class="form-grid"><label class="span-2">Name<input name="name" required maxlength="100" value="${esc(c?.name || '')}"></label><label>Phone<input name="phone" value="${esc(c?.phone || '')}"></label><label>Role<input name="role" placeholder="Cook, Waiter, Rider" value="${esc(c?.role || '')}"></label><label>Salary type<select name="salary_type"><option value="monthly" ${sel('monthly')}>Monthly</option><option value="daily" ${sel('daily')}>Daily</option></select></label><label>Expected salary (Rs.)${salaryInput('expected_salary', c?.expected_salary ?? 0, Boolean(c))}</label><label>Join date<input name="join_date" type="date" value="${esc(c?.join_date || '')}"></label>${c ? `<label>Status<select name="status"><option value="pending" ${st('pending')}>Pending</option><option value="joined" ${st('joined')}>Joined</option><option value="rejected" ${st('rejected')}>Rejected</option></select></label>` : ''}<label class="span-2">Note<input name="note" maxlength="200" value="${esc(c?.note || '')}"></label></div>${modalFooter(c ? 'Save changes' : 'Add person')}</form>`);
}

function printSlip({ title, code, dateText, note, head, rows, totals, className = '', columnLayout = 'standard' }) {
  const w = thermalWidth(), time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  $('#thermal-page')?.remove();
  document.head.insertAdjacentHTML('beforeend', `<style id="thermal-page">@page thermal{size:${w}mm auto;margin:1mm}</style>`);
  let box = $('#thermal'); if (!box) { box = document.createElement('div'); box.id = 'thermal'; document.body.append(box); }
  box.className = className;
  box.style.width = `${w === '58' ? 55 : 77}mm`;
  const cols = (a, b, c, cls = '') => columnLayout === 'numbered'
    ? `<div class="t-line-row ${cls}"><span class="t-count">${esc(a)}</span><span class="t-desc">${esc(b)}</span><span class="t-amount">${esc(c)}</span></div>`
    : `<div class="t-line-row ${cls}"><span class="t-desc">${esc(a)}</span><span class="t-q">${esc(b)}</span><span class="t-u">${esc(c)}</span></div>`;
  box.innerHTML = `<div class="t-name">NOOR MEHAL<br>PIZZA HUT</div><div class="t-addr">Sargodha Road, Sacha Sauda Farooqabad, Lahore, Pakistan<br>0304-6006494 | 0347-1144404</div><div class="t-dash"></div><div class="t-line-row"><span>Prepared by: Admin</span><strong>${esc(dateText)}</strong></div><div class="t-dash"></div><div class="t-title">${esc(title)}</div><div class="t-line-row"><strong>${esc(code)}</strong><strong>${time}</strong></div>${note ? `<div>Note: ${esc(note)}</div>` : ''}<div class="t-solid"></div>${cols(...head, 't-head')}<div class="t-solid"></div>${rows.map(r => cols(...r, 't-item')).join('')}<div class="t-dash"></div>${totals.map(([k, v], i) => `<div class="t-line-row ${i === totals.length - 1 ? 't-total' : ''}"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}<div class="t-dash"></div>`;
  document.body.classList.add('print-thermal'); window.print();
}

function renderMarket() {
  const lines = new Map();
  state.marketItems.forEach(i => { const a = lines.get(i.list_id) || []; a.push(i); lines.set(i.list_id, a); });
  const rows = state.marketLists.length ? state.marketLists.map(l => { const ls = lines.get(l.id) || [], done = l.status === 'bought';
    return `<tr><td><strong>${fmtDate(l.date)}</strong>${l.note ? `<span class="cell-sub">${esc(l.note)}</span>` : ''}</td><td>${esc(ls.map(i => `${i.name} × ${number(i.quantity)} ${i.unit}`).join(', ') || '—')}</td><td>${done ? `<strong>${money(l.total_spent)}</strong>` : '—'}</td><td><span class="badge ${done ? 'badge-good' : 'badge-low'}">${done ? 'Bought' : 'To buy'}</span></td><td><div class="table-actions"><button class="action-button" data-action="print-market" data-id="${l.id}">Print</button><button class="action-button" data-action="market-prices" data-id="${l.id}">${done ? 'Edit prices' : 'Prices'}</button><button class="action-button danger" data-action="delete-market" data-id="${l.id}">Delete</button></div></td></tr>`; }).join('') : '<tr><td colspan="5"><div class="empty-state"><strong>Abhi koi market list nahi</strong>Taza saman (sabzi, dhaniya) ki roz ki list yahan banayein.</div></td></tr>';
  return `${heading('Market Purchase', 'Roz market se kharidne wala taza saman. Ye stock mein nahi jata, sirf kharcha banta hai.', '<button class="button button-primary" data-action="add-market">+ New list</button>')}<section class="panel"><div class="table-scroll"><table><thead><tr><th>DATE</th><th>ITEMS</th><th>SPENT</th><th>STATUS</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="table-footer">${state.marketLists.length} lists</div></section>`;
}

function marketRow() {
  return `<div class="market-row"><input name="name" list="market-names" required maxlength="100" placeholder="Item (jaise Tamatar)"><input name="quantity" type="number" min="0.001" step="0.001" required placeholder="Qty"><input name="unit" list="market-units" required maxlength="20" pattern="[^0-9].*" title="Sirf unit likhein, jaise KG" placeholder="KG"><button class="action-button danger" type="button" data-action="remove-market-row" aria-label="Remove row">×</button></div>`;
}

function marketForm() {
  const names = [...new Set(state.marketItems.map(i => i.name))].map(n => `<option value="${esc(n)}">`).join('');
  openModal('New market list', 'Jo taza saman aaj market se lena hai', `<form id="market-form"><div class="form-grid"><label>Date<input name="date" type="date" value="${today()}" required></label><label>Note<input name="note" maxlength="120" placeholder="Optional"></label></div><div id="market-rows" class="demand-rows">${marketRow()}</div><button class="button button-small" type="button" data-action="add-market-row">+ Add item</button><datalist id="market-names">${names}</datalist><datalist id="market-units"><option value="KG"><option value="Gram"><option value="Dozen"><option value="Piece"><option value="Bunch"><option value="Packet"></datalist>${modalFooter('Save list')}</form>`);
}

function marketPricesForm(id) {
  const l = state.marketLists.find(x => x.id === id), ls = state.marketItems.filter(i => i.list_id === id); if (!l) return;
  openModal('Market prices', `${fmtDate(l.date)} · jo rakam lagi wo likhein`, `<form id="market-prices-form" data-id="${id}"><div class="demand-rows">${ls.map(i => `<div class="market-row price-row"><span class="price-name"><strong>${esc(i.name)}</strong> <span class="cell-sub">${number(i.quantity)} ${esc(i.unit)}</span></span><input name="amount_${i.id}" type="number" min="0" step="0.01" placeholder="Rs." value="${Number(i.amount) || ''}"></div>`).join('')}</div>${modalFooter('Save (Bought)')}</form>`);
}

function printMarket(id) {
  const l = state.marketLists.find(x => x.id === id); if (!l) return;
  const ls = state.marketItems.filter(i => i.list_id === id), done = l.status === 'bought';
  printSlip({ title: 'MARKET LIST', code: `MK-${id.slice(0, 6).toUpperCase()}`, dateText: fmtDate(l.date), note: l.note, head: ['Descriptions', 'Qty', 'Amnt'], rows: ls.map(i => [i.name, `${number(i.quantity)} ${i.unit}`, done && Number(i.amount) ? number(i.amount) : '_____']), totals: [['Total Items :', String(ls.length)], ['Total Rs :', done ? number(l.total_spent) : '__________']] });
}

const EXPENSE_CATEGORIES = ['Gas', 'Electricity', 'Rent', 'Fuel / Delivery', 'Repair & Maintenance', 'Staff Food', 'Cleaning', 'Other'];
const expenseCategoryStorageKey = () => `stockroom.expenseCategories.${state.user?.id || 'default'}`;

function expenseCategories() {
  let custom = [];
  try { custom = JSON.parse(localStorage.getItem(expenseCategoryStorageKey()) || '[]'); } catch {}
  return [...new Map([...EXPENSE_CATEGORIES, ...(Array.isArray(custom) ? custom : [])].filter(c => typeof c === 'string' && c.trim()).map(c => [c.toLocaleLowerCase(), c])).values()];
}

function matchingExpenses() {
  const query = state.expenseSearch.trim().toLocaleLowerCase();
  if (!query) return state.expenses;
  return state.expenses.filter(e => [e.category, e.note, e.date, fmtDate(e.date), number(e.amount)].join(' ').toLocaleLowerCase().includes(query));
}

function expenseTotals(expenses = state.expenses) {
  const byCat = new Map(), market = state.marketRange.reduce((t, l) => t + Number(l.total_spent), 0);
  expenses.forEach(e => byCat.set(e.category, (byCat.get(e.category) || 0) + Number(e.amount)));
  const spent = [...byCat.values()].reduce((t, v) => t + v, 0);
  return { byCat, market, spent, total: spent + market };
}

function renderExpenses() {
  const expenses = matchingExpenses(), t = expenseTotals(expenses), rows = expenses.length ? expenses.map((e, index) => `<tr><td>${index + 1}</td><td>${fmtDate(e.date)}</td><td><strong>${esc(e.category)}</strong></td><td>${esc(e.note || '—')}</td><td><strong>${money(e.amount)}</strong></td><td><div class="table-actions"><button class="action-button" data-action="edit-expense" data-id="${e.id}">Edit</button><button class="action-button danger" data-action="delete-expense" data-id="${e.id}">Delete</button></div></td></tr>`).join('') : `<tr><td colspan="6"><div class="empty-state"><strong>${state.expenseSearch ? 'Koi matching expense nahi' : 'In dino ka koi kharcha nahi'}</strong>${state.expenseSearch ? 'Search ka lafz ya date range badal kar dekhein.' : '+ Add expense se likhein.'}</div></td></tr>`;
  const chips = [...t.byCat].map(([k, v]) => `<span class="chip">${esc(k)} <strong>${money(v)}</strong></span>`).join('') + (t.market ? `<span class="chip">Market purchase <strong>${money(t.market)}</strong></span>` : '');
  return `${heading('Expenses', 'Roz ke kharche: kahan kitna laga.', `<input id="exp-from" class="filter-control" type="date" value="${state.expFrom}"><input id="exp-to" class="filter-control" type="date" value="${state.expTo}"><button class="button" data-action="exp-today">Aaj</button><button class="button" data-action="print-expenses">Print</button><button class="button" data-action="add-expense-category">+ Add category</button><button class="button button-primary" data-action="add-expense">+ Add expense</button>`)}<div class="chip-row">${chips || '<span class="chip">Koi kharcha nahi</span>'}</div><section class="panel"><div class="table-toolbar"><input id="expense-search" class="filter-control" type="search" placeholder="Category, note, date ya amount search karein" aria-label="Search expenses" value="${esc(state.expenseSearch)}"></div><div class="table-scroll"><table><thead><tr><th>#</th><th>DATE</th><th>CATEGORY</th><th>NOTE</th><th>AMOUNT</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="table-footer">${expenses.length} shown of ${state.expenseRangeCount} in range · All time ${state.expenseTotalCount} · Expenses <strong>${money(t.spent)}</strong> · Market <strong>${money(t.market)}</strong> · Total <strong>${money(t.total)}</strong></div></section>`;
}

function expenseForm(expense = null) {
  const categories = [...new Set([...expenseCategories(), ...(expense?.category ? [expense.category] : [])])];
  openModal(expense ? 'Edit expense' : 'Add expense', expense ? 'Kharchay ki details update karein' : 'Aaj kahan kharcha hua', `<form id="expense-form" data-id="${expense?.id || ''}"><div class="form-grid"><label>Date<input name="date" type="date" value="${esc(expense?.date || today())}" required></label><label>Category<select name="category">${categories.map(c => `<option ${expense?.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label><label>Amount (Rs.)<input name="amount" type="number" min="1" step="0.01" value="${esc(expense?.amount ?? '')}" required></label><label>Note<input name="note" maxlength="120" placeholder="Optional" value="${esc(expense?.note || '')}"></label></div>${modalFooter(expense ? 'Save changes' : 'Save expense')}</form>`);
}

function expenseCategoryForm() {
  openModal('Add expense category', 'Is naam se kharche alag track honge', `<form id="expense-category-form"><div class="form-grid"><label class="span-2">Category name<input name="name" required maxlength="60" placeholder="e.g. Internet"></label></div>${modalFooter('Add category')}</form>`);
}

function printExpenses() {
  const expenses = matchingExpenses(), t = expenseTotals(expenses), multi = state.expFrom !== state.expTo, short = d => `${d.slice(8)}/${d.slice(5, 7)}`;
  const rows = expenses.map((e, index) => [String(index + 1), `${multi ? short(e.date) + ' ' : ''}${e.category}${e.note ? ': ' + e.note : ''}`, number(e.amount)]);
  if (t.market) rows.push([String(rows.length + 1), 'Market purchase (daily)', number(t.market)]);
  printSlip({ title: 'DAILY EXPENSES', code: 'EXP', dateText: multi ? `${fmtDate(state.expFrom)} - ${fmtDate(state.expTo)}` : fmtDate(state.expFrom), head: ['#', 'Item', 'Amount'], rows, totals: [['Expenses :', String(expenses.length)], ['Total Rs :', number(t.total)]], columnLayout: 'numbered' });
}

function renderJazzcash() {
  const daily = new Map();
  state.jazzcashPayments.forEach(payment => daily.set(payment.date, (daily.get(payment.date) || 0) + Number(payment.amount)));
  const total = state.jazzcashPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const dailyRows = [...daily].map(([date, amount]) => `<span class="chip">${fmtDate(date)} <strong>${money(amount)}</strong></span>`).join('');
  const rows = state.jazzcashPayments.length ? state.jazzcashPayments.map((payment, index) => `<tr><td>${index + 1}</td><td>${fmtDate(payment.date)}</td><td><span class="badge ${payment.channel === 'qr' ? 'badge-low' : 'badge-good'}">${payment.channel === 'qr' ? 'QR' : 'JazzCash'}</span></td><td><strong>${money(payment.amount)}</strong></td><td>${esc(payment.transaction_ref || '—')}</td><td>${esc(payment.note || '—')}</td><td><button class="action-button danger" data-action="delete-jazzcash-payment" data-id="${payment.id}">Delete</button></td></tr>`).join('') : '<tr><td colspan="7"><div class="empty-state"><strong>Is date range mein koi payment nahi</strong>JazzCash ya QR se aane wali payment record karein.</div></td></tr>';
  return `${heading('JazzCash Payments', 'JazzCash ya QR se receive hui payments ka record.', `<input id="cash-from" class="filter-control" type="date" value="${state.cashFrom}"><input id="cash-to" class="filter-control" type="date" value="${state.cashTo}"><button class="button" data-action="all-payment-dates">All time</button><button class="button button-primary" data-action="add-jazzcash-payment">+ Add payment</button>`)}<div class="chip-row"><span class="chip">Range total <strong>${money(total)}</strong></span><span class="chip">Payments <strong>${state.jazzcashPayments.length}</strong></span>${dailyRows || '<span class="chip">Daily totals yahan dikhengi</span>'}</div><section class="panel"><div class="table-scroll"><table><thead><tr><th>#</th><th>DATE</th><th>METHOD</th><th>AMOUNT</th><th>TRANSACTION ID</th><th>NOTE</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="table-footer">${state.jazzcashPayments.length} payment${state.jazzcashPayments.length === 1 ? '' : 's'} · Range total <strong>${money(total)}</strong></div></section>`;
}

function jazzcashPaymentForm() {
  openModal('Add received payment', 'JazzCash ya QR se mili rakam record karein', `<form id="jazzcash-payment-form"><div class="form-grid"><label>Date<input name="date" type="date" value="${today()}" required></label><label>Method<select name="channel"><option value="jazzcash">JazzCash</option><option value="qr">QR payment</option></select></label><label>Amount (Rs.)<input name="amount" type="number" min="0.01" step="0.01" required></label><label>Transaction ID<input name="transaction_ref" maxlength="100" placeholder="Optional"></label><label class="span-2">Note<input name="note" maxlength="120" placeholder="Optional"></label></div>${modalFooter('Save payment')}</form>`);
}

function billItemsText(id) { const items = idMap(state.items); return state.purchaseItems.filter(l => l.purchase_id === id).map(l => `${items.get(l.item_id)?.name || 'Item'} × ${number(l.quantity)}`).join(', '); }

function renderPayables() {
  const sups = idMap(state.suppliers), groups = new Map(), nowMs = new Date(today()).getTime();
  state.purchases.filter(p => billDue(p) > 0).sort((a, b) => a.date.localeCompare(b.date)).forEach(p => { const a = groups.get(p.supplier_id) || []; a.push(p); groups.set(p.supplier_id, a); });
  let all = 0;
  const blocks = [...groups].map(([sid, bills]) => {
    const sup = sups.get(sid), total = bills.reduce((t, p) => t + billDue(p), 0); all += total;
    const rows = bills.map(p => `<tr><td>${fmtDate(p.date)}<span class="cell-sub">${Math.round((nowMs - new Date(p.date).getTime()) / 864e5)} din purana</span></td><td>${esc(billItemsText(p.id) || '—')}</td><td>${money(p.total_amount)}</td><td>${money(p.paid_amount)}</td><td><strong class="due">${money(billDue(p))}</strong></td><td><button class="action-button" data-action="pay-bill" data-id="${p.id}">Pay</button></td></tr>`).join('');
    return `<section class="panel supplier-block"><div class="pay-head"><div><strong>${esc(sup?.name || 'No supplier')}</strong><span class="cell-sub">${esc(sup?.phone || '')} · ${bills.length} pending bill${bills.length === 1 ? '' : 's'}</span></div><div class="pay-total">Total pending <strong class="due">${money(total)}</strong></div><div class="table-actions">${sup ? `<button class="action-button" data-action="pay-supplier" data-id="${sid}">Pay supplier</button>` : ''}<button class="action-button" data-action="print-payable" data-id="${sid}">Print</button></div></div><div class="table-scroll"><table><thead><tr><th>BILL DATE</th><th>ITEMS</th><th>BILL</th><th>PAID</th><th>PENDING</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }).join('') || '<section class="panel"><div class="empty-state"><strong>Koi pending bill nahi</strong>Saari payments clear hain.</div></section>';
  const hist = state.billPayments.slice(0, 15).map(x => `<tr><td>${fmtDate(x.date)}</td><td>${esc(sups.get(x.supplier_id)?.name || '—')}</td><td>${fmtDate(state.purchases.find(p => p.id === x.purchase_id)?.date)}</td><td><strong>${money(x.amount)}</strong></td><td>${esc(x.note || '—')}</td></tr>`).join('');
  return `${heading('Pending Bills', 'Supplier ke kitne bill baqi hain aur kitne ada hue.', '')}<div class="chip-row"><span class="chip">Total pending <strong class="due">${money(all)}</strong></span><span class="chip">${groups.size} supplier${groups.size === 1 ? '' : 's'}</span></div>${blocks}${hist ? `<section class="panel"><div class="pay-head"><strong>Pichli payments</strong></div><div class="table-scroll"><table><thead><tr><th>PAID ON</th><th>SUPPLIER</th><th>BILL DATE</th><th>AMOUNT</th><th>NOTE</th></tr></thead><tbody>${hist}</tbody></table></div></section>` : ''}`;
}

function payBillForm(id) {
  const p = state.purchases.find(x => x.id === id); if (!p) return;
  openModal('Bill pay karein', `${fmtDate(p.date)} · ${billItemsText(id) || 'Bill'}`, `<form id="paybill-form" data-id="${id}"><div class="amount-preview">Bill <strong>${money(p.total_amount)}</strong> · Paid <strong>${money(p.paid_amount)}</strong> · Baqi <strong class="due">${money(billDue(p))}</strong></div><div class="form-grid"><label>Date<input name="date" type="date" value="${today()}" required></label><label>Amount (Rs.)<input name="amount" type="number" min="0.01" max="${billDue(p)}" step="0.01" value="${billDue(p)}" required></label><label class="span-2">Note<input name="note" maxlength="120" placeholder="Optional"></label></div>${modalFooter('Save payment')}</form>`);
}

function paySupplierForm(sid) {
  const sup = state.suppliers.find(x => x.id === sid), total = state.purchases.filter(p => p.supplier_id === sid).reduce((t, p) => t + billDue(p), 0); if (!sup) return;
  openModal(`${sup.name} ko pay karein`, 'Rakam pehle sab se purane bill par lagti hai', `<form id="paysupplier-form" data-id="${sid}"><div class="amount-preview">Total pending <strong class="due">${money(total)}</strong></div><div class="form-grid"><label>Date<input name="date" type="date" value="${today()}" required></label><label>Amount (Rs.)<input name="amount" type="number" min="0.01" max="${total}" step="0.01" value="${total}" required></label><label class="span-2">Note<input name="note" maxlength="120" placeholder="Optional"></label></div>${modalFooter('Save payment')}</form>`);
}

function printPayable(sid) {
  const sup = state.suppliers.find(x => x.id === sid), bills = state.purchases.filter(p => p.supplier_id === sid && billDue(p) > 0).sort((a, b) => a.date.localeCompare(b.date)); if (!sup) return;
  printSlip({ title: 'PENDING BILLS', code: 'PAYABLE', dateText: fmtDate(today()), note: `Supplier: ${sup.name}`, head: ['Bill', '', 'Pending'], rows: bills.map(p => [`${fmtDate(p.date)} ${billItemsText(p.id)}`, '', number(billDue(p))]), totals: [['Bills :', String(bills.length)], ['Total Pending :', number(bills.reduce((t, p) => t + billDue(p), 0))]] });
}

function renderSuppliers() {
  const totals = new Map(), pendings = new Map();
  state.purchases.forEach(purchase => { totals.set(purchase.supplier_id, (totals.get(purchase.supplier_id) || 0) + Number(purchase.total_amount)); pendings.set(purchase.supplier_id, (pendings.get(purchase.supplier_id) || 0) + billDue(purchase)); });
  const rows = state.suppliers.length ? state.suppliers.map(supplier => `<tr><td><strong>${esc(supplier.name)}</strong></td><td>${esc(supplier.phone || '—')}</td><td>${esc(supplier.address || '—')}</td><td><strong>${money(totals.get(supplier.id))}</strong></td><td>${pendings.get(supplier.id) > 0 ? `<strong class="due">${money(pendings.get(supplier.id))}</strong>` : '—'}</td><td><div class="table-actions"><button class="action-button" data-action="edit-supplier" data-id="${supplier.id}">Edit</button><button class="action-button danger" data-action="delete-supplier" data-id="${supplier.id}">Delete</button></div></td></tr>`).join('') : '<tr><td colspan="6"><div class="empty-state"><strong>No suppliers yet</strong>Add a supplier to attach them to purchases.</div></td></tr>';
  return `${heading('Suppliers', 'Keep supplier details close to your purchase history.', '<button class="button button-primary" data-action="add-supplier">+ Add supplier</button>')}<section class="panel"><div class="table-scroll"><table><thead><tr><th>SUPPLIER</th><th>PHONE</th><th>ADDRESS</th><th>TOTAL PURCHASE</th><th>PENDING</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="table-footer">${state.suppliers.length} supplier${state.suppliers.length === 1 ? '' : 's'}</div></section>`;
}

function renderCategories() {
  const counts = new Map(); state.items.forEach(item => counts.set(item.category_id, (counts.get(item.category_id) || 0) + 1));
  const rows = state.categories.length ? state.categories.map(category => `<tr><td><strong>${esc(category.name)}</strong></td><td>${counts.get(category.id) || 0} item${counts.get(category.id) === 1 ? '' : 's'}</td><td><div class="table-actions"><button class="action-button" data-action="edit-category" data-id="${category.id}">Edit</button><button class="action-button danger" data-action="delete-category" data-id="${category.id}">Delete</button></div></td></tr>`).join('') : '<tr><td colspan="3"><div class="empty-state"><strong>No categories yet</strong>Add a category to organize inventory.</div></td></tr>';
  return `${heading('Categories', 'Organize the ingredients and supplies you keep in stock.', '<button class="button button-primary" data-action="add-category">+ Add category</button>')}<section class="panel"><div class="table-scroll"><table><thead><tr><th>CATEGORY</th><th>ITEMS</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="table-footer">${state.categories.length} categor${state.categories.length === 1 ? 'y' : 'ies'}</div></section>`;
}

function dateRange() {
  if (state.reportFilter === 'today') return [today(), today()];
  if (state.reportFilter === 'custom') return [state.customFrom, state.customTo];
  return [monthStart(), today()];
}

function renderReports() {
  const [from, to] = dateRange(); const suppliers = idMap(state.suppliers), items = idMap(state.items);
  const purchases = state.purchases.filter(purchase => (!from || purchase.date >= from) && (!to || purchase.date <= to));
  const purchaseRows = purchases.flatMap(purchase => state.purchaseItems.filter(line => line.purchase_id === purchase.id).map(line => `<tr><td>${esc(purchase.date)}</td><td>${esc(suppliers.get(purchase.supplier_id)?.name || 'No supplier')}</td><td>${esc(items.get(line.item_id)?.name || 'Deleted item')}</td><td>${number(line.quantity)} ${esc(items.get(line.item_id)?.unit || '')}</td><td>${money(line.total)}</td></tr>`));
  const inventoryRows = state.items.map(item => `<tr><td><strong>${esc(item.name)}</strong></td><td>${number(item.current_stock)} ${esc(item.unit)}</td><td>${costLabel(item)}</td><td>${money(Number(item.current_stock) * Number(item.cost_per_unit))}</td><td>${badge(item)}</td></tr>`).join('');
  return `${heading('Reports', 'Purchase activity and current inventory valuation.', '<button class="button" data-action="print-report">Print report</button>')}<div class="table-toolbar report-filters"><select id="report-date-filter" class="filter-control"><option value="today" ${state.reportFilter === 'today' ? 'selected' : ''}>Today</option><option value="month" ${state.reportFilter === 'month' ? 'selected' : ''}>This month</option><option value="custom" ${state.reportFilter === 'custom' ? 'selected' : ''}>Custom date</option></select>${state.reportFilter === 'custom' ? `<input id="report-from" class="filter-control" type="date" value="${esc(state.customFrom)}" aria-label="From date"><input id="report-to" class="filter-control" type="date" value="${esc(state.customTo)}" aria-label="To date">` : ''}<span class="cell-sub">${from || 'All dates'}${to && to !== from ? ` to ${to}` : ''}</span></div><div class="report-stack">${panel('Purchase report', `${purchases.length} purchase${purchases.length === 1 ? '' : 's'} in selected range`, `<div class="table-scroll"><table><thead><tr><th>DATE</th><th>SUPPLIER</th><th>ITEM</th><th>QUANTITY</th><th>AMOUNT</th></tr></thead><tbody>${purchaseRows.length ? purchaseRows.join('') : '<tr><td colspan="5"><div class="empty-state">No purchase activity for this date range.</div></td></tr>'}</tbody></table></div>`)}${panel('Inventory report', `${state.items.length} items · total value ${money(state.items.reduce((sum, item) => sum + Number(item.current_stock) * Number(item.cost_per_unit), 0))}`, `<div class="table-scroll"><table><thead><tr><th>ITEM</th><th>CURRENT STOCK</th><th>COST / UNIT</th><th>TOTAL VALUE</th><th>STATUS</th></tr></thead><tbody>${inventoryRows || '<tr><td colspan="5"><div class="empty-state">No inventory items.</div></td></tr>'}</tbody></table></div>`)}</div>`;
}

function renderSettings() {
  return `${heading('Settings', 'Account and connection details for this shop.')}<section class="panel"><header class="panel-header"><div><h2 class="panel-title">Account</h2><p class="panel-subtitle">Your shop data is private to this account.</p></div></header><div class="panel-body"><div class="settings-row"><div><strong>Signed in as</strong><span>${esc(state.user.email)}</span></div><button class="button" data-action="sign-out">Sign out</button></div><div class="settings-row"><div><strong>Database</strong><span>Supabase · live data</span></div><span class="badge badge-good">Connected</span></div><div class="settings-row"><div><strong>Currency</strong><span>Pakistani Rupee (Rs.)</span></div></div></div></section>`;
}

function drawCharts() {
  requestAnimationFrame(() => {
    drawBarChart($('#purchase-chart'));
    drawDonutChart($('#stock-chart'));
  });
}

function setupCanvas(canvas) {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return null;
  const ratio = window.devicePixelRatio || 1; canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio);
  const context = canvas.getContext('2d'); context.scale(ratio, ratio); return { context, width: rect.width, height: rect.height };
}

function drawBarChart(canvas) {
  const setup = setupCanvas(canvas); if (!setup) return;
  const { context: ctx, width, height } = setup; const months = [];
  for (let offset = 5; offset >= 0; offset--) { const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - offset); months.push({ key: monthStart(date), label: new Intl.DateTimeFormat('en', { month: 'short' }).format(date), amount: 0 }); }
  state.purchases.forEach(purchase => { const month = months.find(entry => entry.key === String(purchase.date).slice(0, 7) + '-01'); if (month) month.amount += Number(purchase.total_amount); });
  const max = Math.max(...months.map(month => month.amount), 1), left = 42, right = 8, top = 14, bottom = 32, chartHeight = height - top - bottom, chartWidth = width - left - right;
  ctx.clearRect(0, 0, width, height); ctx.font = '12px DM Sans, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let line = 0; line <= 3; line++) { const y = top + chartHeight * line / 3; ctx.strokeStyle = '#edf0ec'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(width - right, y); ctx.stroke(); ctx.fillStyle = '#9aa19a'; ctx.fillText(max === 1 ? '0' : `${Math.round(max * (1 - line / 3) / 1000)}k`, left - 7, y); }
  const slot = chartWidth / months.length, barWidth = Math.min(27, slot * .48);
  months.forEach((month, index) => { const x = left + slot * index + (slot - barWidth) / 2; const barHeight = chartHeight * month.amount / max; ctx.fillStyle = month.amount ? '#4b9667' : '#e3eae3'; ctx.beginPath(); ctx.roundRect(x, top + chartHeight - Math.max(barHeight, month.amount ? 3 : 0), barWidth, Math.max(barHeight, month.amount ? 3 : 0), 3); ctx.fill(); ctx.fillStyle = '#89928a'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(month.label, x + barWidth / 2, height - 20); });
}

function drawDonutChart(canvas) {
  const setup = setupCanvas(canvas); if (!setup) return;
  const { context: ctx, width, height } = setup; const counts = { good: 0, low: 0, out: 0 };
  state.items.forEach(item => counts[statusFor(item)[1]]++);
  const colors = { good: '#4b9667', low: '#e8a24f', out: '#cc6258' }, labels = { good: 'In stock', low: 'Low stock', out: 'Out of stock' }, total = state.items.length;
  const centerX = width / 2, centerY = height / 2, radius = Math.min(width, height) * .44; ctx.clearRect(0, 0, width, height);
  if (!total) { ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, Math.PI * 2); ctx.strokeStyle = '#edf0ec'; ctx.lineWidth = 15; ctx.stroke(); }
  else { let angle = -Math.PI / 2; for (const key of ['good', 'low', 'out']) { if (!counts[key]) continue; const next = angle + Math.PI * 2 * counts[key] / total; ctx.beginPath(); ctx.arc(centerX, centerY, radius, angle, next - .025); ctx.strokeStyle = colors[key]; ctx.lineWidth = 15; ctx.lineCap = 'round'; ctx.stroke(); angle = next; } }
  ctx.fillStyle = '#2c382f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 26px Manrope, sans-serif'; ctx.fillText(String(total), centerX, centerY - 5); ctx.fillStyle = '#909990'; ctx.font = '12px DM Sans, sans-serif'; ctx.fillText('items', centerX, centerY + 13);
  $('#stock-legend').innerHTML = ['good', 'low', 'out'].map(key => `<div class="legend-item"><span class="legend-dot" style="background:${colors[key]}"></span><span>${labels[key]}</span><strong>${counts[key]}</strong><small>items</small></div>`).join('');
}

function openModal(title, subtitle, body) {
  $('#modal-content').innerHTML = `<header class="modal-header"><div><h2>${title}</h2><p>${subtitle}</p></div><button class="close-modal" type="button" data-action="close-modal" aria-label="Close">×</button></header><div class="modal-body">${body}</div>`;
  $('#modal').showModal();
}

function modalFooter(label = 'Save item') { return `<div class="modal-footer"><button class="button" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">${label}</button></div>`; }

function itemForm(item = null) {
  const categoryOptions = state.categories.map(category => `<option value="${category.id}" ${item?.category_id === category.id ? 'selected' : ''}>${esc(category.name)}</option>`).join('');
  openModal(item ? 'Edit item' : 'Add inventory item', 'Item details and stock levels', `<form id="item-form" data-id="${item?.id || ''}"><div class="form-grid"><label class="span-2">Item name<input name="name" required maxlength="100" value="${esc(item?.name || '')}" placeholder="e.g. Chicken breast"></label><label>Category<select name="category_id"><option value="">No category</option>${categoryOptions}</select></label><label>Unit<input name="unit" required maxlength="20" list="unit-list" pattern="[^0-9].*" title="Sirf unit likhein, jaise KG, Liter, Packet. Number nahi." value="${esc(item?.unit || '')}" placeholder="KG, Liter, Packet"></label><label>Current stock<input name="current_stock" type="number" min="0" step="0.001" required value="${item ? esc(item.current_stock) : '0'}" ${item ? 'readonly title="Stock badalne ke liye Adjust stock use karein"' : ''}></label><label>Minimum stock<input name="minimum_stock" type="number" min="0" step="0.001" required value="${item ? esc(item.minimum_stock) : '0'}"></label><label class="span-2">Cost per unit (Rs.) - optional<input name="cost_per_unit" type="number" min="0" step="0.01" value="${item ? esc(item.cost_per_unit) : '0'}"><span class="form-help">Price abhi nahi pata to 0 rehne dein. Purchase save karne par price khud update ho jati hai.</span></label></div><datalist id="unit-list"><option value="KG"><option value="Gram"><option value="Liter"><option value="Packet"><option value="Piece"><option value="Dozen"><option value="Box"><option value="Bottle"><option value="Tin"></datalist>${modalFooter(item ? 'Save changes' : 'Add item')}</form>`);
}

function adjustmentForm(item = null) {
  if (!item && !state.items.length) return toast('Add an inventory item before adjusting stock.', true);
  const options = state.items.map(entry => `<option value="${entry.id}" ${item?.id === entry.id ? 'selected' : ''}>${esc(entry.name)} (stock ${number(entry.current_stock)} ${esc(entry.unit)})</option>`).join('');
  openModal('Adjust stock', 'Record stock added or removed', `<form id="adjustment-form"><div class="form-grid"><label class="span-2">Item<select name="item_id" required>${options}</select></label><label>Adjustment<select name="type"><option value="add">Add stock</option><option value="remove">Remove stock</option></select></label><label>Quantity<input name="quantity" type="number" min="0.001" step="0.001" required placeholder="0"></label><label class="span-2">Reason<select name="reason"><option>Wastage</option><option>Damage</option><option>Manual Correction</option><option>Other</option></select></label></div>${modalFooter('Save adjustment')}</form>`);
}

function purchaseForm() {
  if (!state.items.length) return toast('Add an inventory item before recording a purchase.', true);
  const itemOptions = state.items.map(item => `<option value="${item.id}" data-cost="${esc(item.cost_per_unit)}">${esc(item.name)} (${esc(item.unit)})</option>`).join('');
  const supplierOptions = state.suppliers.map(supplier => `<option value="${supplier.id}">${esc(supplier.name)}</option>`).join('');
  openModal('Record a purchase', 'Stock is increased when this purchase is saved', `<form id="purchase-form"><div class="form-grid"><label>Date<input name="date" type="date" value="${today()}" required></label><label>Supplier<select name="supplier_id"><option value="">No supplier</option>${supplierOptions}</select></label><label class="span-2">Item<select name="item_id" required>${itemOptions}</select></label><label>Quantity<input name="quantity" type="number" min="0.001" step="0.001" value="1" required></label><label>Cost per unit (Rs.)<input name="cost_per_unit" type="number" min="0" step="0.01" value="${esc(state.items[0]?.cost_per_unit || 0)}" required></label><label>Payment<select name="payment"><option value="paid">Paid (poora)</option><option value="pending">Pending (udhaar)</option><option value="partial">Partial</option></select></label><label>Paid amount (Rs.)<input name="paid_amount" type="number" min="0" step="0.01" placeholder="Partial par likhein" disabled></label><div class="amount-preview span-2">Purchase total <strong id="purchase-total">${money(state.items[0]?.cost_per_unit || 0)}</strong></div></div>${modalFooter('Save purchase')}</form>`);
}

function supplierForm(supplier = null) {
  openModal(supplier ? 'Edit supplier' : 'Add supplier', 'Supplier contact details', `<form id="supplier-form" data-id="${supplier?.id || ''}"><div class="form-grid"><label class="span-2">Supplier name<input name="name" required maxlength="100" value="${esc(supplier?.name || '')}"></label><label class="span-2">Phone<input name="phone" maxlength="40" value="${esc(supplier?.phone || '')}"></label><label class="span-2">Address<textarea name="address" maxlength="250">${esc(supplier?.address || '')}</textarea></label></div>${modalFooter(supplier ? 'Save changes' : 'Add supplier')}</form>`);
}

function categoryForm(category = null) {
  openModal(category ? 'Edit category' : 'Add category', 'Keep inventory easy to scan', `<form id="category-form" data-id="${category?.id || ''}"><div class="form-grid"><label class="span-2">Category name<input name="name" required maxlength="80" value="${esc(category?.name || '')}" placeholder="e.g. Vegetables"></label></div>${modalFooter(category ? 'Save changes' : 'Add category')}</form>`);
}

async function saveForm(form, table, values, id) {
  const query = id ? supabase.from(table).update(values).eq('id', id) : supabase.from(table).insert(values);
  const { error } = await query;
  if (error) throw error;
}

async function handleSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  const data = new FormData(form);
  try {
    if (form.id === 'login-form') {
      event.preventDefault(); const email = data.get('email'), password = data.get('password');
      const result = form.dataset.signup === 'true' ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (form.dataset.signup === 'true' && !result.data.session) { $('#auth-message').textContent = 'Check your email to confirm your account, then sign in.'; return; }
      if (result.data.session) showApp(result.data.user);
      return;
    }
    if (form.id === 'item-form') {
      event.preventDefault(); const editing = Boolean(form.dataset.id); const values = { name: data.get('name').trim(), category_id: data.get('category_id') || null, unit: data.get('unit').trim(), current_stock: Number(data.get('current_stock')), minimum_stock: Number(data.get('minimum_stock')), cost_per_unit: Number(data.get('cost_per_unit')) };
      if (editing) delete values.current_stock;
      await saveForm(form, 'inventory_items', values, form.dataset.id); toast(form.dataset.id ? 'Item updated.' : 'Item added.');
    } else if (form.id === 'supplier-form') {
      event.preventDefault(); const values = { name: data.get('name').trim(), phone: data.get('phone').trim(), address: data.get('address').trim() }; await saveForm(form, 'suppliers', values, form.dataset.id); toast(form.dataset.id ? 'Supplier updated.' : 'Supplier added.');
    } else if (form.id === 'category-form') {
      event.preventDefault(); await saveForm(form, 'categories', { name: data.get('name').trim() }, form.dataset.id); toast(form.dataset.id ? 'Category updated.' : 'Category added.');
    } else if (form.id === 'purchase-form') {
      event.preventDefault(); const { data: purchaseId, error } = await supabase.rpc('record_purchase', { p_date: data.get('date'), p_supplier_id: data.get('supplier_id') || null, p_items: [{ item_id: data.get('item_id'), quantity: Number(data.get('quantity')), cost_per_unit: Number(data.get('cost_per_unit')) }], p_paid: { paid: null, pending: 0, partial: Number(data.get('paid_amount') || 0) }[data.get('payment')] }); if (error) throw error; toast('Purchase saved and stock updated.');
    } else if (form.id === 'employee-form') {
      event.preventDefault(); await saveForm(form, 'employees', { name: data.get('name').trim(), phone: data.get('phone').trim(), role: data.get('role').trim(), salary_type: data.get('salary_type'), salary: Number(data.get('salary')), active: form.dataset.id ? data.has('active') : true, join_date: data.get('join_date') || null }, form.dataset.id); toast('Employee save ho gaya.');
    } else if (form.id === 'advance-form') {
      event.preventDefault(); await saveForm(form, 'advances', { employee_id: data.get('employee_id'), date: data.get('date'), amount: Number(data.get('amount')), note: data.get('note').trim() }); toast('Advance save ho gaya.');
    } else if (form.id === 'candidate-form') {
      event.preventDefault(); await saveForm(form, 'candidates', { name: data.get('name').trim(), phone: data.get('phone').trim(), role: data.get('role').trim(), salary_type: data.get('salary_type'), expected_salary: Number(data.get('expected_salary')), join_date: data.get('join_date') || null, status: form.dataset.id ? data.get('status') : 'pending', note: data.get('note').trim() }, form.dataset.id); toast('Save ho gaya.');
    } else if (form.id === 'market-form') {
      event.preventDefault(); const names = data.getAll('name'), qs = data.getAll('quantity'), us = data.getAll('unit');
      const { error } = await supabase.rpc('save_market_list', { p_date: data.get('date'), p_note: data.get('note') || '', p_items: names.map((n, i) => ({ name: n, quantity: Number(qs[i]), unit: us[i] })) }); if (error) throw error; toast('Market list save ho gayi.');
    } else if (form.id === 'market-prices-form') {
      event.preventDefault(); const id = form.dataset.id, amounts = state.marketItems.filter(i => i.list_id === id).map(i => ({ id: i.id, amount: Number(data.get(`amount_${i.id}`) || 0) }));
      const { error } = await supabase.rpc('complete_market_list', { p_list_id: id, p_amounts: amounts }); if (error) throw error; toast('Prices save ho gayin.');
    } else if (form.id === 'expense-form') {
      event.preventDefault(); await saveForm(form, 'expenses', { date: data.get('date'), category: data.get('category'), amount: Number(data.get('amount')), note: data.get('note').trim() }, form.dataset.id); toast(form.dataset.id ? 'Expense update ho gaya.' : 'Expense save ho gaya.');
    } else if (form.id === 'expense-category-form') {
      event.preventDefault(); const name = data.get('name').trim();
      if (expenseCategories().some(c => c.toLocaleLowerCase() === name.toLocaleLowerCase())) return toast('Ye category pehle se mojood hai.', true);
      const custom = JSON.parse(localStorage.getItem(expenseCategoryStorageKey()) || '[]');
      localStorage.setItem(expenseCategoryStorageKey(), JSON.stringify([...(Array.isArray(custom) ? custom : []), name]));
      toast('Expense category add ho gayi.');
    } else if (form.id === 'jazzcash-payment-form') {
      event.preventDefault(); await saveForm(form, 'jazzcash_payments', { date: data.get('date'), channel: data.get('channel'), amount: Number(data.get('amount')), transaction_ref: data.get('transaction_ref').trim(), note: data.get('note').trim() }); toast('Payment record ho gayi.');
    } else if (form.id === 'paybill-form') {
      event.preventDefault(); const { error } = await supabase.rpc('pay_bill', { p_purchase_id: form.dataset.id, p_amount: Number(data.get('amount')), p_date: data.get('date'), p_note: data.get('note') || '' }); if (error) throw error; toast('Payment save ho gayi.');
    } else if (form.id === 'paysupplier-form') {
      event.preventDefault(); const { error } = await supabase.rpc('pay_supplier', { p_supplier_id: form.dataset.id, p_amount: Number(data.get('amount')), p_date: data.get('date'), p_note: data.get('note') || '' }); if (error) throw error; toast('Payment save ho gayi.');
    } else if (form.id === 'demand-form') {
      event.preventDefault(); const ids = data.getAll('item_id'), qs = data.getAll('quantity');
      const { error } = await supabase.rpc('save_demand', { p_date: data.get('date'), p_note: data.get('note') || '', p_items: ids.map((id, i) => ({ item_id: id, quantity: Number(qs[i]) })) }); if (error) throw error; toast('Demand save ho gayi.');
    } else if (form.id === 'adjustment-form') {
      event.preventDefault(); const { error } = await supabase.rpc('adjust_stock', { p_item_id: data.get('item_id'), p_quantity: Number(data.get('quantity')), p_type: data.get('type'), p_reason: data.get('reason') }); if (error) throw error; toast('Stock adjustment saved.');
    } else return;
    $('#modal').close(); await loadData(); render();
  } catch (error) {
    toast(error.message || 'Something went wrong. Please try again.', true);
  }
}

function friendlyDeleteError(error, label) {
  if (error.code === '23503' || /foreign key/i.test(error.message || '')) {
    const reasons = {
      item: 'Is item ki purchase ya stock adjustment history hai, is liye delete nahi ho sakta.',
      supplier: 'Is supplier ki purchases maujood hain, is liye delete nahi ho sakta.',
      category: 'Is category mein items hain. Pehle items ki category badlein, phir delete karein.'
    };
    return reasons[label] || 'Is record ka doosra data juda hua hai, is liye delete nahi ho sakta.';
  }
  return error.message || 'Delete nahi ho saka. Dobara koshish karein.';
}

async function removeRecord(table, id, label) {
  if (!window.confirm(`Delete this ${label}? This cannot be undone.`)) return;
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) return toast(friendlyDeleteError(error, label), true);
  toast(`${label[0].toUpperCase()}${label.slice(1)} deleted.`); await loadData(); render();
}

function refreshInventoryRows() {
  const categoryFilter = $('#inventory-category-filter')?.value || '', statusFilter = $('#inventory-status-filter')?.value || '', categories = idMap(state.categories);
  const filtered = state.items.filter(item => `${item.name} ${categories.get(item.category_id)?.name || ''}`.toLowerCase().includes(state.search.toLowerCase()) && (!categoryFilter || item.category_id === categoryFilter) && (!statusFilter || statusFor(item)[1] === statusFilter));
  $('#inventory-rows').innerHTML = filtered.length ? filtered.map(item => `<tr><td><strong>${esc(item.name)}</strong><span class="cell-sub">${esc(categories.get(item.category_id)?.name || 'Uncategorized')}</span></td><td>${esc(item.unit)}</td><td>${number(item.current_stock)}</td><td>${number(item.minimum_stock)}</td><td>${costLabel(item)}</td><td><strong>${money(Number(item.current_stock) * Number(item.cost_per_unit))}</strong></td><td>${badge(item)}</td><td><div class="table-actions"><button class="action-button" data-action="adjust-stock" data-id="${item.id}">Adjust</button><button class="action-button" data-action="edit-item" data-id="${item.id}">Edit</button><button class="action-button danger" data-action="delete-item" data-id="${item.id}">Delete</button></div></td></tr>`).join('') : '<tr><td colspan="8"><div class="empty-state"><strong>No matching items</strong>Try a different search or filter.</div></td></tr>';
  const footer = $('.table-footer'); if (footer) footer.textContent = `${filtered.length} of ${state.items.length} items`;
}

document.addEventListener('submit', handleSubmit);
document.addEventListener('click', async event => {
  const nav = event.target.closest('[data-page]');
  if (nav) { state.page = nav.dataset.page; state.showSalary = false; $('#sidebar').classList.remove('open'); $('#sidebar-scrim').classList.remove('visible'); render(); return; }
  const button = event.target.closest('[data-action]'); if (!button) return;
  const id = button.dataset.id;
  try {
    switch (button.dataset.action) {
      case 'add-item': itemForm(); break;
      case 'edit-item': itemForm(state.items.find(item => item.id === id)); break;
      case 'adjust-stock': adjustmentForm(state.items.find(item => item.id === id)); break;
      case 'open-adjustment': adjustmentForm(); break;
      case 'open-purchase': purchaseForm(); break;
      case 'toggle-salary': state.showSalary = !state.showSalary; render(); break;
      case 'pay-bill': payBillForm(id); break;
      case 'pay-supplier': paySupplierForm(id); break;
      case 'print-payable': printPayable(id); break;
      case 'print-staff-slip': printStaffSlip(id); break;
      case 'add-market': marketForm(); break;
      case 'add-market-row': $('#market-rows').insertAdjacentHTML('beforeend', marketRow()); break;
      case 'remove-market-row': if ($$('.market-row').length > 1) button.closest('.market-row').remove(); break;
      case 'print-market': printMarket(id); break;
      case 'market-prices': marketPricesForm(id); break;
      case 'delete-market': await removeRecord('market_lists', id, 'market list'); break;
      case 'add-expense': expenseForm(); break;
      case 'edit-expense': expenseForm(state.expenses.find(e => e.id === id)); break;
      case 'add-expense-category': expenseCategoryForm(); break;
      case 'delete-expense': await removeRecord('expenses', id, 'expense'); break;
      case 'print-expenses': printExpenses(); break;
      case 'add-jazzcash-payment': jazzcashPaymentForm(); break;
      case 'delete-jazzcash-payment': await removeRecord('jazzcash_payments', id, 'payment'); break;
      case 'all-payment-dates': state.cashFrom = state.cashTo = ''; await loadData(); render(); break;
      case 'exp-today': state.expFrom = state.expTo = today(); await loadData(); render(); break;
      case 'add-advance': advanceForm(); break;
      case 'delete-advance': await removeRecord('advances', id, 'advance'); break;
      case 'add-candidate': candidateForm(); break;
      case 'edit-candidate': candidateForm(state.candidates.find(c => c.id === id)); break;
      case 'delete-candidate': await removeRecord('candidates', id, 'candidate'); break;
      case 'join-candidate': {
        const c = state.candidates.find(x => x.id === id); if (!c || !window.confirm(`${c.name} ko employee bana dein?`)) break;
        const { error } = await supabase.from('employees').insert({ name: c.name, phone: c.phone, role: c.role, salary: c.expected_salary, salary_type: c.salary_type, join_date: c.join_date || today(), active: true }); if (error) throw error;
        const upd = await supabase.from('candidates').update({ status: 'joined' }).eq('id', id); if (upd.error) throw upd.error;
        toast(`${c.name} employee ban gaya.`); await loadData(); render(); break;
      }
      case 'add-employee': employeeForm(); break;
      case 'edit-employee': employeeForm(state.employees.find(e => e.id === id)); break;
      case 'delete-employee': await removeRecord('employees', id, 'employee'); break;
      case 'all-on-time': $$('.att-status').forEach(sel => { if (!sel.value) sel.value = 'on_time'; }); break;
      case 'print-page': window.print(); break;
      case 'save-attendance': {
        const rows = $$('#page-content tr[data-emp]').map(tr => { const status = tr.querySelector('.att-status').value; return status && { employee_id: tr.dataset.emp, date: state.attDate, status, late_minutes: status === 'late' ? Number(tr.querySelector('.att-late').value || 0) : 0, paid: ['on_time', 'late'].includes(status) && tr.querySelector('.att-paid')?.value === 'true' }; }).filter(Boolean);
        if (!rows.length) return toast('Kam az kam ek employee ki hazri chunein.', true);
        const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'employee_id,date' }); if (error) throw error;
        toast('Attendance save ho gayi.'); await loadData(); render(); break;
      }
      case 'add-demand': demandForm(); break;
      case 'add-demand-row': $('#demand-rows').insertAdjacentHTML('beforeend', demandRow()); break;
      case 'remove-demand-row': if ($$('.demand-row').length > 1) button.closest('.demand-row').remove(); break;
      case 'print-demand': printDemands([id]); break;
      case 'print-all-demand': printDemands(state.demands.filter(d => d.status === 'open').map(d => d.id)); break;
      case 'done-all-demand': {
        const open = state.demands.filter(d => d.status === 'open'); if (!open.length) break;
        if (!window.confirm(`${open.length} pending demand Done karein? Inventory se stock kam ho jayega.`)) break;
        try { for (const d of open) { const { error } = await supabase.rpc('complete_demand', { p_demand_id: d.id }); if (error) throw error; } toast('Saari demand Done. Stock update ho gaya.'); }
        finally { await loadData(); render(); }
        break;
      }
      case 'delete-demand': await removeRecord('daily_demands', id, 'demand'); break;
      case 'done-demand': {
        if (!window.confirm('Demand Done karein? Inventory se stock kam ho jayega.')) break;
        const { error } = await supabase.rpc('complete_demand', { p_demand_id: id }); if (error) throw error;
        toast('Demand done. Stock update ho gaya.'); await loadData(); render(); break;
      }
      case 'add-supplier': supplierForm(); break;
      case 'edit-supplier': supplierForm(state.suppliers.find(item => item.id === id)); break;
      case 'add-category': categoryForm(); break;
      case 'edit-category': categoryForm(state.categories.find(item => item.id === id)); break;
      case 'delete-item': await removeRecord('inventory_items', id, 'item'); break;
      case 'delete-supplier': await removeRecord('suppliers', id, 'supplier'); break;
      case 'delete-category': await removeRecord('categories', id, 'category'); break;
      case 'close-modal': $('#modal').close(); break;
      case 'clear-purchase-filter': state.purchaseFilter = { date: '', supplier: '' }; render(); break;
      case 'print-report': window.print(); break;
      case 'sign-out': await supabase.auth.signOut(); state.user = null; showAuth(); break;
    }
  } catch (error) { toast(error.message, true); }
});

document.addEventListener('input', event => {
  if (event.target.id === 'global-search') { state.search = event.target.value; if (state.page !== 'inventory') state.page = 'inventory'; render(); const box = $('#inventory-search'); if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); } }
  if (event.target.id === 'inventory-search') { state.search = event.target.value; refreshInventoryRows(); }
  if (event.target.id === 'expense-search') { const cursor = event.target.selectionStart; state.expenseSearch = event.target.value; render(); const box = $('#expense-search'); if (box) { box.focus(); box.setSelectionRange(cursor, cursor); } }
  if (event.target.matches('#purchase-form [name="quantity"], #purchase-form [name="cost_per_unit"]')) { const form = $('#purchase-form'); const total = Number(form.elements.quantity.value || 0) * Number(form.elements.cost_per_unit.value || 0); $('#purchase-total').textContent = money(total); }
});

document.addEventListener('change', event => {
  if (event.target.matches('#purchase-form [name="payment"]')) { const f = $('#purchase-form').elements.paid_amount; f.disabled = event.target.value !== 'partial'; f.required = !f.disabled; if (f.disabled) f.value = ''; }
  if ((event.target.id === 'exp-from' || event.target.id === 'exp-to') && event.target.value) { state[event.target.id === 'exp-from' ? 'expFrom' : 'expTo'] = event.target.value; if (state.expFrom > state.expTo) state.expTo = state.expFrom; loadData().then(render).catch(e => toast(e.message, true)); }
  if ((event.target.id === 'cash-from' || event.target.id === 'cash-to') && event.target.value) { state[event.target.id === 'cash-from' ? 'cashFrom' : 'cashTo'] = event.target.value; if (state.cashFrom && state.cashTo && state.cashFrom > state.cashTo) state[event.target.id === 'cash-from' ? 'cashTo' : 'cashFrom'] = event.target.value; loadData().then(render).catch(e => toast(e.message, true)); }
  if (event.target.matches('.att-status')) { const late = event.target.closest('tr').querySelector('.att-late'); late.disabled = event.target.value !== 'late'; if (late.disabled) late.value = ''; const pd = event.target.closest('tr').querySelector('.att-paid'); if (pd) { pd.disabled = !['on_time', 'late'].includes(event.target.value); if (pd.disabled) pd.value = 'false'; } }
  if (event.target.id === 'att-date' && event.target.value) { state.attDate = event.target.value; loadData().then(render).catch(e => toast(e.message, true)); }
  if (event.target.id === 'staff-month' && event.target.value) { state.staffMonth = event.target.value; state.attDate = event.target.value === today().slice(0, 7) ? today() : `${event.target.value}-01`; loadData().then(render).catch(e => toast(e.message, true)); }
  if (event.target.id === 'thermal-width') { try { localStorage.setItem('thermalWidth', event.target.value); } catch {} }
  if (event.target.id === 'inventory-category-filter' || event.target.id === 'inventory-status-filter') refreshInventoryRows();
  if (event.target.id === 'purchase-date-filter') { state.purchaseFilter.date = event.target.value; render(); }
  if (event.target.id === 'purchase-supplier-filter') { state.purchaseFilter.supplier = event.target.value; render(); }
  if (event.target.id === 'report-date-filter') { state.reportFilter = event.target.value; render(); }
  if (event.target.id === 'report-from') { state.customFrom = event.target.value; render(); }
  if (event.target.id === 'report-to') { state.customTo = event.target.value; render(); }
  if (event.target.matches('#demand-form [name="item_id"]')) event.target.closest('.demand-row').querySelector('.qty-unit').textContent = event.target.selectedOptions[0].dataset.unit;
  if (event.target.matches('#purchase-form [name="item_id"]')) { const option = event.target.selectedOptions[0]; $('#purchase-form [name="cost_per_unit"]').value = option.dataset.cost; $('#purchase-total').textContent = money(option.dataset.cost); }
});

$('#auth-mode').addEventListener('click', () => {
  const form = $('#login-form'), signup = form.dataset.signup !== 'true'; form.dataset.signup = String(signup); $('#auth-mode').textContent = signup ? 'Sign in instead' : 'Create an account'; $('.auth-copy h1').innerHTML = signup ? 'A fresh start<br>for your stock.' : 'Good stock.<br>Clear head.'; $('.auth-copy>p:last-child').textContent = signup ? 'Create your shop account to get started.' : 'Sign in to keep your kitchen supplies in order.'; form.querySelector('button[type="submit"]').textContent = signup ? 'Create account' : 'Sign in'; $('#auth-message').textContent = '';
});
$('#menu-toggle').addEventListener('click', () => { $('#sidebar').classList.add('open'); $('#sidebar-scrim').classList.add('visible'); });
$('#sidebar-scrim').addEventListener('click', () => { $('#sidebar').classList.remove('open'); $('#sidebar-scrim').classList.remove('visible'); });
$('#modal').addEventListener('click', event => { if (event.target === $('#modal')) $('#modal').close(); });
window.addEventListener('resize', () => { if (state.page === 'dashboard') drawCharts(); });
document.addEventListener('keydown', event => { if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); $('#global-search').focus(); } });

if (!configured) {
  showAuth('Add your Supabase URL and anon key in index.html to connect this shop.');
} else {
  supabase.auth.onAuthStateChange((_event, session) => { if (!session) showAuth(); });
  supabase.auth.getSession().then(({ data: { session }, error }) => { if (error) showAuth(error.message); else if (session) showApp(session.user); else showAuth(); });
}