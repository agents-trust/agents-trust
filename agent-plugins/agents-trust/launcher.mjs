// The operator installs the reviewed @agents-trust/mcp binary separately.
// No shell, package download, credentials file, payment retry or startup hook.
import { spawn } from 'node:child_process';
const child = spawn('agents-trust-mcp', [], { stdio: 'inherit', shell: false });
child.on('error', () => {
  process.stderr.write('Agents Trust MCP is not available. Install the reviewed @agents-trust/mcp build on PATH first.\n');
  process.exitCode = 1;
});
child.on('exit', (code) => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
