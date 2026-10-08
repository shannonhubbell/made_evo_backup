import { BlobServiceClient } from '@azure/storage-blob';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import {
  CONTENTFUL_SPACE_ID,
  CONTENTFUL_ENVIRONMENT_ID,
  CONTENTFUL_MANAGEMENT_TOKEN,
  AZURE_STORAGE_CONNECTION_STRING,
  AZURE_STORAGE_CONTAINER_NAME,
  AZURE_SHARED_ACCESS_TOKEN,
} from '../config';

const execAsync = promisify(exec);

const BACKUP_BLOB_NAME = 'contentful-space-backup.json';
const TEMP_EXPORT_DIR = path.join(process.cwd(), 'temp-export');

// Custom error types
class ContentfulBackupError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'ContentfulBackupError';
  }
}

class ValidationError extends ContentfulBackupError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class ContentfulCLIError extends ContentfulBackupError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'ContentfulCLIError';
  }
}

class AzureStorageError extends ContentfulBackupError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'AzureStorageError';
  }
}

interface BackupConfig {
  spaceId: string;
  environmentId: string;
  managementToken: string;
  azureConnectionString: string;
  azureContainerName: string;
  azureSharedAccessToken: string;
}

function validateConfig(config: BackupConfig) {
  const requiredFields = ['spaceId', 'environmentId', 'managementToken', 'azureConnectionString', 'azureContainerName'];
  const missingFields = requiredFields.filter(field => !config[field as keyof BackupConfig]);

  if (missingFields.length > 0) {
    throw new ValidationError(`Missing required configuration fields: ${missingFields.join(', ')}`);
  }
}

async function ensureTempDir() {
  try {
    if (!fs.existsSync(TEMP_EXPORT_DIR)) {
      fs.mkdirSync(TEMP_EXPORT_DIR, { recursive: true });
    }
  } catch (error: any) {
    throw new ContentfulBackupError(`Failed to create temporary directory: ${error.message}`, error);
  }
}

async function cleanupTempDir() {
  try {
    if (fs.existsSync(TEMP_EXPORT_DIR)) {
      fs.rmSync(TEMP_EXPORT_DIR, { recursive: true, force: true });
    }
  } catch (error: any) {
    throw new ContentfulBackupError(`Failed to cleanup temporary directory: ${error.message}`, error);
  }
}

async function checkContentfulCLI() {
  try {
    await execAsync('contentful --version');
  } catch (error: any) {
    throw new ContentfulCLIError(
      'Contentful CLI is not installed. Please install it using: npm install -g contentful-cli',
      error
    );
  }
}

export async function exportSpaceToAzure(config: BackupConfig) {
  try {
    // Validate configuration
    validateConfig(config);
    
    // Check if Contentful CLI is installed
    await checkContentfulCLI();
    
    await ensureTempDir();
    
    // Export space to local file
    const exportCommand = `contentful space export --space-id ${config.spaceId} \
      --environment-id ${config.environmentId} \
      --management-token ${config.managementToken} \
      --export-dir ${TEMP_EXPORT_DIR} \
      --content-file ${BACKUP_BLOB_NAME}`;

    console.log('Exporting Contentful space...');
    try {
      await execAsync(exportCommand);
    } catch (error: any) {
      throw new ContentfulCLIError(`Failed to export Contentful space: ${error.message}`, error);
    }
    
    // Upload to Azure
    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(
        `BlobEndpoint=${config.azureConnectionString};SharedAccessSignature=${config.azureSharedAccessToken};`
      );
      const containerClient = blobServiceClient.getContainerClient(
        config.azureContainerName
      );
      const blockBlobClient = containerClient.getBlockBlobClient(BACKUP_BLOB_NAME);

      const filePath = path.join(TEMP_EXPORT_DIR, BACKUP_BLOB_NAME);
      if (!fs.existsSync(filePath)) {
        throw new ContentfulBackupError('Export file not found');
      }

      const fileContent = fs.readFileSync(filePath);
      
      await blockBlobClient.upload(fileContent, fileContent.length, {
        blobHTTPHeaders: { blobContentType: 'application/json' }
      });
    } catch (error: any) {
      throw new AzureStorageError(`Failed to upload to Azure: ${error.message}`, error);
    }

    console.log('Successfully exported and uploaded space backup to Azure');
    return true;
  } catch (error: any) {
    if (error instanceof ContentfulBackupError) {
      throw error;
    }
    throw new ContentfulBackupError(`Unexpected error during export: ${error.message}`, error);
  } finally {
    await cleanupTempDir();
  }
}

// This function has not been tested. It's only needed for emergency
// situations!
export async function importSpaceFromAzure(config: BackupConfig) {
  try {
    // Validate configuration
    validateConfig(config);
    
    // Check if Contentful CLI is installed
    await checkContentfulCLI();
    
    await ensureTempDir();
    
    // Download from Azure
    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(
        config.azureConnectionString
      );
      const containerClient = blobServiceClient.getContainerClient(
        config.azureContainerName
      );
      const blockBlobClient = containerClient.getBlockBlobClient(BACKUP_BLOB_NAME);

      const downloadResponse = await blockBlobClient.download();
      if (!downloadResponse.readableStreamBody) {
        throw new AzureStorageError('Failed to download backup file from Azure');
      }

      const filePath = path.join(TEMP_EXPORT_DIR, BACKUP_BLOB_NAME);
      
      // Save the downloaded content to a file
      const fileStream = fs.createWriteStream(filePath);
      await new Promise((resolve, reject) => {
        downloadResponse.readableStreamBody!.pipe(fileStream)
          .on('error', reject)
          .on('finish', resolve);
      });
    } catch (error: any) {
      throw new AzureStorageError(`Failed to download from Azure: ${error.message}`, error);
    }

    // Import to Contentful
    const importCommand = `contentful space import --space-id ${config.spaceId} \
      --environment-id ${config.environmentId} \
      --management-token ${config.managementToken} \
      --content-file ${path.join(TEMP_EXPORT_DIR, BACKUP_BLOB_NAME)}`;

    console.log('Importing Contentful space...');
    try {
      await execAsync(importCommand);
    } catch (error: any) {
      throw new ContentfulCLIError(`Failed to import Contentful space: ${error.message}`, error);
    }

    console.log('Successfully imported space from Azure backup');
    return true;
  } catch (error: any) {
    if (error instanceof ContentfulBackupError) {
      throw error;
    }
    throw new ContentfulBackupError(`Unexpected error during import: ${error.message}`, error);
  } finally {
    await cleanupTempDir();
  }
}

// CLI interface
const args = process.argv.slice(2);
const operation = args[0];

if (!operation || !['export', 'import'].includes(operation)) {
  console.error('Usage: node contentful-space-backup.js [export|import]');
  process.exit(1);
}

const config: BackupConfig = {
  spaceId: CONTENTFUL_SPACE_ID || '',
  environmentId: CONTENTFUL_ENVIRONMENT_ID || 'master',
  managementToken: CONTENTFUL_MANAGEMENT_TOKEN || '',
  azureConnectionString: AZURE_STORAGE_CONNECTION_STRING || '',
  azureContainerName: AZURE_STORAGE_CONTAINER_NAME || '',
  azureSharedAccessToken: AZURE_SHARED_ACCESS_TOKEN || '',
};

(async () => {
  try {
    if (operation === 'export') {
      await exportSpaceToAzure(config);
    } else {
      await importSpaceFromAzure(config);
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
