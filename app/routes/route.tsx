import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { login } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw await login(request);
  }

  return json({ showForm: Boolean(login) });
};

export default function Auth() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Supplier Quantity Manager
          </h1>
          <p className="text-gray-600 mt-2">
            Connect your Shopify store to get started
          </p>
        </div>

        {showForm && (
          <Form method="post" className="space-y-4">
            <div>
              <label htmlFor="shop" className="block text-sm font-medium text-gray-700">
                Shop domain
              </label>
              <input
                type="text"
                name="shop"
                id="shop"
                placeholder="example.myshopify.com"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Connect to Shopify
            </button>
          </Form>
        )}
      </div>
    </div>
  );
}