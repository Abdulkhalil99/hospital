type DatabaseErrorLike = {
  address?: string;
  code?: string;
  message?: string;
  port?: number;
};

type ParsedDatabaseUrl = {
  database: string;
  host: string;
  port: string;
  user: string;
};

const LOCAL_COMPOSE_FILE = 'infrastructure/docker/docker-compose.yml';
const LOCAL_DB_URL = 'postgresql://medicore_user:medicore_pass@localhost:5433/medicore_db';

function parseDatabaseUrl(url: string | undefined): ParsedDatabaseUrl | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    return {
      user:     decodeURIComponent(parsed.username),
      host:     parsed.hostname,
      port:     parsed.port || '5432',
      database: parsed.pathname.replace(/^\/+/, ''),
    };
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown database error';
}

export function logDatabaseConnectionHelp(context: string, error: unknown): void {
  const details = (error ?? {}) as DatabaseErrorLike;
  const currentUrl = process.env.DATABASE_URL;
  const parsedUrl = parseDatabaseUrl(currentUrl);

  console.error(`\n${context}`);
  console.error(`Database error: ${getErrorMessage(error)}`);

  if (parsedUrl) {
    console.error(
      `Connection target: ${parsedUrl.user}@${parsedUrl.host}:${parsedUrl.port}/${parsedUrl.database}`,
    );
  }

  if (details.code === '28P01') {
    console.error('\nPostgreSQL rejected the username/password.');
    console.error(`This repo expects the local Docker database URL: ${LOCAL_DB_URL}`);
    console.error('The most common causes are:');
    console.error('1. Another local PostgreSQL instance is already bound to the port in DATABASE_URL.');
    console.error('2. An old Docker volume was initialized with different credentials.');
    console.error('\nReset the local database container and volume, then retry:');
    console.error(`  docker compose -f ${LOCAL_COMPOSE_FILE} down -v`);
    console.error(`  docker compose -f ${LOCAL_COMPOSE_FILE} up -d`);
    console.error('  pnpm db:migrate');
    return;
  }

  if (details.code === 'ECONNREFUSED' || details.address || /ECONNREFUSED/i.test(details.message ?? '')) {
    console.error('\nPostgreSQL is not accepting connections on the configured host/port.');
    console.error('Start the local infrastructure stack, then retry:');
    console.error(`  docker compose -f ${LOCAL_COMPOSE_FILE} up -d`);
    console.error('  pnpm db:migrate');
    return;
  }

  if (details.code === '3D000') {
    console.error('\nThe target database does not exist.');
    console.error(`The local development database should be created by ${LOCAL_COMPOSE_FILE}.`);
    console.error(`Expected URL: ${LOCAL_DB_URL}`);
  }
}
