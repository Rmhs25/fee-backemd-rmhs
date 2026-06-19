const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

let students = [];

app.get('/', (req, res) => res.send('Fee Ledger API Running'));
app.get('/students', (req, res) => res.json(students));
app.post('/students', (req, res) => {
  const student = { id: Date.now(), ...req.body };
  students.push(student);
  res.json(student);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));
