import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { notFound } from "../../utils/AppError.js";
import { paging } from "../catalog.js";

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Builds list / get / create / update / delete routes for a model.
 * opts: { create, update (zod schemas), search: [fields], populate, sort, filter(query) => {}, before(body, doc?), after(doc), beforeDelete(id) }
 */
export function crud(Model, opts = {}) {
  const r = Router();
  const name = Model.modelName;

  r.get("/", async (req, res) => {
    const f = { ...(opts.filter?.(req.query) || {}) };
    if (req.query.q && opts.search) f.$or = opts.search.map((k) => ({ [k]: new RegExp(esc(String(req.query.q)), "i") }));
    const { limit, page, skip } = paging(req.query, 200);
    const [items, total] = await Promise.all([
      Model.find(f).sort(opts.sort || { createdAt: -1 }).skip(skip).limit(limit).populate(opts.populate || []),
      Model.countDocuments(f),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  });

  r.get("/:id", async (req, res) => {
    const item = await Model.findById(req.params.id).populate(opts.populate || []);
    if (!item) throw notFound(name);
    res.json({ item });
  });

  if (opts.create)
    r.post("/", validate(opts.create), async (req, res) => {
      const body = opts.before ? await opts.before(req.body) : req.body;
      res.status(201).json({ item: await Model.create(body) });
    });

  if (opts.update)
    r.patch("/:id", validate(opts.update), async (req, res) => {
      const item = await Model.findById(req.params.id);
      if (!item) throw notFound(name);
      Object.assign(item, opts.before ? await opts.before(req.body, item) : req.body);
      await item.save();
      await opts.after?.(item);
      res.json({ item });
    });

  r.delete("/:id", async (req, res) => {
    const item = opts.beforeDelete ? await opts.beforeDelete(req.params.id) : null;
    const del = item ?? (await Model.findByIdAndDelete(req.params.id));
    if (!del) throw notFound(name);
    res.json({ message: `${name} deleted` });
  });

  return r;
}
