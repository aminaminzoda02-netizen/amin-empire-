# 👑 AMIN EMPIRE — FINAL 1.0

One local Express + SQLite backend with a unified student frontend.

## Included
- Registration / login with bcrypt + JWT
- Student/admin roles
- SQLite persistence
- Courses + lessons
- Enrollments
- Lesson progress
- XP + levels
- Automatic certificate issuance
- Public certificate verification
- Admin statistics
- Order records
- Amin AI demo endpoint
- Unified frontend

## Run
1. Install Node.js 18+.
2. `npm install`
3. Copy `.env.example` to `.env` and change JWT_SECRET.
4. Start: `npm start`
5. Open `http://localhost:3000`
6. Create an admin:
   `npm run create-admin -- admin@example.com StrongPassword123`

## Important
This is a development starter, not a production deployment. Payment is intentionally not connected to real money. Do not put card numbers, passwords, JWT secrets, or provider API keys into frontend files.

Before production: use HTTPS, a strong secret, secure cookies/token strategy, validation/rate limiting, backups, logging, CSRF/CORS hardening, payment-provider verification/webhooks, real AI provider configuration, and a production database/hosting setup.

## Admin Panel
Open `/admin.html`. Login with an account created using `npm run create-admin -- admin@example.com StrongPassword123`. The panel can view admin-only stats and create courses/lessons. Students never receive these admin statistics through the student UI.

## Payment architecture
`Order → Provider checkout → Provider webhook → paid order → enrollment`.
The starter does **not** claim a live SmartPay connection. Real provider endpoints, signatures, credentials and webhook format must be verified against the provider's current official documentation before production use. Never put API keys or card data in the frontend.

## Mobile
A mobile-first shell is available at `/mobile.html` and uses the same API/backend.

## Admin V3
Admin now has management views for Students, Orders and Certificates, plus backend CRUD endpoints for courses and lessons. Business statistics remain admin-only.

## Advanced Analytics
Admin-only analytics are available at `/analytics.html` and are sourced from the server database.


## Final package
This ZIP is the consolidated package. You do not need the older separate ZIPs. See `FINAL_CHECKLIST.md` for the exact setup and the remaining production requirements.
