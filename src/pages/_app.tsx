import "@/client/styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect } from 'react';
import { AuthProvider } from "@/client/context/AuthContext";
import { SettingsProvider } from "@/client/settings/SettingsContext";
import { useSettings } from "@/client/settings/SettingsContext";
import { initializeApiClient } from "@/client/utils/apiClient";
import { AppThemeProvider } from "@/client/components/ThemeProvider";
import dynamic from 'next/dynamic';
import { routes } from '@/client/routes';
import { Layout } from '@/client/components/Layout';

const AuthWrapper = dynamic(() => import('@/client/components/auth/AuthWrapper'), { ssr: false });
const RouterProvider = dynamic(() => import('@/client/router/index').then(module => module.RouterProvider), { ssr: false });

export default function App({ }: AppProps) {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // noop
      });
    }
  }, []);

  return (
    <AuthProvider>
      <SettingsProvider>
        <ApiClientInitializer />
        <AppThemeProvider>
          <AuthWrapper>
            <RouterProvider routes={routes}>
              {RouteComponent => <Layout><RouteComponent /></Layout>}
            </RouterProvider>
          </AuthWrapper>
        </AppThemeProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

function ApiClientInitializer() {
  const { settings } = useSettings();
  useEffect(() => {
    initializeApiClient(() => settings);
  }, [settings]);
  return null;
}
