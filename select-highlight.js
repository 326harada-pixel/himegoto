/*! himegoto add-on: select highlight (build019) */
(function(){
  const CSS_LINK = 'select-highlight.css';
  function ensureCSS(){
    if (![...document.styleSheets].some(s=>s.href&&s.href.includes(CSS_LINK))){
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href=CSS_LINK;
      document.head.appendChild(link);
    }
  }
  function isPickButton(el){
    if(!el) return false;
    const t = (el.innerText||'').trim();
    return el.tagName==='BUTTON' && (t.includes('選ぶ') || t.includes('選択中'));
  }
  function clearSelection(){
    document.querySelectorAll('button.is-selected,[aria-pressed="true"]').forEach(b=>{
      b.classList.remove('is-selected');
      b.setAttribute('aria-pressed','false');
    });
    document.querySelectorAll('.row-selected').forEach(row=>row.classList.remove('row-selected'));
  }
  function markRow(btn){
    let row = btn.closest('.customer-row, .customer, li, .row, .card') || btn.parentElement;
    if (row) row.classList.add('row-selected');
  }
  function onPick(btn){
    clearSelection();
    btn.classList.add('is-selected');
    btn.setAttribute('aria-pressed','true');
    markRow(btn);
  }
  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if (isPickButton(btn)){
      try { onPick(btn); } catch(_){}
    }
  }, true);
  function initSelection(){
    ensureCSS();
    const pre = [...document.querySelectorAll('button')].find(b=>{
      const t=(b.innerText||'').trim();
      return t.includes('選択中');
    });
    if (pre) onPick(pre);
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initSelection);
  } else {
    initSelection();
  }
  let tries=0;
  const id=setInterval(()=>{
    tries++;
    if (tries>20) return clearInterval(id);
    if ([...document.querySelectorAll('button')].some(b=>(b.innerText||'').includes('選ぶ'))){
      initSelection();
      clearInterval(id);
    }
  }, 250);
})();
