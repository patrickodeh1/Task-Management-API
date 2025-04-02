const express = require('express');
const { check, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const Task = require('../models/Task');
const multer = require('multer');
const path = require('path');

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});
const upload = multer({ storage });

router.post(
    '/',
    [
        authMiddleware,
        upload.single('image'),
        check('title', 'Title is required').not().isEmpty(),
        check('dueDate', 'Due date must be a valid date').optional().isISO8601(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { title, description, status, priority, dueDate, assignedTo } = req.body;

        try {
            const task = new Task({
                title,
                description,
                status,
                priority,
                dueDate,
                createdBy: req.user.id,
                assignedTo: assignedTo || req.user.id,
                image: req.file ? req.file.path : null,
            });
            await task.save();
            res.status(201).json(task);
        } catch (error) {
            res.status(500).json({ msg: 'Server error' });
        }
    }
);

router.get('/', authMiddleware, async(req, res) => {
    try {
        let tasks;
        if (req.user.role === 'admin') {
            tasks = await Task.find().populate('assignedTo', 'name email');
        } else {
            tasks = await Task.find({
                $or: [{ createdBy: req.user.id }, {assignedTo: req.user.id }],
            }).populate('createdBy', 'name email').populate('assignedTo', 'name email');
        }
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.put('/:id', authMiddleware, async (req, res) => {
    const { title, description, status, priority, dueDate, assignedTo } = req.body;

    try {
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ msg: 'Task not found'});

        if (task.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ msg: 'Not authorized to update this task' });
        }

        task.title = title || task.title;
        task.description = description || task.description;
        task.status = status || task.status;
        task.priority = priority || task.priority;
        task.dueDate = dueDate || task.dueDate;
        task.assignedTo = assignedTo || task.assignedTo;

        await task.save();
        res.json(task);
    } catch (error) {
        res.status(500).json({ msg: 'Server error'});
    }
});

router.delete('/:id', authMiddleware, async(req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({msg: 'Task not found' });

        if (task.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ msg: 'Not authorized to delete this task'})
        }

        await task.deleteOne();
        res.json({ msg: 'Task deleted' });
    } catch (error) {
        res.status(500).json({ msg: 'Server error'});
    }
});

module.exports = router;