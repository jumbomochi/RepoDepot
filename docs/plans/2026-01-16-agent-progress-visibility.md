# Agent Progress Visibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add detailed progress tracking for agents with a checklist-style UI showing steps, plus a clarification flow for agent questions.

**Architecture:** CLI commands report progress to server API, stored in SQLite. Web dashboard redesigned as mission control with live progress display. Agents can pause and ask questions, users respond in dashboard.

**Tech Stack:** TypeScript, Commander.js (CLI), Express (server), React (web), SQLite (database)

---

## Task 1: Add Shared Types

**Files:**
- Modify: `packages/shared/src/index.ts`

**Step 1: Add step and question types to shared package**

Add at end of file:

```typescript
// Agent Progress types
export type StepStatus = 'pending' | 'in_progress' | 'done' | 'failed' | 'skipped';

export interface TaskStep {
  id: string;
  taskId: string;
  index: number;
  description: string;
  status: StepStatus;
  note?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TaskQuestion {
  id: string;
  taskId: string;
  question: string;
  choices?: string[];
  answer?: string;
  askedAt: string;
  answeredAt?: string;
}

export interface TaskProgress {
  taskId: string;
  steps: TaskStep[];
  currentQuestion?: TaskQuestion;
}
```

**Step 2: Build shared package**

Run: `pnpm --filter @repodepot/shared build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): add TaskStep and TaskQuestion types"
```

---

## Task 2: Add Database Tables and Migrations

**Files:**
- Modify: `packages/server/src/db/connection.ts`

**Step 1: Add task_steps table to SCHEMA constant**

Add before the `-- Indexes` section:

```sql
-- Task progress steps
CREATE TABLE IF NOT EXISTS task_steps (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'done', 'failed', 'skipped')) DEFAULT 'pending',
    note TEXT,
    started_at TEXT,
    completed_at TEXT,
    FOREIGN KEY (task_id) REFERENCES issues(id) ON DELETE CASCADE
);

-- Task questions for agent clarification
CREATE TABLE IF NOT EXISTS task_questions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    question TEXT NOT NULL,
    choices TEXT,
    answer TEXT,
    asked_at TEXT NOT NULL,
    answered_at TEXT,
    FOREIGN KEY (task_id) REFERENCES issues(id) ON DELETE CASCADE
);
```

**Step 2: Add indexes for new tables**

Add to the indexes section:

```sql
CREATE INDEX IF NOT EXISTS idx_task_steps_task_id ON task_steps(task_id);
CREATE INDEX IF NOT EXISTS idx_task_questions_task_id ON task_questions(task_id);
```

**Step 3: Build server to verify schema syntax**

Run: `pnpm --filter @repodepot/server build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/server/src/db/connection.ts
git commit -m "feat(server): add task_steps and task_questions tables"
```

---

## Task 3: Create Progress Repository

**Files:**
- Create: `packages/server/src/repositories/ProgressRepository.ts`
- Modify: `packages/server/src/repositories/index.ts`

**Step 1: Create ProgressRepository**

Create `packages/server/src/repositories/ProgressRepository.ts`:

