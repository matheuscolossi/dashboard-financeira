import { useState, useEffect, useCallback, useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from "recharts";

const CATEGORIES = {
  receita: ["Salário", "Freelance", "Investimentos", "Vendas", "Outros"],
  despesa: ["Moradia", "Alimentação", "Transporte", "Saúde", "Educação", "Lazer", "Assinaturas", "Outros"],
};

const CATEGORY_ICONS = {
  "Salário": "💰", "Freelance": "💻", "Investimentos": "📈", "Vendas": "🛒", 
  "Moradia": "🏠", "Alimentação": "🍽️", "Transporte": "🚗", "Saúde": "🏥",
  "Educação": "📚", "Lazer": "🎮", "Assinaturas": "📱", "Outros": "📦",
};

const COLORS = [
  "#E8C547", "#D4A03E", "#C17B35", "#AE562C",
  "#6B8F71", "#4A7C59", "#2D6A4F", "#1B4332",
  "#8B6914", "#A67C00", "#BF9B30", "#D4B44A",
];

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// Tiny modal
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(10,10,8,0.7)", backdropFilter: "blur(8px)",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#1A1A16", border: "1px solid #333328",
        borderRadius: 16, padding: "32px", width: "min(480px, 92vw)",
        maxHeight: "85vh", overflowY: "auto",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: "#E8C547", fontFamily: "'Playfair Display', serif" }}>{title}</h2>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "#888", fontSize: 22, cursor: "pointer",
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, icon, sub }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #1A1A16 0%, #222218 100%)",
      border: "1px solid #333328", borderRadius: 14, padding: "22px 24px",
      flex: "1 1 200px", minWidth: 180, position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: -10, right: -10, fontSize: 64, opacity: 0.06,
        fontFamily: "serif",
      }}>{icon}</div>
      <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent, fontFamily: "'Playfair Display', serif", lineHeight: 1.1 }}>
        {formatCurrency(value)}
      </div>
      {sub && <div style={{ fontSize: 12, color: "#666", marginTop: 6, fontFamily: "'DM Sans', sans-serif" }}>{sub}</div>}
    </div>
  );
}

