import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { processMutationQueue } from "@/utils/mutation-queue";

interface NetworkContextValue {
  isOnline: boolean;
  // True while the mutation queue is being replayed after a reconnect.
  isSyncing: boolean;
  registerReconnectCallback: (key: string, fn: () => void) => void;
  unregisterReconnectCallback: (key: string) => void;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Incrementing this counter triggers the reconnect useEffect after React commits
  // the isOnline=true state, so all consuming contexts see the updated value before
  // reconnect callbacks run.
  const [reconnectTrigger, setReconnectTrigger] = useState(0);

  const wasOnlineRef = useRef(true);
  const reconnectCallbacks = useRef<Record<string, () => void>>({});

  const registerReconnectCallback = useCallback((key: string, fn: () => void) => {
    reconnectCallbacks.current[key] = fn;
  }, []);

  const unregisterReconnectCallback = useCallback((key: string) => {
    delete reconnectCallbacks.current[key];
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      // Treat null (unknown) as online; only treat explicit false as offline.
      // isInternetReachable is excluded because it produces false negatives on
      // Android emulators and devices behind proxies.
      const online = state.isConnected !== false;
      setIsOnline(online);

      if (online && !wasOnlineRef.current) {
        // Incrementing the trigger defers the reconnect handler to a useEffect,
        // which runs after React commits this render. By that point all child
        // contexts have updated their own isOnlineRef values.
        setReconnectTrigger((t) => t + 1);
      }

      wasOnlineRef.current = online;
    });

    return unsubscribe;
  }, []);

  // Reconnect handler: runs after React commits isOnline=true so child contexts
  // see the correct value. Awaits the mutation queue before firing callbacks so
  // refetched data reflects any queued writes.
  useEffect(() => {
    if (reconnectTrigger === 0) return;

    const doSync = async () => {
      setIsSyncing(true);
      try {
        await processMutationQueue();
      } finally {
        setIsSyncing(false);
        Object.values(reconnectCallbacks.current).forEach((fn) => fn());
      }
    };

    doSync();
  }, [reconnectTrigger]);

  return (
    <NetworkContext.Provider
      value={{ isOnline, isSyncing, registerReconnectCallback, unregisterReconnectCallback }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork must be used within NetworkProvider");
  return ctx;
}
