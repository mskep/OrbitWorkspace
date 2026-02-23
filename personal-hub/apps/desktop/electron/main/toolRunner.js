const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const { validateToolManifest } = require('../shared/validators');

class ToolRunner {
  constructor(storage, permissionsManager) {
    this.storage = storage;
    this.permissionsManager = permissionsManager;
    this.toolsPath = path.join(__dirname, '../../../../tools');
    this.loadedTools = new Map();
  }

  async initialize() {
    await this.loadTools();
  }

  async loadTools() {
    try {
      const toolDirs = await fs.readdir(this.toolsPath);

      for (const toolDir of toolDirs) {
        const toolPath = path.join(this.toolsPath, toolDir);
        const stat = await fs.stat(toolPath);

        if (stat.isDirectory()) {
          await this.loadTool(toolPath);
        }
      }
    } catch (error) {
      console.error('Error loading tools:', error);
    }
  }

  async loadTool(toolPath) {
    try {
      const manifestPath = path.join(toolPath, 'manifest.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      const validation = validateToolManifest(manifest);
      if (!validation.valid) {
        console.error(`Invalid manifest for tool at ${toolPath}:`, validation.error);
        return;
      }

      // Load service if exists
      const servicePath = path.join(toolPath, 'service', 'index.js');
      let service = null;

      try {
        await fs.access(servicePath);
        service = require(servicePath);
      } catch (error) {
        // Service not required
      }

      this.loadedTools.set(manifest.id, {
        manifest,
        service,
        path: toolPath
      });

      console.log(`Loaded tool: ${manifest.name} (${manifest.id})`);
    } catch (error) {
      console.error(`Error loading tool at ${toolPath}:`, error);
    }
  }

  async listTools() {
    const tools = [];
    const profile = await this.permissionsManager.getProfile();
    if (!profile) return [];
    const isPremium = profile.premiumEnabled;

    for (const [id, tool] of this.loadedTools) {
      const { manifest } = tool;

      // Check if tool requires premium
      const isAccessible = !manifest.premium || isPremium;

      // Check permissions
      const permCheck = await this.permissionsManager.checkPermissions(
        id,
        manifest.permissions || []
      );

      tools.push({
        ...manifest,
        accessible: isAccessible,
        permissionsGranted: permCheck.allowed,
        missingPermissions: permCheck.missingPermissions
      });
    }

    return tools;
  }

  async getTool(toolId) {
    const tool = this.loadedTools.get(toolId);
    if (!tool) {
      return null;
    }

    const profile = await this.permissionsManager.getProfile();
    if (!profile) return null;
    const isPremium = profile.premiumEnabled;
    const isAccessible = !tool.manifest.premium || isPremium;

    const permCheck = await this.permissionsManager.checkPermissions(
      toolId,
      tool.manifest.permissions || []
    );

    return {
      ...tool.manifest,
      accessible: isAccessible,
      permissionsGranted: permCheck.allowed,
      missingPermissions: permCheck.missingPermissions
    };
  }

  async runTool(toolId, action, payload) {
    const tool = this.loadedTools.get(toolId);

    if (!tool) {
      return { success: false, error: 'Tool not found' };
    }

    // Check permissions
    const permCheck = await this.permissionsManager.checkPermissions(
      toolId,
      tool.manifest.permissions || []
    );

    if (!permCheck.allowed) {
      return {
        success: false,
        error: 'Permission denied',
        missingPermissions: permCheck.missingPermissions
      };
    }

    // Check premium
    const isPremium = await this.permissionsManager.isPremium();
    if (tool.manifest.premium && !isPremium) {
      return { success: false, error: 'Premium required' };
    }

    // No logging in v0.x (per user requirements)

    try {
      if (!tool.service) {
        return { success: false, error: 'Tool service not available' };
      }

      const result = await tool.service[action](payload);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  _validateToolId(toolId) {
    // Prevent path traversal: only allow alphanumeric, hyphens, underscores
    return typeof toolId === 'string' && /^[a-zA-Z0-9_-]+$/.test(toolId);
  }

  async getToolConfig(toolId) {
    if (!this._validateToolId(toolId)) return {};

    const configPath = `tools/${toolId}.json`;
    let config = await this.storage.getJson(configPath);

    if (!config) {
      const tool = this.loadedTools.get(toolId);
      if (tool && tool.manifest.defaultConfig) {
        config = tool.manifest.defaultConfig;
        await this.storage.setJson(configPath, config);
      }
    }

    return config || {};
  }

  async setToolConfig(toolId, configPatch) {
    if (!this._validateToolId(toolId)) {
      return { error: 'Invalid tool ID' };
    }

    const configPath = `tools/${toolId}.json`;
    const currentConfig = await this.getToolConfig(toolId);
    const newConfig = { ...currentConfig, ...configPatch };
    await this.storage.setJson(configPath, newConfig);
    return newConfig;
  }
}

module.exports = ToolRunner;
