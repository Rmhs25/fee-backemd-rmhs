const express = require('express');
const cors = require('cors');
const app = express();

// CRITICAL: This lets your APK talk to backend
app.use(cors({ origin: '*' })); 
app.use(express.json());

let students = [];
let nextId = 1;

app.get('/students', (req, res) => {
  res.json(students);
});

app.post('/students', (req, res) => {
  const { name, totalFee } = req.body;
  const student = { 
    id: nextId++, 
    name, 
    totalFee: Number(totalFee), 
    paid: 0, 
    payments: [] 
  };
  students.push(student);
  res.json(student);
});

app.post('/students/:id/pay', (req, res) => {
  const id = Number(req.params.id);
  const { amount, date } = req.body;
  const student = students.find(s => s.id === id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  
  const payAmount = Number(amount);
  student.paid += payAmount;
  student.payments.push({ 
    amount: payAmount, 
    date: date || new Date().toISOString() 
  });
  res.json(student);
});

app.delete('/students/:id', (req, res) => {
  const id = Number(req.params.id);
  students = students.filter(s => s.id !== id);
  res.json({ success: true });
});

app.get('/report', (req, res) => {
  const totalStudents = students.length;
  const totalFees = students.reduce((sum, s) => sum + Number(s.totalFee), 0);
  const totalPaid = students.reduce((sum, s) => sum + Number(s.paid), 0);
  const totalDue = totalFees - totalPaid;
  res.json({ totalStudents, totalFees, totalPaid, totalDue });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
