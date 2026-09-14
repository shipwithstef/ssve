let todos = [];
let nextId = 1;

function getAll() {
  return todos.sort((a, b) => a.createdAt - b.createdAt);
}

function create(data) {
  const todo = {
    id: String(nextId++),
    title: data.title,
    status: 'pending',
    urgency: data.urgency || 2,
    createdAt: Date.now(),
    dueDate: data.dueDate || null,
    completedAt: null,
  };
  todos.push(todo);
  return todo;
}

function update(id, changes) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return null;
  if (changes.status) {
    todo.status = changes.status;
    if (changes.status === 'done') {
      todo.completedAt = Date.now();
    }
  }
  return todo;
}

function remove(id) {
  const idx = todos.findIndex(t => t.id === id);
  if (idx === -1) return false;
  todos.splice(idx, 1);
  return true;
}

function markOverdue() {
  const now = Date.now();
  for (const todo of todos) {
    if (todo.status === 'pending' && todo.dueDate && Date.parse(todo.dueDate) < now) {
      todo.status = 'overdue';
    }
  }
}

module.exports = { getAll, create, update, remove, markOverdue };
