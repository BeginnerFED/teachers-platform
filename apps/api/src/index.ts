// Vercel detects this default Hono export and deploys it as a Function. Keep the
// long-running Node listener in node.ts so importing this entry never opens a port.
export { app as default, app } from './app'
