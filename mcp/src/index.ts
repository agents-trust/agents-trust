#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { settingsFromEnv } from './settings.js';

try {
  const server = createServer(settingsFromEnv(process.env));
  await server.connect(new StdioServerTransport());
} catch {
  process.stderr.write('Agents Trust could not start. Check wallet and USDC limit configuration.\n');
  process.exitCode = 1;
}
