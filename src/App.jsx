import { useState, useEffect, useCallback, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from "recharts";
import {
  lsGet, lsSet, getUsers, saveUsers, getSession, saveSession, clearSession,
  generateSecret, verifyTOTP, totpUri, generateRecoveryCodes, generateId, findUser,
} from "./auth.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = {
  receita: ["Salário", "Freelance", "Investimentos", "Vendas", "Outros"],
  despesa: ["Moradia", "Alimentação", "Transporte", "Saúde", "Educação", "Lazer", "Assinaturas", "Outros"],
};
const CATEGORY_ICONS = {
  "Salário": "💰", "Freelance": "💻", "Investimentos": "📈", "Vendas": "🛒",
  "Moradia": "🏠", "Alimentação": "🍽️", "Transporte": "🚗", "Saúde": "🏥",
  "Educação": "📚", "Lazer": "🎮", "Assinaturas": "📱", "Outros": "📦",
};
const COLORS = ["#E8C547","#D4A03E","#C17B35","#AE562C","#6B8F71","#4A7C59","#2D6A4F","#1B4332","#8B6914","#A67C00","#BF9B30","#D4B44A"];
const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function formatCurrency(v) { return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v); }
function formatDate(s) { return new Date(s+"T00:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short"}); }

// ─── Shared UI ────────────────────────────────────────────────────────────────
const BASE_INPUT = {
  background:"#111110", border:"1px solid #333328", borderRadius:8,
  padding:"11px 14px", color:"#E8E4D9", fontSize:14, width:"100%",
  outline:"none", fontFamily:"'DM Sans',sans-serif", boxSizing:"border-box",
};

function Input({ label, error, ...props }) {
  return (
    <div>
      {label && <label style={{fontSize:11,color:"#888",marginBottom:6,display:"block",letterSpacing:1}}>{label}</label>}
      <input {...props} style={{...BASE_INPUT, border:`1px solid ${error?"#c44":"#333328"}`, ...props.style}} />
      {error && <div style={{color:"#e07070",fontSize:12,marginTop:5}}>{error}</div>}
    </div>
  );
}

function Btn({ children, variant="gold", disabled, onClick, type="button", style={} }) {
  const variants = {
    gold: { background:"linear-gradient(135deg,#E8C547,#D4A03E)", color:"#0E0E0C" },
    ghost: { background:"transparent", color:"#888", border:"1px solid #333328" },
    danger: { background:"transparent", color:"#e07070", border:"1px solid #441111" },
    green: { background:"#2D6A4F", color:"#fff" },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      ...variants[variant], border:"none", borderRadius:8,
      padding:"12px 20px", fontSize:14, cursor:disabled?"not-allowed":"pointer",
      fontWeight:700, fontFamily:"'DM Sans',sans-serif", opacity:disabled?0.6:1,
      transition:"all 0.2s", width:"100%", ...style, ...variants[variant],
    }}>{children}</button>
  );
}

function Alert({ children, type="error" }) {
  const colors = { error:["rgba(200,60,60,0.1)","rgba(200,60,60,0.3)","#e07070"], info:["rgba(232,197,71,0.08)","rgba(232,197,71,0.2)","#E8C547"] };
  const [bg, border, color] = colors[type];
  return (
    <div style={{background:bg, border:`1px solid ${border}`, borderRadius:8, padding:"10px 14px", color, fontSize:13}}>
      {children}
    </div>
  );
}

