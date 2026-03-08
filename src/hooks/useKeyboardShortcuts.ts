import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

export interface Shortcut {
  id: string;
  key: string; // e.g. "1", "2", etc.
  label: string;
  action: "navigate" | "open_dialog";
  target: string; // path for navigate, dialog id for open_dialog
}

const DEFAULT_SHORTCUTS: Shortcut[] = [
  { id: "s1", key: "1", label: "Dashboard", action: "navigate", target: "/" },
  { id: "s2", key: "2", label: "Orders", action: "navigate", target: "/orders" },
  { id: "s3", key: "3", label: "Stock", action: "navigate", target: "/stock" },
  { id: "s4", key: "4", label: "World Cup", action: "navigate", target: "/world-cup" },
  { id: "s5", key: "5", label: "Analytics", action: "navigate", target: "/analytics" },
  { id: "s6", key: "6", label: "Contacts", action: "navigate", target: "/suppliers" },
  { id: "s7", key: "7", label: "Members", action: "navigate", target: "/members" },
  { id: "s8", key: "8", label: "Focus Room", action: "navigate", target: "/warroom" },
  { id: "s9", key: "9", label: "Event Timeline", action: "navigate", target: "/timeline" },
];

const STORAGE_KEY = "vjx_keyboard_shortcuts";

export function getShortcuts(): Shortcut[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_SHORTCUTS;
}

export function saveShortcuts(shortcuts: Shortcut[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
}

export function resetShortcuts() {
  localStorage.removeItem(STORAGE_KEY);
  return DEFAULT_SHORTCUTS;
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only trigger on Cmd/Ctrl + number
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.shiftKey || e.altKey) return;

    const key = e.key;
    if (!/^[1-9]$/.test(key)) return;

    const shortcuts = getShortcuts();
    const match = shortcuts.find(s => s.key === key);
    if (!match) return;

    e.preventDefault();
    if (match.action === "navigate") {
      navigate(match.target);
    }
    // future: open_dialog support
  }, [navigate]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

export const AVAILABLE_PAGES = [
  { label: "Dashboard", path: "/" },
  { label: "Orders", path: "/orders" },
  { label: "Stock", path: "/stock" },
  { label: "World Cup", path: "/world-cup" },
  { label: "Analytics", path: "/analytics" },
  { label: "Contacts", path: "/suppliers" },
  { label: "Members", path: "/members" },
  { label: "Focus Room", path: "/warroom" },
  { label: "Event Timeline", path: "/timeline" },
  { label: "Listings", path: "/listings" },
  { label: "Finance", path: "/finance" },
  { label: "Balances", path: "/balance" },
  { label: "Wallet", path: "/wallet" },
  { label: "Cashflow", path: "/cashflow" },
  { label: "Invoices", path: "/invoices" },
  { label: "IJK Account", path: "/ijk-account" },
  { label: "Team", path: "/team" },
  { label: "To-Do List", path: "/todos" },
  { label: "Activity Log", path: "/activity" },
  { label: "Templates", path: "/templates" },
  { label: "Password Vault", path: "/vault-passwords" },
];
