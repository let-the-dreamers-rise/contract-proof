// OpenAPI/Swagger parser with support for 2.0, 3.0, and 3.1 specs

import * as yaml from 'js-yaml';

export interface ParsedSpec {
  version: '2.0' | '3.0' | '3.1';
  info: { 
    title: string; 
    version: string;
    description?: string;
  };
  servers?: Array<{ url: string; description?: string }>;
  paths: Record<string, PathItem>;
  components?: { 
    schemas?: Record<string, Schema>;
    parameters?: Record<string, Parameter>;
    responses?: Record<string, Response>;
  };
  definitions?: Record<string, Schema>; // Swagger 2.0
  basePath?: string; // Swagger 2.0
  host?: string; // Swagger 2.0
  schemes?: string[]; // Swagger 2.0
}

export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  patch?: Operation;
  options?: Operation;
  head?: Operation;
  parameters?: Parameter[];
  $ref?: string;
}

export interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  deprecated?: boolean;
  tags?: string[];
  security?: Array<Record<string, string[]>>;
}

export interface Parameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie' | 'body' | 'formData';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: Schema;
  type?: string; // Swagger 2.0
  format?: string;
  $ref?: string;
}

export interface RequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, MediaType>;
}

export interface MediaType {
  schema?: Schema;
  example?: any;
  examples?: Record<string, any>;
}

export interface Response {
  description: string;
  content?: Record<string, MediaType>;
  schema?: Schema; // Swagger 2.0
  headers?: Record<string, any>;
  $ref?: string;
}

export interface Schema {
  type?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  $ref?: string;
  allOf?: Schema[];
  oneOf?: Schema[];
  anyOf?: Schema[];
  description?: string;
  format?: string;
  enum?: any[];
  default?: any;
}

export interface SpecEndpoint {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  deprecated?: boolean;
  tags?: string[];
}

export class OpenAPIParser {
  private spec: ParsedSpec | null = null;
  private resolvedRefs: Map<string, any> = new Map();
  private refStack: Set<string> = new Set(); // Track circular refs

