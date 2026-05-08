// Set required JWT secrets before any module that calls requireSecret() is imported.
// dotenv does not override existing env vars, so these test-only defaults are only
// used when no real .env is present (e.g. CI without secrets).
process.env.JWT_SECRET =
  process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32
    ? process.env.JWT_SECRET
    : 'test-jwt-access-secret-minimum-32-chars!!'
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length >= 32
    ? process.env.JWT_REFRESH_SECRET
    : 'test-jwt-refresh-secret-minimum-32-chars!'

import '@testing-library/jest-dom'
