
(function(){
  function waitForConfig(maxMs){
    return new Promise(function(res, rej){
      var waited = 0;
      var iv = setInterval(function(){
        if (window.FIREBASE_CONFIG){ clearInterval(iv); res(true); }
        waited += 50;
        if (waited >= maxMs){ clearInterval(iv); rej(new Error('FIREBASE_CONFIG missing')); }
      }, 50);
    });
  }

  function ready(fn){ if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  ready(function(){
    waitForConfig(5000).then(function(){
      window.__FIREBASE_READY__ = true;
      if (typeof window.initializeApp === 'function'){
        try{ window.initializeApp(window.FIREBASE_CONFIG); }catch(e){ /* ignore if already initialized */ }
      }
      var btn = document.getElementById('btn-login') || document.querySelector('[data-role="login"]');
      if (btn){
        btn.addEventListener('click', function(){
          var tel = prompt('電話番号（+81...）を入力してください');
          if(!tel) return;
          alert('電話番号ログインの開始: ' + tel + '\n（本番では Firebase Phone Auth UI が表示されます）');
        });
      }
    }).catch(function(err){
      alert('ログインに失敗しました: ' + err.message);
    });
  });
})();
