// Fallback for sidebar pages not built yet. Real routes added in later phases
// take precedence over this catch-all.
import { notFound } from "next/navigation";
import { renderPlaceholder } from "../placeholder";

export default async function PlaceholderPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const page = await renderPlaceholder(`/${slug.join("/")}`);
  if (!page) notFound();
  return page;
}
