# Convex DevTools

<p align="center">
  <img src="https://img.shields.io/npm/v/convex-devtools" alt="npm version">
  <img src="https://img.shields.io/npm/l/convex-devtools" alt="license">
  <img src="https://img.shields.io/npm/dt/convex-devtools" alt="downloads">
</p>

A standalone development tool for testing Convex queries, mutations, and actions with identity mocking, request saving, and auto-reloading schema discovery.

> ⚠️ **WARNING**: This tool is intended for **local development only**. It requires admin access to your Convex deployment.

## Features

- 🔍 **Function Explorer** - Browse all your Convex queries, mutations, and actions in a tree view
- 🎭 **Identity Mocking** - Test functions as different users with custom roles and claims
- 💾 **Request Collections** - Save and organize requests like Postman
- 📜 **History** - View and replay previous function calls
- 🔄 **Auto-reload** - Schema updates automatically when your Convex files change
- 📤 **Import/Export** - Share collections with your team

## Quick Start

### Installation

```bash
# Install globally
npm install -g convex-devtools

# Or with pnpm
pnpm add -g convex-devtools

# Or with yarn
yarn global add convex-devtools

# Or run directly with npx (no installation required)
npx convex-devtools
```

### Setup

1. Navigate to your Convex project directory

2. Add the following to your `.env.local` file:

```env
CONVEX_DEVTOOLS_ENABLED=true
CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOY_KEY=prod:your-deploy-key-here
```

