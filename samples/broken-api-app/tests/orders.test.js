// Order API Tests
// This file demonstrates test drift issues

const request = require('supertest');
const app = require('../app');

// Test list orders - This one is correct
test('GET /api/orders should return list of orders', async () => {
  const response = await request(app).get('/api/orders');
  expect(response.status).toBe(200);
  expect(Array.isArray(response.body)).toBe(true);
});

// Test create order - This one is correct
test('POST /api/orders should create order', async () => {
  const orderData = {
    userId: 1,
    items: [
      { productId: 1, quantity: 2, price: 99.99 }
    ],
    paymentMethod: 'credit_card'
  };
  const response = await request(app).post('/api/orders').send(orderData);
  expect(response.status).toBe(201);
  expect(response.body).toHaveProperty('id');
  expect(response.body).toHaveProperty('total');
});

// DRIFT: Missing 'paymentMethod' field in update test
test('PUT /api/orders/:id should update order', async () => {
  const updates = {
    status: 'shipped'
  };
  const response = await request(app).put('/api/orders/1').send(updates);
  expect(response.status).toBe(200);
  expect(response.body.status).toBe('shipped');
});

// DRIFT: Missing test for GET /api/orders/:id
// GET /api/orders/:id is not tested

// DRIFT: Missing test for DELETE endpoint
// DELETE /api/orders/:id is not tested

// Made with Bob
