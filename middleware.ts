import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n";

const intlMiddleware = createMiddleware(routing);

const isPublicRoute = createRouteMatcher([
  "/:locale/sign-in(.*)",
  "/:locale/sign-up(.*)",
  "/:locale/privacy(.*)",
  "/:locale/terms(.*)",
  "/:locale/aup(.*)",
  "/api/webhooks(.*)",
  "/:locale",
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/dashboard",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
  // Don't apply intl middleware to API routes or other non-page routes
  if (req.nextUrl.pathname.startsWith("/api")) {
    return;
  }
  return intlMiddleware(req);
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
