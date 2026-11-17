import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useNavigate } from "react-router";
import { useEffect } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { addDocumentResponseHeaders } from "../../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const responseHeaders = new Headers();
  addDocumentResponseHeaders(request, responseHeaders);

  if (url.searchParams.get("shop")) {
    return redirect(`/app?${url.searchParams.toString()}`, {
      headers: responseHeaders,
    });
  }

  return redirect("/app", { headers: responseHeaders });
};

export default function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/app" + window.location.search);
  }, [navigate]);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: "sans-serif" }}>
      <p>Loading Bundle &amp; Tier Discounts...</p>
    </div>
  );
}

export function ErrorBoundary() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif", color: "#333" }}>
      <h2>Loading Application...</h2>
      <p>
        If you are not redirected automatically,{" "}
        <a href={"/app" + (typeof window !== "undefined" ? window.location.search : "")}>
          click here to open the dashboard
        </a>.
      </p>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

