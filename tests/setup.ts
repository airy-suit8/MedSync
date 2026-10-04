import { loadEnvConfig } from '@next/env'

// Next intentionally ignores .env.local when NODE_ENV=test. Load the developer
// file with development-mode precedence, then restore Vitest's test environment.
const nodeEnv = process.env.NODE_ENV
Reflect.set(process.env, 'NODE_ENV', 'development')
loadEnvConfig(process.cwd(), true)
Reflect.set(process.env, 'NODE_ENV', nodeEnv || 'test')
