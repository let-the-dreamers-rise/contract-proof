// Product API Service
// This file demonstrates frontend API calls with drift issues

import axios from 'axios';

// List all products - This one is correct
export const listProducts = async () => {
  const response = await axios.get('/api/products');
  return response.data;
};

// DRIFT: Expects old response schema { productId, productName, cost }
// Backend now returns { id, name, price }
export const getProduct = async (id) => {
  const response = await axios.get(`/api/products/${id}`);
  // Frontend code expects: response.data.productId, response.data.productName, response.data.cost
  return response.data;
};

// DRIFT: This endpoint was removed from backend
export const getFeaturedProducts = async () => {
  const response = await axios.get('/api/products/featured');
  return response.data;
};

// Create product - This one is correct
export const createProduct = async (productData) => {
  const response = await axios.post('/api/products', productData);
  return response.data;
};

// Update product - This one is correct
export const updateProduct = async (id, updates) => {
  const response = await axios.patch(`/api/products/${id}`, updates);
  return response.data;
};

// Delete product - This one is correct
export const deleteProduct = async (id) => {
  const response = await axios.delete(`/api/products/${id}`);
  return response.data;
};

// Made with Bob
