// gantt.js - Gantt Chart interactif với drag-and-drop, timeline view

class GanttChart {
  constructor(containerSelector, tasks, departments) {
    this.container = document.querySelector(containerSelector);
    this.tasks = tasks || [];
    this.departments = departments || [];
    this.selectedTaskId = null;
    this.startDate = this.getEarliestDate();
    this.endDate = this.getLatestDate();
    this.dayWidth = 30; // pixels per day
    this.render();
  }

  getEarliestDate() {
    const dates = this.tasks
      .map(t => t.deadline || t.createdAt)
      .filter(Boolean)
      .map(d => new Date(d));
    return dates.length ? new Date(Math.min(...dates)) : new Date();
  }

  getLatestDate() {
    const dates = this.tasks
      .map(t => t.completedAt || t.deadline || t.createdAt)
      .filter(Boolean)
      .map(d => new Date(d));
    const latest = dates.length ? new Date(Math.max(...dates)) : new Date();
    latest.setDate(latest.getDate() + 7); // thêm 7 ngày buffer
    return latest;
  }

  daysInRange() {
    const range = (this.endDate - this.startDate) / (1000 * 60 * 60 * 24);
    return Math.ceil(range);
  }

  dateToPixels(date) {
    const d = new Date(date);
    const days = (d - this.startDate) / (1000 * 60 * 60 * 24);
    return days * this.dayWidth;
  }

  pixelsToDate(pixels) {
    const days = pixels / this.dayWidth;
    return new Date(this.startDate.getTime() + days * 24 * 60 * 60 * 1000);
  }

