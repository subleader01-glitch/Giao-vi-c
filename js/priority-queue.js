// priority-queue.js - Priority queue auto-sort logic

class PriorityQueue {
  constructor() {
    this.PRIORITY_WEIGHT = { high: 3, normal: 2, low: 1 };
  }

  /**
   * Tính priority score dựa vào:
   * - Priority level (cao/thấp)
   * - Deadline (gần deadline thì cao hơn)
   * - Status (new > accepted > in_progress > done)
   * - Overdue (quá hạn thì cao nhất)
   */
  calculateScore(task) {
    let score = 0;

    // 1. Overdue: cao nhất (1000+)
    if (task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done') {
      const daysOverdue = Math.ceil((new Date() - new Date(task.deadline)) / (1000 * 60 * 60 * 24));
      score += 10000 + daysOverdue * 100;
    }

    // 2. Priority level: (100-300)
    score += (this.PRIORITY_WEIGHT[task.priority] || 2) * 100;

    // 3. Deadline proximity: (0-1000)
    if (task.deadline) {
      const daysUntilDeadline = Math.ceil((new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilDeadline > 0) {
        score += Math.max(1000 - daysUntilDeadline * 50, 0);
      }
    }

    // 4. Status progression: (1-4)
    const statusWeight = { 'new': 4, 'accepted': 3, 'in_progress': 2, 'done': 0, 'overdue': 5, 'rejected': 0 };
    score += (statusWeight[task.status] || 0) * 10;

    return score;
  }

  /**
   * Sort tasks theo priority
   */
  sort(tasks) {
    return tasks.slice().sort((a, b) => {
      const scoreA = this.calculateScore(a);
      const scoreB = this.calculateScore(b);
      return scoreB - scoreA; // descending (cao nhất trước)
    });
  }

  /**
   * Group tasks theo priority level để hiển thị
   */
  groupByPriority(tasks) {
    const groups = {
      urgent: [], // quá hạn
      high: [],
      normal: [],
      low: [],
      done: []
    };

    tasks.forEach(task => {
      if (task.status === 'done' || task.status === 'rejected') {
        groups.done.push(task);
      } else if (task.deadline && new Date(task.deadline) < new Date()) {
        groups.urgent.push(task);
      } else if (task.priority === 'high') {
        groups.high.push(task);
      } else if (task.priority === 'normal') {
        groups.normal.push(task);
      } else {
        groups.low.push(task);
      }
    });

    return groups;
  }

  /**
   * Tính estimated completion time dựa trên priority queue
   */
  estimateCompletionTime(tasks, avgTimePerTaskMinutes = 120) {
    const sorted = this.sort(tasks.filter(t => t.status !== 'done' && t.status !== 'rejected'));
    const totalMinutes = sorted.length * avgTimePerTaskMinutes;
    return {
      tasks: sorted.length,
      totalMinutes,
      estimatedHours: Math.round(totalMinutes / 60),
      estimatedDays: Math.round(totalMinutes / 60 / 8),
      estimatedDate: new Date(Date.now() + totalMinutes * 60 * 1000)
    };
  }
}

const priorityQueue = new PriorityQueue();

function getPrioritySortedTasks(tasks) {
  return priorityQueue.sort(tasks);
}

function getGroupedTasks(tasks) {
  return priorityQueue.groupByPriority(tasks);
}

function estimateWorkload(tasks) {
  return priorityQueue.estimateCompletionTime(tasks);
}
