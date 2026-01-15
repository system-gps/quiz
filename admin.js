// admin.js - 完整修復版

// 1. 引入 Firebase (請確保路徑正確)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 設定與初始化 ---
// TODO: 請填入您的 Firebase 設定
const firebaseConfig = {
    apiKey: "您的API_KEY",
    authDomain: "您的專案ID.firebaseapp.com",
    projectId: "您的專案ID",
    storageBucket: "您的專案ID.appspot.com",
    messagingSenderId: "...",
    appId: "..."
};

// 初始化主程式
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 初始化次要 App (用於建立帳號不登出 Admin)
const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

// --- DOM 元素選取 ---
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const btnDownload = document.getElementById('download-template'); // 新增
const btnUpload = document.getElementById('btn-upload-db');
const btnCancel = document.getElementById('btn-cancel');
const previewTable = document.querySelector('#preview-table tbody');
const actionBar = document.getElementById('action-bar');
const statusText = document.getElementById('status-text');

// 進度條相關
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');

// 變數儲存
let parsedData = [];

// ==========================================
//  功能 1: 下載 Excel 範本 (之前缺少的)
// ==========================================
btnDownload.addEventListener('click', () => {
    // 定義範本資料
    const templateData = [
        { name: "王小明", role: "student", class: "1A", passcode: "123456", email: "" },
        { name: "陳老師", role: "teacher", class: "", passcode: "", email: "teacher@test.com" }
    ];

    // 使用 SheetJS 建立工作表
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "帳號範本");

    // 下載檔案
    XLSX.writeFile(wb, "account_template.xlsx");
});

// ==========================================
//  功能 2: 上傳與解析 Excel
// ==========================================

// 點擊區域觸發檔案選擇
dropZone.addEventListener('click', () => fileInput.click());

// 拖放效果
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); 
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFile(files[0]);
});

// 檔案選擇變更
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
});

// 讀取並解析檔案
function handleFile(file) {
    console.log("正在讀取檔案:", file.name); // Debug 用
    const reader = new FileReader();
    
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // 讀取第一個工作表
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // 轉為 JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        console.log("解析出的資料:", jsonData); // Debug 用
        
        if (jsonData.length === 0) {
            alert("Excel 檔案內容為空！");
            return;
        }
        
        validateAndPreview(jsonData);
    };
    reader.readAsArrayBuffer(file);
}

// 驗證資料並顯示預覽
function validateAndPreview(data) {
    previewTable.innerHTML = ''; // 清空
    parsedData = [];
    let hasErrors = false;
    
    actionBar.classList.remove('hidden');

    data.forEach((row, index) => {
        const errors = [];
        
        // 簡易驗證邏輯
        if (!row.name) errors.push("缺姓名");
        
        const role = row.role ? row.role.trim().toLowerCase() : '';
        if (role !== 'teacher' && role !== 'student') errors.push("角色錯誤");
        
        if (!row.email && !row.passcode) errors.push("缺帳號(Email或通行碼)");

        // 標記錯誤
        if (errors.length > 0) hasErrors = true;

        // 加入暫存陣列
        parsedData.push({ ...row, isValid: errors.length === 0 });

        // 渲染表格 HTML
        const tr = document.createElement('tr');
        if (errors.length > 0) tr.classList.add('row-error');
        
        tr.innerHTML = `
            <td>${errors.length === 0 ? '<span class="tag valid">OK</span>' : '<span class="tag invalid">錯誤</span>'}</td>
            <td>${row.name || ''}</td>
            <td>${role}</td>
            <td>${row.class || ''}</td>
            <td>${row.email || row.passcode || ''}</td>
            <td style="color:red; font-size:0.85em">${errors.join(', ')}</td>
        `;
        previewTable.appendChild(tr);
    });

    // 設定按鈕狀態
    btnUpload.disabled = hasErrors;
    statusText.textContent = hasErrors 
        ? "發現格式錯誤，請修正後重新上傳" 
        : `檢查通過，共 ${data.length} 筆資料`;
}

// 取消按鈕
btnCancel.addEventListener('click', () => {
    actionBar.classList.add('hidden');
    previewTable.innerHTML = '';
    fileInput.value = ''; // 清空選擇
    parsedData = [];
});


// ==========================================
//  功能 3: 寫入 Firebase (批次建立)
// ==========================================
btnUpload.addEventListener('click', async () => {
    if (!parsedData || parsedData.length === 0) return;

    // UI 鎖定
    btnUpload.disabled = true;
    btnCancel.disabled = true;
    progressContainer.classList.remove('hidden');

    let successCount = 0;
    let failCount = 0;
    const errorLogs = [];

    // 逐筆處理
    for (let i = 0; i < parsedData.length; i++) {
        const user = parsedData[i];
        
        // 更新進度條
        const percent = Math.round(((i + 1) / parsedData.length) * 100);
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `處理中: ${user.name} (${i + 1}/${parsedData.length})`;

        try {
            await createSingleUser(user);
            successCount++;
        } catch (err) {
            console.error(err);
            failCount++;
            errorLogs.push(`${user.name}: ${err.message}`);
        }
    }

    // 完成
    progressText.textContent = "作業完成！";
    alert(`匯入結果：\n成功：${successCount}\n失敗：${failCount}`);
    
    // 如果有失敗，顯示失敗名單 (這裡可以做更細緻的 UI，先用 Alert)
    if (failCount > 0) {
        console.log("失敗名單:", errorLogs);
        alert("失敗原因請查看 Console (F12)");
    }

    // 重置介面
    btnUpload.disabled = false;
    btnCancel.disabled = false;
});

// 輔助函式：建立單一使用者
async function createSingleUser(userData) {
    const email = userData.email || `${userData.passcode}@quiz.system`;
    const password = userData.passcode || "123456"; // 預設密碼

    // 1. 建立 Auth
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = userCredential.user.uid;

    // 2. 寫入 DB
    await setDoc(doc(db, "users", uid), {
        uid: uid,
        name: userData.name,
        role: userData.role.toLowerCase(),
        class: userData.class || "",
        email: email,
        passcode: userData.passcode || "", // 存下來方便查詢
        createdAt: new Date().toISOString()
    });
    
    // 3. 登出次要帳號，準備下一個
    await signOut(secondaryAuth);
}