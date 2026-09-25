# 👑 AMIN EMPIRE — FINAL 1.0.1

## Як чизро скачат кун
Ин ZIP ягона бастаи муттаҳидшуда аст. ZIP-ҳои кӯҳнаро лозим нест нигоҳ дорӣ.

## Дар дохил
- Student website / portal
- Mobile-first page + PWA install shell
- Admin panel
- Registration/login, roles, JWT + bcrypt
- Courses, lessons, progress, enrollments
- Quiz / exam
- XP, levels, rewards, achievements
- Notifications
- Certificates + verification
- Orders + generic payment webhook architecture
- Admin students/orders/certificates
- Admin analytics
- Amin AI demo/provider-ready endpoint
- SQLite database
- Setup scripts for Windows and Linux/macOS

## Барои ба кор даровардан
1. Node.js 18+ насб кун.
2. ZIP-ро extract кун.
3. Windows: `SETUP_WINDOWS.bat`-ро иҷро кун.
   Linux/macOS: `./SETUP_LINUX_MAC.sh`.
4. `.env`-ро кушода `JWT_SECRET`-и қавӣ мон.
5. `npm start`.
6. Браузер: `http://localhost:3000`.
7. Admin: `npm run create-admin -- admin@example.com StrongPassword123`.
8. Admin panel: `/admin.html`.

## Барои 100% production online ҳанӯз берун аз код лозим аст
- Hosting/server + HTTPS
- Domain (масалан aminempire.tj, агар дастрас бошад)
- Payment provider account + merchant credentials + verified webhook
- Production database/backups/logging
- Security hardening/rate limiting/CORS/cookies
- AI provider key, агар AI-и воқеӣ фаъол шавад
- Email/SMS/push provider, агар лозим шавад
- Android/iOS store packaging and publishing

Инҳо бе аккаунтҳо ва credential-ҳои воқеӣ аз дохили ZIP худкор сохта намешаванд.
Ҳеҷ card number, API secret ё JWT secret дар frontend ҷойгир нашудааст.
