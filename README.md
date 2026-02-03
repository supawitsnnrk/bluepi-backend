# 🎰 Vending Machine API

REST API สำหรับระบบตู้ขายสินค้าอัตโนมัติ (Vending Machine) พัฒนาด้วย NestJS, TypeORM และ PostgreSQL

## 📋 Features

- ✅ **Product Management** - จัดการสินค้า ราคา และสต็อก
- ✅ **Cash Management** - จัดการธนบัตร/เหรียญ และคำนวณเงินทอน
- ✅ **Order Flow** - สร้างออเดอร์ หยอดเงิน เลือกสินค้า ซื้อ และยกเลิก
- ✅ **Change Calculation** - คำนวณเงินทอนอัตโนมัติด้วย Greedy Algorithm
- ✅ **Transaction Safety** - ใช้ Database Transaction ป้องกันข้อมูลผิดพลาด
- ✅ **Validation** - ตรวจสอบ input ทุก request ด้วย class-validator
- ✅ **Logging** - บันทึก log ทุก function call เพื่อ debugging
- ✅ **Test Coverage** - Unit tests และ E2E tests ครอบคลุม

## 🛠️ Tech Stack

- **Framework:** NestJS 9
- **Language:** TypeScript 4.7
- **Database:** PostgreSQL 14
- **ORM:** TypeORM 0.3
- **Validation:** class-validator, class-transformer
- **Testing:** Jest, Supertest
- **Containerization:** Docker, Docker Compose

## 📦 Prerequisites

ติดตั้งโปรแกรมเหล่านี้ก่อนใช้งาน:

- **Node.js** v18+ ([Download](https://nodejs.org/))
- **Yarn** package manager (`npm install -g yarn`)
- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop/))
- **PostgreSQL 14+** (optional - ถ้าไม่ใช้ Docker)

## 🚀 Installation

### 1. Clone โปรเจค

```bash
git clone <repository-url>
cd bluepi-testing
```

### 2. ติดตั้ง Dependencies

```bash
yarn install
```

### 3. ตั้งค่า Environment Variables

สร้างไฟล์ `.env` (มีอยู่แล้วใน repo):

```env
DB_HOST=localhost
DB_PORT=15431
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=bluepi-testing-service
```

## 🐳 Running with Docker (แนะนำ)

วิธีที่ง่ายที่สุด - รัน PostgreSQL และ API ใน Docker:

```bash
# Start services (PostgreSQL + API)
docker-compose up -d

# Check logs
docker-compose logs -f

# API จะรันที่: http://localhost:9000 (Docker)
# PostgreSQL port: 15431
```

**หมายเหตุ:** API จะรัน migration อัตโนมัติเมื่อ start ครั้งแรก

### หยุด Services

```bash
docker-compose down
```

## 💻 Running Locally (Without Docker)

### 1. เริ่ม PostgreSQL

```bash
# ถ้ามี PostgreSQL ติดตั้งแล้ว
psql -U postgres
CREATE DATABASE "bluepi-testing-service";
\q
```

### 2. Build และรัน Database Migrations

```bash
# Build project ก่อน
yarn build

# สร้างตารางและ seed ข้อมูลเริ่มต้น (denominations, cash stock)
yarn migration
```

### 3. Seed Demo Products (Optional)

```bash
# เริ่มแอพก่อน
yarn start:dev

# เรียก API seed products (Coca Cola, Pepsi, Water, etc.)
curl -X POST http://localhost:3000/api/seed/demo-products
```

### 4. เริ่ม Development Server

```bash
# watch mode (auto-reload)
yarn start:dev

# API รันที่: http://localhost:3000/api
```

## 🧪 Testing

```bash
# Unit tests ทั้งหมด (41 test cases)
yarn test

# Test coverage report
yarn test:cov

# Watch mode (auto-rerun on file changes)
yarn test:watch

# E2E tests (ต้องมี database running)
yarn test:e2e

# Test specific file
yarn test product.service.spec
yarn test order.service.spec
yarn test cash.service.spec
```

**Test Coverage:** ~85% (41+ unit tests, 17 E2E tests)

## 📚 API Documentation

### Base URL

```bash
# Docker
http://localhost:9000/api

# Local
http://localhost:3000/api
```

