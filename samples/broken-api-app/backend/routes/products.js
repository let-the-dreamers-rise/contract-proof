// Product Management Routes
// This file demonstrates API drift scenarios related to products

const express = require('express');
const router = express.Router();

// List all products
router.get('/api/products', (req, res) => {
  res.json([
    { id: 1, name: 'Product A', price: 99.99 },
    { id: 2, name: 'Product B', price: 149.99 }
  ]);
});

// DRIFT SCENARIO 4: Response schema changed
// Old schema: { productId, productName, cost }
// New schema: { id, name, price }
router.get('/api/products/:id', (req, res) => {
  const { id } = req.params;
  res.json({ 
    id, 
    name: 'Product Name',
    price: 99.99,
    // DRIFT SCENARIO 4: Response schema changed
    // Frontend expects: productId, productName, cost
    // Backend now returns: id, name, price
    description: 'Product description',
    inStock: true
  });
});

// Create product
router.post('/api/products', (req, res) => {
  const { name, price, description } = req.body;
  res.status(201).json({ 
    id: 1, 
    name, 
    price, 
    description 
  });
});

// Update product
router.patch('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  res.json({ id, ...updates });
});

// Delete product
router.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  res.status(204).send();
});

// DRIFT SCENARIO 5: This endpoint was removed
// Frontend still calls /api/products/featured but it doesn't exist here
// The endpoint was removed during refactoring

module.exports = router;

// Made with Bob
