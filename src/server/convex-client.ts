/**
 * Convex HTTP Client wrapper for DevTools
 * Supports two authentication methods:
 * 1. Deploy key - runs as admin (for admin operations)
 * 2. JWT token - runs as the authenticated user (from your auth provider like Clerk)
 */

export interface UserIdentity {
  subject: string;
  issuer?: string;
  tokenIdentifier?: string;
  name?: string;
  email?: string;
  pictureUrl?: string;
  // Custom claims
  [key: string]: unknown;
}

export interface InvokeOptions {
  identity?: UserIdentity;
  jwtToken?: string; // Real JWT token from auth provider
}

export class ConvexClient {
  private baseUrl: string;
  private deployKey: string;

  constructor(convexUrl: string, deployKey: string) {
    // Convert deployment URL to HTTP endpoint
    // e.g., https://happy-otter-123.convex.cloud -> https://happy-otter-123.convex.cloud
    this.baseUrl = convexUrl;
    this.deployKey = deployKey;
  }

  async invoke(
    functionPath: string,
    functionType: 'query' | 'mutation' | 'action',
    args: Record<string, unknown> = {},
    options?: InvokeOptions
  ): Promise<unknown> {
    // Normalize function path: module/submodule:functionName
    const normalizedPath = this.normalizeFunctionPath(functionPath);

    // Build the request
    const endpoint = this.getEndpoint(functionType);
    const url = `${this.baseUrl}/${endpoint}`;

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Convex-Client': 'convex-devtools-0.1.0',
    };

    // Authentication priority:
    // 1. JWT token (authenticates as the user who owns the token)
    // 2. Deploy key (authenticates as admin)
    // 3. No auth (unauthenticated request)
    if (options?.jwtToken) {
      // Use Bearer token auth - this is what the Convex HTTP API expects for user auth
      headers['Authorization'] = `Bearer ${options.jwtToken}`;
      console.log('[ConvexClient] Using JWT token authentication');
    } else if (this.deployKey) {
      // Deploy key gives admin access but cannot impersonate users
      headers['Authorization'] = `Convex ${this.deployKey}`;
      console.log('[ConvexClient] Using deploy key (admin) authentication');
    }
    // Without any auth, calls will be unauthenticated

    const body = {
      path: normalizedPath,
      args: this.encodeArgs(args),
      format: 'json',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      const error = new Error(errorData.message || `HTTP ${response.status}`);
      (error as any).code = errorData.code;
      (error as any).data = errorData;
      throw error;
    }

    const result = await response.json();
    return this.decodeResult(result);
  }

  private normalizeFunctionPath(path: string): string {
    // Convert various formats to Convex function path format
    // Input: "products/products:list" or "products.products.list" or "products/products/list"
    // Output: "products/products:list"

    // Already in correct format
    if (path.includes(':')) {
      return path;
    }

    // Dot notation: products.products.list -> products/products:list
    if (path.includes('.')) {
      const parts = path.split('.');
      const funcName = parts.pop()!;
      return `${parts.join('/')}:${funcName}`;
    }

    // Slash only: products/products/list -> products/products:list
    const parts = path.split('/');
    if (parts.length > 1) {
      const funcName = parts.pop()!;
      return `${parts.join('/')}:${funcName}`;
    }

    return path;
  }

  private getEndpoint(functionType: 'query' | 'mutation' | 'action'): string {
    switch (functionType) {
      case 'query':
        return 'api/query';
      case 'mutation':
        return 'api/mutation';
      case 'action':
        return 'api/action';
    }
  }

  private encodeArgs(args: Record<string, unknown>): Record<string, unknown> {
    // Convex uses a special encoding format for complex types
    // For now, we'll pass through JSON-serializable values
    // Special handling for Convex types like Id, etc.
    return this.convertToConvexJson(args) as Record<string, unknown>;
  }

  private convertToConvexJson(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((v) => this.convertToConvexJson(v));
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;

      // Check for special $type markers (Convex encoded JSON)
      if ('$type' in obj) {
        return obj; // Already encoded
      }

      // Regular object
      const converted: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        converted[k] = this.convertToConvexJson(v);
      }
      return converted;
    }

    // Handle BigInt
    if (typeof value === 'bigint') {
      return { $type: 'bigint', value: value.toString() };
    }

    return value;
  }

  private decodeResult(result: unknown): unknown {
    // Decode Convex-specific types back to JavaScript
    return this.convertFromConvexJson(result);
  }

  private convertFromConvexJson(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((v) => this.convertFromConvexJson(v));
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;

      // Check for special $type markers
      if ('$type' in obj) {
        switch (obj.$type) {
          case 'bigint':
            return BigInt(obj.value as string);
          case 'bytes':
            return new Uint8Array(obj.value as number[]);
          default:
            return obj;
        }
      }

      // Regular object
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        result[k] = this.convertFromConvexJson(v);
      }
      return result;
    }

    return value;
  }
}
