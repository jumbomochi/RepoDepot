import { Command } from 'commander';
import { getDb } from '../db/connection.js';
import { RepositoryRepository } from '../repositories/index.js';
import chalk from 'chalk';

export const removeRepoCommand = new Command('remove')
  .description('Remove a tracked repository')
  .argument('<repo>', 'Repository full name (owner/repo) or ID')
  .option('--db <path>', 'Database file path', 'repodepot.db')
  .action((repoArg: string, options) => {
    const db = getDb(options.db);
    const repoRepository = new RepositoryRepository(db);

    try {
      let success = false;
      let repoName = '';

      // Try to parse as ID first
      const id = parseInt(repoArg);
      if (!isNaN(id)) {
        const repo = repoRepository.findById(id);
        if (repo) {
          repoName = repo.fullName;
          success = repoRepository.delete(id);
        }
      } else {
        // Treat as full name
        const repo = repoRepository.findByFullName(repoArg);
        if (repo) {
          repoName = repo.fullName;
          success = repoRepository.deleteByFullName(repoArg);
        }
      }

      if (success) {
        console.log(chalk.green(`✓ Repository ${repoName} removed successfully`));
        console.log(chalk.yellow('\nNote: Local files were not deleted. Remove them manually if needed.'));
      } else {
        console.log(chalk.red(`✗ Repository not found: ${repoArg}`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error removing repository:'), (error as Error).message);
      process.exit(1);
    }
  });
