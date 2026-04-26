import { Hero } from "@/components/Hero";
import { PosterRow } from "@/components/PosterRow";

export default function Home() {
  return (
    <div className="space-y-12">
      <Hero />
      <PosterRow title="Свежие релизы" endpoint="/anime/latest?limit=12" href="/catalog" />
      <PosterRow
        title="Сейчас в эфире"
        endpoint="/anime/catalog?publish_statuses=IS_ONGOING&limit=12&sorting=FRESH_AT_DESC"
        href="/catalog?ongoing=1"
      />
      <PosterRow
        title="Прошлый сезон"
        endpoint="/anime/catalog?from_year=2024&to_year=2025&limit=12&sorting=FRESH_AT_DESC"
        href="/catalog?from_year=2024&to_year=2025"
      />
    </div>
  );
}
