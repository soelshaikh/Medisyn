import * as dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { createApp } from './app';

const PORT = process.env.PORT ?? 3001;
const app = createApp();
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Vtech-Med API running on http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received — shutting down`);
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});
