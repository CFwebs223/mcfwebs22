/**
 * PM2 Ecosystem — MCF Client Acquisition System
 * Start everything: pm2 start marketing/ecosystem.config.js
 * Stop everything:  pm2 stop all
 * Status:           pm2 status
 * Logs:             pm2 logs
 */

module.exports = {
  apps: [

    // ── 1. WhatsApp Engine (runs daily at 8am, checks follow-ups every 30min) ─
    {
      name:         'mcf-engine',
      script:       'marketing/scripts/engine/index.js',
      cwd:          '/Users/mcfwebs/MCFwbes',
      autorestart:  true,
      watch:        false,
      max_restarts: 10,
      restart_delay: 30000,
      log_file:     'marketing/leads/engine.log',
      error_file:   'marketing/leads/engine-error.log',
      env: { NODE_ENV: 'production' },
    },

    // ── 2. Facebook Group Poster (every 30 min) ───────────────────────────────
    {
      name:         'mcf-group-poster',
      script:       'marketing/scripts/group-poster.js',
      cwd:          '/Users/mcfwebs/MCFwbes',
      autorestart:  false,    // cron handles restarts
      cron_restart: '*/30 * * * *',  // every 30 minutes
      watch:        false,
      log_file:     'marketing/leads/group-poster.log',
      error_file:   'marketing/leads/group-poster-error.log',
      env: { NODE_ENV: 'production' },
    },

    // ── 3. Auto Lead Scraper (every 6 hours) ──────────────────────────────────
    {
      name:         'mcf-scraper',
      script:       'marketing/scripts/auto-scraper.js',
      cwd:          '/Users/mcfwebs/MCFwbes',
      autorestart:  false,
      cron_restart: '0 */6 * * *',  // every 6 hours
      watch:        false,
      log_file:     'marketing/leads/auto-scraper.log',
      error_file:   'marketing/leads/auto-scraper-error.log',
      env: { NODE_ENV: 'production' },
    },

    // ── 4. Control Dashboard (always on) ──────────────────────────────────────
    {
      name:         'mcf-dashboard',
      script:       'marketing/scripts/dashboard/server.js',
      cwd:          '/Users/mcfwebs/MCFwbes',
      autorestart:  true,
      watch:        false,
      log_file:     'marketing/leads/dashboard.log',
      error_file:   'marketing/leads/dashboard-error.log',
      env: { NODE_ENV: 'production', DASH_PORT: '4000' },
    },

    // ── 5. AI Receptionist (always on) ────────────────────────────────────────
    {
      name:         'mcf-receptionist',
      script:       'marketing/scripts/receptionist/server.js',
      cwd:          '/Users/mcfwebs/MCFwbes',
      autorestart:  true,
      watch:        false,
      log_file:     'marketing/leads/receptionist.log',
      error_file:   'marketing/leads/receptionist-error.log',
      env: { NODE_ENV: 'production' },
    },

    // ── 6. Live Tunnel (instant phone access — URL logged to tunnel.log) ────────
    {
      name:         'mcf-tunnel',
      script:       'marketing/scripts/tunnel.js',
      cwd:          '/Users/mcfwebs/MCFwbes',
      autorestart:  true,
      watch:        false,
      log_file:     'marketing/leads/tunnel.log',
      error_file:   'marketing/leads/tunnel-error.log',
      env: { NODE_ENV: 'production' },
    },

    // ── 7. Keep Mac Awake (prevents sleep so everything runs 24/7) ───────────────
    {
      name:         'mcf-keep-awake',
      script:       'marketing/scripts/keep-awake.js',
      cwd:          '/Users/mcfwebs/MCFwbes',
      autorestart:  true,
      watch:        false,
      log_file:     'marketing/leads/keep-awake.log',
      error_file:   'marketing/leads/keep-awake-error.log',
      env: { NODE_ENV: 'production' },
    },

    // ── 8a. WhatsApp Status (daily 9am) ──────────────────────────────────────────
    {
      name:         'mcf-wa-status',
      script:       'marketing/scripts/wa-status-poster.js',
      cwd:          '/Users/mcfwebs/MCFwbes',
      autorestart:  false,
      cron_restart: '0 9 * * *',
      watch:        false,
      log_file:     'marketing/leads/wa-status.log',
      error_file:   'marketing/leads/wa-status-error.log',
      env: { NODE_ENV: 'production' },
    },

    // ── 8b. Instagram Poster (daily 10am — login first) ──────────────────────────
    {
      name:         'mcf-instagram',
      script:       'marketing/scripts/instagram-poster.js',
      cwd:          '/Users/mcfwebs/MCFwbes',
      autorestart:  false,
      cron_restart: '0 10 * * *',
      watch:        false,
      log_file:     'marketing/leads/instagram.log',
      error_file:   'marketing/leads/instagram-error.log',
      env: { NODE_ENV: 'production' },
    },

    // ── 8c. LinkedIn Poster (daily 11am — login first) ───────────────────────────
    {
      name:         'mcf-linkedin',
      script:       'marketing/scripts/linkedin-poster.js',
      cwd:          '/Users/mcfwebs/MCFwbes',
      autorestart:  false,
      cron_restart: '0 11 * * *',
      watch:        false,
      log_file:     'marketing/leads/linkedin.log',
      error_file:   'marketing/leads/linkedin-error.log',
      env: { NODE_ENV: 'production' },
    },

    // ── 8d. Cold Call Dialer (Mon–Fri 9am, 30 leads per run) ─────────────────────
    {
      name:         'mcf-cold-calls',
      script:       'marketing/scripts/cold-call-outreach.js',
      cwd:          '/Users/mcfwebs/MCFwbes',
      autorestart:  false,
      cron_restart: '0 9 * * 1-5',  // 9am Mon–Fri
      args:         '--send --limit 30',
      watch:        false,
      log_file:     'marketing/leads/cold-calls.log',
      error_file:   'marketing/leads/cold-calls-error.log',
      env_file: 'marketing/leads/.env',
      env: {
        NODE_ENV: 'production',
      },
    },

    // ── 9. Obsidian Sync (updates LEADAPP vault every 5 min) ─────────────────────
    {
      name:         'mcf-obsidian-sync',
      script:       'marketing/scripts/obsidian-sync.js',
      cwd:          '/Users/mcfwebs/MCFwbes',
      autorestart:  true,
      watch:        false,
      log_file:     'marketing/leads/obsidian-sync.log',
      error_file:   'marketing/leads/obsidian-sync-error.log',
      env: { NODE_ENV: 'production' },
    },

    // ── 10. MCF WAVE — Real-time voice & text communication app ──────────────────
    {
      name:         'mcf-wave',
      script:       'apps/wave/server.js',
      cwd:          '/Users/mcfwebs/MCFwbes',
      autorestart:  true,
      watch:        false,
      log_file:     'apps/wave/wave.log',
      error_file:   'apps/wave/wave-error.log',
      env: { NODE_ENV: 'production', PORT: '5500' },
    },

    // ── 11. Stats Pusher (pushes data to Render every 60s for phone monitoring) ─
    {
      name:         'mcf-pusher',
      script:       'marketing/scripts/remote/stats-pusher.js',
      cwd:          '/Users/mcfwebs/MCFwbes',
      autorestart:  true,
      watch:        false,
      log_file:     'marketing/leads/pusher.log',
      error_file:   'marketing/leads/pusher-error.log',
      env: {
        NODE_ENV:     'production',
        RELAY_URL:    'https://mcf-stats-relay.onrender.com',
        RELAY_SECRET: 'mcf2026',
      },
    },

  ],
};
