import chokidar from 'chokidar';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

export interface FunctionInfo {
  name: string;
  path: string; // Full path like "products/products:list"
  type: 'query' | 'mutation' | 'action';
  args: ArgInfo[];
  returns?: string;
}

export interface ArgInfo {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
  enumValues?: string[];
}

export interface ModuleInfo {
  name: string;
  path: string;
  functions: FunctionInfo[];
  children: ModuleInfo[];
}

export interface SchemaInfo {
  modules: ModuleInfo[];
  tables: TableInfo[];
  lastUpdated: Date;
}

export interface TableInfo {
  name: string;
  fields: FieldInfo[];
}

export interface FieldInfo {
  name: string;
  type: string;
  optional: boolean;
}

export class SchemaWatcher extends EventEmitter {
  private projectDir: string;
  private watcher: chokidar.FSWatcher | null = null;
  private schemaInfo: SchemaInfo | null = null;

  constructor(projectDir: string) {
    super();
    this.projectDir = projectDir;
  }

  async start(): Promise<void> {
    // Initial parse
    await this.parseSchema();

    // Watch for changes
    const convexDir = path.join(this.projectDir, 'convex');

    this.watcher = chokidar.watch(convexDir, {
      persistent: true,
      ignoreInitial: true,
      ignored: [
        '**/node_modules/**',
        '**/_generated/**',
        '**/test.setup.ts',
        '**/*.test.ts',
      ],
    });

    this.watcher.on('change', async (filePath) => {
      if (filePath.endsWith('.ts') && !filePath.includes('_generated')) {
        console.log(`[SchemaWatcher] File changed: ${filePath}`);
        await this.parseSchema();
        this.emit('schema-updated', this.schemaInfo);
      }
    });

    this.watcher.on('add', async (filePath) => {
      if (filePath.endsWith('.ts') && !filePath.includes('_generated')) {
        console.log(`[SchemaWatcher] File added: ${filePath}`);
        await this.parseSchema();
        this.emit('schema-updated', this.schemaInfo);
      }
    });
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  getSchema(): SchemaInfo | null {
    return this.schemaInfo;
  }

  private async parseSchema(): Promise<void> {
    try {
      const convexDir = path.join(this.projectDir, 'convex');
      const modules = await this.parseConvexDirectory(convexDir);
      const tables = await this.parseSchemaFile(convexDir);

      this.schemaInfo = {
        modules,
        tables,
        lastUpdated: new Date(),
      };

      const funcCount = this.countFunctions(modules);
      console.log(
        `[SchemaWatcher] Parsed ${funcCount} functions from ${modules.length} modules`
      );
    } catch (error) {
      console.error('[SchemaWatcher] Error parsing schema:', error);
    }
  }

  private countFunctions(modules: ModuleInfo[]): number {
    let count = 0;
    for (const mod of modules) {
      count += mod.functions.length;
      count += this.countFunctions(mod.children);
    }
    return count;
  }

  private async parseConvexDirectory(convexDir: string): Promise<ModuleInfo[]> {
    const modules: ModuleInfo[] = [];

    // Read convex directory structure
    const entries = fs.readdirSync(convexDir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden, generated, and test files
      if (
        entry.name.startsWith('.') ||
        entry.name.startsWith('_') ||
        entry.name === 'node_modules' ||
        entry.name.endsWith('.test.ts') ||
        entry.name === 'test.setup.ts'
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        // Parse subdirectory as module
        const subModule = await this.parseSubdirectory(
          path.join(convexDir, entry.name),
          entry.name
        );
        if (subModule.functions.length > 0 || subModule.children.length > 0) {
          modules.push(subModule);
        }
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        // Parse root-level file
        const filePath = path.join(convexDir, entry.name);
        const moduleName = entry.name.replace('.ts', '');
        const functions = await this.parseFile(filePath, moduleName);

        if (functions.length > 0) {
          modules.push({
            name: moduleName,
            path: moduleName,
            functions,
            children: [],
          });
        }
      }
    }

    return modules;
  }

  private async parseSubdirectory(
    dirPath: string,
    parentPath: string
  ): Promise<ModuleInfo> {
    const module: ModuleInfo = {
      name: path.basename(dirPath),
      path: parentPath,
      functions: [],
      children: [],
    };

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip tests directory and test files
      if (
        entry.name === 'tests' ||
        entry.name.endsWith('.test.ts') ||
        entry.name.startsWith('.')
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        const subModule = await this.parseSubdirectory(
          path.join(dirPath, entry.name),
          `${parentPath}/${entry.name}`
        );
        if (subModule.functions.length > 0 || subModule.children.length > 0) {
          module.children.push(subModule);
        }
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        const filePath = path.join(dirPath, entry.name);
        const moduleName = entry.name.replace('.ts', '');
        const modulePath = `${parentPath}/${moduleName}`;
        const functions = await this.parseFile(filePath, modulePath);

        // Create a child module for each file (group by file)
        if (functions.length > 0) {
          module.children.push({
            name: moduleName,
            path: modulePath,
            functions,
            children: [],
          });
        }
      }
    }

    return module;
  }

