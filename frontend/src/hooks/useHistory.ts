import { useState, useEffect, useCallback } from 'react';

export interface HistoryRecord {
  id: string;
  timestamp: number;
  spec: string;
  specFormat: 'yaml' | 'json' | null;
  result: string | null;
  specName: string | null;
}

const STORAGE_KEY = 'specaudit-history';
const MAX_STORAGE_BYTES = 4_000_000;

function loadRecords(): HistoryRecord[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    // Basic validation: ensure each item has required fields
    return parsed.filter(
      (r: unknown): r is HistoryRecord =>
        typeof r === 'object' &&
        r !== null &&
        typeof (r as HistoryRecord).id === 'string' &&
        typeof (r as HistoryRecord).timestamp === 'number' &&
        typeof (r as HistoryRecord).spec === 'string'
    );
  } catch {
    return [];
  }
}

/**
 * Save records to localStorage with LRU eviction.
 * Returns the (possibly evicted) records array that was actually persisted.
 */
function saveRecords(records: HistoryRecord[]): HistoryRecord[] {
  try {
    const working = [...records]; // copy so we don't mutate caller's array
    let serialized = JSON.stringify(working);
    let size = new TextEncoder().encode(serialized).length;

    while (size > MAX_STORAGE_BYTES && working.length > 0) {
      working.pop(); // remove oldest (last in newest-first array)
      serialized = JSON.stringify(working);
      size = new TextEncoder().encode(serialized).length;
      console.warn('History LRU eviction: removed oldest record');
    }

    localStorage.setItem(STORAGE_KEY, serialized);
    return working;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded');
    }
    return records; // return original if save failed
  }
}

export function useHistory() {
  const [records, setRecords] = useState<HistoryRecord[]>(() => loadRecords());

  // Persist whenever records change, applying LRU eviction
  useEffect(() => {
    const persisted = saveRecords(records);
    // If eviction occurred, sync state to match what was persisted
    if (persisted.length < records.length) {
      setRecords(persisted);
    }
  }, [records]);

  const addRecord = useCallback(
    (
      record: Omit<HistoryRecord, 'id' | 'timestamp'> & {
        id?: string;
        timestamp?: number;
      }
    ): HistoryRecord => {
      const fullRecord: HistoryRecord = {
        ...record,
        id: record.id ?? crypto.randomUUID(),
        timestamp: record.timestamp ?? Date.now(),
      };

      setRecords((prev) => {
        const existingIndex = prev.findIndex((r) => r.id === fullRecord.id);
        if (existingIndex !== -1) {
          // Update in place
          const updated = [...prev];
          updated[existingIndex] = fullRecord;
          return updated;
        }
        // New record — prepend (newest first)
        return [fullRecord, ...prev];
      });

      return fullRecord;
    },
    []
  );

  const deleteRecord = useCallback((id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setRecords([]);
  }, []);

  const loadRecord = useCallback(
    (id: string): HistoryRecord | undefined => {
      return records.find((r) => r.id === id);
    },
    [records]
  );

  return { records, addRecord, deleteRecord, clearAll, loadRecord };
}
