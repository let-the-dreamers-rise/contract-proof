// User API Tests
// This file demonstrates test drift issues

const request = require('supertest');
const app = require('../app');

// DRIFT: Tests old endpoint /api/users/:id instead of /api/v2/users/:userId
test('GET /api/users/:id should return user', async () => {
  const response = await request(app).get('/api/users/1');
  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('id');
  expect(response.body).toHaveProperty('name');
});

// Test list users - This one is correct
test('GET /api/users should return list of users', async () => {
  const response = await request(app).get('/api/users');
  expect(response.status).toBe(200);
  expect(Array.isArray(response.body)).toBe(true);
});

// DRIFT: Tests POST but backend now uses PUT
test('POST /api/users should create user', async () => {
  const userData = {
    name: 'Test User',
    email: 'test@example.com'
  };
  const response = await request(app).post('/api/users').send(userData);
  expect(response.status).toBe(201);
  expect(response.body).toHaveProperty('id');
});

// DRIFT: Missing 'status' parameter in search test
test('GET /api/users/search should return matching users', async () => {
  const response = await request(app).get('/api/users/search?query=john');
  expect(response.status).toBe(200);
  expect(Array.isArray(response.body)).toBe(true);
});

// Test update user - This one is correct
test('PATCH /api/users/:id should update user', async () => {
  const updates = {
    name: 'Updated Name'
  };
  const response = await request(app).patch('/api/users/1').send(updates);
  expect(response.status).toBe(200);
  expect(response.body.name).toBe('Updated Name');
});

// DRIFT: Missing test for DELETE endpoint
// DELETE /api/users/:id is not tested

// Made with Bob
