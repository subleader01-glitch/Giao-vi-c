// server.js
// App test "Giao việc giữa các bộ phận" — chạy độc lập, sau này HUB & MG và GASKET
// sẽ gọi sang các API này (đã bật CORS cho phép gọi từ domain khác).

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 4004;

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

app.use(cors()); // Cho phép mọi origin gọi vào — khi lên thật nên giới hạn lại domain cụ thể của HUB & MG / GASKET
app.use(express.json());
app.use(express.static(__dirname)); // Phục vụ luôn index.html để test nhanh tại http://localhost:4000
// Endpoint tải file riêng — luôn ép tải về máy (Content-Disposition: attachment),
// tránh trường hợp trình duyệt cố mở preview thay vì để hệ điều hành mở bằng Excel/ứng dụng tương ứng.
app.get('/api/download/:storedName', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.storedName);
  if (!fs.existsSync(filePath)) return fail(res, new Error('Không tìm thấy file'), 404);
  const originalName = req.query.name ? decodeURIComponent(req.query.name) : req.params.storedName;
  res.download(filePath, originalName);
});

// Endpoint xem trước — trả file dạng inline (không ép tải), dùng cho ảnh/PDF hiển thị trực tiếp
// hoặc để JS đọc nội dung (text/Excel) mà không tải file xuống máy người dùng.
app.get('/api/view/:storedName', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.storedName);
  if (!fs.existsSync(filePath)) return fail(res, new Error('Không tìm thấy file'), 404);
  res.sendFile(filePath);
});

// ---------- Cấu hình upload file ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '');
    const uniqueName = Date.now() + '-' + crypto.randomBytes(6).toString('hex') + safeExt;
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 } // giới hạn 15MB / file
});

function ok(res, data) { res.json({ success: true, data }); }
function fail(res, err, status = 400) { res.status(status).json({ success: false, error: err.message || String(err) }); }

// Multer/busboy đọc tên file trong multipart form theo latin1 mặc định, khiến tên file
// tiếng Việt (UTF-8) bị lỗi font (VD: "Báo cáo" thành "BÃ¡o cÃ¡o"). Decode lại đúng UTF-8.
function fixVietnameseFilename(name) {
  return Buffer.from(name, 'latin1').toString('utf8');
}

// Gắn cờ "Read-Only Recommended" (tính năng gốc của Excel: File > Info > Protect Workbook >
// Always Open Read-Only) trực tiếp vào file .xlsx/.xlsm. Excel sẽ tự hỏi người mở file có
// muốn bật sửa hay không, mặc định luôn ở chế độ chỉ xem — áp dụng cho MỌI người mở file này
// (không phụ thuộc máy/tài khoản), vì cờ nằm ngay trong nội dung file.
// Lưu ý: đây là gợi ý ở mức ứng dụng Excel (người dùng vẫn có thể bấm "Vẫn chỉnh sửa"),
// không phải khoá cứng — muốn khoá cứng cần đặt mật khẩu bảo vệ workbook, phức tạp hơn nhiều.
function markXlsxReadOnly(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xlsm') return; // .xls (định dạng nhị phân cũ) không hỗ trợ cách này
    const zip = new AdmZip(filePath);
    const entry = zip.getEntry('xl/workbook.xml');
    if (!entry) return;
    let xml = zip.readAsText(entry);
    if (/<fileSharing\b/.test(xml)) {
      xml = /readOnlyRecommended\s*=/.test(xml)
        ? xml.replace(/readOnlyRecommended\s*=\s*"[^"]*"/, 'readOnlyRecommended="1"')
        : xml.replace(/<fileSharing\b/, '<fileSharing readOnlyRecommended="1" ');
    } else {
      // Chèn ngay sau thẻ mở <workbook ...> — đúng thứ tự theo schema OOXML (trước workbookPr)
      xml = xml.replace(/(<workbook[^>]*>)/, '$1<fileSharing readOnlyRecommended="1"/>');
    }
    zip.updateFile('xl/workbook.xml', Buffer.from(xml, 'utf-8'));
    zip.writeZip(filePath);

    // Chạy trong app desktop (Electron) nên file nằm ngay trên máy người dùng — đặt luôn
    // quyền chỉ-đọc thật ở cấp hệ điều hành. Kết hợp với cờ Excel ở trên: nếu ai đó cố
    // "Vẫn chỉnh sửa" trong Excel, Excel sẽ không ghi đè được lên file gốc — bắt buộc Save As.
    fs.chmodSync(filePath, 0o444);
  } catch (e) {
    console.error('Không gắn được cờ read-only cho file Excel:', e.message);
    // Lỗi ở bước này không nên chặn cả việc upload — file gốc vẫn giữ nguyên, chỉ là chưa có cờ
  }
}

