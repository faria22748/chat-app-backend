const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express(); // Initialize 'app' before using it

// Set up CORS middleware
app.use(cors({
  origin: 'http://localhost:3001', // Replace with your frontend URL
  methods: ['GET', 'POST'],
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3001', // Match with frontend URL
    methods: ['GET', 'POST']
  }
});

app.use(express.static('public'));
app.use(express.json()); // Middleware to parse JSON bodies

// MongoDB connection
const mongoURI = 'mongodb://localhost:27017/chatapp'; // Replace with your MongoDB URI
mongoose.connect(mongoURI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Define a Message schema and model
const messageSchema = new mongoose.Schema({
    content: String,
    createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// API routes
app.get('/api/messages', async (req, res) => {
    try {
        const messages = await Message.find().sort({ createdAt: -1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/messages', async (req, res) => {
    try {
        const { content } = req.body;
        const newMessage = new Message({ content });
        await newMessage.save();
        res.status(201).json(newMessage);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/messages/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const updatedMessage = await Message.findByIdAndUpdate(id, { content }, { new: true });
        if (!updatedMessage) return res.status(404).json({ error: 'Message not found' });
        res.json(updatedMessage);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/messages/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await Message.findByIdAndDelete(id);
        if (!result) return res.status(404).json({ error: 'Message not found' });
        res.status(204).send(); // No content to send back
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const users = {};

// Socket.io setup
io.on('connection', (socket) => {
    socket.on('new-user-joined', (name) => {
        users[socket.id] = name;
        socket.broadcast.emit('user-joined', name);
    });

    socket.on('send', (message) => {
        socket.broadcast.emit('receive', { message: message, user: users[socket.id] });
    });

    socket.on('disconnect', () => {
        socket.broadcast.emit('user-left', users[socket.id]);
        delete users[socket.id];
    });
});

const PORT = process.env.PORT || 3000; // Ensure this matches the frontend's expected backend port
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
