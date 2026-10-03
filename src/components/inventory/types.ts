/**
 * INVENTORY UI — LOCAL VIEW TYPES
 * ============================================================================
 * A3 owns this file. It adds NOTHING to the wire contract: every field here is
 * either copied out of `src/lib/inventory-types.ts` or is a pure UI concern
 * (a filter name, a sort key, a sort direction).
 *
 * `InventoryProductRef` exists because six components need to render "a thing
 * that can have stock moved in or out of it" — the mutation dialog, the stock
 * block, the ledger header, the reorder row, the ageing row, the count line —
 * and none of them need the full `ProductDto`. Narrowing here means a component
 * cannot accidentally read `costPrice` off a prop that was never meant to carry
 * it, which is exactly the leak the brief calls "survival".
 * ============================================================================
 */

import type { ProductDto, ProductKindValue, StockLevelDto, UnitValue } from "@/lib/inventory-types";

/** The minimum a component needs to render a stockable line. */
export interface InventoryProductRef {
  id: string;
  sku: string;
  name: string;
  kind: ProductKindValue;
  unit: UnitValue;
  stock: StockLevelDto;
  reorderPoint: number;
  reorderQty: number;
}

/**
 * Narrow a full `ProductDto` to the stockable ref. `ProductDto.stock` is
 * required by the contract, so this never has to invent a default — a product
 * with no `StockLevel` row is the server's problem, not the UI's, and silently
 * substituting zeroes here is how a real stockout becomes an invisible one.
 */
export function toProductRef(product: ProductDto): InventoryProductRef {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    kind: product.kind,
    unit: product.unit,
    stock: product.stock,
    reorderPoint: product.reorderPoint,
    reorderQty: product.reorderQty,
  };
}

/** The stock-list filter row, in the order it is shown. */
export const STOCK_FILTERS = ["ALL", "LOW", "OUT", "TYRES"] as const;
export type StockFilter = (typeof STOCK_FILTERS)[number];

export const STOCK_FILTER_LABEL: Record<StockFilter, string> = {
  ALL: "All",
  LOW: "Low",
  OUT: "Out",
  TYRES: "Tyres",
};

/** Columns the operator can sort by. `cost`/`margin` are staff-only fields. */
export type ProductSortKey =
  | "sku"
  | "name"
  | "kind"
  | "available"
  | "onHand"
  | "reserved"
  | "cost"
  | "sell"
  | "margin";

export const PRODUCT_SORT_KEYS: ReadonlyArray<ProductSortKey> = [
  "sku",
  "name",
  "kind",
  "available",
  "onHand",
  "reserved",
  "cost",
  "sell",
  "margin",
];

export type SortDir = "asc" | "desc";

/** The exact query the stock list sends. Mirrored by the API contract in `api.ts`. */
export interface StockQuery {
  q: string;
  kind: ProductKindValue | "ALL";
  filter: StockFilter;
  sort: ProductSortKey;
  dir: SortDir;
  page: number;
  pageSize: number;
}

export const DEFAULT_STOCK_QUERY: StockQuery = {
  q: "",
  kind: "ALL",
  filter: "ALL",
  sort: "sku",
  dir: "asc",
  page: 1,
  pageSize: 50,
};