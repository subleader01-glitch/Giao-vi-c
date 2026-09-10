// preload.js — Cầu nối an toàn giữa tiến trình chính (main.js, có toàn quyền hệ điều hành)
// và giao diện (index.html, chạy trong Chromium như 1 trang web bình thường).
// Không cho index.html truy cập trực tiếp Node.js/hệ điều hành (contextIsolation: true) —
// chỉ lộ ra đúng 1 hàm cần thiết: openFile().

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Đánh dấu để index.html biết đang chạy trong app desktop (khác với mở bằng trình duyệt thường)
  isElectron: true,
  // Mở 1 file đính kèm bằng ứng dụng mặc định của máy (Excel, trình đọc PDF...)
  openFile: (storedName) => ipcRenderer.invoke('open-attachment', storedName)
});