3. Get your deploy key from the [Convex Dashboard](https://dashboard.convex.dev) under **Settings → Deploy Keys**.

### Running

```bash
# Run in your Convex project directory
convex-devtools

# Or specify a different directory
convex-devtools --dir /path/to/your/project

# Run on a custom port
convex-devtools --port 3000

# Share collections across all projects on this machine
convex-devtools --storage global

# Use a custom shared database path
convex-devtools --storage path --storage-path /path/to/devtools.sqlite

# Don't auto-open browser
convex-devtools --no-open
```

The tool will automatically open in your browser at `http://localhost:5173`.

## CLI Options

| Option                  | Description                                      | Default   |
| ----------------------- | ------------------------------------------------ | --------- |
| `-p, --port <number>`   | Port for the devtools server                     | `5173`    |
| `-d, --dir <path>`      | Path to Convex project directory                 | `.`       |
| `--storage <mode>`      | Storage scope: `project`, `global`, or `path`    | `project` |
| `--storage-path <path>` | Custom storage path (only with `--storage path`) | -         |
| `--no-open`             | Don't open browser automatically                 | -         |
| `-V, --version`         | Display version number                           | -         |
| `-h, --help`            | Display help information                         | -         |

## Storage Options

By default, collections and history are stored per project directory, so multiple ports running against different projects won’t share data.

- **project** (default): data stored under `<project>/.convex-devtools/devtools.sqlite`.
- **global**: shared data stored under `~/.convex-devtools/devtools.sqlite`.
- **path**: store data at a custom SQLite path you provide.

## Identity Mocking

The Identity Builder allows you to test functions as different users. You can set:

- **Subject** - The user's unique identifier (e.g., Clerk user ID)
- **Name/Email** - Display information
- **Roles** - Array of role strings (e.g., `["super_admin", "shop_admin"]`)
- **User Local ID** - Your app's internal user document ID
- **Custom Claims** - Any additional JWT claims your app uses

### Example Identity

```json
{
  "subject": "clerk_user_123",
  "name": "Test Admin",
  "email": "admin@example.com",
  "roles": ["super_admin"],
  "user_local_id": "k975abc123def456"
}
```

## Collections

Save requests to collections for easy access:

1. Select a function and configure its arguments
2. Click the save icon in the request panel
3. Choose or create a collection
4. Give the request a descriptive name

### Export/Import

- Click the export icon to download your collections as JSON
- Click the import icon to load collections from a JSON file
- Share collections with your team via version control

### Export Format

The export format is a simple JSON structure:

```json
{
  "version": "1.0",
  "exportedAt": "2025-01-29T10:00:00.000Z",
  "collections": [
    {
      "id": "abc123",
      "name": "Product Tests",
      "requests": [
        {
          "id": "def456",
          "name": "List all products",
          "functionPath": "products/products:list",
          "functionType": "query",
          "args": "{}",
          "identity": null,
          "savedAt": "2025-01-29T10:00:00.000Z"
        }
      ],
      "createdAt": "2025-01-29T10:00:00.000Z"
    }
  ]
}
```

## Programmatic Usage

You can also use convex-devtools programmatically in your Node.js projects:

```typescript
import { createServer, SchemaWatcher, ConvexClient } from 'convex-devtools';

// Start a schema watcher
const schemaWatcher = new SchemaWatcher('/path/to/project');
await schemaWatcher.start();

// Create and start the server
const server = await createServer({
  port: 5173,
  projectDir: '/path/to/project',
  convexUrl: 'https://your-deployment.convex.cloud',
  deployKey: 'prod:your-deploy-key',
  schemaWatcher,
});

// Clean up when done
schemaWatcher.stop();
server.close();
```

## Development

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/convex-devtools.git
cd convex-devtools

# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build for production
pnpm build:all
```

### Project Structure

```
convex-devtools/
├── src/
│   ├── cli/           # CLI entry point
│   ├── components/    # React components for the UI
│   ├── server/        # Express server & Convex client
│   └── stores/        # Zustand state management
├── public/            # Static assets
├── dist/              # Built output (generated)
└── package.json
```

### Scripts

| Script           | Description                      |
| ---------------- | -------------------------------- |
| `pnpm dev`       | Start development server         |
| `pnpm build`     | Build the frontend               |
| `pnpm build:cli` | Build the CLI                    |
| `pnpm build:all` | Build everything for production  |
| `pnpm typecheck` | Run TypeScript type checking     |
| `pnpm lint`      | Run ESLint                       |
| `pnpm preview`   | Preview production build locally |

## Publishing to npm

### First-time Setup

1. Create an npm account at [npmjs.com](https://www.npmjs.com/signup)

2. Login to npm from your terminal:

   ```bash
   npm login
   ```

3. Verify your login:
   ```bash
   npm whoami
   ```

### Building and Publishing

```bash
# 1. Make sure all tests pass and there are no errors
pnpm typecheck
pnpm lint

# 2. Build the project
pnpm build:all

# 3. Update the version (choose one)
npm version patch  # for bug fixes (0.1.0 -> 0.1.1)
npm version minor  # for new features (0.1.0 -> 0.2.0)
npm version major  # for breaking changes (0.1.0 -> 1.0.0)

# 4. Publish to npm
npm publish

# Or for a scoped package (if using @your-org/convex-devtools)
npm publish --access public
```

### Testing Before Publishing

```bash
# Create a tarball to see what will be published
npm pack

# This creates convex-devtools-x.x.x.tgz
# You can inspect it or install it locally:
npm install ./convex-devtools-0.1.0.tgz -g

# Test the CLI
convex-devtools --help
```

### Publishing a Pre-release

```bash
# For beta versions
npm version prerelease --preid=beta
npm publish --tag beta

# Users can install with: npm install convex-devtools@beta
```

## Security Considerations

- **Never use in production** - This tool has full admin access to your Convex deployment
- **Keep your deploy key secret** - Don't commit it to version control
- **Local development only** - The `CONVEX_DEVTOOLS_ENABLED` flag should never be set in production
- **Use dev deploy keys when possible** - Prefer `dev:xxx` keys over `prod:xxx` keys during development

## Troubleshooting

### "CONVEX_DEVTOOLS_ENABLED is not set to true"

Add `CONVEX_DEVTOOLS_ENABLED=true` to your `.env.local` file. This safety check ensures you don't accidentally run the devtools against production.

### "Convex generated files not found"

Run `npx convex dev` in your project directory first to generate the required files.

### "Identity mocking is disabled"

You need to set `CONVEX_DEPLOY_KEY` in your `.env.local` file. Get your deploy key from the Convex Dashboard under Settings → Deploy Keys.

### Port already in use

Use the `--port` flag to specify a different port:

```bash
convex-devtools --port 3001
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT © [Šahzudin Mahmić]

## Related Projects

- [Convex](https://convex.dev) - The backend platform this tool is designed for
- [Convex Dashboard](https://dashboard.convex.dev) - Official Convex admin dashboard