  private async parseFile(
    filePath: string,
    modulePath: string
  ): Promise<FunctionInfo[]> {
    const functions: FunctionInfo[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Parse exported functions using regex
      // Match patterns like: export const functionName = query({ or mutation({ or action({
      const exportPattern =
        /export\s+const\s+(\w+)\s*=\s*(query|mutation|action|internalQuery|internalMutation|internalAction)\s*\(\s*\{/g;

      let match;
      while ((match = exportPattern.exec(content)) !== null) {
        const [, funcName, funcType] = match;

        // Normalize internal functions to their base type
        let normalizedType = funcType as 'query' | 'mutation' | 'action';
        if (funcType.startsWith('internal')) {
          normalizedType = funcType.replace('internal', '').toLowerCase() as
            | 'query'
            | 'mutation'
            | 'action';
        }

        // Extract JSDoc comment above the function
        const jsdocComment = this.extractJSDocAbove(content, match.index);

        // Extract args from the function definition
        const args = this.extractArgsFromPosition(
          content,
          match.index,
          jsdocComment
        );

        functions.push({
          name: funcName,
          path: `${modulePath}:${funcName}`,
          type: normalizedType,
          args,
        });
      }
    } catch (error) {
      console.error(`[SchemaWatcher] Error parsing file ${filePath}:`, error);
    }

    return functions;
  }

  private extractJSDocAbove(content: string, position: number): string {
    // Look backwards from position to find JSDoc comment
    // Allow some whitespace and newlines between the JSDoc and the export
    const beforePosition = content.slice(0, position);
    // Match JSDoc that ends with */ followed by optional whitespace before the export
    const jsdocMatch = beforePosition.match(/\/\*\*([\s\S]*?)\*\/\s*$/);
    if (jsdocMatch) {
      return jsdocMatch[1];
    }

    // Also try to find JSDoc within the last 500 chars (in case there's space between)
    const last500 = beforePosition.slice(-500);
    const jsdocMatch2 = last500.match(/\/\*\*([\s\S]*?)\*\//);
    return jsdocMatch2 ? jsdocMatch2[1] : '';
  }

  private parseJSDocParams(
    jsdoc: string
  ): Map<string, { description: string; enumValues?: string[] }> {
    const params = new Map<
      string,
      { description: string; enumValues?: string[] }
    >();

    // Match @param patterns like: @param sortBy - Sort order: 'newest', 'oldest'
    const paramPattern = /@param\s+(\w+)\s*-?\s*([^@]*)/g;
    let match;
    while ((match = paramPattern.exec(jsdoc)) !== null) {
      const [, paramName, description] = match;
      const trimmedDesc = description.trim();

      // Extract enum values from description (quoted strings like 'value1', 'value2')
      const enumMatches = trimmedDesc.match(/'([^']+)'/g);
      const enumValues = enumMatches
        ? enumMatches.map((e) => e.replace(/'/g, ''))
        : undefined;

      params.set(paramName, {
        description: trimmedDesc,
        enumValues:
          enumValues && enumValues.length > 0 ? enumValues : undefined,
      });
    }

    return params;
  }

  private extractArgsFromPosition(
    content: string,
    startIndex: number,
    jsdocComment: string = ''
  ): ArgInfo[] {
    const args: ArgInfo[] = [];
    const jsdocParams = this.parseJSDocParams(jsdocComment);

    // Find the args: { ... } section
    const afterStart = content.slice(startIndex);
    const argsMatch = afterStart.match(/args:\s*\{([^}]*)\}/s);

    if (argsMatch) {
      const argsContent = argsMatch[1];

      // Parse individual args
      // Matches patterns like: argName: v.string(), argName: v.optional(v.id('users'))
      const argPattern = /(\w+):\s*(v\.optional\()?v\.(\w+)/g;

      let argMatch;
      while ((argMatch = argPattern.exec(argsContent)) !== null) {
        const [, argName, isOptional, argType] = argMatch;
        const jsdocInfo = jsdocParams.get(argName);

        args.push({
          name: argName,
          type: argType,
          optional: !!isOptional,
          description: jsdocInfo?.description,
          enumValues: jsdocInfo?.enumValues,
        });
      }
    }

    // Check for paginationOpts (built-in Convex pagination)
    const hasPaginationOpts = afterStart.match(/paginationOptsValidator/s);
    if (hasPaginationOpts) {
      // Add paginationOpts as a synthetic argument
      args.push({
        name: 'paginationOpts',
        type: 'PaginationOptions',
        optional: false,
        description: 'Pagination options with cursor and numItems',
      });
    }

    return args;
  }

  private async parseSchemaFile(convexDir: string): Promise<TableInfo[]> {
    const tables: TableInfo[] = [];
    const schemaPath = path.join(convexDir, 'schema.ts');

    if (!fs.existsSync(schemaPath)) {
      return tables;
    }

    try {
      const content = fs.readFileSync(schemaPath, 'utf-8');

      // Match table definitions: tableName: defineTable(
      const tablePattern = /(\w+):\s*defineTable\(/g;

      let match;
      while ((match = tablePattern.exec(content)) !== null) {
        tables.push({
          name: match[1],
          fields: [], // Could parse fields but keeping simple for now
        });
      }
    } catch (error) {
      console.error('[SchemaWatcher] Error parsing schema file:', error);
    }

    return tables;
  }
}
