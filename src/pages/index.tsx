import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { Layout } from '../client/components/Layout';
import dynamic from 'next/dynamic';
import { SettingsProvider } from '../client/settings/SettingsContext';
import { routes } from '../client/routes';

const RouterProvider = dynamic(() => import('../client/router/index').then(module => module.RouterProvider), { ssr: false });

// Create theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SettingsProvider>
        <RouterProvider routes={routes}>
          {Component => <Layout><Component /></Layout>}
        </RouterProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
