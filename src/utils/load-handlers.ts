import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Dynamically loads all handler classes from the dist/handlers directory
 */
export async function loadHandlers() {
  const handlers: any[] = [];
  const handlersDir = path.join(__dirname, "..", "handlers");

  if (!fs.existsSync(handlersDir)) {
    console.warn(`⚠️ Handlers directory not found: ${handlersDir}`);
    return handlers;
  }

  const files = fs.readdirSync(handlersDir).filter((f) => f.endsWith(".js"));

  for (const file of files) {
    const modulePath = path.join(handlersDir, file);
    const mod = await import(pathToFileURL(modulePath).href);

    // Assume first exported class is the handler
    const HandlerClass = Object.values(mod)[0] as any;
    if (typeof HandlerClass === "function") {
      handlers.push(new HandlerClass());
    }
  }

  console.log(`✅ Loaded ${handlers.length} handler(s)`);
  return handlers;
}