```typescript
import type { Database } from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { TaskStep, TaskQuestion, StepStatus } from '@repodepot/shared';

export class ProgressRepository {
  constructor(private db: Database) {}

  // === Steps ===

  createPlan(taskId: string, steps: string[]): TaskStep[] {
    // Delete existing steps for this task
    this.db.prepare('DELETE FROM task_steps WHERE task_id = ?').run(taskId);

    const insert = this.db.prepare(`
      INSERT INTO task_steps (id, task_id, idx, description, status)
      VALUES (?, ?, ?, ?, 'pending')
    `);

    const createdSteps: TaskStep[] = [];
    for (let i = 0; i < steps.length; i++) {
      const id = randomUUID();
      insert.run(id, taskId, i, steps[i]);
      createdSteps.push({
        id,
        taskId,
        index: i,
        description: steps[i],
        status: 'pending',
      });
    }

    return createdSteps;
  }

  getSteps(taskId: string): TaskStep[] {
    const rows = this.db.prepare(`
      SELECT id, task_id, idx, description, status, note, started_at, completed_at
      FROM task_steps
      WHERE task_id = ?
      ORDER BY idx ASC
    `).all(taskId) as any[];

    return rows.map(row => ({
      id: row.id,
      taskId: row.task_id,
      index: row.idx,
      description: row.description,
      status: row.status as StepStatus,
      note: row.note || undefined,
      startedAt: row.started_at || undefined,
      completedAt: row.completed_at || undefined,
    }));
  }

  updateStep(taskId: string, index: number, status: StepStatus, note?: string): TaskStep | null {
    const now = new Date().toISOString();
    const updates: string[] = ['status = ?'];
    const params: any[] = [status];

    if (note !== undefined) {
      updates.push('note = ?');
      params.push(note);
    }

    if (status === 'in_progress') {
      updates.push('started_at = ?');
      params.push(now);
    } else if (status === 'done' || status === 'failed' || status === 'skipped') {
      updates.push('completed_at = ?');
      params.push(now);
    }

    params.push(taskId, index);

    this.db.prepare(`
      UPDATE task_steps
      SET ${updates.join(', ')}
      WHERE task_id = ? AND idx = ?
    `).run(...params);

    const row = this.db.prepare(`
      SELECT id, task_id, idx, description, status, note, started_at, completed_at
      FROM task_steps
      WHERE task_id = ? AND idx = ?
    `).get(taskId, index) as any;

    if (!row) return null;

    return {
      id: row.id,
      taskId: row.task_id,
      index: row.idx,
      description: row.description,
      status: row.status as StepStatus,
      note: row.note || undefined,
      startedAt: row.started_at || undefined,
      completedAt: row.completed_at || undefined,
    };
  }

  addStep(taskId: string, description: string, afterIndex: number): TaskStep {
    // Shift subsequent steps
    this.db.prepare(`
      UPDATE task_steps
      SET idx = idx + 1
      WHERE task_id = ? AND idx > ?
    `).run(taskId, afterIndex);

    const id = randomUUID();
    const newIndex = afterIndex + 1;

    this.db.prepare(`
      INSERT INTO task_steps (id, task_id, idx, description, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(id, taskId, newIndex, description);

    return {
      id,
      taskId,
      index: newIndex,
      description,
      status: 'pending',
    };
  }

  // === Questions ===

  askQuestion(taskId: string, question: string, choices?: string[]): TaskQuestion {
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO task_questions (id, task_id, question, choices, asked_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, taskId, question, choices ? JSON.stringify(choices) : null, now);

    return {
      id,
      taskId,
      question,
      choices,
      askedAt: now,
    };
  }

  getPendingQuestion(taskId: string): TaskQuestion | null {
    const row = this.db.prepare(`
      SELECT id, task_id, question, choices, answer, asked_at, answered_at
      FROM task_questions
      WHERE task_id = ? AND answer IS NULL
      ORDER BY asked_at DESC
      LIMIT 1
    `).get(taskId) as any;

    if (!row) return null;

    return {
      id: row.id,
      taskId: row.task_id,
      question: row.question,
      choices: row.choices ? JSON.parse(row.choices) : undefined,
      answer: row.answer || undefined,
      askedAt: row.asked_at,
      answeredAt: row.answered_at || undefined,
    };
  }

  answerQuestion(taskId: string, answer: string): TaskQuestion | null {
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE task_questions
      SET answer = ?, answered_at = ?
      WHERE task_id = ? AND answer IS NULL
    `).run(answer, now, taskId);

    const row = this.db.prepare(`
      SELECT id, task_id, question, choices, answer, asked_at, answered_at
      FROM task_questions
      WHERE task_id = ? AND answered_at = ?
    `).get(taskId, now) as any;

    if (!row) return null;

    return {
      id: row.id,
      taskId: row.task_id,
      question: row.question,
      choices: row.choices ? JSON.parse(row.choices) : undefined,
      answer: row.answer,
      askedAt: row.asked_at,
      answeredAt: row.answered_at,
    };
  }

  getAnswer(taskId: string): TaskQuestion | null {
    const row = this.db.prepare(`
      SELECT id, task_id, question, choices, answer, asked_at, answered_at
      FROM task_questions
      WHERE task_id = ? AND answer IS NOT NULL
      ORDER BY answered_at DESC
      LIMIT 1
    `).get(taskId) as any;

    if (!row) return null;

    return {
      id: row.id,
      taskId: row.task_id,
      question: row.question,
      choices: row.choices ? JSON.parse(row.choices) : undefined,
      answer: row.answer,
      askedAt: row.asked_at,
      answeredAt: row.answered_at,
    };
  }

  // Get all tasks with pending questions (for dashboard)
  getTasksAwaitingInput(): { taskId: string; question: TaskQuestion }[] {
    const rows = this.db.prepare(`
      SELECT tq.id, tq.task_id, tq.question, tq.choices, tq.asked_at
      FROM task_questions tq
      WHERE tq.answer IS NULL
      ORDER BY tq.asked_at ASC
    `).all() as any[];

    return rows.map(row => ({
      taskId: row.task_id,
      question: {
        id: row.id,
        taskId: row.task_id,
        question: row.question,
        choices: row.choices ? JSON.parse(row.choices) : undefined,
        askedAt: row.asked_at,
      },
    }));
  }
}
```

**Step 2: Export from index**

Add to `packages/server/src/repositories/index.ts`:

```typescript
export { ProgressRepository } from './ProgressRepository.js';
```

**Step 3: Build server**

Run: `pnpm --filter @repodepot/server build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/server/src/repositories/
git commit -m "feat(server): add ProgressRepository for steps and questions"
```

---

## Task 4: Create Progress API Routes

**Files:**
- Create: `packages/server/src/routes/progress.ts`
- Modify: `packages/server/src/index.ts`

**Step 1: Create progress routes**

Create `packages/server/src/routes/progress.ts`:

```typescript
import { Router, type IRouter } from 'express';
import { getDb } from '../db/connection.js';
import { ProgressRepository, IssueRepository } from '../repositories/index.js';
import type { StepStatus } from '@repodepot/shared';

export const progressRoutes: IRouter = Router();

// POST /api/progress/:taskId/plan - Create/replace steps for a task
progressRoutes.post('/:taskId/plan', (req, res) => {
  try {
    const db = getDb();
    const progressRepo = new ProgressRepository(db);
    const issueRepo = new IssueRepository(db);

    const { taskId } = req.params;
    const { steps } = req.body as { steps: string[] };

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({ error: 'steps array is required' });
    }

    // Verify task exists
    const issue = issueRepo.findById(taskId);
    if (!issue) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const createdSteps = progressRepo.createPlan(taskId, steps);

    // Update issue agent status to in_progress if not already
    if (issue.agentStatus === 'assigned' || issue.agentStatus === 'pending') {
      issueRepo.update(taskId, { agentStatus: 'in_progress', status: 'in-progress' });
    }

    res.json({
      success: true,
      taskId,
      steps: createdSteps,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/progress/:taskId - Get all steps for a task
progressRoutes.get('/:taskId', (req, res) => {
  try {
    const db = getDb();
    const progressRepo = new ProgressRepository(db);

    const { taskId } = req.params;
    const steps = progressRepo.getSteps(taskId);
    const currentQuestion = progressRepo.getPendingQuestion(taskId);

    res.json({
      taskId,
      steps,
      currentQuestion,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// PUT /api/progress/:taskId/step/:index - Update step status
progressRoutes.put('/:taskId/step/:index', (req, res) => {
  try {
    const db = getDb();
    const progressRepo = new ProgressRepository(db);

    const { taskId, index } = req.params;
    const { status, note } = req.body as { status: StepStatus; note?: string };

    if (!status || !['pending', 'in_progress', 'done', 'failed', 'skipped'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const step = progressRepo.updateStep(taskId, parseInt(index, 10), status, note);

    if (!step) {
      return res.status(404).json({ error: 'Step not found' });
    }

    res.json({
      success: true,
      step,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/progress/:taskId/step - Add a new step
progressRoutes.post('/:taskId/step', (req, res) => {
  try {
    const db = getDb();
    const progressRepo = new ProgressRepository(db);

    const { taskId } = req.params;
    const { description, afterIndex } = req.body as { description: string; afterIndex: number };

    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }

    if (typeof afterIndex !== 'number') {
      return res.status(400).json({ error: 'afterIndex is required' });
    }

    const step = progressRepo.addStep(taskId, description, afterIndex);

    res.json({
      success: true,
      step,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/progress/:taskId/ask - Agent asks a question
progressRoutes.post('/:taskId/ask', (req, res) => {
  try {
    const db = getDb();
    const progressRepo = new ProgressRepository(db);
    const issueRepo = new IssueRepository(db);

    const { taskId } = req.params;
    const { question, choices } = req.body as { question: string; choices?: string[] };

    if (!question) {
      return res.status(400).json({ error: 'question is required' });
    }

    // Verify task exists
    const issue = issueRepo.findById(taskId);
    if (!issue) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const taskQuestion = progressRepo.askQuestion(taskId, question, choices);

    res.json({
      success: true,
      question: taskQuestion,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/progress/:taskId/answer - Agent polls for answer (supports long-poll)
progressRoutes.get('/:taskId/answer', async (req, res) => {
  try {
    const db = getDb();
    const progressRepo = new ProgressRepository(db);

    const { taskId } = req.params;
    const timeout = parseInt(req.query.timeout as string, 10) || 0;
    const pollInterval = 1000; // 1 second

    const checkAnswer = () => {
      const question = progressRepo.getAnswer(taskId);
      if (question && question.answer) {
        return question;
      }
      return null;
    };

    // Immediate check
    let answered = checkAnswer();
    if (answered) {
      return res.json({ answered: true, question: answered });
    }

    if (timeout <= 0) {
      return res.json({ answered: false });
    }

    // Long-poll
    const startTime = Date.now();
    const poll = async (): Promise<void> => {
      answered = checkAnswer();
      if (answered) {
        res.json({ answered: true, question: answered });
        return;
      }

      if (Date.now() - startTime >= timeout * 1000) {
        res.json({ answered: false, timeout: true });
        return;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
      return poll();
    };

    await poll();
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/progress/:taskId/answer - User submits answer (from dashboard)
progressRoutes.post('/:taskId/answer', (req, res) => {
  try {
    const db = getDb();
    const progressRepo = new ProgressRepository(db);

    const { taskId } = req.params;
    const { answer } = req.body as { answer: string };

    if (!answer) {
      return res.status(400).json({ error: 'answer is required' });
    }

    const question = progressRepo.answerQuestion(taskId, answer);

    if (!question) {
      return res.status(404).json({ error: 'No pending question found' });
    }

    res.json({
      success: true,
      question,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/progress/awaiting - Get all tasks awaiting input
progressRoutes.get('/awaiting/all', (req, res) => {
  try {
    const db = getDb();
    const progressRepo = new ProgressRepository(db);

    const awaiting = progressRepo.getTasksAwaitingInput();

    res.json({
      tasks: awaiting,
      count: awaiting.length,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
```

**Step 2: Register routes in server**

In `packages/server/src/index.ts`, add import and mount:

```typescript
import { progressRoutes } from './routes/progress.js';
```

And add with other route mounts:

```typescript
app.use('/api/progress', progressRoutes);
```

**Step 3: Build server**

Run: `pnpm --filter @repodepot/server build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/server/src/routes/progress.ts packages/server/src/index.ts
git commit -m "feat(server): add progress API routes"
```

---

## Task 5: Create CLI Progress Command

**Files:**
- Create: `packages/cli/src/commands/progress.ts`
- Modify: `packages/cli/src/index.ts`

**Step 1: Create progress command**

Create `packages/cli/src/commands/progress.ts`:

```typescript
import { Command } from 'commander';

const DEFAULT_API_URL = 'http://localhost:3001';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export const progressCommand = new Command('progress')
  .description('Report agent progress on tasks');

// progress plan --task <id> "Step 1" "Step 2" ...
progressCommand
  .command('plan')
  .description('Declare the steps for a task')
  .requiredOption('-t, --task <id>', 'Task ID')
  .option('--api <url>', 'API URL', DEFAULT_API_URL)
  .argument('<steps...>', 'List of step descriptions')
  .action(async (steps: string[], options) => {
    try {
      const result = await fetchJson<{ success: boolean; steps: any[] }>(
        `${options.api}/api/progress/${options.task}/plan`,
        {
          method: 'POST',
          body: JSON.stringify({ steps }),
        }
      );
      console.log(`✅ Plan created with ${result.steps.length} steps`);
      result.steps.forEach((s, i) => console.log(`  ${i}. ${s.description}`));
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      process.exit(1);
    }
  });

// progress update --task <id> --step <index> --status <status> [--note <note>]
progressCommand
  .command('update')
  .description('Update a step status')
  .requiredOption('-t, --task <id>', 'Task ID')
  .requiredOption('-s, --step <index>', 'Step index (0-based)')
  .requiredOption('--status <status>', 'Status: pending|in_progress|done|failed|skipped')
  .option('-n, --note <note>', 'Optional note')
  .option('--api <url>', 'API URL', DEFAULT_API_URL)
  .action(async (options) => {
    try {
      const body: any = { status: options.status };
      if (options.note) body.note = options.note;

      const result = await fetchJson<{ success: boolean; step: any }>(
        `${options.api}/api/progress/${options.task}/step/${options.step}`,
        {
          method: 'PUT',
          body: JSON.stringify(body),
        }
      );
      const s = result.step;
      const icon = s.status === 'done' ? '✅' : s.status === 'in_progress' ? '🔄' : s.status === 'failed' ? '❌' : '○';
      console.log(`${icon} Step ${s.index}: ${s.description} [${s.status}]`);
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      process.exit(1);
    }
  });

// progress add --task <id> --after <index> "New step description"
progressCommand
  .command('add')
  .description('Add a new step after an existing one')
  .requiredOption('-t, --task <id>', 'Task ID')
  .requiredOption('-a, --after <index>', 'Insert after this step index')
  .option('--api <url>', 'API URL', DEFAULT_API_URL)
  .argument('<description>', 'Step description')
  .action(async (description: string, options) => {
    try {
      const result = await fetchJson<{ success: boolean; step: any }>(
        `${options.api}/api/progress/${options.task}/step`,
        {
          method: 'POST',
          body: JSON.stringify({
            description,
            afterIndex: parseInt(options.after, 10),
          }),
        }
      );
      console.log(`✅ Added step ${result.step.index}: ${result.step.description}`);
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      process.exit(1);
    }
  });

// progress ask --task <id> "Question?" [--choices "A" "B" "C"]
progressCommand
  .command('ask')
  .description('Ask the user a question (pauses for answer)')
  .requiredOption('-t, --task <id>', 'Task ID')
  .option('-c, --choices <choices...>', 'Optional choices for the question')
  .option('--api <url>', 'API URL', DEFAULT_API_URL)
  .argument('<question>', 'The question to ask')
  .action(async (question: string, options) => {
    try {
      const body: any = { question };
      if (options.choices) body.choices = options.choices;

      const result = await fetchJson<{ success: boolean; question: any }>(
        `${options.api}/api/progress/${options.task}/ask`,
        {
          method: 'POST',
          body: JSON.stringify(body),
        }
      );
      console.log(`❓ Question submitted: ${result.question.question}`);
      if (result.question.choices) {
        console.log('   Choices:', result.question.choices.join(', '));
      }
      console.log('   Waiting for user response in dashboard...');
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      process.exit(1);
    }
  });

// progress wait --task <id> [--timeout <seconds>]
progressCommand
  .command('wait')
  .description('Wait for user answer to a question')
  .requiredOption('-t, --task <id>', 'Task ID')
  .option('--timeout <seconds>', 'Timeout in seconds', '3600')
  .option('--api <url>', 'API URL', DEFAULT_API_URL)
  .action(async (options) => {
    try {
      const timeout = parseInt(options.timeout, 10);
      console.log(`⏳ Waiting for answer (timeout: ${timeout}s)...`);

      const result = await fetchJson<{ answered: boolean; question?: any; timeout?: boolean }>(
        `${options.api}/api/progress/${options.task}/answer?timeout=${timeout}`
      );

      if (result.answered && result.question) {
        console.log(`✅ Answer received: ${result.question.answer}`);
        // Output JSON for programmatic use
        console.log(JSON.stringify({ answer: result.question.answer, answeredAt: result.question.answeredAt }));
      } else if (result.timeout) {
        console.log('⏰ Timeout waiting for answer');
        process.exit(1);
      } else {
        console.log('❌ No answer yet');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      process.exit(1);
    }
  });

// progress show --task <id>
progressCommand
  .command('show')
  .description('Show current progress for a task')
  .requiredOption('-t, --task <id>', 'Task ID')
  .option('--api <url>', 'API URL', DEFAULT_API_URL)
  .action(async (options) => {
    try {
      const result = await fetchJson<{ taskId: string; steps: any[]; currentQuestion?: any }>(
        `${options.api}/api/progress/${options.task}`
      );

      if (result.steps.length === 0) {
        console.log('No plan defined for this task');
        return;
      }

      console.log(`\n📋 Task: ${result.taskId}`);
      console.log('─'.repeat(40));

      for (const step of result.steps) {
        const icon = step.status === 'done' ? '✅' :
                     step.status === 'in_progress' ? '🔄' :
                     step.status === 'failed' ? '❌' :
                     step.status === 'skipped' ? '⏭️' : '○';
        console.log(`${icon} ${step.index}. ${step.description}`);
        if (step.note) console.log(`   └─ ${step.note}`);
      }

      if (result.currentQuestion) {
        console.log('\n❓ Awaiting input:');
        console.log(`   ${result.currentQuestion.question}`);
        if (result.currentQuestion.choices) {
          console.log(`   Choices: ${result.currentQuestion.choices.join(' | ')}`);
        }
      }
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      process.exit(1);
    }
  });
```

**Step 2: Register command in CLI**

In `packages/cli/src/index.ts`, add import:

```typescript
import { progressCommand } from './commands/progress.js';
```

And add command registration:

```typescript
program.addCommand(progressCommand);
```

**Step 3: Build CLI**

Run: `pnpm --filter @repodepot/cli build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/cli/src/commands/progress.ts packages/cli/src/index.ts
git commit -m "feat(cli): add progress command for agent step tracking"
```

---

## Task 6: Add Web API Client Methods

**Files:**
- Modify: `packages/web/src/services/api.ts`

**Step 1: Add progress API methods**

Add to the `api` object:

```typescript
  // Progress tracking
  getProgress: (taskId: string) =>
    request<{
      taskId: string;
      steps: Array<{
        id: string;
        taskId: string;
        index: number;
        description: string;
        status: 'pending' | 'in_progress' | 'done' | 'failed' | 'skipped';
        note?: string;
        startedAt?: string;
        completedAt?: string;
      }>;
      currentQuestion?: {
        id: string;
        taskId: string;
        question: string;
        choices?: string[];
        askedAt: string;
      };
    }>(`/api/progress/${taskId}`),

  answerQuestion: (taskId: string, answer: string) =>
    request<{
      success: boolean;
      question: {
        id: string;
        taskId: string;
        question: string;
        choices?: string[];
        answer: string;
        askedAt: string;
        answeredAt: string;
      };
    }>(`/api/progress/${taskId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ answer }),
    }),

  getTasksAwaitingInput: () =>
    request<{
      tasks: Array<{
        taskId: string;
        question: {
          id: string;
          taskId: string;
          question: string;
          choices?: string[];
          askedAt: string;
        };
      }>;
      count: number;
    }>('/api/progress/awaiting/all'),
