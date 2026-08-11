const express = require('express');
const store = require('../store');

const router = express.Router();

router.get('/', (req, res) => {
  const todos = store.getAll();
  res.json(todos);
});

router.post('/', (req, res) => {
  const { title, urgency, dueDate } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (urgency && ![1, 2, 3].includes(urgency)) {
    return res.status(400).json({ error: 'urgency must be 1, 2, or 3' });
  }
  const todo = store.create({ title, urgency, dueDate });
  res.status(201).json(todo);
});

router.patch('/:id', (req, res) => {
  const { status } = req.body;
  const todo = store.update(req.params.id, { status });
  if (!todo) {
    return res.status(404).json({ error: 'todo not found' });
  }
  res.json(todo);
});

router.delete('/:id', (req, res) => {
  const deleted = store.remove(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'todo not found' });
  }
  res.status(204).send();
});

module.exports = router;
