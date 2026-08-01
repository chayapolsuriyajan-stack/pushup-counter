import { useContext } from "react";
import { StoreContext } from "./StoreContext.jsx";

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore() must be called inside <StoreProvider>");
  return ctx;
}
