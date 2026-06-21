const DEFAULT_PORT = 3000;
const DEV_SESSION_SECRET = "dev-only-session-secret-change-me";

const parsePort = (value: string | undefined): number => {
  if (!value) {
    return DEFAULT_PORT;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return parsed;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parsePort(process.env.PORT),
  databasePath: process.env.DATABASE_PATH ?? "./data/arthouse.sqlite",
  uploadsDir: process.env.UPLOADS_DIR ?? "./uploads",
  sessionSecret: process.env.SESSION_SECRET ?? DEV_SESSION_SECRET
};

export const isProduction = env.nodeEnv === "production";

if (isProduction && env.sessionSecret === DEV_SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set in production.");
}
