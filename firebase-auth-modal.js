// firebase phone auth modal (production)
window.hgtAuthModal = (() => {
  const ask = (msg, def="") => new Promise((res, rej) => {
    const v = prompt(msg, def);
    if (v == null) return rej(new Error("cancelled"));
    res(v.trim());
  });

  return {
    async startPhoneLogin(){
      const phone = await ask("電話番号（+81...）を入力してください");
      // In production you would integrate Firebase UI here.
      alert(`電話番号ログインの開始: ${phone}\n（本番では Firebase Phone Auth UI が表示されます）`);
    }
  };
})();
