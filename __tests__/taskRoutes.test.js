const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');
const taskRoutes = require('../src/routes/taskRoutes');
const authRoutes = require('../src/routes/authRoutes');
const User = require('../src/models/User');
const Task = require('../src/models/Task');

const app = express();
let mongoServer;

beforeAll(async () => {
  process.env.JWT_SECRET = 'mysecretkey';
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  app.use(express.json());
  app.use('/api/tasks', taskRoutes);
  app.use('/api/auth', authRoutes);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Task.deleteMany({});
});

describe('Task Management API', () => {
  let userToken, adminToken, userId, adminId;

  beforeEach(async () => {
    const salt = await bcrypt.genSalt(10);
    const userPassword = await bcrypt.hash('123456', salt);
    const adminPassword = await bcrypt.hash('admin123', salt);

    const user = new User({
      name: 'John Doe',
      email: 'john@example.com',
      password: userPassword,
      role: 'user',
    });
    await user.save();
    userId = user._id;

    const admin = new User({
      name: 'Admin User',
      email: 'admin@example.com',
      password: adminPassword,
      role: 'admin',
    });
    await admin.save();
    adminId = admin._id;

    const userRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john@example.com', password: '123456' });
    userToken = userRes.body.token;

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'admin123' });
    adminToken = adminRes.body.token;
  });

  test('POST /api/auth/login - Successful login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john@example.com', password: '123456' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  test('POST /api/auth/login - Failed login (wrong password)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john@example.com', password: 'wrong' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('msg', 'Invalid credentials');
  });


  test('POST /api/tasks - Create task with image', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${userToken}`)
      .field('title', 'Test Task')
      .field('description', 'Test Description')
      .field('status', 'To Do')
      .field('priority', 'Medium')
      .attach('image', `${__dirname}/test.png`);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('title', 'Test Task');
    expect(res.body).toHaveProperty('image', expect.stringContaining('/uploads/'));
  });

  test('GET /api/tasks - Fetch tasks with filter', async () => {
    await new Task({
      title: 'Task 1',
      status: 'To Do',
      createdBy: userId,
      assignedTo: userId,
    }).save();

    const res = await request(app)
      .get('/api/tasks?status=To%20Do')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toHaveProperty('status', 'To Do');
  });

  test('PUT /api/tasks/:id - Update task status', async () => {
    const task = await new Task({
      title: 'Task to Update',
      status: 'To Do',
      createdBy: userId,
      assignedTo: userId,
    }).save();

    const res = await request(app)
      .put(`/api/tasks/${task._id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'In Progress' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'In Progress');
  });

  test('DELETE /api/tasks/:id - Delete task', async () => {
    const task = await new Task({
      title: 'Task to Delete',
      status: 'To Do',
      createdBy: userId,
      assignedTo: userId,
    }).save();

    const res = await request(app)
      .delete(`/api/tasks/${task._id}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(await Task.findById(task._id)).toBeNull();
  });

  test('POST /api/tasks - Assign task to another user', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Assigned Task',
        description: 'Assigned to Admin',
        status: 'To Do',
        assignedTo: adminId,
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('assignedTo', adminId.toString());
    expect(res.body).toHaveProperty('createdBy', userId.toString());
  });

  test('GET /api/leaderboard - Calculate rankings', async () => {
    await new Task({
      title: 'Completed Task 1',
      status: 'Completed',
      createdBy: userId,
      assignedTo: userId,
    }).save();
    await new Task({
      title: 'Completed Task 2',
      status: 'Completed',
      createdBy: userId,
      assignedTo: adminId,
    }).save();

    const res = await request(app)
      .get('/api/tasks/leaderboard')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('completedTasks', 1);
    expect(res.body[1]).toHaveProperty('completedTasks', 1);
  });

  test('GET /api/tasks - Admin sees all tasks, user sees own', async () => {
    await new Task({ title: 'User Task', status: 'To Do', createdBy: userId, assignedTo: userId }).save();
    await new Task({ title: 'Admin Task', status: 'To Do', createdBy: adminId, assignedTo: adminId }).save();

    const userRes = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${userToken}`);
    expect(userRes.body).toHaveLength(1);
    expect(userRes.body[0]).toHaveProperty('title', 'User Task');

    const adminRes = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.body).toHaveLength(2);
  });
});