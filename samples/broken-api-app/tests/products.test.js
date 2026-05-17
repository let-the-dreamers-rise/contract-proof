// Product API Tests
// This file demonstrates test drift issues

const request = require('supertest');
const app = require('../app');

// Test list products - This one is correct
test('GET /api/products should return list of products', async () => {
  const response = await request(app).get('/api/products');
  expect(response.status).toBe(200);
  expect(Array.isArray(response.body)).toBe(true);
});

// DRIFT: Tests old response schema { productId, productName, cost }
// Backend now returns { id, name, price }
test('GET /api/products/:id should return product', async () => {
  const response = await request(app).get('/api/products/1');
  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('productId');
  expect(response.body).toHaveProperty('productName');
  expect(response.body).toHaveProperty('cost');
});

// DRIFT: Tests endpoint that was removed
test('GET /api/products/featured should return featured products', async () => {
  const response = await request(app).get('/api/products/featured');
  expect(response.status).toBe(200);
  expect(Array.isArray(response.body)).toBe(true);
});

// Test create product - This one is correct
test('POST /api/products should create product', async () => {
  const productData = {
    name: 'Test Product',
    price: 99.99,
    description: 'Test description'
  };
  const response = await request(app).post('/api/products').send(productData);
  expect(response.status).toBe(201);
  expect(response.body).toHaveProperty('id');
});

// Test update product - This one is correct
test('PATCH /api/products/:id should update product', async () => {
  const updates = {
    price: 149.99
  };
  const response = await request(app).patch('/api/products/1').send(updates);
  expect(response.status).toBe(200);
  expect(response.body.price).toBe(149.99);
});

// DRIFT: Missing test for DELETE endpoint
// DELETE /api/products/:id is not tested

// Made with Bob
