import { Command } from 'commander';
import { getDb } from '../db/connection.js';
import { ProjectRepository, IssueRepository } from '../repositories/index.js';
import { IssueStatus } from '@repodepot/shared';

export const statusCommand = new Command('status')
  .description('Show project status overview')
  .option('-p, --project <id>', 'Project ID (shows all if not specified)')
  .option('--db <path>', 'Database file path', 'repodepot.db')
  .action((options) => {
    const db = getDb(options.db);
    const projectRepo = new ProjectRepository(db);
    const issueRepo = new IssueRepository(db);

    const projects = options.project
      ? [projectRepo.findById(options.project)].filter(Boolean)
      : projectRepo.findAll();

    if (projects.length === 0) {
      console.log('No projects found.');
      return;
    }

    projects.forEach(project => {
      if (!project) return;

      const issues = issueRepo.findByProject(project.id);
      const statusCounts: Record<IssueStatus, number> = {
        backlog: 0,
        todo: 0,
        'in-progress': 0,
        review: 0,
        done: 0,
      };

      issues.forEach(issue => {
        statusCounts[issue.status]++;
      });

      console.log(`\n${project.name}`);
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
