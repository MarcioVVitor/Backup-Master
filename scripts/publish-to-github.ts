// Script para publicar NBM no GitHub
// Integração: GitHub Connector

import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

let connectionSettings: any;

async function getAccessToken(): Promise<string> {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then((data: any) => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function getGitHubClient(): Promise<Octokit> {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

// Arquivos a serem publicados
const filesToPublish = [
  // Arquivos principais
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
  'drizzle.config.ts',
  'tailwind.config.ts',
  'postcss.config.cjs',
  
  // Instalação
  'install/install.sh',
  'install/README.md',
  'install/LICENSE',
  'install/CHANGELOG.md',
  'install/.env.example',
  'install/.gitignore',
  'install/build-release.sh',
  'install/docs/MANUAL_OPERACAO.md',
  'install/.github/workflows/release.yml',
];

// Diretórios a serem publicados
const directoriesToPublish = [
  'client',
  'server',
  'shared',
];

function getAllFiles(dir: string, baseDir: string = ''): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(baseDir, entry.name);
    
    // Ignorar node_modules, .git, etc.
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.cache' || entry.name === 'dist') {
      continue;
    }
    
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, relativePath));
    } else {
      files.push(relativePath);
    }
  }
  
  return files;
}

async function createRepository(octokit: Octokit, repoName: string): Promise<{ owner: string; repo: string }> {
  console.log(`Criando repositório privado: ${repoName}...`);
  
  try {
    // Verificar se o repositório já existe
    const { data: user } = await octokit.users.getAuthenticated();
    
    try {
      await octokit.repos.get({ owner: user.login, repo: repoName });
      console.log(`Repositório ${repoName} já existe.`);
      return { owner: user.login, repo: repoName };
    } catch (e: any) {
      if (e.status !== 404) throw e;
    }
    
    // Criar novo repositório
    const { data: repo } = await octokit.repos.createForAuthenticatedUser({
      name: repoName,
      description: 'NBM - Network Backup Manager - Sistema de gerenciamento de backups para equipamentos de rede',
      private: true,
      auto_init: false,
    });
    
    console.log(`Repositório criado: ${repo.html_url}`);
    return { owner: user.login, repo: repoName };
  } catch (error: any) {
    console.error('Erro ao criar repositório:', error.message);
    throw error;
  }
}

async function uploadFile(octokit: Octokit, owner: string, repo: string, filePath: string, content: string, sha?: string): Promise<void> {
  const message = sha ? `Atualiza ${filePath}` : `Adiciona ${filePath}`;
  
  try {
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message,
      content: Buffer.from(content).toString('base64'),
      sha,
    });
  } catch (error: any) {
    // Se arquivo já existe, obter SHA e atualizar
    if (error.status === 422) {
      try {
        const { data } = await octokit.repos.getContent({ owner, repo, path: filePath });
        if ('sha' in data) {
          await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: filePath,
            message,
            content: Buffer.from(content).toString('base64'),
            sha: data.sha,
          });
        }
      } catch {
        console.warn(`Aviso: Não foi possível atualizar ${filePath}`);
      }
    } else {
      throw error;
    }
  }
}

async function main() {
  const repoName = 'nbm';
  
  console.log('='.repeat(60));
  console.log('  NBM - Publicação no GitHub');
  console.log('='.repeat(60));
  console.log('');
  
  try {
    const octokit = await getGitHubClient();
    
    // Criar repositório
    const { owner, repo } = await createRepository(octokit, repoName);
    
    // Coletar todos os arquivos
    const allFiles: string[] = [...filesToPublish];
    
    for (const dir of directoriesToPublish) {
      if (fs.existsSync(dir)) {
        allFiles.push(...getAllFiles(dir, dir));
      }
    }
    
    console.log(`\nEnviando ${allFiles.length} arquivos...`);
    
    let uploaded = 0;
    let errors = 0;
    
    for (const file of allFiles) {
      if (!fs.existsSync(file)) {
        continue;
      }
      
      try {
        const content = fs.readFileSync(file, 'utf-8');
        await uploadFile(octokit, owner, repo, file, content);
        uploaded++;
        process.stdout.write(`\r  Progresso: ${uploaded}/${allFiles.length} arquivos`);
      } catch (error: any) {
        errors++;
        console.error(`\n  Erro em ${file}: ${error.message}`);
      }
      
      // Rate limiting - pequena pausa entre uploads
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n');
    console.log('='.repeat(60));
    console.log('  Publicação Concluída!');
    console.log('='.repeat(60));
    console.log('');
    console.log(`  Repositório: https://github.com/${owner}/${repo}`);
    console.log(`  Arquivos enviados: ${uploaded}`);
    if (errors > 0) {
      console.log(`  Erros: ${errors}`);
    }
    console.log('');
    
  } catch (error: any) {
    console.error('Erro:', error.message);
    process.exit(1);
  }
}

main();
