#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { createIssueCommand } from './commands/create-issue.js';
import { listCommand } from './commands/list.js';
import { statusCommand } from './commands/status.js';
import { addRepoCommand } from './commands/add-repo.js';
import { removeRepoCommand } from './commands/remove-repo.js';
import { syncReposCommand } from './commands/sync-repos.js';
import { agentCommand } from './commands/agent.js';

const program = new Command();

program
  .name('repodepot')
  .description('GitHub repo manager with Kanban-style visualization')
  .version('0.1.0');

// Register commands
program.addCommand(initCommand);
program.addCommand(createIssueCommand);
program.addCommand(listCommand);
program.addCommand(statusCommand);

// Repository commands
program.addCommand(addRepoCommand);
program.addCommand(removeRepoCommand);
program.addCommand(syncReposCommand);

// Agent command
program.addCommand(agentCommand);

program.parse();
