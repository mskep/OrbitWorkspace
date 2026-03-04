import React, { useEffect, useState } from 'react';
import AppRoutes from './routes';
import TitleBar from '../components/TitleBar';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAppStore } from '../state/store';
import hubAPI from '../api/hubApi';

function App() {
  const { setSession, setProfile, setOnline, setUserSettings, userSettings } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initialize() {
      try {
        // Check session on mount
        const session = await hubAPI.auth.getSession();
        setSession(session);

        if (session) {
          const [profile, settingsRes] = await Promise.all([hubAPI.profile.get(), hubAPI.settings?.get?.()]);
          if (profile) setProfile(profile);
          if (settingsRes?.success && settingsRes.settings) {
            setUserSettings(settingsRes.settings);
          }
        }

        // Get initial online status
        const status = await hubAPI.system?.getStatus?.();
        setOnline(status?.online ?? false);

        // Listen to online status
        if (hubAPI.system) {
          hubAPI.system.onOnlineStatus((onlineStatus) => {
            setOnline(onlineStatus);
          });
        }
      } catch (error) {
        console.error('Error initializing app:', error);
      } finally {
        // Small delay for smooth transition
        setTimeout(() => setIsLoading(false), 500);
      }
    }

    initialize();
  }, [setSession, setProfile, setOnline, setUserSettings]);

  useEffect(() => {
    const lang = userSettings?.language || 'en';
    document.documentElement.setAttribute('lang', lang);
  }, [userSettings?.language]);

  useEffect(() => {
    const theme = userSettings?.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }, [userSettings?.theme]);

  if (isLoading) {
    return <LoadingSpinner fullscreen />;
  }

  return (
    <>
      <TitleBar />
      <AppRoutes />
    </>
  );
}

export default App;
