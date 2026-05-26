"use client";

import TableDisplay from "@/components/TableDisplay";
import TableHeader from "@/components/TableHeader";
import FilterBar from "@/components/FilterBar";
import SortBar from "@/components/SortBar";
import QueryControls from "@/components/QueryControls";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useTabs } from "@/lib/TabsContext";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TablePageClientProps {
  tableName: string;
  initialData: {
    rows: Record<string, string>[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
    error?: string;
  };
  initialPrimaryKeys: string[];
  initialColumns: string[];
  initialColumnTypes: Record<string, { dataType: string; udtName: string }>;
  tableType: string | null;
  introspection: import("@/lib/types").TableIntrospection;
}

interface Filter {
  column: string;
  operator: string;
  value: string;
}

interface Sort {
  column: string;
  direction: "asc" | "desc";
}

export default function TablePageClient({
  tableName,
  initialData,
  initialPrimaryKeys,
  initialColumns,
  initialColumnTypes,
  tableType,
  introspection,
}: TablePageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openTab, updateTabHref } = useTabs();
  const basePath = `/${encodeURIComponent(tableName)}`;

  // Register tab on first open
  useEffect(() => {
    openTab(tableName, basePath);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName]);

  // Keep tab href in sync with current filters/sorts/page
  useEffect(() => {
    const qs = searchParams.toString();
    updateTabHref(tableName, qs ? `${basePath}?${qs}` : basePath);
  }, [tableName, basePath, searchParams, updateTabHref]);

  // Parse initial filters from URL
  const getInitialFilters = (): Filter[] => {
    const filters: Filter[] = [];
    searchParams.forEach((value, key) => {
      const filterMatch = key.match(/^filters\[(.+)\]$/);
      if (filterMatch) {
        const column = filterMatch[1];
        // Parse operator from value (format: "operator:actual_value")
        const [operator, ...valueParts] = value.split(":");
        const actualValue = valueParts.join(":");
        filters.push({ column, operator, value: actualValue });
      }
    });
    return filters;
  };

  // Parse initial sorts from URL
  const getInitialSorts = (): Sort[] => {
    const sorts: Sort[] = [];
    searchParams.forEach((value, key) => {
      const sortMatch = key.match(/^sort\[(.+)\]$/);
      if (sortMatch) {
        const column = sortMatch[1];
        if (value === "asc" || value === "desc") {
          sorts.push({ column, direction: value });
        }
      }
    });
    return sorts;
  };

  const [pendingFilters, setPendingFilters] = useState<Filter[]>(
    getInitialFilters()
  );
  const [pendingSorts, setPendingSorts] = useState<Sort[]>(getInitialSorts());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();

    // Add filter params with bracket notation, but only if they have a value
    pendingFilters.forEach((filter) => {
      if (filter.value.trim()) {
        params.set(
          `filters[${filter.column}]`,
          `${filter.operator}:${filter.value}`
        );
      }
    });

    // Add sort params with bracket notation
    pendingSorts.forEach((sort) => {
      params.set(`sort[${sort.column}]`, sort.direction);
    });

    // Preserve pagination params
    params.set("page", searchParams.get("page") || "1");
    params.set("pageSize", searchParams.get("pageSize") || "10");

    router.push(`/${tableName}?${params.toString()}`);
  };

  const handleClear = () => {
    setPendingFilters([]);
    setPendingSorts([]);
    router.push(`/${tableName}`);
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    router.push(`/${tableName}?${params.toString()}`);
  };

  const handlePageSizeChange = (pageSize: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("pageSize", pageSize);
    params.set("page", "1"); // Reset to first page when changing page size
    router.push(`/${tableName}?${params.toString()}`);
  };

  return (
    <div className="w-full overflow-x-hidden" data-testid="table-view">
      <TableHeader
        tableName={tableName}
        columns={initialColumns}
        columnTypes={initialColumnTypes}
        tableType={tableType}
        introspection={introspection}
      />
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4">
          <FilterBar
            columns={initialColumns}
            pendingFilters={pendingFilters}
            setPendingFilters={setPendingFilters}
          />
          <SortBar
            columns={initialColumns}
            pendingSorts={pendingSorts}
            setPendingSorts={setPendingSorts}
          />
        </div>
        <div className="px-4 pb-4">
          <QueryControls onClear={handleClear} />
        </div>
      </form>

      {/* Display error message if there's a database error */}
      {initialData.error && (
        <div className="mx-4 mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Query Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{initialData.error}</p>
                <p className="mt-2 text-xs text-red-600">
                  Try adjusting your filters. For example, make sure you&apos;re
                  using the correct data type for each column (numbers for
                  numeric columns, text for text columns).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <TableDisplay
        tableName={tableName}
        initialData={initialData.rows}
        primaryKeys={initialPrimaryKeys}
        columnTypes={initialColumnTypes}
        introspection={introspection}
      />
      <div className="flex items-center justify-between px-4 py-4 border-t">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page</span>
          <Select
            value={initialData.pageSize.toString()}
            onValueChange={handlePageSizeChange}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={initialData.pageSize} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {initialData.totalCount} total rows
          </span>
          <Pagination
            currentPage={initialData.page}
            totalPages={initialData.totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      </div>
    </div>
  );
}
