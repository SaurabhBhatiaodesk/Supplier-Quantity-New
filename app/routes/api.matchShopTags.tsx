import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { Q_ALL_TAGS } from "../utils/graphql.server";

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const { tags } = await request.json();
  const resp = await admin.graphql(Q_ALL_TAGS, { variables: { first: 250 }});
  const data = await resp.json();

  const toFind = String(tags ?? "").toLowerCase();
  const found = (data?.data?.shop?.productTags?.edges ?? [])
    .some((e: any) => String(e?.node ?? "").toLowerCase() === toFind);

  if (found) {
    return json({ status: true, message: "Tag's matched" }, { status: 201 });
  }
  return json({ status: false, message: "Tag does not exist in the product" }, { status: 404 });
}
