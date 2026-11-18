export const TASK_STORAGE_KEY = "koyal-ai-tasks-v1";
export const MAX_TASKS = 100;
export const MAX_TASK_TITLE_LENGTH = 160;
export const MAX_TASK_NOTES_LENGTH = 500;

export function normalizeTasks(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const tasks = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const id = typeof item.id === "string" ? item.id.trim().slice(0, 100) : "";
    const title = typeof item.title === "string" ? item.title.trim().slice(0, MAX_TASK_TITLE_LENGTH) : "";
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    tasks.push({
      id, title,
      notes: typeof item.notes === "string" ? item.notes.trim().slice(0, MAX_TASK_NOTES_LENGTH) : "",
      dueDate: typeof item.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) ? item.dueDate : "",
      done: item.done === true,
      createdAt: typeof item.createdAt === "number" && Number.isFinite(item.createdAt) ? item.createdAt : 0,
    });
    if (tasks.length >= MAX_TASKS) break;
  }
  return tasks;
}
export function loadTasks(storage) {
  try { const raw = storage?.getItem(TASK_STORAGE_KEY); return raw ? normalizeTasks(JSON.parse(raw)) : []; }
  catch { return []; }
}
export function saveTasks(storage, tasks) {
  try { storage?.setItem(TASK_STORAGE_KEY, JSON.stringify(normalizeTasks(tasks))); return Boolean(storage); }
  catch { return false; }
}
export function addTask(storage, tasks, title, options = {}) {
  const current = normalizeTasks(tasks);
  const clean = typeof title === "string" ? title.trim() : "";
  if (!clean) throw new Error("Enter a task title.");
  if (clean.length > MAX_TASK_TITLE_LENGTH) throw new Error(`Keep task titles under ${MAX_TASK_TITLE_LENGTH} characters.`);
  if (current.length >= MAX_TASKS) throw new Error(`You can save up to ${MAX_TASKS} tasks.`);
  const task = {
    id: typeof options.id === "string" && options.id ? options.id : (globalThis.crypto?.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    title: clean,
    notes: typeof options.notes === "string" ? options.notes.trim().slice(0, MAX_TASK_NOTES_LENGTH) : "",
    dueDate: typeof options.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(options.dueDate) ? options.dueDate : "",
    done: false,
    createdAt: typeof options.createdAt === "number" ? options.createdAt : Date.now(),
  };
  const next = [task, ...current];
  if (!saveTasks(storage, next)) throw new Error("Could not save tasks in this browser.");
  return next;
}
export function updateTask(storage, tasks, id, changes) {
  const current = normalizeTasks(tasks);
  const next = current.map((task) => task.id !== id ? task : {
    ...task,
    ...(typeof changes.done === "boolean" ? { done: changes.done } : {}),
    ...(typeof changes.title === "string" && changes.title.trim() ? { title: changes.title.trim().slice(0, MAX_TASK_TITLE_LENGTH) } : {}),
  });
  if (!saveTasks(storage, next)) throw new Error("Could not update this task.");
  return next;
}
export function deleteTask(storage, tasks, id) {
  const next = normalizeTasks(tasks).filter((task) => task.id !== id);
  if (!saveTasks(storage, next)) throw new Error("Could not delete this task.");
  return next;
}
