import { Pool } from 'pg';
import { testDatabaseState } from './test-database';

export default async function globalTeardown() {
  // Only a database successfully created by this run can be removed here.
  const database = testDatabaseState.__medicoreTestDatabase;
  if (!database) return;

  const admin = new Pool({ connectionString: database.adminUrl });
  try {
    await admin.query(`DROP DATABASE "${database.databaseName}" WITH (FORCE)`);
    delete testDatabaseState.__medicoreTestDatabase;
    console.log('✅ Isolated test database dropped');
  } finally {
    await admin.end();
  }
}
