const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import server configurations
const serverConfig = require('../../server');
const simpleServerConfig = require('../../server-simple');
const mockServerConfig = require('../../mock-server');

const app = express();

// Security and middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Choose server configuration based on environment
const serverMode = process.env.SERVER_MODE || 'production';

let serverRoutes;
switch (serverMode) {
  case 'simple':
    serverRoutes = simpleServerConfig;
    break;
  case 'mock':
    serverRoutes = mockServerConfig;
    break;
  default:
    serverRoutes = serverConfig;
}

// Apply server routes
app.use('/api', serverRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    mode: serverMode,
    timestamp: new Date().toISOString()
  });
});

// Export for Vercel
module.exports = app;
