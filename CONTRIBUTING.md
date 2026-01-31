# Contributing to Convex DevTools

Thank you for your interest in contributing to Convex DevTools! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

1. Check existing [issues](https://github.com/sahzudinp/convex-devtools/issues) to avoid duplicates
2. Use the bug report template when creating a new issue
3. Include:
   - Clear description of the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - Your environment (OS, Node.js version, npm/pnpm version)
   - Screenshots if applicable

### Suggesting Features

1. Check existing issues for similar suggestions
2. Open a new issue with the "feature request" label
3. Describe the feature and its use case
4. Explain why it would benefit users

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Install dependencies**: `pnpm install`
3. **Make your changes**
4. **Test your changes**: `pnpm dev` to run locally
5. **Run checks**:
   ```bash
   pnpm typecheck
   pnpm lint
   pnpm build:all
   ```
6. **Commit your changes** with a clear commit message
7. **Push to your fork** and open a Pull Request

### Commit Messages

Use clear, descriptive commit messages:

- `feat: add new feature X`
- `fix: resolve issue with Y`
- `docs: update README`
- `refactor: improve Z implementation`
- `chore: update dependencies`

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm (recommended)

### Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/convex-devtools.git
cd convex-devtools

# Install dependencies
pnpm install

# Start development server
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
└── dist/              # Built output (generated)
```

## Questions?

Feel free to open an issue for any questions about contributing.

Thank you for helping make Convex DevTools better! 🎉
