import { Command } from 'commander';
import { getDb } from '../db/connection.js';
import { ProjectRepository, IssueRepository } from '../repositories/index.js';

export const listCommand = new Command('list')
  .description('List projects or issues')
  .argument('[type]', 'Type to list: projects or issues', 'projects')
  .option('-p, --project <id>', 'Filter issues by project ID')
  .option('--db <path>', 'Database file path', 'repodepot.db')
  .action((type, options) => {
    const db = getDb(options.db);

    if (type === 'projects') {
      const projectRepo = new ProjectRepository(db);
      const projects = projectRepo.findAll();

      if (projects.length === 0) {
        console.log('No projects found.');
        return;
      }

      console.log('\nProjects:');
      console.log('─'.repeat(80));
      projects.forEach(project => {
        console.log(`ID: ${project.id}`);
        console.log(`Name: ${project.name}`);
        console.log(`Repository: ${project.repositoryUrl}`);
        if (project.description) {
          console.log(`Description: ${project.description}`);
        }
        console.log('─'.repeat(80));
      });
    } else if (type === 'issues') {
      const issueRepo = new IssueRepository(db);
      const filters = options.project ? { projectId: options.project } : undefined;
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
      console.error('Invalid type. Use "projects" or "issues"');
      process.exit(1);
    }
  });
