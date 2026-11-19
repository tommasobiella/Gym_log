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

  async function pickBackupFolder() {
    if (!supportsDirectoryPicker()) {
      return {
        supported: false,
        name: null,
        message: 'Su iPhone/iPad Safari non permette cartelle persistenti automatiche: al salvataggio si aprirà "Salva su File" di iOS.'
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
      throw new Error('Permesso negato sulla cartella di backup.');
    }
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async function saveBackup() {
    const data = await GymDB.exportAllData();
    const content = JSON.stringify(data, null, 2);
    const mimeType = 'application/json;charset=utf-8';

    // 1. Persistent folder handle (Desktop / Android Chromium)
    if (supportsDirectoryPicker()) {
      let dirHandle = await getSavedFolderHandle();
      if (!dirHandle) {
        const picked = await pickBackupFolder();
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
        files: [file],
        title: 'Gym Log Backup',
        text: 'Backup JSON Gym Log'
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

  return {
    BACKUP_FILENAME,
    supportsDirectoryPicker,
    getSavedFolderHandle,
    pickBackupFolder,
    saveBackup,
    restoreFromFile
  };
})();
