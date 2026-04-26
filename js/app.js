// Life Dashboard — app.js
// Modules: GreetingModule, FocusTimer, TaskManager, QuickLinks


// ---------------------------------------------------------------------------
// Storage Utility
// ---------------------------------------------------------------------------
const Storage = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? null;
    } catch {
      return null;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn('Storage.set failed for key "' + key + '":', err);
    }
  },
};

// ---------------------------------------------------------------------------
// GreetingModule
// ---------------------------------------------------------------------------
const GreetingModule = window.GreetingModule = {
  getGreeting(hour) {
    if (hour >= 5 && hour <= 11) return 'Good morning';
    if (hour >= 12 && hour <= 17) return 'Good afternoon';
    if (hour >= 18 && hour <= 21) return 'Good evening';
    return 'Good night';
  },

  formatTime(date) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
  },

  formatDate(date) {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  },

  _render() {
    const now = new Date();
    const greetingEl = document.getElementById('greeting-text');
    const timeEl = document.getElementById('time-display');
    const dateEl = document.getElementById('date-display');
    const name = Storage.get('userName');

    if (greetingEl) {
      const base = GreetingModule.getGreeting(now.getHours());
      greetingEl.textContent = name ? base + ', ' + name + '!' : base;
    }
    if (timeEl) timeEl.textContent = GreetingModule.formatTime(now);
    if (dateEl) dateEl.textContent = GreetingModule.formatDate(now);
  },

  init() {
    GreetingModule._render();
    setInterval(GreetingModule._render, 60 * 1000);

    // Pre-fill saved name
    const nameInput = document.getElementById('name-input');
    const savedName = Storage.get('userName');
    if (nameInput && savedName) nameInput.value = savedName;

    const form = document.getElementById('name-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const val = nameInput ? nameInput.value.trim() : '';
        if (val) {
          Storage.set('userName', val);
        } else {
          Storage.set('userName', null);
        }
        GreetingModule._render();
      });
    }
  },
};

// ---------------------------------------------------------------------------
// FocusTimer
// ---------------------------------------------------------------------------
const FocusTimer = window.FocusTimer = {
  remaining: 1500,
  duration: 1500,
  _intervalId: null,
  _endAtMs: null,

  formatTime(seconds) {
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    return mm + ':' + ss;
  },

  _render() {
    const display = document.getElementById('timer-display');
    if (display) display.textContent = FocusTimer.formatTime(FocusTimer.remaining);
  },

  _syncRemainingFromEndAt() {
    if (FocusTimer._endAtMs === null) return;
    const diffMs = FocusTimer._endAtMs - Date.now();
    const nextRemaining = Math.max(0, Math.ceil(diffMs / 1000));
    FocusTimer.remaining = nextRemaining;
  },

  _completeIfNeeded() {
    if (FocusTimer.remaining > 0) return false;
    FocusTimer.stop();
    FocusTimer.remaining = 0;
    FocusTimer._render();
    const completion = document.getElementById('timer-completion');
    if (completion) completion.classList.remove('hidden');
    return true;
  },

  start() {
    if (FocusTimer._intervalId !== null) return;
    if (FocusTimer.remaining <= 0) FocusTimer.remaining = FocusTimer.duration;

    const completion = document.getElementById('timer-completion');
    if (completion) completion.classList.add('hidden');

    FocusTimer._endAtMs = Date.now() + FocusTimer.remaining * 1000;

    const tick = function () {
      FocusTimer._syncRemainingFromEndAt();
      FocusTimer._render();
      FocusTimer._completeIfNeeded();
    };

    tick();
    FocusTimer._intervalId = setInterval(tick, 1000);
  },

  stop() {
    if (FocusTimer._intervalId !== null) {
      clearInterval(FocusTimer._intervalId);
      FocusTimer._intervalId = null;
    }
    FocusTimer._syncRemainingFromEndAt();
    FocusTimer._endAtMs = null;
    FocusTimer._render();
  },

  reset() {
    FocusTimer.stop();
    FocusTimer.remaining = FocusTimer.duration;
    FocusTimer._render();
    const completion = document.getElementById('timer-completion');
    if (completion) completion.classList.add('hidden');
  },

  setDuration(minutes) {
    const mins = parseInt(minutes, 10);
    if (!mins || mins < 1 || mins > 120) return;
    FocusTimer.stop();
    FocusTimer.duration = mins * 60;
    FocusTimer.remaining = FocusTimer.duration;
    FocusTimer._render();
    Storage.set('timerDuration', mins);
    const completion = document.getElementById('timer-completion');
    if (completion) completion.classList.add('hidden');
  },

  init() {
    const savedMins = Storage.get('timerDuration');
    if (savedMins) {
      FocusTimer.duration = savedMins * 60;
    }
    FocusTimer.remaining = FocusTimer.duration;
    FocusTimer._render();

    const durationInput = document.getElementById('timer-duration-input');
    if (durationInput) durationInput.value = FocusTimer.duration / 60;

    const startBtn = document.getElementById('timer-start');
    const stopBtn = document.getElementById('timer-stop');
    const resetBtn = document.getElementById('timer-reset');
    if (startBtn) startBtn.addEventListener('click', function () { FocusTimer.start(); });
    if (stopBtn) stopBtn.addEventListener('click', function () { FocusTimer.stop(); });
    if (resetBtn) resetBtn.addEventListener('click', function () { FocusTimer.reset(); });

    const durationForm = document.getElementById('timer-duration-form');
    if (durationForm) {
      durationForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (durationInput) FocusTimer.setDuration(durationInput.value);
      });
    }

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        FocusTimer._syncRemainingFromEndAt();
        FocusTimer._render();
        FocusTimer._completeIfNeeded();
      }
    });
  },
};