// Trước khi xoá file: phải gỡ quyền chỉ-đọc trước, nếu không Windows/Node sẽ báo lỗi EPERM
// (không cho xoá file có thuộc tính read-only) — áp dụng an toàn cho mọi loại file.
function unlinkSafe(filePath) {
  fs.chmod(filePath, 0o666, () => {
    fs.unlink(filePath, () => {});
  });
}

function filesToAttachments(files, stage = 'original') {
  return (files || []).map(f => {
    const originalName = fixVietnameseFilename(f.originalname);
    markXlsxReadOnly(f.path); // Gắn cờ khuyến nghị chỉ đọc ngay khi lưu file (nếu là .xlsx/.xlsm)
    return {
      id: crypto.randomBytes(8).toString('hex'),
      originalName,
      storedName: f.filename,
      // Trỏ về endpoint /api/download (ép tải file, không mở preview trong trình duyệt)
      url: `/api/download/${f.filename}?name=${encodeURIComponent(originalName)}`,
      // Endpoint riêng để xem trước (ảnh/PDF hiển thị trực tiếp, hoặc JS đọc nội dung text/Excel)
      viewUrl: `/api/view/${f.filename}`,
      size: f.size,
      stage, // 'original' = file lúc giao việc, 'result' = file kết quả nộp lại lúc hoàn thành
      uploadedAt: new Date().toISOString()
    };
  });
}

function parseLinksField(raw) {
  if (!raw) return [];
  let arr = [];
  try {
    arr = JSON.parse(raw);
  } catch (e) {
    // Fallback: cho phép gửi dạng text, mỗi dòng 1 link
    arr = String(raw).split('\n').map(s => s.trim()).filter(Boolean).map(url => ({ url }));
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map(item => (typeof item === 'string' ? { url: item } : item))
    .filter(item => item && item.url && item.url.trim())
    .map(item => ({
      id: crypto.randomBytes(8).toString('hex'),
      url: item.url.trim(),
      label: (item.label || '').trim()
    }));
}

// ---------- Departments ----------
app.get('/api/departments', (req, res) => {
  try { ok(res, db.getDepartments()); } catch (e) { fail(res, e); }
});

app.post('/api/departments', (req, res) => {
  try { ok(res, db.addDepartment(req.body.name)); } catch (e) { fail(res, e); }
});

app.put('/api/departments/:id', (req, res) => {
  try { ok(res, db.updateDepartment(req.params.id, req.body.name)); } catch (e) { fail(res, e); }
});

app.delete('/api/departments/:id', (req, res) => {
  try { db.deleteDepartment(req.params.id); ok(res, { deleted: true }); } catch (e) { fail(res, e); }
});

// ---------- Tasks ----------
app.get('/api/tasks', (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      sourceApp: req.query.sourceApp,
      assigneeType: req.query.assigneeType,
      assigneeValue: req.query.assigneeValue
    };
    ok(res, db.getTasks(filters));
  } catch (e) { fail(res, e); }
});

