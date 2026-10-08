export const prerender = false;

import { BlobServiceClient } from '@azure/storage-blob';
import { createClient } from 'contentful-management';
import type { APIRoute } from "astro";

const BACKUP_PREFIX = 'contentful-space-backup';
const MAX_BACKUPS = 15;

// Get environment variables
const CONTENTFUL_WEBHOOK_SECRET = import.meta.env.CONTENTFUL_WEBHOOK_SECRET;
const AZURE_STORAGE_CONNECTION_STRING = import.meta.env.AZURE_STORAGE_CONNECTION_STRING;
const AZURE_STORAGE_CONTAINER_NAME = import.meta.env.AZURE_STORAGE_CONTAINER_NAME;
const CONTENTFUL_SPACE_ID = import.meta.env.CONTENTFUL_SPACE_ID;
const CONTENTFUL_ENVIRONMENT_ID = import.meta.env.CONTENTFUL_ENVIRONMENT_ID || 'master';
const CONTENTFUL_MANAGEMENT_TOKEN = import.meta.env.CONTENTFUL_MANAGEMENT_TOKEN;
const AZURE_SHARED_ACCESS_TOKEN = import.meta.env.AZURE_SHARED_ACCESS_TOKEN;

async function getNextBackupNumber(containerClient: any) {
  const backups: string[] = [];
  for await (const blob of containerClient.listBlobsFlat({ prefix: BACKUP_PREFIX })) {
    backups.push(blob.name);
  }
  
  if (backups.length === 0) return 1;
  
  const numbers = backups.map(name => {
    const match = name.match(/\d+$/);
    return match ? parseInt(match[0]) : 0;
  });
  
  return Math.max(...numbers) + 1;
}

async function deleteOldestBackup(containerClient: any) {
  const backups: { name: string; lastModified: Date }[] = [];
  for await (const blob of containerClient.listBlobsFlat({ prefix: BACKUP_PREFIX })) {
    backups.push({
      name: blob.name,
      lastModified: blob.properties.lastModified
    });
  }
  
  if (backups.length >= MAX_BACKUPS) {
    const oldestBackup = backups.sort((a, b) => 
      a.lastModified.getTime() - b.lastModified.getTime()
    )[0];
    
    const blockBlobClient = containerClient.getBlockBlobClient(oldestBackup.name);
    await blockBlobClient.delete();
    console.log(`Deleted oldest backup: ${oldestBackup.name}`);
  }
}

async function exportContentfulSpace(): Promise<string> {
  const client = createClient({
    accessToken: CONTENTFUL_MANAGEMENT_TOKEN!,
  });

  const space = await client.getSpace(CONTENTFUL_SPACE_ID!);
  const environment = await space.getEnvironment(CONTENTFUL_ENVIRONMENT_ID);

  // Export content types
  const contentTypes = await environment.getContentTypes();
  const contentTypeData = await Promise.all(
    contentTypes.items.map(async (ct) => {
      const fields = ct.fields.map((field: any) => ({
        id: field.id,
        name: field.name,
        type: field.type,
        required: field.required,
        validations: field.validations,
        items: field.items,
        linkType: field.linkType,
      }));
      return {
        sys: {
          id: ct.sys.id,
          type: ct.sys.type,
          createdAt: ct.sys.createdAt,
          updatedAt: ct.sys.updatedAt,
        },
        name: ct.name,
        displayField: ct.displayField,
        description: ct.description,
        fields,
      };
    })
  );

  // Export entries (simplified - gets first 1000 entries per content type)
  const entries: any[] = [];
  for (const contentType of contentTypes.items) {
    try {
      const entriesCollection = await environment.getEntries({
        content_type: contentType.sys.id,
        limit: 1000,
      });
      entries.push(...entriesCollection.items.map((entry: any) => ({
        sys: {
          id: entry.sys.id,
          type: entry.sys.type,
          createdAt: entry.sys.createdAt,
          updatedAt: entry.sys.updatedAt,
          contentType: entry.sys.contentType,
        },
        fields: entry.fields,
      })));
    } catch (error) {
      console.warn(`Failed to export entries for ${contentType.name}:`, error);
    }
  }

  // Export assets (simplified - gets first 1000 assets)
  const assets: any[] = [];
  try {
    const assetsCollection = await environment.getAssets({ limit: 1000 });
    assets.push(...assetsCollection.items.map((asset: any) => ({
      sys: {
        id: asset.sys.id,
        type: asset.sys.type,
        createdAt: asset.sys.createdAt,
        updatedAt: asset.sys.updatedAt,
      },
      fields: asset.fields,
    })));
  } catch (error) {
    console.warn('Failed to export assets:', error);
  }

  // Build export structure similar to contentful-export format
  const exportData = {
    version: '1.0.0',
    contentTypes: contentTypeData,
    entries,
    assets,
    locales: (await environment.getLocales()).items.map((locale: any) => ({
      code: locale.code,
      name: locale.name,
      default: locale.default,
      fallbackCode: locale.fallbackCode,
    })),
  };

  return JSON.stringify(exportData, null, 2);
}

async function createBackup() {
  try {
    console.log('Exporting Contentful space...');
    
    // Export space data to in-memory JSON string (no filesystem needed)
    const backupContent = await exportContentfulSpace();
    const backupBuffer = new TextEncoder().encode(backupContent);
    
    // Upload to Azure
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      `BlobEndpoint=${AZURE_STORAGE_CONNECTION_STRING};SharedAccessSignature=${AZURE_SHARED_ACCESS_TOKEN};`
    );
    const containerClient = blobServiceClient.getContainerClient(
      AZURE_STORAGE_CONTAINER_NAME
    );

    // Get next backup number and delete oldest if needed
    const nextNumber = await getNextBackupNumber(containerClient);
    await deleteOldestBackup(containerClient);

    const blobName = `${BACKUP_PREFIX}-${nextNumber}.json`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    await blockBlobClient.upload(backupBuffer, backupBuffer.length, {
      blobHTTPHeaders: { blobContentType: 'application/json' }
    });

    console.log(`Successfully created backup: ${blobName}`);
    return blobName;
  } catch (error: any) {
    console.error('Error creating backup:', error);
    throw error;
  }
}

export const POST: APIRoute = async ({ request }) => {
  if (request.headers.get("X-Contentful-Webhook-Secret") !== CONTENTFUL_WEBHOOK_SECRET) {
    console.log("Unauthorized request");
    return new Response(JSON.stringify({
        message: "Unauthorized"
    }), {
        status: 401,
        headers: {
            "Content-Type": "application/json",
        }
    });
  }

  try {
    // Create a new backup
    const backupName = await createBackup();

    return new Response(JSON.stringify({
      message: `Successfully created backup: ${backupName}`,
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      }
    });
  } catch (error: any) {
    console.error('Error creating backup:', error);
    return new Response(JSON.stringify({
      message: "Error creating backup",
      error: error?.message || 'Unknown error'
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      }
    });
  }
}