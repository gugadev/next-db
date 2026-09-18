"use client";

import { useEffect, useRef, memo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X, Table } from "lucide-react";
import { useTabs } from "@/lib/TabsContext";
import { cn } from "@/lib/utils";

interface TabItemProps {
  tableName: string;
  href: string;
  isActive: boolean;
  onNavigate: (href: string) => void;
  onClose: (tableName: string, isActive: boolean) => void;
  tabRef: (el: HTMLDivElement | null) => void;
}

const TabItem = memo(function TabItem({
  tableName,
  href,
  isActive,
  onNavigate,
  onClose,
  tabRef,
}: TabItemProps) {
  const shortName = tableName.includes(".")
    ? tableName.split(".").pop()!
    : tableName;

  return (
    <div
      ref={tabRef}
      className={cn(
        "group flex items-center gap-1.5 h-9 px-3 text-sm border-r border-border shrink-0 cursor-pointer select-none transition-colors",
        isActive
          ? "bg-accent text-accent-foreground font-medium border-b-2 border-b-primary"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
      onClick={() => {
        if (!isActive) onNavigate(href);
      }}
    >
      <Table className="size-3.5 shrink-0 opacity-60" />
      <span className="max-w-[140px] truncate">{shortName}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose(tableName, isActive);
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
});

export default function TableTabs() {
  const { tabs, closeTab } = useTabs();
  const pathname = usePathname();
  const router = useRouter();
  const activeTabRef = useRef<HTMLDivElement | null>(null);

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
        return (
          <TabItem
            key={tab.tableName}
            tableName={tab.tableName}
            href={tab.href}
            isActive={isActive}
            onNavigate={router.push}
            onClose={handleClose}
            tabRef={(el) => {
              if (isActive) activeTabRef.current = el;
            }}
          />
        );
      })}
    </div>
  );
}
