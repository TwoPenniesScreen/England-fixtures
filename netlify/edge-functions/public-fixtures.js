import { getStore } from "@netlify/blobs";
import { validateDisplayData } from "../../fixture-schema.js";

const EMPTY = { fixtures: [], updatedAt: null };
const store = () => getStore({ name: "england-fixtures", consistency: "strong" });

export default async (request, context) => {
  if (request.method !== "GET") return context.next();
  const url = new URL(request.url);
  if (url.searchParams.get("view") === "admin") return context.next();
  let value = null;
  try { value = await store().get("current", { type: "json" }); } catch {}
  const display = validateDisplayData(value || EMPTY) || EMPTY;
  return Response.json(display, { headers: { "Cache-Control": "public, max-age=300", "X-TTP-Runtime": "edge" } });
};

export const config = { path: "/api/fixtures" };
