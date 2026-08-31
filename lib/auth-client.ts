"use client";

import { createAuthClient } from "better-auth/react";

// Browser-side Better Auth client. It talks to /api/auth/* in this same app —
// there is no external auth service and no publishable key to configure, so the
// base URL is just the current origin.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