  /**
   * Parse OpenAPI/Swagger spec from string or object
   */
  async parse(input: string | object): Promise<ParsedSpec> {
    try {
      // Parse input
      let rawSpec: any;
      if (typeof input === 'string') {
        // Try JSON first, then YAML
        try {
          rawSpec = JSON.parse(input);
        } catch {
          rawSpec = yaml.load(input);
        }
      } else {
        rawSpec = input;
      }

      // Validate basic structure
      if (!rawSpec || typeof rawSpec !== 'object') {
        throw new Error('Invalid spec: must be an object');
      }

      // Detect version
      const version = this.detectVersion(rawSpec);
      
      // Normalize spec to OpenAPI 3.0 format
      this.spec = this.normalizeSpec(rawSpec, version);
      
      // Resolve $ref references
      this.resolveRefs();

      return this.spec;
    } catch (error) {
      throw new Error(`Failed to parse OpenAPI spec: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract all endpoints from parsed spec
   */
  extractEndpoints(): SpecEndpoint[] {
    if (!this.spec) {
      throw new Error('No spec parsed. Call parse() first.');
    }

    const endpoints: SpecEndpoint[] = [];
    const basePath = this.spec.basePath || '';

    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      // Resolve path-level $ref
      const resolvedPathItem = pathItem.$ref 
        ? this.resolveReference(pathItem.$ref) 
        : pathItem;

      const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
      
      for (const method of methods) {
        const operation = resolvedPathItem[method as keyof PathItem] as Operation | undefined;
        
        if (operation) {
          // Merge path-level and operation-level parameters
          const pathParams = resolvedPathItem.parameters || [];
          const opParams = operation.parameters || [];
          const allParams = [...pathParams, ...opParams].map(p => 
            p.$ref ? this.resolveReference(p.$ref) : p
          );

          endpoints.push({
            path: this.normalizePath(basePath + path),
            method: method.toUpperCase(),
            operationId: operation.operationId,
            summary: operation.summary,
            description: operation.description,
            parameters: allParams,
            requestBody: operation.requestBody,
            responses: operation.responses,
            deprecated: operation.deprecated,
            tags: operation.tags,
          });
        }
      }
    }

    return endpoints;
  }

  /**
   * Detect OpenAPI/Swagger version
   */
  private detectVersion(spec: any): '2.0' | '3.0' | '3.1' {
    if (spec.openapi) {
      const version = spec.openapi;
      if (version.startsWith('3.1')) return '3.1';
      if (version.startsWith('3.0')) return '3.0';
      throw new Error(`Unsupported OpenAPI version: ${version}`);
    } else if (spec.swagger) {
      if (spec.swagger === '2.0') return '2.0';
      throw new Error(`Unsupported Swagger version: ${spec.swagger}`);
    }
    throw new Error('Unable to detect spec version. Missing "openapi" or "swagger" field.');
  }

  /**
   * Normalize spec to OpenAPI 3.0 format
   */
  private normalizeSpec(rawSpec: any, version: '2.0' | '3.0' | '3.1'): ParsedSpec {
    if (version === '2.0') {
      return this.convertSwagger2ToOpenAPI3(rawSpec);
    }

    // OpenAPI 3.0/3.1 - already in correct format
    return {
      version,
      info: rawSpec.info || { title: 'Untitled', version: '1.0.0' },
      servers: rawSpec.servers || [],
      paths: rawSpec.paths || {},
      components: rawSpec.components,
    };
  }

  /**
   * Convert Swagger 2.0 to OpenAPI 3.0 format
   */
  private convertSwagger2ToOpenAPI3(swagger: any): ParsedSpec {
    const spec: ParsedSpec = {
      version: '3.0',
      info: swagger.info || { title: 'Untitled', version: '1.0.0' },
      servers: this.convertSwagger2Servers(swagger),
      paths: {},
      components: {
        schemas: swagger.definitions || {},
      },
      basePath: swagger.basePath,
      host: swagger.host,
      schemes: swagger.schemes,
    };

    // Convert paths
    for (const [path, pathItem] of Object.entries(swagger.paths || {})) {
      spec.paths[path] = this.convertSwagger2PathItem(pathItem as any);
    }

    return spec;
  }

  /**
   * Convert Swagger 2.0 servers
   */
  private convertSwagger2Servers(swagger: any): Array<{ url: string }> {
    const servers: Array<{ url: string }> = [];
    
    if (swagger.host) {
      const schemes = swagger.schemes || ['http'];
      const basePath = swagger.basePath || '';
      
      schemes.forEach((scheme: string) => {
        servers.push({
          url: `${scheme}://${swagger.host}${basePath}`,
        });
      });
    }

    return servers;
  }

  /**
   * Convert Swagger 2.0 path item
   */
  private convertSwagger2PathItem(pathItem: any): PathItem {
    const converted: any = {};
    const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];

    for (const method of methods) {
      if (pathItem[method]) {
        converted[method] = this.convertSwagger2Operation(pathItem[method]);
      }
    }

    if (pathItem.parameters) {
      converted.parameters = pathItem.parameters.map((p: any) => 
        this.convertSwagger2Parameter(p)
      );
    }

    return converted;
  }

  /**
   * Convert Swagger 2.0 operation
   */
  private convertSwagger2Operation(operation: any): Operation {
    const converted: Operation = {
      operationId: operation.operationId,
      summary: operation.summary,
      description: operation.description,
      deprecated: operation.deprecated,
      tags: operation.tags,
      responses: {},
    };

    // Convert parameters
    if (operation.parameters) {
      const bodyParam = operation.parameters.find((p: any) => p.in === 'body');
      const otherParams = operation.parameters.filter((p: any) => p.in !== 'body');

      if (bodyParam) {
        converted.requestBody = {
          required: bodyParam.required,
          content: {
            'application/json': {
              schema: bodyParam.schema,
            },
          },
        };
      }

      if (otherParams.length > 0) {
        converted.parameters = otherParams.map((p: any) => 
          this.convertSwagger2Parameter(p)
        );
      }
    }

    // Convert responses
    for (const [code, response] of Object.entries(operation.responses || {})) {
      converted.responses[code] = this.convertSwagger2Response(response as any);
    }

    return converted;
  }

  /**
   * Convert Swagger 2.0 parameter
   */
  private convertSwagger2Parameter(param: any): Parameter {
    const converted: Parameter = {
      name: param.name,
      in: param.in,
      description: param.description,
      required: param.required,
      deprecated: param.deprecated,
    };

    if (param.schema) {
      converted.schema = param.schema;
    } else if (param.type) {
      converted.schema = {
        type: param.type,
        format: param.format,
        enum: param.enum,
        default: param.default,
      };
    }

    return converted;
  }

  /**
   * Convert Swagger 2.0 response
   */
  private convertSwagger2Response(response: any): Response {
    const converted: Response = {
      description: response.description || '',
    };

    if (response.schema) {
      converted.content = {
        'application/json': {
          schema: response.schema,
        },
      };
    }

    if (response.headers) {
      converted.headers = response.headers;
    }

    return converted;
  }

  /**
   * Resolve all $ref references in the spec
   */
  private resolveRefs(): void {
    if (!this.spec) return;

    this.resolvedRefs.clear();
    this.refStack.clear();

    // Recursively resolve refs in paths
    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      this.spec.paths[path] = this.resolveRefsInObject(pathItem);
    }
  }

  /**
   * Recursively resolve $ref in an object
   */
  private resolveRefsInObject(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveRefsInObject(item));
    }

    if (obj.$ref) {
      return this.resolveReference(obj.$ref);
    }

    const resolved: any = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = this.resolveRefsInObject(value);
    }

    return resolved;
  }

  /**
   * Resolve a single $ref reference
   */
  private resolveReference(ref: string): any {
    // Check cache
    if (this.resolvedRefs.has(ref)) {
      return this.resolvedRefs.get(ref);
    }

    // Check for circular reference
    if (this.refStack.has(ref)) {
      console.warn(`Circular reference detected: ${ref}`);
      return { $ref: ref }; // Return unresolved to avoid infinite loop
    }

    this.refStack.add(ref);

    try {
      const resolved = this.resolveRefPath(ref);
      this.resolvedRefs.set(ref, resolved);
      return resolved;
    } finally {
      this.refStack.delete(ref);
    }
  }

  /**
   * Resolve reference path (e.g., #/components/schemas/User)
   */
  private resolveRefPath(ref: string): any {
    if (!this.spec) {
      throw new Error('No spec loaded');
    }

    // Only support internal refs for now
    if (!ref.startsWith('#/')) {
      console.warn(`External references not supported: ${ref}`);
      return { $ref: ref };
    }

    const path = ref.substring(2).split('/');
    let current: any = this.spec;

    for (const segment of path) {
      if (!current || typeof current !== 'object') {
        throw new Error(`Invalid reference path: ${ref}`);
      }
      current = current[segment];
    }

    if (!current) {
      throw new Error(`Reference not found: ${ref}`);
    }

    return current;
  }

  /**
   * Normalize path for comparison
   */
  private normalizePath(path: string): string {
    return path
      .replace(/\{([^}]+)\}/g, ':$1') // OpenAPI {param} -> :param
      .replace(/\/+$/, ''); // Remove trailing slash
  }

  /**
   * Get spec info
   */
  getInfo(): { title: string; version: string; description?: string } | null {
    return this.spec?.info || null;
  }

  /**
   * Get all tags
   */
  getTags(): string[] {
    if (!this.spec) return [];

    const tags = new Set<string>();
    for (const pathItem of Object.values(this.spec.paths)) {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
      for (const method of methods) {
        const operation = pathItem[method as keyof PathItem] as Operation | undefined;
        if (operation?.tags) {
          operation.tags.forEach(tag => tags.add(tag));
        }
      }
    }

    return Array.from(tags);
  }
}

// Made with Bob