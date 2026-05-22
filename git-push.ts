import { spawnSync } from 'child_process';

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
    
    run('git', ['add', '.']);
    run('git', ['commit', '-m', "Suporte para Vercel Serverless Express e mapeamento de rotas de API"]);
    run('git', ['push', 'origin', 'main']);
    console.log("Sincronização com o GitHub efetuada com sucesso!");
  } catch (err: any) {
    console.error("Erro na sincronização:", err.message);
  }
} else {
  console.log("Token não configurado para push direto.");
}
