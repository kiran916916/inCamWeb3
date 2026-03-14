"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useAccount, useSignMessage, useDisconnect } from "wagmi";
import { SiweMessage } from "siwe";
import { api } from "@/lib/api";

interface AuthUser {
  id: string;
  walletAddress: string;
  username: string | null;
  role: "VIEWER" | "CREATOR" | "MODERATOR" | "ADMIN";
  level: number;
  xp: number;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const signIn = useCallback(async () => {
    if (!address || !isConnected) return;

    setIsLoading(true);
    try {
      // 1. Get a nonce from the server
      const { nonce } = await api.get<{ nonce: string }>("/auth/nonce").then((r) => r.data);

      // 2. Build the SIWE message
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to InCam Web3 Platform. This request will not trigger a blockchain transaction or cost any gas fees.",
        uri: window.location.origin,
        version: "1",
        chainId: chainId ?? 137,
        nonce,
        expirationTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min
      });

      const preparedMessage = message.prepareMessage();

      // 3. Sign the message (no private key transmitted)
      const signature = await signMessageAsync({ message: preparedMessage });

      // 4. Verify on server, receive JWT in httpOnly cookie
      const { user: authUser } = await api
        .post<{ user: AuthUser }>("/auth/verify", { message: preparedMessage, signature })
        .then((r) => r.data);

      setUser(authUser);
    } catch (error) {
      console.error("SIWE sign-in failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected, chainId, signMessageAsync]);

  const signOut = useCallback(async () => {
    try {
      await api.post("/auth/logout");
      setUser(null);
      disconnect();
    } catch (error) {
      console.error("Sign-out error:", error);
    }
  }, [disconnect]);

  // Auto-fetch user on load if session cookie exists
  useEffect(() => {
    api.get<{ user: AuthUser }>("/auth/me")
      .then((r) => setUser(r.data.user))
      .catch(() => setUser(null));
  }, []);

  // Sign out if wallet disconnects
  useEffect(() => {
    if (!isConnected && user) {
      setUser(null);
    }
  }, [isConnected, user]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
