// 1. 引入必要的 Firebase 模組
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 2. Firebase 設定 (請從 Console 複製您的設定)
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBtUHuZzNwXx2cOoVpcY2SigsgLcuCmz3M",
  authDomain: "quizmanagement-cd4b6.firebaseapp.com",
  projectId: "quizmanagement-cd4b6",
  storageBucket: "quizmanagement-cd4b6.firebasestorage.app",
  messagingSenderId: "324001275539",
  appId: "1:324001275539:web:e0da0b8abdab714f657766",
  measurementId: "G-L0G2205YY2"
};


// 3. 初始化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 4. Google 登入邏輯
document.getElementById('btn-google').addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        checkUserRole(result.user); // 登入成功後檢查身份
    } catch (error) {
        showError("Google 登入失敗: " + error.message);
    }
});

// 5. 通行碼登入邏輯 (將通行碼轉換為虛擬 Email)
document.getElementById('btn-passcode').addEventListener('click', async () => {
    const code = document.getElementById('passcode-input').value.trim();
    if (!code) return showError("請輸入通行碼");

    // 技巧：將通行碼組合成 Email，預設密碼可設為固定字串或與通行碼相同
    const dummyEmail = `${code}@quiz.system`; 
    const dummyPassword = code; // 簡單起見，密碼設為跟通行碼一樣

    try {
        const result = await signInWithEmailAndPassword(auth, dummyEmail, dummyPassword);
        checkUserRole(result.user);
    } catch (error) {
        showError("通行碼錯誤或無效");
    }
});

// 6. 核心功能：檢查用戶身份並導航
async function checkUserRole(user) {
    // 讀取 Firestore 中的 users 集合，尋找該用戶資料
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const userData = userSnap.data();
        // 根據 role 欄位導向不同頁面
        if (userData.role === 'admin') window.location.href = 'admin_dashboard.html';
        else if (userData.role === 'teacher') window.location.href = 'teacher_dashboard.html';
        else window.location.href = 'student_dashboard.html';
    } else {
        // 若是新 Google 用戶，可能需要先引導去註冊或綁定資料
        showError("帳號尚未建立，請聯繫管理員");
    }
}

function showError(msg) {
    document.getElementById('error-msg').textContent = msg;
}