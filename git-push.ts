import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

function run(cmd: string, args: string[]) {
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`Comando falhou: ${cmd} ${args.join(' ')}`);
  }
}

function removeDirRecursive(dirPath: string) {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach((file) => {
      const curPath = path.join(dirPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
         removeDirRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dirPath);
  }
}

const token = process.env.GITHUB_TOKEN;
if (token) {
  const remoteUrl = `https://${token}@github.com/andrewlemos/Andrew_Lemos_Webpage.git`;
  try {
    console.log("Restabelecendo repositório git para sincronização...");
    
    if (fs.existsSync('.git')) {
      removeDirRecursive('.git');
    }
    
    run('git', ['init']);
    run('git', ['config', 'user.name', 'Andrew Lemos']);
    run('git', ['config', 'user.email', 'andrewfmlemos@gmail.com']);
    
    // Rename default branch to main
    run('git', ['branch', '-m', 'main']);
    
    run('git', ['remote', 'add', 'origin', remoteUrl]);
    
    console.log("Buscando histórico remoto...");
    run('git', ['fetch', 'origin', 'main']);
    
    // Point soft reset to main
    console.log("Sincronizando referências com origin/main...");
    run('git', ['reset', '--soft', 'origin/main']);
    
    run('git', ['add', '.']);
    
    run('git', ['commit', '-m', "Fix: Allow expanding gallery images in a fullscreen high-fidelity lightbox modal with carousel navigation"]);
    
    run('git', ['push', 'origin', 'main']);
    console.log("Sincronização com o GitHub efetuada com sucesso!");
  } catch (err: any) {
    console.error("Erro na sincronização com o GitHub:", err.message);
  }
} else {
  console.log("Token do GitHub não configurado no ambiente.");
}
