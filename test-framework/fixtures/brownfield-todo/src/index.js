const express = require('express');
const todosRouter = require('./routes/todos');

const app = express();
app.use(express.json());
app.use('/todos', todosRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
