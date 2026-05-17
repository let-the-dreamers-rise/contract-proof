// Order Management Routes
// This file demonstrates API drift scenarios related to orders

const express = require('express');
const router = express.Router();

// List all orders
router.get('/api/orders', (req, res) => {
  res.json([
    { 
      id: 1, 
      userId: 1, 
      items: [{ productId: 1, quantity: 2 }],
      total: 199.98,
      status: 'pending',
      paymentMethod: 'credit_card'
    },
    { 
      id: 2, 
      userId: 2, 
      items: [{ productId: 2, quantity: 1 }],
      total: 149.99,
      status: 'shipped',
      paymentMethod: 'paypal'
    }
  ]);
});

// Create order
router.post('/api/orders', (req, res) => {
  const { userId, items, paymentMethod } = req.body;
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  res.status(201).json({ 
    id: 1, 
    userId, 
    items, 
    total,
    status: 'pending',
    paymentMethod
  });
});

// DRIFT SCENARIO 6: New required field in request body
// Frontend doesn't send 'paymentMethod' field
router.put('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const { status, paymentMethod } = req.body;
  if (!paymentMethod) {
    return res.status(400).json({ error: 'paymentMethod is required' });
  }
  res.json({ 
    id, 
    status, 
    paymentMethod,
    updatedAt: new Date().toISOString()
  });
});

// Get order details
router.get('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  res.json({ 
    id, 
    userId: 1, 
    items: [{ productId: 1, quantity: 2, price: 99.99 }],
    total: 199.98,
    status: 'pending',
    paymentMethod: 'credit_card',
    createdAt: '2024-01-01T00:00:00Z'
  });
});

// Delete order
router.delete('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  res.status(204).send();
});

module.exports = router;

// Made with Bob
