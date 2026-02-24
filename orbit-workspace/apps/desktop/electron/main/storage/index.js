const JsonStore = require('./jsonStore');
const JsonLogsStore = require('./jsonLogsStore');

class StorageManager {
  constructor(userDataPath) {
    this.jsonStore = new JsonStore(userDataPath);
    this.logsStore = new JsonLogsStore(userDataPath);
  }

  async initialize() {
    await this.logsStore.initialize();
  }

  // JSON operations
  async getJson(filename) {
    return this.jsonStore.get(filename);
  }

  async setJson(filename, data) {
    return this.jsonStore.set(filename, data);
  }

  async deleteJson(filename) {
    return this.jsonStore.delete(filename);
  }

  async existsJson(filename) {
    return this.jsonStore.exists(filename);
  }

  // Logs operations (JSON-based, no SQLite)
  logAction(event) {
    return this.logsStore.logAction(event);
  }

  getActions(options) {
    return this.logsStore.getActions(options);
  }

  searchActions(query) {
    return this.logsStore.searchActions(query);
  }

  async close() {
    await this.logsStore.close();
  }
}

module.exports = StorageManager;
