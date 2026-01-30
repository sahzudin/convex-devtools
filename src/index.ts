// Main entry point for programmatic usage
export { ConvexClient } from './server/convex-client.js';
export { createServer } from './server/index.js';
export { SchemaWatcher } from './server/schema-watcher.js';

export type {
  FunctionInfo,
  ModuleInfo,
  SchemaInfo,
  TableInfo,
} from './server/schema-watcher.js';

export type { UserIdentity } from './server/convex-client.js';
