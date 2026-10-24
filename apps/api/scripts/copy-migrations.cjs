const { cpSync } = require('node:fs');
const { join } = require('node:path');

const databasePath = 'infrastructure/database/migrations';
cpSync(
  join(__dirname, '../src', databasePath),
  join(__dirname, '../dist', databasePath),
  { recursive: true },
);
