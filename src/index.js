require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require("./routes/authRoutes");
const taskRoutes = require('./routes/taskRoutes');

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use('/uploads', express.static('uploads'));


// connecting the database
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Connected to:", mongoose.connection.name))
    .catch((err) => console.error("Database Connection Error", err));


// Default route
app.get("/", (req, res) => {
    res.send("Task Management API is running...");
});


const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`server running on port ${PORT}`));
