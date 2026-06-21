const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'rmhs_secret_key_2026';

mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log(err));

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
  password: { type: String, default: '' } // <-- OPTIONAL NOW
});

const adminSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['admin', 'staff'], default: 'staff' } // <-- ADDED ROLE
});

const Student = mongoose.model('Student', studentSchema);
const Admin = mongoose.model('Admin', adminSchema);

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ error: 'No token' });
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).
