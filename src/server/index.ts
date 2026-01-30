import cors from 'cors';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import { ConvexClient } from './convex-client.js';
import { SchemaWatcher } from './schema-watcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ServerConfig {
  port: number;
  projectDir: string;
  convexUrl: string;
  deployKey: string;
  schemaWatcher: SchemaWatcher;
}

export async function createServer(config: ServerConfig): Promise<http.Server> {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Serve static UI files in production
  const uiPath = path.join(__dirname, '..', 'ui');
  app.use(express.static(uiPath));

  // Create Convex client
  const convexClient = new ConvexClient(config.convexUrl, config.deployKey);

  // API Routes
  app.get('/api/schema', (_req, res) => {
    const schema = config.schemaWatcher.getSchema();
    if (!schema) {
      res.status(503).json({ error: 'Schema not yet loaded' });
      return;
    }
    res.json(schema);
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      convexUrl: config.convexUrl,
      projectDir: config.projectDir,
    });
  });

  // Invoke a function
  app.post('/api/invoke', async (req, res) => {
    const { functionPath, functionType, args, jwtToken } = req.body;

    if (!functionPath || !functionType) {
      res.status(400).json({ error: 'Missing functionPath or functionType' });
      return;
    }

    try {
      const startTime = Date.now();
      const result = await convexClient.invoke(
        functionPath,
        functionType,
        args || {},
        { jwtToken }
      );
      const duration = Date.now() - startTime;

      res.json({
        success: true,
        result,
        duration,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.json({
        success: false,
        error: {
          message: error.message,
          code: error.code,
          data: error.data,
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Create HTTP server
  const server = http.createServer(app);

  // WebSocket for real-time schema updates
  const wss = new WebSocketServer({ server, path: '/ws' });

  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    clients.add(ws);

    // Send initial schema
    const schema = config.schemaWatcher.getSchema();
    if (schema) {
      ws.send(JSON.stringify({ type: 'schema', data: schema }));
    }

    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  // Broadcast schema updates
  config.schemaWatcher.on('schema-updated', (schema) => {
    const message = JSON.stringify({ type: 'schema', data: schema });
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  });

  // SPA fallback - serve index.html for non-API routes
  app.get('*', (_req, res) => {
    res.sendFile(path.join(uiPath, 'index.html'));
  });

  return new Promise((resolve) => {
    server.listen(config.port, () => {
      resolve(server);
    });
  });
}
