# School Manage

Full-stack school management system with **React**, **NestJS**, **Prisma**, and **PostgreSQL**.

## Features

- **Auth**: Admin, staff, and student logins (JWT)
- **Targeted posts**: Admin can publish to all users, a role, a class, or selected users
- **Attendance**: Staff/admin mark daily attendance; students view their records
- **Grade cards**: Record scores and view subject summaries
- **Fees**: Create dues, track payments, mark paid
- **Assignments**: Create, submit, and grade classwork
- **Leave requests**: Students/staff request leave; staff/admin review
- **Messaging**: Internal inbox/sent messages
- **Staff students**: Staff manage students in their assigned class

## Project structure

```
school manage/
├── backend/          NestJS + Prisma API
├── frontend/         React (Vite) UI
└── docker-compose.yml
```

## Prerequisites

- Node.js 20+
- PostgreSQL 16+ (or Docker)

## Setup

### 1. Database

With Docker:

```bash
docker compose up -d
```

Or create a local PostgreSQL database and set `DATABASE_URL` in `backend/.env`:

```
DATABASE_URL="postgresql://school:school123@localhost:5432/school_manage?schema=public"
JWT_SECRET=school-manage-jwt-secret-change-in-production
JWT_EXPIRES_IN=7d
PORT=3000
```

### 2. Backend

```bash
cd backend
npm install
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

API: `http://localhost:3000/api`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173`

Optional `frontend/.env`:

```
VITE_API_URL=http://localhost:3000/api
```

## Demo accounts

Password for all: `password123`

| Role    | Email                |
|---------|----------------------|
| Admin   | admin@school.com     |
| Staff   | staff@school.com     |
| Student | student@school.com   |

## Prisma models

Defined in `backend/prisma/schema.prisma`:

- `User`, `StudentProfile`, `StaffProfile`, `SchoolClass`
- `Post`, `PostTarget`
- `Attendance`, `Grade`, `Fee`
- `Assignment`, `AssignmentSubmission`
- `LeaveRequest`, `Message`

## Main API routes

| Area        | Base path        |
|-------------|------------------|
| Auth        | `/api/auth`      |
| Users       | `/api/users`     |
| Classes     | `/api/classes`   |
| Posts       | `/api/posts`     |
| Attendance  | `/api/attendance`|
| Grades      | `/api/grades`    |
| Fees        | `/api/fees`      |
| Assignments | `/api/assignments`|
| Leave       | `/api/leave`     |
| Messages    | `/api/messages`  |
