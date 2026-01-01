import { Octokit } from '@octokit/rest';
import * as fs from 'fs';

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

async function main() {
  const repoName = 'nbm';
  console.log('Sincronizando arquivos com GitHub...');
  
  const octokit = await getGitHubClient();
  const { data: user } = await octokit.users.getAuthenticated();
  const owner = user.login;
  
  const filesToSync = [
    { local: 'server/standalone-auth.ts', remote: 'server/standalone-auth.ts' },
    { local: 'server/routes.ts', remote: 'server/routes.ts' },
    { local: 'server/static.ts', remote: 'server/static.ts' },
    { local: 'server/index.ts', remote: 'server/index.ts' },
    { local: 'shared/models/auth.ts', remote: 'shared/models/auth.ts' },
    { local: 'shared/schema.ts', remote: 'shared/schema.ts' },
    { local: 'script/build.ts', remote: 'script/build.ts' },
    { local: 'client/src/pages/login.tsx', remote: 'client/src/pages/login.tsx' },
    { local: 'client/src/App.tsx', remote: 'client/src/App.tsx' },
    { local: 'client/src/hooks/use-auth.ts', remote: 'client/src/hooks/use-auth.ts' },
    { local: 'client/src/index.css', remote: 'client/src/index.css' },
    { local: 'client/src/main.tsx', remote: 'client/src/main.tsx' },
    { local: 'client/index.html', remote: 'client/index.html' },
    { local: 'tailwind.config.ts', remote: 'tailwind.config.ts' },
    { local: 'vite.config.ts', remote: 'vite.config.ts' },
    { local: 'package.json', remote: 'package.json' },
    { local: 'tsconfig.json', remote: 'tsconfig.json' },
  ];
  
  for (const file of filesToSync) {
    if (fs.existsSync(file.local)) {
      await uploadFile(octokit, owner, repoName, file.remote, file.local);
    }
  }
  
  console.log('Sincronizacao concluida!');
}

main().catch(console.error);
