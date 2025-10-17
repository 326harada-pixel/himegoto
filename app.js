// state
const $ = (s, p=document)=>p.querySelector(s);
const $$ = (s, p=document)=>Array.from(p.querySelectorAll(s));

const state = {
  customers: JSON.parse(localStorage.getItem('customers')||'["田中","山田"]'),
  selected: localStorage.getItem('selected') || null,
  freeLeft: parseInt(localStorage.getItem('freeLeft')||'5',10),
  sendLeft: parseInt(localStorage.getItem('sendLeft')||'5',10),
};

function save(){
  localStorage.setItem('customers', JSON.stringify(state.customers));
  if(state.selected) localStorage.setItem('selected', state.selected); else localStorage.removeItem('selected');
  localStorage.setItem('freeLeft', String(state.freeLeft));
  localStorage.setItem('sendLeft', String(state.sendLeft));
}

function renderCustomers(){
  const wrap = $('#customer-list');
  wrap.innerHTML='';
  state.customers.forEach(name=>{
    const row = document.createElement('div');
    row.className = 'cust-row' + (state.selected===name ? ' selected' : '');
    row.dataset.name = name;
    row.innerHTML = `
      <span class="cust-name">${name}</span>
      <div class="cust-actions">
        <button class="btn btn-ghost choose">選ぶ</button>
        <button class="btn del remove">削除</button>
      </div>`;
    wrap.appendChild(row);
  });
}

function selectCustomer(name){
  state.selected = name;
  save();
  renderCustomers();
  replaceNameInTextarea();
}

function replaceNameInTextarea(){
  const t = $('#msg-template');
  if(!t) return;
  const name = state.selected || '{name}';
  // no automatic overwrite; just preview replacement on share
}

// events
document.addEventListener('click', (e)=>{
  // choose
  if(e.target.closest('.choose')){
    const row = e.target.closest('.cust-row');
    const name = row?.dataset.name;
    if(name) selectCustomer(name);
  }
  // remove
  if(e.target.closest('.remove')){
    const row = e.target.closest('.cust-row');
    const name = row?.dataset.name;
    if(name){
      state.customers = state.customers.filter(n=>n!==name);
      if(state.selected===name) state.selected = null;
      save(); renderCustomers();
    }
  }
  if(e.target.id==='btn-insert-name'){
    const t = $('#msg-template');
    const ins = state.selected || '{name}';
    const pos = t.selectionStart ?? t.value.length;
    t.value = t.value.slice(0,pos) + ins + t.value.slice(pos);
    t.focus();
  }
  if(e.target.id==='btn-share'){
    const name = state.selected || '{name}';
    const text = $('#msg-template').value.replaceAll('{name}', name);
    if(navigator.share){
      navigator.share({text}).catch(()=>{});
    }else{
      prompt('この本文をコピーしてください', text);
    }
  }
  if(e.target.id==='btn-add'){
    const v = $('#name-input').value.trim();
    if(!v) return;
    if(state.freeLeft<=0){ alert('無料枠に達しました'); return; }
    state.customers.push(v);
    state.freeLeft--;
    $('#name-input').value='';
    save(); renderCustomers(); updateMeters();
  }
  if(e.target.id==='btn-login'){
    alert('現在テスト版です。ログインは無効化しています。');
  }
});

function updateMeters(){
  $('#free-left').textContent = state.freeLeft;
  $('#send-left').textContent = state.sendLeft;
}

function init(){
  renderCustomers();
  updateMeters();
}
init();
