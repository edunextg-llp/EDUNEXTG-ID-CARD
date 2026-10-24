export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
};

export function validateRuntimeEnvironment() {
  const errors: string[] = [];

  if (!ENV.databaseUrl) {
    errors.push("DATABASE_URL is required");
  } else {
    try {
      const url = new URL(ENV.databaseUrl);
      if (url.protocol !== "mysql:") errors.push("DATABASE_URL must use the mysql:// protocol");
    } catch {
      errors.push("DATABASE_URL must be a valid MySQL connection URL");
    }
  }

  if (!ENV.cookieSecret || ENV.cookieSecret.length < 32) {
    errors.push("JWT_SECRET must contain at least 32 characters");
  }

  if (errors.length > 0) {
    throw new Error(`Invalid server configuration:\n- ${errors.join("\n- ")}`);
  }
}
