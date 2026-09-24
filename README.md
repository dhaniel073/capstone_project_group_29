# Supermarket Backend API (Capstone MVP)

Backend-only MVP for a supermarket platform. Customers browse products, manage a
cart, pay via Paystack from the mobile app, then confirm checkout with the backend.
Admins manage categories, products (Cloudinary image uploads), and order fulfilment.

## Payment Flow (Matches Existing Mobile App Pattern)

This mirrors the pattern already used elsewhere in the mobile app: the Paystack
**public key** lives on the client, the charge happens client-side, and only the
resulting transaction reference is sent to the backend.

1. Mobile app opens Paystack's SDK/checkout using the **public key** (`pk_test_...`
   or `pk_live_...`) with the cart total and the customer's email.
2. Customer completes the charge on their device. Paystack's SDK fires an
   `onSuccess` callback containing a transaction `reference`.
3. Mobile app calls `POST /api/checkout` with `{ reference }` and the user's JWT.
4. Backend independently calls Paystack's `GET /transaction/verify/:reference`
   using the **secret key** (never exposed to the client) to confirm the charge
   actually succeeded — the app's `onSuccess` callback is never trusted alone,
   since it runs in an environment that could be tampered with or replayed.
5. Backend re-checks the verified amount (in kobo) against the customer's
   current cart total. Any mismatch aborts the checkout with an error.
6. Only after both checks pass: the order is created, a Payment audit record is
   saved, stock is deducted per item, and the cart is cleared.
7. The same `reference` can never be reused for a second order (checked via a
   unique index + an explicit lookup before verification), which blocks replay
   attacks using an old successful reference.

### Why we don't call Paystack's Initialize endpoint
Because the mobile app already handles charge initialization itself via the
Paystack public key + SDK — that's the "Initialize" step, just done client-side.
The backend's only job is Verify, never Initialize, in this pattern.

## Problem Being Solved
Small supermarkets need a system to manage inventory, categories, and take real
online payments from customers, with role-based access separating customer and
admin operations.

## Target Users
- Customers: browse products, add to cart, pay via the mobile app, view order history.
- Admins: manage categories/products/stock, view all orders, update fulfilment status.

## Tech Stack
| Package | Version | Notes |
|---|---|---|
| express | ^5.1.0 | current npm `latest`; requires Node 18+ |
| mongoose | ^9.10.1 | |
| cloudinary | ^2.7.0 | Node SDK v2.x |
| Paystack | REST API, no SDK | backend calls Verify Transaction only, via native `fetch` |

## Project Structure
```
src/
  controllers/   business logic per resource (incl. checkoutController)
  routes/        express route definitions (incl. checkoutRoutes)
  models/        mongoose schemas (incl. Payment)
  middleware/    auth, validation, error handling, upload
  services/      cloudinary + paystack (verify only) service wrappers
  utils/         AppError, ApiResponse, catchAsync, token helper
  config/        db + cloudinary configuration
  validations/   zod schemas per resource
  app.js         app entry point
tests/           jest + supertest tests
```

## Installation
```
npm install
cp .env.example .env   # then fill in real values
npm run dev
```

## Environment Variables
| Variable | Description |
|---|---|
| PORT | Port the server listens on |
| MONGO_URI | MongoDB connection string |
| JWT_SECRET | Secret used to sign JWTs |
| JWT_EXPIRES_IN | Token expiry, e.g. 7d |
| CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET | Cloudinary credentials |
| PAYSTACK_SECRET_KEY | Server-side secret key. Never send this to the mobile app. |

The mobile app needs only the **public key**, configured directly in the app's
own build config — it is not an environment variable for this backend.

Never commit the real `.env` file.

## Running Tests
```
npm test
```

## API Overview

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/auth/register | No | Create account (customer/admin) |
| POST | /api/auth/login | No | Login, returns JWT |
| GET | /api/auth/me | Yes | Get current user profile |

### Categories
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/categories | No | List categories |
| POST /PUT /DELETE | /api/categories(/:id) | Admin | Manage categories |

### Products
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/products?search=&category=&page=&limit= | No | List/search/filter/paginate |
| GET | /api/products/:id | No | Get single product |
| POST /PUT | /api/products(/:id) | Admin | Create/update, multipart field `image` |
| DELETE | /api/products/:id | Admin | Delete product |

### Cart (customer only)
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/cart | View current cart |
| POST | /api/cart | Add item `{ productId, quantity }` |
| DELETE | /api/cart/:productId | Remove item |

### Checkout
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/checkout | Customer | Body: `{ reference }`. Verifies payment, creates order, deducts stock, clears cart. |

### Orders
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/orders | Customer | View own order history |
| GET | /api/orders/:id | Owner/Admin | View a single order |
| GET | /api/orders/admin/all | Admin | View all orders (filter by status, paginated) |
| PUT | /api/orders/admin/:id/status | Admin | Advance fulfilment status |

## Response Format
Success: `{ "success": true, "message": "...", "data": { } }`
Error: `{ "success": false, "message": "...", "data": null }`

## Deployment
Deploy to Render/Railway/Fly.io. Set all environment variables in the platform's
dashboard. Switch `PAYSTACK_SECRET_KEY` to a live key only once ready to accept
real money, and make sure the mobile app is built with the matching live public key.

## Notes for Team
- Lock down self-assigned `role: "admin"` on registration before final submission.
- Extend `src/validations` with new Zod schemas before adding new POST/PUT routes.
- Never log `PAYSTACK_SECRET_KEY` or full Paystack verify responses containing card data.
- If you later add a web frontend alongside the mobile app, consider adding a
  Paystack webhook as a second, independent confirmation path — useful if a
  customer pays but the mobile app crashes before calling /api/checkout.
