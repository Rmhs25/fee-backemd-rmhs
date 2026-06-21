const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect('mongodb://localhost:27017/rmhs');

// MODELS
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: { type: String, enum: ['admin','staff','operator'], default: 'staff' }
});

const counterSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  seq: { type: Number, default: 0 }
});

const feeStructureSchema = new mongoose.Schema({
  className: String,
  tuition: Number,
  registration: Number,
  exam: Number,
  diary: Number,
  cardBoard: Number,
  otherHeads: [{ name: String, amount: Number }]
});

const studentSchema = new mongoose.Schema({
  studentId: String,
  name: String,
  fatherName: String,
  className: String,
  section: { type: String, enum: ['A','B','C'] },
  status: { type: String, default: 'Active' },
  entryCounter: { type: Number, default: 0 },
  ledger: {
    registration: Number,
    tuition: [{ month: String, amount: Number, paid: Number }],
    exam: Number,
    diary: Number,
    cardBoard: Number,
    fine: Number,
    previousDues: Number,
    concession: Number,
    otherHeads: [{ name: String, amount: Number, paid: Number }]
  },
  totalDues: Number,
  payments: [{
    amount: Number,
    date: Date,
    receipt: String,
    entryNo: Number,
    head: String,
    collectedBy: String
  }]
});

const User = mongoose.model('User', userSchema);
const Counter = mongoose.model('Counter', counterSchema);
const FeeStructure = mongoose.model('FeeStructure', feeStructureSchema);
const Student = mongoose.model('Student',
