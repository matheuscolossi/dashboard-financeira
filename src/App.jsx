import { useState, useEffect, useCallback, useMemo } from "react";
import { PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from "recharts";

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

// ─── Storage helpers ──────────────────────────────────────────────────────────
async function storageGet(key) {
  try {
    const r = await window.storage.get(key);
    return r?.value ? JSON.parse(r.value) : null;
  } catch { return null; }
}

async function storageSet(key, value) {
  try { await window.storage.set(key, JSON.stringify(value)); } catch { }
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────
async function getUsers() {
  return (await storageGet("fin-users")) || [];
}

async function saveUsers(users) {
  await storageSet("fin-users", users);
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({ onLogin }) {
  const [aba, setAba] = useState("login"); // "login" | "cadastro"
  const [form, setForm] = useState({ nome: "", usuario: "", senha: "", confirmar: "" });
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const inputStyle = {
    background: "#111110", border: "1px solid #333328", borderRadius: 8,
    padding: "12px 16px", color: "#E8E4D9", fontSize: 14, width: "100%",
    outline: "none", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box",
  };

  const trocarAba = (nova) => {
    setAba(nova);
    setErro("");
    setForm({ nome: "", usuario: "", senha: "", confirmar: "" });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.usuario || !form.senha) { setErro("Preencha todos os campos."); return; }
    setCarregando(true);
    const users = await getUsers();
    const user = users.find(u => u.usuario === form.usuario.toLowerCase().trim() && u.senha === form.senha);
    setCarregando(false);
    if (user) {
      onLogin(user);
    } else {
      setErro("Usuário ou senha incorretos.");
    }
  };

  const handleCadastro = async (e) => {
    e.preventDefault();
    const { nome, usuario, senha, confirmar } = form;
    if (!nome.trim() || !usuario.trim() || !senha || !confirmar) { setErro("Preencha todos os campos."); return; }
    if (usuario.length < 3) { setErro("O usuário deve ter ao menos 3 caracteres."); return; }
    if (senha.length < 4) { setErro("A senha deve ter ao menos 4 caracteres."); return; }
    if (senha !== confirmar) { setErro("As senhas não coincidem."); return; }
    setCarregando(true);
    const users = await getUsers();
    if (users.find(u => u.usuario === usuario.toLowerCase().trim())) {
      setCarregando(false);
      setErro("Esse usuário já existe. Escolha outro.");
      return;
    }
    const novoUser = { id: generateId(), nome: nome.trim(), usuario: usuario.toLowerCase().trim(), senha };
    await saveUsers([...users, novoUser]);
    setCarregando(false);
    onLogin(novoUser);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0E0E0C",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif", padding: 16,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{
        background: "#1A1A16", border: "1px solid #333328",
        borderRadius: 20, width: "min(400px, 100%)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)", overflow: "hidden",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", padding: "40px 40px 24px" }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>💎</div>
          <h1 style={{
            margin: 0, fontSize: 26, fontFamily: "'Playfair Display', serif",
            background: "linear-gradient(135deg, #E8C547 0%, #D4A03E 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>Finanças</h1>
          <div style={{ fontSize: 11, color: "#555", marginTop: 6, letterSpacing: 2 }}>GESTÃO FINANCEIRA PESSOAL</div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #222218" }}>
          {[["login", "Entrar"], ["cadastro", "Criar conta"]].map(([id, label]) => (
            <button key={id} onClick={() => trocarAba(id)} style={{
              flex: 1, padding: "14px", background: "none", border: "none",
              borderBottom: aba === id ? "2px solid #E8C547" : "2px solid transparent",
              color: aba === id ? "#E8C547" : "#666",
              fontSize: 14, fontWeight: 600, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              transition: "all 0.2s",
            }}>{label}</button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={aba === "login" ? handleLogin : handleCadastro}
          style={{ padding: "28px 32px 36px", display: "flex", flexDirection: "column", gap: 16 }}>

          {aba === "cadastro" && (
            <div>
              <label style={{ fontSize: 11, color: "#888", marginBottom: 6, display: "block", letterSpacing: 1 }}>NOME COMPLETO</label>
              <input
                type="text" placeholder="Ex: João Silva" value={form.nome} autoFocus={aba === "cadastro"}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} style={inputStyle}
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: 11, color: "#888", marginBottom: 6, display: "block", letterSpacing: 1 }}>USUÁRIO</label>
            <input
              type="text" placeholder="Ex: joao123" value={form.usuario} autoFocus={aba === "login"}
              onChange={e => setForm(f => ({ ...f, usuario: e.target.value }))} style={inputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: "#888", marginBottom: 6, display: "block", letterSpacing: 1 }}>SENHA</label>
            <input
              type="password" placeholder="••••••••" value={form.senha}
              onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} style={inputStyle}
            />
          </div>

          {aba === "cadastro" && (
            <div>
              <label style={{ fontSize: 11, color: "#888", marginBottom: 6, display: "block", letterSpacing: 1 }}>CONFIRMAR SENHA</label>
              <input
                type="password" placeholder="••••••••" value={form.confirmar}
                onChange={e => setForm(f => ({ ...f, confirmar: e.target.value }))} style={inputStyle}
              />
            </div>
          )}

          {erro && (
            <div style={{
              background: "rgba(200,60,60,0.1)", border: "1px solid rgba(200,60,60,0.3)",
              borderRadius: 8, padding: "10px 14px", color: "#E07070", fontSize: 13,
            }}>{erro}</div>
          )}

          <button type="submit" disabled={carregando} style={{
            background: "linear-gradient(135deg, #E8C547 0%, #D4A03E 100%)",
            color: "#0E0E0C", border: "none", borderRadius: 8,
            padding: "13px", fontSize: 15, cursor: carregando ? "not-allowed" : "pointer",
            fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
            opacity: carregando ? 0.7 : 1, marginTop: 4,
          }}>
            {carregando ? "Aguarde..." : aba === "login" ? "Entrar" : "Criar conta"}
          </button>

          <div style={{ textAlign: "center", fontSize: 13, color: "#555" }}>
            {aba === "login" ? (
              <>Não tem conta?{" "}
                <button type="button" onClick={() => trocarAba("cadastro")} style={{
                  background: "none", border: "none", color: "#E8C547", cursor: "pointer",
                  fontSize: 13, fontFamily: "'DM Sans', sans-serif", padding: 0,
                }}>Criar agora</button>
              </>
            ) : (
              <>Já tem conta?{" "}
                <button type="button" onClick={() => trocarAba("login")} style={{
                  background: "none", border: "none", color: "#E8C547", cursor: "pointer",
                  fontSize: 13, fontFamily: "'DM Sans', sans-serif", padding: 0,
                }}>Entrar</button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────
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
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", fontSize: 22, cursor: "pointer" }}>✕</button>
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
      <div style={{ position: "absolute", top: -10, right: -10, fontSize: 64, opacity: 0.06, fontFamily: "serif" }}>{icon}</div>
      <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent, fontFamily: "'Playfair Display', serif", lineHeight: 1.1 }}>{formatCurrency(value)}</div>
      {sub && <div style={{ fontSize: 12, color: "#666", marginTop: 6, fontFamily: "'DM Sans', sans-serif" }}>{sub}</div>}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
function Dashboard({ usuario, onLogout }) {
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

  const storageKey = `fin-transactions-${usuario.id}`;

  useEffect(() => {
    (async () => {
      const data = await storageGet(storageKey);
      if (data) setTransactions(data);
      setLoading(false);
    })();
  }, [storageKey]);

  const persist = useCallback(async (txs) => {
    setTransactions(txs);
    await storageSet(storageKey, txs);
  }, [storageKey]);

  const filtered = useMemo(() =>
    transactions.filter(t => {
      const d = new Date(t.data + "T00:00:00");
      return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
    }), [transactions, filterMonth, filterYear]);

  const totalReceitas = useMemo(() => filtered.filter(t => t.tipo === "receita").reduce((s, t) => s + t.valor, 0), [filtered]);
  const totalDespesas = useMemo(() => filtered.filter(t => t.tipo === "despesa").reduce((s, t) => s + t.valor, 0), [filtered]);
  const saldo = totalReceitas - totalDespesas;

  const categoryData = useMemo(() => {
    const map = {};
    filtered.filter(t => t.tipo === "despesa").forEach(t => {
      map[t.categoria] = (map[t.categoria] || 0) + t.valor;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const monthlyData = useMemo(() => {
    const data = MONTHS.map((m) => ({ name: m, receitas: 0, despesas: 0 }));
    transactions.filter(t => new Date(t.data + "T00:00:00").getFullYear() === filterYear).forEach(t => {
      const mi = new Date(t.data + "T00:00:00").getMonth();
      if (t.tipo === "receita") data[mi].receitas += t.valor;
      else data[mi].despesas += t.valor;
    });
    return data;
  }, [transactions, filterYear]);

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
    <div style={{ minHeight: "100vh", background: "#0E0E0C", color: "#E8E4D9", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        background: "linear-gradient(180deg, #161612 0%, #0E0E0C 100%)",
        borderBottom: "1px solid #222218", padding: "16px 32px",
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <h1 style={{
            margin: 0, fontSize: 26, fontFamily: "'Playfair Display', serif",
            background: "linear-gradient(135deg, #E8C547 0%, #D4A03E 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>Finanças</h1>
          <div style={{ fontSize: 11, color: "#555", marginTop: 2, letterSpacing: 1 }}>GESTÃO FINANCEIRA PESSOAL</div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} style={{ ...inputStyle, width: "auto", cursor: "pointer" }}>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} style={{ ...inputStyle, width: "auto", cursor: "pointer" }}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {["dashboard", "transações"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              ...btnStyle(activeTab === tab ? "#E8C547" : "transparent", activeTab === tab ? "#0E0E0C" : "#888"),
              border: activeTab === tab ? "none" : "1px solid #333328",
              textTransform: "capitalize",
            }}>{tab}</button>
          ))}

          <button onClick={openNew} style={btnStyle("#E8C547", "#0E0E0C")}>+ Novo Lançamento</button>

          {/* User info + logout */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 4, paddingLeft: 12, borderLeft: "1px solid #222218" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#E8E4D9" }}>{usuario.nome}</div>
              <div style={{ fontSize: 11, color: "#555" }}>@{usuario.usuario}</div>
            </div>
            <button onClick={onLogout} title="Sair" style={{
              background: "#1A1A16", border: "1px solid #333328", borderRadius: 8,
              color: "#888", fontSize: 13, padding: "8px 12px", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
            }}>Sair</button>
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
        {activeTab === "dashboard" ? (
          <>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
              <StatCard label="Receitas" value={totalReceitas} accent="#6B8F71" icon="↑" sub={`${filtered.filter(t => t.tipo === "receita").length} lançamentos`} />
              <StatCard label="Despesas" value={totalDespesas} accent="#C17B35" icon="↓" sub={`${filtered.filter(t => t.tipo === "despesa").length} lançamentos`} />
              <StatCard label="Saldo" value={saldo} accent={saldo >= 0 ? "#E8C547" : "#D44"} icon="◆" sub={saldo >= 0 ? "Positivo" : "Negativo"} />
            </div>

            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 28 }}>
              <div style={{ flex: "2 1 400px", background: "#1A1A16", border: "1px solid #333328", borderRadius: 14, padding: 24, minHeight: 300 }}>
                <h3 style={{ margin: "0 0 20px", fontSize: 14, color: "#888", letterSpacing: 2, textTransform: "uppercase" }}>
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

              <div style={{ flex: "1 1 280px", background: "#1A1A16", border: "1px solid #333328", borderRadius: 14, padding: 24, minHeight: 300 }}>
                <h3 style={{ margin: "0 0 20px", fontSize: 14, color: "#888", letterSpacing: 2, textTransform: "uppercase" }}>
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

            <div style={{ background: "#1A1A16", border: "1px solid #333328", borderRadius: 14, padding: 24 }}>
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
                    <TxRow key={tx.id} tx={tx} onEdit={openEdit} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ background: "#1A1A16", border: "1px solid #333328", borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14, color: "#888", letterSpacing: 2, textTransform: "uppercase" }}>
                Todos os Lançamentos — {MONTHS[filterMonth]} {filterYear}
              </h3>
              <div style={{ fontSize: 13, color: "#666" }}>{filtered.length} itens</div>
            </div>
            {filtered.length === 0 ? (
              <div style={{ color: "#555", textAlign: "center", padding: 60, fontSize: 14 }}>Nenhum lançamento encontrado neste período.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[...filtered].sort((a, b) => b.data.localeCompare(a.data)).map(tx => (
                  <TxRow key={tx.id} tx={tx} onEdit={openEdit} onDelete={handleDelete} showBadge />
                ))}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 24, marginTop: 20, padding: "16px 16px 0", borderTop: "1px solid #222218", flexWrap: "wrap" }}>
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
          <div style={{ display: "flex", gap: 8 }}>
            {["despesa", "receita"].map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, tipo: t, categoria: CATEGORIES[t][0] }))} style={{
                ...btnStyle(form.tipo === t ? (t === "receita" ? "#6B8F71" : "#C17B35") : "transparent", form.tipo === t ? "#fff" : "#888"),
                flex: 1, border: form.tipo === t ? "none" : "1px solid #333328", textTransform: "capitalize",
              }}>{t}</button>
            ))}
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#888", marginBottom: 6, display: "block" }}>Categoria</label>
            <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
              {CATEGORIES[form.tipo].map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#888", marginBottom: 6, display: "block" }}>Valor (R$)</label>
            <input type="number" step="0.01" placeholder="0,00" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} style={inputStyle} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#888", marginBottom: 6, display: "block" }}>Descrição (opcional)</label>
            <input type="text" placeholder="Ex: Conta de luz" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} style={inputStyle} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#888", marginBottom: 6, display: "block" }}>Data</label>
            <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} style={inputStyle} />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button onClick={() => setModalOpen(false)} style={{ ...btnStyle("transparent", "#888"), border: "1px solid #333328", flex: 1 }}>Cancelar</button>
            <button onClick={handleSave} style={{ ...btnStyle("#E8C547", "#0E0E0C"), flex: 1 }}>{editingTx ? "Salvar" : "Adicionar"}</button>
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

function TxRow({ tx, onEdit, onDelete, showBadge }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
      background: "#111110", borderRadius: 10, cursor: "pointer", transition: "background 0.15s",
    }}
      onClick={() => onEdit(tx)}
      onMouseEnter={e => e.currentTarget.style.background = "#1E1E18"}
      onMouseLeave={e => e.currentTarget.style.background = "#111110"}
    >
      <div style={{ fontSize: 22, width: 36, textAlign: "center" }}>{CATEGORY_ICONS[tx.categoria] || "📦"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#E8E4D9" }}>{tx.descricao || tx.categoria}</div>
        <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{tx.categoria} · {formatDate(tx.data)}</div>
      </div>
      {showBadge && (
        <div style={{
          padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
          background: tx.tipo === "receita" ? "rgba(107,143,113,0.15)" : "rgba(193,123,53,0.15)",
          color: tx.tipo === "receita" ? "#6B8F71" : "#C17B35",
        }}>
          {tx.tipo === "receita" ? "RECEITA" : "DESPESA"}
        </div>
      )}
      <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "'Playfair Display', serif", color: tx.tipo === "receita" ? "#6B8F71" : "#C17B35", minWidth: 110, textAlign: "right" }}>
        {tx.tipo === "receita" ? "+" : "−"}{formatCurrency(tx.valor)}
      </div>
      <button onClick={e => { e.stopPropagation(); onDelete(tx.id); }} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 16, padding: "4px 8px" }}>✕</button>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [usuario, setUsuario] = useState(null);

  const handleLogin = (user) => setUsuario(user);
  const handleLogout = () => setUsuario(null);

  if (!usuario) return <AuthScreen onLogin={handleLogin} />;
  return <Dashboard usuario={usuario} onLogout={handleLogout} />;
}
