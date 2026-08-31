import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

// Every Better Auth endpoint (sign-in, sign-up, sign-out, session, callbacks)
// is served from this one catch-all route.
export const { GET, POST } = toNextJsHandler(auth);
