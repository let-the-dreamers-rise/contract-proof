import { OpenAPIParser } from "../../openapi-parser";

describe("OpenAPIParser", () => {
  let parser: OpenAPIParser;

  beforeEach(() => {
    parser = new OpenAPIParser();
  });

  describe("parse", () => {
    it("should parse OpenAPI 3.0 JSON spec", async () => {
      const spec = {
        openapi: "3.0.0",
        info: {
          title: "Test API",
          version: "1.0.0",
        },
        paths: {
          "/users": {
            get: {
              summary: "Get users",
              responses: {
                "200": {
                  description: "Success",
                },
              },
            },
          },
        },
      };

      const result = await parser.parse(spec);
      expect(result.version).toBe("3.0");
      expect(result.info.title).toBe("Test API");
      expect(result.paths["/users"]).toBeDefined();
    });

    it("should parse OpenAPI 3.0 YAML spec", async () => {
      const yamlSpec = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      summary: Get users
      responses:
        '200':
          description: Success
`;

      const result = await parser.parse(yamlSpec);
      expect(result.version).toBe("3.0");
      expect(result.info.title).toBe("Test API");
    });

    it("should parse Swagger 2.0 spec", async () => {
      const spec = {
        swagger: "2.0",
        info: {
          title: "Test API",
          version: "1.0.0",
        },
        host: "api.example.com",
        basePath: "/v1",
        schemes: ["https"],
        paths: {
          "/users": {
            get: {
              summary: "Get users",
              responses: {
                "200": {
                  description: "Success",
                },
              },
            },
          },
        },
      };

      const result = await parser.parse(spec);
      expect(result.version).toBe("3.0");
      expect(result.info.title).toBe("Test API");
      expect(result.servers).toBeDefined();
      expect(result.servers![0].url).toBe("https://api.example.com/v1");
    });

    it("should throw error for invalid spec", async () => {
      await expect(parser.parse("invalid")).rejects.toThrow();
    });

    it("should throw error for missing version", async () => {
      const spec = {
        info: {
          title: "Test API",
          version: "1.0.0",
        },
        paths: {},
      };

      await expect(parser.parse(spec)).rejects.toThrow();
    });
  });

  describe("extractEndpoints", () => {
    it("should extract endpoints from parsed spec", async () => {
      const spec = {
        openapi: "3.0.0",
        info: {
          title: "Test API",
          version: "1.0.0",
        },
        paths: {
          "/users": {
            get: {
              operationId: "getUsers",
              summary: "Get all users",
              responses: {
                "200": {
                  description: "Success",
                },
              },
            },
            post: {
              operationId: "createUser",
              summary: "Create user",
              responses: {
                "201": {
                  description: "Created",
                },
              },
            },
          },
          "/users/{id}": {
            get: {
              operationId: "getUserById",
              parameters: [
                {
                  name: "id",
                  in: "path",
                  required: true,
                  schema: { type: "string" },
                },
              ],
              responses: {
                "200": {
                  description: "Success",
                },
              },
            },
          },
        },
      };

      await parser.parse(spec);
      const endpoints = parser.extractEndpoints();

      expect(endpoints).toHaveLength(3);
      expect(endpoints[0].path).toBe("/users");
      expect(endpoints[0].method).toBe("GET");
      expect(endpoints[0].operationId).toBe("getUsers");
      expect(endpoints[1].method).toBe("POST");
      expect(endpoints[2].path).toBe("/users/:id");
      expect(endpoints[2].parameters).toHaveLength(1);
    });

    it("should handle deprecated endpoints", async () => {
      const spec = {
        openapi: "3.0.0",
        info: {
          title: "Test API",
          version: "1.0.0",
        },
        paths: {
          "/old-endpoint": {
            get: {
              deprecated: true,
              responses: {
                "200": {
                  description: "Success",
                },
              },
            },
          },
        },
      };

      await parser.parse(spec);
      const endpoints = parser.extractEndpoints();

      expect(endpoints[0].deprecated).toBe(true);
    });

    it("should throw error if parse not called first", () => {
      expect(() => parser.extractEndpoints()).toThrow();
    });
  });

  describe("Swagger 2.0 conversion", () => {
    it("should convert body parameters to requestBody", async () => {
      const spec = {
        swagger: "2.0",
        info: {
          title: "Test API",
          version: "1.0.0",
        },
        paths: {
          "/users": {
            post: {
              parameters: [
                {
                  name: "body",
                  in: "body",
                  required: true,
                  schema: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      email: { type: "string" },
                    },
                  },
                },
              ],
              responses: {
                "201": {
                  description: "Created",
                },
              },
            },
          },
        },
      };

      await parser.parse(spec);
      const endpoints = parser.extractEndpoints();

      expect(endpoints[0].requestBody).toBeDefined();
      expect(endpoints[0].requestBody?.required).toBe(true);
      expect(endpoints[0].requestBody?.content["application/json"]).toBeDefined();
    });

    it("should convert response schemas", async () => {
      const spec = {
        swagger: "2.0",
        info: {
          title: "Test API",
          version: "1.0.0",
        },
        paths: {
          "/users": {
            get: {
              responses: {
                "200": {
                  description: "Success",
                  schema: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      await parser.parse(spec);
      const endpoints = parser.extractEndpoints();

      expect(endpoints[0].responses["200"].content).toBeDefined();
      expect(endpoints[0].responses["200"].content!["application/json"].schema).toBeDefined();
    });
  });

  describe("$ref resolution", () => {
    it("should resolve component references", async () => {
      const spec = {
        openapi: "3.0.0",
        info: {
          title: "Test API",
          version: "1.0.0",
        },
        paths: {
          "/users": {
            get: {
              parameters: [
                {
                  $ref: "#/components/parameters/PageParam",
                },
              ],
              responses: {
                "200": {
                  description: "Success",
                },
              },
            },
          },
        },
        components: {
          parameters: {
            PageParam: {
              name: "page",
              in: "query",
              schema: { type: "integer" },
            },
          },
        },
      };

      await parser.parse(spec);
      const endpoints = parser.extractEndpoints();

      expect(endpoints[0].parameters).toHaveLength(1);
      expect(endpoints[0].parameters![0].name).toBe("page");
    });

    it("should handle circular references gracefully", async () => {
      const spec = {
        openapi: "3.0.0",
        info: {
          title: "Test API",
          version: "1.0.0",
        },
        paths: {
          "/test": {
            get: {
              responses: {
                "200": {
                  description: "Success",
                  content: {
                    "application/json": {
                      schema: {
                        $ref: "#/components/schemas/Node",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            Node: {
              type: "object",
              properties: {
                value: { type: "string" },
                next: {
                  $ref: "#/components/schemas/Node",
                },
              },
            },
          },
        },
      };

      // Should not throw or hang
      await expect(parser.parse(spec)).resolves.toBeDefined();
    });
  });

  describe("path normalization", () => {
    it("should normalize OpenAPI path parameters", async () => {
      const spec = {
        openapi: "3.0.0",
        info: {
          title: "Test API",
          version: "1.0.0",
        },
        paths: {
          "/users/{userId}/posts/{postId}": {
            get: {
              responses: {
                "200": {
                  description: "Success",
                },
              },
            },
          },
        },
      };

      await parser.parse(spec);
      const endpoints = parser.extractEndpoints();

      expect(endpoints[0].path).toBe("/users/:userId/posts/:postId");
    });
  });
});

// Made with Bob