import { spawnSync } from 'child_process';

function run(cmd: string, args: string[]) {
  const result = spawnSync(cmd, args, { encoding: 'utf-8' });
  console.log(`> ${cmd} ${args.join(' ')}`);
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
  return result.status === 0;
}

run('git', ['add', '.']);
run('git', ['commit', '-m', 'Clean up temporary push script']);
run('git', ['push', 'origin', 'main']);
