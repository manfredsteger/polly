#!/usr/bin/env npx tsx
import http from 'http';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const MAX_RETRIES = 30;
const RETRY_DELAY_MS = 2000;

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  duration: number;
}

async function makeRequest(
  path: string,
  options: {
    method?: string;
    body?: object;
    headers?: Record<string, string>;
    cookie?: string;
  } = {}
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  const url = new URL(path, BASE_URL);
  
  return new Promise((resolve, reject) => {
    const reqOptions: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };
    
    if (options.cookie) {
      (reqOptions.headers as Record<string, string>)['Cookie'] = options.cookie;
    }
    
    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let body;
        try {
          body = JSON.parse(data);
        } catch {
          body = data;
        }
        resolve({ status: res.statusCode || 0, body, headers: res.headers });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => reject(new Error('Request timeout')));
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function waitForServer(): Promise<boolean> {
  console.log(`⏳ Waiting for server at ${BASE_URL}...`);
  
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const { status } = await makeRequest('/api/health');
      if (status === 200) {
        console.log('✅ Server is ready');
        return true;
      }
    } catch (e) {
    }
    
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
  }
  
  return false;
}

async function testHealthEndpoint(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { status, body } = await makeRequest('/api/health');
    
    if (status !== 200) {
      return { name: 'Health Check', success: false, error: `Status ${status}`, duration: Date.now() - start };
    }
    
    return { name: 'Health Check', success: true, duration: Date.now() - start };
  } catch (e) {
    return { name: 'Health Check', success: false, error: String(e), duration: Date.now() - start };
  }
}

async function testLoginFlow(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { status, body, headers } = await makeRequest('/api/v1/login', {
      method: 'POST',
      body: { username: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    
    if (status === 401) {
      return { 
        name: 'Login Flow', 
        success: false, 
        error: 'Invalid credentials (401) - check ADMIN_EMAIL and ADMIN_PASSWORD', 
        duration: Date.now() - start 
      };
    }
    
    if (status === 500) {
      return { 
        name: 'Login Flow', 
        success: false, 
        error: 'Server error (500) - likely database schema issue, run migrations!', 
        duration: Date.now() - start 
      };
    }
    
    if (status !== 200) {
      return { 
        name: 'Login Flow', 
        success: false, 
        error: `Unexpected status ${status}: ${JSON.stringify(body)}`, 
        duration: Date.now() - start 
      };
    }
    
    const setCookie = headers['set-cookie'];
    if (!setCookie || setCookie.length === 0) {
      return { 
        name: 'Login Flow', 
        success: false, 
        error: 'No session cookie received', 
        duration: Date.now() - start 
      };
    }
    
    return { name: 'Login Flow', success: true, duration: Date.now() - start };
  } catch (e) {
    return { name: 'Login Flow', success: false, error: String(e), duration: Date.now() - start };
  }
}

async function testAuthenticatedEndpoint(): Promise<TestResult> {
  const start = Date.now();
  try {
    const loginResult = await makeRequest('/api/v1/login', {
      method: 'POST',
      body: { username: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    
    if (loginResult.status !== 200) {
      return { 
        name: 'Authenticated Endpoint', 
        success: false, 
        error: 'Could not log in for auth test', 
        duration: Date.now() - start 
      };
    }
    
    const cookie = loginResult.headers['set-cookie']?.[0]?.split(';')[0];
    if (!cookie) {
      return { 
        name: 'Authenticated Endpoint', 
        success: false, 
        error: 'No session cookie for auth test', 
        duration: Date.now() - start 
      };
    }
    
    const { status, body } = await makeRequest('/api/v1/me', { cookie });
    
    if (status !== 200) {
      return { 
        name: 'Authenticated Endpoint', 
        success: false, 
        error: `GET /api/v1/me failed with status ${status}`, 
        duration: Date.now() - start 
      };
    }
    
    if (!body.id || !body.email) {
      return { 
        name: 'Authenticated Endpoint', 
        success: false, 
        error: 'User data incomplete in response', 
        duration: Date.now() - start 
      };
    }
    
    return { name: 'Authenticated Endpoint', success: true, duration: Date.now() - start };
  } catch (e) {
    return { name: 'Authenticated Endpoint', success: false, error: String(e), duration: Date.now() - start };
  }
}

async function testDatabaseIntegrity(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { status, body } = await makeRequest('/api/v1/polls');
    
    if (status === 500) {
      return { 
        name: 'Database Integrity', 
        success: false, 
        error: 'Server error fetching polls - database schema may be incomplete', 
        duration: Date.now() - start 
      };
    }
    
    return { name: 'Database Integrity', success: true, duration: Date.now() - start };
  } catch (e) {
    return { name: 'Database Integrity', success: false, error: String(e), duration: Date.now() - start };
  }
}

async function main() {
  console.log('🧪 Docker Smoke Test Suite');
  console.log('==========================');
  console.log(`Target: ${BASE_URL}`);
  console.log('');
  
  const serverReady = await waitForServer();
  if (!serverReady) {
    console.error('❌ Server did not become ready in time');
    process.exit(1);
  }
  
  const tests = [
    testHealthEndpoint,
    testDatabaseIntegrity,
    testLoginFlow,
    testAuthenticatedEndpoint,
  ];
  
  const results: TestResult[] = [];
  
  for (const test of tests) {
    const result = await test();
    results.push(result);
    
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.name} (${result.duration}ms)`);
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }
  
  console.log('');
  console.log('==========================');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('');
    console.log('❌ SMOKE TEST FAILED');
    console.log('');
    console.log('Common fixes:');
    console.log('  1. Run database migrations: npx drizzle-kit push');
    console.log('  2. Seed admin user: npx tsx server/seed-admin.ts');
    console.log('  3. Check DATABASE_URL is correct');
    console.log('  4. Verify SESSION_SECRET is set');
    process.exit(1);
  }
  
  console.log('');
  console.log('✅ ALL SMOKE TESTS PASSED');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
