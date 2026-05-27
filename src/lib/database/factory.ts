"use server";

import {
  DatabaseAdapter,
  DatabaseConnection,
  DatabaseConfig,
  DatabaseType,
} from "./index";
import { PostgreSQLAdapter } from "./postgresql-adapter";
import { MSSQLAdapter } from "./mssql-adapter";
import { MySQLAdapter } from "./mysql-adapter";

class DatabaseFactory {
  private static instance: DatabaseFactory;
  private adapters: Map<DatabaseType, DatabaseAdapter> = new Map();

  private constructor() {
    this.adapters.set("postgresql", new PostgreSQLAdapter());
    this.adapters.set("mssql", new MSSQLAdapter());
    this.adapters.set("mysql", new MySQLAdapter());
  }

  public static getInstance(): DatabaseFactory {
    if (!DatabaseFactory.instance) {
      DatabaseFactory.instance = new DatabaseFactory();
    }
    return DatabaseFactory.instance;
  }

  public async createConnection(
    config: DatabaseConfig
  ): Promise<DatabaseConnection> {
    const adapter = this.adapters.get(config.type);
    if (!adapter) {
      throw new Error(`Unsupported database type: ${config.type}`);
    }
    return adapter.connect(config);
  }
}

// Configuration builder
function createDatabaseConfig(): DatabaseConfig {
  const dbType = process.env.POSTGRES_HOST
    ? "postgresql"
    : process.env.MSSQL_HOST
    ? "mssql"
    : process.env.MYSQL_HOST
    ? "mysql"
    : "postgresql";

  switch (dbType) {
    case "postgresql":
      return {
        type: "postgresql",
        host: process.env.POSTGRES_HOST || "localhost",
        port: parseInt(process.env.POSTGRES_PORT || "5432"),
        database: process.env.POSTGRES_DB || "",
        username: process.env.POSTGRES_USER || "",
        password: process.env.POSTGRES_PASSWORD || "",
        ssl: process.env.POSTGRES_SSL === "true",
      };
    case "mssql":
      return {
        type: "mssql",
        host: process.env.MSSQL_HOST || "localhost",
        port: parseInt(process.env.MSSQL_PORT || "1433"),
        database: process.env.MSSQL_DB || "",
        username: process.env.MSSQL_USER || "",
        password: process.env.MSSQL_PASSWORD || "",
      };
    case "mysql":
      return {
        type: "mysql",
        host: process.env.MYSQL_HOST || "localhost",
        port: parseInt(process.env.MYSQL_PORT || "3306"),
        database: process.env.MYSQL_DB || "",
        username: process.env.MYSQL_USER || "",
        password: process.env.MYSQL_PASSWORD || "",
      };
    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }
}

// Global database connection instance
let dbConnection: DatabaseConnection | null = null;

export async function getDatabaseConnection(): Promise<DatabaseConnection> {
  if (!dbConnection) {
    const config = createDatabaseConfig();
    const factory = DatabaseFactory.getInstance();
    dbConnection = await factory.createConnection(config);
  }
  return dbConnection;
}

export async function closeDatabaseConnection(): Promise<void> {
  if (dbConnection) {
    await dbConnection.disconnect();
    dbConnection = null;
  }
}
