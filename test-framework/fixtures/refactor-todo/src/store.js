// Store module exists but is unused — all logic has been inlined into routes.
// This file is a ghost module kept only because tests import it.

let todos = [];
let nextId = 1;

function getAll() {
  return todos;
}

function create(data) {
  const todo = {
    id: String(nextId++),
    title: data.title,
    status: 'pending',
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

module.exports = { getAll, create, update, remove };
