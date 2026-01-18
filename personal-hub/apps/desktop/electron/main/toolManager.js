const fs = require('fs-extra');
const path = require('path');

/**
 * Tool Manager - Install/Uninstall tools
 */
class ToolManager {
  constructor(storagePath, logManager, notificationManager) {
    this.storagePath = storagePath;
    this.logManager = logManager;
    this.notificationManager = notificationManager;
    this.installedToolsFile = path.join(storagePath, 'installed-tools.json');
    this.toolsDir = path.join(process.cwd(), 'tools');
    this.toolsRepoDir = path.join(process.cwd(), 'tools-repository');
  }

  /**
   * Get installed tools list
   */
  async getInstalledTools() {
    try {
      if (await fs.pathExists(this.installedToolsFile)) {
        const data = await fs.readJSON(this.installedToolsFile);
        return data.installed || [];
      }
      return [];
    } catch (error) {
      console.error('Failed to get installed tools:', error);
      return [];
    }
  }

  /**
   * Check if tool is installed
   */
  async isInstalled(toolId) {
    const installed = await this.getInstalledTools();
    return installed.some(tool => tool.id === toolId);
  }

  /**
   * Install tool
   */
  async installTool(toolId, userId, username) {
    try {
      // Check if already installed
      if (await this.isInstalled(toolId)) {
        return {
          success: false,
          error: 'Tool already installed'
        };
      }

      // Source and destination paths
      const sourcePath = path.join(this.toolsRepoDir, toolId);
      const destPath = path.join(this.toolsDir, toolId);

      // Check if tool exists in repository
      if (!await fs.pathExists(sourcePath)) {
        return {
          success: false,
          error: 'Tool not found in repository'
        };
      }

      // Copy tool to tools directory
      await fs.copy(sourcePath, destPath);

      // Read manifest
      const manifestPath = path.join(destPath, 'manifest.json');
      const manifest = await fs.readJSON(manifestPath);

      // Add to installed tools list
      const installed = await this.getInstalledTools();
      installed.push({
        id: toolId,
        version: manifest.version,
        installedAt: Date.now(),
        lastUsed: null,
        usageCount: 0
      });

      await fs.writeJSON(this.installedToolsFile, {
        installed,
        lastUpdated: Date.now()
      }, { spaces: 2 });

      // Log installation
      this.logManager?.log({
        type: 'tool:install',
        severity: 'info',
        userId,
        username,
        toolId,
        toolName: manifest.name,
        status: 'success'
      });

      // Show notification
      this.notificationManager?.success(
        'Tool Installed',
        `${manifest.name} has been installed successfully`,
        { toolId }
      );

      return {
        success: true,
        tool: manifest
      };

    } catch (error) {
      console.error('Failed to install tool:', error);

      this.logManager?.log({
        type: 'tool:install',
        severity: 'error',
        userId,
        username,
        toolId,
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
   * Uninstall tool
   */
  async uninstallTool(toolId, userId, username) {
    try {
      // Check if installed
      if (!await this.isInstalled(toolId)) {
        return {
          success: false,
          error: 'Tool not installed'
        };
      }

      // Get manifest before deleting
      const toolPath = path.join(this.toolsDir, toolId);
      const manifestPath = path.join(toolPath, 'manifest.json');
      const manifest = await fs.readJSON(manifestPath);

      // Remove tool directory
      await fs.remove(toolPath);

      // Remove from installed tools list
      let installed = await this.getInstalledTools();
      installed = installed.filter(tool => tool.id !== toolId);

      await fs.writeJSON(this.installedToolsFile, {
        installed,
        lastUpdated: Date.now()
      }, { spaces: 2 });

      // Clean tool config
      const configPath = path.join(this.storagePath, 'tools', `${toolId}.json`);
      if (await fs.pathExists(configPath)) {
        await fs.remove(configPath);
      }

      // Log uninstallation
      this.logManager?.log({
        type: 'tool:uninstall',
        severity: 'info',
        userId,
        username,
        toolId,
        toolName: manifest.name,
        status: 'success'
      });

      // Show notification
      this.notificationManager?.show(
        'Tool Uninstalled',
        `${manifest.name} has been uninstalled`,
        { toolId }
      );

      return {
        success: true,
        toolId
      };

    } catch (error) {
      console.error('Failed to uninstall tool:', error);

      this.logManager?.log({
        type: 'tool:uninstall',
        severity: 'error',
        userId,
        username,
        toolId,
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
   * Update tool usage stats
   */
  async updateUsageStats(toolId) {
    try {
      const installed = await this.getInstalledTools();
      const tool = installed.find(t => t.id === toolId);

      if (tool) {
        tool.lastUsed = Date.now();
        tool.usageCount = (tool.usageCount || 0) + 1;

        await fs.writeJSON(this.installedToolsFile, {
          installed,
          lastUpdated: Date.now()
        }, { spaces: 2 });
      }
    } catch (error) {
      console.error('Failed to update usage stats:', error);
    }
  }

  /**
   * Get tool installation info
   */
  async getToolInfo(toolId) {
    try {
      const installed = await this.getInstalledTools();
      return installed.find(tool => tool.id === toolId) || null;
    } catch (error) {
      console.error('Failed to get tool info:', error);
      return null;
    }
  }
}

module.exports = ToolManager;
