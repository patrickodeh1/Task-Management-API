# Task Management API

A RESTful API for managing tasks with user authentication, role-based access (admin/user), image uploads, and a leaderboard feature. Built with Node.js, Express, MongoDB, and JWT.

## Table of Contents
- [Features](#features)
- [Setup](#setup)
- [API Endpoints](#api-endpoints)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Design Decisions](#design-decisions)

## Features
- User registration and login with JWT authentication.
- Task CRUD operations (create, read, update, delete).
- Task assignment to other users.
- Image uploads for tasks (JPEG/PNG, max 5MB).
- Filtering and sorting tasks by status, priority, or due date.
- Leaderboard of users by completed tasks.
- Role-based access: Admins see all tasks, users see only their own.

## Setup

### Prerequisites
- Node.js (v16+ recommended)
- MongoDB (local or cloud, e.g., MongoDB Atlas)
- npm

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/patrickodeh1/Task-Management-System.git
   cd Task-Management-API

2. Install dependencies:
    ```bash
    npm install

3. Create a .env file in the root directory:
    ```env
    PORT=5000
    MONGO_URI=mongodb://localhost/task-management-api
    JWT_SECRET=mysecretkey
    ```
    - MONGO_URI: Use mongodb://localhost/task-management-api for a local MongoDB instance (default). Replace it with your cloud connection string (e.g., from MongoDB Atlas) if using a cloud database.

    - Replace JWT_SECRET with a strong, random secret key. You can generate one using:
    ```bash
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    ```
    This creates a 64-character hexadecimal string (e.g., a1b2c3...). Copy the output into your .env file as JWT_SECRET=your-generated-key.

4. Create an uploads/ directory for image storage:
    ```bash
    mkdir uploads

5. Run the server:
    ```bash
    npm start

- Server runs on http://localhost:5000 (or your PORT).

# API Endpoints

## Authentication
| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| POST   | /api/auth/register | Register a new user | { "name": "string", "email": "string", "password": "string" } | 200 { "token": "jwt" } |
| POST | /api/auth/login | Login and get token | { "email": "string", "password": "string" } | 200 { "token": "jwt" } |
--------------------------------------------------------------


## Tasks

All task endpoints require an Authorization header: Bearer <token\>.

|Method | Endpoint | Description | Request Body / Query Params | Response |
|-------|----------|-------------|-----------------------------|----------|
| POST | /api/tasks | Create a task | { "title": "string", "description": "string", "status": "string", "priority": "string", "dueDate": "ISO8601", "assignedTo": "ObjectId", "image": "file" } | 201 { task }|
| GET  | /api/tasks | Fetch tasks (filtered) | ?status=string&priority=string&dueDate=ISO8601&sort=field | 200 [tasks]
| PUT  | /api/tasks/:id | Update a task | { "title": "string", "status": "string", ... } | 200 { task } |
| DELETE | /api/tasks/:id | Delete a task | - | 200 { "msg": "Task deleted" } |
| GET | /api/tasks/leaderboard | Get completed task rankings | - | 200 [{ "name": "string", "email": "string", "completedTasks": number }] |
---------------------------------------------------------------------------

- Notes:
    - status: e.g., "To Do", "In Progress", "Completed".

    - priority: e.g., "Low", "Medium", "High".

    - sort: e.g., "dueDate", "-dueDate" (descending).

    - Image uploads use multipart/form-data.


## Authentication

- Use the JWT token from /api/auth/login in the Authorization header:
    ```
    Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

- Tokens expire in 1 hour.


## Error Handling
- 400: Bad request (validation errors, invalid credentials).
    - { "msg": " Invalid credentials" }

    - { "errors": [{ "msg": "Title is required" }] }

- 401: Unauthorized (missing/invalid token).
    - { "msg": "No token, authorization denied" }

- 403: Forbidden (role-based access denied).
    - { "msg": "Not authorized to update this task" }

- 404: Not found.
    - { "msg": "Task not found" }

- 500: Server error.
    - { "msg": "Server error" }


## Testing
1. Install test dependencies:
    ```bash
    npm install --save-dev jest supertest mongodb-memory-server

2. Run tests:
    ```bash
    npm test
    ```
    - Uses MongoMemoryServer for an in-memory database.
    - Tests cover authentication, task CRUD, and role-based access.


## Example Usage

Register a User
```bash
curl -X POST http://localhost:3000/api/auth/register \
-H "Content-Type: application/json" \
-d '{"name": "John Doe", "email": "john@example.com", "password": "123456"}'
```

Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
-H "Content-Type: application/json" \
-d '{"email": "john@example.com", "password": "123456"}'
```

Create a Task with Image
```bash
curl -X POST http://localhost:3000/api/tasks \
-H "Authorization: Bearer <token>" \
-F "title=Test Task" \
-F "description=Test Description" \
-F "status=To Do" \
-F "priority=Medium" \
-F "image=@test.png"
```

Get Leaderboard
```bash
curl http://localhost:3000/api/tasks/leaderboard \
-H "Authorization: Bearer <token>"
```

## Design Decisions

The following choices were made to balance simplicity, security, and functionality:

- Node.js and Express: Selected for their lightweight, event-driven architecture, ideal for RESTful APIs. Express simplifies routing and middleware, accelerating development.

- MongoDB: A NoSQL database was chosen for its schema flexibility, accommodating optional task fields (e.g., image, dueDate). Its JSON-like documents integrate seamlessly with the API.

- JWT Authentication: Provides stateless, secure user authentication. A 1-hour token expiration enhances security while remaining user-friendly, with re-login as a simple renewal mechanism.

- Role-Based Access: Implemented with user and admin roles to enforce data privacy (users see only their tasks) and administrative control (admins see all tasks), using middleware for scalability.

- Image Uploads via Multer: Added to enrich tasks with visuals, limited to JPEG/PNG and 5MB to control resource usage. Multer’s simplicity made it the preferred choice.

- Leaderboard: Built with MongoDB aggregation for efficient querying of completed tasks, offering a motivational feature and admin insights into user performance.

- Middleware: Authentication (authMiddleware) and authorization (adminMiddleware) are separated for reusability and maintainability across routes.

- Error Handling: Consistent JSON responses (e.g., { "msg": "..." }) and express-validator ensure robust input validation and clear feedback.

- Testing: Jest with MongoMemoryServer enables fast, isolated unit tests, ensuring reliability without a persistent database dependency.
