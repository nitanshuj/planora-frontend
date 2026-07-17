import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();
    if (!request?.headers) {
      throw new Error("Unauthorized: No request headers available");
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized: No bearer token provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const backendUrl = process.env.BACKEND_API_URL || "http://localhost:8000";

    try {
      const res = await fetch(`${backendUrl}/api/v1/auth/session`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Unauthorized: Invalid session");
      }

      const sessionData = await res.json();
      return next({
        context: {
          userId: sessionData.user.id,
          email: sessionData.user.email,
          token,
        },
      });
    } catch (err) {
      console.error("Auth middleware validation error:", err);
      throw new Error("Unauthorized: Validation failed");
    }
  },
);
