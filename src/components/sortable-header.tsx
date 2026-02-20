"use client";

import { useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";

export type SortDirection = "asc" | "desc" | null;
export interface SortConfig {
  column: string;
  direction: SortDirection;
}

interface SortableTableHeadProps {
  column: string;
  label: string;
  sortConfig: SortConfig;
  onSort: (column: string) => void;
  className?: string;
}

export function SortableTableHead({
  column,
  label,
  sortConfig,
  onSort,
  className,
}: SortableTableHeadProps) {
  const isActive = sortConfig.column === column;

  return (
    <TableHead
      className={`cursor-pointer select-none hover:bg-accent/50 ${className ?? ""}`}
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {isActive && sortConfig.direction === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5 text-foreground" />
        ) : isActive && sortConfig.direction === "desc" ? (
          <ArrowDown className="h-3.5 w-3.5 text-foreground" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
        )}
      </div>
    </TableHead>
  );
}

export function useSort(defaultColumn: string = "") {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    column: defaultColumn,
    direction: null,
  });

  const onSort = (column: string) => {
    setSortConfig((prev) => {
      if (prev.column !== column) return { column, direction: "asc" };
      if (prev.direction === "asc") return { column, direction: "desc" };
      if (prev.direction === "desc") return { column: "", direction: null };
      return { column, direction: "asc" };
    });
  };

  function sortData<T extends Record<string, unknown>>(data: T[]): T[] {
    if (!sortConfig.column || !sortConfig.direction) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.column];
      const bVal = b[sortConfig.column];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let cmp = 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        cmp = aVal.localeCompare(bVal);
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }

      return sortConfig.direction === "desc" ? -cmp : cmp;
    });
  }

  return { sortConfig, onSort, sortData };
}
