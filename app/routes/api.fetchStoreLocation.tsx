import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { Q_SHOP_LOCATIONS } from "../utils/graphql.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const resp = await admin.graphql(Q_SHOP_LOCATIONS, { variables: { first: 250 }});
  const data = await resp.json();
  return json({ status: true, data });
}
