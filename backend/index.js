const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const path = require("path");
const fs = require("fs");

dotenv.config();
const app = express();

// ✅ Trust proxy (for secure cookies on Render)
app.set("trust proxy", 1);

// ✅ Session middleware
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

// ✅ CORS
app.use(
  cors({
  origin: ["https://flipx-auth-root.onrender.com", "https://flipxdeals.com"],
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

// ✅ Google OAuth
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

// ✅ Facebook OAuth
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: "https://flipx-auth-root.onrender.com/auth/facebook/callback",
      profileFields: ["id", "displayName", "photos", "email"],
    },
    (accessToken, refreshToken, profile, done) => {
      console.log("✅ Facebook Profile:", profile.displayName);
      return done(null, profile);
    }
  )
);

// Google
// NEW secure redirect that avoids sending redirect=... directly to Google
app.get("/auth/google/init", (req, res) => {
  const returnTo = req.query.redirect || "https://flipxdeals.com";
  req.session.returnTo = returnTo;
  res.redirect("/auth/google");
});

// 🔐 Begin Google OAuth flow
app.get("/auth/google", (req, res, next) => {
  const stored = req.session.returnTo || "https://flipxdeals.com";
  req.session.returnTo = stored;
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account"
  })(req, res, next);
});

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/failure" }),
  (req, res) => {
    const redirectTo = req.session.returnTo || "https://flipxdeals.com";
    delete req.session.returnTo;
    req.login(req.user, (err) => {
      if (err) return res.redirect("/auth/failure");
      req.session.save(() => {
        res.redirect(redirectTo);
      });
    });
  }
);

// Facebook
app.get("/auth/facebook", (req, res, next) => {
  req.session.returnTo = req.query.redirect || "https://flipxdeals.com";
  passport.authenticate("facebook", { scope: ["email"] })(req, res, next);
});

app.get("/auth/facebook/callback",
  passport.authenticate("facebook", { failureRedirect: "/auth/failure" }),
  (req, res) => {
    const redirectTo = req.session.returnTo || "https://flipxdeals.com";
    delete req.session.returnTo;
    req.login(req.user, (err) => {
      if (err) return res.redirect("/auth/failure");
      req.session.save(() => {
        res.redirect(redirectTo);
      });
    });
  }
);

// ✅ Auth State Routes
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

// 🔎 Debug Routes
app.get("/debug", (req, res) => {
  res.json({
    cookies: req.headers.cookie || "no cookie",
    session: req.session,
    user: req.user,
  });
});

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

// ✅ Serve frontend if built
const frontendPath = path.join(__dirname, "../frontend/build");
const indexHtmlPath = path.join(frontendPath, "index.html");

if (fs.existsSync(indexHtmlPath)) {
  app.use(express.static(frontendPath));
  app.get(/^\/(?!auth\/).*/, (req, res) => {
    res.sendFile(indexHtmlPath);
  });
} else {
  console.warn("⚠️ Frontend build not found. Skipping static file serving.");
  app.get("/", (req, res) => {
    res.send("✅ FlipXDeals Auth Server Running!");
  });
}

// ✅ Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Auth server running on port ${PORT}`);
});
