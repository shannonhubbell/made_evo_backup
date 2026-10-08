interface ImportMetaEnv {
  CONTENTFUL_WEBHOOK_SECRET: string;
  CONTENTFUL_SPACE_ID: string;
  CONTENTFUL_ENVIRONMENT_ID: string;
  CONTENTFUL_MANAGEMENT_TOKEN: string;
  AZURE_STORAGE_CONNECTION_STRING: string;
  AZURE_STORAGE_CONTAINER_NAME: string;
  SQUARE_APPLICATION_ID: string;
  SQUARE_ACCESS_TOKEN: string;
  SQUARE_LOCATION_ID: string;
  SQUARE_ENVIRONMENT?: string; // 'sandbox' or 'production', defaults to 'sandbox'
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Square Web Payments SDK global type
declare global {
  interface Window {
    Square?: {
      payments: (applicationId: string, locationId: string) => any;
    };
  }
  const Square: {
    payments: (applicationId: string, locationId: string) => any;
  } | undefined;
} 