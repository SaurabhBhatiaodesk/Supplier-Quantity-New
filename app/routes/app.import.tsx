import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import ProductImportManager from "../components/ProductImportManager";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
}

export default function ImportPage() {
  return <ProductImportManager />;
}