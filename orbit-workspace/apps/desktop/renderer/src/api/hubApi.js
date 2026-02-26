// Wrapper around window.hubAPI for easier imports
const hubAPI = window.hubAPI;

if (!hubAPI) {
  console.error('hubAPI is not available. Make sure preload script is loaded.');
}

export default hubAPI;

// Named exports for convenience
export const auth = hubAPI?.auth;
export const profile = hubAPI?.profile;
export const permissions = hubAPI?.permissions;
export const tools = hubAPI?.tools;
export const fs = hubAPI?.fs;
export const system = hubAPI?.system;
export const logs = hubAPI?.logs;
export const workspaces = hubAPI?.workspaces;
export const notes = hubAPI?.notes;
export const links = hubAPI?.links;
export const fileRefs = hubAPI?.fileRefs;
export const badges = hubAPI?.badges;
export const inbox = hubAPI?.inbox;
export const admin = hubAPI?.admin;
export const settings = hubAPI?.settings;
