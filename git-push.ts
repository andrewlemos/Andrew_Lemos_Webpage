import { spawnSync } from 'child_process';
import * as fs from 'fs';

function run(cmd: string, args: string[]) {
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`Comando falhou: ${cmd} ${args.join(' ')}`);
  }
}

const token = process.env.GITHUB_TOKEN;
if (token) {
  const remoteUrl = `https://${token}@github.com/andrewlemos/Andrew_Lemos_Webpage.git`;
  try {
    run('git', ['config', 'user.name', 'Andrew Lemos']);
    run('git', ['config', 'user.email', 'andrewfmlemos@gmail.com']);
    try { run('git', ['remote', 'set-url', 'origin', remoteUrl]); } catch (e) {}
    
    if (fs.existsSync('git-push.ts')) { 
      // We read-delete after to keep repo clean
    }
    
    run('git', ['add', '.']);
    run('git', ['commit', '-m', "Fix: dynamically import Vite to support Vercel serverless startup and improve vercel.json routing / front-end error tracking"]);
    run('git', ['push', 'origin', 'main']);
    console.log("Sincronização com o GitHub efetuada com sucesso!");
  } catch (err: any) {
    console.error("Erro na sincronização:", err.message);
  }
} else {
  console.log("Token não configurado para push direto.");
}
