const express = require('express');
const { check, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
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
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const extname = filetypes.test(path.extname(file.originalname).toLocaleLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only JPEG/PNG images are allowed'));
    },
    limits: { fileSize: 5 * 1024 * 1024 },
});

router.post(
    '/',
    [
        authMiddleware,
        upload.single('image'),
        check('title', 'Title is required').not().isEmpty(),
        check('dueDate', 'Due date must be a valid date').optional().isISO8601(),
        check('assignedTo', 'Assigned user ID must be a valid ObjectID').optional().isMongoId(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { title, description, status, priority, dueDate, assignedTo } = req.body;

        try {
            if (assignedTo) {
                const assignedUser = await User.findById(assignedTo);
                if (!assignedUser) return res.status(400).json({ msg: 'Assigned user does not exist' });
            }

            const task = new Task({
                title,
                description,
                status,
                priority,
                dueDate,
                createdBy: req.user.id,
                assignedTo: assignedTo || req.user.id,
                image: req.file ? `/uploads/${req.file.filename}` : null,
            });
            await task.save();

            if (assignedTo && assignedTo !== req.user.id) {
                const assignedUser = await User.findById(assignedTo);
                console.log(`Notification: Task "${title}" assigned to ${assignedUser.email} by ${req.user.id}`);
            }

            res.status(201).json(task);
        } catch (error) {
            console.error('Task Creation Error:', error)
            res.status(500).json({ msg: 'Server error' });
        }
    }
);

router.get('/', authMiddleware, async(req, res) => {
    try {
        const { status, priority, dueDate, sort } = req.query;

        const query = {};

        if (req.user.role !== 'admin') {
            query.$or = [
                { createdBy: req.user.id },
                { assignedTo: req.user.id },
            ];
        }

        if (status) query.status = status;
        if (priority) query.priority = priority;
        if (dueDate) query.dueDate = new Date(dueDate);

        const sortOptions = {};
        if (sort) {
            const sortField = sort.startsWith('-') ? sort.slice(1) : sort;
            sortDirection = sort.startsWith('-') ? -1 : 1;
            sortOptions[sortField] = sortDirection;
            
            if (sortField === 'dueDate') {
                sortOptions['_id'] = sortDirection;
            }
        }


        const tasks = await Task.find(query)
            .populate('createdBy', 'name email')
            .populate('assignedTo', 'name email')
            .sort(sortOptions);
        
            if (sort && sort.includes('dueDate')) {
                const withDueDate = tasks.filter(task => task.dueDate);
                const withoutDueDate = tasks.filter(task => !task.dueDate);
                res.json(sortDirection === -1 ? [...withDueDate.reverse(), ...withoutDueDate] : [...withDueDate, ...withoutDueDate]);
            } else {
                res.json(tasks);
            }
    } catch (error) {
        console.error('Task Fetch Error:', error);
        res.status(500).json({ msg: 'Server error' });
    }
});


router.get('/leaderboard', authMiddleware, async (req, res) => {
    try {
        const leaderboard = await Task.aggregate([
            { $match: { status: 'Completed' } },
            {
                $group: {
                    _id: '$assignedTo',
                    completedTasks: { $sum: 1 },
                },
            },

            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user',
                },
            },

            { $unwind: '$user' },

            {
                $project: {
                    name: '$user.name',
                    email: '$user.email',
                    completedTasks: 1,
                },
            },

            { $sort: { completedTasks: -1 } },
        ]);

        res.json(leaderboard);
    } catch (error) {
        console.error('Leaderboard Fetch Error', error);
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