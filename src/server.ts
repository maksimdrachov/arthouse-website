import "dotenv/config";

import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

app.listen(env.port, () => {
  console.log(`ArtHouse server listening on http://localhost:${env.port}`);
});
