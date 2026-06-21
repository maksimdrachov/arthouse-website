import { Router } from "express";

const router = Router();

router.get("/", (_request, response) => {
  response.render("pages/home.njk", {
    title: "ArtHouse",
    publicRoutes: [
      { href: "/", label: "Home" },
      { href: "/artists/example-artist", label: "Artist page" },
      { href: "/products/example-item", label: "Product page" },
      { href: "/reserve/example-item", label: "Reserve page" }
    ],
    privateRoutes: [
      { href: "/register", label: "Registration" },
      { href: "/login", label: "Login" },
      { href: "/dashboard", label: "Artist dashboard" },
      { href: "/admin", label: "Admin" }
    ]
  });
});

router.get("/artists/:artistSlug", (request, response) => {
  response.render("pages/placeholder.njk", {
    title: "Artist page",
    heading: "Artist page",
    detail: `Placeholder for artist store: ${request.params.artistSlug}`
  });
});

router.get("/products/:productId", (request, response) => {
  response.render("pages/placeholder.njk", {
    title: "Product page",
    heading: "Product page",
    detail: `Placeholder for product: ${request.params.productId}`
  });
});

router.get("/reserve/:itemId", (request, response) => {
  response.render("pages/placeholder.njk", {
    title: "Reserve item",
    heading: "Reserve item",
    detail: `Placeholder for reservation flow: ${request.params.itemId}`
  });
});

export default router;
