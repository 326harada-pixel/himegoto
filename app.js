// himegoto app core (build007)
import './firebase-auth-modal.js';

const $ = (s)=>document.querySelector(s);
const badge = $('#plan-extra');
const freeLeft = $('#free-left');
const sendLeft = $('#send-left');
const nameInput = $('#name-input');
const list = $('#customer-list');
const tpl = $('#msg-template');

let customers = JSON.parse(localStorage.getItem('hime_customers')||'[]');
let quota = JSON.parse(localStorage.getItem('hime_quota')||'{"add":5,"send":5}');

function save(){ localStorage.setItem('hime_customers', JSON.stringify(customers)); }
function render(){
  freeLeft.textContent = quota.add;
  sendLeft.textContent = quota.send;
  list.innerHTML = '';
  customers.forEach((n,i)=>{
    const row = document.createElement('div');
    row.className='row';
    const span=document.createElement('span'); span.textContent=n; span.style.flex='1';
    const pick=document.createElement('button'); pick.className='btn btn-ghost'; pick.textContent='選ぶ';
    pick.onclick=()=> insertName();
    const del=document.createElement('button'); del.className='btn btn-pink'; del.textContent='削除';
    del.onclick=()=>{ customers.splice(i,1); save(); render(); };
    row.append(span,pick,del);
    list.append(row);
  });
}
function insertName(){
  const sel = window.getSelection().toString();
  const name = customers[0] || (nameInput.value||'お客様');
  const t = tpl.value;
  const pos = tpl.selectionStart || t.length;
  tpl.value = t.slice(0,pos) + name + t.slice(pos);
}

$('#btn-add').onclick=()=>{
  const v = nameInput.value.trim();
  if(!v) return alert('名前を入力してください');
  if(quota.add<=0) return alert('無料枠に達しました');
  customers.push(v); save(); quota.add--; localStorage.setItem('hime_quota', JSON.stringify(quota)); nameInput.value=''; render();
};
$('#btn-insert-name').onclick=insertName;
$('#btn-share').onclick=async()=>{
  if(quota.send<=0) return alert('無料の送信回数が残っていません');
  const text = tpl.value;
  if(navigator.share){ await navigator.share({text}); } else { await navigator.clipboard.writeText(text); alert('本文をコピーしました。LINEで貼り付けてください。'); }
  quota.send--; localStorage.setItem('hime_quota', JSON.stringify(quota)); render();
};

// login hook (handled by firebase-auth-modal.js)
document.getElementById('btn-login').addEventListener('click', ()=>{
  window.HimeAuth && window.HimeAuth.open();
});

render();
