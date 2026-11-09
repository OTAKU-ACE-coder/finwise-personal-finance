const STORE = 'finwise-data-v1';
// GitHub Pages only serves static files, so the hosted preview runs without server accounts.
const isHostedPreview = location.hostname.endsWith('.github.io');
const seed = {
  currency: 'USD',
  theme: 'light',
  account: { name: 'Jordan Davis', email: '' },
  balance: 48250.75,
  transactions: [
    { id: 1, name: 'Whole Foods Market', category: 'Groceries', date: '2026-11-04', amount: -84.32, icon: '🥑', color: '#e8f2df' },
    { id: 2, name: 'Salary · Acme Studio', category: 'Income', date: '2026-11-03', amount: 4200, icon: '↗', color: '#e5f1ef' },
    { id: 3, name: 'Netflix', category: 'Entertainment', date: '2026-11-02', amount: -15.99, icon: '▶', color: '#f6e8e5' },
    { id: 4, name: 'Uber', category: 'Transport', date: '2026-11-01', amount: -24.5, icon: '↗', color: '#eee9f4' },
    { id: 5, name: 'Blue Bottle Coffee', category: 'Dining out', date: '2026-10-31', amount: -12.75, icon: '☕', color: '#f5eadc' },
    { id: 6, name: 'Freelance · Northstar', category: 'Income', date: '2026-10-29', amount: 850, icon: '✦', color: '#e5f1ef' },
    { id: 7, name: 'Target', category: 'Shopping', date: '2026-10-28', amount: -67.4, icon: '◉', color: '#f6e8e5' },
    { id: 8, name: 'City Power', category: 'Bills', date: '2026-10-26', amount: -94.1, icon: 'ϟ', color: '#f6f0dc' },
    { id: 9, name: 'Green Leaf Pharmacy', category: 'Health', date: '2026-10-24', amount: -28.65, icon: '+', color: '#e5f1ef' }
  ],
  budgets: [
    { name: 'Groceries', limit: 600, spent: 384.32, color: '#277c78', icon: '🥑' },
    { name: 'Dining out', limit: 250, spent: 172.5, color: '#dd8c57', icon: '☕' },
    { name: 'Shopping', limit: 300, spent: 217.4, color: '#8265a7', icon: '◉' },
    { name: 'Transport', limit: 180, spent: 96.5, color: '#5b8db8', icon: '↗' }
  ],
  pots: [
    { name: 'Emergency fund', saved: 2450, target: 5000, icon: '🛟', color: '#dceee8', note: 'Your safety net, one step at a time.' },
    { name: 'Summer trip', saved: 1380, target: 2500, icon: '✈️', color: '#f5eadc', note: 'A little closer to the coast.' },
    { name: 'New laptop', saved: 820, target: 1800, icon: '💻', color: '#eee9f4', note: 'Saving for a better workspace.' }
  ],
  bills: [
    { name: 'Rent', category: 'Home', amount: 1450, date: '2026-11-10', icon: '⌂', color: '#e5f1ef', paid: false },
    { name: 'Internet', category: 'Utilities', amount: 65, date: '2026-11-12', icon: '⌁', color: '#eee9f4', paid: false },
    { name: 'Spotify', category: 'Subscriptions', amount: 10.99, date: '2026-11-15', icon: '♫', color: '#e5f1ef', paid: false },
    { name: 'Car insurance', category: 'Transport', amount: 118, date: '2026-11-18', icon: '◇', color: '#f5eadc', paid: false },
    { name: 'Phone plan', category: 'Utilities', amount: 45, date: '2026-11-22', icon: '▯', color: '#f6f0dc', paid: false }
  ]
};
let data;
try { data = { ...seed, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch { data = structuredClone(seed); }
let currentUser = null;
let signingOut = false;
let pendingAccountSave = Promise.resolve();
let unsyncedSnapshot = null;
let nextId=Math.max(Date.now(),0,...data.transactions.map(t=>Number(t.id)||0),...data.bills.map(b=>Number(b.id)||0));
const createId=()=>++nextId;
function normalizeBills(){data.bills=(data.bills||[]).map(bill=>({...bill,id:Number.isSafeInteger(Number(bill.id))&&Number(bill.id)>0?Number(bill.id):createId(),paidMonth:bill.paid?(bill.paidMonth||bill.date?.slice(0,7)):bill.paidMonth}));}
normalizeBills();
const currencyLocales = { USD: 'en-US', NGN: 'en-NG', GBP: 'en-GB', EUR: 'de-DE', CAD: 'en-CA', AUD: 'en-AU', INR: 'en-IN', GHS: 'en-GH', KES: 'en-KE', ZAR: 'en-ZA', XOF: 'fr-SN', XAF: 'fr-CM' };
const currencies = [['USD','US dollar'],['NGN','Nigerian naira'],['GBP','British pound'],['EUR','Euro'],['CAD','Canadian dollar'],['AUD','Australian dollar'],['INR','Indian rupee'],['GHS','Ghanaian cedi'],['KES','Kenyan shilling'],['ZAR','South African rand'],['XOF','West African CFA franc'],['XAF','Central African CFA franc']];
const money = n => new Intl.NumberFormat(currencyLocales[data.currency] || 'en-US', { style: 'currency', currency: data.currency || 'USD' }).format(n);
const dateFmt = s => new Date(`${s}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const localDate = (date=new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const currentMonth = () => localDate().slice(0,7);
function nextMonthlyDate(value){const [year,month,day]=value.split('-').map(Number),lastDay=new Date(year,month+1,0).getDate();return localDate(new Date(year,month,Math.min(day,lastDay)));}
function rollRecurringBills(){const month=currentMonth();let changed=false;for(const bill of data.bills){if(bill.paid&&bill.paidMonth&&bill.paidMonth<month){bill.paid=false;changed=true;for(const tx of data.transactions)if(Number(tx.billId)===Number(bill.id))delete tx.billId;}if(bill.date&&bill.date.slice(0,7)<month&&bill.paidMonth&&bill.paidMonth<month){let next=bill.date;while(next.slice(0,7)<month)next=nextMonthlyDate(next);if(next!==bill.date){bill.date=next;changed=true;}}}if(changed)save();}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function save(){
  const snapshot=JSON.stringify(data);
  localStorage.setItem(STORE,snapshot);
  if(currentUser){
    unsyncedSnapshot=snapshot;
    clearTimeout(save.timer);
    save.timer=setTimeout(()=>{
      pendingAccountSave=pendingAccountSave.then(syncAccount).catch(()=>toast('Saved on this device, but account sync failed.'));
    },250);
  }
}
async function syncAccount(){
  const snapshot=unsyncedSnapshot;
  if(snapshot===null)return;
  await api('/api/data',{method:'PUT',body:`{"finance":${snapshot}}`});
  if(unsyncedSnapshot===snapshot)unsyncedSnapshot=null;
}
async function signOut(){
  if(!currentUser||signingOut)return;
  signingOut=true;
  document.body.inert=true;
  clearTimeout(save.timer);
  try{
    await pendingAccountSave;
    if(unsyncedSnapshot!==null)await syncAccount();
    await api('/api/logout',{method:'POST',body:'{}'});
    currentUser=null;
    data=structuredClone(seed);
    localStorage.removeItem(STORE);
    render();
    go('settings');
    toast('Signed out.');
  }catch(error){
    toast(`Could not sign out. ${error.message}`);
  }finally{
    signingOut=false;
    document.body.inert=false;
  }
}
function updateBalance(change){data.balance=Math.round((data.balance+change)*100)/100;}
async function api(path,options={}){
  const response=await fetch(path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Request failed.');return result;
}
async function resizeProfilePhoto(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPG, PNG, or WebP image.');
  if(file.size>5*1024*1024)throw new Error('Choose an image smaller than 5 MB.');
  const image=await createImageBitmap(file),scale=Math.min(1,256/Math.max(image.width,image.height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);image.close?.();
  return canvas.toDataURL('image/jpeg',0.82);
}
const sortTx = () => [...data.transactions].sort((a,b) => b.date.localeCompare(a.date) || b.id-a.id);
const txRow = t => `<div class="table-row"><div class="table-cell person"><span class="person-avatar" style="background:${t.color || '#e5f1ef'}">${t.icon || '•'}</span><span class="person-name">${esc(t.name)}</span></div><div class="table-cell">${esc(t.category)}</div><div class="table-cell">${dateFmt(t.date)}</div><div class="table-cell ${t.amount < 0 ? 'negative' : 'positive'}">${t.amount < 0 ? '−' : '+'}${money(Math.abs(t.amount))}</div><div class="table-cell tx-actions"><button class="row-action" data-action="edit-transaction" data-id="${t.id}" aria-label="Edit ${esc(t.name)}">Edit</button><button class="row-action danger" data-action="delete-transaction" data-id="${t.id}" aria-label="Delete ${esc(t.name)}">Delete</button></div></div>`;
const shell = (eyebrow, title, sub, action='') => `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="subhead">${sub}</p></div>${action}</div>`;
const card = (title, body, action='') => `<article class="card"><div class="card-heading"><h2>${title}</h2>${action}</div>${body}</article>`;
function renderOverview() {
  const monthlyTransactions=data.transactions.filter(t=>t.date?.startsWith(currentMonth()));
  const income = monthlyTransactions.filter(t=>t.amount>0).reduce((a,t)=>a+t.amount,0);
  const spent = monthlyTransactions.filter(t=>t.amount<0).reduce((a,t)=>a-t.amount,0);
  const saved = data.pots.reduce((a,p)=>a+p.saved,0);
  const firstName=(data.account?.name||'there').trim().split(/\s+/)[0];
  const hour=new Date().getHours();
  const greeting=hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';
  const bars = data.budgets.map(b=>`<div class="budget-entry"><div class="budget-head"><span>${b.icon} ${esc(b.name)}</span><b>${money(b.spent)}</b></div><div class="progress"><span style="width:${Math.min(100,b.spent/b.limit*100)}%;background:${b.color}"></span></div><small>${money(Math.max(0,b.limit-b.spent))} left of ${money(b.limit)}</small></div>`).join('');
  const donut = `<div class="donut" style="background:conic-gradient(${data.budgets.map((b,i)=>`${b.color} ${i*360/data.budgets.length}deg ${(i+1)*360/data.budgets.length}deg`).join(',')})"><div class="donut-center"><span>Total saved</span><strong>${money(saved)}</strong><small>across ${data.pots.length} pots</small></div></div>`;
  document.querySelector('#page-overview').innerHTML = shell('YOUR MONEY AT A GLANCE',`${greeting}, ${esc(firstName)} 👋`,'Here’s what’s happening with your money this month.','<button class="primary-btn" data-action="add-transaction">＋ Add transaction</button>') + `<div class="balance-grid"><div class="balance-card dark"><div class="balance-label">Total balance</div><div class="balance-value">${money(data.balance)}</div><div class="balance-change">↑ Looking good</div></div><div class="balance-card"><div class="balance-label">Income this month</div><div class="balance-value">${money(income)}</div><div class="balance-change">Across ${monthlyTransactions.filter(t=>t.amount>0).length} deposits</div></div><div class="balance-card"><div class="balance-label">Spent this month</div><div class="balance-value">${money(spent)}</div><div class="balance-change">${money(Math.max(0,income-spent))} net cash flow</div></div></div><div class="content-grid"><div class="column">${card('Spending by budget',`<div class="budget-rows">${bars}</div>`,'<button class="text-btn" data-page="budgets">See budgets →</button>')}${card('Recent transactions',`<div class="transaction-list">${sortTx().slice(0,5).map(t=>`<div class="transaction-row"><span class="transaction-icon" style="background:${t.color}">${t.icon}</span><div class="transaction-info"><strong>${esc(t.name)}</strong><small>${esc(t.category)} · ${dateFmt(t.date)}</small></div><b class="${t.amount<0?'negative':'positive'}">${t.amount<0?'−':'+'}${money(Math.abs(t.amount))}</b></div>`).join('')}</div>`,'<button class="text-btn" data-page="transactions">View all →</button>')}</div><div class="column">${card('Your savings pots',`<div class="overview-pot">${donut}<div class="pot-mini-list">${data.pots.slice(0,3).map(p=>`<div><span>${p.icon} ${esc(p.name)}</span><b>${money(p.saved)}</b></div>`).join('')}</div></div>`,'<button class="text-btn" data-page="pots">View pots →</button>')}${card('Coming up',`<div class="due-list">${[...data.bills].filter(b=>!b.paid).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3).map(b=>`<div class="due-row"><span class="due-stripe" style="background:${b.color}"></span><div><div class="due-name">${esc(b.name)}</div><div class="due-sub">${esc(b.category)}</div></div><span class="due-date">${dateFmt(b.date)}</span><b class="due-amount">${money(b.amount)}</b></div>`).join('') || '<p class="empty-state">All caught up.</p>'}</div>`,'<button class="text-btn" data-page="bills">All bills →</button>')}</div></div>`;
}
function renderTransactions() {
 const q=(document.querySelector('#tx-search')?.value||'').toLowerCase(), cat=document.querySelector('#tx-category')?.value||'All categories';
 let tx=sortTx().filter(t=>(`${t.name} ${t.category}`.toLowerCase().includes(q))&&(cat==='All categories'||t.category===cat));
 const cats=['All categories',...new Set(data.transactions.map(t=>t.category))];
 const actions='<div class="heading-actions"><button class="secondary-btn" type="button" data-action="export-transactions"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3"/></svg>Export CSV</button><button class="primary-btn" data-action="add-transaction">＋ Add transaction</button></div>';
 document.querySelector('#page-transactions').innerHTML=shell('YOUR ACTIVITY','Transactions','A clear view of where your money goes.',actions)+`<div class="toolbar"><label class="search-wrap"><span>⌕</span><input id="tx-search" placeholder="Search transactions..." value="${esc(q)}"></label><span class="toolbar-label">Filter by</span><select class="select" id="tx-category">${cats.map(c=>`<option ${c===cat?'selected':''}>${esc(c)}</option>`).join('')}</select></div>${card('All transactions',`<div class="table-card"><div class="table-head"><span>TRANSACTION</span><span>CATEGORY</span><span>DATE</span><span>AMOUNT</span><span>ACTIONS</span></div>${tx.map(txRow).join('')||'<div class="empty-state">No transactions match your search.</div>'}</div><div class="pagination">Showing ${tx.length} transaction${tx.length===1?'':'s'}</div>`)}`;
}
function renderReports(){
 const now=new Date();
 const months=Array.from({length:6},(_,index)=>{
   const date=new Date(now.getFullYear(),now.getMonth()-5+index,1);
   const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
   const transactions=data.transactions.filter(tx=>tx.date?.startsWith(key));
   return {label:new Intl.DateTimeFormat('en-US',{month:'short',year:'2-digit'}).format(date),income:transactions.filter(tx=>tx.amount>0).reduce((sum,tx)=>sum+tx.amount,0),spent:transactions.filter(tx=>tx.amount<0).reduce((sum,tx)=>sum+Math.abs(tx.amount),0)};
 });
 const current=months[months.length-1],max=Math.max(1,...months.flatMap(month=>[month.income,month.spent]));
 const totalIncome=months.reduce((sum,month)=>sum+month.income,0),totalSpent=months.reduce((sum,month)=>sum+month.spent,0);
 const hasActivity=months.some(month=>month.income>0||month.spent>0);
 const monthRows=months.map(month=>`<div class="cashflow-month"><strong>${month.label}</strong><div class="cashflow-lines"><div class="cashflow-line"><span>Income</span><i class="cashflow-track"><b class="income-bar" style="width:${month.income/max*100}%"></b></i><b class="cashflow-value">${money(month.income)}</b></div><div class="cashflow-line"><span>Spending</span><i class="cashflow-track"><b class="spending-bar" style="width:${month.spent/max*100}%"></b></i><b class="cashflow-value">${money(month.spent)}</b></div></div></div>`).join('');
 const chartContent=hasActivity?`<div class="cashflow-list">${monthRows}</div>`:'<p class="empty-state cashflow-empty">No transactions recorded in the last six months. Add activity to see your cash flow here.</p>';
 document.querySelector('#page-reports').innerHTML=shell('YOUR FINANCIAL PICTURE','Monthly report','See how income and spending have changed over the last six months.')+`<div class="report-summary"><article class="report-stat"><span>This month’s income</span><strong class="positive">${money(current.income)}</strong><small>Money received</small></article><article class="report-stat"><span>This month’s spending</span><strong>${money(current.spent)}</strong><small>Money spent</small></article><article class="report-stat report-stat-featured"><span>This month’s net cash flow</span><strong>${money(current.income-current.spent)}</strong><small>Income minus spending</small></article></div><article class="card cashflow-card"><div class="cashflow-heading"><div><p class="eyebrow">SIX-MONTH OVERVIEW</p><h2>Income and spending</h2></div><div class="cashflow-legend"><span><i class="income-key"></i>Income</span><span><i class="spending-key"></i>Spending</span></div></div>${chartContent}<div class="cashflow-totals"><span>Six-month income <strong>${money(totalIncome)}</strong></span><span>Six-month spending <strong>${money(totalSpent)}</strong></span></div></article><p class="report-note">Reports use transactions recorded in FinWise. Months with no recorded activity show zero totals.</p>`;
}
function exportTransactions(){
 const csvCell=value=>`"${String(value??'').replace(/"/g,'""')}"`;
 const header=['Date','Description','Category','Type',`Amount (${data.currency})`];
 const rows=sortTx().map(tx=>[tx.date,tx.name,tx.category,tx.amount<0?'Expense':'Income',`${tx.amount<0?'-':''}${Math.abs(tx.amount).toFixed(2)}`]);
 const csv='\ufeff'+[header,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=`finwise-transactions-${localDate()}.csv`;link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);toast(`${rows.length} transaction${rows.length===1?'':'s'} exported.`);
}
function renderBudgets(){
 const total=data.budgets.reduce((a,b)=>a+b.limit,0), spent=data.budgets.reduce((a,b)=>a+b.spent,0);
 const list=data.budgets.map((b,i)=>`<article class="budget-full card"><div class="budget-full-title"><h3><i style="background:${b.color}"></i>${b.icon} ${esc(b.name)}</h3><button class="more" data-action="delete-budget" data-index="${i}" aria-label="Delete ${esc(b.name)}">×</button></div><p>You’ve used ${Math.min(100,Math.round(b.spent/b.limit*100))}% of your monthly budget.</p><div class="progress"><span style="width:${Math.min(100,b.spent/b.limit*100)}%;background:${b.color}"></span></div><div class="budget-full-stats"><div>Spent<strong>${money(b.spent)}</strong></div><div>Monthly limit<strong>${money(b.limit)}</strong></div><div>Remaining<strong>${money(Math.max(0,b.limit-b.spent))}</strong></div></div></article>`).join('');
 document.querySelector('#page-budgets').innerHTML=shell('PLAN WITH PURPOSE','Your budgets','Small plans make a big difference.','<button class="primary-btn" data-action="add-budget">＋ New budget</button>')+`<div class="balance-grid"><div class="balance-card dark"><div class="balance-label">Total budget</div><div class="balance-value">${money(total)}</div><div class="balance-change">Across ${data.budgets.length} categories</div></div><div class="balance-card"><div class="balance-label">Spent so far</div><div class="balance-value">${money(spent)}</div><div class="balance-change">${Math.round(spent/Math.max(1,total)*100)}% of planned spend</div></div><div class="balance-card"><div class="balance-label">Still available</div><div class="balance-value">${money(Math.max(0,total-spent))}</div><div class="balance-change">Keep your momentum going</div></div></div><div class="budget-layout"><article class="card budget-spend-card"><h2>Budget overview</h2><div class="donut" style="background:conic-gradient(${data.budgets.map((b,i)=>`${b.color} ${i*360/Math.max(1,data.budgets.length)}deg ${(i+1)*360/Math.max(1,data.budgets.length)}deg`).join(',')})"><div class="donut-center"><span>Spent</span><strong>${money(spent)}</strong><small>of ${money(total)}</small></div></div><div class="legend">${data.budgets.map(b=>`<div class="legend-item"><i style="background:${b.color}"></i>${esc(b.name)}</div>`).join('')}</div></article><div class="budget-full-list">${list||'<div class="empty-state">Add a budget to start planning.</div>'}</div></div>`;
}
function renderPots(){ const total=data.pots.reduce((a,p)=>a+p.saved,0),target=data.pots.reduce((a,p)=>a+p.target,0); document.querySelector('#page-pots').innerHTML=shell('SAVE FOR WHAT MATTERS','Your pots','Give your goals a place to grow.','<button class="primary-btn" data-action="add-pot">＋ Create a pot</button>')+`<div class="pots-summary"><div class="pot-summary-item"><span>Total saved</span><strong>${money(total)}</strong></div><div class="pot-summary-item"><span>Across all targets</span><strong>${money(target)}</strong></div></div><div class="pot-page-grid">${data.pots.map((p,i)=>`<article class="card pot-card"><div class="pot-card-title"><div><span class="pot-emoji" style="background:${p.color}">${p.icon}</span><h3>${esc(p.name)}</h3></div><button class="more" data-action="delete-pot" data-index="${i}" aria-label="Delete ${esc(p.name)}">×</button></div><p class="pot-card-note">${esc(p.note||'Every little bit adds up.')}</p><div class="progress"><span style="width:${Math.min(100,p.saved/p.target*100)}%;background:var(--green)"></span></div><div class="pot-saved-box"><div><span>Saved so far</span><br><strong>${money(p.saved)}</strong></div><div class="pot-target">Target<br><b>${money(p.target)}</b></div></div><div class="pot-actions"><button data-action="pot-add" data-index="${i}">＋ Add money</button><button data-action="pot-take" data-index="${i}">↗ Withdraw</button></div></article>`).join('')||'<div class="empty-state">Create your first savings pot.</div>'}</div>`; }
function renderBills(){ const sum=data.bills.reduce((a,b)=>a+b.amount,0), paid=data.bills.filter(b=>b.paid&&(!b.paidMonth||b.paidMonth===currentMonth())).reduce((a,b)=>a+b.amount,0), next=[...data.bills].filter(b=>!b.paid).sort((a,b)=>a.date.localeCompare(b.date))[0]; document.querySelector('#page-bills').innerHTML=shell('STAY ONE STEP AHEAD','Recurring bills','Your regular payments, all in one place.','<button class="primary-btn" data-action="add-bill">＋ Add a bill</button>')+`<div class="bills-top"><div class="bill-stat featured"><span class="stat-icon">▤</span><span>Monthly total</span><strong>${money(sum)}</strong><small>Across ${data.bills.length} regular bills</small></div><div class="bill-stat"><span class="stat-icon">✓</span><span>Paid this month</span><strong>${money(paid)}</strong><small>Nice work keeping on top of things</small></div><div class="bill-stat"><span class="stat-icon">◷</span><span>Next payment</span><strong>${next?money(next.amount):money(0)}</strong><small>${next?`${esc(next.name)} · ${dateFmt(next.date)}`:'No upcoming payments'}</small></div></div>${card('Your regular payments',`<div class="due-list">${[...data.bills].sort((a,b)=>a.date.localeCompare(b.date)).map(b=>`<div class="due-row"><span class="due-stripe" style="background:${b.color}"></span><div><div class="due-name">${esc(b.name)}</div><div class="due-sub">${esc(b.category)} · Monthly</div></div><span class="due-date">${dateFmt(b.date)}</span><b class="due-amount">${money(b.amount)}</b><button type="button" class="status ${b.paid?'':'due'}" data-action="toggle-bill" data-id="${b.id}">${b.paid?'Paid':'Mark paid'}</button><button class="more" data-action="delete-bill" data-id="${b.id}" aria-label="Delete ${esc(b.name)}">×</button></div>`).join('')||'<div class="empty-state">No bills yet. Add one to keep track of regular payments.</div>'}</div>`)}`; }
function renderSettings(){
 const account=data.account||seed.account;
 const initials=(account.name||'JD').split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase();
 const photoCard=`<article class="card settings-card"><h2>Profile picture</h2><p>Choose a photo to personalize your FinWise profile.</p><div class="profile-photo-settings"><div class="profile-preview">${account.photo?`<img src="${esc(account.photo)}" alt="Profile picture">`:initials}</div><div class="photo-controls"><button class="primary-btn photo-button" id="change-profile-photo" type="button">Choose a photo</button>${account.photo?'<button class="text-btn" data-action="remove-photo" type="button">Remove photo</button>':''}<input id="profile-photo-input" type="file" accept="image/png,image/jpeg,image/webp" hidden><small>PNG, JPG, or WebP. The image is resized before it is saved.</small></div></div></article>`;
 const themeCard=`<article class="card settings-card"><h2>Theme</h2><p>Choose the appearance that feels comfortable for you.</p><label class="field"><span>App theme</span><select id="theme-setting"><option value="light" ${data.theme!=='dark'?'selected':''}>Light</option><option value="dark" ${data.theme==='dark'?'selected':''}>Dark</option></select></label></article>`;
 const accountCard=isHostedPreview?`<article class="card settings-card"><h2>Hosted preview</h2><p>This is a sample version of FinWise. Changes are saved in this browser only, and are not sent to a server.</p><p class="local-account-note">To create an account and sync data, run FinWise on your own computer with <code>npm start</code>.</p></article>`:currentUser?`<article class="card settings-card"><h2>Your account</h2><p>You are signed in as ${esc(currentUser.email)}. Your finance data syncs to this local server account.</p><div class="currency-preview">Profile name: <strong>${esc(currentUser.name)}</strong></div><button class="primary-btn signout-btn" type="button" data-action="logout">Sign out</button></article>`:`<article class="card settings-card"><h2>Create your account</h2><p>Your password is protected by the server. Your finance data will be saved under this account.</p><form id="signup-form">${inp('name','Full name','text',account.name)}${inp('email','Email address','email','you@example.com')}<div class="field"><label for="signup-password">Password</label><input id="signup-password" name="password" type="password" minlength="8" autocomplete="new-password" placeholder="At least 8 characters" required></div><div class="field"><label for="signup-confirm">Confirm password</label><input id="signup-confirm" name="confirm" type="password" minlength="8" autocomplete="new-password" placeholder="Type your password again" required></div><p class="local-account-note">Use at least 8 characters. Your password is sent only to this computer’s local app server and is stored there as a one-way hash.</p><button class="primary-btn" type="submit">Create account</button></form></article><article class="card settings-card"><h2>Already signed up?</h2><p>Sign in to load your saved profile and finance data.</p><form id="login-form">${inp('email','Email address','email','you@example.com')}<div class="field"><label for="login-password">Password</label><input id="login-password" name="password" type="password" autocomplete="current-password" required></div><button class="primary-btn" type="submit">Sign in</button></form></article>`;
 document.querySelector('#page-settings').innerHTML=shell('MAKE FINWISE YOURS','Settings','Choose how FinWise looks and manage your account.')+`<div class="settings-grid"><article class="card settings-card"><h2>Currency</h2><p>Choose the currency you want to see throughout FinWise. New users start with US dollars.</p><label class="field"><span>Display currency</span><select id="currency-setting">${currencies.map(([code,label])=>`<option value="${code}" ${data.currency===code?'selected':''}>${label} (${code})</option>`).join('')}</select></label><div class="currency-preview">Example: <strong>${money(1234.56)}</strong></div><p class="local-account-note">Changing this setting changes the currency label and number format. It does not convert existing amounts.</p></article>${themeCard}${photoCard}${accountCard}</div>`;
}
const renderers={overview:renderOverview,transactions:renderTransactions,reports:renderReports,budgets:renderBudgets,pots:renderPots,bills:renderBills,settings:renderSettings};
function render(){document.querySelector('#header-signout').hidden=!currentUser;Object.values(renderers).forEach(fn=>fn());const account=data.account||seed.account;document.documentElement.dataset.theme=data.theme==='dark'?'dark':'light';document.querySelector('.user-name').textContent=account.name;const avatar=document.querySelector('.avatar');avatar.textContent=account.photo?'':account.name.split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase();avatar.style.backgroundImage=account.photo?`url("${account.photo}")`:'';renderNotifications();}
function go(page){ if(!renderers[page])return; document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===`page-${page}`)); document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page)); document.querySelector('#crumb').textContent=page==='bills'?'Recurring bills':page[0].toUpperCase()+page.slice(1); document.querySelector('#sidebar').classList.remove('mobile-open');closeNotifications(); }
function toast(msg){const el=document.querySelector('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2600);}
function buildNotifications(){
 const today=new Date(`${localDate()}T00:00:00`),items=[];
 data.bills.filter(b=>!b.paid).forEach(b=>{const due=new Date(`${b.date}T00:00:00`),days=Math.round((due-today)/86400000);if(days<0)items.push({page:'bills',title:`${b.name} is overdue`,detail:`Was due ${dateFmt(b.date)} · ${money(b.amount)}`,priority:0});else if(days<=7)items.push({page:'bills',title:days===0?`${b.name} is due today`:`${b.name} is due in ${days} day${days===1?'':'s'}`,detail:`${dateFmt(b.date)} · ${money(b.amount)}`,priority:days+1});});
 data.budgets.filter(b=>b.limit>0&&b.spent/b.limit>=.8).forEach(b=>{const over=b.spent>b.limit;items.push({page:'budgets',title:over?`${b.name} budget exceeded`:`${b.name} budget is nearly used`,detail:`${money(b.spent)} spent of ${money(b.limit)}`,priority:over?-1:20});});
 return items.sort((a,b)=>a.priority-b.priority);
}
function renderNotifications(){
 const panel=document.querySelector('#notificationsPanel'),button=document.querySelector('.icon-button');if(!panel||!button)return;
 const items=buildNotifications();button.setAttribute('aria-label',items.length?`${items.length} notifications`:'No new notifications');panel.innerHTML=`<div class="notifications-heading"><h2>Notifications</h2><span>${items.length}</span></div>${items.length?`<div class="notification-list">${items.map(item=>`<button class="notification-item" data-page="${item.page}"><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></button>`).join('')}</div>`:'<p class="notifications-empty">You’re all caught up. No bills are due soon and your budgets are on track.</p>'}`;
 const badge=button.querySelector('i');if(badge)badge.hidden=!items.length;
}
function closeNotifications(){const panel=document.querySelector('#notificationsPanel'),button=document.querySelector('.icon-button');if(panel)panel.hidden=true;if(button)button.setAttribute('aria-expanded','false');}
function openModal(title,desc,fields,onSave){const dlg=document.querySelector('#modal');dlg.innerHTML=`<form method="dialog" class="modal-content" id="active-form"><button class="modal-close" type="button" aria-label="Close">×</button><h2>${title}</h2><p>${desc}</p>${fields}<button class="primary-btn modal-submit" type="submit">Save</button></form>`;dlg.showModal();dlg.querySelector('.modal-close').onclick=()=>dlg.close();dlg.querySelector('form').onsubmit=e=>{e.preventDefault();const form=new FormData(e.currentTarget);if(onSave(form)){dlg.close();save();render();toast('Your changes are saved.');}};}
const inp=(name,label,type='text',placeholder='',required=true)=>`<div class="field"><label>${label}</label><input name="${name}" type="${type}" placeholder="${placeholder}" ${required?'required':''} ${type==='number'?'min="0.01" step="0.01"':''}></div>`;
const select=(name,label,opts)=>`<div class="field"><label>${label}</label><select name="${name}">${opts.map(x=>`<option>${x}</option>`).join('')}</select></div>`;
function formAction(action,index){
 if(action==='export-transactions'){exportTransactions();return;}
 if(action==='remove-photo'){data.account={...(data.account||seed.account),photo:''};save();render();go('settings');toast('Profile picture removed.');return;}
 if(action==='logout'){void signOut();return;}
 if(action==='add-transaction')openModal('Add transaction','Keep your activity up to date.',inp('name','Description','text','e.g. Coffee shop')+select('category','Category',['Groceries','Dining out','Shopping','Transport','Bills','Health','Entertainment','Income','Other'])+inp('amount','Amount','number','0.00')+select('type','Type',['Expense','Income'])+inp('date','Date','date',localDate()),f=>{const amount=Number(f.get('amount'));if(!amount)return false;const income=f.get('type')==='Income';data.transactions.push({id:createId(),name:f.get('name').trim(),category:f.get('category'),date:f.get('date'),amount:income?amount:-amount,icon:income?'↗':'•',color:income?'#e5f1ef':'#f5eadc'});updateBalance(income?amount:-amount);const b=data.budgets.find(b=>b.name===f.get('category'));if(b&&!income&&f.get('date').startsWith(currentMonth()))b.spent+=amount;return true;});
 if(action==='add-budget')openModal('Create a budget','Choose a category and set a monthly limit.',inp('name','Budget name')+inp('limit','Monthly limit','number','0.00')+select('color','Color',['#277c78','#dd8c57','#8265a7','#5b8db8','#d7749a']),f=>{const name=f.get('name').trim(),limit=Number(f.get('limit'));if(!limit)return false;if(data.budgets.some(b=>b.name.toLowerCase()===name.toLowerCase())){toast('A budget with that name already exists.');return false;}data.budgets.push({name,limit,spent:0,color:f.get('color'),icon:'◈'});return true;});
 if(action==='add-pot')openModal('Create a savings pot','Name a goal and decide how much you want to save.',inp('name','Pot name')+inp('target','Savings target','number','0.00')+inp('note','A note (optional)','text','What are you saving for?',false),f=>{const target=Number(f.get('target'));if(!target)return false;data.pots.push({name:f.get('name').trim(),saved:0,target,icon:'✦',color:'#e5f1ef',note:f.get('note')});return true;});
 if(action==='add-bill')openModal('Add a recurring bill','Keep an eye on regular payments.',inp('name','Bill name')+select('category','Category',['Home','Utilities','Subscriptions','Transport','Insurance','Other'])+inp('amount','Amount','number','0.00')+inp('date','Next due date','date',localDate()),f=>{const amount=Number(f.get('amount'));if(!amount)return false;data.bills.push({id:createId(),name:f.get('name').trim(),category:f.get('category'),amount,date:f.get('date'),icon:'▤',color:'#e5f1ef',paid:false});return true;});
 if(action==='pot-add'||action==='pot-take'){const p=data.pots[index];if(!p)return;const adding=action==='pot-add';openModal(adding?'Add to your pot':'Withdraw from your pot',`${esc(p.name)} · current balance ${money(p.saved)}`,inp('amount','Amount','number','0.00'),f=>{const amount=Number(f.get('amount'));if(!amount)return false;if(!adding&&amount>p.saved){toast('That amount is more than the pot balance.');return false;}p.saved+=adding?amount:-amount;updateBalance(adding?-amount:amount);return true;});}
 if(action==='delete-budget'||action==='delete-pot'){const key=action.split('-')[1],arr=data[key==='budget'?'budgets':'pots'];if(arr?.[index]&&confirm(`Remove ${arr[index].name}?`)){arr.splice(index,1);save();render();toast('Item removed.');}}
 if(action==='delete-bill'){const billIndex=data.bills.findIndex(b=>Number(b.id)===Number(index));const bill=data.bills[billIndex];if(bill&&confirm(`Remove ${bill.name} from recurring bills?`)){data.bills.splice(billIndex,1);save();render();toast('Bill removed.');}}
 if(action==='toggle-bill'){
   const bill=data.bills.find(b=>Number(b.id)===Number(index));if(!bill)return;
   bill.paid=!bill.paid;bill.paidMonth=bill.paid?currentMonth():'';
   const payment=data.transactions.find(t=>Number(t.billId)===Number(bill.id));
   if(bill.paid&&!payment){data.transactions.push({id:createId(),billId:bill.id,name:bill.name,category:'Bills',date:localDate(),amount:-bill.amount,icon:'▤',color:bill.color});applyTransactionEffect(data.transactions[data.transactions.length-1],1);}
   else if(!bill.paid&&payment){applyTransactionEffect(payment,-1);data.transactions=data.transactions.filter(t=>t!==payment);}
   save();render();toast(bill.paid?'Payment recorded and marked paid.':'Payment marked upcoming.');
 }
 if(action==='edit-transaction'||action==='delete-transaction'){
   const id=Number(index),tx=data.transactions.find(t=>t.id===id);if(!tx)return;
   if(action==='delete-transaction'){if(!confirm(`Remove the transaction “${tx.name}”?`))return;applyTransactionEffect(tx,-1);if(tx.billId){const bill=data.bills.find(b=>Number(b.id)===Number(tx.billId));if(bill){bill.paid=false;bill.paidMonth='';}}data.transactions=data.transactions.filter(t=>t.id!==id);save();render();toast('Transaction removed.');return;}
   const original={...tx};
   openModal('Edit transaction','Update the details below.',inp('name','Description','text',tx.name)+select('category','Category',['Groceries','Dining out','Shopping','Transport','Bills','Health','Entertainment','Income','Other'])+inp('amount','Amount','number',Math.abs(tx.amount).toFixed(2))+select('type','Type',['Expense','Income'])+inp('date','Date','date',tx.date),f=>{const amount=Number(f.get('amount'));if(!amount)return false;applyTransactionEffect(original,-1);tx.name=f.get('name').trim();tx.category=f.get('category');tx.date=f.get('date');tx.amount=f.get('type')==='Income'?amount:-amount;applyTransactionEffect(tx,1);return true;});
   const form=document.querySelector('#active-form');form.elements.category.value=tx.category;form.elements.type.value=tx.amount>0?'Income':'Expense';
 }
}
function applyTransactionEffect(tx,direction){updateBalance(tx.amount*direction);if(tx.amount<0&&tx.date?.startsWith(currentMonth())){const budget=data.budgets.find(b=>b.name===tx.category);if(budget)budget.spent=Math.max(0,budget.spent+Math.abs(tx.amount)*direction);}}
document.addEventListener('click',e=>{const nav=e.target.closest('[data-page]');if(nav){go(nav.dataset.page);return;}const act=e.target.closest('[data-action]');if(act)formAction(act.dataset.action,Number(act.dataset.id??act.dataset.index));});
document.addEventListener('input',e=>{if(e.target.id==='tx-search'){const input=e.target,pos=input.selectionStart;renderTransactions();const next=document.querySelector('#tx-search');next.focus();next.setSelectionRange(pos,pos);}});
document.addEventListener('change',e=>{if(e.target.id==='tx-category')renderTransactions();});
document.addEventListener('change',e=>{if(e.target.id==='currency-setting'){data.currency=e.target.value;save();render();go('settings');toast('Currency preference saved.');}});
document.addEventListener('change',e=>{if(e.target.id==='theme-setting'){data.theme=e.target.value;save();render();go('settings');toast(`${e.target.value==='dark'?'Dark':'Light'} theme saved.`);}});
document.addEventListener('click',e=>{if(e.target.closest('#change-profile-photo'))document.querySelector('#profile-photo-input')?.click();});
document.addEventListener('change',async e=>{if(e.target.id!=='profile-photo-input'||!e.target.files?.[0])return;const owner=currentUser;try{const photo=await resizeProfilePhoto(e.target.files[0]);if(signingOut||currentUser!==owner)return;data.account={...(data.account||seed.account),photo};save();render();go('settings');toast('Profile picture saved.');}catch(error){toast(error.message||'Could not load that image.');}});
document.addEventListener('submit',async e=>{
 const form=e.target;if(!['signup-form','login-form'].includes(form.id))return;e.preventDefault();const f=new FormData(form);
 try{
  let result;
  if(form.id==='signup-form'){
   if(f.get('password')!==f.get('confirm'))throw new Error('The passwords do not match.');
   result=await api('/api/signup',{method:'POST',body:JSON.stringify({name:f.get('name').trim(),email:f.get('email').trim(),password:f.get('password'),finance:data})});
  }else result=await api('/api/login',{method:'POST',body:JSON.stringify({email:f.get('email').trim(),password:f.get('password')})});
  currentUser=result.user;data={...seed,...result.finance,account:{...(result.finance.account||{}),name:currentUser.name,email:currentUser.email}};normalizeBills();localStorage.setItem(STORE,JSON.stringify(data));render();go('overview');toast(form.id==='signup-form'?'Account created and saved on this computer.':'Signed in. Your saved data is loaded.');
 }catch(error){toast(error.message.includes('Failed to fetch')?'Start FinWise with npm start, then open http://localhost:3000.':error.message);}
});
document.querySelector('#collapseBtn').addEventListener('click',()=>document.querySelector('#sidebar').classList.toggle('collapsed'));
document.querySelector('#mobileMenu').addEventListener('click',()=>document.querySelector('#sidebar').classList.toggle('mobile-open'));
document.querySelector('.icon-button').addEventListener('click',e=>{e.stopPropagation();const panel=document.querySelector('#notificationsPanel'),button=e.currentTarget;panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));});
document.addEventListener('click',e=>{if(!e.target.closest('.notification-wrap'))closeNotifications();});
document.querySelector('.chevron').addEventListener('click',()=>go('settings'));
document.querySelector('#modal').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close();});
async function startApp(){try{const session=await api('/api/session');if(session.user){currentUser=session.user;data={...seed,...session.finance,account:{...(session.finance.account||{}),name:currentUser.name,email:currentUser.email}};normalizeBills();localStorage.setItem(STORE,JSON.stringify(data));}}catch{}rollRecurringBills();render();go('overview');}
startApp();


