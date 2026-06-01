module.exports = {
  apps: [
    {
      name: 'aurora',
      cwd: './backend',
      script: 'index.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1200M',
      env: {
        NODE_ENV: 'production',
        PORT: 7860,
        DOTENV_CONFIG_PATH: '../.env',
      },
    },
  ],
};
