import { createContext, useCallback, useState } from "react";
import { loadStore, recordSet as recordSetToStorage, updateSettings as updateSettingsInStorage, clearAll as clearAllStorage } from "../lib/store.js";

export const StoreContext = createContext(null);

/**
 * Single provider at the app root. Holds the migrated store in state so
 * every page re-renders when it changes; each action writes to localStorage
 * then replaces state with the fresh object localStorage now agrees with.
 */
export function StoreProvider({ children }) {
  const [store, setStore] = useState(() => loadStore());

  const recordSet = useCallback((set) => {
    setStore(recordSetToStorage(set));
  }, []);

  const updateSettings = useCallback((patch) => {
    setStore(updateSettingsInStorage(patch));
  }, []);

  const clearAll = useCallback(() => {
    setStore(clearAllStorage());
  }, []);

  return (
    <StoreContext.Provider value={{ store, recordSet, updateSettings, clearAll }}>
      {children}
    </StoreContext.Provider>
  );
}
