module.exports = {
  apps : [{
    name   : "ticketaps",
    script : "npm",
    args   : "start",
    cwd    : "./frontend", // If your frontend is in a separate directory
    env: {
      NODE_ENV: "production",
      PORT: 3000
    },
    env_development: {
      NODE_ENV: "development",
      PORT: 3001
    }
  }, {
    name   : "my-backend-api",
    script : "./backend/server.js",
    instances : "max", // Use all available CPU cores
    exec_mode : "cluster",
    watch     : true,
    ignore_watch : ["node_modules"],
    max_memory_restart : "200M",
    env: {
      NODE_ENV: "production",
      DB_HOST: "production_db_host"
    },
    env_development: {
      NODE_ENV: "development",
      DB_HOST: "development_db_host"
    }
  }],

  deploy : {
    production : {
      user : "ubuntu",
      host : "my-production-server.com",
      ref  : "origin/master",
      repo : "git@github.com:your-username/your-repo.git",
      path : "/var/www/my-app",
      "pre-deploy-local" : "echo 'Deploying to production...'",
      "post-deploy" : "npm install && pm2 reload ecosystem.config.js --env production",
      "pre-setup" : "ls -la"
    }
  }
};