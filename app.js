// app.js 修正版 ({name}挿入修正対応)

document.addEventListener("DOMContentLoaded", function () {
  const customerList = document.getElementById("customerList");
  const nameInput = document.getElementById("nameInput");
  const addBtn = document.getElementById("addBtn");
  const insertNameBtn = document.getElementById("insertNameBtn");
  const shareBtn = document.getElementById("shareBtn");
  const message = document.getElementById("message");

  // ローカルストレージに保存されている顧客データを読み込み
  let customers = JSON.parse(localStorage.getItem("customers")) || [];
  let selectedCustomer = null;

  function saveCustomers() {
    localStorage.setItem("customers", JSON.stringify(customers));
  }

  function renderCustomers() {
    customerList.innerHTML = "";
    customers.forEach((name, index) => {
      const row = document.createElement("div");
      row.className = "customer-row";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = name;

      const selectBtn = document.createElement("button");
      selectBtn.textContent = selectedCustomer === name ? "選択中" : "選択";
      selectBtn.className =
        selectedCustomer === name ? "selected-btn" : "select-btn";
      selectBtn.onclick = () => {
        selectedCustomer = name;
        renderCustomers();
      };

      const memoBtn = document.createElement("button");
      memoBtn.textContent = "メモ";
      memoBtn.className = "memo-btn";
      memoBtn.onclick = () => {
        localStorage.setItem("currentCustomer", name);
        window.location.href = "customer.html";
      };

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "削除";
      deleteBtn.className = "delete-btn";
      deleteBtn.onclick = () => {
        customers.splice(index, 1);
        if (selectedCustomer === name) selectedCustomer = null;
        saveCustomers();
        renderCustomers();
      };

      row.appendChild(nameSpan);
      row.appendChild(selectBtn);
      row.appendChild(memoBtn);
      row.appendChild(deleteBtn);
      customerList.appendChild(row);
    });
  }

  addBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) return;
    if (customers.includes(name)) return alert("同じ名前が存在します");
    if (customers.length >= 5)
      return alert("無料版では5名まで登録できます");
    customers.push(name);
    nameInput.value = "";
    saveCustomers();
    renderCustomers();
  });

  // {name}を挿入ボタンの動作修正版
  insertNameBtn.addEventListener("click", () => {
    const textarea = message;
    const insertText = "{name}";
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;

    textarea.value =
      currentText.substring(0, start) +
      insertText +
      currentText.substring(end);

    const newPos = start + insertText.length;
    textarea.selectionStart = textarea.selectionEnd = newPos;
    textarea.focus();
  });

  shareBtn.addEventListener("click", async () => {
    if (!selectedCustomer) return alert("顧客を選択してください");
    const text = message.value.replaceAll("{name}", selectedCustomer);
    try {
      await navigator.share({ text });
    } catch (err) {
      console.error("共有エラー:", err);
      alert("共有できませんでした");
    }
  });

  renderCustomers();
});