app.get('/api/tasks/:id', (req, res) => {
  try {
    const task = db.getTaskById(req.params.id);
    if (!task) return fail(res, new Error('Không tìm thấy công việc'), 404);
    ok(res, task);
  } catch (e) { fail(res, e); }
});

// Tạo task: chấp nhận cả JSON thường lẫn multipart/form-data (khi có kèm file ngay lúc tạo)
app.post('/api/tasks', upload.array('files', 10), (req, res) => {
  try {
    const attachments = filesToAttachments(req.files, 'original');
    const links = parseLinksField(req.body.links);
    const task = db.addTask({ ...req.body, attachments, links });
    ok(res, task);
  } catch (e) { fail(res, e); }
});

app.put('/api/tasks/:id', (req, res) => {
  try { ok(res, db.updateTask(req.params.id, req.body)); } catch (e) { fail(res, e); }
});

app.patch('/api/tasks/:id/status', (req, res) => {
  try {
    if (req.body.status === 'done') {
      throw new Error('Cần nộp file kết quả để hoàn thành — dùng chức năng "Hoàn thành" kèm upload file trả kết quả');
    }
    ok(res, db.updateTaskStatus(req.params.id, req.body.status));
  } catch (e) { fail(res, e); }
});

// Hoàn thành công việc: bắt buộc nộp kèm ít nhất 1 file kết quả trả lại
app.post('/api/tasks/:id/complete', upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      throw new Error('Vui lòng đính kèm ít nhất 1 file kết quả trước khi hoàn thành');
    }
    const attachments = filesToAttachments(req.files, 'result');
    db.addAttachments(req.params.id, attachments);
    const task = db.updateTaskStatus(req.params.id, 'done');
    ok(res, task);
  } catch (e) { fail(res, e); }
});

app.delete('/api/tasks/:id', (req, res) => {
  try {
    const task = db.getTaskById(req.params.id);
    // Xoá luôn các file vật lý đính kèm khi xoá task, tránh rác trong /uploads
    if (task && Array.isArray(task.attachments)) {
      task.attachments.forEach(a => {
        const p = path.join(UPLOAD_DIR, a.storedName);
        unlinkSafe(p);
      });
    }
    db.deleteTask(req.params.id);
    ok(res, { deleted: true });
  } catch (e) { fail(res, e); }
});

// ---------- Đính kèm file thêm vào task đã có (bổ sung file gốc bất kỳ lúc nào) ----------
app.post('/api/tasks/:id/attachments', upload.array('files', 10), (req, res) => {
  try {
    const stage = req.body.stage === 'result' ? 'result' : 'original';
    const attachments = filesToAttachments(req.files, stage);
    if (attachments.length === 0) throw new Error('Chưa chọn file nào');
    ok(res, db.addAttachments(req.params.id, attachments));
  } catch (e) { fail(res, e); }
});

app.delete('/api/tasks/:id/attachments/:attachmentId', (req, res) => {
  try {
    const removed = db.removeAttachment(req.params.id, req.params.attachmentId);
    if (removed) {
      const p = path.join(UPLOAD_DIR, removed.storedName);
      unlinkSafe(p);
    }
    ok(res, { deleted: true });
  } catch (e) { fail(res, e); }
});

// ---------- Liên kết tham khảo thêm vào task đã có ----------
app.post('/api/tasks/:id/links', (req, res) => {
  try {
    const links = parseLinksField(JSON.stringify(req.body.links || []));
    if (links.length === 0) throw new Error('Chưa nhập link nào');
    ok(res, db.addLinks(req.params.id, links));
  } catch (e) { fail(res, e); }
});

app.delete('/api/tasks/:id/links/:linkId', (req, res) => {
  try { ok(res, db.removeLink(req.params.id, req.params.linkId)); } catch (e) { fail(res, e); }
});

app.listen(PORT, () => {
  console.log(`✅ Tasks app đang chạy tại http://localhost:${PORT}`);
});
