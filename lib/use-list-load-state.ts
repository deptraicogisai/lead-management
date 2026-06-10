import { useCallback, useRef, useState } from "react";

export function useListLoadState() {
  const hasLoadedRef = useRef(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const beginLoad = useCallback(() => {
    if (hasLoadedRef.current) {
      setIsRefreshing(true);
      return;
    }

    setIsInitialLoad(true);
  }, []);

  const endLoad = useCallback(() => {
    hasLoadedRef.current = true;
    setIsInitialLoad(false);
    setIsRefreshing(false);
  }, []);

  const resetLoad = useCallback(() => {
    hasLoadedRef.current = false;
    setIsInitialLoad(true);
    setIsRefreshing(false);
  }, []);

  return { isInitialLoad, isRefreshing, beginLoad, endLoad, resetLoad };
}
