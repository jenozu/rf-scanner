// PM2 ecosystem file for RF Scanner API
module.exports = {
  apps: [{
    name: 'rf-api',
    script: './index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      DATA_DIR: '/var/www/rf-scanner/data'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M'
  }]
};

