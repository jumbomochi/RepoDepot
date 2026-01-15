import { Command } from 'commander';
import { getDb } from '../db/connection.js';
import { IssueRepository, UserRepository } from '../repositories/index.js';
import { IssueStatus, IssuePriority } from '@repodepot/shared';

export const createIssueCommand = new Command('create-issue')
  .description('Create a new issue')
  .requiredOption('-r, --repo <id>', 'Repository ID')
  .requiredOption('-t, --title <title>', 'Issue title')
  .option('-d, --description <desc>', 'Issue description')
  .option('-s, --status <status>', 'Issue status', 'backlog')
  .option('--priority <priority>', 'Issue priority', 'medium')
  .option('-a, --assignee <username>', 'Assignee username')
  .option('-l, --labels <labels>', 'Comma-separated labels')
  .option('--db <path>', 'Database file path', 'repodepot.db')
  .action((options) => {
    const db = getDb(options.db);
    const issueRepo = new IssueRepository(db);
    const userRepo = new UserRepository(db);

    try {
      // Get default user as reporter
      const defaultUser = userRepo.findByUsername('default');
      if (!defaultUser) {
        console.error('Error: Default user not found. Run "repodepot init" first.');
        process.exit(1);
      }

      let assigneeId: string | undefined;
      if (options.assignee) {
        const assignee = userRepo.findByUsername(options.assignee);
        if (!assignee) {
          console.error(`Error: User "${options.assignee}" not found`);
          process.exit(1);
        }
        assigneeId = assignee.id;
      }

      const labels = options.labels ? options.labels.split(',').map((l: string) => l.trim()) : [];

      const issue = issueRepo.create({
        repoId: parseInt(options.repo, 10),
        title: options.title,
        description: options.description,
        status: options.status as IssueStatus,
        priority: options.priority as IssuePriority,
        assigneeId,
        reporterId: defaultUser.id,
        labels,
      });

      console.log('✓ Issue created successfully');
      console.log(`ID: ${issue.id}`);
      console.log(`Title: ${issue.title}`);
      console.log(`Status: ${issue.status}`);
      console.log(`Priority: ${issue.priority}`);
    } catch (error) {
      console.error('Error creating issue:', (error as Error).message);
      process.exit(1);
    }
  });
