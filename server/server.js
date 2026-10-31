
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const app = express();
const { Pool } = pg;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DB_SSL === "true"
      ? { rejectUnauthorized: false }
      : false,
});

// Home route
app.get("/", (req, res) => {
  res.json({ message: "Expense Tracker API is running!" });
});

// Database health check
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      status: "error",
      database: "disconnected",
    });
  }
});

// Get all expenses
app.get("/expenses", async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, amount, category, "date" FROM expenses ORDER BY "date" DESC, id DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Could not load expenses." });
  }
});

// Add an expense
app.post("/expenses", async (req, res) => {
  const { title, amount, category, date } = req.body;

  if (
    typeof title !== "string" ||
    !title.trim() ||
    amount === "" ||
    amount === null ||
    amount === undefined ||
    !Number.isFinite(Number(amount)) ||
    Number(amount) <= 0 ||
    !date
  ) {
    return res.status(400).json({
      error: "Enter a title, positive amount, and date.",
    });
  }

  try {
    const result = await pool.query(
      'INSERT INTO expenses (title, amount, category, "date") VALUES ($1, $2, $3, $4) RETURNING id, title, amount, category, "date"',
      [title.trim(), Number(amount), category || "Other", date]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Could not add expense." });
  }
});

// Edit an expense
app.put("/expenses/:id", async (req, res) => {
  const { title, amount, category, date } = req.body;

  if (
    typeof title !== "string" ||
    !title.trim() ||
    amount === "" ||
    amount === null ||
    amount === undefined ||
    !Number.isFinite(Number(amount)) ||
    Number(amount) <= 0 ||
    !date
  ) {
    return res.status(400).json({
      error: "Enter a title, positive amount, and date.",
    });
  }

  try {
    const result = await pool.query(
      'UPDATE expenses SET title=$1, amount=$2, category=$3, "date"=$4 WHERE id=$5 RETURNING id, title, amount, category, "date"',
      [
        title.trim(),
        Number(amount),
        category || "Other",
        date,
        req.params.id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Expense not found." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Could not update expense." });
  }
});

// Delete an expense
app.delete("/expenses/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM expenses WHERE id=$1 RETURNING id",
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Expense not found." });
    }

    res.json({ message: "Expense deleted successfully." });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Could not delete expense." });
  }
});

// Create database table and start server
async function startServer() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
        category VARCHAR(100) NOT NULL DEFAULT 'Other',
        "date" DATE NOT NULL DEFAULT CURRENT_DATE
      )
    `);

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`Expense Tracker API running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Could not initialize database:", error.message);
    process.exitCode = 1;
    await pool.end();
  }
}

startServer();
