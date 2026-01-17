const fs = require('fs').promises;
const path = require('path');

class JsonLogsStore {
  constructor(userDataPath) {
    this.logsPath = path.join(userDataPath, 'action_logs.json');
    this.logs = [];
    this.maxLogs = 1000; // Garde maximum 1000 logs
  }

  async initialize() {
    try {
      const data = await fs.readFile(this.logsPath, 'utf-8');
      this.logs = JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logs = [];
        await this.save();
      } else {
        console.error('Error loading logs:', error);
      }
    }
  }

  async save() {
    try {
      await fs.writeFile(this.logsPath, JSON.stringify(this.logs, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving logs:', error);
    }
  }

  logAction(event) {
    const logEntry = {
      id: this.logs.length + 1,
      timestamp: event.timestamp || Date.now(),
      type: event.type,
      tool_id: event.toolId || null,
      payload: event.payload ? JSON.stringify(event.payload) : null,
      status: event.status || 'success',
      error: event.error || null
    };

    this.logs.unshift(logEntry); // Ajouter au début

    // Garder seulement les N derniers logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Sauvegarder de manière asynchrone (sans bloquer)
    this.save().catch(err => console.error('Error saving logs:', err));

    return logEntry;
  }

  getActions({ limit = 50, offset = 0, type = null, toolId = null } = {}) {
    let filtered = [...this.logs];

    if (type) {
      filtered = filtered.filter(log => log.type === type);
    }

    if (toolId) {
      filtered = filtered.filter(log => log.tool_id === toolId);
    }

    return filtered.slice(offset, offset + limit);
  }

  searchActions(query) {
    const searchTerm = query.toLowerCase();

    return this.logs
      .filter(log =>
        log.type?.toLowerCase().includes(searchTerm) ||
        log.tool_id?.toLowerCase().includes(searchTerm) ||
        log.payload?.toLowerCase().includes(searchTerm)
      )
      .slice(0, 100);
  }

  close() {
    // Sauvegarder une dernière fois
    return this.save();
  }
}

module.exports = JsonLogsStore;
