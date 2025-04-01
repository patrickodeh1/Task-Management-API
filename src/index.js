require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

// connecting the database
mongoose.connect('mongodb://localhost:27017/task_management')
    .then(() => console.log("Database connected"))
    .catch((err) => console.error("Database Connection Error", err));


// Default route
app.get("/", (req, res) => {
    res.send("Task Management API is running...");
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`server running on port ${PORT}`));
