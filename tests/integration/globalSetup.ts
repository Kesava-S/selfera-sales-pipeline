import { spawn, type ChildProcess } from 'child_process';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';

// Pre-load environment variables from .env.local and .env.test
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

let serverProcess: ChildProcess | null = null;
const PORT = 3005;
const BASE_URL = `http://localhost:${PORT}`;

async function isServerReady(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/login`, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 307 || res.statusCode === 308);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

export async function setup() {
  const alreadyRunning = await isServerReady();
  if (alreadyRunning) {
    console.log(`[Integration Setup] Server is already running on ${BASE_URL}`);
    return;
  }

  console.log(`[Integration Setup] Starting Next.js test server on ${BASE_URL}...`);
  serverProcess = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
    stdio: 'ignore',
    detached: true,
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'development' },
  });

  const startTime = Date.now();
  while (Date.now() - startTime < 20000) {
    await new Promise((r) => setTimeout(r, 300));
    if (await isServerReady()) {
      console.log(`[Integration Setup] Test server is ready in ${Date.now() - startTime}ms.`);
      return;
    }
  }

  throw new Error(`Timeout waiting for Next.js test server on ${BASE_URL}`);
}

export async function teardown() {
  if (serverProcess && serverProcess.pid) {
    console.log('[Integration Teardown] Stopping test server...');
    try {
      process.kill(-serverProcess.pid);
    } catch {
      serverProcess.kill();
    }
  }
}
