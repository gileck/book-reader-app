import "@/client/styles/globals.css";
import type { AppProps } from "next/app";
import { AuthProvider } from "@/client/context/AuthContext";
import AuthWrapper from "@/client/components/auth/AuthWrapper";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <AuthWrapper>
        <Component {...pageProps} />
      </AuthWrapper>
    </AuthProvider>
  );
}
