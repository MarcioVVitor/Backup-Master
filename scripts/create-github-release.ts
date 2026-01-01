// Script para criar release no GitHub e tornar repositório público
// Integração: GitHub Connector

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
  
  console.log('='.repeat(60));
  console.log('  NBM - Configurar Repositório e Criar Release');
  console.log('='.repeat(60));
  console.log('');
  
  try {
    const octokit = await getGitHubClient();
    const { data: user } = await octokit.users.getAuthenticated();
    const owner = user.login;
    
    console.log(`Usuário: ${owner}`);
    console.log(`Repositório: ${repoName}`);
    console.log('');
    
    // 1. Tornar repositório público
    console.log('1. Tornando repositório público...');
    try {
      await octokit.repos.update({
        owner,
        repo: repoName,
        private: false,
        description: 'NBM - Network Backup Manager - Sistema de gerenciamento de backups para equipamentos de rede',
      });
      console.log('   Repositório agora é público!');
    } catch (e: any) {
      console.log(`   Aviso: ${e.message}`);
    }
    
    // 2. Verificar se release já existe
    console.log('2. Verificando releases existentes...');
    let releaseExists = false;
    try {
      await octokit.repos.getReleaseByTag({
        owner,
        repo: repoName,
        tag: version,
      });
      releaseExists = true;
      console.log(`   Release ${version} já existe.`);
    } catch (e: any) {
      if (e.status !== 404) throw e;
      console.log(`   Release ${version} não encontrada, criando...`);
    }
    
    // 3. Criar release se não existir
    if (!releaseExists) {
      console.log('3. Criando release...');
      
      const releaseBody = `## NBM Network Backup Manager ${version}

### Instalação Rápida (Debian 13)

\`\`\`bash
wget https://github.com/${owner}/${repoName}/releases/download/${version}/install.sh
chmod +x install.sh
sudo ./install.sh install
\`\`\`

### Funcionalidades

- Gerenciamento de equipamentos de rede (8 fabricantes)
- Backups automatizados via SSH/Telnet
- Sistema de scripts personalizados
- Atualização remota de firmware
- Terminal interativo com 10 temas
- Sistema de temas visuais (12 temas modernos)
- Administração completa com backup/restore

### Fabricantes Suportados

- Huawei
- Mikrotik
- Cisco
- Nokia
- ZTE
- Datacom
- Datacom DMOS
- Juniper

### Changelog

- Lançamento inicial do NBM
`;

      const { data: release } = await octokit.repos.createRelease({
        owner,
        repo: repoName,
        tag_name: version,
        name: `NBM ${version}`,
        body: releaseBody,
        draft: false,
        prerelease: false,
      });
      
      console.log(`   Release criada: ${release.html_url}`);
      
      // 4. Upload do install.sh como asset
      console.log('4. Fazendo upload do install.sh...');
      
      const installScript = fs.readFileSync('install/install.sh');
      
      await octokit.repos.uploadReleaseAsset({
        owner,
        repo: repoName,
        release_id: release.id,
        name: 'install.sh',
        data: installScript as any,
      });
      
      console.log('   install.sh enviado com sucesso!');
      
      // 5. Upload do README como asset
      console.log('5. Fazendo upload do README.md...');
      
      const readme = fs.readFileSync('install/README.md');
      
      await octokit.repos.uploadReleaseAsset({
        owner,
        repo: repoName,
        release_id: release.id,
        name: 'README.md',
        data: readme as any,
      });
      
      console.log('   README.md enviado com sucesso!');
      
      // 6. Upload do manual
      console.log('6. Fazendo upload do Manual de Operação...');
      
      const manual = fs.readFileSync('install/docs/MANUAL_OPERACAO.md');
      
      await octokit.repos.uploadReleaseAsset({
        owner,
        repo: repoName,
        release_id: release.id,
        name: 'MANUAL_OPERACAO.md',
        data: manual as any,
      });
      
      console.log('   MANUAL_OPERACAO.md enviado com sucesso!');
    }
    
    console.log('');
    console.log('='.repeat(60));
    console.log('  Configuração Concluída!');
    console.log('='.repeat(60));
    console.log('');
    console.log(`  Repositório: https://github.com/${owner}/${repoName}`);
    console.log(`  Releases: https://github.com/${owner}/${repoName}/releases`);
    console.log('');
    console.log('  Comando para instalar:');
    console.log(`  wget https://github.com/${owner}/${repoName}/releases/download/${version}/install.sh`);
    console.log('  chmod +x install.sh');
    console.log('  sudo ./install.sh install');
    console.log('');
    
  } catch (error: any) {
    console.error('Erro:', error.message);
    process.exit(1);
  }
}

main();
