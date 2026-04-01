const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const axios = require("axios");
const { sequelize, Field } = require('./src/models');
const serverConfig = require('./src/config/serverConfig');
const { applyLegacySchemaFixes } = require('./src/utils/legacySchemaFix');
const { getPublicRoot, getPublicAssetPath, getUploadRoot } = require('./src/utils/storagePaths');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');
const { generalLimiter, authLimiter, searchLimiter, createLimiter } = require('./src/middleware/rateLimiter');

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const fieldRoutes = require('./src/routes/fieldRoutes');
const bookingRoutes = require('./src/routes/bookingRoutes');
const teamRoutes = require('./src/routes/teamRoutes');
const teamMemberRoutes = require('./src/routes/teamMemberRoutes');
const publicTeamRoutes = require('./src/routes/publicTeamRoutes');
const publicScheduleRoutes = require('./src/routes/publicScheduleRoutes');
const matchResultRoutes = require('./src/routes/matchResultRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const ratingRoutes = require('./src/routes/ratingRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const realtimeRoutes = require('./src/routes/realtimeRoutes');
const ownerMvpRoutes = require('./src/routes/ownerMvpRoutes');
const chatRoutes = require('./src/routes/chatRoutes');

const API_KEY = process.env.FOOTBALL_API_KEY;
const BASE_URL = "https://api.football-data.org/v4";
const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Bangkok";

// Warn if API key is missing
if (!API_KEY) {
  console.warn('Warning: FOOTBALL_API_KEY not set. League features will be disabled.');
}

const leagues = [
  { code: "PL", name: "Premier League" },
  { code: "PD", name: "La Liga" },
  { code: "SA", name: "Serie A" },
  { code: "BL1", name: "Bundesliga" },
  { code: "FL1", name: "Ligue 1" }
];

const leagueCache = {
  matches: new Map(),
  standings: new Map()
};

// Get cached value for the current flow.
const getCachedValue = (bucket, key) => {
  const entry = bucket.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    bucket.delete(key);
    return null;
  }
  return entry.value;
};

// Set cached value for the current flow.
const setCachedValue = (bucket, key, value, ttlMs) => {
  bucket.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  });
};

// Format date header for display.
const formatDateHeader = (utcDate) => {
  return new Date(utcDate).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
};

// Format match time for display.
const formatMatchTime = (utcDate) => {
  return new Date(utcDate).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });
};

// Get date parts in timezone for the current flow.
const getDatePartsInTimezone = (value, timeZone) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(new Date(value));
  const year = Number(parts.find(part => part.type === "year")?.value);
  const month = Number(parts.find(part => part.type === "month")?.value);
  const day = Number(parts.find(part => part.type === "day")?.value);
  return { year, month, day };
};

