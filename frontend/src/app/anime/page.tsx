import { Suspense } from "react";
import AnimeClient from "./AnimeClient";

export const dynamic = "force-static";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-24 text-white/60">Загрузка...</div>
      }
    >
      <AnimeClient />
    </Suspense>
  );
}
