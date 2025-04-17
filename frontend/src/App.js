import React, { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const BACKEND_URL = "https://flipx-auth-root.onrender.com";

  useEffect(() => {
    console.log("🔄 Checking user session...");

    fetch(`${BACKEND_URL}/auth/user`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => {
        console.log("📩 Response status:", res.status);
        return res.json();
      })
      .then((data) => {
        if (data && data.displayName) {
          console.log("✅ Logged in as:", data.displayName);
          setUser(data);
        } else {
          console.log("ℹ️ No user session found.");
        }
      })
      .catch((err) => {
        console.error("❌ Auth fetch error:", err);
      });
  }, []);

  const handleGoogleLogin = () => {
    window.location.href = `${BACKEND_URL}/auth/google/init?redirect=${encodeURIComponent(window.location.href)}`;
  };


  const handleFacebookLogin = () => {
    window.location.href = `${BACKEND_URL}/auth/facebook?redirect=${encodeURIComponent(window.location.href)}`;
  };

  const handleLogout = () => {
    window.location.href = `${BACKEND_URL}/auth/logout`;
  };

  return (
    <div
      className="auth-wrapper"
      style={{
        background: "#f6f6f6",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="login-box"
        style={{
          background: "#fff",
          padding: "2rem",
          borderRadius: "16px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
          textAlign: "center",
          maxWidth: "400px",
          width: "100%",
        }}
      >
        <h2>Welcome to FlipXDeals</h2>
        {user ? (
          <>
            <p>
              Logged in as <strong>{user.displayName}</strong>
            </p>
            <button onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <p>Sign in or sign up to continue</p>

            <button
              onClick={handleGoogleLogin}
              style={{
                background: "#4285F4",
                color: "#fff",
                padding: "0.75rem 1.5rem",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "16px",
                marginBottom: "10px",
              }}
            >
              Continue with Google
            </button>

            <br />

            <button
              onClick={handleFacebookLogin}
              style={{
                background: "#3b5998",
                color: "#fff",
                padding: "0.75rem 1.5rem",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              Continue with Facebook
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
