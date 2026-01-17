import { Router, type IRouter, type Request, type Response } from 'express';
import { getDb } from '../db/connection.js';
import { ProgressRepository, IssueRepository } from '../repositories/index.js';
import type { StepStatus } from '@repodepot/shared';

export const progressRoutes: IRouter = Router();

// Helper to validate task exists
function validateTask(taskId: string): { valid: true; issue: any } | { valid: false; error: string } {
  const db = getDb();
  const issueRepo = new IssueRepository(db);
  const issue = issueRepo.findById(taskId);

  if (!issue) {
    return { valid: false, error: 'Task not found' };
  }
  return { valid: true, issue };
}

// POST /:taskId/plan - Create/replace steps for a task
progressRoutes.post('/:taskId/plan', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { steps } = req.body as { steps: string[] };

    // Validate task exists
    const validation = validateTask(taskId);
    if (!validation.valid) {
      return res.status(404).json({ error: validation.error });
    }

    // Validate steps array
    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({ error: 'steps must be a non-empty array of strings' });
    }

    if (!steps.every(s => typeof s === 'string' && s.trim().length > 0)) {
      return res.status(400).json({ error: 'All steps must be non-empty strings' });
    }

    const db = getDb();
    const progressRepo = new ProgressRepository(db);
    const issueRepo = new IssueRepository(db);
    const createdSteps = progressRepo.createPlan(taskId, steps);

    // Update issue status to in_progress when plan is created
    const issue = validation.issue;
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

