
const KEY_CUSTOMERS = 'hime_customers';
const KEY_SELECTED = 'hime_selected';

const elNew = () => document.getElementById('newCustomer');
const elAdd = () => document.getElementById('addCustomer');
const elList = () => document.getElementById('customerList');
const elMsg  = () => document.getElementById('message');
const elRemain = () => document.getElementById('freeRemaining');
const elCount = () => document.getElementById('regCount');

const defaultMessage = '今日はありがとう♥{name}さんが来てくれてホント助かった😅また週末にでもさっきのお話の続き聞きたいな✨次は金曜日出勤してるから、もし{name}さんの都合が良かったらやけど来てくれると嬉しいな(,,>᎑<,,)待ってるね♥♡♥';

document.addEventListener('DOMContentLoaded', () => {
  const pageHasList = !!elList();
  if (pageHasList) {
    elMsg().value = defaultMessage.replaceAll('{name}','{name}');
    loadAndRender();
    elAdd().addEventListener('click', onAdd);
    document.getElementById('insertName').addEventListener('click', () => insertAtCursor(elMsg(), '{name}'));
    document.getElementById('shareBtn').addEventListener('click', shareToLine);
  }
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) loginBtn.addEventListener('click', () => alert('現在テスト版のため、ログインは無効です。'));
});

function loadCustomers(){
  try{ return JSON.parse(localStorage.getItem(KEY_CUSTOMERS) || '[]'); }
  catch(e){ return []; }
}
function saveCustomers(list){ localStorage.setItem(KEY_CUSTOMERS, JSON.stringify(list)); }

function loadAndRender(){
  const list = loadCustomers();
  const selected = localStorage.getItem(KEY_SELECTED) || '';
  const ul = elList();
  ul.innerHTML = '';
  list.forEach(name => {
    const li = document.createElement('li');
    li.className = 'row between' + (selected===name ? ' selected' : '');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'name';
    nameSpan.textContent = name;
    const btnRow = document.createElement('div');
    btnRow.className = 'row';
    const choose = document.createElement('button');
    choose.className = 'select-btn';
    choose.textContent = '選ぶ';
    choose.addEventListener('click', () => selectCustomer(name));
    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.textContent = '削除';
    del.addEventListener('click', () => deleteCustomer(name));
    btnRow.append(choose, del);
    li.append(nameSpan, btnRow);
    ul.append(li);
  });
  updateCounts(list.length);
}

function selectCustomer(name){
  localStorage.setItem(KEY_SELECTED, name);
  const msg = elMsg();
  if (msg) {
    const current = msg.value || defaultMessage;
    msg.value = current.replaceAll('{name}', name);
  }
  loadAndRender();
}

function deleteCustomer(name){
  const list = loadCustomers().filter(n => n !== name);
  saveCustomers(list);
  const selected = localStorage.getItem(KEY_SELECTED);
  if (selected === name) localStorage.removeItem(KEY_SELECTED);
  loadAndRender();
}

function onAdd(){
  const value = (elNew().value || '').trim();
  if (!value) return;
  const list = loadCustomers();
  if (list.length >= 5) { alert('無料枠の上限に達しました'); return; }
  list.push(value);
  saveCustomers(list);
  elNew().value='';
  loadAndRender();
}

function updateCounts(count){
  const remain = Math.max(0, 5 - count);
  elRemain().textContent = `無料版：残り ${remain} 件`;
  elCount().textContent = `登録数：${count}件`;
}

function insertAtCursor(field, text){
  const start = field.selectionStart;
  const end = field.selectionEnd;
  const val = field.value;
  field.value = val.slice(0, start) + text + val.slice(end);
  const pos = start + text.length;
  field.selectionStart = field.selectionEnd = pos;
  field.focus();
}

function shareToLine(){
  const msg = elMsg().value || '';
  const url = 'https://line.me/R/share?text=' + encodeURIComponent(msg);
  window.open(url, '_blank');
}
