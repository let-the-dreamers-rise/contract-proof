# API Documentation

**Last Updated:** 6 months ago (OUTDATED)

This document describes the REST API endpoints for the application.

## User Endpoints

### Get User
**OUTDATED**: Documentation not updated after route change

```
GET /api/users/:id
```

Returns user information by ID.

**Response:**
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com"
}
```

### List Users

```
GET /api/users
```

Returns a list of all users.

**Response:**
```json
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  }
]
```

### Create User
**OUTDATED**: Method changed from POST to PUT

```
POST /api/users
```

Creates a new user.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com"
}
```

### Search Users
**OUTDATED**: Missing required 'status' parameter

```
GET /api/users/search?query=john
```

Search for users by name or email.

**Query Parameters:**
- `query` (required): Search term

**Response:**
```json
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  }
]
```

### Update User

```
PATCH /api/users/:id
```

Updates user information.

**Request Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com"
}
```

## Product Endpoints

### List Products

```
GET /api/products
```

Returns a list of all products.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Product A",
    "price": 99.99
  }
]
```

### Get Product
**OUTDATED**: Response schema changed

```
GET /api/products/:id
```

Returns product information by ID.

**Response:**
```json
{
  "productId": 1,
  "productName": "Product A",
  "cost": 99.99
}
```

### Get Featured Products
**OUTDATED**: This endpoint was removed

```
GET /api/products/featured
```

Returns a list of featured products.

### Create Product

```
POST /api/products
```

Creates a new product.

**Request Body:**
```json
{
  "name": "Product A",
  "price": 99.99,
  "description": "Product description"
}
```

## Order Endpoints

### List Orders

```
GET /api/orders
```

Returns a list of all orders.

**Response:**
```json
[
  {
    "id": 1,
    "userId": 1,
    "items": [
      {
        "productId": 1,
        "quantity": 2
      }
    ],
    "total": 199.98,
    "status": "pending"
  }
]
```

### Create Order

```
POST /api/orders
```

Creates a new order.

**Request Body:**
```json
{
  "userId": 1,
  "items": [
    {
      "productId": 1,
      "quantity": 2,
      "price": 99.99
    }
  ],
  "paymentMethod": "credit_card"
}
```

### Get Order

```
GET /api/orders/:id
```

Returns order details by ID.

### Update Order
**OUTDATED**: Missing required 'paymentMethod' field

```
PUT /api/orders/:id
```

Updates order status.

**Request Body:**
```json
{
  "status": "shipped"
}
```

## Error Responses

All endpoints may return the following error responses:

- `400 Bad Request`: Invalid request parameters
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

## Notes

- All endpoints require authentication (not documented here)
- Rate limiting applies to all endpoints
- Timestamps are in ISO 8601 format