// Format date key in timezone for display.
const formatDateKeyInTimezone = (value, timeZone) => {
  const { year, month, day } = getDatePartsInTimezone(value, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

// Get today anchor in timezone for the current flow.
const getTodayAnchorInTimezone = (timeZone) => {
  const { year, month, day } = getDatePartsInTimezone(new Date(), timeZone);
  return new Date(Date.UTC(year, month - 1, day));
};

const app = express();
const PORT = serverConfig.port;
const publicRoot = getPublicRoot();
const uploadRoot = getUploadRoot();
const frontendIndexPath = path.join(publicRoot, 'index.html');

const hasFrontendBundle = () => fs.existsSync(frontendIndexPath);

const getApiOverview = () => ({
  message: 'Football Field Booking API',
  version: '2.0.0',
  environment: serverConfig.nodeEnv,
  endpoints: {
    health: 'GET /health',
    auth: {
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      profile: 'GET /api/auth/profile',
      updateProfile: 'PUT /api/auth/profile'
    },
    users: '/api/users',
    fields: '/api/fields',
    bookings: '/api/bookings',
    teams: '/api/teams',
    publicTeams: '/api/public/teams',
    teamMembers: '/api/team-members',
    matchResults: '/api/match-results',
    notifications: '/api/notifications',
    ratings: '/api/ratings',
    dashboard: {
      stats: 'GET /api/dashboard/stats',
      search: 'GET /api/dashboard/search'
    }
  }
});

const isMissingOrBrokenTableError = (error, tableName) => {
  const errno = error?.original?.errno ?? error?.parent?.errno;
  const sqlMessage =
    error?.original?.sqlMessage ||
    error?.parent?.sqlMessage ||
    error?.message ||
    '';

  return (
    errno === 1932 ||
    errno === 1146 ||
    (sqlMessage.includes("Table '") &&
      (sqlMessage.includes(`.${tableName}' doesn't exist in engine`) ||
        sqlMessage.includes(`.${tableName}' doesn't exist`)))
  );
};

const ensureFieldTableHealthy = async () => {
  const tableName = 'fields';
  const model = Field;
  try {
    await sequelize.query(`SELECT 1 FROM \`${tableName}\` LIMIT 1`);
  } catch (error) {
    if (!isMissingOrBrokenTableError(error, tableName)) {
      throw error;
    }

    const errno = error?.original?.errno ?? error?.parent?.errno;
    if (errno === 1932) {
      console.warn(`Detected corrupted '${tableName}' table (missing in InnoDB engine). Attempting repair...`);
    } else {
      console.warn(`Detected missing '${tableName}' table. Attempting repair...`);
    }

    try {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
      if (errno === 1932) {
        try {
          await sequelize.getQueryInterface().dropTable(tableName);
        } catch (dropErr) {
          if ((dropErr?.original?.errno ?? dropErr?.parent?.errno) !== 1051) {
            console.warn(`Failed to drop corrupted '${tableName}' table:`, dropErr.message);
          }
        }
      }
      await model.sync();
      console.log(`Ensured '${tableName}' table is available.`);
    } finally {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    }
  }
};

// Trust proxy for rate limiting and IP detection
app.set('trust proxy', 1);

// Security middleware
app.use(helmet(serverConfig.security.helmet));
app.use(cors(serverConfig.cors));
app.use(compression());

// Rate limiting
if (serverConfig.security.rateLimiting.enabled) {
  app.use(generalLimiter);
}

// Logging middleware
if (serverConfig.logging.enabled) {
  app.use(morgan(serverConfig.logging.format));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', (req, res, next) => {
  // Allow frontend (different origin in development) to render uploaded images.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});
app.use('/uploads', express.static(uploadRoot));
app.use(express.static(publicRoot, { index: false, redirect: false }));
const sendMissingFieldImageFallback = (req, res, next) => {
  const requestedPath = decodeURIComponent(req.path || '').replace(/^\/+/, '');
  if (!requestedPath) {
    return next();
  }

  const candidateFiles = [
    path.join(uploadRoot, 'field', requestedPath),
    path.join(uploadRoot, 'fields', requestedPath)
  ];
  const hasAnyCandidate = candidateFiles.some((absolutePath) => fs.existsSync(absolutePath));

  if (hasAnyCandidate) {
    return next();
  }

  const fallbackImage = getPublicAssetPath('hero-manu.jpg');
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.sendFile(fallbackImage);
};

app.use('/uploads/field', sendMissingFieldImageFallback);
app.use('/uploads/fields', sendMissingFieldImageFallback);

// ============= API ROUTES =============

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: serverConfig.nodeEnv,
    version: '2.0.0'
  });
});

// Ignore browser favicon requests to avoid noisy 404 logs
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// API Documentation endpoint
app.get('/api', (req, res) => {
  res.json(getApiOverview());
});

// Serve the frontend when a built SPA is available.
app.get('/', (req, res) => {
  if (hasFrontendBundle()) {
    return res.sendFile(frontendIndexPath);
  }

  return res.json(getApiOverview());
});
// Apply authentication rate limiting
app.use('/api/auth', authLimiter);

// Apply search rate limiting
app.use('/api/dashboard/search', searchLimiter);

// Apply creation rate limiting
app.use('/api', createLimiter);

