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

// ✅ Enable secure cookies behind proxy (e.g., Render)
app.set("trust proxy", 1);

// ✅ Session setup
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

// ✅ CORS configuration
app.use(
  cors({
    origin: "https://flipx-auth-root.onrender.com",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// ✅ Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// ✅ Passport serialization
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// ✅ Google Strategy
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

// ✅ API Routes
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

// ✅ Debug Routes
app.get("/debug", (req, res) => {
  res.json({
    cookies: req.headers.cookie || "no cookie",
    session: req.session,
    user: req.user,
  });
});

app.get("/session-debug", (req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.send(`===== SESSION DEBUG =====
COOKIES:
${req.headers.cookie || "None"}

SESSION:
${JSON.stringify(req.session, null, 2)}

USER:
${JSON.stringify(req.user, null, 2)}
  `);
});

// ✅ Serve React frontend
const frontendPath = path.join(__dirname, "../frontend/build");
if (fs.existsSync(path.join(frontendPath, "index.html"))) {
  app.use(express.static(frontendPath));
  app.get(/^\/(?!auth\/).*/, (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
} else {
  console.warn("⚠️ Frontend build not found. Skipping static file serving.");
}

// ✅ Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Auth server running on port ${PORT}`);
});
