const fs = require('fs').promises;
const path = require('path');

class JsonStore {
  constructor(userDataPath) {
    this.userDataPath = userDataPath;
  }

  async get(filename) {
    try {
      const filepath = path.join(this.userDataPath, filename);
      const data = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async set(filename, data) {
    const filepath = path.join(this.userDataPath, filename);
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  }

  async delete(filename) {
    try {
      const filepath = path.join(this.userDataPath, filename);
      await fs.unlink(filepath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  async exists(filename) {
    try {
      const filepath = path.join(this.userDataPath, filename);
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = JsonStore;
