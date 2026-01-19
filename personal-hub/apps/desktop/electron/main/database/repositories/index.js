const UserRepository = require('./UserRepository');
const SessionRepository = require('./SessionRepository');
const UserSettingsRepository = require('./UserSettingsRepository');
const WorkspaceRepository = require('./WorkspaceRepository');
const NotesRepository = require('./NotesRepository');
const LinksRepository = require('./LinksRepository');
const FileReferencesRepository = require('./FileReferencesRepository');
const BadgesRepository = require('./BadgesRepository');
const InboxRepository = require('./InboxRepository');

/**
 * Initialize all repositories with database and encryption service
 */
function createRepositories(db, encryptionService) {
  return {
    users: new UserRepository(db),
    sessions: new SessionRepository(db),
    userSettings: new UserSettingsRepository(db, encryptionService),
    workspaces: new WorkspaceRepository(db),
    notes: new NotesRepository(db, encryptionService),
    links: new LinksRepository(db, encryptionService),
    fileReferences: new FileReferencesRepository(db, encryptionService),
    badges: new BadgesRepository(db),
    inbox: new InboxRepository(db, encryptionService)
  };
}

module.exports = { createRepositories };
