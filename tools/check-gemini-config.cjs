// Read-only configuration/authentication check; never prints credentials.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
async function main() {
  const key = process.env.GEMINI_API_KEY;
  console.log('Gemini key configured:', Boolean(key));
  if (!key) { process.exitCode = 1; return; }
  console.log('Gemini model:', process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview');
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ uses: 1, expireTime: new Date(Date.now() + 1800000).toISOString(), newSessionExpireTime: new Date(Date.now() + 60000).toISOString() }),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  console.log('Gemini token endpoint status:', response.status);
  console.log('Session token created:', Boolean(result.name));
  if (!response.ok || !result.name) process.exitCode = 1;
}
main().catch(error => { console.error('Token check failed:', error.name); process.exitCode = 1; });
