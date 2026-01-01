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
    throw new Error('X_REPLIT_TOKEN not found');
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

async function uploadFile(octokit: Octokit, owner: string, repo: string, filePath: string, content: string, message: string) {
  try {
    const { data: existingFile } = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
    }).catch(() => ({ data: null }));

    const sha = (existingFile as any)?.sha;

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message,
      content: Buffer.from(content).toString('base64'),
      sha,
    });

    console.log(`Uploaded: ${filePath}`);
  } catch (error: any) {
    console.error(`Failed to upload ${filePath}:`, error.message);
  }
}

async function main() {
  const repoName = 'nbm';
  
  console.log('Sincronizando arquivos com GitHub...');
  
  try {
    const octokit = await getGitHubClient();
    const { data: user } = await octokit.users.getAuthenticated();
    const owner = user.login;
    
    console.log(`Repositorio: ${owner}/${repoName}`);
    
    const buildScript = fs.readFileSync('script/build.ts', 'utf-8');
    await uploadFile(octokit, owner, repoName, 'script/build.ts', buildScript, 'Add build script');
    
    console.log('Sincronizacao concluida!');
    
  } catch (error: any) {
    console.error('Erro:', error.message);
    process.exit(1);
  }
}

main();
