import { Command } from 'commander';
import { getDb } from '../db/connection.js';
import { RepositoryRepository, IssueRepository } from '../repositories/index.js';
import { IssueStatus, Repository } from '@repodepot/shared';

export const statusCommand = new Command('status')
  .description('Show repository status overview')
  .option('-r, --repo <id>', 'Repository ID (shows all if not specified)')
  .option('--db <path>', 'Database file path', 'repodepot.db')
  .action((options) => {
    const db = getDb(options.db);
    const repoRepo = new RepositoryRepository(db);
    const issueRepo = new IssueRepository(db);

    const repos: Repository[] = options.repo
      ? [repoRepo.findById(parseInt(options.repo, 10))].filter((r): r is Repository => r !== null)
      : repoRepo.findAll();

    if (repos.length === 0) {
      console.log('No repositories found.');
      return;
    }

    repos.forEach((repo: Repository) => {
      const issues = issueRepo.findByRepo(repo.id);
      const statusCounts: Record<IssueStatus, number> = {
        backlog: 0,
        todo: 0,
        'in-progress': 0,
        review: 0,
        done: 0,
      };

      issues.forEach((issue: { status: IssueStatus }) => {
        statusCounts[issue.status]++;
      });

      console.log(`\n${repo.fullName}`);
      console.log('═'.repeat(80));
      console.log(`Total Issues: ${issues.length}`);
      console.log('─'.repeat(80));
      console.log(`Backlog:     ${statusCounts.backlog}`);
      console.log(`Todo:        ${statusCounts.todo}`);
      console.log(`In Progress: ${statusCounts['in-progress']}`);
      console.log(`Review:      ${statusCounts.review}`);
      console.log(`Done:        ${statusCounts.done}`);
      console.log('═'.repeat(80));
    });
  });
