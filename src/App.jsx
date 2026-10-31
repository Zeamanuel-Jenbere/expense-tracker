
import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";

const API_URL = "http://localhost:3001/expenses";

const initialForm = {
  title: "",
  amount: "",
  category: "Food",
  date: new Date().toISOString().slice(0, 10),
};

const money = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "ETB",
  }).format(value);

export default function App() {
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const titleInputRef = useRef(null);

  // Fetch expenses from the API.
  const loadExpenses = useCallback(async (signal) => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(API_URL, { signal });

      if (!response.ok) {
        throw new Error("Could not load expenses.");
      }

      const data = await response.json();
      setExpenses(data);
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(
          "Could not connect to the API. Check that the backend is running."
        );
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadExpenses(controller.signal);

    return () => controller.abort();
  }, [loadExpenses]);

  // Calculate totals only when expenses change.
  const summary = useMemo(() => {
    const total = expenses.reduce(
      (sum, expense) => sum + Number(expense.amount),
      0
    );

    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthly = expenses
      .filter((expense) => expense.date?.startsWith(thisMonth))
      .reduce((sum, expense) => sum + Number(expense.amount), 0);

    return {
      total,
      count: expenses.length,
      monthly,
    };
  }, [expenses]);

  // Search and category filtering.
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesSearch = expense.title
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesCategory =
        categoryFilter === "All" ||
        expense.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [expenses, search, categoryFilter]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const amount = Number(form.amount);

    if (!form.title.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Enter a title and an amount greater than zero.");
      titleInputRef.current?.focus();
      return;
    }

    try {
      setSaving(true);
      setError("");

      const expenseData = {
        ...form,
        title: form.title.trim(),
        amount,
      };

      const url = editingId
        ? `${API_URL}/${editingId}`
        : API_URL;

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expenseData),
      });

      if (!response.ok) throw new Error("Could not save the expense.");

      const savedExpense = await response.json();

      if (editingId) {
        setExpenses((current) =>
          current.map((item) =>
            item.id === editingId ? savedExpense : item
          )
        );
      } else {
        setExpenses((current) => [savedExpense, ...current]);
      }

      setForm(initialForm);
      setEditingId(null);
      titleInputRef.current?.focus();
    } catch {
      setError("Saving failed. Check your backend and try again.");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(expense) {
    setEditingId(expense.id);
    setForm({
      title: expense.title,
      amount: String(expense.amount),
      category: expense.category,
      date: expense.date,
    });
    titleInputRef.current?.focus();
  }

  async function deleteExpense(id) {
    if (!window.confirm("Are you sure you want to delete this expense?")) {
      return;
    }

    try {
      setError("");

      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Delete failed.");

      setExpenses((current) =>
        current.filter((expense) => expense.id !== id)
      );

      if (editingId === id) {
        setEditingId(null);
        setForm(initialForm);
      }
    } catch {
      setError("Could not delete the expense.");
    }
  }

  return (
    <main className="app">
      <header className="header">
        <div>
          <p className="eyebrow">PERSONAL FINANCE</p>
          <h1>Expense Tracker</h1>
          <p className="muted">Understand your spending. Stay in control.</p>
        </div>
        <span className="header-icon">ET</span>
      </header>

      <section className="summary">
        <article className="summary-card featured">
          <p>Total expenses</p>
          <h2>{money(summary.total)}</h2>
          <span>All recorded spending</span>
        </article>
        <article className="summary-card">
          <p>This month</p>
          <h2>{money(summary.monthly)}</h2>
          <span>Spending this calendar month</span>
        </article>
        <article className="summary-card">
          <p>Transactions</p>
          <h2>{summary.count}</h2>
          <span>Expenses recorded</span>
        </article>
      </section>

      {error && <p className="error" role="alert">{error}</p>}

      <section className="content">
        <form className="panel expense-form" onSubmit={handleSubmit}>
          <h2>{editingId ? "Edit expense" : "Add an expense"}</h2>
          <p className="muted">Enter the details below.</p>

          <label htmlFor="title">Expense name</label>
          <input
            ref={titleInputRef}
            id="title"
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="e.g. Lunch"
            required
          />

          <label htmlFor="amount">Amount (ETB)</label>
          <input
            id="amount"
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={handleChange}
            placeholder="0.00"
            required
          />

          <label htmlFor="category">Category</label>
          <select
            id="category"
            name="category"
            value={form.category}
            onChange={handleChange}
          >
            {["Food", "Transport", "Education", "Shopping", "Bills", "Health", "Other"].map(
              (category) => (
                <option key={category}>{category}</option>
              )
            )}
          </select>

          <label htmlFor="date">Date</label>
          <input
            id="date"
            name="date"
            type="date"
            value={form.date}
            onChange={handleChange}
            required
          />

          <button className="primary-button" disabled={saving}>
            {saving
              ? "Saving..."
              : editingId
                ? "Update expense"
                : "Add expense"}
          </button>

          {editingId && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setEditingId(null);
                setForm(initialForm);
              }}
            >
              Cancel editing
            </button>
          )}
        </form>

        <section className="panel expenses-panel">
          <div className="list-heading">
            <div>
              <h2>Your expenses</h2>
              <p className="muted">Manage your spending records.</p>
            </div>
            <span className="count-badge">{filteredExpenses.length}</span>
          </div>

          <div className="filters">
            <input
              aria-label="Search expenses"
              placeholder="Search expenses..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option>All</option>
              {["Food", "Transport", "Education", "Shopping", "Bills", "Health", "Other"].map(
                (category) => (
                  <option key={category}>{category}</option>
                )
              )}
            </select>
          </div>

          {loading ? (
            <p className="empty">Loading expenses...</p>
          ) : filteredExpenses.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">↗</div>
              <h3>No expenses found</h3>
              <p>Try another search or add your first expense.</p>
            </div>
          ) : (
            <div className="expense-list">
              {filteredExpenses.map((expense) => (
                <article className="expense-row" key={expense.id}>
                  <div className="expense-symbol">
                    {expense.category === "Food" ? "F" :
                     expense.category === "Transport" ? "T" :
                     expense.category === "Education" ? "E" : "•"}
                  </div>
                  <div className="expense-info">
                    <strong>{expense.title}</strong>
                    <span>
                      {expense.category} · {expense.date}
                    </span>
                  </div>
                  <div className="expense-actions">
                    <strong>{money(Number(expense.amount))}</strong>
                    <div>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => startEditing(expense)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-button delete-button"
                        onClick={() => deleteExpense(expense.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <footer>Expense Tracker · Built with React</footer>
    </main>
  );
}
