import { setTimeout as sleep } from "node:timers/promises";
import { freePort } from "./free-port.mjs";

/**
 * Bind `server` to `port`, stopping any previous listener on that port first.
 */
export async function listenOnPort(server, port, label) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const killed = freePort(port);
    if (killed.length > 0) {
      console.log(`${label}: stopped previous server on port ${port} (pid ${killed.join(", ")})`);
      await sleep(200);
    }

    try {
      await new Promise((resolve, reject) => {
        const onError = (err) => {
          server.off("listening", onListening);
          reject(err);
        };
        const onListening = () => {
          server.off("error", onError);
          resolve();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port);
      });
      return;
    } catch (err) {
      if (err.code !== "EADDRINUSE" || attempt === 1) {
        if (err.code === "EADDRINUSE") {
          console.error(`${label}: port ${port} is still in use.`);
          console.error(`  Try another port: PORT=${port + 1} npm run ${label === "preview" ? "preview" : "dev"}`);
        }
        throw err;
      }
    }
  }
}
