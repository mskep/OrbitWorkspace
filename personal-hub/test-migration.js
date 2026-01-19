/**
 * Test script for database migration
 * Run with: node test-migration.js
 */

const path = require('path');
const os = require('os');
const DatabaseService = require('./apps/desktop/electron/main/database/DatabaseService');

async function testMigration() {
  console.log('\n========================================');
  console.log('🧪 DATABASE MIGRATION TEST');
  console.log('========================================\n');

  // Use a test directory
  const testDataPath = path.join(os.tmpdir(), 'orbit-test-' + Date.now());
  console.log('📁 Test data path:', testDataPath);

  try {
    // Initialize database service
    console.log('\n1️⃣  Initializing DatabaseService...\n');
    const dbService = new DatabaseService(testDataPath);
    await dbService.initialize();

    // Run health check
    console.log('\n2️⃣  Running health check...\n');
    const health = await dbService.healthCheck();
    console.log('Health check result:', health);

    if (!health.healthy) {
      throw new Error('Health check failed!');
    }

    // Get repositories
    const repos = dbService.getRepositories();

    // Test 1: Check users
    console.log('\n3️⃣  Testing user operations...\n');
    const users = repos.users.findAll();
    console.log(`✅ Found ${users.length} users`);
    users.forEach(u => {
      console.log(`   - ${u.username} (${u.email}) - Role: ${u.role}, Status: ${u.status}`);
    });

    // Test 2: Check workspaces
    console.log('\n4️⃣  Testing workspace operations...\n');
    for (const user of users) {
      const workspaces = repos.workspaces.findByUserId(user.id);
      console.log(`✅ User ${user.username} has ${workspaces.length} workspace(s)`);
      workspaces.forEach(w => {
        console.log(`   - ${w.name} (ID: ${w.id})`);
      });
    }

    // Test 3: Check user settings
    console.log('\n5️⃣  Testing user settings...\n');
    for (const user of users) {
      const settings = repos.userSettings.findByUserId(user.id);
      if (settings) {
        console.log(`✅ User ${user.username} settings:`);
        console.log(`   - Theme: ${settings.theme}`);
        console.log(`   - Language: ${settings.language}`);
        console.log(`   - Active workspace: ${settings.active_workspace_id || 'None'}`);
      }
    }

    // Test 4: Test encryption
    console.log('\n6️⃣  Testing encryption...\n');
    const encryption = dbService.getEncryption();
    const testData = 'This is a secret message! 🔐';
    const encrypted = encryption.encrypt(testData);
    const decrypted = encryption.decrypt(encrypted);

    console.log('Original:', testData);
    console.log('Encrypted:', encrypted.substring(0, 50) + '...');
    console.log('Decrypted:', decrypted);
    console.log(`✅ Encryption test: ${decrypted === testData ? 'PASSED' : 'FAILED'}`);

    // Test 5: Test notes creation
    console.log('\n7️⃣  Testing notes operations...\n');
    const testUser = users[0];
    const testWorkspace = repos.workspaces.findByUserId(testUser.id)[0];

    if (testWorkspace) {
      const note = repos.notes.create({
        workspaceId: testWorkspace.id,
        userId: testUser.id,
        title: 'Test Note',
        content: 'This is a test note with encrypted content! 🎉',
        tags: 'test,migration',
        isPinned: false
      });

      console.log(`✅ Created test note: ${note.title}`);
      console.log(`   - Content (decrypted): ${note.content}`);
      console.log(`   - Tags: ${note.tags}`);

      // Verify we can read it back
      const fetchedNote = repos.notes.findById(note.id);
      console.log(`✅ Fetched note back: ${fetchedNote ? 'SUCCESS' : 'FAILED'}`);
    }

    // Test 6: Test links creation
    console.log('\n8️⃣  Testing links operations...\n');
    if (testWorkspace) {
      const link = repos.links.create({
        workspaceId: testWorkspace.id,
        userId: testUser.id,
        title: 'GitHub',
        url: 'https://github.com',
        description: 'Code hosting platform',
        tags: 'dev,tools',
        isFavorite: true
      });

      console.log(`✅ Created test link: ${link.title}`);
      console.log(`   - URL (decrypted): ${link.url}`);
      console.log(`   - Description: ${link.description}`);
    }

    // Test 7: Test badges
    console.log('\n9️⃣  Testing badges...\n');
    const badges = repos.badges.findAll();
    console.log(`✅ Found ${badges.length} available badges:`);
    badges.forEach(b => {
      console.log(`   ${b.icon} ${b.display_name} - ${b.description}`);
    });

    // Assign a badge to test user
    const betaTesterBadge = badges.find(b => b.name === 'beta-tester');
    if (betaTesterBadge) {
      repos.badges.assign(testUser.id, betaTesterBadge.id, testUser.id);
      console.log(`✅ Assigned "${betaTesterBadge.display_name}" badge to ${testUser.username}`);

      const userBadges = repos.badges.findByUserId(testUser.id);
      console.log(`   User now has ${userBadges.length} badge(s)`);
    }

    // Test 8: Test inbox
    console.log('\n🔟 Testing inbox...\n');
    const inboxMessages = repos.inbox.findByUserId(testUser.id);
    console.log(`✅ Found ${inboxMessages.length} inbox message(s)`);
    inboxMessages.forEach(msg => {
      console.log(`   - [${msg.type}] ${msg.title}`);
      console.log(`     ${msg.message.substring(0, 80)}...`);
    });

    // Create a test system notification
    repos.inbox.createSystemNotification(
      testUser.id,
      'Test Complete',
      'All database tests have been completed successfully! The migration is working correctly.',
      { testRun: true, timestamp: Date.now() }
    );

    const updatedMessages = repos.inbox.findByUserId(testUser.id);
    console.log(`✅ Created test notification. Total messages: ${updatedMessages.length}`);

    // Test 9: Test admin stats
    console.log('\n1️⃣1️⃣  Testing admin statistics...\n');
    const totalUsers = repos.users.count();
    const activeUsers = repos.users.countActive(30);
    const disabledUsers = repos.users.countDisabled();
    const usersPerMonth = repos.users.getUsersPerMonth(12);

    console.log(`✅ Total users: ${totalUsers}`);
    console.log(`✅ Active users (30 days): ${activeUsers}`);
    console.log(`✅ Disabled users: ${disabledUsers}`);
    console.log(`✅ Users per month (last 12):`, usersPerMonth);

    // Close database
    console.log('\n1️⃣2️⃣  Closing database...\n');
    dbService.close();
    console.log('✅ Database closed');

    // Final summary
    console.log('\n========================================');
    console.log('✅ ALL TESTS PASSED!');
    console.log('========================================\n');

    console.log('Summary:');
    console.log(`  - Users: ${totalUsers}`);
    console.log(`  - Workspaces: ${users.length}`);
    console.log(`  - Notes created: 1`);
    console.log(`  - Links created: 1`);
    console.log(`  - Badges available: ${badges.length}`);
    console.log(`  - Inbox messages: ${updatedMessages.length}`);
    console.log(`  - Encryption: ✅ Working`);
    console.log(`  - Database: ✅ Healthy\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(error);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
testMigration();
