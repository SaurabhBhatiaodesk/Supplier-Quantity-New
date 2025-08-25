import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import  prisma  from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");
  const data = formData.get("data");

  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  try {
    switch (action) {
      case "saveTempData": {
        if (!data || typeof data !== "string") {
          throw new Response("Invalid data", { status: 400 });
        }

        const parsedData = JSON.parse(data);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // Expire in 24 hours

        await prisma.tempData.create({
          data: {
            shop: session.shop,
            dataType: "import_progress",
            data: data,
            expiresAt,
          },
        });

        return json({ success: true });
      }
      
      case "loadTempData": {
        const tempData = await prisma.tempData.findFirst({
          where: {
            shop: session.shop,
            dataType: "import_progress",
            expiresAt: {
              gt: new Date(),
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        return json({ 
          success: true, 
          data: tempData ? JSON.parse(tempData.data) : null 
        });
      }

      default:
        throw new Response("Invalid action", { status: 400 });
    }
  } catch (error) {
    console.error("Temp data error:", error);
    return json({ success: false, error: "Internal server error" }, { status: 500 });
  }
};