import * as dotenv from "dotenv";
import LavalinkMusicProvider from "./providers/lavalink/LavalinkMusicProvider";
import Spoticord from "./services/spoticord";
import fs from 'fs';

// Read lavalink configuration file
const lavaConfig = JSON.parse(fs.readFileSync('./lavalink.config.json', 'utf8'));

const _env = dotenv.config().parsed;

console.debug = (...data: any[]) => {
  if (process.env.NODE_ENV !== "development") return;
  console.log(`[DEBUG]`, ...data);
};

if (process.env.NODE_ENV === "development") {
  Object.keys(_env).forEach((k) => {
    console.debug(`[ENV] ${k}=${_env[k]}`);
  });
}

Spoticord.initialize({
  provider: LavalinkMusicProvider,
  providerArgs: [lavaConfig]
});

process.on("SIGINT", () => {
  console.log("[SIGINT] Shutting down...");
  Spoticord.destroy();
  process.exit();
});
