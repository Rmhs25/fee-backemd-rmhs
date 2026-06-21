const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'rmhs_secret_key_2026';

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log(err));

// Student Schema
const studentSchema = new mongoose.Schema({
  studentId: { type: String, unique: true },
  name: String,
  class: String,
  section: String,
  rollNo: Number,
  fatherName: String,
  mobile: String,
  address: String,
  totalFees: Number,
  paidFees: { type: Number, default: 0 },
  dues: { type: Number, default: 0 },
  payments: [{ amount: Number, date: Date, receipt: String }],
  password: String
});

// Admin Schema  
const adminSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String
});

const Student = mongoose.model('Student', studentSchema);
const Admin = mongoose.model('Admin', adminSchema);

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ error: 'No token' });
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.userId = decoded.id;
    next();
  });
};

// Routes
app.get('/', (req, res) => res.send('RMHS Backend Running'));

// Create First Admin - Use once then remove
app.post('/admin/create', async (req, res) => {
  try {
    const { username, password } = req.body;
    const exists = await Admin.findOne({ username });
    if (exists) return res.status(400).json({ error: 'Admin already exists' });
    
    const hashedPass = await bcrypt.hash(password, 10);
    const admin = new Admin({ username, password: hashedPass });
    await admin.save();
    res.json({ message: 'Admin created successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Login
app.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (!admin || !await bcrypt.compare(password, admin.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: admin._id }, JWT_SECRET);
    res.json({ token, username: admin.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student Login
app.post('/student/login', async (req, res) => {
  try {
    const { studentId, password } = req.body;
    const student = await Student.findOne({ studentId });
    if (!student || !await bcrypt.compare(password, student.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: student._id }, JWT_SECRET);
    res.json({ token, student });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Students - Admin only
app.get('/students', verifyToken, async (req, res) => {
  try {
    const students = await Student.find();
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Single Student - Admin only
app.post('/students', verifyToken, async (req, res) => {
  try {
    const hashedPass = await bcrypt.hash(req.body.password, 10);
    req.body.password = hashedPass;
    req.body.dues = req.body.totalFees - (req.body.paidFees || 0);
    const student = new Student(req.body);
    await student.save();
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Fees - Admin only
app.put('/students/:id/fees', verifyToken, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    student.paidFees += Number(req.body.amount);
    student.dues = student.totalFees - student.paidFees;
    student.payments.push({ 
      amount: Number(req.body.amount), 
      date: new Date(), 
      receipt: req.body.receipt || `RCP${Date.now()}`
    });
    await student.save();
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Student by ID - Student/Admin
app.get('/students/:id', verifyToken, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
