import { Command } from 'commander';
import { getDb } from '../db/connection.js';
import { RepositoryRepository } from '../repositories/index.js';
import { GitService } from '../services/index.js';
import ora from 'ora';
import chalk from 'chalk';
import { homedir } from 'os';
import { join } from 'path';

export const addRepoCommand = new Command('add')
  .description('Add a repository to track')
  .argument('<repo>', 'Repository full name (owner/repo) or GitHub URL')
  .option('-p, --path <path>', 'Local path for the repository')
  .option('--no-clone', 'Do not clone the repository, just track it')
  .option('--db <path>', 'Database file path', 'repodepot.db')
  .action(async (repoArg: string, options) => {
    const db = getDb(options.db);
    const repoRepository = new RepositoryRepository(db);
    const spinner = ora();

    try {
      // Parse repository information
      let fullName: string;
      let cloneUrl: string;

      if (repoArg.startsWith('http')) {
        // It's a GitHub URL
        const match = repoArg.match(/github\.com[:/]([^/]+\/[^/.]+)/);
        if (!match) {
          console.error(chalk.red('Invalid GitHub URL'));
          process.exit(1);
        }
        fullName = match[1].replace('.git', '');
        cloneUrl = `https://github.com/${fullName}.git`;
      } else {
        // It's a full name (owner/repo)
        fullName = repoArg;
        cloneUrl = `https://github.com/${fullName}.git`;
      }

      const [owner, repoName] = fullName.split('/');
      if (!owner || !repoName) {
        console.error(chalk.red('Invalid repository format. Use owner/repo'));
        process.exit(1);
      }

      // Check if repository already exists
      const existing = repoRepository.findByFullName(fullName);
      if (existing) {
        console.log(chalk.yellow(`Repository ${fullName} is already tracked`));
        process.exit(0);
      }

      // Determine local path
      const localPath = options.path || join(homedir(), 'repodepot', fullName);

      // Clone repository if needed
      if (options.clone) {
        spinner.start(`Cloning ${fullName}...`);
        try {
          await GitService.clone(cloneUrl, localPath);
          spinner.succeed(chalk.green(`Cloned ${fullName} to ${localPath}`));
        } catch (error) {
          spinner.fail(chalk.red(`Failed to clone ${fullName}`));
          console.error((error as Error).message);
          process.exit(1);
        }
      }

      // Add repository to database
      const repo = repoRepository.create({
        name: repoName,
        fullName,
        localPath: options.clone ? localPath : null,
        cloneUrl,
        defaultBranch: 'main',
        groupId: null,
        lastSyncedAt: null,
      });

      // Get initial status if cloned
      if (options.clone && GitService.isGitRepository(localPath)) {
        spinner.start('Checking repository status...');
        const gitService = new GitService(localPath);
        const statusInfo = await gitService.getStatus();

        repoRepository.upsertStatus({
          repoId: repo.id,
          ...statusInfo,
        });
        spinner.succeed('Status updated');
      }

      console.log(chalk.green('\n✓ Repository added successfully'));
      console.log(`ID: ${repo.id}`);
      console.log(`Full Name: ${repo.fullName}`);
      console.log(`Clone URL: ${repo.cloneUrl}`);
      if (repo.localPath) {
        console.log(`Local Path: ${repo.localPath}`);
      }
    } catch (error) {
      spinner.fail('Failed to add repository');
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });
