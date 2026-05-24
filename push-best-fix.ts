import { spawnSync } from 'child_process';

function run(cmd: string, args: string[]) {
  const result = spawnSync(cmd, args, { encoding: 'utf-8' });
  console.log(`> ${cmd} ${args.join(' ')}`);
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
  return result.status === 0;
}

console.log("Adicionando alterações...");
run('git', ['add', '.']);

console.log("Criando commit...");
run('git', ['commit', '-m', 'Fix: Simplify resolveAssetUrl to strictly relative paths for ultimate cross-domain and subfolder compatibility']);

console.log("Enviando para o GitHub...");
run('git', ['push', 'origin', 'main']);

console.log("Pronto!");
