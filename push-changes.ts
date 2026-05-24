import { spawnSync } from 'child_process';
import * as fs from 'fs';

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
run('git', ['commit', '-m', 'Fix: Implement robust resolveAssetUrl and production relative base paths for seamless subdirectory hosting']);

console.log("Enviando para o GitHub...");
run('git', ['push', 'origin', 'main']);

console.log("Pronto!");
