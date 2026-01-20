const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const { createReadStream, createWriteStream } = require('fs');
const extract = require('extract-zip');

/**
 * Backup Manager - Export and import user data
 */
class BackupManager {
  constructor(storagePath, toolManager, logManager, notificationManager) {
    this.storagePath = storagePath;
    this.toolManager = toolManager;
    this.logManager = logManager;
    this.notificationManager = notificationManager;
  }

  /**
   * Export all user data to ZIP
   */
  async exportBackup(destinationPath, userId, username) {
    try {
      const timestamp = Date.now();
      const backupFileName = `personal-hub-backup-${timestamp}.zip`;
      const backupPath = path.join(destinationPath, backupFileName);

      // Create backup metadata
      const metadata = {
        version: '1.0',
        timestamp,
        appVersion: require('../../package.json').version || '0.1.0',
        userId,
        username
      };

      // Collect data to backup
      const backupData = {
        metadata,
        profile: await this.getFileContent('profile.json'),
        installedTools: await this.getFileContent('installed-tools.json'),
        settings: await this.getFileContent('settings.json'),
        logs: await this.getRecentLogs(1000)
      };

      // Create temporary backup folder
      const tempDir = path.join(this.storagePath, 'temp_backup');
      await fs.ensureDir(tempDir);

      // Write backup data
      await fs.writeJSON(path.join(tempDir, 'backup-data.json'), backupData, { spaces: 2 });

      // Copy tool configs
      const toolsConfigDir = path.join(this.storagePath, 'tools');
      if (await fs.pathExists(toolsConfigDir)) {
        await fs.copy(toolsConfigDir, path.join(tempDir, 'tools'));
      }

      // Create ZIP archive
      await this.createZipArchive(tempDir, backupPath);

      // Clean temp directory
      await fs.remove(tempDir);

      // Log export
      this.logManager?.log({
        type: 'system:backup',
        severity: 'info',
        userId,
        username,
        status: 'success',
        payload: { backupPath }
      });

      // Show notification
      this.notificationManager?.backupComplete(backupPath);

      return {
        success: true,
        backupPath,
        fileName: backupFileName
      };

    } catch (error) {
      console.error('Failed to export backup:', error);

      this.logManager?.log({
        type: 'system:backup',
        severity: 'error',
        userId,
        username,
        status: 'error',
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Import backup from ZIP
   */
  async importBackup(backupFilePath, userId, username) {
    try {
      // Create temporary extract folder
      const tempDir = path.join(this.storagePath, 'temp_restore');
      await fs.ensureDir(tempDir);

      // Extract ZIP
      await extract(backupFilePath, { dir: tempDir });

      // Read backup data
      const backupDataPath = path.join(tempDir, 'backup-data.json');
      if (!await fs.pathExists(backupDataPath)) {
        throw new Error('Invalid backup file: backup-data.json not found');
      }

      const backupData = await fs.readJSON(backupDataPath);

      // Validate backup
      if (!backupData.metadata || !backupData.metadata.version) {
        throw new Error('Invalid backup file: missing metadata');
      }

      // Restore profile
      if (backupData.profile) {
        await fs.writeJSON(
          path.join(this.storagePath, 'profile.json'),
          backupData.profile,
          { spaces: 2 }
        );
      }

      // Restore settings
      if (backupData.settings) {
        await fs.writeJSON(
          path.join(this.storagePath, 'settings.json'),
          backupData.settings,
          { spaces: 2 }
        );
      }

      // Restore tool configs
      const toolsBackupDir = path.join(tempDir, 'tools');
      if (await fs.pathExists(toolsBackupDir)) {
        const toolsConfigDir = path.join(this.storagePath, 'tools');
        await fs.ensureDir(toolsConfigDir);
        await fs.copy(toolsBackupDir, toolsConfigDir, { overwrite: true });
      }

      // Restore installed tools list
      if (backupData.installedTools) {
        await fs.writeJSON(
          path.join(this.storagePath, 'installed-tools.json'),
          backupData.installedTools,
          { spaces: 2 }
        );
      }

      // Clean temp directory
      await fs.remove(tempDir);

      // Log restore
      this.logManager?.log({
        type: 'system:restore',
        severity: 'warning',
        userId,
        username,
        status: 'success',
        payload: {
          backupTimestamp: backupData.metadata.timestamp
        }
      });

      // Show notification
      this.notificationManager?.success(
        'Backup Restored',
        'Your data has been restored successfully. Please restart the app.'
      );

      return {
        success: true,
        metadata: backupData.metadata
      };

    } catch (error) {
      console.error('Failed to import backup:', error);

      this.logManager?.log({
        type: 'system:restore',
        severity: 'error',
        userId,
        username,
        status: 'error',
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get file content as JSON
   */
  async getFileContent(fileName) {
    try {
      const filePath = path.join(this.storagePath, fileName);
      if (await fs.pathExists(filePath)) {
        return await fs.readJSON(filePath);
      }
      return null;
    } catch (error) {
      console.error(`Failed to read ${fileName}:`, error);
      return null;
    }
  }

  /**
   * Get recent logs for backup
   */
  async getRecentLogs(limit = 1000) {
    try {
      if (this.logManager) {
        return this.logManager.tail({ limit });
      }
      return [];
    } catch (error) {
      console.error('Failed to get logs:', error);
      return [];
    }
  }

  /**
   * Create ZIP archive
   */
  createZipArchive(sourceDir, outputPath) {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        resolve();
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  /**
   * Validate backup file
   */
  async validateBackup(backupFilePath) {
    try {
      const tempDir = path.join(this.storagePath, 'temp_validate');
      await fs.ensureDir(tempDir);

      await extract(backupFilePath, { dir: tempDir });

      const backupDataPath = path.join(tempDir, 'backup-data.json');
      if (!await fs.pathExists(backupDataPath)) {
        await fs.remove(tempDir);
        return {
          valid: false,
          error: 'Invalid backup file'
        };
      }

      const backupData = await fs.readJSON(backupDataPath);
      await fs.remove(tempDir);

      return {
        valid: true,
        metadata: backupData.metadata
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
}

module.exports = BackupManager;
