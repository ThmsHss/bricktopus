import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getDataSource, type DataSource } from "./index";
import type { CustomerId, DataMode } from "./types";

interface BricktopusContextValue {
  mode: DataMode;
  setMode: (next: DataMode) => void;
  customerId: CustomerId;
  setCustomerId: (next: CustomerId) => void;
  source: DataSource;
}

const BricktopusContext = createContext<BricktopusContextValue | null>(null);

const MODE_STORAGE_KEY = "bricktopus:data-mode";
const CUSTOMER_STORAGE_KEY = "bricktopus:customer-id";

function readPersisted<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(key);
  return (stored as T) ?? fallback;
}

interface BricktopusProviderProps {
  children: ReactNode;
  defaultMode?: DataMode;
  defaultCustomerId?: CustomerId;
}

export function BricktopusProvider({
  children,
  defaultMode = "mock",
  defaultCustomerId = "puma",
}: BricktopusProviderProps) {
  const [mode, setModeState] = useState<DataMode>(() =>
    readPersisted<DataMode>(MODE_STORAGE_KEY, defaultMode),
  );
  const [customerId, setCustomerIdState] = useState<CustomerId>(() =>
    readPersisted<CustomerId>(CUSTOMER_STORAGE_KEY, defaultCustomerId),
  );

  useEffect(() => {
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    window.localStorage.setItem(CUSTOMER_STORAGE_KEY, customerId);
  }, [customerId]);

  const setMode = useCallback((next: DataMode) => setModeState(next), []);
  const setCustomerId = useCallback(
    (next: CustomerId) => setCustomerIdState(next),
    [],
  );

  const value = useMemo<BricktopusContextValue>(
    () => ({
      mode,
      setMode,
      customerId,
      setCustomerId,
      source: getDataSource(mode),
    }),
    [mode, setMode, customerId, setCustomerId],
  );

  return (
    <BricktopusContext.Provider value={value}>
      {children}
    </BricktopusContext.Provider>
  );
}

export function useBricktopus(): BricktopusContextValue {
  const ctx = useContext(BricktopusContext);
  if (!ctx) {
    throw new Error("useBricktopus must be used inside <BricktopusProvider>");
  }
  return ctx;
}
