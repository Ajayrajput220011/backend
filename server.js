// ---------------------------
// Load environment variables
// ---------------------------
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require("body-parser");
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const Razorpay = require("razorpay");
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.MYSQLPORT || 5000;

// ---------------------------
// Middleware
// ---------------------------
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// ---------------------------
// MySQL connection
// ---------------------------
const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQL_DATABASE,
});

db.connect((err) => {
  if (err) {
    console.error('❌ DB connection error:', err);
  } else {
    console.log('✅ Connected to MySQL');
  }
});

// ---------------------------
// Razorpay instance
// ---------------------------
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ---------------------------
// Razorpay Payment Order
// ---------------------------
app.post("/api/payment/orders", async (req, res) => {
  const { amount, currency } = req.body;

  const options = {
    amount: amount * 100, // convert rupees to paise
    currency: currency || "INR",
    receipt: `receipt_order_${Math.floor(Math.random() * 10000)}`,
  };

  try {
    const order = await razorpay.orders.create(options);
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------
// Signup Route
// ---------------------------
app.post('/api/signup', async (req, res) => {
  const { firstName, lastName, email, phone, address, password } = req.body;

  try {
    const checkSql = 'SELECT * FROM users WHERE email = ?';
    db.query(checkSql, [email], async (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      if (results.length > 0) return res.status(400).json({ message: 'Email already registered' });

      const hashedPassword = await bcrypt.hash(password, 10);
      const insertSql = `
        INSERT INTO users (first_name, last_name, email, phone, address, password)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      db.query(insertSql, [firstName, lastName, email, phone, address, hashedPassword], (err) => {
        if (err) return res.status(500).json({ message: 'Error saving user' });
        res.status(200).json({ message: 'User registered successfully' });
      });
    });
  } catch (err) {
    res.status(500).json({ message: 'Signup failed', error: err.message });
  }
});

// ---------------------------
// Login Route
// ---------------------------
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const sql = 'SELECT * FROM users WHERE email = ?';

  db.query(sql, [email], async (err, results) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (results.length === 0) return res.status(401).json({ message: 'Invalid email or password' });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid email or password' });

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email
      }
    });
  });
});

// ---------------------------
// Contact Form
// ---------------------------
app.post('/api/contact', (req, res) => {
  const { firstName, lastName, email, message } = req.body;

  if (!firstName || !lastName || !email || !message)
    return res.status(400).json({ message: 'All fields are required' });

  const sql = 'INSERT INTO contacts (first_name, last_name, email, message) VALUES (?, ?, ?, ?)';
  db.query(sql, [firstName, lastName, email, message], (err) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.status(200).json({ message: 'Message saved successfully!' });
  });
});

// ---------------------------
// Newsletter Subscribe
// ---------------------------
app.post('/api/subscribe', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  const sql = 'INSERT INTO subscribers (email) VALUES (?)';
  db.query(sql, [email], (err) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY')
        return res.status(409).json({ message: 'Already subscribed' });
      return res.status(500).json({ message: 'Database error' });
    }
    res.status(200).json({ message: 'Subscription successful' });
  });
});

// ---------------------------
// Users1 Table
// ---------------------------
app.post('/api/users1', (req, res) => {
  const { firstName, lastName, email, phone, address, pincode, accountNumber, ifscCode } = req.body;
  const sql = `
    INSERT INTO users1 
    (first_name, last_name, email, phone, address, pincode, account_number, ifsc_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [firstName, lastName, email, phone, address, pincode, accountNumber, ifscCode], (err) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.status(200).json({ message: 'User saved successfully' });
  });
});

// ---------------------------
// Reviews
// ---------------------------
app.post("/api/reviews", (req, res) => {
  const { name, rating, comment } = req.body;
  if (!name || !rating || !comment.trim())
    return res.status(400).json({ error: "All fields are required." });

  const sql = "INSERT INTO reviews (name, rating, comment) VALUES (?, ?, ?)";
  db.query(sql, [name, rating, comment], (err, results) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.status(201).json({ id: results.insertId, name, rating, comment });
  });
});

app.get("/api/reviews", (req, res) => {
  const sql = "SELECT * FROM reviews ORDER BY created_at DESC";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json(results);
  });
});

// ---------------------------
// Save User2
// ---------------------------
app.post("/api/save-user2", (req, res) => {
  const { emailOrMobile } = req.body;
  if (!emailOrMobile)
    return res.status(400).json({ success: false, error: "Email/Mobile required" });

  const sql = "INSERT INTO users2 (emailOrMobile) VALUES (?)";
  db.query(sql, [emailOrMobile], (err, result) => {
    if (err) {
      console.error("❌ MySQL error:", err);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    res.json({ success: true, id: result.insertId });
  });
});
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  db.query(
    'SELECT * FROM admins WHERE email = ? AND password = ?',
    [email, password],
    (err, results) => {
      if (err) return res.status(500).send({ success: false, error: err });
      if (results.length > 0) {
        res.send({ success: true });
      } else {
        res.send({ success: false });
      }
    }
  );
});
const otpStore = {};  // In-memory store for OTPs (use DB or cache for production)

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

// Endpoint to send OTP email
app.post('/send-otp', async (req, res) => {
  const { toEmail } = req.body;
  if (!toEmail) return res.status(400).send({ success: false, message: 'Email required' });

  const otp = generateOtp();
  otpStore[toEmail] = otp;  // Store OTP against the email

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: 'Your OTP Code',
    text: `Your OTP code is: ${otp}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.send({ success: true, message: 'OTP sent to email' });
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to send OTP', error: error.message });
  }
});

// Endpoint to verify OTP
app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).send({ success: false, message: 'Email and OTP required' });

  const validOtp = otpStore[email];
  if (validOtp && otp === validOtp) {
    delete otpStore[email]; // Consume OTP
    res.send({ success: true, message: 'OTP verified' });
  } else {
    res.status(400).send({ success: false, message: 'Invalid OTP' });
  }
})
app.post('/api/signup', async (req, res) => {
  const { firstName, lastName, email, phone, address, password } = req.body;

  try {
    const checkSql = 'SELECT * FROM users WHERE email = ?';
    db.query(checkSql, [email], async (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      if (results.length > 0)
        return res.status(400).json({ message: 'Email already registered' });

      const hashedPassword = await bcrypt.hash(password, 10);

      const insertSql = `
        INSERT INTO users (first_name, last_name, email, phone, address, password)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      db.query(insertSql, [firstName, lastName, email, phone, address, hashedPassword], (err) => {
        if (err) return res.status(500).json({ message: 'Error saving user' });
        res.status(200).json({ message: 'User registered successfully' });
      });
    });
  } catch (err) {
    res.status(500).json({ message: 'Signup failed', error: err.message });
  }
});

