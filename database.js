// database.js
// Lưu trữ đơn giản bằng file JSON (không cần cài native module) — phù hợp cho app test.
// Khi tích hợp thật, có thể thay thế bằng SQLite/MySQL tuỳ hạ tầng thật.

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');

const DEFAULT_DEPARTMENTS = ['Kho', 'Khuôn', 'QC', 'Kỹ thuật', 'Sản xuất'];

function loadRaw() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = {
      departments: DEFAULT_DEPARTMENTS.map((name, idx) => ({ id: idx + 1, name })),
      tasks: [],
      nextDeptId: DEFAULT_DEPARTMENTS.length + 1,
      nextTaskId: 1
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function saveRaw(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ---------- Departments ----------
function getDepartments() {
  const db = loadRaw();
  return db.departments;
}

function addDepartment(name) {
  const db = loadRaw();
  const trimmed = (name || '').trim();
  if (!trimmed) throw new Error('Tên bộ phận không được để trống');
  if (db.departments.some(d => d.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error('Bộ phận này đã tồn tại');
  }
  const dept = { id: db.nextDeptId++, name: trimmed };
  db.departments.push(dept);
  saveRaw(db);
  return dept;
}

function updateDepartment(id, name) {
  const db = loadRaw();
  const dept = db.departments.find(d => d.id === Number(id));
  if (!dept) throw new Error('Không tìm thấy bộ phận');
  const trimmed = (name || '').trim();
  if (!trimmed) throw new Error('Tên bộ phận không được để trống');
  const oldName = dept.name;
  dept.name = trimmed;
  // Đồng bộ tên bộ phận trong các task đang gán theo tên cũ
  db.tasks.forEach(t => {
    if (t.assigneeType === 'department' && t.assigneeValue === oldName) {
      t.assigneeValue = trimmed;
    }
  });
  saveRaw(db);
  return dept;
}

function deleteDepartment(id) {
  const db = loadRaw();
  const idx = db.departments.findIndex(d => d.id === Number(id));
  if (idx === -1) throw new Error('Không tìm thấy bộ phận');
  const inUse = db.tasks.some(t => t.assigneeType === 'department' && t.assigneeValue === db.departments[idx].name);
  if (inUse) throw new Error('Bộ phận đang được gán cho ít nhất 1 công việc, không thể xoá');
  db.departments.splice(idx, 1);
  saveRaw(db);
}

// ---------- Tasks ----------
function getTasks(filters = {}) {
  const db = loadRaw();
  let list = db.tasks;
  if (filters.status) list = list.filter(t => t.status === filters.status);
  if (filters.sourceApp) list = list.filter(t => t.sourceApp === filters.sourceApp);
  if (filters.assigneeType) list = list.filter(t => t.assigneeType === filters.assigneeType);
  if (filters.assigneeValue) list = list.filter(t => t.assigneeValue === filters.assigneeValue);
  return list.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getTaskById(id) {
  const db = loadRaw();
  return db.tasks.find(t => t.id === Number(id)) || null;
}

function addTask(input) {
  const db = loadRaw();
  const now = new Date().toISOString();
  const task = {
    id: db.nextTaskId++,
    title: (input.title || '').trim(),
    description: (input.description || '').trim(),
    assigneeType: input.assigneeType === 'department' ? 'department' : 'person',
    assigneeValue: (input.assigneeValue || '').trim(),
    sourceApp: input.sourceApp || 'TEST',
    createdBy: (input.createdBy || '').trim(),
    priority: ['low', 'normal', 'high'].includes(input.priority) ? input.priority : 'normal',
    deadline: input.deadline || null,
    status: 'new',
    createdAt: now,
    acceptedAt: null,
    startedAt: null,
    completedAt: null,
    updatedAt: now,
    attachments: Array.isArray(input.attachments) ? input.attachments : [],
    links: Array.isArray(input.links) ? input.links : []
  };
  if (!task.title) throw new Error('Tiêu đề không được để trống');
  if (!task.assigneeValue) throw new Error('Vui lòng chọn người hoặc bộ phận nhận việc');
  db.tasks.push(task);
  saveRaw(db);
  return task;
}

function updateTask(id, input) {
  const db = loadRaw();
  const task = db.tasks.find(t => t.id === Number(id));
  if (!task) throw new Error('Không tìm thấy công việc');
  if (input.title !== undefined) task.title = input.title.trim();
  if (input.description !== undefined) task.description = input.description.trim();
  if (input.assigneeType !== undefined) task.assigneeType = input.assigneeType === 'department' ? 'department' : 'person';
  if (input.assigneeValue !== undefined) task.assigneeValue = input.assigneeValue.trim();
  if (input.priority !== undefined && ['low', 'normal', 'high'].includes(input.priority)) task.priority = input.priority;
  if (input.deadline !== undefined) task.deadline = input.deadline;
  task.updatedAt = new Date().toISOString();
  saveRaw(db);
  return task;
}

const VALID_STATUSES = ['new', 'accepted', 'in_progress', 'done', 'overdue', 'rejected'];

function updateTaskStatus(id, status) {
  const db = loadRaw();
  const task = db.tasks.find(t => t.id === Number(id));
  if (!task) throw new Error('Không tìm thấy công việc');
  if (!VALID_STATUSES.includes(status)) throw new Error('Trạng thái không hợp lệ');
  const now = new Date().toISOString();
  if (status === 'accepted' && !task.acceptedAt) task.acceptedAt = now;
  if (status === 'in_progress' && !task.startedAt) task.startedAt = now;
  if (status === 'done') task.completedAt = now;
  // Quay lại các bước trước (VD: mở lại việc đã hoàn thành) thì xoá mốc thời gian phía sau để không sai lệch
  if (status === 'new') { task.acceptedAt = null; task.startedAt = null; task.completedAt = null; }
  if (status === 'accepted') { task.startedAt = null; task.completedAt = null; }
  if (status === 'in_progress') { task.completedAt = null; }
  task.status = status;
  task.updatedAt = now;
  saveRaw(db);
  return task;
}

function deleteTask(id) {
  const db = loadRaw();
  const idx = db.tasks.findIndex(t => t.id === Number(id));
  if (idx === -1) throw new Error('Không tìm thấy công việc');
  db.tasks.splice(idx, 1);
  saveRaw(db);
}

// ---------- Attachments (file đính kèm) ----------
function addAttachments(id, attachments) {
  const db = loadRaw();
  const task = db.tasks.find(t => t.id === Number(id));
  if (!task) throw new Error('Không tìm thấy công việc');
  if (!Array.isArray(task.attachments)) task.attachments = [];
  task.attachments.push(...attachments);
  task.updatedAt = new Date().toISOString();
  saveRaw(db);
  return task;
}

function removeAttachment(id, attachmentId) {
  const db = loadRaw();
  const task = db.tasks.find(t => t.id === Number(id));
  if (!task) throw new Error('Không tìm thấy công việc');
  const idx = (task.attachments || []).findIndex(a => a.id === attachmentId);
  if (idx === -1) throw new Error('Không tìm thấy file đính kèm');
  const [removed] = task.attachments.splice(idx, 1);
  task.updatedAt = new Date().toISOString();
  saveRaw(db);
  return removed; // trả về để server.js xoá luôn file vật lý trên đĩa
}

// ---------- Links (liên kết tham khảo) ----------
function addLinks(id, links) {
  const db = loadRaw();
  const task = db.tasks.find(t => t.id === Number(id));
  if (!task) throw new Error('Không tìm thấy công việc');
  if (!Array.isArray(task.links)) task.links = [];
  task.links.push(...links);
  task.updatedAt = new Date().toISOString();
  saveRaw(db);
  return task;
}

function removeLink(id, linkId) {
  const db = loadRaw();
  const task = db.tasks.find(t => t.id === Number(id));
  if (!task) throw new Error('Không tìm thấy công việc');
  const idx = (task.links || []).findIndex(l => l.id === linkId);
  if (idx === -1) throw new Error('Không tìm thấy liên kết');
  task.links.splice(idx, 1);
  task.updatedAt = new Date().toISOString();
  saveRaw(db);
  return task;
}

module.exports = {
  getDepartments, addDepartment, updateDepartment, deleteDepartment,
  getTasks, getTaskById, addTask, updateTask, updateTaskStatus, deleteTask,
  addAttachments, removeAttachment, addLinks, removeLink,
  VALID_STATUSES
};
