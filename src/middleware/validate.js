import { AppError } from "../utils/AppError.js";

/** Validates req.body with a zod schema and replaces it with the parsed value. */
export const validate = (schema) => (req, _res, next) => {
  const r = schema.safeParse(req.body ?? {});
  if (!r.success) {
    const i = r.error.issues[0];
    throw new AppError(`${i.path.join(".") || "body"}: ${i.message}`, 422);
  }
  req.body = r.data;
  next();
};

/** Drops keys starting with "$" or containing "." to block NoSQL operator injection. */
export function sanitize(req, _res, next) {
  const clean = (o) => {
    if (o && typeof o === "object")
      for (const k of Object.keys(o)) (k.startsWith("$") || k.includes(".")) ? delete o[k] : clean(o[k]);
  };
  clean(req.body);
  clean(req.params);
  next();
}
