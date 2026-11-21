/**
 * backup.js - Local Folder & iOS Share-Sheet JSON Backup Manager
 * Always writes a single fixed file: gym-log-backup.json
 * Supports File System Access API (showDirectoryPicker) on supported browsers,
 * with seamless fallback to iOS Share Sheet (navigator.share) / file download on iPhone/iPad.
 */
const GymBackup = (() => {
  const BACKUP_FILENAME = 'gym-log-backup.json';

  function supportsDirectoryPicker() {
    return typeof window.showDirectoryPicker === 'function';
  }

  async function getSavedFolderHandle() {
    if (!supportsDirectoryPicker()) return null;
    try {
      return await GymDB.getSetting('backupDirHandle');
    } catch (e) {
      return null;
    }
  }

  const GROUP_EN_MAP = {
    'Petto': 'Chest',
    'Spalle': 'Shoulders',
    'Tricipiti': 'Triceps',
    'Schiena': 'Back',
    'Bicipiti': 'Biceps',
    'Gambe': 'Legs',
    'Core / Addome': 'Core / Abs',
    'Altro': 'Other'
  };

  function localizeGroup(group, lang) {
    if (lang === 'en') return GROUP_EN_MAP[group] || group;
    return group;
  }

  async function pickBackupFolder(lang = 'it') {
    if (!supportsDirectoryPicker()) {
      return {
        supported: false,
        name: null,
        message: lang === 'en'
          ? 'Safari on iPhone/iPad does not support persistent folders: tapping Save opens the iOS Share Sheet ("Save to Files").'
          : 'Su iPhone/iPad Safari non permette cartelle persistenti automatiche: al salvataggio si aprirà "Salva su File" di iOS.'
      };
    }

    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await GymDB.setSetting('backupDirHandle', dirHandle);
    await GymDB.setSetting('backupFolderName', dirHandle.name);
    return {
      supported: true,
      handle: dirHandle,
      name: dirHandle.name
    };
  }

  async function writeFileToDirectory(dirHandle, filename, content) {
    let perm = await dirHandle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      perm = await dirHandle.requestPermission({ mode: 'readwrite' });
    }
    if (perm !== 'granted') {
      throw new Error('Backup folder permission denied.');
    }
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async function saveBackup(lang = 'it') {
    const data = await GymDB.exportAllData();
    const content = JSON.stringify(data, null, 2);
    const mimeType = 'application/json;charset=utf-8';

    // 1. Persistent folder handle (Desktop / Android Chromium)
    if (supportsDirectoryPicker()) {
      let dirHandle = await getSavedFolderHandle();
      if (!dirHandle) {
        const picked = await pickBackupFolder(lang);
        dirHandle = picked.handle;
      }
      if (dirHandle) {
        await writeFileToDirectory(dirHandle, BACKUP_FILENAME, content);
        await GymDB.setSetting('lastBackupAt', new Date().toISOString());
        return { method: 'directory', folderName: dirHandle.name, filename: BACKUP_FILENAME };
      }
    }

    // 2. iOS / Mobile native Share Sheet (Salva su File -> iCloud Drive)
    const file = new File([content], BACKUP_FILENAME, { type: mimeType });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file]
      });
      await GymDB.setSetting('lastBackupAt', new Date().toISOString());
      return { method: 'share', filename: BACKUP_FILENAME };
    }

    // 3. Fallback standard browser download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = BACKUP_FILENAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    await GymDB.setSetting('lastBackupAt', new Date().toISOString());
    return { method: 'download', filename: BACKUP_FILENAME };
  }

  async function restoreFromFile(file) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    return await GymDB.importAllData(parsed);
  }

  async function shareOrDownloadTextFile(filename, content, mimeType, title) {
    const file = new File([content], filename, { type: mimeType });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: title || filename
        });
        return { method: 'share', filename };
      } catch (e) {
        if (e && e.name === 'AbortError') throw e;
      }
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { method: 'download', filename };
  }

  function csvEscape(val) {
    const s = val === null || val === undefined ? '' : String(val);
    if (/[",\r\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  async function exportCSV(lang = 'it') {
    const [allSets, allExercises] = await Promise.all([
      GymDB.getAllSets(),
      GymDB.getAllExercises()
    ]);
    const exMap = {};
    allExercises.forEach(ex => { exMap[ex.id] = ex; });

    const sorted = [...allSets].sort((a, b) => {
      const cmp = (b.date || '').localeCompare(a.date || '');
      if (cmp !== 0) return cmp;
      return (a.timestamp || '').localeCompare(b.timestamp || '');
    });

    const header = lang === 'en'
      ? 'Date,Group,Exercise,Weight_kg,Reps,Notes'
      : 'Data,Gruppo,Esercizio,Carico_kg,Ripetizioni,Note';
    const lines = [header];
    for (const s of sorted) {
      const exMeta = exMap[s.exerciseId];
      const group = localizeGroup(exMeta ? exMeta.group : (s.group || ''), lang);
      const name = exMeta ? exMeta.name : (s.exerciseName || '');
      lines.push([
        csvEscape(s.date || ''),
        csvEscape(group),
        csvEscape(name),
        csvEscape(s.weight !== undefined && s.weight !== null ? s.weight : ''),
        csvEscape(s.reps || ''),
        csvEscape(s.notes || '')
      ].join(','));
    }

    const csvContent = '\uFEFF' + lines.join('\r\n');
    return await shareOrDownloadTextFile(
      'gym-log-export.csv',
      csvContent,
      'text/csv;charset=utf-8',
      'Gym Log Export (CSV)'
    );
  }

  async function exportMarkdown(lang = 'it') {
    const [allSets, allExercises] = await Promise.all([
      GymDB.getAllSets(),
      GymDB.getAllExercises()
    ]);
    const exMap = {};
    allExercises.forEach(ex => { exMap[ex.id] = ex; });

    const groupsOrder = ['Petto', 'Spalle', 'Tricipiti', 'Schiena', 'Bicipiti', 'Gambe', 'Core / Addome'];
    const byGroup = {};

    for (const s of allSets) {
      const exMeta = exMap[s.exerciseId];
      const group = (exMeta ? exMeta.group : s.group) || 'Altro';
      const exKey = s.exerciseId || s.exerciseName;
      const exName = exMeta ? exMeta.name : s.exerciseName;
      if (!byGroup[group]) byGroup[group] = {};
      if (!byGroup[group][exKey]) {
        byGroup[group][exKey] = { name: exName, byDate: {} };
      }
      if (!byGroup[group][exKey].byDate[s.date]) {
        byGroup[group][exKey].byDate[s.date] = [];
      }
      byGroup[group][exKey].byDate[s.date].push(s);
    }

    const orderedGroups = Object.keys(byGroup).sort((a, b) => {
      const ia = groupsOrder.indexOf(a);
      const ib = groupsOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

    const md = ['# Gym Log', ''];
    for (const g of orderedGroups) {
      md.push(`## ${localizeGroup(g, lang)}`, '');
      const exList = Object.values(byGroup[g]).sort((a, b) => a.name.localeCompare(b.name));
      for (const exObj of exList) {
        md.push(`### ${exObj.name}`);
        const dates = Object.keys(exObj.byDate).sort((a, b) => b.localeCompare(a));
        for (const dateStr of dates) {
          const daySets = exObj.byDate[dateStr].sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
          const parts = dateStr.split('-');
          const shortDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}` : dateStr;
          const formatted = GymDB.formatDaySets(daySets);
          const notes = daySets.map(x => (x.notes || '').trim()).filter(Boolean).join('; ');
          md.push(`- ${shortDate} ~ ${formatted}${notes ? ` (${notes})` : ''}`);
        }
        md.push('');
      }
    }

    return await shareOrDownloadTextFile(
      'gym-log-export.md',
      md.join('\n'),
      'text/markdown;charset=utf-8',
      'Gym Log Export (Markdown)'
    );
  }

  return {
    BACKUP_FILENAME,
    supportsDirectoryPicker,
    getSavedFolderHandle,
    pickBackupFolder,
    saveBackup,
    restoreFromFile,
    exportCSV,
    exportMarkdown
  };
})();
