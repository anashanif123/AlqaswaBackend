# Al Qaswa API

Node 20+ · Express 5 · MongoDB (Mongoose) · JWT auth · Zod validation · Multer uploads.

```bash
cp .env.example .env   # MONGO_URI, JWT_SECRET, CLIENT_URL (comma-separated origins), ADMIN_EMAIL/PASSWORD
npm install
npm run seed           # add `-- --fresh` to wipe catalogue first
npm run dev            # watch mode     |  npm start  for production
```

Auth: send `Authorization: Bearer <token>` (from `/api/auth/login`). Admin routes need `role: "admin"`.
Prices, discounts and delivery are always computed on the server; stock is reserved atomically when an
order is placed and returned when it is cancelled/returned.

## Public endpoints (`/api`)
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | → `{ token, user }` |
| GET/PATCH | `/auth/me` | profile (name, phone) |
| PATCH | `/auth/me/password` | `{ current, password }` |
| POST/DELETE | `/auth/me/addresses[/:id]` | saved addresses |
| GET | `/auth/me/wishlist` · POST `/auth/me/wishlist/:productId` | toggle |
| GET | `/categories`, `/categories/:slug` | with product counts |
| GET | `/products` | `q, category (slug), min, max, sale, inStock, featured, ids, sort (new, popular, price-asc, price-desc, rating), page, limit` |
| GET | `/products/:slug` | `{ item, related }` |
| GET/POST | `/products/:id/reviews` | posting needs login (one review per user, re-post updates) |
| POST | `/cart/quote` | `{ items:[{product, qty, size}], coupon }` → totals |
| POST | `/orders` | guest or logged in; `{ items, coupon, email, paymentMethod: cod|bank, note, shippingAddress }` |
| GET | `/orders/mine` · `/orders/:number[?phone=]` | own orders / tracking by phone |
| POST | `/orders/:number/cancel` | while pending/confirmed |
| GET | `/settings` | public store settings |
| POST | `/newsletter`, `/contact` | `contact.type`: `contact` or `bridal` |

## Admin endpoints (`/api/admin`, admin token)
| Resource | Endpoints |
|---|---|
| Dashboard | `GET /stats` — revenue, orders, daily sales (30 days), status counts, best sellers, low stock, recent orders |
| Products | `GET/POST /products`, `GET/PATCH/DELETE /products/:id`, `POST /products/bulk-discount {category|products, percent}` (0 ends sale), `POST /products/bulk {ids, action: activate|deactivate|feature|unfeature|delete}` |
| Categories | CRUD `/categories` (delete blocked while it has products) |
| Discount codes | CRUD `/coupons` — percent/fixed, min order, max discount, total & per-customer limits, start/expiry, category-limited |
| Orders | `GET /orders?status&payment&q&from&to`, `GET/PATCH/DELETE /orders/:id` — status (auto restock on cancel/return), payment status, tracking no., history note |
| Users | `GET /users?role&blocked&q`, `POST /users` (create customer/admin), `PATCH /users/:id` (role, block, reset password), `DELETE`, `GET /users/:id/orders` |
| Reviews | `GET /reviews`, `PATCH /reviews/:id {approved}`, `DELETE` |
| Messages / subscribers | CRUD-lite `/messages` (mark handled), `/subscribers` |
| Settings | `GET/PUT /settings` — announcement bar, delivery fee, free-delivery threshold, contact info, bank details, payment methods |
| Uploads | `POST /upload` (multipart `images`, up to 10 × 5 MB) → `{ urls }`, `DELETE /upload/:file` |

All list endpoints accept `q`, `page`, `limit` and return `{ items, total, page, pages }`.
