// THIS IS THE CRUCIAL CHANGE: Make sure it says mysql2, not just mysql!
const mysql = require('mysql2'); 
require('dotenv').config();

const db = mysql.createConnection(process.env.DATABASE_URL || {
  host: "mysql-311e6dab-kassim2jamiwunas-1837.j.aivencloud.com",
  port: 17400,
  user: "avnadmin",
  password: "AVNS_ykNJY-Tyzmyqb4SMlBx", 
  database: "defaultdb",
  ssl: {
    rejectUnauthorized: false
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
