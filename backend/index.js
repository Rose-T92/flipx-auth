const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser"); // ← move here

dotenv.config();

const app = express(); // 1️⃣ App must be initialized first

app.use(cookieParser()); // 2️⃣ Cookie parser before session

app.use(express.json()); // 3️⃣ Parse JSON body
app.use(express.urlencoded({ extended: true })); // 4️⃣ Parse form data

app.set("trust proxy", 1); // 5️⃣ For Render or HTTPS

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

app.use(passport.initialize()); // 7️⃣ Init Passport
app.use(passport.session());    // 8️⃣ Use session with Passport


// ✅ CORS
app.use(
  cors({
  origin: ["https://flipx-auth-root.onrender.com", "https://flipxdeals.com"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
  })
);

passport.serializeUser((user, done) => {
  const serializedUser = {
    id: user.id,
    displayName: user.displayName,
    email: user.emails?.[0]?.value || "",     // ✅ works for Google, may be undefined for FB
    photo: user.photos?.[0]?.value || ""
  };
  console.log("✅ Serializing user:", serializedUser);
  done(null, serializedUser);
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
      enableProof: true // ✅ THIS LINE IS REQUIRED
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

app.post("/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account"
  })
);

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/failure" }),
  (req, res) => {
    const redirectTo = req.session.returnTo || "https://flipxdeals.com";
    delete req.session.returnTo;

    req.login(req.user, async (err) => {
      if (err) return res.redirect("/auth/failure");

      const email = req.user?.email;
      if (email) {
        try {
          const searchRes = await fetch(`https://sq1q6i-jm.myshopify.com/admin/api/2024-01/customers/search.json?query=email:${encodeURIComponent(email)}`, {
            headers: {
              "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_KEY,
              "Content-Type": "application/json"
            }
          });

          const { customers } = await searchRes.json();
          const customer = customers?.[0];

          if (customer) {
            // ✅ Customer exists — update tags
            console.log(`🟢 Customer exists: ${customer.email} — Updating tags...`);
            await fetch(`https://sq1q6i-jm.myshopify.com/admin/api/2024-01/customers/${customer.id}.json`, {
              method: "PUT",
              headers: {
                "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_KEY,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                customer: {
                  id: customer.id,
                  tags: "OAuthUser,FlipXAuto"
                }
              })
            });
          } else {
            // ❗ Customer not found — create them
            console.log("🆕 Creating new Shopify customer:", email);
            const createRes = await fetch("https://sq1q6i-jm.myshopify.com/admin/api/2024-01/customers.json", {
              method: "POST",
              headers: {
                "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_KEY,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                customer: {
                  email: email,
                  tags: "OAuthUser,FlipXAuto",
                  verified_email: true,
                  accepts_marketing: true
                }
              })
            });

            const raw = await createRes.text();
            console.log("📥 Shopify customer create raw response:", raw);
            console.log("📦 Shopify status code:", createRes.status);
          }
        } catch (e) {
          console.error("❌ Shopify customer sync failed:", e);
        }
      }

      req.session.save(() => {
        const name = encodeURIComponent(req.user.displayName || "");
        const pic = encodeURIComponent(req.user.photos?.[0]?.value || "");
        const fullRedirect = `${redirectTo}?name=${name}&pic=${pic}`;
        res.redirect(fullRedirect);
      });
    });
  }
);


// Facebook
app.get("/auth/facebook", (req, res, next) => {
  req.session.returnTo = req.query.redirect || "https://flipxdeals.com";
  passport.authenticate("facebook", { scope: ["email"] })(req, res, next);
});
app.post("/auth/facebook",
  passport.authenticate("facebook", { scope: ["email"] })
);
app.get("/auth/facebook/init", (req, res) => {
  const returnTo = req.query.redirect || "https://flipxdeals.com";
  req.session.returnTo = returnTo;
  res.redirect("/auth/facebook");
});
app.get("/auth/facebook/callback",
  passport.authenticate("facebook", { failureRedirect: "/auth/failure" }),
  (req, res) => {
    if (!req.user) {
      console.error("❌ Facebook login failed: No user returned.");
      return res.redirect("/auth/failure");
    }

    const displayName = req.user?.displayName || "Guest";
    const pic = req.user?.photos?.[0]?.value || "https://cdn-icons-png.flaticon.com/512/9131/9131529.png";
    const redirectUrl = req.session.returnTo || "https://flipxdeals.com";

    console.log("✅ Facebook login success");
    console.log("✅ Facebook login redirect to:", redirectUrl);
    console.log("👤 displayName:", displayName);
    console.log("🖼️ profile pic:", pic);

    req.login(req.user, async (err) => {
      if (err) return res.redirect("/auth/failure");

      const email = req.user?.email;
      if (email) {
        try {
          const searchRes = await fetch(`https://sq1q6i-jm.myshopify.com/admin/api/2024-01/customers/search.json?query=email:${encodeURIComponent(email)}`, {
            headers: {
              "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_KEY,
              "Content-Type": "application/json"
            }
          });
          const { customers } = await searchRes.json();
          const customer = customers?.[0];
          if (customer) {
            await fetch(`https://sq1q6i-jm.myshopify.com/admin/api/2024-01/customers/${customer.id}.json`, {
              method: "PUT",
              headers: {
                "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_KEY,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                customer: {
                  id: customer.id,
                  tags: "OAuthUser,FlipXAuto"
                }
              })
            });
          } else {
            await fetch("https://sq1q6i-jm.myshopify.com/admin/api/2024-01/customers.json", {
              method: "POST",
              headers: {
                "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_KEY,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                customer: {
                  email: email,
                  tags: "OAuthUser,FlipXAuto",
                  verified_email: true,
                  accepts_marketing: true
                }
              })
            });
          }
        } catch (e) {
          console.error("❌ Shopify tag update failed:", e);
        }
      }

      req.session.save(() => {
        res.send(`
          <html>
            <head>
              <meta charset="UTF-8" />
              <title>Redirecting...</title>
              <script>
                sessionStorage.setItem("flipxRedirectAfterLogin", "${redirectUrl}");
                window.location.href = "${redirectUrl}?name=${encodeURIComponent(displayName)}&pic=${encodeURIComponent(pic)}";
              </script>
            </head>
            <body><p>Redirecting...</p></body>
          </html>
        `);
      });
    }); // <- closes req.login()
  }      // <- closes app.get()
);

// ✅ Auth State Routes
app.get("/auth/user", (req, res) => {
  console.log("🔐 Session check — req.user:", req.user);
  console.log("📦 Full session:", req.session);
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