export default function FinancialDashboard() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [form, setForm] = useState({
    tipo: "despesa", categoria: "Alimentação", valor: "", descricao: "", data: new Date().toISOString().split("T")[0],
  });

  // Persistent Storage
  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get("fin-transactions");
        if (result?.value) setTransactions(JSON.parse(result.value));
      } catch { }
      setLoading(false);
    })();
  }, []);

  const persist = useCallback(async (txs) => {
    setTransactions(txs);
    try { await window.storage.set("fin-transactions", JSON.stringify(txs)); } catch { }
  }, []);

  // Filtered data
  const filtered = useMemo(() =>
    transactions.filter(t => {
      const d = new Date(t.data + "T00:00:00");
      return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
    }), [transactions, filterMonth, filterYear]);

  const totalReceitas = useMemo(() => filtered.filter(t => t.tipo === "receita").reduce((s, t) => s + t.valor, 0), [filtered]);
  const totalDespesas = useMemo(() => filtered.filter(t => t.tipo === "despesa").reduce((s, t) => s + t.valor, 0), [filtered]);
  const saldo = totalReceitas - totalDespesas;

  // Chart data
  const categoryData = useMemo(() => {
    const map = {};
    filtered.filter(t => t.tipo === "despesa").forEach(t => {
      map[t.categoria] = (map[t.categoria] || 0) + t.valor;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const monthlyData = useMemo(() => {
    const data = MONTHS.map((m, i) => ({ name: m, receitas: 0, despesas: 0 }));
    transactions.filter(t => new Date(t.data + "T00:00:00").getFullYear() === filterYear).forEach(t => {
      const mi = new Date(t.data + "T00:00:00").getMonth();
      if (t.tipo === "receita") data[mi].receitas += t.valor;
      else data[mi].despesas += t.valor;
    });
    return data;
  }, [transactions, filterYear]);

  // Form handlers
  const openNew = () => {
    setEditingTx(null);
    setForm({ tipo: "despesa", categoria: "Alimentação", valor: "", descricao: "", data: new Date().toISOString().split("T")[0] });
    setModalOpen(true);
  };

  const openEdit = (tx) => {
    setEditingTx(tx);
    setForm({ tipo: tx.tipo, categoria: tx.categoria, valor: String(tx.valor), descricao: tx.descricao, data: tx.data });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.valor || isNaN(parseFloat(form.valor))) return;
    const entry = { ...form, valor: parseFloat(form.valor), id: editingTx ? editingTx.id : generateId() };
    const updated = editingTx ? transactions.map(t => t.id === editingTx.id ? entry : t) : [...transactions, entry];
    persist(updated);
    setModalOpen(false);
  };

  const handleDelete = (id) => persist(transactions.filter(t => t.id !== id));

  const inputStyle = {
    background: "#111110", border: "1px solid #333328", borderRadius: 8,
    padding: "10px 14px", color: "#E8E4D9", fontSize: 14, width: "100%",
    outline: "none", fontFamily: "'DM Sans', sans-serif",
  };

  const btnStyle = (bg, color) => ({
    background: bg, color, border: "none", borderRadius: 8,
    padding: "10px 20px", fontSize: 14, cursor: "pointer", fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
  });

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0E0E0C", color: "#E8C547", fontFamily: "'Playfair Display', serif", fontSize: 24 }}>
      Carregando...
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh", background: "#0E0E0C", color: "#E8E4D9",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        background: "linear-gradient(180deg, #161612 0%, #0E0E0C 100%)",
        borderBottom: "1px solid #222218", padding: "20px 32px",
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16,
      }}>
        <div>
          <h1 style={{
            margin: 0, fontSize: 28, fontFamily: "'Playfair Display', serif",
            background: "linear-gradient(135deg, #E8C547 0%, #D4A03E 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Finanças
          </h1>
          <div style={{ fontSize: 12, color: "#666", marginTop: 4, letterSpacing: 1 }}>GESTÃO FINANCEIRA PESSOAL</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Month/Year selector */}
          <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} style={{ ...inputStyle, width: "auto", cursor: "pointer" }}>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} style={{ ...inputStyle, width: "auto", cursor: "pointer" }}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Tab nav */}
          {["dashboard", "transações"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              ...btnStyle(activeTab === tab ? "#E8C547" : "transparent", activeTab === tab ? "#0E0E0C" : "#888"),
              border: activeTab === tab ? "none" : "1px solid #333328",
              textTransform: "capitalize",
            }}>{tab}</button>
          ))}

          <button onClick={openNew} style={btnStyle("#E8C547", "#0E0E0C")}>
            + Novo Lançamento
          </button>
        </div>
      </div>

      <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
        {activeTab === "dashboard" ? (
          <>
            {/* Stat Cards */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
              <StatCard label="Receitas" value={totalReceitas} accent="#6B8F71" icon="↑" sub={`${filtered.filter(t => t.tipo === "receita").length} lançamentos`} />
              <StatCard label="Despesas" value={totalDespesas} accent="#C17B35" icon="↓" sub={`${filtered.filter(t => t.tipo === "despesa").length} lançamentos`} />
              <StatCard label="Saldo" value={saldo} accent={saldo >= 0 ? "#E8C547" : "#D44"} icon="◆"
                sub={saldo >= 0 ? "Positivo" : "Negativo"} />
            </div>

            {/* Charts Row */}
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 28 }}>
              {/* Area chart */}
              <div style={{
                flex: "2 1 400px", background: "#1A1A16", border: "1px solid #333328",
                borderRadius: 14, padding: 24, minHeight: 300,
              }}>
                <h3 style={{ margin: "0 0 20px", fontSize: 14, color: "#888", letterSpacing: 2, textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>
                  Evolução Anual — {filterYear}
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6B8F71" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6B8F71" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gDesp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C17B35" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#C17B35" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222218" />
                    <XAxis dataKey="name" tick={{ fill: "#666", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#666", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: "#1A1A16", border: "1px solid #333328", borderRadius: 8, color: "#E8E4D9", fontSize: 13 }}
                      formatter={(v) => formatCurrency(v)}
                    />
                    <Area type="monotone" dataKey="receitas" stroke="#6B8F71" fill="url(#gRec)" strokeWidth={2} name="Receitas" />
                    <Area type="monotone" dataKey="despesas" stroke="#C17B35" fill="url(#gDesp)" strokeWidth={2} name="Despesas" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Pie chart */}
              <div style={{
                flex: "1 1 280px", background: "#1A1A16", border: "1px solid #333328",
                borderRadius: 14, padding: 24, minHeight: 300,
              }}>
                <h3 style={{ margin: "0 0 20px", fontSize: 14, color: "#888", letterSpacing: 2, textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>
                  Despesas por Categoria
                </h3>
                {categoryData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                          {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: "#1A1A16", border: "1px solid #333328", borderRadius: 8, color: "#E8E4D9", fontSize: 13 }}
                          formatter={v => formatCurrency(v)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 8 }}>
                      {categoryData.slice(0, 5).map((c, i) => (
                        <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: COLORS[i % COLORS.length] }} />
                          <span style={{ color: "#AAA" }}>{c.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ color: "#555", fontSize: 14, textAlign: "center", marginTop: 60 }}>Sem despesas neste período</div>
                )}
              </div>
            </div>

            {/* Recent transactions */}
            <div style={{
              background: "#1A1A16", border: "1px solid #333328", borderRadius: 14, padding: 24,
            }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 14, color: "#888", letterSpacing: 2, textTransform: "uppercase" }}>
                Últimos Lançamentos
              </h3>
              {filtered.length === 0 ? (
                <div style={{ color: "#555", textAlign: "center", padding: 40, fontSize: 14 }}>
                  Nenhum lançamento neste mês. Clique em "+ Novo Lançamento" para começar.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[...filtered].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8).map(tx => (
                    <div key={tx.id} style={{
                      display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
                      background: "#111110", borderRadius: 10, cursor: "pointer",
                      transition: "background 0.15s",
                    }} onClick={() => openEdit(tx)}
                      onMouseEnter={e => e.currentTarget.style.background = "#1E1E18"}
                      onMouseLeave={e => e.currentTarget.style.background = "#111110"}
                    >
                      <div style={{ fontSize: 22, width: 36, textAlign: "center" }}>
                        {CATEGORY_ICONS[tx.categoria] || "📦"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "#E8E4D9" }}>
                          {tx.descricao || tx.categoria}
                        </div>
                        <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                          {tx.categoria} · {formatDate(tx.data)}
                        </div>
                      </div>
                      <div style={{
                        fontWeight: 700, fontSize: 15, fontFamily: "'Playfair Display', serif",
                        color: tx.tipo === "receita" ? "#6B8F71" : "#C17B35",
                      }}>
                        {tx.tipo === "receita" ? "+" : "−"}{formatCurrency(tx.valor)}
                      </div>
                      <button onClick={e => { e.stopPropagation(); handleDelete(tx.id); }} style={{
                        background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 16, padding: "4px 8px",
                      }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* TRANSACTIONS TAB */
          <div style={{
            background: "#1A1A16", border: "1px solid #333328", borderRadius: 14, padding: 24,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14, color: "#888", letterSpacing: 2, textTransform: "uppercase" }}>
                Todos os Lançamentos — {MONTHS[filterMonth]} {filterYear}
              </h3>
              <div style={{ fontSize: 13, color: "#666" }}>{filtered.length} itens</div>
            </div>
            {filtered.length === 0 ? (
              <div style={{ color: "#555", textAlign: "center", padding: 60, fontSize: 14 }}>
                Nenhum lançamento encontrado neste período.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[...filtered].sort((a, b) => b.data.localeCompare(a.data)).map(tx => (
                  <div key={tx.id} style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
                    background: "#111110", borderRadius: 10, cursor: "pointer",
                    transition: "background 0.15s",
                  }} onClick={() => openEdit(tx)}
                    onMouseEnter={e => e.currentTarget.style.background = "#1E1E18"}
                    onMouseLeave={e => e.currentTarget.style.background = "#111110"}
                  >
                    <div style={{ fontSize: 22, width: 36, textAlign: "center" }}>
                      {CATEGORY_ICONS[tx.categoria] || "📦"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "#E8E4D9" }}>
                        {tx.descricao || tx.categoria}
                      </div>
                      <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                        {tx.categoria} · {formatDate(tx.data)}
                      </div>
                    </div>
                    <div style={{
                      padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: tx.tipo === "receita" ? "rgba(107,143,113,0.15)" : "rgba(193,123,53,0.15)",
                      color: tx.tipo === "receita" ? "#6B8F71" : "#C17B35",
                    }}>
                      {tx.tipo === "receita" ? "RECEITA" : "DESPESA"}
                    </div>
                    <div style={{
                      fontWeight: 700, fontSize: 15, fontFamily: "'Playfair Display', serif",
                      color: tx.tipo === "receita" ? "#6B8F71" : "#C17B35",
                      minWidth: 110, textAlign: "right",
                    }}>
                      {tx.tipo === "receita" ? "+" : "−"}{formatCurrency(tx.valor)}
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleDelete(tx.id); }} style={{
                      background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 16, padding: "4px 8px",
                    }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Summary footer */}
            <div style={{
              display: "flex", justifyContent: "flex-end", gap: 24, marginTop: 20, padding: "16px 16px 0",
              borderTop: "1px solid #222218", flexWrap: "wrap",
            }}>
              <div style={{ fontSize: 13 }}>
                <span style={{ color: "#888" }}>Receitas: </span>
                <span style={{ color: "#6B8F71", fontWeight: 700 }}>{formatCurrency(totalReceitas)}</span>
              </div>
              <div style={{ fontSize: 13 }}>
                <span style={{ color: "#888" }}>Despesas: </span>
                <span style={{ color: "#C17B35", fontWeight: 700 }}>{formatCurrency(totalDespesas)}</span>
              </div>
              <div style={{ fontSize: 13 }}>
                <span style={{ color: "#888" }}>Saldo: </span>
                <span style={{ color: saldo >= 0 ? "#E8C547" : "#D44", fontWeight: 700 }}>{formatCurrency(saldo)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingTx ? "Editar Lançamento" : "Novo Lançamento"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Tipo */}
          <div style={{ display: "flex", gap: 8 }}>
            {["despesa", "receita"].map(t => (
              <button key={t} onClick={() => setForm(f => ({
                ...f, tipo: t,
                categoria: CATEGORIES[t][0],
              }))} style={{
                ...btnStyle(form.tipo === t ? (t === "receita" ? "#6B8F71" : "#C17B35") : "transparent",
                  form.tipo === t ? "#fff" : "#888"),
                flex: 1, border: form.tipo === t ? "none" : "1px solid #333328",
                textTransform: "capitalize",
              }}>{t}</button>
            ))}
          </div>

          {/* Categoria */}
          <div>
            <label style={{ fontSize: 12, color: "#888", marginBottom: 6, display: "block" }}>Categoria</label>
            <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              style={{ ...inputStyle, cursor: "pointer" }}>
              {CATEGORIES[form.tipo].map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
            </select>
          </div>

          {/* Valor */}
          <div>
            <label style={{ fontSize: 12, color: "#888", marginBottom: 6, display: "block" }}>Valor (R$)</label>
            <input type="number" step="0.01" placeholder="0,00" value={form.valor}
              onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} style={inputStyle} />
          </div>

          {/* Descrição */}
          <div>
            <label style={{ fontSize: 12, color: "#888", marginBottom: 6, display: "block" }}>Descrição (opcional)</label>
            <input type="text" placeholder="Ex: Conta de luz" value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} style={inputStyle} />
          </div>

          {/* Data */}
          <div>
            <label style={{ fontSize: 12, color: "#888", marginBottom: 6, display: "block" }}>Data</label>
            <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} style={inputStyle} />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button onClick={() => setModalOpen(false)} style={{ ...btnStyle("transparent", "#888"), border: "1px solid #333328", flex: 1 }}>
              Cancelar
            </button>
            <button onClick={handleSave} style={{ ...btnStyle("#E8C547", "#0E0E0C"), flex: 1 }}>
              {editingTx ? "Salvar" : "Adicionar"}
            </button>
          </div>

          {editingTx && (
            <button onClick={() => { handleDelete(editingTx.id); setModalOpen(false); }}
              style={{ ...btnStyle("transparent", "#D44"), border: "1px solid #441111", width: "100%", marginTop: 4 }}>
              Excluir Lançamento
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}