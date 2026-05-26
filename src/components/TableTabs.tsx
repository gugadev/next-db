"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X, Table } from "lucide-react";
import { useTabs } from "@/lib/TabsContext";
import { cn } from "@/lib/utils";

export default function TableTabs() {
  const { tabs, closeTab } = useTabs();
  const pathname = usePathname();
  const router = useRouter();
  const activeTabRef = useRef<HTMLDivElement | null>(null);

  // Scroll active tab into view whenever pathname or tab list changes
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [pathname, tabs.length]);

  if (tabs.length === 0) return null;

  const handleClose = (tableName: string, isActive: boolean) => {
    const idx = tabs.findIndex((t) => t.tableName === tableName);
    closeTab(tableName);

    if (isActive) {
      const remaining = tabs.filter((t) => t.tableName !== tableName);
      if (remaining.length === 0) {
        router.push("/");
      } else {
        // Go to left neighbour, fall back to new last tab
        const target = remaining[idx - 1] ?? remaining[idx] ?? remaining[remaining.length - 1];
        router.push(target.href);
      }
    }
  };

  return (
    <div className="flex items-center border-b bg-background overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] px-2 shrink-0">
      {tabs.map((tab) => {
        const tabBasePath = tab.href.split("?")[0];
        const isActive =
          decodeURIComponent(pathname) === decodeURIComponent(tabBasePath);
        const shortName = tab.tableName.includes(".")
          ? tab.tableName.split(".").pop()!
          : tab.tableName;

        return (
          <div
            key={tab.tableName}
            ref={isActive ? activeTabRef : null}
            className={cn(
              "group flex items-center gap-1.5 h-9 px-3 text-sm border-r border-border shrink-0 cursor-pointer select-none transition-colors",
              isActive
                ? "bg-accent text-accent-foreground font-medium border-b-2 border-b-primary"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
            onClick={() => {
              if (!isActive) router.push(tab.href);
            }}
          >
            <Table className="size-3.5 shrink-0 opacity-60" />
            <span className="max-w-[140px] truncate">{shortName}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClose(tab.tableName, isActive);
              }}
              className={cn(
                "rounded-sm p-0.5 transition-colors",
                isActive
                  ? "opacity-60 hover:opacity-100 hover:bg-muted"
                  : "opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-muted"
              )}
              aria-label={`Close ${shortName}`}
            >
              <X className="size-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
