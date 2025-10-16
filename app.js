
// build009 app core
const $ = (q)=>document.querySelector(q);
const LS = { CUSTOMERS:'hime_customers', QUOTA:'hime_quota' };

let customers = JSON.parse(localStorage.getItem(LS.CUSTOMERS)||'[]');
let quota = JSON.parse(localStorage.getItem(LS.QUOTA)||'{"add":5,"send":5}');

function save(){ localStorage.setItem(LS.CUSTOMERS, JSON.stringify(customers)); localStorage.setItem(LS.QUOTA, JSON.stringify(quota)); }
function render(){
  $('#free-left').textContent = quota.add;
  $('#send-left').textContent = quota.send;
  const wrap = $('#customer-list');
  wrap.innerHTML = '';
  customers.forEach((n,i)=>{
    const row = document.createElement('div'); row.className='row';
    const span = document.createElement('span'); span.textContent = n; span.style.flex='1';
    const pick = document.createElement('button'); pick.className='btn btn-ghost'; pick.textContent='選ぶ'; pick.onclick=()=>insertName(n);
    const del  = document.createElement('button'); del.className='btn btn-pink'; del.textContent='削除'; del.onclick=()=>{ customers.splice(i,1); save(); render(); };
    row.append(span,pick,del); wrap.appendChild(row);
  });
}
function insertName(name){
  const ta = $('#msg-template');
  const pos = ta.selectionStart ?? ta.value.length;
  const v = ta.value;
  ta.value = v.slice(0,pos) + name + v.slice(pos);
  ta.focus();
}
$('#btn-add').onclick=()=>{
  const v = $('#name-input').value.trim();
  if(!v) return alert('名前を入力してね');
  if(quota.add<=0) return alert('無料枠の上限です');
  customers.push(v); $('#name-input').value=''; quota.add--; save(); render();
};
$('#btn-insert-name').onclick=()=>insertName('{name}');
$('#btn-share').onclick=async()=>{
  if(quota.send<=0) return alert('無料の送信回数が上限です');
  const text = $('#msg-template').value.trim();
  try{
    if(navigator.share){ await navigator.share({text}); }
    else { await navigator.clipboard.writeText(text); alert('本文をコピーしました。LINEに貼り付けてください。'); }
    quota.send--; save(); render();
  }catch(e){ /* cancelled */ }
};

// login button triggers modal in firebase-auth-modal.js
document.getElementById('btn-login').addEventListener('click', ()=>{
  const el = document.getElementById('btn-login');
  el.setAttribute('aria-busy','true');
  window.dispatchEvent(new CustomEvent('hg:request-login'));
});

render();