// ---------------------------------------------------------------------------
// TaskManager
// ---------------------------------------------------------------------------
const TaskManager = window.TaskManager = {
  tasks: [],

  addTask(label) {
    const trimmed = label.trim();
    if (!trimmed) return false;
    // Prevent duplicate (case-insensitive)
    const duplicate = TaskManager.tasks.some(function (t) {
      return t.label.toLowerCase() === trimmed.toLowerCase();
    });
    if (duplicate) return 'duplicate';
    const task = { id: String(Date.now()), label: trimmed, completed: false };
    TaskManager.tasks.push(task);
    TaskManager.save();
    TaskManager.render();
    return true;
  },

  editTask(id, newLabel) {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    const task = TaskManager.tasks.find(function (t) { return t.id === id; });
    if (!task) return;
    task.label = trimmed;
    TaskManager.save();
    TaskManager.render();
  },

  toggleTask(id) {
    const task = TaskManager.tasks.find(function (t) { return t.id === id; });
    if (!task) return;
    task.completed = !task.completed;
    TaskManager.save();
    TaskManager.render();
  },

  deleteTask(id) {
    TaskManager.tasks = TaskManager.tasks.filter(function (t) { return t.id !== id; });
    TaskManager.save();
    TaskManager.render();
  },

  save() {
    Storage.set('tasks', TaskManager.tasks);
  },

  render() {
    const list = document.getElementById('task-list');
    if (!list) return;
    list.innerHTML = '';
    TaskManager.tasks.forEach(function (task) {
      const li = document.createElement('li');
      if (task.completed) li.classList.add('completed');

      const labelSpan = document.createElement('span');
      labelSpan.className = 'task-label';
      labelSpan.textContent = task.label;

      const editInput = document.createElement('input');
      editInput.type = 'text';
      editInput.className = 'task-edit-input hidden';
      editInput.value = task.label;

      const editBtn = document.createElement('button');
      editBtn.className = 'task-edit-btn';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', function () {
        editInput.value = task.label;
        labelSpan.classList.add('hidden');
        editInput.classList.remove('hidden');
        editBtn.classList.add('hidden');
        confirmBtn.classList.remove('hidden');
      });

      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'task-confirm-btn hidden';
      confirmBtn.textContent = 'Save';
      confirmBtn.addEventListener('click', function () {
        TaskManager.editTask(task.id, editInput.value);
      });

      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'task-toggle-btn';
      toggleBtn.textContent = task.completed ? 'Undo' : 'Done';
      toggleBtn.addEventListener('click', function () {
        TaskManager.toggleTask(task.id);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'task-delete-btn';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', function () {
        TaskManager.deleteTask(task.id);
      });

      li.appendChild(toggleBtn);
      li.appendChild(labelSpan);
      li.appendChild(editInput);
      li.appendChild(editBtn);
      li.appendChild(confirmBtn);
      li.appendChild(deleteBtn);
      list.appendChild(li);
    });
  },

  init() {
    TaskManager.tasks = Storage.get('tasks') ?? [];
    TaskManager.render();
    const form = document.getElementById('task-form');
    const dupMsg = document.getElementById('task-duplicate-msg');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const input = document.getElementById('task-input');
        if (input) {
          const result = TaskManager.addTask(input.value);
          if (result === 'duplicate') {
            if (dupMsg) {
              dupMsg.classList.remove('hidden');
              setTimeout(function () { dupMsg.classList.add('hidden'); }, 2500);
            }
          } else if (result === true) {
            input.value = '';
            if (dupMsg) dupMsg.classList.add('hidden');
          }
        }
      });
    }
  },
};

// ---------------------------------------------------------------------------
// QuickLinks
// ---------------------------------------------------------------------------
const QuickLinks = window.QuickLinks = {
  links: [],

  addLink(label, url) {
    const trimmedLabel = label.trim();
    const trimmedUrl = url.trim();
    if (!trimmedLabel || !trimmedUrl) return;
    const link = { id: String(Date.now()), label: trimmedLabel, url: trimmedUrl };
    QuickLinks.links.push(link);
    QuickLinks.save();
    QuickLinks.render();
  },

  deleteLink(id) {
    QuickLinks.links = QuickLinks.links.filter(function (l) { return l.id !== id; });
    QuickLinks.save();
    QuickLinks.render();
  },

  save() {
    Storage.set('links', QuickLinks.links);
  },

  render() {
    const list = document.getElementById('links-list');
    if (!list) return;
    list.innerHTML = '';
    QuickLinks.links.forEach(function (link) {
      const li = document.createElement('li');

      const anchor = document.createElement('a');
      anchor.href = link.url;
      anchor.textContent = link.label;
      anchor.target = '_blank';
      anchor.rel = 'noopener';

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'link-delete-btn';
      deleteBtn.textContent = '×';
      deleteBtn.setAttribute('aria-label', 'Delete ' + link.label);
      deleteBtn.addEventListener('click', function () {
        QuickLinks.deleteLink(link.id);
      });

      li.appendChild(anchor);
      li.appendChild(deleteBtn);
      list.appendChild(li);
    });
  },

  init() {
    QuickLinks.links = Storage.get('links') ?? [];
    QuickLinks.render();
    const form = document.getElementById('links-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const labelInput = document.getElementById('link-label-input');
        const urlInput = document.getElementById('link-url-input');
        if (labelInput && urlInput) {
          QuickLinks.addLink(labelInput.value, urlInput.value);
          labelInput.value = '';
          urlInput.value = '';
        }
      });
    }
  },
};

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function () {
  GreetingModule.init();
  FocusTimer.init();
  TaskManager.init();
  QuickLinks.init();
});
