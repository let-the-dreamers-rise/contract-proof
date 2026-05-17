// User API Service
// This file demonstrates frontend API calls with drift issues

import axios from 'axios';

// DRIFT: Backend route is now /api/v2/users/:userId but frontend uses old path
export const getUser = async (id) => {
  const response = await axios.get(`/api/users/${id}`);
  return response.data;
};

// DRIFT: Backend changed to PUT but frontend still uses POST
export const createUser = async (userData) => {
  const response = await axios.post('/api/users', userData);
  return response.data;
};

// DRIFT: Missing required 'status' query parameter
export const searchUsers = async (query) => {
  const response = await axios.get(`/api/users/search?query=${query}`);
  return response.data;
};

// List all users - This one is correct
export const listUsers = async () => {
  const response = await axios.get('/api/users');
  return response.data;
};

// Update user - This one is correct (uses PATCH)
export const updateUser = async (id, updates) => {
  const response = await axios.patch(`/api/users/${id}`, updates);
  return response.data;
};

// Delete user - This one is correct
export const deleteUser = async (id) => {
  const response = await axios.delete(`/api/users/${id}`);
  return response.data;
};

// Made with Bob
