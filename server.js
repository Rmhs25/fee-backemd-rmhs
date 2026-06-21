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

// Routes
app.get('/', (req, res) => res.send('RMHS Backend Running'));

// Admin Login
app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username });
  if (!admin || !await bcrypt.compare(password, admin.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: admin._id }, JWT_SECRET);
  res.json({ token });
});

// Student Login
app.post('/student/login', async (req, res) => {
  const { studentId, password } = req.body;
  const student = await Student.findOne({ studentId });
  if (!student || !await bcrypt.compare(password, student.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: student._id }, JWT_SECRET);
  res.json({ token, student });
});

// Get All Students - Admin only
app.get('/students', async (req, res) => {
  const students = await Student.find();
  res.json(students);
});

// Add Student - Admin only
app.post('/students', async (req, res) => {
  const hashedPass = await bcrypt.hash(req.body.password, 10);
  req.body.password = hashedPass;
  req.body.dues = req.body.totalFees - req.body.paidFees;
  const student = new Student(req.body);
  await student.save();
  res.json(student);
});

// Update Fees - Admin only
app.put('/students/:id/fees', async (req, res) => {
  const student = await Student.findById(req.params.id);
  student.paidFees += req.body.amount;
  student.dues = student.totalFees - student.paidFees;
  student.payments.push({ amount: req.body.amount, date: new Date(), receipt: req.body.receipt });
  await student.save();
  res.json(student);
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
// Create First Admin - Remove after use
app.post('/admin/create', async (req, res) => {
  const { username, password } = req.body;
  const exists = await Admin.findOne({ username });
  if (exists) return res.status(400).json({ error: 'Admin exists' });
  
  const hashedPass = await bcrypt.hash(password, 10);
  const admin = new Admin({ username, password: hashedPass });
  await admin.save();
  res.json({ message: 'Admin created' });
});
