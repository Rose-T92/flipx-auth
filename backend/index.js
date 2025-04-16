const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const path = require("path");
const fs = require("fs");

dotenv.config();
const app = express();

// ✅ Set trust proxy for Render (enables secure cookies)
app.set("trust proxy", 1);

// ✅ Session config (must come before CORS)
app.use(
  session({
    name: "flipx-session",
    secret: "flipxsecret",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// ✅ CORS setup (after session)
app.use(
  cors({
    origin: "https://flipx-auth-root.onrender.com",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// ✅ Passport setup
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  console.log("✅ Serializing user:", user.displayName);
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  console.log("✅ Deserializing user:", obj.displayName);
  done(null, obj);
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "https://flipx-auth-root.onrender.com/auth/google/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      console.log("✅ Google Profile:", profile.displayName);
      return done(null, profile);
    }
  )
);

// ✅ Routes
app.get("/", (req, res) => {
  res.send("✅ FlipXDeals Auth Server Running!");
});

app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/failure" }),
  (req, res) => {
    req.login(req.user, (err) => {
      if (err) {
        console.error("❌ Login error:", err);
        return res.redirect("/auth/failure");
      }
      req.session.save(() => {
        res.redirect("https://flipx-auth-root.onrender.com");
      });
    });
  }
);

app.get("/auth/user", (req, res) => {
  console.log("🔐 Session check — req.user:", req.user);
  res.json(req.user || null);
});

app.get("/auth/logout", (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid", {
        path: "/",
        sameSite: "none",
        secure: true,
      });
      res.redirect("https://flipx-auth-root.onrender.com");
    });
  });
});

app.get("/auth/failure", (req, res) => {
  res.status(401).send("Login failed. Please try again.");
});

// 🔍 Cookie debug route
app.get("/debug", (req, res) => {
  res.json({
    cookies: req.headers.cookie || "no cookie",
    session: req.session,
    user: req.user,
  });
});

// 🔎 Verbose session dump
app.get("/session-debug", (req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.send(`
===== SESSION DEBUG =====
COOKIES:
${req.headers.cookie || "None"}

SESSION:
${JSON.stringify(req.session, null, 2)}

USER:
${JSON.stringify(req.user, null, 2)}
  `);
});

// ✅ Conditionally serve frontend if built
const frontendPath = path.join(__dirname, "../frontend/build");
const indexHtmlPath = path.join(frontendPath, "index.html");

if (fs.existsSync(indexHtmlPath)) {
  app.use(express.static(frontendPath));
  app.get("*", (req, res) => {
    res.sendFile(indexHtmlPath);
  });
} else {
  console.warn("⚠️ Frontend build not found. Skipping static file serving.");
}

// ✅ Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Auth server running on port ${PORT}`);
});
