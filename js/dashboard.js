// dashboard.js - Dashboard dengan thống kê và metrics

class Dashboard {
  constructor(containerSelector, tasks, departments) {
    this.container = document.querySelector(containerSelector);
    this.tasks = tasks || [];
    this.departments = departments || [];
    this.render();
  }

  getStats() {
    const stats = {
      total: this.tasks.length,
      new: this.tasks.filter(t => t.status === 'new').length,
      accepted: this.tasks.filter(t => t.status === 'accepted').length,
      in_progress: this.tasks.filter(t => t.status === 'in_progress').length,
      done: this.tasks.filter(t => t.status === 'done').length,
      overdue: this.tasks.filter(t => t.status === 'overdue').length,
      rejected: this.tasks.filter(t => t.status === 'rejected').length,
      high_priority: this.tasks.filter(t => t.priority === 'high' && t.status !== 'done').length,
      completion_rate: Math.round((this.tasks.filter(t => t.status === 'done').length / Math.max(this.tasks.length, 1)) * 100)
    };
    return stats;
  }

  getTasksByDept() {
    const byDept = {};
    this.departments.forEach(dept => {
      byDept[dept.name] = {
        total: 0,
        done: 0,
        pending: 0,
        overdue: 0
      };
    });

    this.tasks.forEach(task => {
      if (task.assigneeType === 'department' && byDept[task.assigneeValue]) {
        byDept[task.assigneeValue].total++;
        if (task.status === 'done') byDept[task.assigneeValue].done++;
        else if (task.status === 'overdue') byDept[task.assigneeValue].overdue++;
        else byDept[task.assigneeValue].pending++;
      }
    });

    return byDept;
  }

  getRecentActivity() {
    return this.tasks
      .filter(t => t.updatedAt)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 5);
  }

  render() {
    const stats = this.getStats();
    const tasksByDept = this.getTasksByDept();
    const recentActivity = this.getRecentActivity();

    const html = `
      <div style="display: grid; gap: 20px;">
        <!-- Summary Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
          <div class="dashboard-card">
            <div class="dashboard-card-title">📊 Tổng công việc</div>
            <div class="dashboard-card-value">${stats.total}</div>
          </div>
          <div class="dashboard-card">
            <div class="dashboard-card-title">✅ Hoàn thành</div>
            <div class="dashboard-card-value" style="color: var(--ok);">${stats.done}/${stats.total}</div>
            <div style="font-size: 11px; color: var(--ink-soft); margin-top: 4px;">Tỷ lệ: ${stats.completion_rate}%</div>
          </div>
          <div class="dashboard-card">
            <div class="dashboard-card-title">⚠️ Quá hạn</div>
            <div class="dashboard-card-value" style="color: var(--danger);">${stats.overdue}</div>
          </div>
          <div class="dashboard-card">
            <div class="dashboard-card-title">⏳ Đang xử lý</div>
            <div class="dashboard-card-value" style="color: var(--warn);">${stats.in_progress}</div>
          </div>
          <div class="dashboard-card">
            <div class="dashboard-card-title">🔴 Ưu tiên cao</div>
            <div class="dashboard-card-value" style="color: #c9302c;">${stats.high_priority}</div>
          </div>
          <div class="dashboard-card">
            <div class="dashboard-card-title">📋 Mới giao</div>
            <div class="dashboard-card-value" style="color: var(--navy-2);">${stats.new}</div>
          </div>
        </div>

        <!-- Completion Progress -->
        <div class="panel">
          <h2>Tiến độ hoàn thành</h2>
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="flex: 1;">
              <div style="height: 24px; background: var(--line); border-radius: 12px; overflow: hidden;">
                <div style="height: 100%; background: linear-gradient(90deg, var(--ok), #66bb6a); width: ${stats.completion_rate}%; transition: width 0.3s;"></div>
              </div>
            </div>
            <div style="font-weight: 600; font-size: 16px; color: var(--ok); min-width: 50px;">${stats.completion_rate}%</div>
          </div>
        </div>

        <!-- Department Performance -->
        <div class="panel">
          <h2>Hiệu suất theo bộ phận</h2>
          <table>
            <thead>
              <tr>
                <th>Bộ phận</th>
                <th>Tổng</th>
                <th>Hoàn thành</th>
                <th>Đang xử lý</th>
                <th>Quá hạn</th>
                <th>Tỷ lệ</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(tasksByDept).map(([deptName, data]) => {
                const rate = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
                return `
                  <tr>
                    <td><strong>${this.escapeHtml(deptName)}</strong></td>
                    <td>${data.total}</td>
                    <td style="color: var(--ok); font-weight: 600;">${data.done}</td>
                    <td style="color: var(--warn);">${data.pending}</td>
                    <td style="color: var(--danger); font-weight: 600;">${data.overdue}</td>
                    <td>
                      <div style="display: flex; align-items: center; gap: 8px; font-size: 12px;">
                        <div style="width: 60px; height: 6px; background: var(--line); border-radius: 3px; overflow: hidden;">
                          <div style="height: 100%; background: var(--ok); width: ${rate}%;"></div>
                        </div>
                        <span>${rate}%</span>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Recent Activity -->
        <div class="panel">
          <h2>Hoạt động gần đây</h2>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${recentActivity.map(task => {
              const time = new Date(task.updatedAt);
              const timeStr = `${time.getDate().toString().padStart(2, '0')}/${(time.getMonth() + 1).toString().padStart(2, '0')} ${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
              return `
                <div style="padding: 10px; background: #f9fafc; border-radius: 6px; border-left: 3px solid var(--navy-2); cursor: pointer; transition: all 0.2s;" onclick="openTaskDetail(${task.id}, null, null)" onmouseover="this.style.background='#f0f5fb'" onmouseout="this.style.background='#f9fafc'">
                  <div style="font-weight: 500; font-size: 13px; color: var(--navy);">${this.escapeHtml(task.title)}</div>
                  <div style="font-size: 11px; color: var(--ink-soft); margin-top: 4px;">
                    <span class="badge badge-${task.status}" style="font-size: 10px;">${this.getStatusLabel(task.status)}</span>
                    · ${timeStr}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    this.container.innerHTML = html;
  }

  getStatusLabel(status) {
    const labels = {
      'new': 'Mới giao',
      'accepted': 'Đã nhận',
      'in_progress': 'Đang xử lý',
      'done': 'Hoàn thành',
      'overdue': 'Quá hạn',
      'rejected': 'Từ chối'
    };
    return labels[status] || status;
  }

  escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

let dashboardInstance = null;

function initDashboard(tasks, departments) {
  dashboardInstance = new Dashboard('#dashboard', tasks, departments);
}

function updateDashboard(tasks, departments) {
  if (dashboardInstance) {
    dashboardInstance.tasks = tasks;
    dashboardInstance.departments = departments;
    dashboardInstance.render();
  }
}
