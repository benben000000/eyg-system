// Intentionally empty.
//
// `server-only` exists purely so a bundler throws if a Client Component imports
// a server module. A plain Node script is server-side by definition, so outside
// Next.js the guard is pure friction. See ./register-server-only.cjs.