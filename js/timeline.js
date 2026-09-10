// timeline.js - Timeline view cho task management

class TimelineView {
  constructor(containerSelector, tasks) {
    this.container = document.querySelector(containerSelector);
    this.tasks = tasks || [];
    this.render();
  }

  render() {
    const html = `
      <div class="timeline-container">
        <div style="margin-bottom: 12px;">
          <h3 style="margin: 0 0 8px; color: var(--navy);">⏱ Timeline công việc</h3>
          <p style="margin: 0; font-size: 12px; color: var(--ink-soft);">Xem tiến độ từng công việc theo thời gian</p>
        </div>
        <div id="timelineBody"></div>
      </div>
    `;
    this.container.innerHTML = html;
    this.renderTimeline();
  }

  getStatusIcon(status) {
    const icons = {
      'new': '📋',
      'accepted': '✅',
      'in_progress': '⏳',
      'done': '✔️',
      'overdue': '⚠️',
      'rejected': '✖️'
    };
    return icons[status] || '•';
  }

  getProgressPercent(task) {
    if (task.status === 'done') return 100;
    if (task.status === 'in_progress') return 60;
    if (task.status === 'accepted') return 30;
    if (task.status === 'rejected') return 0;
    return 10; // new
  }

  formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  getDaysUntilDeadline(task) {
    if (!task.deadline) return null;
    const today = new Date();
    const deadline = new Date(task.deadline);
    const days = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
    return days;
  }

  renderTimeline() {
    const body = document.getElementById('timelineBody');
    if (this.tasks.length === 0) {
      body.innerHTML = '<div class="empty" style="padding: 30px;">Chưa có công việc nào.</div>';
      return;
    }

    // Sort by deadline, then by status (in_progress first)
    const sorted = [...this.tasks].sort((a, b) => {
      if (a.status === 'done' || b.status === 'done') {
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (a.status !== 'done' && b.status === 'done') return -1;
      }
      const deadlineA = new Date(a.deadline || a.createdAt);
      const deadlineB = new Date(b.deadline || b.createdAt);
      return deadlineA - deadlineB;
    });

    let html = '';
    sorted.forEach(task => {
      const progressPercent = this.getProgressPercent(task);
      const daysLeft = this.getDaysUntilDeadline(task);
      const isUrgent = daysLeft !== null && daysLeft <= 2 && task.status !== 'done';
      const itemClass = `timeline-item ${isUrgent ? 'urgent' : ''} ${task.status === 'done' ? 'done' : ''}`;
      
      const deadlineClass = daysLeft !== null && daysLeft < 0 ? 'priority-high' : '';
      const deadlineText = task.deadline
        ? (daysLeft !== null && daysLeft < 0 ? `⚠ Quá hạn ${Math.abs(daysLeft)} ngày` : `📅 ${daysLeft} ngày nữa`)
        : '📅 Không có hạn';

      html += `
        <div class="${itemClass}" onclick="openTaskDetail(${task.id}, null, null)" style="cursor: pointer;">
          <div class="timeline-marker">${this.getStatusIcon(task.status)}</div>
          <div class="timeline-content">
            <div class="timeline-title">${this.escapeHtml(task.title)}</div>
            <div class="timeline-meta">
              <span>👤 ${this.escapeHtml(task.assigneeValue)}</span>
              <span>🏷 <span class="badge badge-${task.status}">${task.status === 'new' ? 'Mới' : task.status === 'accepted' ? 'Đã nhận' : task.status === 'in_progress' ? 'Đang xử lý' : task.status === 'done' ? 'Hoàn thành' : task.status === 'overdue' ? 'Quá hạn' : 'Từ chối'}</span></span>
              <span class="${deadlineClass}">${deadlineText}</span>
            </div>
            <div class="timeline-progress">
              <div class="timeline-progress-bar">
                <div class="timeline-progress-fill" style="width: ${progressPercent}%;"></div>
              </div>
              <span>${progressPercent}%</span>
            </div>
          </div>
        </div>
      `;
    });

    body.innerHTML = html;
  }

  escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

let timelineInstance = null;

function initTimeline(tasks) {
  timelineInstance = new TimelineView('#timelineView', tasks);
}

function updateTimeline(tasks) {
  if (timelineInstance) {
    timelineInstance.tasks = tasks;
    timelineInstance.render();
  }
}
