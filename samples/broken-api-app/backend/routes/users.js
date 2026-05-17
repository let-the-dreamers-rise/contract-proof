// User Management Routes
// This file demonstrates several API drift scenarios

const express = require('express');
const router = express.Router();

// List all users
router.get('/api/users', (req, res) => {
  res.json([
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
  ]);
});

// DRIFT SCENARIO 1: Route renamed but frontend not updated
// Old route: /api/users/:id
// New route: /api/v2/users/:userId
router.get('/api/v2/users/:userId', (req, res) => {
  const { userId } = req.params;
  res.json({ id: userId, name: 'John Doe', email: 'john@example.com' });
});

// DRIFT SCENARIO 2: Method changed from POST to PUT
// Frontend still uses POST
router.put('/api/users', (req, res) => {
  const { name, email } = req.body;
  res.status(201).json({ id: 1, name, email });
});

// DRIFT SCENARIO 3: New required query parameter added
// Frontend doesn't send 'status' parameter
router.get('/api/users/search', (req, res) => {
  const { query, status } = req.query;
  if (!status) {
    return res.status(400).json({ error: 'status parameter is required' });
  }
  res.json([
    { id: 1, name: 'John Doe', status: status }
  ]);
});

// Update user (PATCH is the correct method for partial updates)
router.patch('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  res.json({ id, ...updates });
});

// Delete user
router.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  res.status(204).send();
});

module.exports = router;

// Made with Bob
