import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");

    const where: any = { shop: session.shop, isActive: true };
    if (type) where.type = type;

    // First, get all connections without select to see raw data
    const allConnections = await prisma.connection.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    
    console.log('🔍 All connections raw data:', allConnections.map(c => ({
      id: c.id,
      name: c.name,
      apiUrl: c.apiUrl,
      accessToken: c.accessToken,
      accessTokenLength: c.accessToken ? c.accessToken.length : 0,
      supplierName: c.supplierName
    })));
    
    const connections = await prisma.connection.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        shop: true,
        type: true,
        name: true,
        apiUrl: true,
        accessToken: true,
        csvFileName: true,
        supplierName: true,
        supplierEmail: true,
        status: true,
        lastSync: true,
        scheduledTime: true,
        productCount: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    console.log('🔍 Raw connections from database:', connections.map(c => ({
      id: c.id,
      name: c.name,
      apiUrl: c.apiUrl,
      accessToken: c.accessToken ? '***' : 'undefined',
      accessTokenLength: c.accessToken ? c.accessToken.length : 0,
      supplierName: c.supplierName
    })));
    
    // Check specific connection
    const specificConnection = connections.find(c => c.apiUrl === 'https://fpp.prometheusai.dev/external/products?page=1&size=5');
    if (specificConnection) {
      console.log('🎯 Found specific connection:', {
        id: specificConnection.id,
        name: specificConnection.name,
        apiUrl: specificConnection.apiUrl,
        accessToken: specificConnection.accessToken ? '***' : 'undefined',
        accessTokenLength: specificConnection.accessToken ? specificConnection.accessToken.length : 0
      });
    }

    // Calculate product count for each connection
    const connectionsWithProductCount = await Promise.all(
      connections.map(async (connection) => {
        // Count products for this specific connection
        const productCount = await prisma.importedProduct.count({
          where: { 
            shop: session.shop,
            connectionId: connection.id
          }
        });

        return {
          ...connection,
          productCount: productCount
        };
      })
    );

    // Get total imported products count
    console.log('Counting imported products for shop:', session.shop);
    const totalImportedProducts = await prisma.importedProduct.count({
      where: { shop: session.shop }
    });
    console.log('Total imported products found:', totalImportedProducts);
    
    // Debug: Check if there are any products at all
    const allProducts = await prisma.importedProduct.findMany({
      take: 5,
      select: { id: true, shop: true, title: true, connectionId: true }
    });
    console.log('Sample products in database:', allProducts);

    return json({ 
      success: true, 
      connections: connectionsWithProductCount,
      totalImportedProducts 
    });
  } catch (error) {
    console.error("Connections loader error:", error);
    return json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // Handle PUT requests for updating connections
  if (request.method === "PUT") {
    try {
      const body = await request.json();
      const { connectionId, name, apiUrl, accessToken, supplierName, supplierEmail } = body;

      if (!connectionId) {
        return json({ success: false, error: "Connection ID is required" }, { status: 400 });
      }

      // Verify the connection belongs to this shop
      const existingConnection = await prisma.connection.findFirst({
        where: {
          id: connectionId,
          shop: session.shop
        }
      });

      if (!existingConnection) {
        return json({ success: false, error: "Connection not found" }, { status: 404 });
      }

      // Update the connection
      const updateData: any = {
        name: name || existingConnection.name,
        apiUrl: apiUrl || existingConnection.apiUrl,
        accessToken: accessToken || existingConnection.accessToken,
        supplierName: supplierName || existingConnection.supplierName,
        supplierEmail: supplierEmail || existingConnection.supplierEmail,
        updatedAt: new Date()
      };

      // Handle schedule data with markup
      console.log('📝 Backend received schedule data:', {
        scheduleEnabled: body.scheduleEnabled,
        scheduleFrequency: body.scheduleFrequency,
        scheduleTime: body.scheduleTime,
        markupEnabled: body.markupEnabled,
        markupType: body.markupType,
        markupValue: body.markupValue,
        priceFrom: body.priceFrom,
        priceTo: body.priceTo,
        conditionOperator: body.conditionOperator
      });
      
      if (body.scheduleEnabled !== undefined || body.scheduleFrequency !== undefined || body.scheduleTime !== undefined || 
          body.markupEnabled !== undefined || body.markupType !== undefined || body.markupValue !== undefined || 
          body.priceFrom !== undefined || body.priceTo !== undefined || body.conditionOperator !== undefined) {
        // Store complete schedule data as JSON
        const scheduleData = {
          enabled: body.scheduleEnabled !== undefined ? body.scheduleEnabled : false,
          frequency: body.scheduleFrequency || 'daily',
          time: body.scheduleTime || '09:00',
          markupEnabled: body.markupEnabled !== undefined ? body.markupEnabled : false,
          markupType: body.markupType || 'percentage',
          markupValue: body.markupValue || 0,
          priceFrom: body.priceFrom || 0,
          priceTo: body.priceTo || 0,
          conditionOperator: body.conditionOperator || 'between'
        };
        updateData.scheduledTime = JSON.stringify(scheduleData);
        console.log('📝 Storing schedule data with markup as JSON:', updateData.scheduledTime);
      }

      const updatedConnection = await prisma.connection.update({
        where: { id: connectionId },
        data: updateData
      });

      console.log('✅ Connection updated successfully:', updatedConnection.id);
      console.log('📝 Updated connection scheduledTime:', updatedConnection.scheduledTime);
      return json({ success: true, connection: updatedConnection });
    } catch (error) {
      console.error('❌ Error updating connection:', error);
      return json({ success: false, error: "Failed to update connection" }, { status: 500 });
    }
  }

  // Handle DELETE requests for deleting connections
  if (request.method === "DELETE") {
    try {
      const body = await request.json();
      const { connectionId } = body;

      if (!connectionId) {
        return json({ success: false, error: "Connection ID is required" }, { status: 400 });
      }

      // Verify the connection belongs to this shop
      const existingConnection = await prisma.connection.findFirst({
        where: {
          id: connectionId,
          shop: session.shop
        }
      });

      if (!existingConnection) {
        return json({ success: false, error: "Connection not found" }, { status: 404 });
      }

      // Delete the connection
      const deletedConnection = await prisma.connection.delete({
        where: { id: connectionId }
      });

      console.log('✅ Connection deleted successfully:', deletedConnection.id);
      return json({ success: true, message: "Connection deleted successfully" });

    } catch (error) {
      console.error('❌ Error deleting connection:', error);
      return json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to delete connection" 
      }, { status: 500 });
    }
  }

  // Handle POST requests for other actions
  const formData = await request.formData();
  const action = formData.get("action");

  try {
    switch (action) {
      case "create": {
        const payloadRaw = formData.get("data");
        if (typeof payloadRaw !== "string") {
          return json({ success: false, error: "Missing data" }, { status: 400 });
        }
        const payload = JSON.parse(payloadRaw);

        const connection = await prisma.connection.create({
          data: {
            shop: session.shop,
            type: payload.type,
            name: payload.name || "API Connection",
            apiUrl: payload.apiUrl ?? null,
            accessToken: payload.accessToken ?? null,
            csvFileName: payload.csvFileName ?? null,
            supplierName: payload.supplierName ?? null,
            supplierEmail: payload.supplierEmail ?? null,
            status: payload.status || "connected",
            scheduledTime: payload.scheduledTime ?? null,
            productCount: payload.productCount ?? 0,
          },
        });

        return json({ success: true, connection });
      }

      case "delete": {
        const id = formData.get("id");
        if (typeof id !== "string") {
          return json({ success: false, error: "Missing id" }, { status: 400 });
        }
        await prisma.connection.update({
          where: { id },
          data: { isActive: false },
        });
        return json({ success: true });
      }

      case "cleanupDuplicates": {
        // Find and remove duplicate connections
        const allConnections = await prisma.connection.findMany({
          where: { shop: session.shop, isActive: true },
          orderBy: { createdAt: "desc" }
        });

        const duplicates = new Map<string, any[]>();
        
        // Group by supplier name and API URL
        allConnections.forEach(conn => {
          const key = `${conn.supplierName || conn.name}-${conn.apiUrl || conn.csvFileName}`;
          if (!duplicates.has(key)) {
            duplicates.set(key, []);
          }
          duplicates.get(key)!.push(conn);
        });

        let removedCount = 0;
        
        // Remove duplicates, keeping only the most recent
        for (const [key, conns] of duplicates.entries()) {
          if (conns.length > 1) {
            // Sort by createdAt, keep the most recent
            const sorted = conns.sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            
            // Mark older duplicates as inactive
            for (let i = 1; i < sorted.length; i++) {
              await prisma.connection.update({
                where: { id: sorted[i].id },
                data: { isActive: false }
              });
              removedCount++;
            }
          }
        }

        return json({ 
          success: true, 
          message: `Removed ${removedCount} duplicate connections`,
          removedCount 
        });
      }

      default:
        return json({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Connections action error:", error);
    return json({ success: false, error: "Internal server error" }, { status: 500 });
  }
};

