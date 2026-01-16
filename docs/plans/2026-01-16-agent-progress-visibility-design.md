# Agent Progress Visibility Design

## Overview

Improve visibility into what agents are doing by adding detailed progress tracking with a checklist-style UI. Agents report their planned steps and progress via CLI commands, displayed in a redesigned mission control dashboard.

## Problem

Currently, agent status is limited to `pending | assigned | in_progress | completed | failed`. Users have no visibility into:
- What steps the agent plans to take
- How far along the agent is
- Why an agent might be stuck or failing

## Solution

### CLI Progress Commands

New commands under `repodepot progress`:

```bash
# Declare plan (replaces any existing plan for the task)
repodepot progress plan --task <id> "Step 1" "Step 2" "Step 3"

# Update step status (0-indexed)
repodepot progress update --task <id> --step 0 --status done
repodepot progress update --task <id> --step 1 --status in_progress
repodepot progress update --task <id> --step 1 --status done --note "Fixed null check"

# Add a step discovered mid-task
repodepot progress add --task <id> --after 2 "New step description"

# Ask user for clarification (agent blocks until answered)
repodepot progress ask --task <id> "Question?" --choices "Option A" "Option B"

# Wait for user's answer (blocks with timeout)
repodepot progress wait --task <id> --timeout 3600
# Returns: {"answer": "Option A", "answeredAt": "2026-01-16T10:30:00Z"}
```

**Step statuses:** `pending | in_progress | done | failed | skipped`

### Data Model

**New table: `task_steps`**

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (UUID) |
| taskId | TEXT | FK to issues table |
| index | INTEGER | Order of step (0-based) |
| description | TEXT | What this step does |
| status | TEXT | pending/in_progress/done/failed/skipped |
| note | TEXT | Optional note (e.g., failure reason) |
| startedAt | TEXT | ISO timestamp when step began |
| completedAt | TEXT | ISO timestamp when step finished |

**New table: `task_questions`**

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (UUID) |
| taskId | TEXT | FK to issues table |
| question | TEXT | The question asked |
| choices | TEXT | JSON array of choices (nullable) |
| answer | TEXT | User's response (nullable until answered) |
| askedAt | TEXT | ISO timestamp |
| answeredAt | TEXT | ISO timestamp (nullable) |

### API Endpoints

**Progress management:**
```
POST   /api/progress/:taskId/plan        - Create/replace steps for a task
GET    /api/progress/:taskId             - Get all steps for a task
PUT    /api/progress/:taskId/step/:index - Update step status
POST   /api/progress/:taskId/step        - Add a new step
```

**Clarification flow:**
```
POST   /api/progress/:taskId/ask         - Agent submits a question
GET    /api/progress/:taskId/answer      - Agent polls for answer (long-poll supported)
POST   /api/progress/:taskId/answer      - User submits answer (from dashboard)
```

### Web Dashboard Redesign

Replace Kanban columns with a mission control layout:

```
┌─────────────────────────────────────────────────────────────┐
│  RepoDepot                                    [+ New Issue] │
├─────────────────────────────────────────────────────────────┤
│  ⚠️ NEEDS ATTENTION (1)                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ repo-a • Fix auth timeout                              │ │
│  │ Agent asks: "Should I retry with exponential backoff   │ │
│  │             or fixed 5s delay?"                        │ │
│  │ [Exponential] [Fixed 5s] [Reply...]                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  🔄 ACTIVE (2)                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ repo-b • Add CSV export           2/4 steps            │ │
│  │ ☑ Investigate  ☑ Implement  ◉ Testing  ○ Commit       │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ repo-c • Update dependencies      1/3 steps            │ │
│  │ ◉ Analyzing  ○ Updating  ○ Verify build               │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  📋 QUEUED (5)              ✅ COMPLETED TODAY (3)         │
│  repo-a: 2 tasks            repo-b: Fix login bug          │
│  repo-d: 3 tasks            repo-c: Add dark mode          │
│                             repo-a: Update README          │
└─────────────────────────────────────────────────────────────┘
```

**Sections:**
- **Needs Attention** - Tasks with pending questions or failures
- **Active** - In-progress tasks with live step checklists
- **Queued** - Pending tasks grouped by repository
- **Completed** - Recently finished tasks for review

**Interactions:**
- Click choice buttons or type response for agent questions
- Expand active tasks to see full step details
- Click completed tasks to see summary/PR link

### Agent Prompt Template

Updated prompt to instruct Claude on progress reporting:

```
You are working on task ${taskId} for repository "${repoName}".
GitHub issue #${issueNumber}: "${title}"

Description:
${description}

IMPORTANT - Progress Reporting:
Before starting work, declare your plan:
  repodepot progress plan --task ${taskId} "Step 1" "Step 2" ...

As you complete each step:
  repodepot progress update --task ${taskId} --step <index> --status done

If you need clarification from the user:
  repodepot progress ask --task ${taskId} "Your question" --choices "Option A" "Option B"
  response=$(repodepot progress wait --task ${taskId})
  # Then use the response to continue

If you discover additional steps needed:
  repodepot progress add --task ${taskId} --after <index> "New step"

Your task:
1. Create your plan
2. Work through each step, reporting progress
3. Ask for clarification if requirements are ambiguous
4. Commit with message referencing issue #${issueNumber}
```

## Implementation Components

1. **CLI** (`packages/cli`)
   - New `progress` command group with subcommands
   - HTTP client calls to RepoDepot API

2. **Server** (`packages/server`)
   - New `task_steps` and `task_questions` tables
   - New `/api/progress/` routes
   - Long-polling support for answer endpoint

3. **Web** (`packages/web`)
   - Replace Kanban layout with mission control
   - New components: ActiveTaskCard, QuestionCard, QueuedSection, CompletedSection
   - Real-time updates via polling or WebSocket

4. **Shared** (`packages/shared`)
   - New types: TaskStep, TaskQuestion, StepStatus

## Out of Scope

- Real-time WebSocket updates (can use polling initially)
- Historical progress analytics
- Multiple concurrent questions per task
- GitHub issue comment sync for questions/answers
