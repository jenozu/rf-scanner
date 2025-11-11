import { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";

/**
 * Hook for storing data on the server instead of localStorage
 * Automatically syncs with the server API
 */
function useServerStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data from server on mount
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await api.getData(key);
        
        if (isMounted) {
          setStoredValue(data !== null ? (data as T) : initialValue);
        }
      } catch (err: any) {
        console.error(`Error loading ${key} from server:`, err);
        if (isMounted) {
          setError(err.message || "Failed to load data");
          // Fallback to initial value if server fails
          setStoredValue(initialValue);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [key, initialValue]);

  // Save data to server
  const setValue = useCallback(async (value: T) => {
    try {
      setError(null);
      setStoredValue(value);
      
      // Save to server (fire and forget - don't block UI)
      api.saveData(key, value).catch((err) => {
        console.error(`Error saving ${key} to server:`, err);
        setError(err.message || "Failed to save data");
      });
    } catch (err: any) {
      console.error(`Error setting ${key}:`, err);
      setError(err.message || "Failed to set data");
    }
  }, [key]);

  return [storedValue, setValue, isLoading, error] as const;
}

export default useServerStorage;