// GET /:taskId - Get all steps for a task
progressRoutes.get('/:taskId', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    // Validate task exists
    const validation = validateTask(taskId);
    if (!validation.valid) {
      return res.status(404).json({ error: validation.error });
    }

    const db = getDb();
    const progressRepo = new ProgressRepository(db);
    const steps = progressRepo.getSteps(taskId);
    const pendingQuestion = progressRepo.getPendingQuestion(taskId);

    res.json({
      taskId,
      steps,
      currentQuestion: pendingQuestion || undefined,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// PUT /:taskId/step/:index - Update step status
progressRoutes.put('/:taskId/step/:index', (req: Request, res: Response) => {
  try {
    const { taskId, index } = req.params;
    const { status, note } = req.body as { status: StepStatus; note?: string };

    // Validate task exists
    const validation = validateTask(taskId);
    if (!validation.valid) {
      return res.status(404).json({ error: validation.error });
    }

    // Validate index
    const stepIndex = parseInt(index, 10);
    if (isNaN(stepIndex) || stepIndex < 0) {
      return res.status(400).json({ error: 'Invalid step index' });
    }

    // Validate status
    const validStatuses: StepStatus[] = ['pending', 'in_progress', 'done', 'failed', 'skipped'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const db = getDb();
    const progressRepo = new ProgressRepository(db);
    const updatedStep = progressRepo.updateStep(taskId, stepIndex, status, note);

    if (!updatedStep) {
      return res.status(404).json({ error: 'Step not found' });
    }

    res.json({
      success: true,
      step: updatedStep,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /:taskId/step - Add a new step
progressRoutes.post('/:taskId/step', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { description, afterIndex } = req.body as { description: string; afterIndex: number };

    // Validate task exists
    const validation = validateTask(taskId);
    if (!validation.valid) {
      return res.status(404).json({ error: validation.error });
    }

    // Validate description
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({ error: 'description must be a non-empty string' });
    }

    // Validate afterIndex
    if (typeof afterIndex !== 'number' || afterIndex < -1) {
      return res.status(400).json({ error: 'afterIndex must be a number >= -1' });
    }

    const db = getDb();
    const progressRepo = new ProgressRepository(db);
    const newStep = progressRepo.addStep(taskId, description.trim(), afterIndex);

    res.json({
      success: true,
      step: newStep,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /:taskId/ask - Agent asks a question
progressRoutes.post('/:taskId/ask', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { question, choices } = req.body as { question: string; choices?: string[] };

    // Validate task exists
    const validation = validateTask(taskId);
    if (!validation.valid) {
      return res.status(404).json({ error: validation.error });
    }

    // Validate question
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ error: 'question must be a non-empty string' });
    }

    // Validate choices if provided
    if (choices !== undefined) {
      if (!Array.isArray(choices) || choices.length === 0) {
        return res.status(400).json({ error: 'choices must be a non-empty array if provided' });
      }
      if (!choices.every(c => typeof c === 'string' && c.trim().length > 0)) {
        return res.status(400).json({ error: 'All choices must be non-empty strings' });
      }
    }

    const db = getDb();
    const progressRepo = new ProgressRepository(db);
    const taskQuestion = progressRepo.askQuestion(taskId, question.trim(), choices);

    res.json({
      success: true,
      question: taskQuestion,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /:taskId/answer - Agent polls for answer (supports long-poll)
progressRoutes.get('/:taskId/answer', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { timeout } = req.query;

    // Validate task exists
    const validation = validateTask(taskId);
    if (!validation.valid) {
      res.status(404).json({ error: validation.error });
      return;
    }

    const db = getDb();
    const progressRepo = new ProgressRepository(db);

    // Check if there's already an answer
    const existingAnswer = progressRepo.getAnswer(taskId);
    if (existingAnswer && existingAnswer.answer) {
      res.json({
        answered: true,
        question: existingAnswer,
      });
      return;
    }

    // Get pending question
    const pendingQuestion = progressRepo.getPendingQuestion(taskId);
    if (!pendingQuestion) {
      res.json({
        answered: false,
        message: 'No pending question for this task',
      });
      return;
    }

    // Parse timeout for long-polling (default 0 = no wait, max 30 seconds)
    const pollTimeout = Math.min(Math.max(parseInt(timeout as string, 10) || 0, 0), 30000);

    if (pollTimeout === 0) {
      // No long-polling, return immediately
      res.json({
        answered: false,
        question: pendingQuestion,
      });
      return;
    }

    // Long-polling: wait for answer
    const pollInterval = 500; // Check every 500ms
    const startTime = Date.now();

    while (true) {
      const elapsed = Date.now() - startTime;

      if (elapsed >= pollTimeout) {
        // Timeout reached, return pending state
        res.json({
          answered: false,
          question: pendingQuestion,
        });
        return;
      }

      const answer = progressRepo.getAnswer(taskId);
      if (answer && answer.answer && answer.id === pendingQuestion.id) {
        // Answer received
        res.json({
          answered: true,
          question: answer,
        });
        return;
      }

      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /:taskId/answer - User submits answer
progressRoutes.post('/:taskId/answer', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { answer } = req.body as { answer: string };

    // Validate task exists
    const validation = validateTask(taskId);
    if (!validation.valid) {
      return res.status(404).json({ error: validation.error });
    }

    // Validate answer
    if (!answer || typeof answer !== 'string' || answer.trim().length === 0) {
      return res.status(400).json({ error: 'answer must be a non-empty string' });
    }

    const db = getDb();
    const progressRepo = new ProgressRepository(db);

    // Check if there's a pending question
    const pendingQuestion = progressRepo.getPendingQuestion(taskId);
    if (!pendingQuestion) {
      return res.status(400).json({ error: 'No pending question for this task' });
    }

    const answeredQuestion = progressRepo.answerQuestion(taskId, answer.trim());

    if (!answeredQuestion) {
      return res.status(500).json({ error: 'Failed to save answer' });
    }

    res.json({
      success: true,
      question: answeredQuestion,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /awaiting/all - Get all tasks awaiting input
progressRoutes.get('/awaiting/all', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const progressRepo = new ProgressRepository(db);
    const issueRepo = new IssueRepository(db);

    const tasksAwaiting = progressRepo.getTasksAwaitingInput();

    // Enrich with task details
    const enrichedTasks = tasksAwaiting.map(item => {
      const issue = issueRepo.findById(item.taskId);
      return {
        taskId: item.taskId,
        taskTitle: issue?.title || 'Unknown Task',
        taskStatus: issue?.agentStatus || 'unknown',
        question: item.question,
      };
    });

    res.json({
      tasks: enrichedTasks,
      count: enrichedTasks.length,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
