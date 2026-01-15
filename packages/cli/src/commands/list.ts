import { Command } from 'commander';
import { getDb } from '../db/connection.js';
import { RepositoryRepository, IssueRepository } from '../repositories/index.js';

export const listCommand = new Command('list')
  .description('List repositories or issues')
  .argument('[type]', 'Type to list: repos or issues', 'repos')
  .option('-r, --repo <id>', 'Filter issues by repository ID')
  .option('--db <path>', 'Database file path', 'repodepot.db')
  .action((type, options) => {
    const db = getDb(options.db);

    if (type === 'repos' || type === 'repositories') {
      const repoRepo = new RepositoryRepository(db);
      const repos = repoRepo.findAll();

      if (repos.length === 0) {
        console.log('No repositories found.');
        return;
      }

      console.log('\nRepositories:');
      console.log('─'.repeat(80));
      repos.forEach((repo: { id: number; fullName: string; cloneUrl: string; localPath: string | null }) => {
        console.log(`ID: ${repo.id}`);
        console.log(`Name: ${repo.fullName}`);
        console.log(`URL: ${repo.cloneUrl}`);
        if (repo.localPath) {
          console.log(`Local Path: ${repo.localPath}`);
        }
        console.log('─'.repeat(80));
      });
    } else if (type === 'issues') {
      const issueRepo = new IssueRepository(db);
      const filters = options.repo ? { repoId: parseInt(options.repo, 10) } : undefined;
      const issues = issueRepo.findAll(filters);

      if (issues.length === 0) {
        console.log('No issues found.');
        return;
      }

      console.log('\nIssues:');
      console.log('─'.repeat(80));
      issues.forEach(issue => {
        console.log(`ID: ${issue.id}`);
        console.log(`Title: ${issue.title}`);
        console.log(`Status: ${issue.status} | Priority: ${issue.priority}`);
        if (issue.description) {
          console.log(`Description: ${issue.description}`);
        }
        if (issue.labels.length > 0) {
          console.log(`Labels: ${issue.labels.join(', ')}`);
        }
        console.log('─'.repeat(80));
      });
    } else {
      console.error('Invalid type. Use "repos" or "issues"');
      process.exit(1);
    }
  });
