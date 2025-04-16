import React, { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    console.log("🔄 Checking user session...");

    fetch(`${process.env.REACT_APP_BACKEND_URL}/auth/user`, {
      method: "GET",
      credentials: "include", // ✅ sends cookies
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => {
        console.log("📩 Response status:", res.status);
        console.log("📩 Response headers:", [...res.headers]);
        return res.json();
      })
      .then((data) => {
        console.log("✅ Fetched user data:", data);
        if (data && data.displayName) {
          setUser(data);
        } else {
          console.log("ℹ️ No user session on client");
        }
      })
      .catch((err) => {
        console.error("❌ Auth fetch error:", err);
      });
  }, []);

  const handleGoogleLogin = () => {
    window.location.href = `${process.env.REACT_APP_BACKEND_URL}/auth/google`;
  };

  const handleLogout = () => {
    window.location.href = `${process.env.REACT_APP_BACKEND_URL}/auth/logout`;
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
              }}
            >
              Continue with Google
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
