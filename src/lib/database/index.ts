export type DatabaseType = "postgresql" | "mssql" | "mysql";

export interface DatabaseConfig {
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

export interface TableInfo {
  table_name: string;
  schema_name: string;
  full_table_name: string;
  table_type: string;
}

export interface TableDataRow {
  [key: string]: string;
}

// Alias for backward compatibility
export type TableRow = TableDataRow;

export interface QueryResult {
  success: boolean;
  rows: TableDataRow[];
  rowCount: number;
  fields: string[];
  error?: string;
}

export interface TableDataResult {
  rows: TableDataRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error?: string;
}

export interface TableSchemaInfo {
  table_name: string;
  schema_name: string;
  table_type: string;
  columns: {
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
    character_maximum_length: number | null;
    numeric_precision: number | null;
    numeric_scale: number | null;
  }[];
}

// Import existing types to match the application
import { TableIntrospection, Filter, Sort } from "../types";

export interface DatabaseConnection {
  getTables(): Promise<TableInfo[]>;
  getTableData(
    tableName: string,
    page: number,
    pageSize: number,
    filters?: Filter[],
    sorts?: Sort[]
  ): Promise<TableDataResult>;
  insertTableRow(
    tableName: string,
    data: Record<string, string | number | boolean | Date>
  ): Promise<TableDataRow>;
  updateTableRow(
    tableName: string,
    primaryKeyValues: Record<string, string | number>,
    data: Record<string, string | number | boolean | Date>
  ): Promise<TableDataRow>;
  deleteTableRow(
    tableName: string,
    primaryKeyValues: Record<string, string | number>
  ): Promise<TableDataRow>;
  getTableColumns(tableName: string): Promise<string[]>;
  getTableColumnTypes(
    tableName: string
  ): Promise<Record<string, { dataType: string; udtName: string }>>;
  getTablePrimaryKeys(tableName: string): Promise<string[]>;
  getTableType(tableName: string): Promise<string | null>;
  executeQuery(query: string): Promise<QueryResult>;
  getTableIntrospection(tableName: string): Promise<TableIntrospection>;
  getFullDatabaseSchema(): Promise<TableSchemaInfo[]>;
  disconnect(): Promise<void>;
}

export interface DatabaseAdapter {
  connect(config: DatabaseConfig): Promise<DatabaseConnection>;
}
