const express = require('express');
const store = require('../store');

const router = express.Router();

router.get('/', (req, res) => {
  const todos = store.getAll();
  res.json(todos);
});

router.post('/', (req, res) => {
  const { titel, dueDate } = req.body;
  if (!titel) {
    return res.status(400).json({ error: 'title is required' });
  }
  const todo = store.create({ title: titel, dueDate });
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
