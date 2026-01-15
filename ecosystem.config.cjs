const fs = require('fs');
const path = require('path');

// Load .env file
const envPath = path.join(__dirname, '.env');
const envVars = {};

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        let value = valueParts.join('=');
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        envVars[key.trim()] = value;
      }
    }
  });
}

module.exports = {
  apps: [{
    name: 'nbm-cloud',
    script: 'dist/index.cjs',
    cwd: '/opt/nbm-cloud',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      ...envVars
    },
    error_file: '/var/log/nbm-cloud/error-0.log',
    out_file: '/var/log/nbm-cloud/out-0.log',
    log_file: '/var/log/nbm-cloud/combined-0.log',
    time: true,
    kill_timeout: 10000,
    listen_timeout: 30000,
    shutdown_with_message: true
  }]
};
