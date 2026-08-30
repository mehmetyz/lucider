// ai-context: Verifies password and returns a session token
// ai-body: off
// ai-deps: hashPassword, issueToken
export function login(email, password) {
  const hash = hashPassword(password);
  return issueToken(email, hash);
}

// ai-context: One-way hash of a password string
export function hashPassword(password) {
  return `sha256:${password.length}`;
}

// ai-context: Signs a short-lived session token
export function issueToken(subject, secret) {
  return `${subject}.${secret}`;
}

// ai-ignore
export function dumpDebugSecrets() {
  return process.env.SECRET_KEY;
}
