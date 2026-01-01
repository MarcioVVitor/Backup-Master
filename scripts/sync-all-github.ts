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

  if (!xReplitToken) throw new Error('X_REPLIT_TOKEN not found');

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }
  ).then(res => res.json()).then((data: any) => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
  if (!connectionSettings || !accessToken) throw new Error('GitHub not connected');
  return accessToken;
}

async function getGitHubClient(): Promise<Octokit> {
  return new Octokit({ auth: await getAccessToken() });
}

async function uploadFile(octokit: Octokit, owner: string, repo: string, filePath: string, localPath: string) {
  try {
    const content = fs.readFileSync(localPath, 'utf-8');
    const { data: existingFile } = await octokit.repos.getContent({
      owner, repo, path: filePath,
    }).catch(() => ({ data: null }));

    const sha = (existingFile as any)?.sha;

    await octokit.repos.createOrUpdateFileContents({
      owner, repo, path: filePath,
      message: `Update ${filePath}`,
      content: Buffer.from(content).toString('base64'),
      sha,
    });
    console.log(`OK: ${filePath}`);
  } catch (error: any) {
    console.error(`ERRO: ${filePath} - ${error.message}`);
  }
}

function getAllFiles(dir: string, extensions: string[] = ['.ts', '.tsx', '.css', '.json', '.html']): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, extensions));
    } else if (extensions.some(ext => item.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const repoName = 'nbm';
  console.log('Sincronizando TODOS os arquivos com GitHub...');
  
  const octokit = await getGitHubClient();
  const { data: user } = await octokit.users.getAuthenticated();
  const owner = user.login;
  
  const filesToSync: { local: string; remote: string }[] = [];
  
  const rootFiles = [
    'package.json',
    'tsconfig.json', 
    'tailwind.config.ts',
    'vite.config.ts',
    'drizzle.config.ts',
    'postcss.config.js',
  ];
  
  for (const file of rootFiles) {
    if (fs.existsSync(file)) {
      filesToSync.push({ local: file, remote: file });
    }
  }
  
  const directories = [
    'client/src/components/ui',
    'client/src/components',
    'client/src/pages',
    'client/src/hooks',
    'client/src/lib',
    'client/src',
    'server',
    'shared',
    'script',
    'install',
  ];
  
  for (const dir of directories) {
    const files = getAllFiles(dir);
    for (const file of files) {
      filesToSync.push({ local: file, remote: file });
    }
  }
  
  if (fs.existsSync('client/index.html')) {
    filesToSync.push({ local: 'client/index.html', remote: 'client/index.html' });
  }
  
  const uniqueFiles = [...new Map(filesToSync.map(f => [f.local, f])).values()];
  
  console.log(`Total de arquivos para sincronizar: ${uniqueFiles.length}`);
  
  for (const file of uniqueFiles) {
    if (fs.existsSync(file.local)) {
      await uploadFile(octokit, owner, repoName, file.remote, file.local);
    }
  }
  
  console.log('Sincronizacao concluida!');
}

main().catch(console.error);