function AuthCard({ children, title, subtitle }) {
  return (
    <div style={{minHeight:"100vh",background:"#0E0E0C",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",padding:16}}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <div style={{background:"#1A1A16",border:"1px solid #333328",borderRadius:20,width:"min(420px,100%)",boxShadow:"0 24px 80px rgba(0,0,0,0.6)",overflow:"hidden"}}>
        <div style={{textAlign:"center",padding:"36px 36px 24px"}}>
          <div style={{fontSize:36,marginBottom:10}}>💎</div>
          <h1 style={{margin:0,fontSize:24,fontFamily:"'Playfair Display',serif",background:"linear-gradient(135deg,#E8C547,#D4A03E)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
            Finanças
          </h1>
          {subtitle && <div style={{fontSize:12,color:"#555",marginTop:6,letterSpacing:1}}>{subtitle}</div>}
          {title && <div style={{fontSize:15,color:"#E8E4D9",marginTop:10,fontWeight:600}}>{title}</div>}
        </div>
        <div style={{padding:"4px 32px 36px",display:"flex",flexDirection:"column",gap:16}}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Views ────────────────────────────────────────────────────────────────────

// 1. Login
function LoginView({ onLogin, onGo }) {
  const [form, setForm] = useState({ usuario:"", senha:"" });
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    if (!form.usuario || !form.senha) { setErro("Preencha todos os campos."); return; }
    setLoading(true); setErro("");
    const user = findUser(form.usuario);
    if (!user || user.senha !== form.senha) {
      setLoading(false); setErro("Usuário ou senha incorretos."); return;
    }
    setLoading(false);
    if (user.totp?.enabled) { onGo("verify-2fa", { user }); }
    else { onLogin(user); }
  };

  const f = (k) => (e) => setForm(p => ({...p, [k]:e.target.value}));

  return (
    <AuthCard subtitle="GESTÃO FINANCEIRA PESSOAL">
      <div style={{display:"flex",borderBottom:"1px solid #222218",margin:"0 -32px"}}>
        {[["login","Entrar"],["cadastro","Criar conta"]].map(([id,label])=>(
          <button key={id} type="button" onClick={()=>onGo(id)} style={{
            flex:1,padding:"13px",background:"none",border:"none",
            borderBottom:id==="login"?"2px solid #E8C547":"2px solid transparent",
            color:id==="login"?"#E8C547":"#666",fontSize:14,fontWeight:600,
            cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
          }}>{label}</button>
        ))}
      </div>
      <form onSubmit={handle} style={{display:"flex",flexDirection:"column",gap:14,marginTop:4}}>
        <Input label="USUÁRIO" placeholder="seu_usuario" value={form.usuario} onChange={f("usuario")} autoFocus />
        <Input label="SENHA" type="password" placeholder="••••••••" value={form.senha} onChange={f("senha")} />
        {erro && <Alert>{erro}</Alert>}
        <Btn type="submit" disabled={loading}>{loading?"Verificando...":"Entrar"}</Btn>
        <div style={{textAlign:"center",fontSize:13,color:"#555"}}>
          <button type="button" onClick={()=>onGo("forgot")} style={{background:"none",border:"none",color:"#E8C547",cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>
            Esqueci minha senha
          </button>
        </div>
      </form>
    </AuthCard>
  );
}

// 2. Cadastro
function CadastroView({ onGo }) {
  const [form, setForm] = useState({ nome:"", usuario:"", senha:"", confirmar:"" });
  const [erros, setErros] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.nome.trim()) e.nome = "Nome obrigatório.";
    if (form.usuario.length < 3) e.usuario = "Mínimo 3 caracteres.";
    if (/[^a-zA-Z0-9_]/.test(form.usuario)) e.usuario = "Apenas letras, números e _.";
    if (form.senha.length < 6) e.senha = "Mínimo 6 caracteres.";
    if (form.senha !== form.confirmar) e.confirmar = "As senhas não coincidem.";
    return e;
  };

  const handle = (e) => {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) { setErros(e2); return; }
    setLoading(true);
    const users = getUsers();
    if (users.find(u => u.usuario === form.usuario.toLowerCase())) {
      setErros({ usuario:"Usuário já existe. Escolha outro." }); setLoading(false); return;
    }
    // Save draft user, proceed to 2FA setup
    const novoUser = {
      id: generateId(), nome: form.nome.trim(),
      usuario: form.usuario.toLowerCase(), senha: form.senha,
      totp: null, recoveryCodes: [], criadoEm: new Date().toISOString(),
    };
    onGo("setup-2fa", { novoUser });
  };

  const f = (k) => (e) => { setForm(p=>({...p,[k]:e.target.value})); setErros(p=>({...p,[k]:""})); };

  return (
    <AuthCard subtitle="GESTÃO FINANCEIRA PESSOAL">
      <div style={{display:"flex",borderBottom:"1px solid #222218",margin:"0 -32px"}}>
        {[["login","Entrar"],["cadastro","Criar conta"]].map(([id,label])=>(
          <button key={id} type="button" onClick={()=>onGo(id)} style={{
            flex:1,padding:"13px",background:"none",border:"none",
            borderBottom:id==="cadastro"?"2px solid #E8C547":"2px solid transparent",
            color:id==="cadastro"?"#E8C547":"#666",fontSize:14,fontWeight:600,
            cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
          }}>{label}</button>
        ))}
      </div>
      <form onSubmit={handle} style={{display:"flex",flexDirection:"column",gap:14,marginTop:4}}>
        <Input label="NOME COMPLETO" placeholder="João Silva" value={form.nome} onChange={f("nome")} error={erros.nome} autoFocus />
        <Input label="USUÁRIO" placeholder="joao123" value={form.usuario} onChange={f("usuario")} error={erros.usuario} />
        <Input label="SENHA" type="password" placeholder="Mínimo 6 caracteres" value={form.senha} onChange={f("senha")} error={erros.senha} />
        <Input label="CONFIRMAR SENHA" type="password" placeholder="••••••••" value={form.confirmar} onChange={f("confirmar")} error={erros.confirmar} />
        <Btn type="submit" disabled={loading}>{loading?"Criando...":"Próximo →"}</Btn>
      </form>
    </AuthCard>
  );
}

// 3. Configurar 2FA
function Setup2FAView({ novoUser, onGo }) {
  const [secret] = useState(() => generateSecret());
  const [code, setCode] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const uri = totpUri(secret, novoUser.usuario);

  const skip = () => {
    const codes = generateRecoveryCodes();
    onGo("recovery-codes", { novoUser: { ...novoUser, totp: null, recoveryCodes: codes } });
  };

  const confirm = async (e) => {
    e.preventDefault();
    if (code.replace(/\s/g,"").length !== 6) { setErro("Digite o código de 6 dígitos."); return; }
    setLoading(true);
    const ok = await verifyTOTP(secret, code);
    setLoading(false);
    if (!ok) { setErro("Código inválido. Verifique o app e tente novamente."); return; }
    const codes = generateRecoveryCodes();
    onGo("recovery-codes", { novoUser: { ...novoUser, totp: { secret, enabled: true }, recoveryCodes: codes } });
  };

  return (
    <AuthCard title="Verificação em 2 etapas" subtitle="OPCIONAL — MAS RECOMENDADO">
      <Alert type="info">
        Escaneie o QR code com o <strong>Google Authenticator</strong>, <strong>Authy</strong> ou qualquer app TOTP.
      </Alert>
      <div style={{display:"flex",justifyContent:"center",padding:"8px 0"}}>
        <div style={{background:"#fff",padding:12,borderRadius:12}}>
          <QRCodeSVG value={uri} size={180} />
        </div>
      </div>
      <div>
        <div style={{fontSize:11,color:"#666",marginBottom:6,letterSpacing:1}}>CÓDIGO MANUAL (se não conseguir escanear)</div>
        <div style={{
          background:"#111110",border:"1px solid #333328",borderRadius:8,
          padding:"10px 14px",fontSize:13,color:"#E8C547",fontFamily:"monospace",
          letterSpacing:2,wordBreak:"break-all",
        }}>{secret}</div>
      </div>
      <form onSubmit={confirm} style={{display:"flex",flexDirection:"column",gap:14}}>
        <Input
          label="CÓDIGO DO APLICATIVO (6 dígitos)"
          placeholder="000000" value={code}
          onChange={e=>{ setCode(e.target.value); setErro(""); }}
          error={erro} inputMode="numeric" maxLength={6}
        />
        <Btn type="submit" disabled={loading}>{loading?"Verificando...":"Confirmar e ativar 2FA"}</Btn>
        <Btn variant="ghost" onClick={skip}>Pular por agora</Btn>
      </form>
    </AuthCard>
  );
}

// 4. Códigos de recuperação
function RecoveryCodesView({ novoUser, onLogin }) {
  const [confirmado, setConfirmado] = useState(false);

  const finish = () => {
    const users = getUsers();
    saveUsers([...users, novoUser]);
    saveSession(novoUser);
    onLogin(novoUser);
  };

  return (
    <AuthCard title="Guarde seus códigos de recuperação" subtitle="IMPORTANTE — LEIA COM ATENÇÃO">
      <Alert type="info">
        Use estes códigos caso perca acesso ao seu app autenticador ou esqueça a senha. <strong>Cada código só funciona uma vez.</strong> Guarde em local seguro.
      </Alert>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {novoUser.recoveryCodes.map((c,i) => (
          <div key={i} style={{
            background:"#111110",border:"1px solid #333328",borderRadius:8,
            padding:"8px 12px",fontFamily:"monospace",fontSize:13,
            color:"#E8C547",textAlign:"center",letterSpacing:1,
          }}>{c}</div>
        ))}
      </div>
      <label style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer",fontSize:13,color:"#888"}}>
        <input type="checkbox" checked={confirmado} onChange={e=>setConfirmado(e.target.checked)}
          style={{marginTop:2,accentColor:"#E8C547",width:16,height:16}} />
        Guardei meus códigos de recuperação em local seguro.
      </label>
      <Btn disabled={!confirmado} onClick={finish}>Criar conta e entrar</Btn>
    </AuthCard>
  );
}

// 5. Verificar 2FA (no login)
function Verify2FAView({ user, onLogin, onGo }) {
  const [code, setCode] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    const ok = await verifyTOTP(user.totp.secret, code);
    setLoading(false);
    if (!ok) { setErro("Código inválido ou expirado."); return; }
    onLogin(user);
  };

  return (
    <AuthCard title={`Olá, ${user.nome.split(" ")[0]}!`} subtitle="VERIFICAÇÃO EM 2 ETAPAS">
      <Alert type="info">Abra seu app autenticador e insira o código de 6 dígitos.</Alert>
      <form onSubmit={handle} style={{display:"flex",flexDirection:"column",gap:14}}>
        <Input
          label="CÓDIGO DO APLICATIVO"
          placeholder="000000" value={code}
          onChange={e=>{ setCode(e.target.value.replace(/\D/g,"")); setErro(""); }}
          error={erro} inputMode="numeric" maxLength={6} autoFocus
        />
        <Btn type="submit" disabled={loading || code.length !== 6}>{loading?"Verificando...":"Entrar"}</Btn>
        <div style={{textAlign:"center"}}>
          <button type="button" onClick={()=>onGo("use-recovery",{user})} style={{
            background:"none",border:"none",color:"#666",cursor:"pointer",fontSize:13,
            fontFamily:"'DM Sans',sans-serif",
          }}>Usar código de recuperação</button>
        </div>
        <div style={{textAlign:"center"}}>
          <button type="button" onClick={()=>onGo("login")} style={{
            background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:13,
            fontFamily:"'DM Sans',sans-serif",
          }}>← Voltar ao login</button>
        </div>
      </form>
    </AuthCard>
  );
}

// 6. Usar código de recuperação (bypass 2FA ou reset senha)
function UseRecoveryView({ user, mode, onLogin, onGo }) {
  const [code, setCode] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState("");
  const [step, setStep] = useState("code"); // "code" | "newpass"

  const checkCode = (e) => {
    e.preventDefault();
    const input = code.trim().toUpperCase();
    if (!user.recoveryCodes.includes(input)) { setErro("Código inválido ou já utilizado."); return; }
    if (mode === "login") {
      // consume code and login
      const users = getUsers();
      const updated = users.map(u => u.id === user.id
        ? { ...u, recoveryCodes: u.recoveryCodes.filter(c => c !== input) }
        : u
      );
      saveUsers(updated);
      onLogin({ ...user, recoveryCodes: user.recoveryCodes.filter(c => c !== input) });
    } else {
      setStep("newpass");
    }
  };

  const changePass = (e) => {
    e.preventDefault();
    if (novaSenha.length < 6) { setErro("Mínimo 6 caracteres."); return; }
    if (novaSenha !== confirmar) { setErro("As senhas não coincidem."); return; }
    const input = code.trim().toUpperCase();
    const users = getUsers();
    const updatedUser = {
      ...user, senha: novaSenha,
      recoveryCodes: user.recoveryCodes.filter(c => c !== input),
    };
    saveUsers(users.map(u => u.id === user.id ? updatedUser : u));
    onLogin(updatedUser);
  };

  if (step === "newpass") return (
    <AuthCard title="Criar nova senha" subtitle="RECUPERAÇÃO DE CONTA">
      <form onSubmit={changePass} style={{display:"flex",flexDirection:"column",gap:14}}>
        <Input label="NOVA SENHA" type="password" placeholder="Mínimo 6 caracteres" value={novaSenha}
          onChange={e=>{ setNovaSenha(e.target.value); setErro(""); }} autoFocus />
        <Input label="CONFIRMAR NOVA SENHA" type="password" placeholder="••••••••" value={confirmar}
          onChange={e=>{ setConfirmar(e.target.value); setErro(""); }} />
        {erro && <Alert>{erro}</Alert>}
        <Btn type="submit">Salvar nova senha</Btn>
      </form>
    </AuthCard>
  );

  return (
    <AuthCard title={mode==="login"?"Entrar com código de recuperação":"Recuperar conta"} subtitle="VERIFICAÇÃO DE IDENTIDADE">
      <Alert type="info">
        Cole um dos seus códigos de recuperação. Ele será marcado como usado.
      </Alert>
      <form onSubmit={checkCode} style={{display:"flex",flexDirection:"column",gap:14}}>
        <Input
          label="CÓDIGO DE RECUPERAÇÃO"
          placeholder="XXXX-XXXX-XXXX" value={code}
          onChange={e=>{ setCode(e.target.value); setErro(""); }}
          error={erro} autoFocus
        />
        <Btn type="submit">Continuar</Btn>
        <div style={{textAlign:"center"}}>
          <button type="button" onClick={()=>onGo("login")} style={{
            background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif",
          }}>← Voltar ao login</button>
        </div>
      </form>
    </AuthCard>
  );
}

// 7. Esqueci a senha (encontrar usuário)
function ForgotView({ onGo }) {
  const [usuario, setUsuario] = useState("");
  const [erro, setErro] = useState("");

  const handle = (e) => {
    e.preventDefault();
    const user = findUser(usuario);
    if (!user) { setErro("Usuário não encontrado."); return; }
    onGo("use-recovery", { user, mode: "reset" });
  };

  return (
    <AuthCard title="Recuperar senha" subtitle="ESQUECI MINHA SENHA">
      <Alert type="info">Informe seu usuário. Você precisará de um código de recuperação para redefinir a senha.</Alert>
      <form onSubmit={handle} style={{display:"flex",flexDirection:"column",gap:14}}>
        <Input label="SEU USUÁRIO" placeholder="seu_usuario" value={usuario}
          onChange={e=>{ setUsuario(e.target.value); setErro(""); }} autoFocus />
        {erro && <Alert>{erro}</Alert>}
        <Btn type="submit">Continuar</Btn>
        <div style={{textAlign:"center"}}>
          <button type="button" onClick={()=>onGo("login")} style={{
            background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif",
          }}>← Voltar ao login</button>
        </div>
      </form>
    </AuthCard>
  );
}

// ─── Auth Router ──────────────────────────────────────────────────────────────
function AuthRouter({ onLogin }) {
  const [view, setView] = useState("login");
  const [ctx, setCtx] = useState({});

  const go = (v, extra = {}) => { setView(v); setCtx(extra); };

  if (view === "login")         return <LoginView onLogin={onLogin} onGo={go} />;
  if (view === "cadastro")      return <CadastroView onGo={go} />;
  if (view === "setup-2fa")     return <Setup2FAView novoUser={ctx.novoUser} onGo={go} />;
  if (view === "recovery-codes") return <RecoveryCodesView novoUser={ctx.novoUser} onLogin={onLogin} />;
  if (view === "verify-2fa")    return <Verify2FAView user={ctx.user} onLogin={onLogin} onGo={go} />;
  if (view === "use-recovery")  return <UseRecoveryView user={ctx.user} mode={ctx.mode||"login"} onLogin={onLogin} onGo={go} />;
  if (view === "forgot")        return <ForgotView onGo={go} />;
  return null;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(10,10,8,0.7)",backdropFilter:"blur(8px)"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#1A1A16",border:"1px solid #333328",borderRadius:16,padding:"32px",width:"min(480px,92vw)",maxHeight:"85vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(0,0,0,0.6)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <h2 style={{margin:0,fontSize:20,color:"#E8C547",fontFamily:"'Playfair Display',serif"}}>{title}</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#888",fontSize:22,cursor:"pointer"}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, icon, sub }) {
  return (
    <div style={{background:"linear-gradient(135deg,#1A1A16,#222218)",border:"1px solid #333328",borderRadius:14,padding:"22px 24px",flex:"1 1 200px",minWidth:180,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-10,right:-10,fontSize:64,opacity:0.06,fontFamily:"serif"}}>{icon}</div>
      <div style={{fontSize:12,color:"#888",textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>{label}</div>
      <div style={{fontSize:28,fontWeight:700,color:accent,fontFamily:"'Playfair Display',serif",lineHeight:1.1}}>{formatCurrency(value)}</div>
      {sub && <div style={{fontSize:12,color:"#666",marginTop:6}}>{sub}</div>}
    </div>
  );
}

function TxRow({ tx, onEdit, onDelete, showBadge }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",background:"#111110",borderRadius:10,cursor:"pointer",transition:"background 0.15s"}}
      onClick={()=>onEdit(tx)}
      onMouseEnter={e=>e.currentTarget.style.background="#1E1E18"}
      onMouseLeave={e=>e.currentTarget.style.background="#111110"}
    >
      <div style={{fontSize:22,width:36,textAlign:"center"}}>{CATEGORY_ICONS[tx.categoria]||"📦"}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:600,fontSize:14,color:"#E8E4D9"}}>{tx.descricao||tx.categoria}</div>
        <div style={{fontSize:12,color:"#666",marginTop:2}}>{tx.categoria} · {formatDate(tx.data)}</div>
      </div>
      {showBadge && (
        <div style={{padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:600,background:tx.tipo==="receita"?"rgba(107,143,113,0.15)":"rgba(193,123,53,0.15)",color:tx.tipo==="receita"?"#6B8F71":"#C17B35"}}>
          {tx.tipo==="receita"?"RECEITA":"DESPESA"}
        </div>
      )}
      <div style={{fontWeight:700,fontSize:15,fontFamily:"'Playfair Display',serif",color:tx.tipo==="receita"?"#6B8F71":"#C17B35",minWidth:110,textAlign:"right"}}>
        {tx.tipo==="receita"?"+":"−"}{formatCurrency(tx.valor)}
      </div>
      <button onClick={e=>{e.stopPropagation();onDelete(tx.id);}} style={{background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:16,padding:"4px 8px"}}>✕</button>
    </div>
  );
}

function Dashboard({ usuario, onLogout }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear]  = useState(new Date().getFullYear());
  const [form, setForm] = useState({ tipo:"despesa",categoria:"Alimentação",valor:"",descricao:"",data:new Date().toISOString().split("T")[0] });

  const storageKey = `fin-tx-${usuario.id}`;

  useEffect(() => {
    const data = lsGet(storageKey);
    if (data) setTransactions(data);
    setLoading(false);
  }, [storageKey]);

  const persist = useCallback((txs) => {
    setTransactions(txs);
    lsSet(storageKey, txs);
  }, [storageKey]);

  const filtered = useMemo(() =>
    transactions.filter(t => {
      const d = new Date(t.data+"T00:00:00");
      return d.getMonth()===filterMonth && d.getFullYear()===filterYear;
    }), [transactions, filterMonth, filterYear]);

  const totalReceitas = useMemo(() => filtered.filter(t=>t.tipo==="receita").reduce((s,t)=>s+t.valor,0),[filtered]);
  const totalDespesas = useMemo(() => filtered.filter(t=>t.tipo==="despesa").reduce((s,t)=>s+t.valor,0),[filtered]);
  const saldo = totalReceitas - totalDespesas;

  const categoryData = useMemo(() => {
    const map = {};
    filtered.filter(t=>t.tipo==="despesa").forEach(t=>{ map[t.categoria]=(map[t.categoria]||0)+t.valor; });
    return Object.entries(map).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
  },[filtered]);

  const monthlyData = useMemo(() => {
    const data = MONTHS.map(m=>({name:m,receitas:0,despesas:0}));
    transactions.filter(t=>new Date(t.data+"T00:00:00").getFullYear()===filterYear).forEach(t=>{
      const mi = new Date(t.data+"T00:00:00").getMonth();
      if(t.tipo==="receita") data[mi].receitas+=t.valor; else data[mi].despesas+=t.valor;
    });
    return data;
  },[transactions,filterYear]);

  const openNew = () => {
    setEditingTx(null);
    setForm({tipo:"despesa",categoria:"Alimentação",valor:"",descricao:"",data:new Date().toISOString().split("T")[0]});
    setModalOpen(true);
  };
  const openEdit = (tx) => {
    setEditingTx(tx);
    setForm({tipo:tx.tipo,categoria:tx.categoria,valor:String(tx.valor),descricao:tx.descricao,data:tx.data});
    setModalOpen(true);
  };
  const handleSave = () => {
    if(!form.valor||isNaN(parseFloat(form.valor))) return;
    const entry = {...form,valor:parseFloat(form.valor),id:editingTx?editingTx.id:Date.now().toString(36)};
    persist(editingTx ? transactions.map(t=>t.id===editingTx.id?entry:t) : [...transactions,entry]);
    setModalOpen(false);
  };
  const handleDelete = (id) => persist(transactions.filter(t=>t.id!==id));

  const iStyle = {...BASE_INPUT};
  const btnS = (bg,color)=>({background:bg,color,border:"none",borderRadius:8,padding:"10px 20px",fontSize:14,cursor:"pointer",fontWeight:600,fontFamily:"'DM Sans',sans-serif",transition:"all 0.2s"});

  if(loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#0E0E0C",color:"#E8C547",fontFamily:"'Playfair Display',serif",fontSize:24}}>Carregando...</div>;

  return (
    <div style={{minHeight:"100vh",background:"#0E0E0C",color:"#E8E4D9",fontFamily:"'DM Sans',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>

      {/* Header */}
      <div style={{background:"linear-gradient(180deg,#161612,#0E0E0C)",borderBottom:"1px solid #222218",padding:"16px 32px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{margin:0,fontSize:26,fontFamily:"'Playfair Display',serif",background:"linear-gradient(135deg,#E8C547,#D4A03E)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Finanças</h1>
          <div style={{fontSize:11,color:"#555",marginTop:2,letterSpacing:1}}>GESTÃO FINANCEIRA PESSOAL</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <select value={filterMonth} onChange={e=>setFilterMonth(Number(e.target.value))} style={{...iStyle,width:"auto",cursor:"pointer"}}>
            {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
          </select>
          <select value={filterYear} onChange={e=>setFilterYear(Number(e.target.value))} style={{...iStyle,width:"auto",cursor:"pointer"}}>
            {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          {["dashboard","transações"].map(tab=>(
            <button key={tab} onClick={()=>setActiveTab(tab)} style={{...btnS(activeTab===tab?"#E8C547":"transparent",activeTab===tab?"#0E0E0C":"#888"),border:activeTab===tab?"none":"1px solid #333328",textTransform:"capitalize"}}>{tab}</button>
          ))}
          <button onClick={openNew} style={btnS("#E8C547","#0E0E0C")}>+ Novo Lançamento</button>
          <div style={{display:"flex",alignItems:"center",gap:10,paddingLeft:12,borderLeft:"1px solid #222218"}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:13,fontWeight:600,color:"#E8E4D9"}}>{usuario.nome}</div>
              <div style={{fontSize:11,color:"#555",display:"flex",alignItems:"center",gap:4}}>
                @{usuario.usuario}
                {usuario.totp?.enabled && <span title="2FA ativo" style={{color:"#E8C547",fontSize:10}}>🔐</span>}
              </div>
            </div>
            <button onClick={onLogout} style={{...btnS("#1A1A16","#888"),border:"1px solid #333328",fontSize:13,padding:"8px 12px"}}>Sair</button>
          </div>
        </div>
      </div>

      <div style={{padding:"24px 32px",maxWidth:1200,margin:"0 auto"}}>
        {activeTab==="dashboard" ? (
          <>
            <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:28}}>
              <StatCard label="Receitas" value={totalReceitas} accent="#6B8F71" icon="↑" sub={`${filtered.filter(t=>t.tipo==="receita").length} lançamentos`}/>
              <StatCard label="Despesas" value={totalDespesas} accent="#C17B35" icon="↓" sub={`${filtered.filter(t=>t.tipo==="despesa").length} lançamentos`}/>
              <StatCard label="Saldo" value={saldo} accent={saldo>=0?"#E8C547":"#D44"} icon="◆" sub={saldo>=0?"Positivo":"Negativo"}/>
            </div>
            <div style={{display:"flex",gap:20,flexWrap:"wrap",marginBottom:28}}>
              <div style={{flex:"2 1 400px",background:"#1A1A16",border:"1px solid #333328",borderRadius:14,padding:24,minHeight:300}}>
                <h3 style={{margin:"0 0 20px",fontSize:14,color:"#888",letterSpacing:2,textTransform:"uppercase"}}>Evolução Anual — {filterYear}</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6B8F71" stopOpacity={0.3}/><stop offset="95%" stopColor="#6B8F71" stopOpacity={0}/></linearGradient>
                      <linearGradient id="gDesp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#C17B35" stopOpacity={0.3}/><stop offset="95%" stopColor="#C17B35" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222218"/>
                    <XAxis dataKey="name" tick={{fill:"#666",fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:"#666",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                    <Tooltip contentStyle={{background:"#1A1A16",border:"1px solid #333328",borderRadius:8,color:"#E8E4D9",fontSize:13}} formatter={v=>formatCurrency(v)}/>
                    <Area type="monotone" dataKey="receitas" stroke="#6B8F71" fill="url(#gRec)" strokeWidth={2} name="Receitas"/>
                    <Area type="monotone" dataKey="despesas" stroke="#C17B35" fill="url(#gDesp)" strokeWidth={2} name="Despesas"/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{flex:"1 1 280px",background:"#1A1A16",border:"1px solid #333328",borderRadius:14,padding:24,minHeight:300}}>
                <h3 style={{margin:"0 0 20px",fontSize:14,color:"#888",letterSpacing:2,textTransform:"uppercase"}}>Despesas por Categoria</h3>
                {categoryData.length>0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                          {categoryData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                        </Pie>
                        <Tooltip contentStyle={{background:"#1A1A16",border:"1px solid #333328",borderRadius:8,color:"#E8E4D9",fontSize:13}} formatter={v=>formatCurrency(v)}/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{display:"flex",flexWrap:"wrap",gap:"6px 16px",marginTop:8}}>
                      {categoryData.slice(0,5).map((c,i)=>(
                        <div key={c.name} style={{display:"flex",alignItems:"center",gap:6,fontSize:12}}>
                          <div style={{width:10,height:10,borderRadius:3,background:COLORS[i%COLORS.length]}}/>
                          <span style={{color:"#AAA"}}>{c.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : <div style={{color:"#555",fontSize:14,textAlign:"center",marginTop:60}}>Sem despesas neste período</div>}
              </div>
            </div>
            <div style={{background:"#1A1A16",border:"1px solid #333328",borderRadius:14,padding:24}}>
              <h3 style={{margin:"0 0 16px",fontSize:14,color:"#888",letterSpacing:2,textTransform:"uppercase"}}>Últimos Lançamentos</h3>
              {filtered.length===0 ? (
                <div style={{color:"#555",textAlign:"center",padding:40,fontSize:14}}>Nenhum lançamento neste mês. Clique em "+ Novo Lançamento" para começar.</div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {[...filtered].sort((a,b)=>b.data.localeCompare(a.data)).slice(0,8).map(tx=>(
                    <TxRow key={tx.id} tx={tx} onEdit={openEdit} onDelete={handleDelete}/>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{background:"#1A1A16",border:"1px solid #333328",borderRadius:14,padding:24}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
              <h3 style={{margin:0,fontSize:14,color:"#888",letterSpacing:2,textTransform:"uppercase"}}>Todos os Lançamentos — {MONTHS[filterMonth]} {filterYear}</h3>
              <div style={{fontSize:13,color:"#666"}}>{filtered.length} itens</div>
            </div>
            {filtered.length===0 ? <div style={{color:"#555",textAlign:"center",padding:60,fontSize:14}}>Nenhum lançamento encontrado neste período.</div> : (
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {[...filtered].sort((a,b)=>b.data.localeCompare(a.data)).map(tx=>(
                  <TxRow key={tx.id} tx={tx} onEdit={openEdit} onDelete={handleDelete} showBadge/>
                ))}
              </div>
            )}
            <div style={{display:"flex",justifyContent:"flex-end",gap:24,marginTop:20,padding:"16px 16px 0",borderTop:"1px solid #222218",flexWrap:"wrap"}}>
              <div style={{fontSize:13}}><span style={{color:"#888"}}>Receitas: </span><span style={{color:"#6B8F71",fontWeight:700}}>{formatCurrency(totalReceitas)}</span></div>
              <div style={{fontSize:13}}><span style={{color:"#888"}}>Despesas: </span><span style={{color:"#C17B35",fontWeight:700}}>{formatCurrency(totalDespesas)}</span></div>
              <div style={{fontSize:13}}><span style={{color:"#888"}}>Saldo: </span><span style={{color:saldo>=0?"#E8C547":"#D44",fontWeight:700}}>{formatCurrency(saldo)}</span></div>
            </div>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={()=>setModalOpen(false)} title={editingTx?"Editar Lançamento":"Novo Lançamento"}>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"flex",gap:8}}>
            {["despesa","receita"].map(t=>(
              <button key={t} onClick={()=>setForm(f=>({...f,tipo:t,categoria:CATEGORIES[t][0]}))} style={{...btnS(form.tipo===t?(t==="receita"?"#6B8F71":"#C17B35"):"transparent",form.tipo===t?"#fff":"#888"),flex:1,border:form.tipo===t?"none":"1px solid #333328",textTransform:"capitalize"}}>{t}</button>
            ))}
          </div>
          <div>
            <label style={{fontSize:12,color:"#888",marginBottom:6,display:"block"}}>Categoria</label>
            <select value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))} style={{...iStyle,cursor:"pointer"}}>
              {CATEGORIES[form.tipo].map(c=><option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:12,color:"#888",marginBottom:6,display:"block"}}>Valor (R$)</label>
            <input type="number" step="0.01" placeholder="0,00" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))} style={iStyle}/>
          </div>
          <div>
            <label style={{fontSize:12,color:"#888",marginBottom:6,display:"block"}}>Descrição (opcional)</label>
            <input type="text" placeholder="Ex: Conta de luz" value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} style={iStyle}/>
          </div>
          <div>
            <label style={{fontSize:12,color:"#888",marginBottom:6,display:"block"}}>Data</label>
            <input type="date" value={form.data} onChange={e=>setForm(f=>({...f,data:e.target.value}))} style={iStyle}/>
          </div>
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <button onClick={()=>setModalOpen(false)} style={{...btnS("transparent","#888"),border:"1px solid #333328",flex:1}}>Cancelar</button>
            <button onClick={handleSave} style={{...btnS("#E8C547","#0E0E0C"),flex:1}}>{editingTx?"Salvar":"Adicionar"}</button>
          </div>
          {editingTx && (
            <button onClick={()=>{handleDelete(editingTx.id);setModalOpen(false);}} style={{...btnS("transparent","#e07070"),border:"1px solid #441111",width:"100%",marginTop:4}}>Excluir Lançamento</button>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [usuario, setUsuario] = useState(() => getSession());

  const handleLogin = (user) => { saveSession(user); setUsuario(user); };
  const handleLogout = () => { clearSession(); setUsuario(null); };

  if (!usuario) return <AuthRouter onLogin={handleLogin} />;
  return <Dashboard usuario={usuario} onLogout={handleLogout} />;
}
