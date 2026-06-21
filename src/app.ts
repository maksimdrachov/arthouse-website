import express from "express";
import session from "express-session";
import nunjucks from "nunjucks";
import path from "node:path";

import { loadCurrentArtist } from "./auth/session.js";
import { env, isProduction } from "./config/env.js";
import privateRoutes from "./routes/private.js";
import publicRoutes from "./routes/public.js";

export const createApp = (): express.Express => {
  const app = express();
  const rootDir = process.cwd();
  const viewsDir = path.join(rootDir, "src/views");

  nunjucks.configure(viewsDir, {
    autoescape: true,
    express: app,
    noCache: !isProduction
  });

  app.set("view engine", "njk");
  app.set("views", viewsDir);
  app.set("trust proxy", isProduction ? 1 : 0);

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(
    session({
      name: "arthouse.sid",
      secret: env.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction
      }
    })
  );
  app.use(loadCurrentArtist);

  app.use("/assets", express.static(path.join(rootDir, "assets")));
  app.use("/uploads", express.static(path.resolve(env.uploadsDir)));
  app.use(express.static(path.join(rootDir, "public")));

  app.use(publicRoutes);
  app.use(privateRoutes);

  app.use((_request, response) => {
    response.status(404).render("pages/not-found.njk", {
      title: "Page not found"
    });
  });

  return app;
};
