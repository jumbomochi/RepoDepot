import { Command } from 'commander';
import { getDb } from '../db/connection.js';
import { RepositoryRepository } from '../repositories/index.js';
import { GitService } from '../services/index.js';
import ora from 'ora';
import chalk from 'chalk';

export const syncReposCommand = new Command('sync')
  .description('Sync repository status (fetch and check for updates)')
  .argument('[repo]', 'Repository full name (owner/repo) or ID to sync. If not provided, syncs all repositories')
  .option('--db <path>', 'Database file path', 'repodepot.db')
  .action(async (repoArg: string | undefined, options) => {
    const db = getDb(options.db);
    const repoRepository = new RepositoryRepository(db);
    const spinner = ora();

    try {
      let reposToSync: Array<{ id: number; fullName: string; localPath: string | null }> = [];

      if (repoArg) {
        // Sync specific repository
        const id = parseInt(repoArg);
        let repo;

        if (!isNaN(id)) {
          repo = repoRepository.findById(id);
        } else {
          repo = repoRepository.findByFullName(repoArg);
        }

        if (!repo) {
          console.error(chalk.red(`Repository not found: ${repoArg}`));
          process.exit(1);
        }

        reposToSync = [repo];
      } else {
        // Sync all repositories
        reposToSync = repoRepository.findAll();
      }

      if (reposToSync.length === 0) {
        console.log(chalk.yellow('No repositories to sync'));
        return;
      }

      console.log(chalk.blue(`Syncing ${reposToSync.length} repository(ies)...\n`));

      let successCount = 0;
      let errorCount = 0;

      for (const repo of reposToSync) {
        spinner.start(`Syncing ${repo.fullName}...`);

        if (!repo.localPath) {
          spinner.warn(chalk.yellow(`${repo.fullName}: No local path set, skipping`));
          continue;
        }

        if (!GitService.isGitRepository(repo.localPath)) {
          spinner.warn(chalk.yellow(`${repo.fullName}: Not a git repository at ${repo.localPath}`));
          continue;
        }

        try {
          const gitService = new GitService(repo.localPath);
          const statusInfo = await gitService.getStatus();

          // Update status in database
          repoRepository.upsertStatus({
            repoId: repo.id,
            ...statusInfo,
          });

          // Update last synced time
          repoRepository.update(repo.id, {
            lastSyncedAt: new Date().toISOString(),
          });

          // Create status message
          let statusMsg = '';
          if (statusInfo.status === 'up_to_date') {
            statusMsg = chalk.green('up to date');
          } else if (statusInfo.status === 'behind') {
            statusMsg = chalk.yellow(`${statusInfo.behind} commits behind`);
          } else if (statusInfo.status === 'ahead') {
            statusMsg = chalk.cyan(`${statusInfo.ahead} commits ahead`);
          } else if (statusInfo.status === 'diverged') {
            statusMsg = chalk.magenta(`${statusInfo.ahead} ahead, ${statusInfo.behind} behind`);
          } else if (statusInfo.status === 'has_changes') {
            statusMsg = chalk.yellow('has local changes');
          } else {
            statusMsg = chalk.red(statusInfo.status);
          }

          spinner.succeed(`${repo.fullName}: ${statusMsg} [${statusInfo.currentBranch}]`);
          successCount++;
        } catch (error) {
          spinner.fail(chalk.red(`${repo.fullName}: Error - ${(error as Error).message}`));
          errorCount++;
        }
      }

      console.log(chalk.blue(`\nSync complete: ${successCount} succeeded, ${errorCount} failed`));
    } catch (error) {
      spinner.fail('Sync failed');
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });
