// Script para atualizar release no GitHub
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

async function main() {
  const repoName = 'nbm';
  const version = 'v1.0.0';
  
  console.log('Atualizando release no GitHub...');
  
  try {
    const octokit = await getGitHubClient();
    const { data: user } = await octokit.users.getAuthenticated();
    const owner = user.login;
    
    // Obter release existente
    const { data: release } = await octokit.repos.getReleaseByTag({
      owner,
      repo: repoName,
      tag: version,
    });
    
    console.log(`Release encontrada: ${release.id}`);
    
    // Remover asset antigo do install.sh
    for (const asset of release.assets) {
      if (asset.name === 'install.sh') {
        console.log(`Removendo asset antigo: ${asset.name}`);
        await octokit.repos.deleteReleaseAsset({
          owner,
          repo: repoName,
          asset_id: asset.id,
        });
      }
    }
    
    // Upload do novo install.sh
    console.log('Enviando novo install.sh...');
    const installScript = fs.readFileSync('install/install.sh');
    
    await octokit.repos.uploadReleaseAsset({
      owner,
      repo: repoName,
      release_id: release.id,
      name: 'install.sh',
      data: installScript as any,
    });
    
    console.log('install.sh atualizado com sucesso!');
    console.log(`\nPara baixar:\nwget https://github.com/${owner}/${repoName}/releases/download/${version}/install.sh`);
    console.log('chmod +x install.sh');
    console.log('sudo ./install.sh install');
    
  } catch (error: any) {
    console.error('Erro:', error.message);
    process.exit(1);
  }
}

main();
