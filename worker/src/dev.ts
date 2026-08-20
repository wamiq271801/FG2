import worker from "./index.ts";

const PORT = 8787;

const server = Bun.serve({
  port: PORT,
  fetch: (req: Request) => worker.fetch(req),
});

console.log(`Worker (Bun dev) listening on :${server.port}`);
