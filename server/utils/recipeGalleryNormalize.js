/**
 * @param {unknown} raw
 * @param {string | null | undefined} recipeUserId
 * @returns {{ url: string; uploadedBy: string | null; storagePath: string | null }[]}
 */
export function normalizeGalleryImagesArray(raw, recipeUserId) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (typeof item === "string" && item.length > 0) {
      out.push({
        url: item,
        uploadedBy: recipeUserId || null,
        storagePath: null,
      });
    } else if (item && typeof item === "object" && typeof item.url === "string") {
      out.push({
        url: item.url,
        uploadedBy:
          typeof item.uploadedBy === "string" ? item.uploadedBy : recipeUserId || null,
        storagePath: typeof item.storagePath === "string" ? item.storagePath : null,
      });
    }
  }
  return out;
}

/**
 * @param {{ url: string; uploadedBy: string | null; storagePath?: string | null }[]} entries
 */
export function galleryImagesForApiResponse(entries) {
  return entries.map((e) => ({
    url: e.url,
    uploadedBy: e.uploadedBy,
  }));
}
