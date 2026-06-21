const API = 'http://localhost:3000';
let TOKEN = localStorage.getItem('token');
let ROLE = localStorage.getItem('role');

// LOGIN
async function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const res = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (data.token) {
    TOKEN = data.token;
    ROLE = data.role;
    localStorage.setItem('token', TOKEN);
    localStorage.setItem('role', ROLE);
    showDashboard();
  } else {
    alert('Invalid login');
  }
}

function logout() {
  localStorage.clear();
  location.reload();
}

// DASHBOARD
function showDashboard() {
  document.getElementById('loginBox').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('userRole').innerText = ROLE;

  // Hide Fee Setup for non-admin
  if (ROLE!== 'admin') {
    document.getElementById('feeSetupTab').style.display = 'none';
  }
  showTab('feeSetup');
}

// TABS
function showTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.getElementById(tab).style.display = 'block';

  if (tab === 'feeSetup') loadFeeStructure();
  if (tab === 'admission') loadAdmissionForm();
  if (tab === 'collection') loadCollectionTab();
}

// FEE STRUCTURE - LOAD + EDIT
async function loadFeeStructure() {
  const res = await fetch(`${API}/fee-structure`, {
    headers: { 'Authorization': TOKEN }
  });
  const fees = await res.json();
  if (!fees.length) {
    document.getElementById('feeTable').innerHTML = 'No fee structure found. Create classes first.';
    return;
  }

  const customHeads = fees[0]?.otherHeads || [];
  let html = '<table border="1" cellpadding="8" style="width:100%; border-collapse:collapse">';
  html += '<tr><th>Class</th><th>Tuition</th><th>Registration</th><th>Exam</th><th>Diary</th><th>Card Board</th>';
  customHeads.forEach(h => html += `<th>${h.name}</th>`);
  html += '</tr>';

  fees.forEach(f => {
    html += `<tr><td><b>${f.className}</b></td>`;

    // Standard heads - editable only for admin
    ['tuition','registration','exam','diary','cardBoard'].forEach(head => {
      if (ROLE === 'admin') {
        html += `<td><input type="number" value="${f[head] || 0}" style="width:80px"
                 onchange="updateFeeHead('${f.className}', '${head}', this.value)"></td>`;
      } else {
        html += `<td>₹${f[head] || 0}</td>`;
      }
    });

    // Custom heads like "Sport Fee" - editable for admin only
    f.otherHeads.forEach(h => {
      if (ROLE === 'admin') {
        html += `<td><input type="number" value="${h.amount || 0}" style="width:80px"
                 onchange="updateCustomHead('${f.className}', '${h.name}', this.value)"></td>`;
      } else {
        html += `<td>₹${h.amount || 0}</td>`;
      }
    });
    html += '</tr>';
  });
  html += '</table>';
  document.getElementById('feeTable').innerHTML = html;

  if (ROLE === 'admin') loadCustomHeadsList();
}

async function updateFeeHead(className, headType, amount) {
  const res = await fetch(`${API}/fee-structure/edit-head`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': TOKEN },
    body: JSON.stringify({ className, headType, amount })
  });
  if (res.ok) {
    document.getElementById('feeSetupStatus').innerText = `${headType} updated for ${className}`;
    setTimeout(() => document.getElementById('feeSetupStatus').innerText = '', 2000);
  }
}

async function updateCustomHead(className, name, amount) {
  const res = await fetch(`${API}/fee-structure/edit-head`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': TOKEN },
    body: JSON.stringify({ className, name, amount })
  });
  if (res.ok) {
    document.getElementById('feeSetupStatus').innerText = `"${name}" updated for ${className}`;
    setTimeout(() => document.getElementById('feeSetupStatus').innerText = '', 2000);
  }
}

// ADD CUSTOM FEE HEAD
async function addFeeHead() {
  const name = document.getElementById('newFeeName').value.trim();
  const amount = document.getElementById('newFeeAmount').value;
  if (!name) return alert('Enter fee name');

  const res = await fetch(`${API}/fee-structure/add-head`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': TOKEN },
    body: JSON.stringify({ name, amount })
  });

  if (res.ok) {
    document.getElementById('feeSetupStatus').innerText = `"${name}" added to all classes`;
    document.getElementById('newFeeName').value = '';
    document.getElementById('newFeeAmount').value = '';
    loadFeeStructure();
  }
}

