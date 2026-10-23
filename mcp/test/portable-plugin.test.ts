import { it, expect } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';

const root = resolve('../agent-plugins/agents-trust');
it('keeps the portable launcher within the plugin and write-capable tools behind Hermes approval', async () => {
  const manifest = JSON.parse(readFileSync(join(root, 'plugin.json'), 'utf8'));
  const config = JSON.parse(readFileSync(join(root, 'mcp.json'), 'utf8'));
  expect(manifest.extensions['com.nousresearch.hermes'].servers['agents-trust'].trust).toBe('untrusted');
  const entry = config.mcpServers['agents-trust'];
  expect(entry.command).toBe('node');
  expect(entry.args).toEqual(['${PLUGIN_ROOT}/launcher.mjs']);
  const server = createServer();
  const client = new Client({ name: 'hermes-plugin-check', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(a); await client.connect(b);
    const result = await client.listTools();
    for (const name of ['recommend', 'inspect']) {
      expect(result.tools.find(t => t.name === name)?.annotations?.readOnlyHint).toBe(false);
    }
    for (const name of ['receipt', 'health']) {
      expect(result.tools.find(t => t.name === name)?.annotations?.readOnlyHint).toBe(true);
    }
  } finally { await client.close(); await server.close(); }
});
it('passes stdio through the installed executable without a shell and reports an absent install safely', () => {
  const directory = mkdtempSync(join(tmpdir(), 'at-launcher-'));
  try {
    writeFileSync(join(directory, 'agents-trust-mcp'), `#!${process.execPath}\nprocess.stdin.pipe(process.stdout);\n`, { mode: 0o755 });
    const launched = spawnSync(process.execPath, [join(root, 'launcher.mjs')], {
      env: { PATH: directory }, encoding: 'utf8', input: 'stdio-smoke\n', timeout: 10000,
    });
    expect(launched.status).toBe(0);
    expect(launched.stdout).toBe('stdio-smoke\n');
    rmSync(join(directory, 'agents-trust-mcp'));
    const missing = spawnSync(process.execPath, [join(root, 'launcher.mjs')], {
      env: { PATH: directory }, encoding: 'utf8', timeout: 10000,
    });
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('Install the reviewed @agents-trust/mcp build');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
