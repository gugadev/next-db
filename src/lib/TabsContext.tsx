"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

interface TabEntry {
  tableName: string;
  href: string;
}

interface TabsContextValue {
  tabs: TabEntry[];
  openTab: (tableName: string, href: string) => void;
  updateTabHref: (tableName: string, href: string) => void;
  closeTab: (tableName: string) => void;
}

const STORAGE_KEY = "db-ui:open-tabs";

function loadTabs(): TabEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TabEntry[]) : [];
  } catch {
    return [];
  }
}

function saveTabs(tabs: TabEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  } catch {
    // storage full or unavailable — silently ignore
  }
}

const TabsContext = createContext<TabsContextValue | null>(null);

export function TabsProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<TabEntry[]>([]);

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    setTabs(loadTabs());
  }, []);

  // Persist every change
  useEffect(() => {
    saveTabs(tabs);
  }, [tabs]);

  const openTab = useCallback((tableName: string, href: string) => {
    setTabs((prev) => {
      if (prev.some((t) => t.tableName === tableName)) return prev;
      return [...prev, { tableName, href }];
    });
  }, []);

  const updateTabHref = useCallback((tableName: string, href: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.tableName === tableName ? { ...t, href } : t))
    );
  }, []);

  const closeTab = useCallback((tableName: string) => {
    setTabs((prev) => prev.filter((t) => t.tableName !== tableName));
  }, []);

  return (
    <TabsContext.Provider value={{ tabs, openTab, updateTabHref, closeTab }}>
      {children}
    </TabsContext.Provider>
  );
}

export function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("useTabs must be used inside TabsProvider");
  return ctx;
}
