const mysql = require('mysql2/promise');
require('dotenv').config();

// Create database for the current flow.
const createDatabase = async () => {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: Number(process.env.DB_PORT) || 3306
    });

    const dbName = process.env.DB_NAME;

    if (!dbName) {
      throw new Error('DB_NAME is required in environment variables.');
    }

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`✅ Database \`${dbName}\` is ready.`);
  } catch (err) {
    const nestedErrors = err?.errors || err?.cause?.errors || [];
    const nestedMessages = nestedErrors.map((e) => e?.message).filter(Boolean).join('; ');
    const errorMessage = err?.message || nestedMessages || err?.code || 'Unknown MySQL connection error';
    console.error(`❌ Error creating database: ${errorMessage}`);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

createDatabase();
