const { Sequelize } = require('sequelize');

// Database configuration for Vercel deployment
const getDatabaseConfig = () => {
  // For Vercel Postgres or external database
  if (process.env.DATABASE_URL) {
    return {
      dialect: 'postgres',
      ssl: process.env.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: false
      } : false,
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    };
  }

  // Fallback to individual database variables
  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || 'football_booking',
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    dialect: process.env.DB_DIALECT || 'mysql',
    ssl: process.env.NODE_ENV === 'production' && process.env.DB_DIALECT === 'postgres' ? {
      require: true,
      rejectUnauthorized: false
    } : false,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  };
};

const sequelize = process.env.DATABASE_URL 
  ? new Sequelize(process.env.DATABASE_URL, getDatabaseConfig())
  : new Sequelize(getDatabaseConfig());

module.exports = sequelize;