### Response Format

ทุก response จะถูก wrap ด้วย ResponseInterceptor:

```json
{
  "statusCode": 200,
  "data": { ... }
}
```

---

## 🎯 API Endpoints

### 🛍️ Products (6 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/products` | ดูสินค้าทั้งหมดที่พร้อมขาย (active) |
| GET | `/products/:id` | ดูข้อมูลสินค้าและสต็อก |
| POST | `/products` | สร้างสินค้าใหม่ (admin) |
| PATCH | `/products/:id` | แก้ไขข้อมูลสินค้า (admin) |
| PATCH | `/products/:id/stock` | เติม/ลดสต็อกสินค้า (admin) |
| DELETE | `/products/:id` | ลบสินค้า (soft delete) |

### 💰 Cash Management (5 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/cash/denominations` | ดูธนบัตร/เหรียญที่ใช้ได้ |
| POST | `/cash/denominations/validate` | ตรวจสอบธนบัตร/เหรียญ |
| GET | `/cash/stock` | ดูเงินในเครื่อง (admin) |
| PATCH | `/cash/stock/:denominationId` | เติมเงินในเครื่อง (admin) |
| POST | `/cash/calculate-change` | คำนวณเงินทอน (test) |

### 🛒 Orders (7 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/orders` | สร้างออเดอร์ใหม่ (เริ่มต้นซื้อของ) |
| GET | `/orders` | ดูออเดอร์ทั้งหมด |
| GET | `/orders/:id` | ดูรายละเอียดออเดอร์ |
| POST | `/orders/deposit` | หยอดเงิน (สร้างออเดอร์ใหม่อัตโนมัติถ้าไม่มี) |
| POST | `/orders/:id/select-product` | เลือกสินค้า |
| POST | `/orders/:id/purchase` | ซื้อสินค้า (หักสต็อก คำนวณเงินทอน) |
| POST | `/orders/:id/cancel` | ยกเลิกออเดอร์และคืนเงิน |

### 🌱 Seed (1 endpoint)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/seed/demo-products` | สร้างสินค้าทดสอบ 7 รายการ |

---

## 🔄 How to Use (Vending Machine Flow)

### วิธีใช้งานตู้ขายของ

```bash
# เปลี่ยน localhost:9000 เป็น localhost:3000 ถ้ารัน Local

# 1. Seed สินค้าทดสอบ (ครั้งแรกเท่านั้น)
curl -X POST http://localhost:9000/api/seed/demo-products

# 2. ดูสินค้าที่มี
curl http://localhost:9000/api/products

# 3. หยอดเงิน (จะสร้างออเดอร์ใหม่อัตโนมัติ)
curl -X POST http://localhost:9000/api/orders/deposit \
  -H "Content-Type: application/json" \
  -d '{
    "denominationId": "xxx-20-baht-id",
    "qty": 2
  }'

# Response: { "orderId": "xxx", "totalAmount": 40 }

# 4. เลือกสินค้า
curl -X POST http://localhost:9000/api/orders/{orderId}/select-product \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "xxx-coke-id"
  }'

# 5. กดซื้อ (dispense product + give change)
curl -X POST http://localhost:9000/api/orders/{orderId}/purchase

# Response: {
#   "success": true,
#   "orderId": "xxx",
#   "changeAmount": 20,
#   "change": [{ "amount": 20, "quantity": 1 }]
# }

# 6. (Optional) ยกเลิกออเดอร์
curl -X POST http://localhost:9000/api/orders/{orderId}/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Changed my mind"
  }'
```

## 📁 Project Structure

```
src/
├── database/
│   ├── migrations/           # Database migrations
│   ├── data-source.ts       # TypeORM config
│   └── typeorm.config.ts
├── modules/
│   ├── products/            # Product management
│   │   ├── entities/        # Product, ProductStock entities
│   │   ├── dto/             # Request/Response DTOs
│   │   ├── product.service.ts
│   │   └── product.controller.ts
│   ├── cash/                # Cash & denomination management
│   │   ├── entities/        # Denomination, CashStock entities
│   │   ├── dto/
│   │   ├── cash.service.ts
│   │   └── cash.controller.ts
│   ├── orders/              # Order & transaction flow
│   │   ├── entities/        # Order, OrderDeposits, OrderChange
│   │   ├── dto/
│   │   ├── order.service.ts
│   │   └── order.controller.ts
│   └── seed/                # Demo data seeding
│       ├── seed.service.ts
│       └── seed.controller.ts
├── shares/
│   ├── enums/               # OrderStatus, DenominationType
│   └── interceptors/        # Global response wrapper
├── app.module.ts
└── main.ts
```

