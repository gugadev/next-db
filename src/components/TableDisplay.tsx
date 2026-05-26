"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import DeleteRowButton from "./DeleteRowButton";
import UpdateRowButton from "./UpdateRowButton";
import { cn } from "../lib/utils";
import { TableIntrospection } from "@/lib/types";
import CopyableCell from "./CopyableCell";

interface TableDisplayProps {
  tableName: string;
  initialData: Record<string, string | number | boolean>[];
  primaryKeys: string[];
  columnTypes: Record<string, { dataType: string; udtName: string }>;
  introspection?: TableIntrospection;
}

export default function TableDisplay({
  tableName,
  initialData,
  primaryKeys,
  columnTypes,
  introspection,
}: TableDisplayProps) {
  const columns = initialData.length > 0 ? Object.keys(initialData[0]) : [];
  const hasPrimaryKey = primaryKeys.length > 0;

  return (
    <div className="w-full overflow-x-auto border-t border-r">
      <Table>
        <TableHeader>
          <TableRow className="group">
            {hasPrimaryKey && (
              <TableHead className="sticky left-0 bg-background z-10 w-[1px] border-r group-hover:bg-muted"></TableHead>
            )}
            {columns.map((column, columnIndex) => (
              <TableHead
                key={column}
                className={cn(
                  "group-hover:bg-muted",
                  columnIndex < columns.length - 1 && "border-r"
                )}
              >
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {initialData.map((row, rowIndex) => (
            <TableRow key={rowIndex} className="group">
              {hasPrimaryKey && (
                <TableCell className="sticky left-0 bg-background group-hover:bg-muted z-10 border-r">
                  <div className="flex gap-1">
                    <UpdateRowButton
                      tableName={tableName}
                      columns={columns}
                      columnTypes={columnTypes}
                      rowData={row}
                      primaryKeys={primaryKeys}
                      introspection={introspection}
                    />
                    <DeleteRowButton
                      tableName={tableName}
                      primaryKeyValues={Object.fromEntries(
                        primaryKeys
                          .map((key) => [key, row[key]])
                          .filter(
                            ([, value]) =>
                              typeof value === "string" ||
                              typeof value === "number"
                          )
                      )}
                    />
                  </div>
                </TableCell>
              )}
              {columns.map((column, columnIndex) => (
                <TableCell
                  key={`${rowIndex}-${column}`}
                  className={cn(
                    "whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px] group-hover:bg-muted",
                    columnIndex < columns.length - 1 && "border-r"
                  )}
                >
                  <CopyableCell value={String(row[column])} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
