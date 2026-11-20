# ShopSphere: E-commerce Backend on AWS (CI/CD project)

A shopping cart backend built with Node.js, Express, TypeScript, Prisma and MySQL, containerized with Docker. Deployment to AWS ECS Fargate with a CI/CD pipeline is in progress.

## Features
- Customer registration and login (JWT + bcrypt)
- Product listing and search
- Shopping cart: add, view, remove items
- Checkout with stock updates inside a database transaction
- Order history
- Admin-only product creation
- Health check endpoint for load balancer monitoring

## Tech Stack
| Layer | Technology |
|---|---|
| Backend | Node.js 22, Express, TypeScript |
| Database | MySQL 8.4 with Prisma ORM |
| Auth | JWT, bcryptjs |
| Testing | Jest, Supertest |
| Container | Docker (multi-stage build) |

## API Endpoints
| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/health | Health check |
| POST | /api/auth/register | Register customer |
| POST | /api/auth/login | Login, returns JWT |
| GET | /api/products?search= | List or search products |
| POST | /api/products | Create product (admin) |
| POST | /api/cart | Add to cart |
| GET | /api/cart | View cart |
| DELETE | /api/cart/:id | Remove cart item |
| POST | /api/orders | Checkout |
| GET | /api/orders | Order history |

## Run Locally
```bash
cd server
npm install
# create a .env file from .env.example, then edit the values
docker run --name shopsphere-mysql -e MYSQL_ROOT_PASSWORD=ShopLocal123 -e MYSQL_DATABASE=shopsphere -p 3307:3306 -d mysql:8.4
npx prisma migrate dev --name initial
npm run seed
npm run dev
```

## Run with Docker
```bash
docker build -t shopsphere-backend:1.0 server
```

## Progress
- [x] Backend API with authentication, cart and checkout
- [x] Prisma schema and migration
- [x] Unit test for health endpoint
- [x] Docker image built and tested locally
- [ ] AWS infrastructure (VPC, RDS, ECR, ECS Fargate, ALB)
- [ ] CI/CD pipeline (CodePipeline, CodeBuild)
- [ ] React frontend (S3 and CloudFront)

## Author
Gowtham K

GitHub: https://github.com/gowthamkaws
