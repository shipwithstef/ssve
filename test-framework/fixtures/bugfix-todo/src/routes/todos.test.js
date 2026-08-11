const { describe, it } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../index');

describe('POST /todos', () => {
  it('should create a todo with the provided title', async () => {
    const res = await request(app)
      .post('/todos')
      .send({ title: 'Buy milk' })
      .expect(201);

    assert.strictEqual(res.body.title, 'Buy milk');
  });

  it('should reject a todo without a title', async () => {
    const res = await request(app)
      .post('/todos')
      .send({})
      .expect(400);

    assert.strictEqual(res.body.error, 'title is required');
  });
});
