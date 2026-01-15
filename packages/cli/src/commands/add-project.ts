import { Command } from 'commander';
import { getDb } from '../db/connection.js';
import { ProjectRepository } from '../repositories/index.js';

export const addProjectCommand = new Command('add-project')
  .description('Add a new project')
  .requiredOption('-n, --name <name>', 'Project name')
  .requiredOption('-r, --repo <url>', 'Repository URL')
  .option('-d, --description <desc>', 'Project description')
  .option('--db <path>', 'Database file path', 'repodepot.db')
  .action((options) => {
    const db = getDb(options.db);
    const projectRepo = new ProjectRepository(db);

    try {
      const project = projectRepo.create({
        name: options.name,
        repositoryUrl: options.repo,
        description: options.description,
      });

      console.log('✓ Project created successfully');
      console.log(`ID: ${project.id}`);
      console.log(`Name: ${project.name}`);
      console.log(`Repository: ${project.repositoryUrl}`);
    } catch (error) {
      console.error('Error creating project:', (error as Error).message);
      process.exit(1);
    }
  });
