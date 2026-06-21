const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const PDFDocument = require('pdfkit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET
});

const upload = multer({ storage: multer.memoryStorage() });

// DB Connect
mongoose.connect(process.env.MONGO_URI).then(() => console.log('DB Connected'));

// Schemas
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: { type: String, default: 'admin' }
});
const User = mongoose.model('User', userSchema);

const studentSchema = new mongoose.Schema({
  admissionNo: { type: String, unique: true },
  name: String,
  class: String,
  section: String,
  fatherName: String,
  mobile: String,
  address: String,
  dob: Date,
  bloodGroup: String,
  photo: String,
  feeStructure: {
    tuition: { type: Number, default: 0 },
    transport: { type: Number, default: 0 },
    exam: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },
  paidFee: { type: Number, default: 0 },
  date: { type: Date, default: Date.now }
});
studentSchema.virtual('totalFee').get(function() {
  return this.feeStructure.tuition + this.feeStructure.transport + this.feeStructure.exam + this.feeStructure.other;
});
const Student = mongoose.model('Student', studentSchema);

const feeSchema = new mongoose.Schema({
  studentId: mongoose.Schema.Types.ObjectId,
  receiptNo: String,
  amount: Number,
  feeHeads: {
    tuition: Number,
    transport: Number,
    exam: Number,
    other: Number
  },
  paymentMode: String,
  collectedBy: String,
  date: { type: Date, default: Date.now }
});
const Fee = mongoose.model('Fee', feeSchema);

// Auth Middleware
const auth = (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Routes
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/', (req, res) => {
  res.send('<h1>Zee School ERP Running</h1><p>Backend is live ✅</p><p>DB Connected</p>')
});

// 1. Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  let user = await User.findOne({ username });
  if (!user) {
    const hash = await bcrypt.hash(password, 10);
    user = await User.create({ username, password: hash, role: 'admin' });
  }
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ error: 'Wrong password' });
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
  res.json({ token, role: user.role });
});

// 2. Upload Photo
app.post('/api/upload', auth, upload.single('photo'), async (req, res) => {
  try {
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream({ folder: 'zee_students' }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }).end(req.file.buffer);
    });
    res.json({ url: result.secure_url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Add Student
app.post('/api/student', auth, async (req, res) => {
  try {
    const student = new Student(req.body);
    await student.save();
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Get Students
app.get('/api/students', auth, async (req, res) => {
  const { class: cls } = req.query;
  const filter = cls? { class: cls } : {};
  const students = await Student.find(filter);
  res.json(students);
});

// 5. Collect Fee
app.post('/api/collect-fee', auth, async (req, res) => {
  const { studentId, feeHeads, paymentMode } = req.body;
  const student = await Student.findById(studentId);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const amount = feeHeads.tuition + feeHeads.transport + feeHeads.exam + feeHeads.other;
  const receiptNo = 'ZEE' + Date.now();

  await Fee.create({
    studentId, receiptNo, amount, feeHeads, paymentMode,
    collectedBy: req.user.id
  });

  student.paidFee += Number(amount);
  await student.save();

  res.json({
    success: true,
    receiptNo,
    balance: student.totalFee - student.paidFee
  });
});

// 6. Print Receipt PDF
app.get('/api/receipt/:receiptNo', auth, async (req, res) => {
  const fee = await Fee.findOne({ receiptNo: req.params.receiptNo }).populate('studentId');
  if (!fee) return res.status(404).send('Not found');

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=${fee.receiptNo}.pdf`);
  doc.pipe(res);

  doc.fontSize(20).text('ZEE SCHOOL', { align: 'center' });
  doc.fontSize(12).text('Fee Receipt', { align: 'center' });
  doc.moveDown();
  doc.text(`Receipt No: ${fee.receiptNo}`);
  doc.text(`Date: ${moment(fee.date).format('DD/MM/YYYY')}`);
  doc.text(`Student: ${fee.studentId.name} | Class: ${fee.studentId.class}-${fee.studentId.section}`);
  doc.text(`Admission No: ${fee.studentId.admissionNo}`);
  doc.moveDown();
  doc.text(`Tuition Fee: Rs. ${fee.feeHeads.tuition || 0}`);
  doc.text(`Transport Fee: Rs. ${fee.feeHeads.transport || 0}`);
  doc.text(`Exam Fee: Rs. ${fee.feeHeads.exam || 0}`);
  doc.text(`Other: Rs. ${fee.feeHeads.other || 0}`);
  doc.moveDown();
  doc.fontSize(14).text(`Total Paid: Rs. ${fee.amount}`, { align: 'right' });
  doc.text(`Payment Mode: ${fee.paymentMode}`, { align: 'right' });
  doc.end();
});

// 7. ID Card PDF
app.get('/api/idcard/:studentId', auth, async (req, res) => {
  const student = await Student.findById(req.params.studentId);
  const doc = new PDFDocument({ size: [242, 153], margin: 10 });
  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);

  doc.fontSize(14).text('ZEE SCHOOL', { align: 'center' });
  doc.fontSize(10).text('STUDENT ID CARD', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(9).text(`Name: ${student.name}`);
  doc.text(`Class: ${student.class}-${student.section}`);
  doc.text(`Adm No: ${student.admissionNo}`);
  doc.text(`Father: ${student.fatherName}`);
  doc.text(`Mobile: ${student.mobile}`);
  doc.end();
});

// 8. Reports
app.get('/api/report', auth, async (req, res) => {
  const { type, class: cls, date } = req.query;
  let data = [];
  if (type === 'collection') {
    const start = moment(date).startOf('day');
    const end = moment(date).endOf('day');
    data = await Fee.find({ date: { $gte: start, $lte: end } }).populate('studentId');
  } else if (type === 'due') {
    const students = await Student.find({ class: cls });
    data = students.filter(s => s.paidFee < s.totalFee);
  }
  res.json(data);
});

app.listen(PORT, () => console.log(`Server on ${PORT}`));
