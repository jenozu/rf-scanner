import { isCustomerWarehouse, normalizeWarehouse } from "../../server/ops-logic.js";

/**
 * Shows the warehouse on a line when it is not the ordinary one. Warehouse 05 holds one
 * customer's parts and shares bin codes with 01, so the picker must see it on the line itself.
 */
export default function WarehouseBadge({ warehouse }: { warehouse?: string }) {
  if (!isCustomerWarehouse(warehouse)) return null;
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300"
      title={`Warehouse ${normalizeWarehouse(warehouse)}: customer stock. Same bin codes as 01.`}
    >
      WHS 05 · CUSTOMER STOCK
    </span>
  );
}
