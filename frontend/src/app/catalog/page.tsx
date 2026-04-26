import { Suspense } from "react";
import CatalogClient from "./CatalogClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-24 text-white/60">Загрузка каталога...</div>
      }
    >
      <CatalogClient />
    </Suspense>
  );
}
