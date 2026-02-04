import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';

export interface PersistenceData {
  collections: unknown[];
  history: unknown[];
  dataHistory: unknown[];
}

const DEFAULT_DATA: PersistenceData = {
  collections: [],
  history: [],
  dataHistory: [],
};

export class PersistenceDb {
  private db: Database;
  private dbFilePath: string;
  private SQL: SqlJsStatic;

  private constructor(db: Database, dbFilePath: string, SQL: SqlJsStatic) {
    this.db = db;
    this.dbFilePath = dbFilePath;
    this.SQL = SQL;
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)'
    );
  }

  static async create(dbFilePath: string): Promise<PersistenceDb> {
    const dir = path.dirname(dbFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const require = createRequire(import.meta.url);
    const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');

    const SQL: SqlJsStatic = await initSqlJs({
      locateFile: () => wasmPath,
    });

    let db: Database;
    if (fs.existsSync(dbFilePath)) {
      const fileBuffer = fs.readFileSync(dbFilePath);
      db = new SQL.Database(new Uint8Array(fileBuffer));
    } else {
      db = new SQL.Database();
    }

    return new PersistenceDb(db, dbFilePath, SQL);
  }

  /** Reload database from disk to pick up changes from other processes */
  private reloadFromDisk(): void {
    if (fs.existsSync(this.dbFilePath)) {
      const fileBuffer = fs.readFileSync(this.dbFilePath);
      this.db = new this.SQL.Database(new Uint8Array(fileBuffer));
    }
  }

  getData(): PersistenceData {
    // Reload from disk to get latest data from other server instances
    this.reloadFromDisk();

    const result = this.db.exec(
      "SELECT value FROM kv WHERE key = 'persistence'"
    );

    if (!result.length || !result[0].values.length) {
      return DEFAULT_DATA;
    }

    const value = result[0].values[0][0];
    if (typeof value !== 'string') {
      return DEFAULT_DATA;
    }

    try {
      const parsed = JSON.parse(value) as PersistenceData;
      return {
        collections: Array.isArray(parsed.collections)
          ? parsed.collections
          : [],
        history: Array.isArray(parsed.history) ? parsed.history : [],
        dataHistory: Array.isArray(parsed.dataHistory) ? parsed.dataHistory : [],
      };
    } catch {
      return DEFAULT_DATA;
    }
  }

  setData(data: PersistenceData): void {
    const payload = JSON.stringify({
      collections: Array.isArray(data.collections) ? data.collections : [],
      history: Array.isArray(data.history) ? data.history : [],
      dataHistory: Array.isArray(data.dataHistory) ? data.dataHistory : [],
    });

    this.db.run(
      'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      ['persistence', payload, new Date().toISOString()]
    );

    this.persistToDisk();
  }

  private persistToDisk(): void {
    const data = this.db.export();
    fs.writeFileSync(this.dbFilePath, Buffer.from(data));
  }
}
