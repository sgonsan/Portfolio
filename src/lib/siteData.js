// Site content for SSR. In production Express injects it via locals
// (versioned cache, no HTTP hop). In `astro dev` there are no Express
// locals, so we fall back to fetching the API directly.
export async function getSiteData(Astro) {
  if (Astro.locals?.siteData) return Astro.locals.siteData;
  const res = await fetch('http://localhost:3000/api/content');
  if (!res.ok) throw new Error(`content API ${res.status}`);
  return res.json();
}
