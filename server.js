require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const db = require("./db"); 
const path = require('path');

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Forces the server to look in the exact folder where the server.js file lives
app.use(express.static(path.join(__dirname, 'public')));

/* ================= TEST ENDPOINT ================= */
app.get("/test", (req, res) => {
  res.json({ message: "Server is working" });
});

/* ================= SIGNUP ================= */
app.post("/signup", (req, res) => {
  const { fullName, phone, email, role, username, password } = req.body;

  const sql = `
    INSERT INTO users (fullName, phone, email, role, username, password)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [fullName, phone, email, role, username, password], (err) => {
    if (err) return res.json({ success: false, message: "Username or Email already exists." });
    res.json({ success: true, message: "Account Created!" });
  });
});

/* ================= LOGIN ================= */
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const sql = "SELECT * FROM users WHERE username=? AND password=?";

  db.query(sql, [username, password], (err, result) => {
    if (err || result.length === 0) {
      res.json({ message: "Invalid login" });
    } else {
      const user = result[0];
      res.json({
        token: "simple-token",
        role: user.role,
        user_id: user.id // Make sure this matches your DB column (usually 'id' or 'user_id')
      });
    }
  });
});

/* ================= SUBMIT REPORT ================= */
app.post("/report", (req, res) => {
  const { report_type, description, location, anonymous, user_id } = req.body;

  const sql = `
    INSERT INTO reports (report_type, description, location, anonymous, user_id)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(sql, [report_type, description, location, anonymous, user_id], (err) => {
    if (err) {
      console.error(err);
      return res.json({ success: false, message: "Database insert failed" });
    }
    res.json({ success: true });
  });
});

/* ================= GET REPORTS (SECURED FOR ADMINS) ================= */
app.get("/reports", (req, res) => {
  // 🚨 SECURITY CHECK: Ensure the user is an admin OR has a valid token
  const userRole = req.headers['x-user-role'];
  const token = req.headers['authorization'];

  if (userRole !== 'admin' && token !== 'simple-token') {
    return res.status(403).json({ message: "Access Denied" });
  }

  const sql = "SELECT * FROM reports ORDER BY created_at DESC";

  db.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      res.json([]);
    } else {
      res.json(result);
    }
  });
});

/* ================= UPDATE REPORT STATUS ================= */
app.put("/report/:id", (req, res) => {
  const id = req.params.id;
  const { status } = req.body;

  const sql = "UPDATE reports SET status=? WHERE id=?";

  db.query(sql, [status, id], (err, result) => {
    if (err) {
      res.json({ message: "Update failed" });
    } else {
      res.json({ message: "Report status updated" });
    }
  });
});

/* ================= BROADCAST EMERGENCY SMS ================= */
app.post("/alerts", (req, res) => {
  const { message, location } = req.body;

  if (!message || !location) {
    return res.json({ success: false, error: "Missing message or location data" });
  }

  // 1. Log the alert into the database
  const sqlInsert = "INSERT INTO alerts (message, location) VALUES (?, ?)";
  
  db.query(sqlInsert, [message, location], (err, result) => {
    if (err) {
      console.error("Database Error:", err);
      return res.json({ success: false, error: "Failed to save alert." });
    }

    // 2. Fetch all student phone numbers
    const sqlGetPhones = "SELECT phone FROM users WHERE role = 'student'";
    
    db.query(sqlGetPhones, async (err, users) => {
      if (err) {
        return res.json({ success: true, message: "Alert saved, but SMS fetch failed." });
      }

      // Extract all phones into a simple list
      const phoneList = users.map(user => user.phone).filter(phone => phone);
      
      if (phoneList.length === 0) {
        return res.json({ success: true, message: "No student phone numbers found." });
      }

      const smsText = `🚨 UPSA EMERGENCY 🚨\nLoc: ${location}\nDetails: ${message}`;

      // 3. Send Bulk SMS via Mnotify
      try {
        const mnotifyKey = process.env.MNOTIFY_API_KEY;
        const senderId = process.env.MNOTIFY_SENDER_ID; 

        const response = await fetch(`https://api.mnotify.com/api/sms/quick?key=${mnotifyKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: phoneList,
            sender: senderId,
            message: smsText,
            is_schedule: false,
            schedule_date: ''
          }),
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
          console.log("✅ Mnotify SMS successfully pushed to network!");
          res.json({ success: true, message: `Alert broadcasted via Mnotify to ${phoneList.length} students.` });
        } else {
          console.error("❌ Mnotify Rejected. Reason:", data.message);
          res.json({ success: false, error: "Mnotify error: " + data.message });
        }
      } catch (e) {
        console.error("System error reaching Mnotify:", e.message);
        res.json({ success: false, error: "Server failed to connect to Mnotify." });
      }
    });
  });
});

/* ================= STATISTICS (SECURED FOR ADMINS) ================= */
app.get("/stats", (req, res) => {
  const userRole = req.headers['x-user-role'];
  const token = req.headers['authorization'];

  if (userRole !== 'admin' && token !== 'simple-token') {
    return res.status(403).json({ message: "Access Denied" });
  }

  const total = "SELECT COUNT(*) AS total FROM reports";
  const pending = "SELECT COUNT(*) AS pending FROM reports WHERE status='Pending'";
  const resolved = "SELECT COUNT(*) AS resolved FROM reports WHERE status='Resolved'";

  // ✅ FIX: Separated the err variables so they don't overwrite each other and cause silent crashes
  db.query(total, (err1, totalResult) => {
    if (err1) return res.json({ total: 0, pending: 0, resolved: 0 });
    
    db.query(pending, (err2, pendingResult) => {
      if (err2) return res.json({ total: totalResult[0].total, pending: 0, resolved: 0 });
      
      db.query(resolved, (err3, resolvedResult) => {
        if (err3) return res.json({ total: totalResult[0].total, pending: pendingResult[0].pending, resolved: 0 });
        
        res.json({
          total: totalResult[0].total,
          pending: pendingResult[0].pending,
          resolved: resolvedResult[0].resolved
        });
      });
    });
  });
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server is live on port ${PORT}`);
});
