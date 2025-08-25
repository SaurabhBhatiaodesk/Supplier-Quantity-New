// app/routes/api.import-config.ts

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import  prisma  from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  try {
    const configurations = await prisma.importConfiguration.findMany({
      where: {
        shop: session.shop,
        isActive: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return json({ configurations });
  } catch (error) {
    console.error("Load configurations error:", error);
    return json({ configurations: [] });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  try {
    switch (action) {
      case "create": {
        const configData = JSON.parse(formData.get("data") as string);
        
        const configuration = await prisma.importConfiguration.create({
          data: {
            shop: session.shop,
            name: configData.name || "Import Configuration",
            dataSource: configData.dataSource,
            apiUrl: configData.apiUrl,
            accessToken: configData.accessToken,
            csvFileName: configData.csvFileName,
            csvData: configData.csvData ? JSON.stringify(configData.csvData) : null,
            keyMappings: JSON.stringify(configData.keyMappings),
            importType: configData.importType,
            importFilters: JSON.stringify(configData.importFilters),
            markupConfig: JSON.stringify(configData.markupConfig),
            importConfig: configData.importConfig,
            scheduledTime: configData.scheduledTime,
            productCount: configData.productCount || 0,
          },
        });

        return json({ success: true, configuration });
      }

      case "update": {
        const id = formData.get("id") as string;
        const configData = JSON.parse(formData.get("data") as string);
        
        const configuration = await prisma.importConfiguration.update({
          where: {
            id,
            shop: session.shop,
          },
          data: {
            name: configData.name,
            dataSource: configData.dataSource,
            apiUrl: configData.apiUrl,
            accessToken: configData.accessToken,
            csvFileName: configData.csvFileName,
            csvData: configData.csvData ? JSON.stringify(configData.csvData) : null,
            keyMappings: JSON.stringify(configData.keyMappings),
            importType: configData.importType,
            importFilters: JSON.stringify(configData.importFilters),
            markupConfig: JSON.stringify(configData.markupConfig),
            importConfig: configData.importConfig,
            scheduledTime: configData.scheduledTime,
            productCount: configData.productCount || 0,
          },
        });

        return json({ success: true, configuration });
      }

      case "delete": {
        const id = formData.get("id") as string;
        
        await prisma.importConfiguration.update({
          where: {
            id,
            shop: session.shop,
          },
          data: {
            isActive: false,
          },
        });

        return json({ success: true });
      }

      default:
        throw new Response("Invalid action", { status: 400 });
    }
  } catch (error) {
    console.error("Import configuration error:", error);
    return json({ success: false, error: "Internal server error" }, { status: 500 });
  }
};
