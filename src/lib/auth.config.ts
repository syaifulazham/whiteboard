import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig: NextAuthConfig = {
  providers: [Google],
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;
      const isProtected = path.startsWith("/dashboard") || path.startsWith("/board");
      const isAuthRoute = path.startsWith("/auth");

      if (isAuthRoute && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      if (isProtected && !isLoggedIn) {
        return Response.redirect(new URL("/auth/signin", nextUrl));
      }
      return true;
    },
  },
};