// ---------------------- CHANGE PASSWORD ----------------------
app.post('/api/change-password', async (req, res) => {
  const { id, password } = req.body;

  if (!id || !password) {
    return res.status(400).json({ success: false, message: "Missing id or password" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
      "UPDATE users SET password = ? WHERE email = ?",
      [hashedPassword, id],
      (err, result) => {
        if (err) {
          console.error('DB error:', err);
          return res.status(500).json({ success: false, message: "Database error" });
        }
        if (result.affectedRows === 0) {
          return res.status(404).json({ success: false, message: "User not found" });
        }
        res.json({ success: true, message: "Password changed successfully" });
      }
    );
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  const sql = "SELECT * FROM users WHERE email = ?";
  db.query(sql, [email], async (err, result) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // ✅ Send back only ID (and maybe name/email)
    res.json({
      success: true,
      message: "Login successful",
      userId: user.id,
    });
  });
});

// ✅ GET USER DATA BY ID
// ✅ Get single user by email + password (for login validation)
app.get("/api/user/:email/:password", (req, res) => {
  const { email, password } = req.params;

  const sql = `
    SELECT id, first_name, last_name, email, phone, address, created_at
    FROM users
    WHERE email = ? AND password = ?
  `;

  db.query(sql, [email, password], (err, result) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: "Invalid email or password" });
    }

    res.json(result[0]); // return single user object
  });
});


// ✅ Get all users (for admin dashboard)
app.get("/api/users", (req, res) => {
  const sql = `
    SELECT id, first_name, last_name, email, phone, address, created_at
    FROM users
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json(results);
  });
});
// ✅ Delete user by ID
// ✅ DELETE USER BY ID (in your Express backend)
app.delete("/api/users/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM users WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  });
});

app.get("/api/contacts", (req, res) => {
  const sql = `
    SELECT id, first_name, last_name, email, message,  created_at
    FROM contacts
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json(results);
  });
});
// ✅ Delete user by ID
// ✅ DELETE USER BY ID (in your Express backend)

app.delete("/api/contacts/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM contacts WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  });
});

app.get("/api/admins", (req, res) => {
  const sql = `
    SELECT id,email, password
    FROM admins
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json(results);
  });
});
// ✅ Delete user by ID
// ✅ DELETE USER BY ID (in your Express backend)

app.delete("/api/admins/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM admins WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  });
});




app.get("/api/subscribers", (req, res) => {
  const sql = `
    SELECT id,email, subscribed_at
    FROM subscribers
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json(results);
  });
});
// ✅ Delete user by ID
// ✅ DELETE USER BY ID (in your Express backend)

app.delete("/api/subscribers/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM subscribers WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  });
});



app.get("/api/users1", (req, res) => {
  const sql = `
    SELECT id,email, first_name,last_name,phone,  address, pincode, account_number,  ifsc_code,  created_at
    FROM users1
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json(results);
  });
});
// ✅ Delete user by ID
// ✅ DELETE USER BY ID (in your Express backend)

app.delete("/api/users1/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM users1 WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  });
});




app.get("/api/users2", (req, res) => {
  const sql = `
    SELECT id,emailOrMobile, created_at
    FROM users2
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json(results);
  });
});
// ✅ Delete user by ID
// ✅ DELETE USER BY ID (in your Express backend)

app.delete("/api/users2/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM users2 WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  });
});


// ---------------------------
// Start Server
// ---------------------------
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);


});
