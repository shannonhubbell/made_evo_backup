/**
 * Square Catalog Types
 * 
 * Auto-generated from Square Catalog API
 * Last updated: 2026-03-01T01:19:36.679Z
 * 
 * Run: npm run query:square-catalog
 */

export interface SquareCatalogItem {
  id: string;
  type: 'ITEM';
  itemData: {
    name: string;
    description?: string;
    categoryId?: string;
    variations?: Array<{
      id: string;
      type: 'ITEM_VARIATION';
      itemVariationData: {
        name: string;
        itemId: string;
        priceMoney?: {
          amount: string; // Amount in cents
          currency: string;
        };
        sku?: string;
      };
    }>;
  };
}

export interface SquareCatalogResponse {
  objects: SquareCatalogItem[];
  cursor?: string;
}


/**
 * General Admission Item
 * Extracted from Square Catalog
 */
export const GENERAL_ADMISSION_ITEM: SquareCatalogItem = {
  "type": "ITEM",
  "id": "VORJGFMP5M2NMMENCLCM3YN7",
  "updated_at": "2026-01-05T05:14:23.683Z",
  "created_at": "2025-12-31T07:27:35.634Z",
  "version": 1767590063683,
  "is_deleted": false,
  "present_at_all_locations": true,
  "item_data": {
    "name": "General Admission",
    "is_taxable": true,
    "variations": [
      {
        "type": "ITEM_VARIATION",
        "id": "J4RJX6N3O2XP6DFH5QCN63Y2",
        "updated_at": "2025-12-31T07:39:09.941Z",
        "created_at": "2025-12-31T07:27:35.634Z",
        "version": 1767166749941,
        "is_deleted": false,
        "present_at_all_locations": true,
        "item_variation_data": {
          "item_id": "VORJGFMP5M2NMMENCLCM3YN7",
          "name": "Regular",
          "ordinal": 1,
          "pricing_type": "FIXED_PRICING",
          "price_money": {
            "amount": 2000,
            "currency": "USD"
          },
          "track_inventory": false,
          "sellable": true,
          "stockable": true
        }
      }
    ],
    "product_type": "REGULAR",
    "skip_modifier_screen": false,
    "image_ids": [
      "U3FORNS2HODTU6XLBL4KYHFW"
    ],
    "categories": [
      {
        "id": "3NMR3OP3QQMLKLFLLGGJMUVC",
        "ordinal": -2251799796908032
      }
    ],
    "is_archived": false,
    "reporting_category": {
      "id": "3NMR3OP3QQMLKLFLLGGJMUVC",
      "ordinal": -2251799796908032
    }
  }
};

export const GENERAL_ADMISSION_VARIATION_ID = "J4RJX6N3O2XP6DFH5QCN63Y2";

