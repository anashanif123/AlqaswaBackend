export const slugify = (s = "") =>
  s.toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Makes a slug unique within a model by appending -2, -3 ... */
export async function uniqueSlug(Model, base, ignoreId) {
  const root = slugify(base) || "item";
  let slug = root, n = 1;
  while (await Model.exists({ slug, ...(ignoreId && { _id: { $ne: ignoreId } }) })) slug = `${root}-${++n}`;
  return slug;
}
