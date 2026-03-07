import { useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import LandingLogin from "./auth/LandingLogin";
import Canvas from "./flow/canvas/Canvas";
import {
  clearSession,
  consumeSessionFromUrlHash,
  getStoredSession,
  type AuthSession,
} from "./lib/auth";

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(() => {
    const callbackSession = consumeSessionFromUrlHash();
    if (callbackSession) return callbackSession;
    return getStoredSession();
  });

  if (session) {
    return (
      <ReactFlowProvider>
        <Canvas
          onLogout={() => {
            clearSession();
            setSession(null);
          }}
        />
      </ReactFlowProvider>
    );
  }

  return (
    <LandingLogin
      onSuccess={(nextSession) => {
        if (!nextSession.accessToken) {
          clearSession();
          return;
        }
        setSession(nextSession);
      }}
    />
  );
}
