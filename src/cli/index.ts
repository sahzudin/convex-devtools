#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import dotenv from 'dotenv';
import fs from 'fs';
import open from 'open';
import os from 'os';
import path from 'path';
import { createServer } from '../server/index.js';
import { SchemaWatcher } from '../server/schema-watcher.js';

const program = new Command();

program
  .name('convex-devtools')
  .description('A standalone development tool for testing Convex functions')
  .version('1.0.1');

program
  .option('-p, --port <number>', 'Port for the devtools server', '5173')
  .option('-d, --dir <path>', 'Path to Convex project directory', '.')
  .option(
    '--storage <mode>',
    'Storage scope: project (default), global, or path',
    'project'
  )
  .option(
    '--storage-path <path>',
    'Custom storage path when using --storage path'
  )
  .option('--no-open', 'Do not open browser automatically')
  .action(async (options) => {
    const projectDir = path.resolve(options.dir);

    // Load .env.local from the project directory
    const envLocalPath = path.join(projectDir, '.env.local');
    const envPath = path.join(projectDir, '.env');

    if (fs.existsSync(envLocalPath)) {
      dotenv.config({ path: envLocalPath });
    } else if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }

    // Check for required environment variables
    if (process.env.CONVEX_DEVTOOLS_ENABLED !== 'true') {
      console.error(
        chalk.red('✗ CONVEX_DEVTOOLS_ENABLED is not set to "true"')
      );
      console.error(
        chalk.yellow(
          '  Add CONVEX_DEVTOOLS_ENABLED=true to your .env.local file'
        )
      );
      console.error(
        chalk.yellow('  This tool is intended for local development only.')
      );
      process.exit(1);
    }

    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      console.error(chalk.red('✗ CONVEX_URL is not set'));
      console.error(
        chalk.yellow(
          '  Make sure you have a valid Convex deployment URL in your .env.local'
        )
      );
      process.exit(1);
    }

    // Deploy key is optional for local development
    // Without it, identity mocking won't work but you can still invoke functions
    const deployKey = process.env.CONVEX_DEPLOY_KEY || '';
    if (!deployKey) {
      console.log(chalk.yellow('⚠ CONVEX_DEPLOY_KEY is not set'));
      console.log(chalk.yellow('  Identity mocking will be disabled.'));
      console.log(
        chalk.yellow(
          '  To enable, add to .env.local: CONVEX_DEPLOY_KEY=prod:xxx or dev:xxx'
        )
      );
      console.log();
    }

    // Check for convex/_generated directory
    const generatedDir = path.join(projectDir, 'convex', '_generated');
    if (!fs.existsSync(generatedDir)) {
      console.error(chalk.red('✗ Convex generated files not found'));
      console.error(chalk.yellow(`  Expected: ${generatedDir}`));
      console.error(chalk.yellow('  Run "npx convex dev" to generate them.'));
      process.exit(1);
    }

    console.log(chalk.cyan('╔══════════════════════════════════════════╗'));
    console.log(
      chalk.cyan('║') +
        chalk.white.bold('         Convex DevTools v1.0.0           ') +
        chalk.cyan('║')
    );
    console.log(chalk.cyan('╚══════════════════════════════════════════╝'));
    console.log();
    console.log(chalk.green('✓') + ' Environment validated');
    console.log(chalk.green('✓') + ` Convex URL: ${chalk.dim(convexUrl)}`);
    console.log(chalk.green('✓') + ` Project: ${chalk.dim(projectDir)}`);
    console.log();

    const storageMode = String(options.storage || 'project');
    let persistencePath: string | undefined;

    if (storageMode === 'project') {
      persistencePath = path.join(
        projectDir,
        '.convex-devtools',
        'devtools.sqlite'
      );
    } else if (storageMode === 'global') {
      persistencePath = path.join(
        os.homedir(),
        '.convex-devtools',
        'devtools.sqlite'
      );
    } else if (storageMode === 'path') {
      if (!options.storagePath) {
        console.error(
          chalk.red('✗ --storage path requires --storage-path <path>')
        );
        process.exit(1);
      }
      persistencePath = path.resolve(String(options.storagePath));
    } else {
      console.error(
        chalk.red('✗ Invalid --storage value. Use project, global, or path.')
      );
      process.exit(1);
    }

    // Start schema watcher
    const schemaWatcher = new SchemaWatcher(projectDir);
    await schemaWatcher.start();

    // Start server
    const port = parseInt(options.port, 10);
    const server = await createServer({
      port,
      projectDir,
      convexUrl,
      deployKey,
      schemaWatcher,
      persistencePath,
    });

    console.log(
      chalk.green('✓') +
        ` DevTools running at ${chalk.cyan(`http://localhost:${port}`)}`
    );
    console.log();
    console.log(chalk.dim('Press Ctrl+C to stop'));

    if (options.open !== false) {
      await open(`http://localhost:${port}`);
    }

    // Handle shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.dim('\nShutting down...'));
      schemaWatcher.stop();
      server.close();
      process.exit(0);
    });
  });

program.parse();
