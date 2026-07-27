"use client";

import { useState, useEffect } from "react";
import { readStoredSession } from "@/lib/auth-storage";

export default function Home() {
  const [status, setStatus] = useState("loading...");
  const [token, setToken] = useState("");

  useEffect(() => {
    try {
      const session = readStoredSession();
      if (session?.user) {
        setStatus("✅ Přihlášen jako: " + (session.user.email || session.user.id));
        setToken("Token délka: " + JSON.stringify(session).length + " znaků");
      } else {
        setStatus("❌ Nepřihlášen — žádný token v localStorage");
      }
    } catch(e) {
      setStatus("💥 Chyba: " + e);
    }
  }, []);

  return (
    <div style={{ padding: "2rem", fontFamily: "monospace", background: "#0f0f23", minHeight: "100vh", color: "#a5b4fc" }}>
      <h1>Diarium — test</h1>
      <p>{status}</p>
      <p>{token}</p>
    </div>
  );
}
