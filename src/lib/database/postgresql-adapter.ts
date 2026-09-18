import pg, { Pool } from "pg";
import {
  DatabaseAdapter,
  DatabaseConnection,
  DatabaseConfig,
  TableInfo,
  TableDataRow,
  QueryResult,
  TableDataResult,
  TableSchemaInfo,
} from "./index";
import { TableIntrospection, Filter, Sort } from "../types";

pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
pg.types.setTypeParser(pg.types.builtins.TIME, (value) => value);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (value) => value);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (value) => value);
pg.types.setTypeParser(pg.types.builtins.INTERVAL, (value) => value);
pg.types.setTypeParser(pg.types.builtins.TIMETZ, (value) => value);
pg.types.setTypeParser(pg.types.builtins.JSONB, (value) => value);

export class PostgreSQLConnection implements DatabaseConnection {
  private pool: Pool;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      user: config.username,
      host: config.host,
      database: config.database,
      password: config.password,
      port: config.port,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
    });
  }

  async getTables(): Promise<TableInfo[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          table_schema as schema_name,
          table_name,
          table_schema || '.' || table_name as full_table_name,
          table_type
        FROM information_schema.tables 
        WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        AND table_type IN ('BASE TABLE', 'VIEW')
        ORDER BY table_schema, table_type DESC, table_name;
      `);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getTableData(
    tableName: string,
    page: number = 1,
    pageSize: number = 50,
    filters: Filter[] = [],
    sorts: Sort[] = []
  ): Promise<TableDataResult> {
    const client = await this.pool.connect();
    try {
      const fullyQualifiedName = tableName.includes(".")
        ? tableName
        : `public.${tableName}`;

      const offset = (page - 1) * pageSize;

      // Build WHERE clause for filters
      let whereClause = "";
      const filterValues: (string | number | boolean)[] = [];
      let paramIndex = 1;

      if (filters.length > 0) {
        const filterConditions = filters.map((filter) => {
          let condition: string;
          switch (filter.operator) {
            case "=":
              condition = `"${filter.column}" = $${paramIndex}`;
              break;
            case "!=":
              condition = `"${filter.column}" != $${paramIndex}`;
              break;
            case ">":
              condition = `"${filter.column}" > $${paramIndex}`;
              break;
            case "<":
              condition = `"${filter.column}" < $${paramIndex}`;
              break;
            case ">=":
              condition = `"${filter.column}" >= $${paramIndex}`;
              break;
            case "<=":
              condition = `"${filter.column}" <= $${paramIndex}`;
              break;
            case "LIKE":
              condition = `"${filter.column}" LIKE $${paramIndex}`;
              break;
            case "NOT LIKE":
              condition = `"${filter.column}" NOT LIKE $${paramIndex}`;
              break;
            default:
              condition = `"${filter.column}" = $${paramIndex}`;
          }
          filterValues.push(filter.value);
          paramIndex++;
          return condition;
        });
        whereClause = `WHERE ${filterConditions.join(" AND ")}`;
      }

      // Build ORDER BY clause for sorts
      let orderByClause = "";
      if (sorts.length > 0) {
        const sortConditions = sorts.map((sort) => {
          return `"${sort.column}" ${sort.direction.toUpperCase()}`;
        });
        orderByClause = `ORDER BY ${sortConditions.join(", ")}`;
      }

      // Count query with filters
      const countQuery = `SELECT COUNT(*) as total FROM ${fullyQualifiedName} ${whereClause}`;
      const countResult = await client.query(countQuery, filterValues);
      const totalRows = parseInt(countResult.rows[0].total);

      // Data query with filters, sorting, and pagination
      const dataQuery = `
        SELECT * FROM ${fullyQualifiedName} 
        ${whereClause} 
        ${orderByClause} 
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      const dataParams = [...filterValues, pageSize, offset];
      const result = await client.query(dataQuery, dataParams);

      return {
        rows: this.convertRowsToStrings(result.rows),
        totalCount: totalRows,
        page,
        pageSize,
        totalPages: Math.ceil(totalRows / pageSize),
      };
    } finally {
      client.release();
    }
  }

  async insertTableRow(
    tableName: string,
    data: Record<string, string | number | boolean | Date>
  ): Promise<TableDataRow> {
    const client = await this.pool.connect();
    try {
      const fullyQualifiedName = tableName.includes(".")
        ? tableName
        : `public.${tableName}`;

      const columns = Object.keys(data);
      const values = Object.values(data).map((v) => (v === "" ? null : v));
      const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");

      const query = `
        INSERT INTO ${fullyQualifiedName} (${columns
        .map((c) => `"${c}"`)
        .join(", ")})
        VALUES (${placeholders})
        RETURNING *;
      `;

      const result = await client.query(query, values);
      return this.convertRowToStrings(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async updateTableRow(
    tableName: string,
    primaryKeyValues: Record<string, string | number>,
    data: Record<string, string | number | boolean | Date>
  ): Promise<TableDataRow> {
    const client = await this.pool.connect();
    try {
      const fullyQualifiedName = tableName.includes(".")
        ? tableName
        : `public.${tableName}`;

      const setClause = Object.entries(data)
        .map(([key], index) => `"${key}" = $${index + 1}`)
        .join(", ");

      const conditions = Object.entries(primaryKeyValues)
        .map(
          ([column], index) =>
            `"${column}" = $${Object.keys(data).length + index + 1}`
        )
        .join(" AND ");

      const query = `
        UPDATE ${fullyQualifiedName}
        SET ${setClause}
        WHERE ${conditions}
        RETURNING *
      `;

      const values = [
        ...Object.values(data).map((v) => (v === "" ? null : v)),
        ...Object.values(primaryKeyValues),
      ];
      const result = await client.query(query, values);
      return this.convertRowToStrings(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async deleteTableRow(
    tableName: string,
    primaryKeyValues: Record<string, string | number>
  ): Promise<TableDataRow> {
    const client = await this.pool.connect();
    try {
      const fullyQualifiedName = tableName.includes(".")
        ? tableName
        : `public.${tableName}`;

      const conditions = Object.entries(primaryKeyValues)
        .map(([column], index) => `"${column}" = $${index + 1}`)
        .join(" AND ");

      const query = `
        DELETE FROM ${fullyQualifiedName}
        WHERE ${conditions}
        RETURNING *;
      `;

      const result = await client.query(query, Object.values(primaryKeyValues));
      return this.convertRowToStrings(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getTableColumns(tableName: string): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      const [schema, table] = tableName.includes(".")
        ? tableName.split(".", 2)
        : ["public", tableName];

      const query = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position;
      `;

      const result = await client.query(query, [schema, table]);
      return result.rows.map((row) => row.column_name);
    } finally {
      client.release();
    }
  }

  async getTableColumnTypes(
    tableName: string
  ): Promise<Record<string, { dataType: string; udtName: string }>> {
    const client = await this.pool.connect();
    try {
      const [schema, table] = tableName.includes(".")
        ? tableName.split(".", 2)
        : ["public", tableName];

      const query = `
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position;
      `;

      const result = await client.query(query, [schema, table]);
      return result.rows.reduce((acc, row) => {
        acc[row.column_name] = {
          dataType: row.data_type,
          udtName: row.udt_name,
        };
        return acc;
      }, {} as Record<string, { dataType: string; udtName: string }>);
    } finally {
      client.release();
    }
  }

  async getTablePrimaryKeys(tableName: string): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      const fullyQualifiedName = tableName.includes(".")
        ? tableName
        : `public.${tableName}`;

      const query = `
        SELECT a.attname as column_name
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass
        AND i.indisprimary;
      `;

      const result = await client.query(query, [fullyQualifiedName]);
      return result.rows.map((row) => row.column_name);
    } finally {
      client.release();
    }
  }

  async getTableType(tableName: string): Promise<string | null> {
    const client = await this.pool.connect();
    try {
      const [schema, table] = tableName.includes(".")
        ? tableName.split(".", 2)
        : ["public", tableName];

      const query = `
        SELECT table_type
        FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = $2;
      `;

      const result = await client.query(query, [schema, table]);
      return result.rows[0]?.table_type || null;
    } finally {
      client.release();
    }
  }

  async executeQuery(sqlQuery: string): Promise<QueryResult> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(sqlQuery);
      return {
        success: true,
        rows: this.convertRowsToStrings(result.rows),
        rowCount: result.rowCount || 0,
        fields: result.fields ? result.fields.map((field) => field.name) : [],
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        rows: [],
        rowCount: 0,
        fields: [],
      };
    } finally {
      client.release();
    }
  }

  async getTableIntrospection(tableName: string): Promise<TableIntrospection> {
    const client = await this.pool.connect();
    try {
      const [schema, table] = tableName.includes(".")
        ? tableName.split(".", 2)
        : ["public", tableName];

      // Get detailed column information
      const columnsResult = await client.query(
        `
        SELECT 
          c.column_name,
          c.ordinal_position,
          c.column_default,
          c.is_nullable,
          c.data_type,
          c.udt_name,
          c.character_maximum_length,
          c.numeric_precision,
          c.numeric_scale,
          c.datetime_precision,
          c.is_identity,
          c.identity_generation,
          c.is_generated,
          c.generation_expression,
          col_description(pgc.oid, c.ordinal_position) as column_comment
        FROM information_schema.columns c
        LEFT JOIN pg_class pgc ON pgc.relname = c.table_name
        LEFT JOIN pg_namespace pgn ON pgn.oid = pgc.relnamespace AND pgn.nspname = c.table_schema
        WHERE c.table_schema = $1 AND c.table_name = $2
        ORDER BY c.ordinal_position;
      `,
        [schema, table]
      );

      // Get primary key information
      const primaryKeyResult = await client.query(
        `
        SELECT 
          kcu.column_name,
          kcu.ordinal_position
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name 
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = $1 
          AND tc.table_name = $2
        ORDER BY kcu.ordinal_position;
      `,
        [schema, table]
      );

      // Get foreign key information
      const foreignKeysResult = await client.query(
        `
        SELECT 
          kcu.column_name,
          ccu.table_schema AS foreign_table_schema,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          tc.constraint_name,
          rc.update_rule,
          rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu 
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints rc
          ON tc.constraint_name = rc.constraint_name
          AND tc.table_schema = rc.constraint_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = $1 
          AND tc.table_name = $2;
      `,
        [schema, table]
      );

      // Get indexes information
      const indexesResult = await client.query(
        `
        SELECT 
          i.relname AS index_name,
          i.relname AS index_name,
          am.amname AS index_type,
          ix.indisunique AS is_unique,
          ix.indisprimary AS is_primary,
          array_agg(a.attname ORDER BY c.ordinality) AS columns
        FROM pg_class t
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_am am ON i.relam = am.oid
        JOIN unnest(ix.indkey) WITH ORDINALITY AS c(attnum, ordinality) ON true
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.attnum
        WHERE n.nspname = $1 AND t.relname = $2
        GROUP BY i.relname, am.amname, ix.indisunique, ix.indisprimary
        ORDER BY i.relname;
      `,
        [schema, table]
      );

      return {
        columns: columnsResult.rows,
        primaryKeys: primaryKeyResult.rows,
        foreignKeys: foreignKeysResult.rows,
        indexes: indexesResult.rows,
      };
    } finally {
      client.release();
    }
  }

  async getFullDatabaseSchema(): Promise<TableSchemaInfo[]> {
    const client = await this.pool.connect();
    try {
      // Get all tables and views
      const tablesResult = await client.query(`
        SELECT 
          table_schema as schema_name,
          table_name,
          table_type
        FROM information_schema.tables 
        WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        AND table_type IN ('BASE TABLE', 'VIEW')
        ORDER BY table_schema, table_type DESC, table_name;
      `);

      const tables = tablesResult.rows;
      const schemas: TableSchemaInfo[] = [];

      // Get columns for each table
      for (const table of tables) {
        const columnsResult = await client.query(
          `
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length,
            numeric_precision,
            numeric_scale
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position;
        `,
          [table.schema_name, table.table_name]
        );

        schemas.push({
          table_name: table.table_name,
          schema_name: table.schema_name,
          table_type: table.table_type,
          columns: columnsResult.rows,
        });
      }

      return schemas;
    } finally {
      client.release();
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  private convertRowToStrings(row: Record<string, unknown>): TableDataRow {
    const result: TableDataRow = {};
    for (const [key, value] of Object.entries(row)) {
      if (value === null || value === undefined) {
        result[key] = "";
      } else if (typeof value === "boolean") {
        result[key] = value ? "true" : "false";
      } else if (value instanceof Date) {
        result[key] = value.toISOString();
      } else if (typeof value === "number") {
        result[key] = String(value);
      } else if (typeof value === "object") {
        // Handle JSON objects by serializing them to JSON strings
        result[key] = JSON.stringify(value);
      } else {
        result[key] = String(value);
      }
    }
    return result;
  }

  private convertRowsToStrings(
    rows: Record<string, unknown>[]
  ): TableDataRow[] {
    return rows.map((row) => this.convertRowToStrings(row));
  }
}

export class PostgreSQLAdapter implements DatabaseAdapter {
  async connect(config: DatabaseConfig): Promise<DatabaseConnection> {
    return new PostgreSQLConnection(config);
  }
}
