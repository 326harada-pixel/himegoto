
(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  const LS = { PROFILES:'hime_profiles_v1' };
  const load = (k, d=null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  function getParam(name){
    const m = new URLSearchParams(location.search).get(name);
    return m ? decodeURIComponent(m) : '';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const name = getParam('name');
    $('#c-name').value = name;
    $('#cust-title').textContent = `顧客プロファイル：${name}`;

    const profs = load(LS.PROFILES, {});
    const p = profs[name] || {};
    $('#c-age').value = p.age ?? '';
    $('#c-birthday').value = p.birthday ?? '';
    $('#c-drink').value = p.drink ?? '';
    $('#c-smoke').value = p.smoke ?? '';
    $('#c-likes').value = p.likes ?? '';
    $('#c-note').value = p.note ?? '';

    function write(){
      profs[name] = {
        age: $('#c-age').value || '',
        birthday: $('#c-birthday').value || '',
        drink: $('#c-drink').value || '',
        smoke: $('#c-smoke').value || '',
        likes: $('#c-likes').value || '',
        note: $('#c-note').value || ''
      };
      save(LS.PROFILES, profs);
    }
    ['c-age','c-birthday','c-drink','c-smoke','c-likes','c-note'].forEach(id=>{
      $('#'+id)?.addEventListener('input', write);
      $('#'+id)?.addEventListener('change', write);
    });
  });
})();
