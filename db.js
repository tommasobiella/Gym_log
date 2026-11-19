/**
 * db.js - Standalone IndexedDB Storage Engine for Gym Log
 * Zero external dependencies. All data lives locally on the user's device.
 */
const GymDB = (() => {
  const DB_NAME = 'GymLogStandaloneDB';
  const DB_VERSION = 1;
  let dbInstance = null;

  async function requestPersistence() {
    if (navigator.storage && navigator.storage.persist) {
      try {
        await navigator.storage.persist();
      } catch (e) {
        // Ignore if browser denies silent persistence
      }
    }
  }

  function open() {
    if (dbInstance) return Promise.resolve(dbInstance);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('exercises')) {
          db.createObjectStore('exercises', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sets')) {
          const setsStore = db.createObjectStore('sets', { keyPath: 'id' });
          setsStore.createIndex('by_date', 'date', { unique: false });
          setsStore.createIndex('by_exercise', 'exerciseId', { unique: false });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
      req.onsuccess = (e) => {
        dbInstance = e.target.result;
        requestPersistence();
        resolve(dbInstance);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function txPromise(storeName, mode, operation) {
    return open().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const req = operation(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  }

  async function getAllExercises() {
    return txPromise('exercises', 'readonly', (s) => s.getAll());
  }

  async function saveExercise(ex) {
    return txPromise('exercises', 'readwrite', (s) => s.put(ex));
  }

  async function updateExerciseAndSets(ex) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['exercises', 'sets'], 'readwrite');
      tx.objectStore('exercises').put(ex);
      const setsStore = tx.objectStore('sets');
      const idx = setsStore.index('by_exercise');
      const req = idx.getAll(IDBKeyRange.only(ex.id));
      req.onsuccess = () => {
        (req.result || []).forEach((s) => {
          setsStore.put({ ...s, exerciseName: ex.name, group: ex.group });
        });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function deleteExerciseAndSets(exerciseId) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['exercises', 'sets'], 'readwrite');
      tx.objectStore('exercises').delete(exerciseId);
      const setsStore = tx.objectStore('sets');
      const idx = setsStore.index('by_exercise');
      const req = idx.getAllKeys(IDBKeyRange.only(exerciseId));
      req.onsuccess = () => {
        (req.result || []).forEach((k) => setsStore.delete(k));
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function seedIfEmpty(defaultList) {
    const seeded = await getSetting('initialSeedDone');
    const existing = await getAllExercises();
    if (seeded || existing.length > 0) return existing;

    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['exercises', 'settings'], 'readwrite');
      const store = tx.objectStore('exercises');
      defaultList.forEach((ex) => store.put(ex));
      tx.objectStore('settings').put({ key: 'initialSeedDone', value: true });
      tx.oncomplete = () => resolve(defaultList);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getAllSets() {
    return txPromise('sets', 'readonly', (s) => s.getAll());
  }

  async function getSetsByDate(dateStr) {
    return open().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction('sets', 'readonly');
      const idx = tx.objectStore('sets').index('by_date');
      const req = idx.getAll(IDBKeyRange.only(dateStr));
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    }));
  }

  async function addSet(entry) {
    return txPromise('sets', 'readwrite', (s) => s.put(entry));
  }

  async function updateSet(entry) {
    return txPromise('sets', 'readwrite', (s) => s.put(entry));
  }

  async function deleteSet(id) {
    return txPromise('sets', 'readwrite', (s) => s.delete(id));
  }

  async function getSetting(key) {
    const row = await txPromise('settings', 'readonly', (s) => s.get(key));
    return row ? row.value : null;
  }

  async function setSetting(key, value) {
    return txPromise('settings', 'readwrite', (s) => s.put({ key, value }));
  }

  /**
   * Format consecutive sets with same weight into "10,8,6 @ 30kg" or "10,8 @ 30kg; 6 @ 35kg"
   */
  function formatDaySets(setsList) {
    if (!setsList || setsList.length === 0) return '';
    const groups = [];
    let currWeight = null;
    let currReps = [];

    for (const s of setsList) {
      const w = Number(s.weight);
      const r = String(s.reps);
      if (currWeight === null || w === currWeight) {
        currWeight = w;
        currReps.push(r);
      } else {
        groups.push(`${currReps.join(',')} @ ${currWeight}kg`);
        currWeight = w;
        currReps = [r];
      }
    }
    if (currReps.length > 0 && currWeight !== null) {
      groups.push(`${currReps.join(',')} @ ${currWeight}kg`);
    }
    return groups.join('; ');
  }

  /**
   * Recompute PR, last_date, last_weight, last_reps for all exercises from IndexedDB sets.
   */
  function recomputeStats(exercises, allSets) {
    const setsByEx = new Map();
    for (const s of allSets) {
      if (!setsByEx.has(s.exerciseId)) setsByEx.set(s.exerciseId, []);
      setsByEx.get(s.exerciseId).push(s);
    }

    return exercises.map((ex) => {
      const exSets = setsByEx.get(ex.id) || [];
      if (exSets.length === 0) {
        return { ...ex, pr: null, last_date: null, last_weight: null, last_reps: null };
      }

      exSets.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.timestamp || '').localeCompare(b.timestamp || '');
      });

      let maxPR = null;
      let latestDate = null;

      for (const s of exSets) {
        const w = Number(s.weight);
        if (!isNaN(w) && w > 0 && (maxPR === null || w > maxPR)) {
          maxPR = w;
        }
        if (!latestDate || s.date > latestDate) {
          latestDate = s.date;
        }
      }

      const latestSets = exSets.filter((s) => s.date === latestDate);
      const lastWeight = latestSets.length > 0 ? Number(latestSets[latestSets.length - 1].weight) : null;
      const lastReps = latestSets.map((s) => s.reps).join(',');

      return {
        ...ex,
        pr: maxPR,
        last_date: latestDate,
        last_weight: lastWeight,
        last_reps: lastReps
      };
    });
  }

  async function exportAllData() {
    const [exercises, sets] = await Promise.all([getAllExercises(), getAllSets()]);
    return {
      schemaVersion: 1,
      app: 'gym-log-standalone',
      exportedAt: new Date().toISOString(),
      exercises,
      sets
    };
  }

  async function importAllData(payload) {
    if (!payload || !Array.isArray(payload.exercises) || !Array.isArray(payload.sets)) {
      throw new Error('Formato backup non valido: mancano exercises o sets.');
    }
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['exercises', 'sets', 'settings'], 'readwrite');
      const exStore = tx.objectStore('exercises');
      const setStore = tx.objectStore('sets');

      exStore.clear();
      setStore.clear();

      payload.exercises.forEach((ex) => exStore.put(ex));
      payload.sets.forEach((s) => setStore.put(s));
      tx.objectStore('settings').put({ key: 'initialSeedDone', value: true });

      tx.oncomplete = () => resolve({
        exercisesCount: payload.exercises.length,
        setsCount: payload.sets.length
      });
      tx.onerror = () => reject(tx.error);
    });
  }

  return {
    open,
    seedIfEmpty,
    getAllExercises,
    saveExercise,
    updateExerciseAndSets,
    deleteExerciseAndSets,
    getAllSets,
    getSetsByDate,
    addSet,
    updateSet,
    deleteSet,
    getSetting,
    setSetting,
    formatDaySets,
    recomputeStats,
    exportAllData,
    importAllData
  };
})();