async function loadCustomHeadsList() {
  const res = await fetch(`${API}/fee-structure`, { headers: { 'Authorization': TOKEN } });
  const fees = await res.json();
  const heads = fees[0]?.otherHeads || [];

  let html = '<h4>Current Custom Fee Heads</h4>';
  if (heads.length === 0) {
    html += '<p>No custom fees added yet</p>';
  } else {
    html += '<table border="1" cellpadding="8"><tr><th>Fee Name</th><th>Default Amount</th><th>Action</th></tr>';
    heads.forEach(h => {
      html += `<tr>
        <td>${h.name}</td>
        <td>₹${h.amount}</td>
        <td><button onclick="deleteFeeHead('${h.name}')" style="background:#dc3545;color:#fff">Delete</button></td>
      </tr>`;
    });
    html += '</table>';
  }
  document.getElementById('customHeadsList').innerHTML = html;
}

async function deleteFeeHead(name) {
  if (!confirm(`Delete "${name}" from all classes? This removes it from student ledgers too.`)) return;

  const res = await fetch(`${API}/fee-structure/delete-head`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'Authorization': TOKEN },
    body: JSON.stringify({ name })
  });

  if (res.ok) {
    document.getElementById('feeSetupStatus').innerText = `"${name}" removed`;
    loadFeeStructure();
  }
}

// FEE COLLECTION TAB - For Staff/Operator
async function loadCollectionTab() {
  document.getElementById('collection').innerHTML = `
    <h3>Fee Collection</h3>
    <input id="searchStudentId" placeholder="Enter Student ID: 3000" style="padding:8px">
    <button onclick="searchStudent()">Search</button>
    <div id="studentLedger"></div>
  `;
}

async function searchStudent() {
  const id = document.getElementById('searchStudentId').value;
  const res = await fetch(`${API}/students/search/${id}`, { headers: { 'Authorization': TOKEN } });
  const s = await res.json();
  if (!s) return alert('Student not found');

  let html = `<h4>${s.name} - ${s.className}-${s.section} | ID: ${s.studentId}</h4>
              <p><b>Total Dues: ₹${s.totalDues}</b></p>
              <h5>Payment History</h5><table border="1" cellpadding="5"><tr><th>Receipt</th><th>Date</th><th>Head</th><th>Amount</th>`;
  if (ROLE === 'admin') html += '<th>Action</th>';
  html += '</tr>';

  s.payments.forEach(p => {
    html += `<tr>
      <td>${p.receipt}</td>
      <td>${new Date(p.date).toLocaleDateString()}</td>
      <td>${p.head}</td>
      <td>₹${p.amount}</td>`;
    if (ROLE === 'admin') {
      html += `<td>
        <button onclick="editEntry('${s._id}', ${p.entryNo}, ${p.amount}, '${p.head}')">Edit</button>
        <button onclick="deleteEntry('${s._id}', ${p.entryNo})">Delete</button>
      </td>`;
    }
    html += '</tr>';
  });
  html += '</table><br>';

  if (ROLE === 'admin' || ROLE === 'staff') {
    html += `<h5>Collect Fee</h5>
             <input id="payAmount" type="number" placeholder="Amount">
             <input id="payHead" placeholder="Head: Tuition/Sport Fee">
             <button onclick="collectFee('${s._id}')">Collect & Print</button>`;
  }

  document.getElementById('studentLedger').innerHTML = html;
}

async function collectFee(studentId) {
  const amount = document.getElementById('payAmount').value;
  const head = document.getElementById('payHead').value;
  if (!amount) return alert('Enter amount');

  const res = await fetch(`${API}/students/${studentId}/fees`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': TOKEN },
    body: JSON.stringify({ amount, head })
  });
  const data = await res.json();
  if (data.receiptNo) {
    alert(`Fee collected. Receipt No: ${data.receiptNo}`);
    searchStudent(); // Refresh
  }
}

// ADMIN ONLY - Edit/Delete Entry
async function editEntry(studentId, entryNo, oldAmount, oldHead) {
  const amount = prompt('New Amount:', oldAmount);
  const head = prompt('Fee Head:', oldHead);
  if (!amount) return;

  const res = await fetch(`${API}/students/${studentId}/edit-payment/${entryNo}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': TOKEN },
    body: JSON.stringify({ amount, head })
  });
  if (res.ok) {
    alert('Entry updated');
    searchStudent();
  }
}

async function deleteEntry(studentId, entryNo) {
  if (!confirm('Delete this payment entry? Amount will be added back to dues.')) return;

  const res = await fetch(`${API}/students/${studentId}/delete-payment/${entryNo}`, {
    method: 'DELETE',
    headers: { 'Authorization': TOKEN }
  });
  if (res.ok) {
    alert('Entry deleted');
    searchStudent();
  }
}

// INIT
if (TOKEN) showDashboard();
