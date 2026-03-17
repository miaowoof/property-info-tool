import { useState } from "react";

const PASSWORD = import.meta.env.VITE_APP_PASSWORD || "vtv2024";

export default function PasswordGate({ children }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [unlocked, setUnlocked] = useState(() => {
    return sessionStorage.getItem("vtv_auth") === "true";
  });

  if (unlocked) return children;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input === PASSWORD) {
      sessionStorage.setItem("vtv_auth", "true");
      setUnlocked(true);
    } else {
      setError(true);
      setInput("");
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="password-gate">
      <div className="password-card">
        <div className="password-logo">
          <span className="logo-icon" style={{ fontSize: 40 }}>◈</span>
          <h1 className="logo-text" style={{ fontSize: 28, marginTop: 12 }}>Vacant to Vibrant</h1>
          <p className="logo-sub" style={{ marginTop: 4 }}>San Francisco Property Intelligence</p>
        </div>
        <form onSubmit={handleSubmit} className="password-form">
          <input
            className={`manual-owner-input ${error ? "input-error" : ""}`}
            type="password"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Enter password…"
            autoFocus
            style={{ fontSize: 15, padding: "12px 16px" }}
          />
          {error && <p className="password-error">Incorrect password</p>}
          <button
            className="search-btn"
            type="submit"
            disabled={!input}
            style={{ width: "100%", padding: "12px", borderRadius: 8, fontSize: 14, marginTop: 4 }}
          >
            Enter →
          </button>
        </form>
        <p className="password-hint">Contact your admin for access</p>
      </div>
    </div>
  );
}
