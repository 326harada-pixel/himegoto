// himegoto app core (ver 1.25β)
const LS_KEY = 'hime_customers_v3';

function $(q, el=document){return el.querySelector(q)}
function $all(q, el=document){return [...el.querySelectorAll(q)]}

const state = {
  customers: [],
  selected: null,
  freeLimit: 5,
};

function load(){
  try{
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    state.customers = saved;
  }catch(e){ state.customers = [] }
  render();
}
function save(){
  localStorage.setItem(LS_KEY, JSON.stringify(state.customers));
}

function addCustomer(){
  const input = $('#newName');
  const name = (input.value || '').trim();
  if(!name) return alert('名前を入れてください');
  if(state.customers.length >= state.freeLimit){
    alert('無料枠に達しました');
    return;
  }
  if(state.customers.includes(name)){
    alert('同じ名前が既にあります');
    return;
  }
  state.customers.push(name);
  input.value='';
  save();
  render();
}

function delCustomer(name){
  if(!confirm(`${name} を削除しますか？`)) return;
  state.customers = state.customers.filter(n=>n!==name);
  if(state.selected===name){ state.selected=null; }
  save();
  render();
}

function selectCustomer(name){
  state.selected = name;
  // 注入
  const ta = $('#message');
  if(ta){
    // 置換はボタン押下時（共有時）に任せるため即時はしない。
  }
  render();
}

function insertName(){
  const ta = $('#message');
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const before = ta.value.slice(0,start);
  const after = ta.value.slice(end);
  ta.value = before + '{name}' + after;
  ta.focus();
  ta.selectionStart = ta.selectionEnd = start + 6;
}

function shareToLine(){
  const ta = $('#message');
  let text = ta.value;
  if(state.selected){
    text = text.replaceAll('{name}', state.selected);
  }
  // LINE共有スキーム
  const url = 'https://line.me/R/msg/text/?' + encodeURIComponent(text);
  window.open(url, '_blank');
}

function recomputeCounters(){
  const remain = Math.max(0, state.freeLimit - state.customers.length);
  $('#freeRemain').textContent = `無料版：残り ${remain} 件`;
  $('#regCount').textContent = `登録数：${state.customers.length}件`;
}

function render(){
  // 顧客リスト
  const list = $('#customerList');
  list.innerHTML='';
  state.customers.forEach(n=>{
    const row = document.createElement('div');
    row.className = 'customer-row' + (state.selected===n ? ' selected' : '');
    const name = document.createElement('div');
    name.textContent = n;
    const actions = document.createElement('div');
    actions.className='customer-actions';
    const sel = document.createElement('button');
    sel.className='btn outline select-btn';
    sel.textContent = '選ぶ';
    sel.onclick=()=>selectCustomer(n);
    const del = document.createElement('button');
    del.className='btn gray';
    del.textContent = '削除';
    del.style.background='#f25f5f'; del.style.color='#fff';
    del.onclick=()=>delCustomer(n);
    actions.appendChild(sel); actions.appendChild(del);
    row.appendChild(name); row.appendChild(actions);
    list.appendChild(row);
  });
  recomputeCounters();
}

document.addEventListener('DOMContentLoaded', ()=>{
  // 既定文面
  const ta = $('#message');
  if(ta && !localStorage.getItem('hime_default_set_125b')){
    ta.value = '今日はありがとう♥{name}さんが来てくれてホント助かった😅また週末にでもさっきのお話の続き聞きたいな✨次は金曜日出勤してるから、もし{name}さんの都合が良かったらやけど来てくれると嬉しいな(,,>᎑<,,)待ってるね♥♡♥';
    localStorage.setItem('hime_default_set_125b','1');
  }
  load();
  // 追加
  $('#addBtn')?.addEventListener('click', addCustomer);
  $('#insertName')?.addEventListener('click', insertName);
  $('#shareBtn')?.addEventListener('click', shareToLine);
});