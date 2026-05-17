# Broken API App - ContractProof Demo

This is a sample application that demonstrates realistic API drift scenarios for the ContractProof demo. The application intentionally contains several API drift issues between backend, frontend, documentation, and tests.

## Overview

This Express.js application simulates a real-world scenario where an API has evolved over time, but not all parts of the codebase were updated consistently. This creates "drift" between different layers of the application.

## Intentional Drift Issues

This repository contains **7 intentional API drift scenarios**:

### 1. Route Renamed (Critical)
- **Backend:** `GET /api/v2/users/:userId`
- **Frontend:** Still calls `GET /api/users/:id`
- **Impact:** 404 errors on user profile pages

### 2. HTTP Method Changed (High)
- **Backend:** `PUT /api/users` (for creating users)
- **Frontend:** Still uses `POST /api/users`
- **Impact:** 405 Method Not Allowed errors

### 3. Missing Required Parameter (Medium)
- **Backend:** `GET /api/users/search` requires `status` parameter
- **Frontend:** Only sends `query` parameter
- **Impact:** 400 Bad Request errors

### 4. Response Schema Changed (High)
- **Backend:** Returns `{ id, name, price }`
- **Frontend:** Expects `{ productId, productName, cost }`
- **Impact:** Undefined property errors in UI

### 5. Endpoint Removed (Critical)
- **Frontend:** Calls `GET /api/products/featured`
- **Backend:** Endpoint was removed
- **Impact:** 404 errors on homepage

### 6. Missing Required Field (Medium)
- **Backend:** `PUT /api/orders/:id` requires `paymentMethod`
- **Frontend:** Only sends `status`
- **Impact:** 400 Bad Request errors

### 7. Documentation Outdated (Low)
- **Documentation:** References old endpoints and schemas
- **Backend:** Has been updated
- **Impact:** Developer confusion, incorrect implementations

## Project Structure

```
broken-api-app/
├── backend/
│   └── routes/
│       ├── users.js       # User management endpoints
│       ├── products.js    # Product management endpoints
│       └── orders.js      # Order management endpoints
├── frontend/
│   └── api/
│       ├── userService.js    # Frontend user API calls
│       ├── productService.js # Frontend product API calls
│       └── orderService.js   # Frontend order API calls
├── docs/
│   └── API.md            # Outdated API documentation
├── tests/
│   ├── users.test.js     # User endpoint tests
│   ├── products.test.js  # Product endpoint tests
│   └── orders.test.js    # Order endpoint tests
├── package.json
└── README.md
```

## Technologies

- **Backend:** Express.js
- **Frontend:** Axios for API calls
- **Testing:** Jest + Supertest
- **Documentation:** Markdown

## Purpose

This repository is used by ContractProof to demonstrate:
- How API drift occurs in real projects
- The types of issues that can arise
- How ContractProof detects these issues
- The impact of drift on production systems

## Note

This is a **demo application** and is intentionally broken. It should not be used as a template for real projects. The drift issues are carefully crafted to demonstrate common real-world scenarios.

## ContractProof Analysis

When analyzed by ContractProof, this repository will show:
- **7 drift findings** across critical, high, medium, and low severity
- Specific file locations and line numbers for each issue
- Suggested fixes for each drift scenario
- Regression tests to prevent future drift

## License

MIT License - Created for ContractProof demonstration purposes.