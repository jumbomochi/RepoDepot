# RepoDepot

A GitHub repository manager with Kanban-style visualization for issues and projects.

## Project Structure

This is a monorepo managed with pnpm workspaces containing four packages:

```
packages/
├── shared/     # Shared TypeScript types and interfaces
├── cli/        # Command-line interface for managing projects and issues
├── server/     # Express API server
└── web/        # React web dashboard with drag-and-drop Kanban board
```

## Prerequisites

- Node.js >= 20
- pnpm >= 9.15.0

## Installation

```bash
# Install pnpm globally if not already installed
npm install -g pnpm

# Install all dependencies
pnpm install

# Build all packages
cd packages/shared && pnpm build
cd ../server && pnpm build
cd ../cli && pnpm build
cd ../web && pnpm build
```

## Quick Start

### 1. Initialize the Database

```bash
cd packages/cli
node dist/index.js init
```

This creates a SQLite database file `repodepot.db` and sets up the schema.

### 2. Add a Project

```bash
node dist/index.js add-project \
  --name "My Project" \
  --repo "https://github.com/user/repo" \
  --description "Project description"
```

### 3. Create Issues

```bash
node dist/index.js create-issue \
  --project <project-id> \
  --title "Issue title" \
  --description "Issue description" \
  --status backlog \
  --priority medium \
  --labels "bug,frontend"
```

### 4. Start the API Server

```bash
cd packages/server
pnpm dev
```

Server runs on http://localhost:3001

### 5. Start the Web Dashboard

```bash
cd packages/web
pnpm dev
```

Dashboard runs on http://localhost:3000

## CLI Commands

### Initialize Database
```bash
repodepot init [--db <path>]
```

### Add Project
```bash
repodepot add-project -n <name> -r <repo-url> [-d <description>]
```

### Create Issue
```bash
repodepot create-issue -p <project-id> -t <title> \
  [-d <description>] [-s <status>] [--priority <priority>] \
  [-a <assignee>] [-l <labels>]
```

### List Projects or Issues
```bash
repodepot list [projects|issues] [-p <project-id>]
```

### View Project Status
```bash
repodepot status [-p <project-id>]
```

## Features

### CLI
- Database initialization
- Project management (add, list)
- Issue creation and management
- Status overview by project

### API Server
- RESTful endpoints for projects, users, and issues
- Query filtering by project, status, assignee, priority
- CRUD operations for all entities

### Web Dashboard
- Project selector dropdown
- Kanban board with 5 columns (Backlog, To Do, In Progress, Review, Done)
- Drag-and-drop issue cards between columns
- Real-time status updates
- Priority color coding
- Label badges

## Technology Stack

- **Language**: TypeScript
- **CLI**: Commander.js
- **Server**: Express.js, better-sqlite3
- **Web**: React, Vite, React Router, dnd-kit
- **Monorepo**: pnpm workspaces

## Database Schema

- **projects**: Project information
- **users**: User accounts
- **issues**: Issues with status, priority, assignee
- **issue_labels**: Many-to-many relationship for labels
- **comments**: Issue comments

## API Endpoints

### Projects
- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get project by ID
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Users
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Issues
- `GET /api/issues` - List issues (supports filtering)
- `GET /api/issues/:id` - Get issue by ID
- `POST /api/issues` - Create issue
- `PUT /api/issues/:id` - Update issue
- `DELETE /api/issues/:id` - Delete issue

Query parameters for filtering:
- `projectId` - Filter by project
- `status` - Filter by status
- `assigneeId` - Filter by assignee
- `priority` - Filter by priority

## Development

```bash
# Run server in dev mode
cd packages/server
pnpm dev

# Run web dashboard in dev mode
cd packages/web
pnpm dev

# Build all packages
pnpm build
```

## License

MIT