// API Routes
app.use('/api/auth', authRoutes);
// Alias without /api for compatibility with clients hitting /auth/* directly.
app.use('/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/fields', fieldRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/public/teams', publicTeamRoutes);
app.use('/api/public/schedule', publicScheduleRoutes);
app.use('/api/team-members', teamMemberRoutes);
app.use('/api/match-results', matchResultRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/owner-mvp', ownerMvpRoutes);
app.use('/api/chats', chatRoutes);

// League API Routes
app.get("/api/matches", async (req, res) => {
  if (!API_KEY) {
    return res.status(503).json({ error: 'League data service is unavailable. API key not configured.' });
  }
  try {
    const { league } = req.query; // Get league filter from query params
    const cacheKey = `matches:${league || "ALL"}`;
    const cachedMatches = getCachedValue(leagueCache.matches, cacheKey);
    if (cachedMatches) {
      return res.json(cachedMatches);
    }
    const matchesByDate = {};
    
    let matchCount = 0;
    const maxMatches = 100;
    const todayAnchor = getTodayAnchorInTimezone(APP_TIMEZONE);
    const startDate = new Date(todayAnchor);
    startDate.setUTCDate(todayAnchor.getUTCDate() - 1); // yesterday
    const validDates = Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(startDate);
      date.setUTCDate(startDate.getUTCDate() + offset);
      return formatDateKeyInTimezone(date, APP_TIMEZONE);
    });
    
    // Filter leagues if specific league is requested
    const leaguesToFetch = league ? [leagues.find(l => l.code === league)] : leagues;
    
    for (const leagueData of leaguesToFetch) {
      if (!leagueData) continue; // Skip if league not found
      
      const response = await axios.get(
        `${BASE_URL}/competitions/${leagueData.code}/matches`,
        { headers: { "X-Auth-Token": API_KEY } }
      );
      const leagueMatches = response.data.matches || [];
      for (const match of leagueMatches) {
        if (matchCount >= maxMatches) break;
        const matchDate = new Date(match.utcDate);
        const dateKey = formatDateKeyInTimezone(matchDate, APP_TIMEZONE);
        if (!validDates.includes(dateKey)) continue;
        if (!matchesByDate[dateKey]) {
          matchesByDate[dateKey] = {
            date: formatDateHeader(match.utcDate),
            dateISO: dateKey,
            matches: []
          };
        }
        matchesByDate[dateKey].matches.push({
          id: match.id,
          competition: leagueData.name,
          dateTime: match.utcDate,
          time: formatMatchTime(match.utcDate),
          homeTeam: {
            name: match.homeTeam.name,
            logo: match.homeTeam.crest || null,
            score: match.score.fullTime.home !== null ? match.score.fullTime.home : null
          },
          awayTeam: {
            name: match.awayTeam.name,
            logo: match.awayTeam.crest || null,
            score: match.score.fullTime.away !== null ? match.score.fullTime.away : null
          },
          status: match.status,
          matchDay: match.matchday
        });
        matchCount++;
        if (matchCount >= maxMatches) break;
      }
      if (matchCount >= maxMatches) break;
    }
    // Sort by date and return as array
    const sortedMatches = Object.keys(matchesByDate)
      .sort()
      .map(date => matchesByDate[date]);
    setCachedValue(leagueCache.matches, cacheKey, sortedMatches, 60 * 1000);
    res.json(sortedMatches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/leagues/standings", async (req, res) => {
  if (!API_KEY) {
    return res.status(503).json({ error: 'League data service is unavailable. API key not configured.' });
  }
  try {
    const { league } = req.query;
    const selectedLeagues = league
      ? leagues.filter(item => item.code === league)
      : leagues;

    if (selectedLeagues.length === 0) {
      return res.status(400).json({ error: "Invalid league code" });
    }

    const standingsByLeague = {};
    
    for (const leagueData of selectedLeagues) {
      const cacheKey = `standings:${leagueData.code}`;
      const cachedStandings = getCachedValue(leagueCache.standings, cacheKey);
      if (cachedStandings) {
        standingsByLeague[leagueData.code] = cachedStandings;
        continue;
      }

      const response = await axios.get(
        `${BASE_URL}/competitions/${leagueData.code}/standings`,
        { headers: { "X-Auth-Token": API_KEY } }
      );
      
      const standings = response.data.standings?.[0]?.table || [];
      
      const formattedStandings = {
        league: leagueData.name,
        code: leagueData.code,
        table: standings.map(team => ({
          position: team.position,
          team: team.team.name,
          logo: team.team.crest,
          playedGames: team.playedGames,
          won: team.won,
          draw: team.draw,
          lost: team.lost,
          points: team.points,
          form: team.form || ""
        }))
      };

      standingsByLeague[leagueData.code] = formattedStandings;
      setCachedValue(leagueCache.standings, cacheKey, formattedStandings, 5 * 60 * 1000);
    }
    
    res.json(standingsByLeague);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get(/.*/, (req, res, next) => {
  const isReservedRoute =
    req.path.startsWith('/api') ||
    req.path.startsWith('/auth') ||
    req.path.startsWith('/uploads') ||
    req.path === '/health' ||
    req.path === '/favicon.ico';

  if (isReservedRoute || path.extname(req.path) || !req.accepts('html') || !hasFrontendBundle()) {
    return next();
  }

  return res.sendFile(frontendIndexPath);
});

// Error handling middleware (must be after routes)
app.use(notFound);
app.use(errorHandler);

// ============= Start Server =============
const startServer = async () => {
  try {
    // Database connection check
    await sequelize.authenticate();
    console.log('Database connected successfully.');
    
    // Environment-safe database sync
    const isDevelopment = serverConfig.nodeEnv === 'development';
    const isTest = serverConfig.nodeEnv === 'test';
    const enableAlterSync = process.env.DB_SYNC_ALTER === 'true';
    
    // Attempt to synchronize schema, but don't crash the server if sync fails.
    if (isDevelopment) {
      if (enableAlterSync) {
        console.log('Development mode: Synchronizing database schema (alter enabled)...');
      } else {
        console.log('Development mode: Safe sync (set DB_SYNC_ALTER=true to enable alter sync).');
      }
      try {
        await sequelize.sync(enableAlterSync ? { alter: true } : {});
        if (enableAlterSync) {
          console.log('Database schema synchronized successfully (alter applied).');
        } else {
          console.log('Database schema synchronized safely.');
        }
      } catch (syncErr) {
        console.warn('Schema sync failed:', syncErr.message);
        console.warn('Continuing to start server despite sync failure.');
      }
    } else if (isTest) {
      console.log('Test mode: Recreating database...');
      try {
        await sequelize.sync({ force: true });
        console.log('Test database recreated successfully.');
      } catch (syncErr) {
        console.warn('Test DB sync (force) failed:', syncErr.message);
        console.warn('Continuing to start server despite test DB sync failure.');
      }
    } else {
      console.log('Production mode: Synchronizing database safely...');
      try {
        await sequelize.sync();
        console.log('Database synchronized safely.');
      } catch (syncErr) {
        console.warn('Production DB sync failed:', syncErr.message);
        console.warn('Continuing to start server despite sync failure.');
      }
    }
    try {
      await ensureFieldTableHealthy();
    } catch (repairErr) {
      console.warn('Field table health check failed:', repairErr.message);
    }

    try {
      await applyLegacySchemaFixes(sequelize);
    } catch (schemaFixErr) {
      console.warn('Legacy schema fix failed:', schemaFixErr.message);
    }
    app.listen(PORT, () => {
      console.log(`\nServer is running on port ${PORT}`);
      console.log(`Environment: ${serverConfig.nodeEnv}`);
      console.log(`API Documentation: http://localhost:${PORT}/`);
      console.log(`Started at: ${new Date().toISOString()}`);
    });
  } catch (error) {
    const nestedErrors = error?.original?.errors || error?.errors || [];
    const nestedMessages = nestedErrors
      .map((err) => err?.message)
      .filter(Boolean)
      .join('; ');

    const errorMessage =
      error?.message ||
      error?.original?.message ||
      nestedMessages ||
      'Unknown database connection error';

    console.error('Unable to connect to the database.');
    console.error(`Error details: ${errorMessage}`);

    if (serverConfig.nodeEnv === 'development' && error?.stack) {
      console.error(error.stack);
    }

    console.error('Please check your DB_HOST/DB_PORT credentials and ensure MySQL is running.');
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  try {
    await sequelize.close();
    console.log('Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error.message);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  try {
    await sequelize.close();
    console.log('Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error.message);
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();