```

**Step 2: Build web**

Run: `pnpm --filter @repodepot/web build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add packages/web/src/services/api.ts
git commit -m "feat(web): add progress API client methods"
```

---

## Task 7: Create Mission Control Dashboard Components

**Files:**
- Create: `packages/web/src/components/MissionControl.tsx`
- Create: `packages/web/src/components/ActiveTaskCard.tsx`
- Create: `packages/web/src/components/QuestionCard.tsx`

**Step 1: Create ActiveTaskCard component**

Create `packages/web/src/components/ActiveTaskCard.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Step {
  index: number;
  description: string;
  status: 'pending' | 'in_progress' | 'done' | 'failed' | 'skipped';
  note?: string;
}

interface ActiveTaskCardProps {
  issue: {
    id: string;
    title: string;
    repoId: number;
  };
  repoName: string;
}

export function ActiveTaskCard({ issue, repoName }: ActiveTaskCardProps) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const progress = await api.getProgress(issue.id);
        setSteps(progress.steps);
      } catch (error) {
        console.error('Error fetching progress:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
    const interval = setInterval(fetchProgress, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [issue.id]);

  const completedCount = steps.filter(s => s.status === 'done').length;
  const totalCount = steps.length;

  const getStepIcon = (status: Step['status']) => {
    switch (status) {
      case 'done': return '✓';
      case 'in_progress': return '●';
      case 'failed': return '✗';
      case 'skipped': return '−';
      default: return '○';
    }
  };

  const getStepColor = (status: Step['status']) => {
    switch (status) {
      case 'done': return '#22c55e';
      case 'in_progress': return '#3b82f6';
      case 'failed': return '#ef4444';
      case 'skipped': return '#9ca3af';
      default: return '#6b7280';
    }
  };

  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>{repoName}</span>
          <h4 style={{ color: '#f1f5f9', margin: '4px 0', fontSize: '14px' }}>{issue.title}</h4>
        </div>
        {totalCount > 0 && (
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>
            {completedCount}/{totalCount} steps
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ color: '#64748b', fontSize: '12px' }}>Loading progress...</div>
      ) : steps.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: '12px' }}>No plan defined yet</div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {steps.map((step) => (
            <div
              key={step.index}
              title={step.description + (step.note ? `\n${step.note}` : '')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '4px',
                background: '#334155',
                fontSize: '12px',
              }}
            >
              <span style={{
                color: getStepColor(step.status),
                animation: step.status === 'in_progress' ? 'pulse 1.5s infinite' : 'none',
              }}>
                {getStepIcon(step.status)}
              </span>
              <span style={{
                color: step.status === 'done' ? '#94a3b8' : '#e2e8f0',
                textDecoration: step.status === 'skipped' ? 'line-through' : 'none',
                maxWidth: '120px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {step.description}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Create QuestionCard component**

Create `packages/web/src/components/QuestionCard.tsx`:

```typescript
import { useState } from 'react';
import { api } from '../services/api';

interface QuestionCardProps {
  taskId: string;
  taskTitle: string;
  repoName: string;
  question: {
    id: string;
    question: string;
    choices?: string[];
    askedAt: string;
  };
  onAnswered: () => void;
}

export function QuestionCard({ taskId, taskTitle, repoName, question, onAnswered }: QuestionCardProps) {
  const [customAnswer, setCustomAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAnswer = async (answer: string) => {
    setSubmitting(true);
    try {
      await api.answerQuestion(taskId, answer);
      onAnswered();
    } catch (error) {
      console.error('Error submitting answer:', error);
      alert('Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '12px',
      borderLeft: '4px solid #f59e0b',
    }}>
      <div style={{ marginBottom: '12px' }}>
        <span style={{ color: '#94a3b8', fontSize: '12px' }}>{repoName}</span>
        <h4 style={{ color: '#f1f5f9', margin: '4px 0', fontSize: '14px' }}>{taskTitle}</h4>
      </div>

      <div style={{
        background: '#334155',
        borderRadius: '6px',
        padding: '12px',
        marginBottom: '12px',
      }}>
        <div style={{ color: '#f59e0b', fontSize: '12px', marginBottom: '4px' }}>Agent asks:</div>
        <div style={{ color: '#f1f5f9', fontSize: '14px' }}>{question.question}</div>
      </div>

      {question.choices && question.choices.length > 0 ? (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {question.choices.map((choice, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(choice)}
              disabled={submitting}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: '#3b82f6',
                color: 'white',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.5 : 1,
                fontSize: '13px',
              }}
            >
              {choice}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={customAnswer}
            onChange={(e) => setCustomAnswer(e.target.value)}
            placeholder="Type your answer..."
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #475569',
              background: '#0f172a',
              color: '#f1f5f9',
              fontSize: '13px',
            }}
          />
          <button
            onClick={() => handleAnswer(customAnswer)}
            disabled={submitting || !customAnswer.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: '#3b82f6',
              color: 'white',
              cursor: (submitting || !customAnswer.trim()) ? 'not-allowed' : 'pointer',
              opacity: (submitting || !customAnswer.trim()) ? 0.5 : 1,
              fontSize: '13px',
            }}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Create MissionControl component**

Create `packages/web/src/components/MissionControl.tsx`:

```typescript
import { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import { ActiveTaskCard } from './ActiveTaskCard';
import { QuestionCard } from './QuestionCard';
import type { Issue, Repository } from '@repodepot/shared';

interface MissionControlProps {
  issues: Issue[];
  repositories: Repository[];
  onRefresh: () => void;
}

interface AwaitingTask {
  taskId: string;
  question: {
    id: string;
    taskId: string;
    question: string;
    choices?: string[];
    askedAt: string;
  };
}

export function MissionControl({ issues, repositories, onRefresh }: MissionControlProps) {
  const [awaitingTasks, setAwaitingTasks] = useState<AwaitingTask[]>([]);

  const fetchAwaiting = useCallback(async () => {
    try {
      const result = await api.getTasksAwaitingInput();
      setAwaitingTasks(result.tasks);
    } catch (error) {
      console.error('Error fetching awaiting tasks:', error);
    }
  }, []);

  useEffect(() => {
    fetchAwaiting();
    const interval = setInterval(fetchAwaiting, 5000);
    return () => clearInterval(interval);
  }, [fetchAwaiting]);

  const getRepoName = (repoId: number) => {
    const repo = repositories.find(r => r.id === repoId);
    return repo?.fullName || `Repo ${repoId}`;
  };

  const getIssueById = (taskId: string) => {
    return issues.find(i => i.id === taskId);
  };

  // Categorize issues
  const needsAttention = awaitingTasks.map(t => ({
    ...t,
    issue: getIssueById(t.taskId),
  })).filter(t => t.issue);

  const active = issues.filter(i =>
    i.agentStatus === 'in_progress' &&
    !awaitingTasks.some(t => t.taskId === i.id)
  );

  const queued = issues.filter(i =>
    i.agentStatus === 'pending' && i.status !== 'done'
  );

  const completedToday = issues.filter(i => {
    if (i.agentStatus !== 'completed') return false;
    if (!i.agentCompletedAt) return false;
    const completed = new Date(i.agentCompletedAt);
    const today = new Date();
    return completed.toDateString() === today.toDateString();
  });

  // Group queued by repo
  const queuedByRepo = queued.reduce((acc, issue) => {
    const repoName = getRepoName(issue.repoId);
    if (!acc[repoName]) acc[repoName] = [];
    acc[repoName].push(issue);
    return acc;
  }, {} as Record<string, Issue[]>);

  const handleAnswered = () => {
    fetchAwaiting();
    onRefresh();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Needs Attention */}
      {needsAttention.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{
            color: '#f59e0b',
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span>⚠️</span> NEEDS ATTENTION ({needsAttention.length})
          </h2>
          {needsAttention.map(({ taskId, question, issue }) => (
            <QuestionCard
              key={taskId}
              taskId={taskId}
              taskTitle={issue!.title}
              repoName={getRepoName(issue!.repoId)}
              question={question}
              onAnswered={handleAnswered}
            />
          ))}
        </section>
      )}

      {/* Active */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{
          color: '#3b82f6',
          fontSize: '14px',
          fontWeight: 600,
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>🔄</span> ACTIVE ({active.length})
        </h2>
        {active.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: '13px' }}>No active tasks</div>
        ) : (
          active.map(issue => (
            <ActiveTaskCard
              key={issue.id}
              issue={issue}
              repoName={getRepoName(issue.repoId)}
            />
          ))
        )}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        {/* Queued */}
        <section>
          <h2 style={{
            color: '#94a3b8',
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span>📋</span> QUEUED ({queued.length})
          </h2>
          {Object.keys(queuedByRepo).length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '13px' }}>No queued tasks</div>
          ) : (
            Object.entries(queuedByRepo).map(([repoName, repoIssues]) => (
              <div key={repoName} style={{ marginBottom: '8px' }}>
                <span style={{ color: '#e2e8f0', fontSize: '13px' }}>
                  {repoName}: {repoIssues.length} task{repoIssues.length !== 1 ? 's' : ''}
                </span>
              </div>
            ))
          )}
        </section>

        {/* Completed Today */}
        <section>
          <h2 style={{
            color: '#22c55e',
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span>✅</span> COMPLETED TODAY ({completedToday.length})
          </h2>
          {completedToday.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '13px' }}>No completions today</div>
          ) : (
            completedToday.map(issue => (
              <div key={issue.id} style={{
                color: '#94a3b8',
                fontSize: '13px',
                marginBottom: '4px',
              }}>
                {getRepoName(issue.repoId)}: {issue.title}
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
```

**Step 4: Build web**

Run: `pnpm --filter @repodepot/web build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add packages/web/src/components/
git commit -m "feat(web): add MissionControl, ActiveTaskCard, QuestionCard components"
```

---

## Task 8: Integrate Mission Control into Dashboard

**Files:**
- Modify: `packages/web/src/pages/Dashboard.tsx`

**Step 1: Add view toggle state**

Add state near other useState declarations:

```typescript
const [viewMode, setViewMode] = useState<'kanban' | 'mission'>('mission');
```

**Step 2: Import MissionControl**

Add import at top:

```typescript
import { MissionControl } from '../components/MissionControl';
```

**Step 3: Add view toggle buttons**

Add in the header area, before the agent control buttons:

```typescript
{/* View Mode Toggle */}
<div style={{ display: 'flex', gap: '4px', marginRight: '16px' }}>
  <button
    onClick={() => setViewMode('mission')}
    style={{
      padding: '6px 12px',
      borderRadius: '4px',
      border: 'none',
      background: viewMode === 'mission' ? '#3b82f6' : '#334155',
      color: 'white',
      cursor: 'pointer',
      fontSize: '12px',
    }}
  >
    Mission Control
  </button>
  <button
    onClick={() => setViewMode('kanban')}
    style={{
      padding: '6px 12px',
      borderRadius: '4px',
      border: 'none',
      background: viewMode === 'kanban' ? '#3b82f6' : '#334155',
      color: 'white',
      cursor: 'pointer',
      fontSize: '12px',
    }}
  >
    Kanban
  </button>
</div>
```

**Step 4: Conditionally render view**

Wrap the existing Kanban board in a conditional, and add MissionControl:

```typescript
{viewMode === 'mission' ? (
  <MissionControl
    issues={issues}
    repositories={repos}
    onRefresh={fetchIssues}
  />
) : (
  // ... existing Kanban board JSX
)}
```

**Step 5: Build web**

Run: `pnpm --filter @repodepot/web build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add packages/web/src/pages/Dashboard.tsx
git commit -m "feat(web): integrate MissionControl view with toggle"
```

---

## Task 9: Update Agent Prompt to Use Progress Commands

**Files:**
- Modify: `packages/server/src/routes/agent.ts`

**Step 1: Update the prompt template in startAgent route**

Find the prompt construction in the `/start/:repoId` route and update to:

```typescript
const prompt = `You are an autonomous coding agent working on repository "${repository.fullName}".

IMPORTANT - Progress Reporting:
Before starting work on any task, declare your plan using the CLI:
  repodepot progress plan --task <taskId> "Step 1" "Step 2" "Step 3" ...

As you complete each step, update progress:
  repodepot progress update --task <taskId> --step <index> --status done

If you need clarification from the user:
  repodepot progress ask --task <taskId> "Your question" --choices "Option A" "Option B"
  # Then wait for the response:
  repodepot progress wait --task <taskId> --timeout 3600

If you discover additional steps needed:
  repodepot progress add --task <taskId> --after <index> "New step description"

Your workflow:
1. Fetch pending tasks: curl ${apiUrl}/api/agent/tasks/${repoId}
2. Claim a task: curl -X POST ${apiUrl}/api/agent/tasks/{taskId}/claim
3. Create your plan with repodepot progress plan
4. Work through each step, reporting progress
5. Ask for clarification if requirements are ambiguous
6. Commit with message referencing the GitHub issue
7. Mark complete: curl -X POST ${apiUrl}/api/agent/tasks/{taskId}/complete -H "Content-Type: application/json" -d '{"summary": "your summary"}'

Work autonomously and complete the task.`;
```

**Step 2: Update the same prompt in start-all route**

Find the duplicate prompt in `/start-all` and apply the same changes.

**Step 3: Build server**

Run: `pnpm --filter @repodepot/server build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/server/src/routes/agent.ts
git commit -m "feat(server): update agent prompt to use progress CLI commands"
```

---

## Task 10: Full Build and Manual Test

**Step 1: Build all packages**

Run: `pnpm build`
Expected: All 4 packages build successfully

**Step 2: Start server in one terminal**

Run: `cd packages/server && pnpm dev`
Expected: Server starts on port 3001

**Step 3: Start web in another terminal**

Run: `cd packages/web && pnpm dev`
Expected: Web starts on port 3000

**Step 4: Test CLI progress commands**

```bash
# Assuming you have a task ID from the database
cd packages/cli
node dist/index.js progress plan --task <task-id> "Investigate" "Implement" "Test" "Commit"
node dist/index.js progress update --task <task-id> --step 0 --status done
node dist/index.js progress show --task <task-id>
```

Expected: Commands succeed, progress is tracked

**Step 5: Verify web dashboard**

Open http://localhost:3000 and verify:
- View toggle between Mission Control and Kanban works
- Active tasks show progress steps
- No console errors

**Step 6: Final commit**

```bash
git add -A
git commit -m "chore: final build verification"
```

---

## Summary

This plan implements:
1. **Shared types** for steps and questions
2. **Database tables** for storing progress
3. **Server repository** and **API routes** for CRUD operations
4. **CLI commands** for agents to report progress
5. **Web components** for mission control dashboard
6. **Dashboard integration** with view toggle
7. **Updated agent prompt** to use progress commands

Total: 10 tasks, approximately 40 steps.
