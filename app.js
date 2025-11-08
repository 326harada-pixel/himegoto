
/* himegoto app glue (drawer, install, beta notice, backup string) */
(function(){
  const $ = (sel)=>document.querySelector(sel);
  const on = (el,ev,fn)=>el&&el.addEventListener(ev,fn);

  // Drawer
  const drawer = $('#drawer');
  const overlay = $('#drawerOverlay');
  const menuBtn = $('#menuBtn');
  const closeBtn = $('#menuCloseBtn');
  function openDrawer(){
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden','false');
    overlay.hidden = false;
    document.body.style.overflow='hidden';
  }
  function closeDrawer(){
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden','true');
    overlay.hidden = true;
    document.body.style.overflow='';
  }
  on(menuBtn,'click',openDrawer);
  on(closeBtn,'click',closeDrawer);
  on(overlay,'click',closeDrawer);
  on(document,'keydown',e=>{if(e.key==='Escape') closeDrawer();});

  // Install
  let deferredPrompt = null;
  const installBtn = $('#installBtn');
  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault();
    deferredPrompt = e;
    if(installBtn) installBtn.classList.remove('hidden');
  });
  on(installBtn,'click', async ()=>{
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.classList.add('hidden');
  });
  // Hide if already in standalone
  if (window.matchMedia('(display-mode: standalone)').matches) {
    installBtn && installBtn.classList.add('hidden');
  }

  // Beta notice once a day
  try{
    const key='hime_beta_notice_date';
    const today=new Date().toISOString().slice(0,10);
    const last=localStorage.getItem(key);
    if(last!==today){
      alert('現在ベータ版のため、プログラム内部を不定期で編集しています。\n急に使えなくなったり画面が乱れることがありますが、順次改善しています。');
      localStorage.setItem(key,today);
    }
  }catch{}

  // === Backup string (Base64) ===
  function encode(obj){
    return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  }
  function decode(b64){
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  }
  function collect(){
    // 端末内キーのうち hime で始まるものをまとめる
    const data={};
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(/^hime/i.test(k)) data[k]=localStorage.getItem(k);
    }
    return data;
  }
  function apply(data){
    Object.keys(data||{}).forEach(k=>localStorage.setItem(k,data[k]));
  }
  // Bind buttons if present
  const makeBtn = document.getElementById('makeString');
  const copyBtn = document.getElementById('copyString');
  const restoreBtn = document.getElementById('restoreFromString');
  const area = document.getElementById('backupStringArea');
  if(makeBtn && area){
    makeBtn.addEventListener('click', ()=>{
      const b64 = encode(collect());
      area.value = b64;
    });
  }
  if(copyBtn && area){
    copyBtn.addEventListener('click', async ()=>{
      if(!area.value) return;
      try{
        await navigator.clipboard.writeText(area.value);
        copyBtn.textContent='コピー済み';
        setTimeout(()=>copyBtn.textContent='コピー',1200);
      }catch{}
    });
  }
  if(restoreBtn && area){
    restoreBtn.addEventListener('click', ()=>{
      const v = area.value.trim();
      if(!v) return;
      try{
        const obj = decode(v);
        apply(obj);
        alert('復元しました。画面を再読み込みします。');
        location.reload();
      }catch(e){
        alert('文字列の形式が正しくありません。');
      }
    });
  }
})();
