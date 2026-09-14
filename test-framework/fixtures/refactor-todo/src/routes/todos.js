const express = require('express');

const router = express.Router();

// Inlined store — no separation of concerns
let todos = [];
let nextId = 1;

router.get('/', (req, res) => {
  // Inline sorting logic duplicated from other places
  const sorted = todos.sort((a, b) => a.createdAt - b.createdAt);
  res.json(sorted);
});

router.post('/', (req, res) => {
  const { title, dueDate } = req.body;
  // Duplicate validation block 1 of 3
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (typeof title !== 'string') {
    return res.status(400).json({ error: 'title must be a string' });
  }
  if (title.length > 200) {
    return res.status(400).json({ error: 'title too long' });
  }

  const todo = {
    id: String(nextId++),
    title: title,
    status: 'pending',
    createdAt: Date.now(),
    dueDate: dueDate || null,
    completedAt: null,
  };
  todos.push(todo);
  res.status(201).json(todo);
});

router.patch('/:id', (req, res) => {
  const { status } = req.body;

  // Inline find logic — duplicated in DELETE
  let foundIndex = -1;
  for (let i = 0; i < todos.length; i++) {
    if (todos[i].id === req.params.id) {
      foundIndex = i;
      break;
    }
  }
  if (foundIndex === -1) {
    return res.status(404).json({ error: 'todo not found' });
  }

  const todo = todos[foundIndex];

  // Status update with side effects — multiple responsibilities in one handler
  if (status) {
    const validStatuses = ['pending', 'done', 'overdue'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'invalid status' });
    }
    todo.status = status;
    if (status === 'done') {
      todo.completedAt = Date.now();
    }
  }

  // Duplicate validation block 2 of 3 — also checks title on PATCH for no reason
  if (req.body.title) {
    if (typeof req.body.title !== 'string') {
      return res.status(400).json({ error: 'title must be a string' });
    }
    if (req.body.title.length > 200) {
      return res.status(400).json({ error: 'title too long' });
    }
    todo.title = req.body.title;
  }

  res.json(todo);
});

router.delete('/:id', (req, res) => {
  // Inline find logic — duplicated from PATCH
  let foundIndex = -1;
  for (let i = 0; i < todos.length; i++) {
    if (todos[i].id === req.params.id) {
      foundIndex = i;
      break;
    }
  }
  if (foundIndex === -1) {
    return res.status(404).json({ error: 'todo not found' });
  }

  todos.splice(foundIndex, 1);
  res.status(204).send();
});

// Overdue checker cron endpoint — also inlined in routes file
router.post('/check-overdue', (req, res) => {
  const now = Date.now();
  let count = 0;
  for (const todo of todos) {
    if (todo.status === 'pending' && todo.dueDate) {
      const due = Date.parse(todo.dueDate);
      if (due < now) {
        todo.status = 'overdue';
        count++;
      }
    }
  }
  res.json({ updated: count });
});

// Duplicate validation block 3 of 3 — a bulk create endpoint that nobody asked for
router.post('/bulk', (req, res) => {
  const items = req.body.items || [];
  const created = [];
  for (const item of items) {
    if (!item.title) {
      return res.status(400).json({ error: 'title is required' });
    }
    if (typeof item.title !== 'string') {
      return res.status(400).json({ error: 'title must be a string' });
    }
    if (item.title.length > 200) {
      return res.status(400).json({ error: 'title too long' });
    }
    const todo = {
      id: String(nextId++),
      title: item.title,
      status: 'pending',
      createdAt: Date.now(),
      dueDate: item.dueDate || null,
      completedAt: null,
    };
    todos.push(todo);
    created.push(todo);
  }
  res.status(201).json({ created });
});

module.exports = router;
