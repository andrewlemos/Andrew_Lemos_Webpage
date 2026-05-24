import { spawnSync } from 'child_process';
import * as fs from 'fs';

function run(cmd: string, args: string[]) {
  const result = spawnSync(cmd, args, { encoding: 'utf-8' });
  console.log(`> ${cmd} ${args.join(' ')}`);
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
  return result.status === 0;
}

console.log("Restoring src/App.tsx and vite.config.ts to stable commit b2f1007...");
run('git', ['checkout', 'b2f1007', '--', 'src/App.tsx', 'vite.config.ts']);

console.log("Cleaning up temporary file if any...");
if (fs.existsSync('src-App-b2f1007.tsx')) {
  fs.unlinkSync('src-App-b2f1007.tsx');
  console.log("Deleted src-App-b2f1007.tsx");
}
