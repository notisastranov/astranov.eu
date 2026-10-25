#!/usr/bin/env node
const t = await fetch('https://astranov.eu/').then((r) => r.text());
const checks = {
  continueWithGoogle: t.includes('Continue with Google'),
  handleOAuthReturn: t.includes('_handleOAuthReturn'),
  noWarnDiv: !t.includes('id="auth-google-warn"'),
  signInWithIdToken: (t.match(/signInWithIdToken/g) || []).length,
};
console.log(JSON.stringify(checks, null, 2));
process.exit(checks.continueWithGoogle && checks.handleOAuthReturn && checks.noWarnDiv ? 0 : 1);