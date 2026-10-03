import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // @tp/shared is published as raw TypeScript inside the workspace, so Next has to compile it.
  transpilePackages: ['@tp/shared'],

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // A response is what it says it is: no guessing an upload into a script. Sent by
          // a production build only: the dev server hands one of its own scripts, the
          // client middleware manifest, over as JSON, and with this the browser refuses to
          // run it. A build writes that file as real JavaScript.
          ...(process.env.NODE_ENV === 'production'
            ? [{ key: 'X-Content-Type-Options', value: 'nosniff' }]
            : []),
          // Another site learns where a link came from, never the page or its query.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Nobody else may frame these pages and dress them up as their own. The app
          // frames only YouTube, never itself, so its own origin is all that is allowed;
          // the header is the old browsers' half of the same rule.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
          // The recorder in the lesson editor wants the microphone, and only from this
          // origin. Nothing here wants the camera or a location.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
