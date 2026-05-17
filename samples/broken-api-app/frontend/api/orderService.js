// Order API Service
// This file demonstrates frontend API calls with drift issues

import axios from 'axios';

// List all orders - This one is correct
export const listOrders = async () => {
  const response = await axios.get('/api/orders');
  return response.data;
};

// Get order details - This one is correct
export const getOrder = async (id) => {
  const response = await axios.get(`/api/orders/${id}`);
  return response.data;
};

// Create order - This one is correct
export const createOrder = async (orderData) => {
  const response = await axios.post('/api/orders', orderData);
  return response.data;
};

// DRIFT: Backend now requires 'paymentMethod' field but frontend doesn't send it
export const updateOrder = async (id, status) => {
  const response = await axios.put(`/api/orders/${id}`, { status });
  return response.data;
};

// Delete order - This one is correct
export const deleteOrder = async (id) => {
  const response = await axios.delete(`/api/orders/${id}`);
  return response.data;
};

// Made with Bob
