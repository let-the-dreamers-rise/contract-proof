// Pre-analyzed results for the sample broken repository
// This provides instant demo results without needing to run actual file analysis

import { DriftFinding, AnalysisResult } from "./types";

/**
 * Get pre-analyzed results for the sample broken repository
 * This simulates what the real analyzer would find
 */
export function getSampleAnalysisResults(): AnalysisResult {
  const findings: DriftFinding[] = [
    // Finding 1: Route Renamed (Critical)
    {
      id: "drift-1-route-renamed",
      severity: "critical",
      title: "Route Renamed: /api/users/:id → /api/v2/users/:userId",
      description: "Backend route was renamed from /api/users/:id to /api/v2/users/:userId, but frontend, documentation, and tests still reference the old path.",
      impact: "Frontend calls will fail with 404 errors in production. This affects user profile pages, causing complete feature breakdown. Estimated impact: 100% of user profile requests will fail.",
      backend: {
        path: "/api/v2/users/:userId",
        method: "GET",
        location: {
          file: "samples/broken-api-app/backend/routes/users.js",
          line: 14,
          code: "router.get('/api/v2/users/:userId', (req, res) => {",
          context: [
            "// DRIFT SCENARIO 1: Route renamed but frontend not updated",
            "// Old route: /api/users/:id",
            "// New route: /api/v2/users/:userId",
            "router.get('/api/v2/users/:userId', (req, res) => {",
            "  const { userId } = req.params;",
            "  res.json({ id: userId, name: 'John Doe' });",
          ],
        },
        type: "backend",
        framework: "express",
        params: ["userId"],
      },
      frontend: [
        {
          path: "/api/users/:id",
          method: "GET",
          location: {
            file: "samples/broken-api-app/frontend/api/userService.js",
            line: 6,
            code: "const response = await axios.get(`/api/users/${id}`);",
            context: [
              "// DRIFT: Backend route is now /api/v2/users/:userId but frontend uses old path",
              "export const getUser = async (id) => {",
              "  const response = await axios.get(`/api/users/${id}`);",
              "  return response.data;",
              "};",
            ],
          },
          type: "frontend",
          framework: "axios",
        },
      ],
      documentation: [
        {
          path: "/api/users/:id",
          method: "GET",
          location: {
            file: "samples/broken-api-app/docs/API.md",
            line: 8,
            code: "GET /api/users/:id",
            context: [
              "### Get User",
              "**OUTDATED**: Documentation not updated after route change",
              "",
              "```",
              "GET /api/users/:id",
              "```",
            ],
          },
          type: "documentation",
        },
      ],
      tests: [
        {
          path: "/api/users/:id",
          method: "GET",
          location: {
            file: "samples/broken-api-app/tests/users.test.js",
            line: 8,
            code: "const response = await request(app).get('/api/users/1');",
            context: [
              "// DRIFT: Tests old endpoint /api/users/:id instead of /api/v2/users/:userId",
              "test('GET /api/users/:id should return user', async () => {",
              "  const response = await request(app).get('/api/users/1');",
              "  expect(response.status).toBe(200);",
            ],
          },
          type: "test",
          framework: "jest",
        },
      ],
      suggestedFix: {
        description: "Update all references to use the new route path /api/v2/users/:userId",
        beforeCode: `// Frontend
const response = await axios.get(\`/api/users/\${id}\`);

// Tests
const response = await request(app).get('/api/users/1');

// Docs
GET /api/users/:id`,
        afterCode: `// Frontend
const response = await axios.get(\`/api/v2/users/\${userId}\`);

// Tests
const response = await request(app).get('/api/v2/users/1');

// Docs
GET /api/v2/users/:userId`,
        files: [
          "samples/broken-api-app/frontend/api/userService.js",
          "samples/broken-api-app/tests/users.test.js",
          "samples/broken-api-app/docs/API.md",
        ],
      },
      regressionTest: {
        description: "Add test to verify the new route works and old route returns 404",
        code: `describe('User API v2 migration', () => {
  test('GET /api/v2/users/:userId should return user', async () => {
    const response = await request(app).get('/api/v2/users/123');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id', '123');
  });

  test('GET /api/users/:id should return 404 (deprecated)', async () => {
    const response = await request(app).get('/api/users/123');
    expect(response.status).toBe(404);
  });
});`,
        framework: "jest",
      },
      bobPrompt: `# API Drift Detected: Route Renamed

The backend route was renamed from /api/users/:id to /api/v2/users/:userId during API versioning, but frontend, documentation, and tests were not updated.

## Backend Route
File: samples/broken-api-app/backend/routes/users.js:14
Route: GET /api/v2/users/:userId
Framework: express
\`\`\`javascript
router.get('/api/v2/users/:userId', (req, res) => {
  const { userId } = req.params;
  res.json({ id: userId, name: 'John Doe' });
});
\`\`\`

## Frontend Call
File: samples/broken-api-app/frontend/api/userService.js:6
Call: GET /api/users/:id
Framework: axios
\`\`\`javascript
const response = await axios.get(\`/api/users/\${id}\`);
\`\`\`

## Task
Please analyze the full repository context and fix this API drift issue. Update the frontend service, tests, and documentation to use the new /api/v2/users/:userId route. Ensure parameter names are consistent (id → userId).`,
    },

    // Finding 2: HTTP Method Changed (High)
    {
      id: "drift-2-method-changed",
      severity: "high",
      title: "HTTP Method Mismatch: POST → PUT for /api/users",
      description: "Backend changed from POST to PUT for creating users, but frontend still uses POST method.",
      impact: "API calls will fail with 405 Method Not Allowed errors. User registration will be completely broken in production.",
      backend: {
        path: "/api/users",
        method: "PUT",
        location: {
          file: "samples/broken-api-app/backend/routes/users.js",
          line: 20,
          code: "router.put('/api/users', (req, res) => {",
          context: [
            "// DRIFT SCENARIO 2: Method changed from POST to PUT",
            "// Frontend still uses POST",
            "router.put('/api/users', (req, res) => {",
            "  const { name, email } = req.body;",
            "  res.status(201).json({ id: 1, name, email });",
          ],
        },
        type: "backend",
        framework: "express",
      },
      frontend: [
        {
          path: "/api/users",
          method: "POST",
          location: {
            file: "samples/broken-api-app/frontend/api/userService.js",
            line: 11,
            code: "const response = await axios.post('/api/users', userData);",
            context: [
              "// DRIFT: Backend changed to PUT but frontend still uses POST",
              "export const createUser = async (userData) => {",
              "  const response = await axios.post('/api/users', userData);",
              "  return response.data;",
              "};",
            ],
          },
          type: "frontend",
          framework: "axios",
        },
      ],
      suggestedFix: {
        description: "Update frontend to use PUT method instead of POST",
        beforeCode: `const response = await axios.post('/api/users', userData);`,
        afterCode: `const response = await axios.put('/api/users', userData);`,
        files: ["samples/broken-api-app/frontend/api/userService.js"],
      },
      regressionTest: {
        description: "Add test to verify PUT method is supported",
        code: `test('PUT /api/users should create user', async () => {
  const userData = { name: 'Test User', email: 'test@example.com' };
  const response = await request(app).put('/api/users').send(userData);
  expect(response.status).toBe(201);
  expect(response.body).toHaveProperty('id');
});

test('POST /api/users should return 405', async () => {
  const userData = { name: 'Test User', email: 'test@example.com' };
  const response = await request(app).post('/api/users').send(userData);
  expect(response.status).toBe(405);
});`,
        framework: "jest",
      },
      bobPrompt: `# API Drift Detected: HTTP Method Mismatch

Backend changed from POST to PUT for /api/users endpoint, but frontend still uses POST.

## Backend Route
File: samples/broken-api-app/backend/routes/users.js:20
Route: PUT /api/users
Framework: express

## Frontend Call
File: samples/broken-api-app/frontend/api/userService.js:11
Call: POST /api/users
Framework: axios

## Task
Please update the frontend to use PUT method instead of POST for creating users. Also update any related tests and documentation.`,
    },

    // Finding 3: Missing Required Parameter (Medium)
    {
      id: "drift-3-missing-param",
      severity: "medium",
      title: "Missing Required Parameter: status in /api/users/search",
      description: "Backend now requires 'status' query parameter, but frontend doesn't send it.",
      impact: "Search functionality will fail with 400 Bad Request errors. Users won't be able to search for other users.",
      backend: {
        path: "/api/users/search",
        method: "GET",
        location: {
          file: "samples/broken-api-app/backend/routes/users.js",
          line: 26,
          code: "router.get('/api/users/search', (req, res) => {",
          context: [
            "// DRIFT SCENARIO 3: New required query parameter added",
            "// Frontend doesn't send 'status' parameter",
            "router.get('/api/users/search', (req, res) => {",
            "  const { query, status } = req.query;",
            "  if (!status) {",
            "    return res.status(400).json({ error: 'status parameter is required' });",
          ],
        },
        type: "backend",
        framework: "express",
        queryParams: ["query", "status"],
      },
      frontend: [
        {
          path: "/api/users/search",
          method: "GET",
          location: {
            file: "samples/broken-api-app/frontend/api/userService.js",
            line: 16,
            code: "const response = await axios.get(`/api/users/search?query=${query}`);",
            context: [
              "// DRIFT: Missing required 'status' query parameter",
              "export const searchUsers = async (query) => {",
              "  const response = await axios.get(`/api/users/search?query=${query}`);",
              "  return response.data;",
              "};",
            ],
          },
          type: "frontend",
          framework: "axios",
          queryParams: ["query"],
        },
      ],
      suggestedFix: {
        description: "Add 'status' parameter to the search API call",
        beforeCode: `export const searchUsers = async (query) => {
  const response = await axios.get(\`/api/users/search?query=\${query}\`);
  return response.data;
};`,
        afterCode: `export const searchUsers = async (query, status = 'active') => {
  const response = await axios.get(\`/api/users/search?query=\${query}&status=\${status}\`);
  return response.data;
};`,
        files: ["samples/broken-api-app/frontend/api/userService.js"],
      },
      regressionTest: {
        description: "Add test to verify status parameter is required",
        code: `test('GET /api/users/search requires status parameter', async () => {
  const response = await request(app).get('/api/users/search?query=john&status=active');
  expect(response.status).toBe(200);
});

test('GET /api/users/search without status returns 400', async () => {
  const response = await request(app).get('/api/users/search?query=john');
  expect(response.status).toBe(400);
  expect(response.body.error).toContain('status');
});`,
        framework: "jest",
      },
      bobPrompt: `# API Drift Detected: Missing Required Parameter

Backend now requires 'status' query parameter for /api/users/search, but frontend doesn't send it.

## Backend Route
File: samples/broken-api-app/backend/routes/users.js:26
Route: GET /api/users/search?query&status
Framework: express

## Frontend Call
File: samples/broken-api-app/frontend/api/userService.js:16
Call: GET /api/users/search?query
Framework: axios

## Task
Please update the frontend searchUsers function to include the required 'status' parameter. Consider adding a default value like 'active'.`,
    },

    // Finding 4: Response Schema Changed (High)
    {
      id: "drift-4-schema-changed",
      severity: "high",
      title: "Response Schema Changed: Product fields renamed",
      description: "Backend changed response schema from { productId, productName, cost } to { id, name, price }, but frontend expects old schema.",
      impact: "Frontend will try to access undefined properties, causing UI errors and broken product displays. Product pages will show blank or error states.",
      backend: {
        path: "/api/products/:id",
        method: "GET",
        location: {
          file: "samples/broken-api-app/backend/routes/products.js",
          line: 12,
          code: "router.get('/api/products/:id', (req, res) => {",
          context: [
            "router.get('/api/products/:id', (req, res) => {",
            "  const { id } = req.params;",
            "  res.json({ ",
            "    id, ",
            "    name: 'Product Name',",
            "    price: 99.99,",
            "    // DRIFT SCENARIO 4: Response schema changed",
          ],
        },
        type: "backend",
        framework: "express",
        responseSchema: {
          id: "string",
          name: "string",
          price: "number",
        },
      },
      frontend: [
        {
          path: "/api/products/:id",
          method: "GET",
          location: {
            file: "samples/broken-api-app/frontend/api/productService.js",
            line: 11,
            code: "const response = await axios.get(`/api/products/${id}`);",
            context: [
              "// DRIFT: Expects old response schema { productId, productName, cost }",
              "// Backend now returns { id, name, price }",
              "export const getProduct = async (id) => {",
              "  const response = await axios.get(`/api/products/${id}`);",
              "  // Frontend code expects: response.data.productId, response.data.productName, response.data.cost",
              "  return response.data;",
            ],
          },
          type: "frontend",
          framework: "axios",
        },
      ],
      suggestedFix: {
        description: "Update frontend to use new response schema field names",
        beforeCode: `// Frontend expects:
const product = await getProduct(id);
console.log(product.productId, product.productName, product.cost);`,
        afterCode: `// Frontend should use:
const product = await getProduct(id);
console.log(product.id, product.name, product.price);

// Or add a mapper function:
export const getProduct = async (id) => {
  const response = await axios.get(\`/api/products/\${id}\`);
  return {
    productId: response.data.id,
    productName: response.data.name,
    cost: response.data.price,
  };
};`,
        files: ["samples/broken-api-app/frontend/api/productService.js"],
      },
      regressionTest: {
        description: "Add test to verify new response schema",
        code: `test('GET /api/products/:id returns new schema', async () => {
  const response = await request(app).get('/api/products/1');
  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('id');
  expect(response.body).toHaveProperty('name');
  expect(response.body).toHaveProperty('price');
  expect(response.body).not.toHaveProperty('productId');
  expect(response.body).not.toHaveProperty('productName');
  expect(response.body).not.toHaveProperty('cost');
});`,
        framework: "jest",
      },
      bobPrompt: `# API Drift Detected: Response Schema Changed

Backend changed response schema for /api/products/:id from { productId, productName, cost } to { id, name, price }.

## Backend Route
File: samples/broken-api-app/backend/routes/products.js:12
Returns: { id, name, price }

## Frontend Call
File: samples/broken-api-app/frontend/api/productService.js:11
Expects: { productId, productName, cost }

## Task
Please update the frontend to handle the new response schema. You can either update all code that uses product data, or add a mapper function to maintain backward compatibility.`,
    },

    // Finding 5: Endpoint Removed (Critical)
    {
      id: "drift-5-endpoint-removed",
      severity: "critical",
      title: "Orphaned API Call: /api/products/featured was removed",
      description: "Frontend calls /api/products/featured, but this endpoint was removed from the backend during refactoring.",
      impact: "Featured products section will fail with 404 errors. This breaks the homepage and product discovery features.",
      frontend: [
        {
          path: "/api/products/featured",
          method: "GET",
          location: {
            file: "samples/broken-api-app/frontend/api/productService.js",
            line: 18,
            code: "const response = await axios.get('/api/products/featured');",
            context: [
              "// DRIFT: This endpoint was removed from backend",
              "export const getFeaturedProducts = async () => {",
              "  const response = await axios.get('/api/products/featured');",
              "  return response.data;",
              "};",
            ],
          },
          type: "frontend",
          framework: "axios",
        },
      ],
      tests: [
        {
          path: "/api/products/featured",
          method: "GET",
          location: {
            file: "samples/broken-api-app/tests/products.test.js",
            line: 26,
            code: "const response = await request(app).get('/api/products/featured');",
            context: [
              "// DRIFT: Tests endpoint that was removed",
              "test('GET /api/products/featured should return featured products', async () => {",
              "  const response = await request(app).get('/api/products/featured');",
              "  expect(response.status).toBe(200);",
            ],
          },
          type: "test",
          framework: "jest",
        },
      ],
      suggestedFix: {
        description: "Either restore the backend endpoint or remove frontend calls",
        beforeCode: `// Frontend
export const getFeaturedProducts = async () => {
  const response = await axios.get('/api/products/featured');
  return response.data;
};`,
        afterCode: `// Option 1: Restore backend endpoint
router.get('/api/products/featured', (req, res) => {
  // Implementation
});

// Option 2: Remove frontend call and use alternative
export const getFeaturedProducts = async () => {
  const response = await axios.get('/api/products?featured=true');
  return response.data;
};`,
        files: [
          "samples/broken-api-app/backend/routes/products.js",
          "samples/broken-api-app/frontend/api/productService.js",
          "samples/broken-api-app/tests/products.test.js",
        ],
      },
      regressionTest: {
        description: "Add test to verify featured products endpoint exists",
        code: `test('Featured products endpoint exists', async () => {
  const response = await request(app).get('/api/products/featured');
  expect(response.status).not.toBe(404);
});`,
        framework: "jest",
      },
      bobPrompt: `# API Drift Detected: Orphaned API Call

Frontend calls /api/products/featured, but this endpoint was removed from the backend.

## Frontend Call
File: samples/broken-api-app/frontend/api/productService.js:18
Call: GET /api/products/featured
Framework: axios

## Task
Please analyze the repository and either:
1. Restore the /api/products/featured endpoint in the backend
2. Update the frontend to use an alternative approach (e.g., query parameter)
3. Remove the feature if it's no longer needed

Also update tests and documentation accordingly.`,
    },

    // Finding 6: Missing Required Field (Medium)
    {
      id: "drift-6-missing-field",
      severity: "medium",
      title: "Missing Required Field: paymentMethod in /api/orders/:id",
      description: "Backend now requires 'paymentMethod' in request body for updating orders, but frontend doesn't send it.",
      impact: "Order updates will fail with 400 Bad Request errors. Users won't be able to update order status.",
      backend: {
        path: "/api/orders/:id",
        method: "PUT",
        location: {
          file: "samples/broken-api-app/backend/routes/orders.js",
          line: 36,
          code: "router.put('/api/orders/:id', (req, res) => {",
          context: [
            "// DRIFT SCENARIO 6: New required field in request body",
            "// Frontend doesn't send 'paymentMethod' field",
            "router.put('/api/orders/:id', (req, res) => {",
            "  const { id } = req.params;",
            "  const { status, paymentMethod } = req.body;",
            "  if (!paymentMethod) {",
            "    return res.status(400).json({ error: 'paymentMethod is required' });",
          ],
        },
        type: "backend",
        framework: "express",
        bodySchema: {
          status: "string",
          paymentMethod: "string (required)",
        },
      },
      frontend: [
        {
          path: "/api/orders/:id",
          method: "PUT",
          location: {
            file: "samples/broken-api-app/frontend/api/orderService.js",
            line: 21,
            code: "const response = await axios.put(`/api/orders/${id}`, { status });",
            context: [
              "// DRIFT: Backend now requires 'paymentMethod' field but frontend doesn't send it",
              "export const updateOrder = async (id, status) => {",
              "  const response = await axios.put(`/api/orders/${id}`, { status });",
              "  return response.data;",
              "};",
            ],
          },
          type: "frontend",
          framework: "axios",
          bodySchema: {
            status: "string",
          },
        },
      ],
      suggestedFix: {
        description: "Add 'paymentMethod' parameter to updateOrder function",
        beforeCode: `export const updateOrder = async (id, status) => {
  const response = await axios.put(\`/api/orders/\${id}\`, { status });
  return response.data;
};`,
        afterCode: `export const updateOrder = async (id, status, paymentMethod) => {
  const response = await axios.put(\`/api/orders/\${id}\`, { 
    status, 
    paymentMethod 
  });
  return response.data;
};`,
        files: ["samples/broken-api-app/frontend/api/orderService.js"],
      },
      regressionTest: {
        description: "Add test to verify paymentMethod is required",
        code: `test('PUT /api/orders/:id requires paymentMethod', async () => {
  const response = await request(app)
    .put('/api/orders/1')
    .send({ status: 'shipped', paymentMethod: 'credit_card' });
  expect(response.status).toBe(200);
});

test('PUT /api/orders/:id without paymentMethod returns 400', async () => {
  const response = await request(app)
    .put('/api/orders/1')
    .send({ status: 'shipped' });
  expect(response.status).toBe(400);
  expect(response.body.error).toContain('paymentMethod');
});`,
        framework: "jest",
      },
      bobPrompt: `# API Drift Detected: Missing Required Field

Backend now requires 'paymentMethod' field in request body for PUT /api/orders/:id, but frontend doesn't send it.

## Backend Route
File: samples/broken-api-app/backend/routes/orders.js:36
Requires: { status, paymentMethod }

## Frontend Call
File: samples/broken-api-app/frontend/api/orderService.js:21
Sends: { status }

## Task
Please update the frontend updateOrder function to include the paymentMethod parameter. Also update any components that call this function.`,
    },

    // Finding 7: Documentation Outdated (Low)
    {
      id: "drift-7-docs-outdated",
      severity: "low",
      title: "Documentation Outdated: Multiple endpoints not documented correctly",
      description: "API documentation is 6 months old and doesn't reflect recent backend changes.",
      impact: "Developers may implement features incorrectly based on outdated documentation. New team members will be confused. Integration partners may build against wrong API contracts.",
      documentation: [
        {
          path: "/api/users/:id",
          method: "GET",
          location: {
            file: "samples/broken-api-app/docs/API.md",
            line: 8,
            code: "GET /api/users/:id",
            context: [
              "### Get User",
              "**OUTDATED**: Documentation not updated after route change",
              "GET /api/users/:id",
            ],
          },
          type: "documentation",
        },
      ],
      suggestedFix: {
        description: "Update API documentation to reflect current backend implementation",
        beforeCode: `# API Documentation

## User Endpoints

### Get User
GET /api/users/:id

### Create User
POST /api/users

### Search Users
GET /api/users/search?query=john`,
        afterCode: `# API Documentation

## User Endpoints

### Get User
GET /api/v2/users/:userId

Returns user information by ID.

### Create User
PUT /api/users

Creates a new user. Note: Changed from POST to PUT.

### Search Users
GET /api/users/search?query=john&status=active

Search for users. Both query and status parameters are required.`,
        files: ["samples/broken-api-app/docs/API.md"],
      },
      bobPrompt: `# API Drift Detected: Documentation Outdated

API documentation hasn't been updated to reflect recent backend changes.

## Task
Please review the entire backend codebase and update docs/API.md to accurately document all current endpoints, including:
- Correct paths and methods
- Required parameters
- Request/response schemas
- Any breaking changes from previous versions`,
    },
  ];

  const summary = {
    total: findings.length,
    critical: findings.filter((f) => f.severity === "critical").length,
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    low: findings.filter((f) => f.severity === "low").length,
  };

  return {
    findings,
    summary,
    scannedFiles: {
      backend: 3,
      frontend: 3,
      documentation: 1,
      tests: 2,
    },
    timestamp: new Date().toISOString(),
  };
}

// Made with Bob
