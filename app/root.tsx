import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse, useRouteError } from "react-router";

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  let errorMessage = "An error occurred";
  let errorDetails = "";

  if (isRouteErrorResponse(error)) {
    errorMessage = `${error.status} ${error.statusText}`;
    errorDetails = error.data?.message || JSON.stringify(error.data);
  } else if (error instanceof Error) {
    errorMessage = error.message;
    errorDetails = error.stack || "";
  }

  return (
    <html lang="en">
      <head>
        <title>Error - Bundle &amp; Tier Discounts</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Links />
      </head>
      <body style={{ fontFamily: "sans-serif", padding: "2rem", color: "#202223" }}>
        <h2>Loading Bundle &amp; Tier Discounts</h2>
        <p style={{ color: "#d82c0d" }}>{errorMessage}</p>
        {errorDetails && (
          <pre style={{ background: "#f6f6f7", padding: "1rem", borderRadius: "8px", overflowX: "auto" }}>
            {errorDetails}
          </pre>
        )}
        <p>
          <a
            href={"/app" + (typeof window !== "undefined" ? window.location.search : "")}
            style={{
              display: "inline-block",
              background: "#008060",
              color: "#fff",
              padding: "8px 16px",
              borderRadius: "6px",
              textDecoration: "none",
              fontWeight: "600",
            }}
          >
            Reload App
          </a>
        </p>
        <Scripts />
      </body>
    </html>
  );
}
