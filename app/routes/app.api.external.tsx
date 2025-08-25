import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  try {
    switch (action) {
      case "validateConnection": {
        const apiUrl = formData.get("apiUrl");
        let accessToken = formData.get("accessToken");

        if (typeof apiUrl !== "string" || typeof accessToken !== "string") {
          return json(
            { success: false, error: "Missing apiUrl or accessToken" },
            { status: 400 }
          );
        }

        // Normalize token in case client passed 'Bearer <token>' already
        const normalizedToken = accessToken.replace(/^Bearer\s+/i, "");

        try {
          console.log(`Validating API: ${apiUrl}`);
          
          const externalResponse = await fetch(apiUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${normalizedToken}`,
              Accept: "application/json",
              "User-Agent": "Shopify-Product-Import/1.0"
            },
            // Add timeout
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });

          console.log(`API Response status: ${externalResponse.status}`);
          console.log(`API Response headers:`, Object.fromEntries(externalResponse.headers.entries()));

          const contentType = externalResponse.headers.get("content-type") || "";
          const isJson = contentType.includes("application/json");
          
          let body;
          try {
            body = isJson ? await externalResponse.json() : await externalResponse.text();
          } catch (parseError) {
            console.log("Failed to parse response body:", parseError);
            body = null;
          }

          if (externalResponse.ok) {
            console.log("API validation successful");
            return json({ success: true, status: externalResponse.status });
          }

          console.log("API validation failed:", externalResponse.status, body);
          
          let errorMessage = "External API returned an error";
          if (body) {
            if (typeof body === "object") {
              errorMessage = body.message || body.error || body.detail || JSON.stringify(body);
            } else {
              errorMessage = body.toString();
            }
          }

          return json(
            {
              success: false,
              status: externalResponse.status,
              error: errorMessage.slice(0, 500)
            },
            { status: externalResponse.status }
          );
        } catch (err: any) {
          console.log("API validation error:", err);
          
          let errorMessage = "Failed to reach external API";
          if (err.name === "AbortError") {
            errorMessage = "API request timed out (10 seconds)";
          } else if (err.code === "ENOTFOUND") {
            errorMessage = "Could not resolve API hostname";
          } else if (err.code === "ECONNREFUSED") {
            errorMessage = "API connection refused";
          } else if (err.message) {
            errorMessage = err.message;
          }
          
          return json({ success: false, error: errorMessage }, { status: 502 });
        }
      }

      case "fetchSampleData": {
        const apiUrl = formData.get("apiUrl");
        let accessToken = formData.get("accessToken");
        if (typeof apiUrl !== "string" || typeof accessToken !== "string") {
          return json(
            { success: false, error: "Missing apiUrl or accessToken" },
            { status: 400 }
          );
        }
        const normalizedToken = accessToken.replace(/^Bearer\s+/i, "");

        try {
          const res = await fetch(apiUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${normalizedToken}`,
              Accept: "application/json",
              "User-Agent": "Shopify-Product-Import/1.0"
            },
            signal: AbortSignal.timeout(10000)
          });
          
          const contentType = res.headers.get("content-type") || "";
          if (!contentType.includes("application/json")) {
            return json({ success: false, error: "Non-JSON response from API" }, { status: 400 });
          }
          const body = await res.json();

          const isArrayOfObjects = (val: any) => Array.isArray(val) && val.length > 0 && typeof val[0] === "object" && !Array.isArray(val[0]);

          let items: any[] | null = null;
          if (isArrayOfObjects(body)) {
            items = body as any[];
          } else if (body && typeof body === "object") {
            for (const key of Object.keys(body)) {
              const val = (body as any)[key];
              if (isArrayOfObjects(val)) {
                items = val as any[];
                break;
              }
            }
          }

          if (!items || items.length === 0) {
            return json({ success: true, items: [] });
          }

          return json({ success: true, items });
        } catch (err: any) {
          return json({ success: false, error: err?.message || "Failed to reach external API" }, { status: 502 });
        }
      }

      case "fetchSampleFields": {
        const apiUrl = formData.get("apiUrl");
        let accessToken = formData.get("accessToken");
        if (typeof apiUrl !== "string" || typeof accessToken !== "string") {
          return json(
            { success: false, error: "Missing apiUrl or accessToken" },
            { status: 400 }
          );
        }
        const normalizedToken = accessToken.replace(/^Bearer\s+/i, "");

        try {
          const res = await fetch(apiUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${normalizedToken}`,
              Accept: "application/json",
              "User-Agent": "Shopify-Product-Import/1.0"
            },
            signal: AbortSignal.timeout(10000)
          });
          
          const contentType = res.headers.get("content-type") || "";
          if (!contentType.includes("application/json")) {
            return json({ success: false, error: "Non-JSON response from API" }, { status: 400 });
          }
          const body = await res.json();

          const isArrayOfObjects = (val: any) => Array.isArray(val) && val.length > 0 && typeof val[0] === "object" && !Array.isArray(val[0]);

          let items: any[] | null = null;
          if (isArrayOfObjects(body)) {
            items = body as any[];
          } else if (body && typeof body === "object") {
            for (const key of Object.keys(body)) {
              const val = (body as any)[key];
              if (isArrayOfObjects(val)) {
                items = val as any[];
                break;
              }
            }
          }

          if (!items || items.length === 0) {
            return json({ success: true, fields: [] });
          }

          const sample = items[0];
          const fields = new Set<string>();
          const walk = (obj: any, prefix = "") => {
            if (!obj || typeof obj !== "object") return;
            for (const k of Object.keys(obj)) {
              const val = obj[k];
              const path = prefix ? `${prefix}.${k}` : k;
              if (val !== null && typeof val === "object" && !Array.isArray(val)) {
                walk(val, path);
              } else {
                fields.add(path);
              }
            }
          };
          walk(sample);

          return json({ success: true, fields: Array.from(fields).sort(), sample });
        } catch (err: any) {
          return json({ success: false, error: err?.message || "Failed to reach external API" }, { status: 502 });
        }
      }

      default:
        return json({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("External API route error:", error);
    return json({ success: false, error: "Internal server error" }, { status: 500 });
  }
};

