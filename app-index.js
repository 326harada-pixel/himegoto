(function(){
  const $=(s)=>document.querySelector(s);
  const on=(el,ev,fn)=>el&&el.addEventListener(ev,fn);

  const lst=$('#customerList'),
        nameI=$('#nameInput'),
        addB=$('#addBtn');
  const msg=$('#messageBox'),
        ins=$('#insertName'),
        rem=$('#remain'),
        share=$('#shareBtn');

  const KC='hime_customers', KS='hime_selected';

  function load(){
    try{
      return{
        list:JSON.parse(localStorage.getItem(KC)||'[]'),
        sel:JSON.parse(localStorage.getItem(KS)||'null')
      }
    }catch(e){
      return{list:[],sel:null}
    }
  }

  function save(l,s){
    localStorage.setItem(KC,JSON.stringify(l||[]));
    localStorage.setItem(KS,JSON.stringify(s));
  }

  function render(){
    const st=load();
    lst.innerHTML='';
    (st.list||[]).forEach((nm,i)=>{
      const li=document.createElement('li');
      li.innerHTML=`<span>${nm}</span><span>
        <button class="btn ${st.sel===i?'primary':''}" data-a="sel" data-i="${i}">
          ${st.sel===i?'選択中':'選択'}
        </button>
        <a class="btn" href="customer.html#${encodeURIComponent(nm)}">メモ</a>
        <button class="btn" data-a="del" data-i="${i}">削除</button>
      </span>`;
      lst.appendChild(li);
    });
  }

  render();

  on(addB,'click',()=>{
    const v=(nameI&&nameI.value||'').trim();
    if(!v)return;
    const st=load();
    st.list.push(v);
    st.sel=st.list.length-1;
    save(st.list,st.sel);
    if(nameI)nameI.value='';
    render();
  });

  on(lst,'click',(e)=>{
    const t=e.target;
    if(!(t instanceof HTMLElement))return;
    const a=t.getAttribute('data-a');
    const i=Number(t.getAttribute('data-i'));
    const st=load();
    if(a==='sel'){
      st.sel=i;
      save(st.list,st.sel);
      render();
    }
    if(a==='del'){
      st.list.splice(i,1);
      if(st.sel===i)st.sel=null;
      save(st.list,st.sel);
      render();
    }
  });

  // ←ここを修正：{name} 挿入を指定の位置にリテラル挿入
  on(ins,'click',()=>{
    if(!msg)return;
    const tag='{name}';
    const s=msg.selectionStart||0, e=msg.selectionEnd||0;
    const v=msg.value||'';
    msg.value=v.slice(0,s)+tag+v.slice(e);
    msg.focus();
    msg.selectionStart=msg.selectionEnd=s+tag.length;
  });

  if(msg&&rem){
    const lim=10000;
    const upd=()=>{
      rem.textContent=Math.max(0,lim-(msg.value||'').length);
    };
    msg.addEventListener('input',upd);
    upd();
  }

  on(share,'click',async()=>{
    if(!msg)return;
    const text=msg.value||'';
    try{
      if(navigator.share){
        await navigator.share({text});
      }else{
        await navigator.clipboard.writeText(text);
        alert('共有非対応のためコピーしました。');
      }
    }catch{}
  });

  const mk=document.getElementById('makeString'),
        cp=document.getElementById('copyString'),
        rs=document.getElementById('restoreFromString'),
        ar=document.getElementById('backupStringArea');

  const enc=(o)=>btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  const dec=(b)=>JSON.parse(decodeURIComponent(escape(atob(b))));

  const collect=()=>{
    const d={};
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(/^hime/i.test(k))d[k]=localStorage.getItem(k);
    }
    return d;
  };

  const apply=(d)=>Object.keys(d||{}).forEach(k=>localStorage.setItem(k,d[k]));

  on(mk,'click',()=>{
    if(!ar)return;
    ar.value=enc(collect());
  });

  on(cp,'click',async()=>{
    if(!ar||!ar.value)return;
    try{
      await navigator.clipboard.writeText(ar.value);
    }catch{}
  });

  on(rs,'click',()=>{
    if(!ar||!ar.value)return;
    try{
      apply(dec(ar.value.trim()));
      alert('復元しました。再読み込みします。');
      location.reload();
    }catch(e){
      alert('文字列の形式が正しくありません。');
    }
  });
})();
