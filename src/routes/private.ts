import { Router } from "express";

const router = Router();

router.get("/register", (_request, response) => {
  response.render("pages/placeholder.njk", {
    title: "Artist registration",
    heading: "Artist registration",
    detail: "Registration-code flow will be implemented here."
  });
});

router.get("/login", (_request, response) => {
  response.render("pages/placeholder.njk", {
    title: "Login",
    heading: "Login",
    detail: "Artist/admin login will be implemented here."
  });
});

router.get("/dashboard", (_request, response) => {
  response.render("pages/placeholder.njk", {
    title: "Artist dashboard",
    heading: "Artist dashboard",
    detail: "Item management and profile editing will be implemented here."
  });
});

router.get("/admin", (_request, response) => {
  response.render("pages/placeholder.njk", {
    title: "Admin",
    heading: "Admin",
    detail: "Registration-code generation and reporting will be implemented here."
  });
});

export default router;
