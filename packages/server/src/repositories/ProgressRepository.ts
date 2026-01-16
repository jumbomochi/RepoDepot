import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { TaskStep, TaskQuestion, StepStatus } from '@repodepot/shared';

export class ProgressRepository {
  constructor(private db: Database.Database) {}

  private safeParseChoices(choicesJson: string | null): string[] | undefined {
    if (!choicesJson) return undefined;
    try {
      return JSON.parse(choicesJson);
    } catch {
      return undefined;
    }
  }

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
      note: row.note ?? undefined,
      startedAt: row.started_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
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
      note: row.note ?? undefined,
      startedAt: row.started_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
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
      choices: this.safeParseChoices(row.choices),
      answer: row.answer ?? undefined,
      askedAt: row.asked_at,
      answeredAt: row.answered_at ?? undefined,
    };
  }

  answerQuestion(taskId: string, answer: string): TaskQuestion | null {
    const now = new Date().toISOString();

    const pending = this.getPendingQuestion(taskId);
    if (!pending) return null;

    this.db.prepare(`
      UPDATE task_questions
      SET answer = ?, answered_at = ?
      WHERE id = ?
    `).run(answer, now, pending.id);

    return { ...pending, answer, answeredAt: now };
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
      choices: this.safeParseChoices(row.choices),
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
        choices: this.safeParseChoices(row.choices),
        askedAt: row.asked_at,
      },
    }));
  }
}
