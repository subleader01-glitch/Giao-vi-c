// main.js — Tiến trình chính (main process) của Electron.
// Khởi động server Express y hệt như bản web (server.js không đổi gì cả),
// rồi mở 1 cửa sổ ứng dụng trỏ vào server đó — về bản chất vẫn là app web
// cũ, chỉ chạy trong 1 cửa sổ riêng thay vì trình duyệt, và có thêm khả năng
// gọi thẳng vào hệ điều hành (mở file bằng Excel) mà trình duyệt không làm được.

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

const PORT = process.env.PORT || 4004;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Giao việc giữa các bộ phận',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);
  mainWindow.setMenuBarVisibility(false); // Ẩn thanh menu mặc định (File/Edit/View...) cho gọn giao diện
}

// Nhận yêu cầu từ giao diện (renderer) muốn mở 1 file đính kèm bằng ứng dụng mặc định của máy
// (Excel cho .xlsx, trình đọc PDF cho .pdf...). Đây chính là điều trình duyệt web thường KHÔNG làm được.
ipcMain.handle('open-attachment', async (event, storedName) => {
  // Chỉ cho phép tên file hợp lệ (chống truy cập ra ngoài thư mục uploads bằng ../..)
  const safeName = path.basename(storedName);
  const filePath = path.join(UPLOAD_DIR, safeName);
  const result = await shell.openPath(filePath); // chuỗi rỗng nếu thành công, có nội dung lỗi nếu thất bại
  return { success: result === '', error: result || null };
});

app.whenReady().then(() => {
  require('./server'); // Khởi động server Express (chạy app.listen ngay khi require file này)
  // Server khởi động rất nhanh (ứng dụng nhỏ, chạy local) nên đợi 1 chút cho chắc trước khi mở cửa sổ
  setTimeout(createWindow, 300);

  app.on('activate', () => {
    // Trên macOS: bấm icon dock khi chưa có cửa sổ nào thì mở lại cửa sổ
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Trên macOS, app thường vẫn chạy nền tới khi người dùng thoát hẳn (Cmd+Q);
  // trên Windows/Linux thì đóng hết cửa sổ nghĩa là thoát app luôn.
  if (process.platform !== 'darwin') app.quit();
});
