/*! app-index.js — himegoto index-page helpers
 *  Backup v2 (LZ-String + Base64URL) + v1互換
 *  Installボタン制御 / ロゴのフォールバック（非破壊）
 */
(function(){
  'use strict';

  function b64ToUrl(b64){ return b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
  function urlToB64(url){ let s = url.replace(/-/g,'+').replace(/_/g,'/'); const pad = s.length % 4; return pad? s + '===='.slice(pad): s; }

  // --- LZ-String (Uint8) minimal (MIT) ---
  var LZString=(function(){var f=String.fromCharCode;var keyStrUriSafe="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";var baseReverseDic={};function getBaseValue(alphabet,character){if(!baseReverseDic[alphabet]){baseReverseDic[alphabet]={};for(var i=0;i<alphabet.length;i++){baseReverseDic[alphabet][alphabet.charAt(i)]=i;}}return baseReverseDic[alphabet][character];}
  var LZString={compressToUint8Array:function(uncompressed){var compressed=LZString._compress(uncompressed,16,function(a){return f(a);});var buf=new Uint8Array(compressed.length*2);for(var i=0,TotalLen=compressed.length;i<TotalLen;i++){var current_value=compressed.charCodeAt(i);buf[i*2]=current_value>>>8;buf[i*2+1]=current_value%256;}return buf;},decompressFromUint8Array:function(compressed){if(compressed===null||compressed===undefined){return LZString.decompress(compressed);}else{var buf=new Array(compressed.length/2);for(var i=0,TotalLen=buf.length;i<TotalLen;i++){buf[i]=compressed[i*2]*256+compressed[i*2+1];}var result=[];buf.forEach(function(c){result.push(f(c));});return LZString._decompress(result.length,32768,function(index){return result[index].charCodeAt(0);});}},compress:function(uncompressed){return LZString._compress(uncompressed,16,function(a){return f(a);});},_compress:function(uncompressed, bitsPerChar, getCharFromInt){if(uncompressed==null) return "";var i,value,context_dictionary={},context_dictionaryToCreate={},context_c="",context_wc="",context_w="",context_enlargeIn=2,context_dictSize=3,context_numBits=2,context_data=[],context_data_val=0,context_data_position=0,ii;for(ii=0;ii<uncompressed.length;ii+=1){context_c=uncompressed.charAt(ii);if(!Object.prototype.hasOwnProperty.call(context_dictionary,context_c)){context_dictionary[context_c]=context_dictSize++;context_dictionaryToCreate[context_c]=true;}context_wc=context_w+context_c;if(Object.prototype.hasOwnProperty.call(context_dictionary,context_wc)){context_w=context_wc;}else{if(Object.prototype.hasOwnProperty.call(context_dictionaryToCreate,context_w)){if(context_w.charCodeAt(0)<256){for(i=0;i<context_numBits;i++){context_data_val=(context_data_val<<1);if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}}value=context_w.charCodeAt(0);for(i=0;i<8;i++){context_data_val=(context_data_val<<1)|(value&1);if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}value=value>>1;}}else{value=1;for(i=0;i<context_numBits;i++){context_data_val=(context_data_val<<1)|value;if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}value=0;}value=context_w.charCodeAt(0);for(i=0;i<16;i++){context_data_val=(context_data_val<<1)|(value&1);if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}value=value>>1;}}context_enlargeIn--;if(context_enlargeIn==0){context_enlargeIn=Math.pow(2,context_numBits);context_numBits++;}delete context_dictionaryToCreate[context_w];}else{value=context_dictionary[context_w];for(i=0;i<context_numBits;i++){context_data_val=(context_data_val<<1)|(value&1);if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}value=value>>1;}}
  context_enlargeIn--;if(context_enlargeIn==0){context_enlargeIn=Math.pow(2,context_numBits);context_numBits++;}context_dictionary[context_wc]=context_dictSize++;context_w=String(context_c);}}
  if(context_w!==""){if(Object.prototype.hasOwnProperty.call(context_dictionaryToCreate,context_w)){if(context_w.charCodeAt(0)<256){for(i=0;i<context_numBits;i++){context_data_val=(context_data_val<<1);if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}}value=context_w.charCodeAt(0);for(i=0;i<8;i++){context_data_val=(context_data_val<<1)|(value&1);if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}value=value>>1;}}else{value=1;for(i=0;i<context_numBits;i++){context_data_val=(context_data_val<<1)|value;if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}value=0;}value=context_w.charCodeAt(0);for(i=0;i<16;i++){context_data_val=(context_data_val<<1)|(value&1);if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}value=value>>1;}}context_enlargeIn--;if(context_enlargeIn==0){context_enlargeIn=Math.pow(2,context_numBits);context_numBits++;}delete context_dictionaryToCreate[context_w];}else{value=context_dictionary[context_w];for(i=0;i<context_numBits;i++){context_data_val=(context_data_val<<1)|(value&1);if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}value=value>>1;}context_enlargeIn--;if(context_enlargeIn==0){context_enlargeIn=Math.pow(2,context_numBits);context_numBits++;}}}
  value=2;for(i=0;i<context_numBits;i++){context_data_val=(context_data_val<<1)|(value&1);if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}value=value>>1;}
  while(true){context_data_val=(context_data_val<<1);if(context_data_position==bitsPerChar-1){context_data.push(getCharFromInt(context_data_val));break;}else{context_data_position++;}}
  return context_data.join('');},decompress:function(compressed){if(compressed==null) return "";if(compressed=="") return null;return LZString._decompress(compressed.length,32768,function(index){return compressed.charCodeAt(index);});},_decompress:function(length,resetValue,getNextValue){var dictionary=[],next,enlargeIn=4,dictSize=4,numBits=3,entry="",result=[],i,w,bits,resb,maxpower,power,c,data=0,position=resetValue,index=1;for(i=0;i<3;i+=1){dictionary[i]=i;}bits=0;maxpower=Math.pow(2,2);power=1;while(power!=maxpower){resb=data&position;position>>=1;if(position==0){position=resetValue;data=getNextValue(index++);}bits|=(resb>0?1:0)*power;power<<=1;}switch(bits){case 0:c=0;bits=0;maxpower=Math.pow(2,8);power=1;while(power!=maxpower){resb=data&position;position>>=1;if(position==0){position=resetValue;data=getNextValue(index++);}bits|=(resb>0?1:0)*power;power<<=1;}next=String.fromCharCode(c);break;case 1:c=0;bits=0;maxpower=Math.pow(2,16);power=1;while(power!=maxpower){resb=data&position;position>>=1;if(position==0){position=resetValue;data=getNextValue(index++);}bits|=(resb>0?1:0)*power;power<<=1;}next=String.fromCharCode(c);break;case 2:return "";}dictionary[3]=next;w=next;result.push(next);while(true){if(index>length){return "";}bits=0;maxpower=Math.pow(2,numBits);power=1;while(power!=maxpower){resb=data&position;position>>=1;if(position==0){position=resetValue;data=getNextValue(index++);}bits|=(resb>0?1:0)*power;power<<=1;}switch(c=bits){case 0:c=0;bits=0;maxpower=Math.pow(2,8);power=1;while(power!=maxpower){resb=data&position;position>>=1;if(position==0){position=resetValue;data=getNextValue(index++);}bits|=(resb>0?1:0)*power;power<<=1;}dictionary[dictSize++]=String.fromCharCode(c);c=dictSize-1;enlargeIn--;break;case 1:c=0;bits=0;maxpower=Math.pow(2,16);power=1;while(power!=maxpower){resb=data&position;position>>=1;if(position==0){position=resetValue;data=getNextValue(index++);}bits|=(resb>0?1:0)*power;power<<=1;}dictionary[dictSize++]=String.fromCharCode(c);c=dictSize-1;enlargeIn--;break;case 2:return result.join('');}
  if(enlargeIn==0){enlargeIn=Math.pow(2,numBits);numBits++;}
  if(dictionary[c]){entry=dictionary[c];}else{if(c===dictSize){entry=w+w.charAt(0);}else{return null;}}
  result.push(entry);dictionary[dictSize++]=w+entry.charAt(0);enlargeIn--;w=entry;if(enlargeIn==0){enlargeIn=Math.pow(2,numBits);numBits++;}}}};return LZString;})();

  const SCHEMA_VER=2;

  function collectData(){
    const now=new Date().toISOString();
    const snapshot={};
    const candidates=['hime_customers','hime_memos','hime_selected','hime_plan','hime_send_cnt_v1','hime_send_cnt_v2','hime_device_id','customers','memos','selectedCustomer','sendCount','plan'];
    candidates.forEach(k=>{ if(localStorage.getItem(k)!=null){ snapshot[k]=localStorage.getItem(k); } });
    const dumpAll={};
    for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); dumpAll[k]=localStorage.getItem(k); }
    return {schema:SCHEMA_VER,ts:now,snapshot,dumpAll};
  }
  function restoreData(obj){
    if(!obj||!obj.dumpAll) return;
    Object.keys(obj.dumpAll).forEach(k=>{ try{ localStorage.setItem(k,obj.dumpAll[k]); }catch(e){} });
    if(typeof window.initApp==='function'){ try{ window.initApp(); }catch(e){} }
  }

  function encodeV2(obj){
    const json=JSON.stringify(obj);
    const u8=LZString.compressToUint8Array(json);
    let bin=''; for(let i=0;i<u8.length;i++){ bin+=String.fromCharCode(u8[i]); }
    return 'v2:'+b64ToUrl(btoa(bin));
  }
  function tryDecodeV2(s){
    if(!s.startsWith('v2:')) return null;
    const b64=urlToB64(s.slice(3));
    const bin=atob(b64);
    const u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++){ u8[i]=bin.charCodeAt(i); }
    try{ const json=LZString.decompressFromUint8Array(u8); return JSON.parse(json);}catch(e){ return null; }
  }
  function tryDecodeV1(s){
    try{ const json=atob(urlToB64(s)); return JSON.parse(json);}catch(e){ return null; }
  }

  function makeBackupString(){ return encodeV2(collectData()); }
  function restoreFromString(s){
    if(!s||typeof s!=='string') return false;
    let obj=tryDecodeV2(s); if(!obj) obj=tryDecodeV1(s);
    if(!obj) return false; restoreData(obj); return true;
  }
  window.hime_makeBackupString=makeBackupString;
  window.hime_restoreFromString=restoreFromString;

  document.addEventListener('DOMContentLoaded', function(){
    const mk=document.getElementById('makeStringBtn')||document.querySelector('[data-action="make-string"]')||document.querySelector('button#makeStrBtn')||document.querySelector('button.make-string');
    const ta=document.getElementById('backupText')||document.querySelector('textarea#backupArea')||document.querySelector('textarea[name="backup"]');
    const cp=document.getElementById('copyStringBtn')||document.querySelector('[data-action="copy-string"]')||document.querySelector('button#copyStrBtn')||document.querySelector('button.copy-string');
    const rs=document.getElementById('restoreFromStringBtn')||document.querySelector('[data-action="restore-string"]')||document.querySelector('button#restoreFromStrBtn')||document.querySelector('button.restore-string');

    if(mk){ mk.addEventListener('click', function(){ try{ const s=makeBackupString(); if(ta){ ta.value=s; } const out=document.getElementById('backupOut'); if(out){ out.textContent=s; } }catch(e){ console.error(e); alert('バックアップ文字列の作成に失敗しました'); } }); }
    if(cp){ cp.addEventListener('click', async function(){ try{ let s=''; if(ta&&ta.value){ s=ta.value; } else { s=makeBackupString(); if(ta){ ta.value=s; } } await navigator.clipboard.writeText(s); }catch(e){ console.error(e); alert('コピーに失敗しました'); } }); }
    if(rs){ rs.addEventListener('click', function(){ try{ const s=ta&&ta.value?ta.value.trim():''; if(!s){ alert('文字列を貼り付けてください'); return; } const ok=restoreFromString(s); alert(ok?'復元しました':'復元に失敗しました'); }catch(e){ console.error(e); alert('復元に失敗しました'); } }); }

    // Install button
    let deferredPrompt=null;
    const installBtn=document.getElementById('installBtn')||document.querySelector('button.install-btn');
    window.addEventListener('beforeinstallprompt',(e)=>{ e.preventDefault(); deferredPrompt=e; if(installBtn){ installBtn.style.display=''; } });
    if(installBtn){ installBtn.addEventListener('click', async ()=>{ try{ if(!deferredPrompt) return; deferredPrompt.prompt(); const choice=await deferredPrompt.userChoice; deferredPrompt=null; if(choice&&choice.outcome==='accepted'){ installBtn.style.display='none'; } }catch(e){ console.error(e);} }); }
    window.addEventListener('appinstalled', ()=>{ if(installBtn){ installBtn.style.display='none'; } });

    // Header logo fallback
    const logoImg=document.querySelector('img#logo, .logo img, img[data-logo]');
    if(logoImg){
      if(!logoImg.getAttribute('src')||logoImg.naturalWidth===0){
        const cands=['/img/himegoto.png','/assets/himegoto.png','./img/himegoto.png','./assets/himegoto.png'];
        let tried=false;
        logoImg.addEventListener('error', function onErr(){ if(tried) return; logoImg.src=cands[0]; tried=true; logoImg.removeEventListener('error', onErr); });
        if(!logoImg.getAttribute('src')) logoImg.src=cands[0];
      }
      logoImg.style.display='block'; logoImg.style.margin='0 auto'; logoImg.style.maxHeight='32px';
    }
  });
})();