## 🗃️ Database Schema

**ตารางหลัก 8 ตาราง:**

- `products` - สินค้า (name, price, sku, is_active)
- `product_stock` - สต็อกสินค้า (quantity)
- `denominations` - ธนบัตร/เหรียญ (amount, type: BILL/COIN)
- `cash_stock` - เงินในเครื่อง (quantity)
- `orders` - ออเดอร์ (status, paid_amount, change_amount)
- `order_deposits` - บันทึกเงินที่หยอด
- `order_change` - บันทึกเงินทอน
- `migrations` - Migration history

## 🎓 Key Concepts

### Transaction Safety

ทุกการทำงานที่เกี่ยวข้องกับเงินและสต็อกใช้ **Database Transaction**:
- ถ้าขั้นตอนใดผิดพลาด → rollback ทั้งหมด
- ป้องกันสต็อกติดลบ และเงินในเครื่องผิดพลาด

### Greedy Algorithm (Change Calculation)

คำนวณเงินทอนโดยใช้ธนบัตร/เหรียญใหญ่สุดก่อน:
```
เงินทอน 180 บาท จาก 1000-100-50-20-10-5-1
→ [100×1, 50×1, 20×1, 10×1] = 180 บาท
```

### Minimal Response

ทุก API ตอบกลับแค่ข้อมูลที่จำเป็น (ไม่ส่ง full entity):
```json
{
  "success": true,
  "orderId": "xxx",
  "changeAmount": 20
}
```

## 🔧 Common Commands

```bash
# Database
yarn migration              # Run migrations
yarn migration:revert       # Undo last migration
yarn typeorm migration:generate src/database/migrations/MigrationName

# Development
yarn start:dev              # Start with watch mode
yarn start:debug            # Start with debug mode
yarn build                  # Build production

# Code Quality
yarn format                 # Format code with Prettier
yarn lint                   # Run ESLint

# Docker
docker-compose up -d        # Start services
docker-compose down         # Stop services
docker-compose logs -f      # View logs
docker exec -it bluepi-testing-service sh  # Access container
```

## 🐛 Troubleshooting

### ปัญหา: Migration ไม่ทำงาน
```bash
# ลบ database แล้วสร้างใหม่
docker-compose down -v
docker-compose up -d
```

### ปัญหา: Port 15431 ถูกใช้แล้ว
```bash
# เปลี่ยน port ใน docker-compose.yml
ports:
  - "15432:5432"  # เปลี่ยนเป็น 15432
```

### ปัญหา: Cannot make exact change
```bash
# เติมเงินในเครื่อง (เหรียญ/แบงก์)
curl -X PATCH http://localhost:9000/api/cash/stock/{denominationId} \
  -H "Content-Type: application/json" \
  -d '{ "deltaQty": 100 }'
```

## 📝 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `15431` | PostgreSQL port |
| `DB_USERNAME` | `postgres` | Database username |
| `DB_PASSWORD` | `password` | Database password |
| `DB_NAME` | `bluepi-testing-service` | Database name |

## 📊 Initial Data (from migrations)

**Denominations (8 ชนิด):**
- เหรียญ: 1, 5, 10 บาท
- แบงก์: 20, 50, 100, 500, 1000 บาท

**Cash Stock (เงินในเครื่องเริ่มต้น):**
- เหรียญ 1,5,10: อย่างละ 1,000 เหรียญ
- แบงก์ 20,50: อย่างละ 200 ใบ
- แบงก์ 100: 300 ใบ
- แบงก์ 500: 100 ใบ
- แบงก์ 1000: 20 ใบ
- **รวม ~130,000 บาท**

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is [MIT licensed](LICENSE).

---

**Built with ❤️ using NestJS**
