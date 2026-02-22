# 🐾 寵物農場日記 - 後台系統使用說明

我已經為你建立了基於 Firebase 的後台系統，讓你能夠持久化儲存日記和筆記數據。

## 🚀 快速開始

### 1. 設置 Firebase (必要)
為了讓後台運作，你需要擁有自己的 Firebase 專案：
1. 前往 [Firebase Console](https://console.firebase.google.com/)。
2. 建立新專案 (例如：`pet-diary-2026`)。
3. 在專案中建立一個 **Web 應用程式**。
4. 複製 Firebase 配置 (SDK 設置對象)。
5. 打開 `firebase-config.js` 文件，將你的配置貼上到 `firebaseConfig` 對象中。
6. 在 Firebase 控制台開啟 **Realtime Database**，並將規則設置為測試模式 (或允許讀寫)。

### 2. 存取後台管理介面
你可以直接在瀏覽器打開 `admin.html` 來管理你的所有數據。

## 📂 文件說明
- `admin.html`: 後台管理介面，可以查看、刪除、同步和備份數據。
- `firebase-config.js`: 存放你的 Firebase 配置資訊。
- `database-sync.js`: 核心同步邏輯，處理本地 localStorage 與 Firebase 之間的數據交換。

## ✨ 主要功能
- **自動同步**: 當你連接到網路並配置好 Firebase 後，數據會自動同步。
- **離線支持**: 如果 Firebase 未配置或網路斷開，數據會保存在 localStorage，並在下次同步時上傳。
- **數據管理**: 在 `admin.html` 中可以輕鬆查看日記歷史和統計數據。
- **安全備份**: 提供 JSON 格式的匯出功能，確保你的毛孩記錄永不丟失。

## 🛠️ 如何整合到現有首頁
在你的 `index.html` 中，建議在 `</body>` 前加入以下腳本：
```html
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js"></script>
<script src="firebase-config.js"></script>
<script src="database-sync.js"></script>
```
然後在你的儲存邏輯中調用 `window.dbSync.saveDiary(data)` 即可。
