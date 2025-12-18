import { useEffect, useRef, useCallback } from 'react';

interface FormPersistenceData<T> {
  data: T;
  pendingSubmit: boolean;
  timestamp: number;
  returnTo: string;
}

interface UseFormPersistenceOptions<T> {
  key: string;
  expirationMs?: number;
}

const STORAGE_PREFIX = 'kita-form-';
const DEFAULT_EXPIRATION_MS = 30 * 60 * 1000;

export function useFormPersistence<T>({ key, expirationMs = DEFAULT_EXPIRATION_MS }: UseFormPersistenceOptions<T>) {
  const storageKey = `${STORAGE_PREFIX}${key}`;
  const restoredRef = useRef(false);

  const saveFormData = useCallback((data: T, pendingSubmit: boolean = false, returnTo: string = '') => {
    const payload: FormPersistenceData<T> = {
      data,
      pendingSubmit,
      timestamp: Date.now(),
      returnTo
    };
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to save form data to sessionStorage:', error);
    }
  }, [storageKey]);

  const getStoredData = useCallback((): FormPersistenceData<T> | null => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (!stored) return null;

      const parsed: FormPersistenceData<T> = JSON.parse(stored);
      
      if (Date.now() - parsed.timestamp > expirationMs) {
        sessionStorage.removeItem(storageKey);
        return null;
      }

      return parsed;
    } catch (error) {
      console.warn('Failed to retrieve form data from sessionStorage:', error);
      return null;
    }
  }, [storageKey, expirationMs]);

  const clearStoredData = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to clear form data from sessionStorage:', error);
    }
  }, [storageKey]);

  const hasPendingSubmit = useCallback((): boolean => {
    const stored = getStoredData();
    return stored?.pendingSubmit ?? false;
  }, [getStoredData]);

  const markAsRestored = useCallback(() => {
    restoredRef.current = true;
  }, []);

  const wasRestored = useCallback((): boolean => {
    return restoredRef.current;
  }, []);

  const saveBeforeRedirect = useCallback((data: T, returnTo: string) => {
    saveFormData(data, true, returnTo);
  }, [saveFormData]);

  return {
    saveFormData,
    getStoredData,
    clearStoredData,
    hasPendingSubmit,
    saveBeforeRedirect,
    markAsRestored,
    wasRestored
  };
}

export type { FormPersistenceData };
