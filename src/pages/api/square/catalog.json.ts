/**
 * Square Catalog Data Endpoint
 * 
 * Queries Square's Catalog API and returns catalog data as JSON.
 * This endpoint can be used for both static and server deployments.
 * 
 * For static builds, this will be called during the build process.
 * For server deployments, this will be called on-demand.
 */

import type { APIRoute } from 'astro';
import { getSquareEnv } from '../../../lib/square-env';

// Mark as server-rendered for dynamic data fetching
// export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const { squareAccessToken, squareLocationId, squareEnvironment } = getSquareEnv(context);
    
    if (!squareAccessToken || !squareLocationId) {
      console.error('Square API credentials not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Square API not configured',
          items: [],
          generalAdmission: null,
        }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          } 
        }
      );
    }
    
    // Determine Square API base URL based on environment
    const squareApiBaseUrl = squareEnvironment === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';
    
    // Query catalog items using SearchCatalogObjects endpoint
    const response = await fetch(`${squareApiBaseUrl}/v2/catalog/search`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${squareAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        object_types: ['ITEM'],
        limit: 100,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Square Catalog API Error:', errorData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorData.errors?.[0]?.detail || 'Failed to query Square catalog',
          items: [],
          generalAdmission: null,
        }),
        { 
          status: response.status, 
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          } 
        }
      );
    }
    
    const data = await response.json();
    
    // Extract items from the catalog
    const items = (data.objects || []).filter((obj: any) => obj.type === 'ITEM');
    
    // Find General Admission specifically
    // Note: Square API returns snake_case (item_data), not camelCase (itemData)
    const generalAdmission = items.find((item: any) => {
      const itemName = item.item_data?.name || item.itemData?.name;
      return itemName?.toLowerCase().includes('general admission') ||
             itemName?.toLowerCase().includes('admission');
    });
    
    // Format response
    const formattedItems = items.map((item: any) => {
      const itemData = item.item_data || item.itemData;
      const variations = itemData?.variations || [];
      return {
        id: item.id,
        name: itemData?.name || 'Unnamed',
        description: itemData?.description,
        variations: variations.map((variation: any) => {
          const varData = variation.item_variation_data || variation.itemVariationData;
          return {
            id: variation.id,
            name: varData?.name || 'Unnamed',
            priceMoney: varData?.price_money || varData?.priceMoney,
          };
        }),
      };
    });
    
    let generalAdmissionData = undefined;
    if (generalAdmission) {
      const itemData = generalAdmission.item_data || generalAdmission.itemData;
      const firstVariation = itemData?.variations?.[0];
      if (firstVariation) {
        const varData = firstVariation.item_variation_data || firstVariation.itemVariationData;
        generalAdmissionData = {
          id: generalAdmission.id,
          name: itemData?.name,
          variationId: firstVariation.id,
          price: varData?.price_money || varData?.priceMoney || {
            amount: '0',
            currency: 'USD',
          },
        };
      }
    }
    
    const result = {
      success: true,
      items: formattedItems,
      generalAdmission: generalAdmissionData,
      generatedAt: new Date().toISOString(),
      environment: squareEnvironment,
    };
    
    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        } 
      }
    );
    
  } catch (error) {
    console.error('Catalog query error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        items: [],
        generalAdmission: null,
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        } 
      }
    );
  }
};

