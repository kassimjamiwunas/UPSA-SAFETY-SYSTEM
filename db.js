const mysql = require('mysql');
require('dotenv').config();

// Connect straight to your new Aiven Cloud database!
const db = mysql.createConnection(process.env.DATABASE_URL || {
  host: "mysql-311e6dab-kassim2jamiwunas-1837.j.aivencloud.com",
  port: 17400,
  user: "avnadmin",
  password: "AVNS_ykNJY-Tyzmyqb4SMlBx", 
  database: "defaultdb",
  ssl: {
    rejectUnauthorized: false // Bypasses the strict certificate check for local testing
  }
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
    return;
  }
  console.log("✅ Connected to Aiven Cloud Database!");
});

module.exports = db;
