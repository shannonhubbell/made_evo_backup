interface ImportMetaEnv {
    readonly CONTENTFUL_SPACE_ID: string;
    readonly CONTENTFUL_DELIVERY_TOKEN: string;
    readonly CONTENTFUL_PREVIEW_TOKEN: string;
    readonly CONTENTFUL_PREVIEW_SECRET: string;
    readonly CONTENTFUL_PREVIEW?: string;
    readonly CONTENTFUL_ENVIRONMENT?: string;
    readonly STATIC_BUILD?: string;
}

declare namespace App {
  interface Locals {
    previewMode?: boolean;
    runtime?: {
      env?: Record<string, string | undefined>;
    };
    runtimeEnv?: Record<string, string | undefined>;
  }
}