import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (session && topic === "APP_UNINSTALLED") {
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