  formatDate(date) {
    const d = new Date(date);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  isToday(date) {
    const d = new Date(date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }

  isOverdue(task) {
    if (!task.deadline || task.status === 'done') return false;
    return new Date(task.deadline) < new Date();
  }

  render() {
    const html = `
      <div class="gantt-container">
        <div class="gantt-controls">
          <label>📅 Từ ngày:
            <input type="date" id="ganttDateFrom" value="${this.startDate.toISOString().split('T')[0]}">
          </label>
          <label>Đến ngày:
            <input type="date" id="ganttDateTo" value="${this.endDate.toISOString().split('T')[0]}">
          </label>
          <label>
            <input type="checkbox" id="ganttShowDone" checked> Hiện công việc hoàn thành
          </label>
          <button class="btn-ghost" id="ganttRefresh">🔄 Làm mới</button>
        </div>
        <div class="gantt-wrapper">
          <div class="gantt-sidebar">
            <div class="gantt-sidebar-header">📋 Công việc</div>
            <div id="ganttSidebar"></div>
          </div>
          <div class="gantt-chart">
            <div class="gantt-header" id="ganttHeader"></div>
            <div class="gantt-body" id="ganttBody"></div>
          </div>
        </div>
        <div class="gantt-legend">
          <div class="gantt-legend-item">
            <div class="gantt-legend-color" style="background: linear-gradient(135deg, #b54545, #d32f2f);"></div>
            <span>Ưu tiên cao</span>
          </div>
          <div class="gantt-legend-item">
            <div class="gantt-legend-color" style="background: linear-gradient(135deg, #1f4e78, #16324f);"></div>
            <span>Bình thường</span>
          </div>
          <div class="gantt-legend-item">
            <div class="gantt-legend-color" style="background: linear-gradient(135deg, #78909c, #546e7a);"></div>
            <span>Ưu tiên thấp</span>
          </div>
          <div class="gantt-legend-item">
            <div class="gantt-legend-color" style="background: #ffeb3b;"></div>
            <span>Hôm nay</span>
          </div>
        </div>
      </div>
    `;
    this.container.innerHTML = html;
    this.renderHeader();
    this.renderBody();
    this.renderSidebar();
    this.attachEventListeners();
  }

  renderHeader() {
    const header = document.getElementById('ganttHeader');
    const days = this.daysInRange();
    let html = '';
    for (let i = 0; i < days; i++) {
      const date = new Date(this.startDate);
      date.setDate(date.getDate() + i);
      const isToday = this.isToday(date);
      const cellClass = isToday ? 'gantt-header-cell today' : 'gantt-header-cell';
      html += `
        <div class="${cellClass}" style="width: ${this.dayWidth}px;">
          <div>
            <div style="font-size: 10px;">${['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()]}</div>
            <div style="font-size: 11px; font-weight: 700;">${date.getDate()}</div>
          </div>
        </div>
      `;
    }
    header.innerHTML = html;
  }

  renderBody() {
    const body = document.getElementById('ganttBody');
    let html = '';
    const showDone = document.getElementById('ganttShowDone')?.checked ?? true;

    this.tasks.forEach(task => {
      if (task.status === 'done' && !showDone) return;
      if (task.status === 'rejected') return; // bỏ qua task bị từ chối

      const isOverdue = this.isOverdue(task);
      const rowClass = isOverdue ? 'gantt-body-row overdue' : 'gantt-body-row';
      html += `<div class="${rowClass}" data-task-id="${task.id}">`;

      const days = this.daysInRange();
      for (let i = 0; i < days; i++) {
        const date = new Date(this.startDate);
        date.setDate(date.getDate() + i);
        const isToday = this.isToday(date);
        const cellClass = isToday ? 'gantt-cell today' : 'gantt-cell';
        html += `<div class="${cellClass}" style="width: ${this.dayWidth}px;"></div>`;
      }

      html += `</div>`;
    });

    body.innerHTML = html;

    // Render bars sau khi DOM đã có
    this.tasks.forEach((task, idx) => {
      if (task.status === 'done' && !showDone) return;
      if (task.status === 'rejected') return;

      const row = body.querySelector(`[data-task-id="${task.id}"]`);
      if (!row) return;

      const startDate = task.startedAt || task.acceptedAt || task.createdAt;
      const endDate = task.completedAt || task.deadline || task.createdAt;
      if (!startDate || !endDate) return;

      const startPx = this.dateToPixels(startDate);
      const endPx = this.dateToPixels(endDate);
      const width = Math.max(endPx - startPx, 40);

      const barClass = `gantt-bar ${task.priority}-priority ${task.status === 'done' ? 'done' : ''}`;
      const bar = document.createElement('div');
      bar.className = barClass;
      bar.style.left = startPx + 'px';
      bar.style.width = width + 'px';
      bar.textContent = task.title.substring(0, 20);
      bar.title = task.title;
      bar.style.cursor = 'pointer';
      bar.onclick = (e) => {
        e.stopPropagation();
        this.selectedTaskId = task.id;
        this.updateSidebarSelection();
        window.openTaskDetail(task.id, null, null);
      };
      row.appendChild(bar);

      // Milestone (deadline)
      if (task.deadline) {
        const deadlinePx = this.dateToPixels(task.deadline);
        const milestone = document.createElement('div');
        milestone.className = this.isOverdue(task) ? 'gantt-milestone deadline-passed' : 'gantt-milestone';
        milestone.style.left = deadlinePx + 'px';
        milestone.title = `Deadline: ${this.formatDate(task.deadline)}`;
        row.appendChild(milestone);
      }
    });
  }

  renderSidebar() {
    const sidebar = document.getElementById('ganttSidebar');
    const showDone = document.getElementById('ganttShowDone')?.checked ?? true;
    let html = '';

    this.tasks.forEach(task => {
      if (task.status === 'done' && !showDone) return;
      if (task.status === 'rejected') return;

      const isSelected = task.id === this.selectedTaskId;
      const isOverdue = this.isOverdue(task);
      const selectedClass = isSelected ? 'selected' : '';
      const overdueClass = isOverdue ? 'overdue' : '';
      html += `
        <div class="gantt-sidebar-row ${selectedClass} ${overdueClass}" data-task-id="${task.id}" title="${task.title}">
          ${task.title.substring(0, 30)}
        </div>
      `;
    });

    sidebar.innerHTML = html;
    sidebar.querySelectorAll('.gantt-sidebar-row').forEach(el => {
      el.onclick = () => {
        this.selectedTaskId = parseInt(el.dataset.taskId);
        this.updateSidebarSelection();
      };
    });
  }

  updateSidebarSelection() {
    document.querySelectorAll('.gantt-sidebar-row').forEach(el => {
      el.classList.toggle('selected', parseInt(el.dataset.taskId) === this.selectedTaskId);
    });
  }

  attachEventListeners() {
    document.getElementById('ganttRefresh')?.addEventListener('click', () => this.render());
    document.getElementById('ganttShowDone')?.addEventListener('change', () => this.render());
    
    document.getElementById('ganttDateFrom')?.addEventListener('change', (e) => {
      this.startDate = new Date(e.target.value);
      this.render();
    });
    
    document.getElementById('ganttDateTo')?.addEventListener('change', (e) => {
      this.endDate = new Date(e.target.value);
      this.render();
    });
  }
}

let ganttInstance = null;

function initGantt(tasks, departments) {
  ganttInstance = new GanttChart('#ganttChart', tasks, departments);
}

function updateGantt(tasks, departments) {
  if (ganttInstance) {
    ganttInstance.tasks = tasks;
    ganttInstance.departments = departments;
    ganttInstance.render();
  }
}
