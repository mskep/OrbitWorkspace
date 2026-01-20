/**
 * One-time script to clean up corrupted notes from database
 * Run this with: node cleanupCorruptedNotes.js
 */

const path = require('path');
const { app } = require('electron');
const DatabaseService = require('./main/database/DatabaseService');

async function cleanup() {
  try {
    // Get userData path
    const userDataPath = process.env.USERDATA_PATH || path.join(__dirname, '../../userData');
    console.log('Using userData path:', userDataPath);

    // Initialize database service
    const dbService = new DatabaseService(userDataPath);
    await dbService.initialize();

    console.log('\n🧹 Starting corrupted data cleanup...\n');

    // Run cleanup
    dbService.cleanupCorruptedData();

    console.log('\n✅ Cleanup completed!');

    // Close database
    dbService.close();

    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanup();
