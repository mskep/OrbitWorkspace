import React, { useEffect, useState } from 'react';
import AppRoutes from './routes';
import TitleBar from '../components/TitleBar';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAppStore } from '../state/store';
import hubAPI from '../api/hubApi';

function App() {
  const { setSession, setProfile, setOnline } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initialize() {
      try {
        // Check session on mount
        const session = await hubAPI.auth.getSession();
        setSession(session);

        if (session) {
          const profile = await hubAPI.profile.get();
          setProfile(profile);
        }

        // Get initial online status
        const status = await hubAPI.system?.getStatus?.();
        setOnline(status?.online ?? false);

        // Listen to online status
        if (hubAPI.system) {
          hubAPI.system.onOnlineStatus((status) => {
            setOnline(status);
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
  }, [setSession, setProfile, setOnline]);

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
