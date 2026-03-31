import { useState, useEffect, useCallback, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, AreaChart, Area, CartesianGrid,
} from "recharts";
import {
  hashPassword, getSession, saveSession, clearSession,
  findUser, createUser, updateUser,
  loadTransactions, upsertTransaction, deleteTransaction,
  loadAllUsers, loadAllTransactionCounts, deleteUserById, setAdminStatus, resetUserPassword,
  generateSecret, verifyTOTP, totpUri,
  generateRecoveryCodes, generateId,
} from "./auth.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = {
  receita: ["Salário", "Freelance", "Investimentos", "Vendas", "Outros"],
  despesa: ["Moradia", "Alimentação", "Transporte", "Saúde", "Educação", "Lazer", "Assinaturas", "Outros"],
};
const CATEGORY_ICONS = {
  "Salário":"💰","Freelance":"💻","Investimentos":"📈","Vendas":"🛒",
  "Moradia":"🏠","Alimentação":"🍽️","Transporte":"🚗","Saúde":"🏥",
  "Educação":"📚","Lazer":"🎮","Assinaturas":"📱","Outros":"📦",
};
const COLORS = ["#E8C547","#D4A03E","#C17B35","#AE562C","#6B8F71","#4A7C59","#2D6A4F","#1B4332","#8B6914","#A67C00","#BF9B30","#D4B44A"];
const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function formatCurrency(v) {
  return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
}
function formatDate(s) {
  return new Date(s+"T00:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short"});
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
const BASE_INPUT = {
  background:"#111110",border:"1px solid #333328",borderRadius:8,
  padding:"11px 14px",color:"#E8E4D9",fontSize:14,width:"100%",
  outline:"none",fontFamily:"'DM Sans',sans-serif",boxSizing:"border-box",
};

function Input({ label, error, style: extra, ...props }) {
  return (
    <div>
      {label && <label style={{fontSize:11,color:"#888",marginBottom:6,display:"block",letterSpacing:1}}>{label}</label>}
      <input {...props} style={{...BASE_INPUT,border:`1px solid ${error?"#c44":"#333328"}`,...extra}}/>
      {error && <div style={{color:"#e07070",fontSize:12,marginTop:5}}>{error}</div>}
    </div>
  );
}

function Btn({ children, variant="gold", disabled, onClick, type="button", full=true }) {
  const base = {border:"none",borderRadius:8,padding:"12px 20px",fontSize:14,cursor:disabled?"not-allowed":"pointer",fontWeight:700,fontFamily:"'DM Sans',sans-serif",opacity:disabled?0.6:1,transition:"opacity 0.2s",width:full?"100%":"auto"};
  const vs = {
    gold:{...base,background:"linear-gradient(135deg,#E8C547,#D4A03E)",color:"#0E0E0C"},
    ghost:{...base,background:"transparent",color:"#888",border:"1px solid #333328"},
    danger:{...base,background:"transparent",color:"#e07070",border:"1px solid #441111"},
  };
  return <button type={type} onClick={onClick} disabled={disabled} style={vs[variant]||vs.gold}>{children}</button>;
}

function Alert({ children, type="error" }) {
  const s = {error:["rgba(200,60,60,0.1)","rgba(200,60,60,0.3)","#e07070"],info:["rgba(232,197,71,0.08)","rgba(232,197,71,0.2)","#E8C547"]};
  const [bg,bdr,color] = s[type]||s.error;
  return <div style={{background:bg,border:`1px solid ${bdr}`,borderRadius:8,padding:"10px 14px",color,fontSize:13}}>{children}</div>;
}

function AuthCard({ children, subtitle, title }) {
  return (
    <div style={{minHeight:"100vh",background:"#0E0E0C",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",padding:16}}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <div style={{background:"#1A1A16",border:"1px solid #333328",borderRadius:20,width:"min(420px,100%)",boxShadow:"0 24px 80px rgba(0,0,0,0.6)",overflow:"hidden"}}>
        <div style={{textAlign:"center",padding:"32px 32px 20px"}}>
          <div style={{fontSize:34,marginBottom:8}}>💎</div>
          <h1 style={{margin:0,fontSize:22,fontFamily:"'Playfair Display',serif",background:"linear-gradient(135deg,#E8C547,#D4A03E)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Finanças</h1>
          {subtitle && <div style={{fontSize:11,color:"#555",marginTop:4,letterSpacing:1.5}}>{subtitle}</div>}
          {title && <div style={{fontSize:14,color:"#E8E4D9",marginTop:10,fontWeight:600}}>{title}</div>}
        </div>
        <div style={{padding:"0 32px 32px",display:"flex",flexDirection:"column",gap:14}}>{children}</div>
      </div>
    </div>
  );
}

function Tabs({ active, onSelect }) {
  return (
    <div style={{display:"flex",borderBottom:"1px solid #222218",margin:"0 -32px",marginBottom:4}}>
      {[["login","Entrar"],["cadastro","Criar conta"]].map(([id,label])=>(
        <button key={id} type="button" onClick={()=>onSelect(id)} style={{flex:1,padding:"13px",background:"none",border:"none",borderBottom:active===id?"2px solid #E8C547":"2px solid transparent",color:active===id?"#E8C547":"#666",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Auth Views ───────────────────────────────────────────────────────────────
function LoginView({ onLogin, onGo }) {
  const [form, setForm] = useState({ usuario:"", senha:"" });
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p=>({...p,[k]:e.target.value}));

  const handle = async (e) => {
    e.preventDefault();
    if (!form.usuario||!form.senha) { setErro("Preencha todos os campos."); return; }
    setLoading(true); setErro("");
    try {
      const user = await findUser(form.usuario);
      if (!user) { setErro("Usuário não encontrado."); setLoading(false); return; }
      const hash = await hashPassword(form.senha);
      if (user.senha_hash !== hash) { setErro("Senha incorreta."); setLoading(false); return; }
      setLoading(false);
      if (user.totp_enabled) onGo("verify-2fa", { user });
      else onLogin(user);
    } catch { setErro("Erro ao conectar. Verifique sua internet."); setLoading(false); }
  };

  return (
    <AuthCard subtitle="GESTÃO FINANCEIRA PESSOAL">
      <Tabs active="login" onSelect={onGo}/>
      <form onSubmit={handle} style={{display:"flex",flexDirection:"column",gap:13}}>
        <Input label="USUÁRIO" placeholder="seu_usuario" value={form.usuario} onChange={f("usuario")} autoFocus/>
        <Input label="SENHA" type="password" placeholder="••••••••" value={form.senha} onChange={f("senha")}/>
        {erro && <Alert>{erro}</Alert>}
        <Btn type="submit" disabled={loading}>{loading?"Verificando...":"Entrar"}</Btn>
        <div style={{textAlign:"center"}}>
          <button type="button" onClick={()=>onGo("forgot")} style={{background:"none",border:"none",color:"#E8C547",cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>
            Esqueci minha senha
          </button>
        </div>
      </form>
    </AuthCard>
  );
}

function CadastroView({ onGo }) {
  const [form, setForm] = useState({ nome:"",usuario:"",senha:"",confirmar:"" });
  const [erros, setErros] = useState({});
  const [loading, setLoading] = useState(false);
  const f = k => e => { setForm(p=>({...p,[k]:e.target.value})); setErros(p=>({...p,[k]:""})); };

  const handle = async (e) => {
    e.preventDefault();
    const err = {};
    if (!form.nome.trim()) err.nome="Nome obrigatório.";
    if (form.usuario.length<3) err.usuario="Mínimo 3 caracteres.";
    if (/[^a-zA-Z0-9_]/.test(form.usuario)) err.usuario="Apenas letras, números e _.";
    if (form.senha.length<6) err.senha="Mínimo 6 caracteres.";
    if (form.senha!==form.confirmar) err.confirmar="As senhas não coincidem.";
    if (Object.keys(err).length) { setErros(err); return; }
    setLoading(true);
    try {
      const existing = await findUser(form.usuario);
      if (existing) { setErros({usuario:"Usuário já existe."}); setLoading(false); return; }
      const senha_hash = await hashPassword(form.senha);
      const draft = { nome:form.nome.trim(), usuario:form.usuario.toLowerCase(), senha_hash, totp_enabled:false, totp_secret:null, recovery_codes:[] };
      onGo("setup-2fa", { draft });
    } catch { setErros({nome:"Erro ao verificar. Tente novamente."}); setLoading(false); }
  };

  return (
    <AuthCard subtitle="GESTÃO FINANCEIRA PESSOAL">
      <Tabs active="cadastro" onSelect={onGo}/>
      <form onSubmit={handle} style={{display:"flex",flexDirection:"column",gap:13}}>
        <Input label="NOME COMPLETO" placeholder="João Silva" value={form.nome} onChange={f("nome")} error={erros.nome} autoFocus/>
        <Input label="USUÁRIO" placeholder="joao123" value={form.usuario} onChange={f("usuario")} error={erros.usuario}/>
        <Input label="SENHA" type="password" placeholder="Mínimo 6 caracteres" value={form.senha} onChange={f("senha")} error={erros.senha}/>
        <Input label="CONFIRMAR SENHA" type="password" placeholder="••••••••" value={form.confirmar} onChange={f("confirmar")} error={erros.confirmar}/>
        <Btn type="submit" disabled={loading}>{loading?"Verificando...":"Próximo →"}</Btn>
      </form>
    </AuthCard>
  );
}

function Setup2FAView({ draft, onGo }) {
  const [secret] = useState(generateSecret);
  const [code, setCode] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const skip = () => onGo("recovery-codes", { draft, totpSecret: null });

  const confirm = async (e) => {
    e.preventDefault();
    if (code.replace(/\D/g,"").length!==6) { setErro("Digite o código de 6 dígitos."); return; }
    setLoading(true);
    const ok = await verifyTOTP(secret, code);
    if (!ok) { setErro("Código inválido. Tente novamente."); setLoading(false); return; }
    onGo("recovery-codes", { draft, totpSecret: secret });
  };

  return (
    <AuthCard title="Verificação em 2 etapas" subtitle="OPCIONAL — RECOMENDADO">
      <Alert type="info">Escaneie com <strong>Google Authenticator</strong> ou <strong>Authy</strong>.</Alert>
      <div style={{display:"flex",justifyContent:"center",padding:"4px 0"}}>
        <div style={{background:"#fff",padding:10,borderRadius:10}}>
          <QRCodeSVG value={totpUri(secret, draft.usuario)} size={170}/>
        </div>
      </div>
      <div>
        <div style={{fontSize:11,color:"#666",marginBottom:5,letterSpacing:1}}>CÓDIGO MANUAL</div>
        <div style={{background:"#111110",border:"1px solid #333328",borderRadius:8,padding:"9px 13px",fontSize:12,color:"#E8C547",fontFamily:"monospace",letterSpacing:2,wordBreak:"break-all"}}>{secret}</div>
      </div>
      <form onSubmit={confirm} style={{display:"flex",flexDirection:"column",gap:13}}>
        <Input label="CÓDIGO DO APP (6 dígitos)" placeholder="000000" value={code}
          onChange={e=>{setCode(e.target.value.replace(/\D/g,""));setErro("");}}
          error={erro} inputMode="numeric" maxLength={6}/>
        <Btn type="submit" disabled={loading}>{loading?"Verificando...":"Ativar 2FA"}</Btn>
        <Btn variant="ghost" onClick={skip}>Pular por agora</Btn>
      </form>
    </AuthCard>
  );
}

function RecoveryCodesView({ draft, totpSecret, onLogin }) {
  const [codes] = useState(generateRecoveryCodes);
  const [confirmado, setConfirmado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const finish = async () => {
    setLoading(true);
    try {
      const user = await createUser({
        ...draft,
        totp_secret: totpSecret,
        totp_enabled: !!totpSecret,
        recovery_codes: codes,
      });
      onLogin(user);
    } catch (err) {
      setErro("Erro ao criar conta. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Guarde seus códigos de recuperação" subtitle="IMPORTANTE">
      <Alert type="info">Use estes códigos caso perca acesso ao autenticador ou esqueça a senha. <strong>Cada código funciona uma vez.</strong></Alert>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
        {codes.map((c,i)=>(
          <div key={i} style={{background:"#111110",border:"1px solid #333328",borderRadius:7,padding:"7px 10px",fontFamily:"monospace",fontSize:12,color:"#E8C547",textAlign:"center",letterSpacing:1}}>{c}</div>
        ))}
      </div>
      {erro && <Alert>{erro}</Alert>}
      <label style={{display:"flex",alignItems:"flex-start",gap:9,cursor:"pointer",fontSize:13,color:"#888"}}>
        <input type="checkbox" checked={confirmado} onChange={e=>setConfirmado(e.target.checked)} style={{marginTop:2,accentColor:"#E8C547",width:15,height:15}}/>
        Guardei os códigos em local seguro.
      </label>
      <Btn disabled={!confirmado||loading} onClick={finish}>{loading?"Criando conta...":"Criar conta e entrar"}</Btn>
    </AuthCard>
  );
}

function Verify2FAView({ user, onLogin, onGo }) {
  const [code, setCode] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    const ok = await verifyTOTP(user.totp_secret, code);
    setLoading(false);
    if (!ok) { setErro("Código inválido ou expirado."); return; }
    onLogin(user);
  };

  return (
    <AuthCard title={`Olá, ${user.nome.split(" ")[0]}!`} subtitle="VERIFICAÇÃO EM 2 ETAPAS">
      <Alert type="info">Abra seu app autenticador e insira o código de 6 dígitos.</Alert>
      <form onSubmit={handle} style={{display:"flex",flexDirection:"column",gap:13}}>
        <Input label="CÓDIGO DO APP" placeholder="000000" value={code}
          onChange={e=>{setCode(e.target.value.replace(/\D/g,""));setErro("");}}
          error={erro} inputMode="numeric" maxLength={6} autoFocus/>
        <Btn type="submit" disabled={loading||code.length!==6}>{loading?"Verificando...":"Entrar"}</Btn>
        <div style={{textAlign:"center",display:"flex",flexDirection:"column",gap:6}}>
          <button type="button" onClick={()=>onGo("use-recovery",{user,mode:"login"})} style={{background:"none",border:"none",color:"#666",cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>Usar código de recuperação</button>
          <button type="button" onClick={()=>onGo("login")} style={{background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>← Voltar</button>
        </div>
      </form>
    </AuthCard>
  );
}

function ForgotView({ onGo }) {
  const [usuario, setUsuario] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await findUser(usuario);
      if (!user) { setErro("Usuário não encontrado."); setLoading(false); return; }
      onGo("use-recovery", { user, mode:"reset" });
    } catch { setErro("Erro de conexão."); setLoading(false); }
  };

  return (
    <AuthCard title="Recuperar senha" subtitle="ESQUECI MINHA SENHA">
      <Alert type="info">Informe seu usuário. Você precisará de um código de recuperação.</Alert>
      <form onSubmit={handle} style={{display:"flex",flexDirection:"column",gap:13}}>
        <Input label="SEU USUÁRIO" placeholder="seu_usuario" value={usuario}
          onChange={e=>{setUsuario(e.target.value);setErro("");}} autoFocus/>
        {erro && <Alert>{erro}</Alert>}
        <Btn type="submit" disabled={loading}>{loading?"Buscando...":"Continuar"}</Btn>
        <div style={{textAlign:"center"}}>
          <button type="button" onClick={()=>onGo("login")} style={{background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>← Voltar ao login</button>
        </div>
      </form>
    </AuthCard>
  );
}

function UseRecoveryView({ user, mode, onLogin, onGo }) {
  const [code, setCode] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState("");
  const [step, setStep] = useState("code");
  const [loading, setLoading] = useState(false);

  const checkCode = async (e) => {
    e.preventDefault();
    const input = code.trim().toUpperCase();
    const codes = Array.isArray(user.recovery_codes) ? user.recovery_codes : [];
    if (!codes.includes(input)) { setErro("Código inválido ou já utilizado."); return; }
    if (mode==="login") {
      setLoading(true);
      try {
        const updated = await updateUser(user.id, { recovery_codes: codes.filter(c=>c!==input) });
        onLogin(updated);
      } catch { setErro("Erro ao conectar."); setLoading(false); }
    } else { setStep("newpass"); }
  };

  const changePass = async (e) => {
    e.preventDefault();
    if (novaSenha.length<6) { setErro("Mínimo 6 caracteres."); return; }
    if (novaSenha!==confirmar) { setErro("As senhas não coincidem."); return; }
    setLoading(true);
    try {
      const input = code.trim().toUpperCase();
      const codes = Array.isArray(user.recovery_codes) ? user.recovery_codes : [];
      const hash = await hashPassword(novaSenha);
      const updated = await updateUser(user.id, {
        senha_hash: hash,
        recovery_codes: codes.filter(c=>c!==input),
      });
      onLogin(updated);
    } catch { setErro("Erro ao atualizar. Tente novamente."); setLoading(false); }
  };

  if (step==="newpass") return (
    <AuthCard title="Criar nova senha" subtitle="RECUPERAÇÃO DE CONTA">
      <form onSubmit={changePass} style={{display:"flex",flexDirection:"column",gap:13}}>
        <Input label="NOVA SENHA" type="password" placeholder="Mínimo 6 caracteres" value={novaSenha} onChange={e=>{setNovaSenha(e.target.value);setErro("");}} autoFocus/>
        <Input label="CONFIRMAR NOVA SENHA" type="password" placeholder="••••••••" value={confirmar} onChange={e=>{setConfirmar(e.target.value);setErro("");}}/>
        {erro && <Alert>{erro}</Alert>}
        <Btn type="submit" disabled={loading}>{loading?"Salvando...":"Salvar nova senha"}</Btn>
      </form>
    </AuthCard>
  );

  return (
    <AuthCard title={mode==="login"?"Entrar com código":"Recuperar conta"} subtitle="CÓDIGO DE RECUPERAÇÃO">
      <Alert type="info">Cole um dos seus códigos de recuperação. Ele será marcado como usado.</Alert>
      <form onSubmit={checkCode} style={{display:"flex",flexDirection:"column",gap:13}}>
        <Input label="CÓDIGO DE RECUPERAÇÃO" placeholder="XXXX-XXXX-XXXX" value={code}
          onChange={e=>{setCode(e.target.value);setErro("");}} error={erro} autoFocus/>
        <Btn type="submit" disabled={loading}>{loading?"Verificando...":"Continuar"}</Btn>
        <div style={{textAlign:"center"}}>
          <button type="button" onClick={()=>onGo("login")} style={{background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>← Voltar ao login</button>
        </div>
      </form>
    </AuthCard>
  );
}

// ─── Auth Router ──────────────────────────────────────────────────────────────
function AuthRouter({ onLogin }) {
  const [view, setView] = useState("login");
  const [ctx, setCtx] = useState({});
  const go = (v, extra={}) => { setView(v); setCtx(extra); };

  if (view==="login")          return <LoginView onLogin={onLogin} onGo={go}/>;
  if (view==="cadastro")       return <CadastroView onGo={go}/>;
  if (view==="setup-2fa")      return <Setup2FAView draft={ctx.draft} onGo={go}/>;
  if (view==="recovery-codes") return <RecoveryCodesView draft={ctx.draft} totpSecret={ctx.totpSecret} onLogin={onLogin}/>;
  if (view==="verify-2fa")     return <Verify2FAView user={ctx.user} onLogin={onLogin} onGo={go}/>;
  if (view==="forgot")         return <ForgotView onGo={go}/>;
  if (view==="use-recovery")   return <UseRecoveryView user={ctx.user} mode={ctx.mode||"login"} onLogin={onLogin} onGo={go}/>;
  return null;
}

// ─── Dashboard Components ─────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(10,10,8,0.75)",backdropFilter:"blur(8px)"}} onClick={onClose}>
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

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ usuario, onLogout }) {
  const [showAdmin, setShowAdmin] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [form, setForm] = useState({tipo:"despesa",categoria:"Alimentação",valor:"",descricao:"",data:new Date().toISOString().split("T")[0]});

  useEffect(() => {
    loadTransactions(usuario.id)
      .then(setTransactions)
      .catch(()=>{})
      .finally(()=>setLoading(false));
  }, [usuario.id]);

  const filtered = useMemo(()=>
    transactions.filter(t=>{
      const d = new Date(t.data+"T00:00:00");
      return d.getMonth()===filterMonth && d.getFullYear()===filterYear;
    }), [transactions,filterMonth,filterYear]);

  const totalReceitas = useMemo(()=>filtered.filter(t=>t.tipo==="receita").reduce((s,t)=>s+Number(t.valor),0),[filtered]);
  const totalDespesas = useMemo(()=>filtered.filter(t=>t.tipo==="despesa").reduce((s,t)=>s+Number(t.valor),0),[filtered]);
  const saldo = totalReceitas - totalDespesas;

  const categoryData = useMemo(()=>{
    const map={};
    filtered.filter(t=>t.tipo==="despesa").forEach(t=>{map[t.categoria]=(map[t.categoria]||0)+Number(t.valor);});
    return Object.entries(map).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
  },[filtered]);

  const monthlyData = useMemo(()=>{
    const data=MONTHS.map(m=>({name:m,receitas:0,despesas:0}));
    transactions.filter(t=>new Date(t.data+"T00:00:00").getFullYear()===filterYear).forEach(t=>{
      const mi=new Date(t.data+"T00:00:00").getMonth();
      if(t.tipo==="receita") data[mi].receitas+=Number(t.valor);
      else data[mi].despesas+=Number(t.valor);
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
    setForm({tipo:tx.tipo,categoria:tx.categoria,valor:String(tx.valor),descricao:tx.descricao||"",data:tx.data});
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.valor||isNaN(parseFloat(form.valor))) return;
    setSaving(true);
    const entry = {
      id: editingTx ? editingTx.id : generateId(),
      user_id: usuario.id,
      tipo: form.tipo, categoria: form.categoria,
      valor: parseFloat(form.valor),
      descricao: form.descricao, data: form.data,
    };
    try {
      await upsertTransaction(entry);
      setTransactions(prev =>
        editingTx ? prev.map(t=>t.id===editingTx.id?entry:t) : [...prev, entry]
      );
      setModalOpen(false);
    } catch { alert("Erro ao salvar. Verifique sua conexão."); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await deleteTransaction(id);
      setTransactions(prev=>prev.filter(t=>t.id!==id));
      if (modalOpen) setModalOpen(false);
    } catch { alert("Erro ao excluir."); }
  };

  const iStyle = {...BASE_INPUT};
  const btnS = (bg,color)=>({background:bg,color,border:"none",borderRadius:8,padding:"10px 20px",fontSize:14,cursor:"pointer",fontWeight:600,fontFamily:"'DM Sans',sans-serif",transition:"all 0.2s"});

  if (showAdmin && usuario.is_admin) {
    return <AdminPanel adminUser={usuario} onBack={() => setShowAdmin(false)} />;
  }

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#0E0E0C",color:"#E8C547",fontFamily:"'Playfair Display',serif",fontSize:22}}>
      Carregando...
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#0E0E0C",color:"#E8E4D9",fontFamily:"'DM Sans',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>

      {/* Header */}
      <div style={{background:"linear-gradient(180deg,#161612,#0E0E0C)",borderBottom:"1px solid #222218",padding:"16px 32px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{margin:0,fontSize:24,fontFamily:"'Playfair Display',serif",background:"linear-gradient(135deg,#E8C547,#D4A03E)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Finanças</h1>
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
          {usuario.is_admin && (
            <button onClick={() => setShowAdmin(true)} style={{...btnS("#222218","#E8C547"),border:"1px solid #333328"}}>⚙ Admin</button>
          )}
          <div style={{display:"flex",alignItems:"center",gap:10,paddingLeft:12,borderLeft:"1px solid #222218"}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:13,fontWeight:600,color:"#E8E4D9"}}>{usuario.nome}</div>
              <div style={{fontSize:11,color:"#555",display:"flex",alignItems:"center",gap:4,justifyContent:"flex-end"}}>
                @{usuario.usuario}
                {usuario.totp_enabled && <span title="2FA ativo" style={{color:"#E8C547"}}>🔐</span>}
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
              {filtered.length===0
                ? <div style={{color:"#555",textAlign:"center",padding:40,fontSize:14}}>Nenhum lançamento neste mês. Clique em "+ Novo Lançamento" para começar.</div>
                : <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {[...filtered].sort((a,b)=>b.data.localeCompare(a.data)).slice(0,8).map(tx=><TxRow key={tx.id} tx={tx} onEdit={openEdit} onDelete={handleDelete}/>)}
                  </div>
              }
            </div>
          </>
        ) : (
          <div style={{background:"#1A1A16",border:"1px solid #333328",borderRadius:14,padding:24}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
              <h3 style={{margin:0,fontSize:14,color:"#888",letterSpacing:2,textTransform:"uppercase"}}>Todos os Lançamentos — {MONTHS[filterMonth]} {filterYear}</h3>
              <div style={{fontSize:13,color:"#666"}}>{filtered.length} itens</div>
            </div>
            {filtered.length===0
              ? <div style={{color:"#555",textAlign:"center",padding:60,fontSize:14}}>Nenhum lançamento encontrado neste período.</div>
              : <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  {[...filtered].sort((a,b)=>b.data.localeCompare(a.data)).map(tx=><TxRow key={tx.id} tx={tx} onEdit={openEdit} onDelete={handleDelete} showBadge/>)}
                </div>
            }
            <div style={{display:"flex",justifyContent:"flex-end",gap:24,marginTop:20,padding:"16px 16px 0",borderTop:"1px solid #222218",flexWrap:"wrap"}}>
              <div style={{fontSize:13}}><span style={{color:"#888"}}>Receitas: </span><span style={{color:"#6B8F71",fontWeight:700}}>{formatCurrency(totalReceitas)}</span></div>
              <div style={{fontSize:13}}><span style={{color:"#888"}}>Despesas: </span><span style={{color:"#C17B35",fontWeight:700}}>{formatCurrency(totalDespesas)}</span></div>
              <div style={{fontSize:13}}><span style={{color:"#888"}}>Saldo: </span><span style={{color:saldo>=0?"#E8C547":"#D44",fontWeight:700}}>{formatCurrency(saldo)}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Modal */}
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
            <button onClick={handleSave} disabled={saving} style={{...btnS("#E8C547","#0E0E0C"),flex:1,opacity:saving?0.6:1}}>
              {saving?"Salvando...":(editingTx?"Salvar":"Adicionar")}
            </button>
          </div>
          {editingTx && (
            <button onClick={()=>handleDelete(editingTx.id)} style={{...btnS("transparent","#e07070"),border:"1px solid #441111",width:"100%",marginTop:4}}>
              Excluir Lançamento
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
function AdminPanel({ adminUser, onBack }) {
  const [users, setUsers] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [resetModal, setResetModal] = useState(null); // user object
  const [novaSenha, setNovaSenha] = useState("");
  const [resetErro, setResetErro] = useState("");
  const [resetOk, setResetOk] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [us, cs] = await Promise.all([loadAllUsers(), loadAllTransactionCounts()]);
      setUsers(us);
      setCounts(cs);
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (user) => {
    if (user.id === adminUser.id) return;
    setSaving(true);
    try { await deleteUserById(user.id); setUsers(prev => prev.filter(u => u.id !== user.id)); }
    catch { alert("Erro ao excluir."); }
    setSaving(false);
    setConfirmDelete(null);
  };

  const handleToggleAdmin = async (user) => {
    if (user.id === adminUser.id) return;
    setSaving(true);
    try {
      await setAdminStatus(user.id, !user.is_admin);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_admin: !u.is_admin } : u));
    } catch { alert("Erro ao alterar."); }
    setSaving(false);
  };

  const handleResetPass = async () => {
    if (novaSenha.length < 6) { setResetErro("Mínimo 6 caracteres."); return; }
    setSaving(true);
    try {
      await resetUserPassword(resetModal.id, novaSenha);
      setResetOk(true);
      setTimeout(() => { setResetModal(null); setNovaSenha(""); setResetErro(""); setResetOk(false); }, 1500);
    } catch { setResetErro("Erro ao salvar."); }
    setSaving(false);
  };

  const filtered = users.filter(u =>
    u.nome.toLowerCase().includes(search.toLowerCase()) ||
    u.usuario.toLowerCase().includes(search.toLowerCase())
  );

  const totalTx = Object.values(counts).reduce((a, b) => a + b, 0);
  const admins = users.filter(u => u.is_admin).length;

  const cell = { padding: "14px 16px", borderBottom: "1px solid #1A1A16", fontSize: 14, color: "#E8E4D9", verticalAlign: "middle" };
  const badge = (bg, color, text) => (
    <span style={{ background: bg, color, borderRadius: 5, padding: "3px 8px", fontSize: 11, fontWeight: 700 }}>{text}</span>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0E0E0C", color: "#E8E4D9", fontFamily: "'DM Sans',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "linear-gradient(180deg,#161612,#0E0E0C)", borderBottom: "1px solid #222218", padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={onBack} style={{ background: "#1A1A16", border: "1px solid #333328", borderRadius: 8, color: "#888", padding: "8px 14px", cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>← Voltar</button>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontFamily: "'Playfair Display',serif", background: "linear-gradient(135deg,#E8C547,#D4A03E)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Painel Admin</h1>
            <div style={{ fontSize: 11, color: "#555", marginTop: 2, letterSpacing: 1 }}>GESTÃO DE USUÁRIOS</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#666" }}>Logado como <span style={{ color: "#E8C547" }}>@{adminUser.usuario}</span></div>
      </div>

      <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto" }}>

        {/* Stat cards */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
          {[
            { label: "Total de Usuários", value: users.length, accent: "#E8C547", icon: "👤" },
            { label: "Administradores", value: admins, accent: "#6B8F71", icon: "🔑" },
            { label: "Total de Lançamentos", value: totalTx, accent: "#C17B35", icon: "📊" },
            { label: "Com 2FA Ativo", value: users.filter(u => u.totp_enabled).length, accent: "#BF9B30", icon: "🔐" },
          ].map(c => (
            <div key={c.label} style={{ background: "linear-gradient(135deg,#1A1A16,#222218)", border: "1px solid #333328", borderRadius: 14, padding: "20px 24px", flex: "1 1 160px", minWidth: 140 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{c.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: c.accent, fontFamily: "'Playfair Display',serif" }}>{c.value}</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 4, textTransform: "uppercase", letterSpacing: 1 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Users table */}
        <div style={{ background: "#1A1A16", border: "1px solid #333328", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #222218", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 14, color: "#888", letterSpacing: 2, textTransform: "uppercase" }}>Usuários Cadastrados</h3>
            <input
              placeholder="Buscar por nome ou usuário..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...BASE_INPUT, width: 260, padding: "8px 12px" }}
            />
          </div>

          {loading ? (
            <div style={{ padding: 60, textAlign: "center", color: "#555" }}>Carregando...</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#111110" }}>
                    {["Usuário", "Nome", "Cadastro", "Lançamentos", "2FA", "Função", "Ações"].map(h => (
                      <th key={h} style={{ ...cell, color: "#666", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, padding: "10px 16px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(user => (
                    <tr key={user.id} style={{ background: user.id === adminUser.id ? "rgba(232,197,71,0.04)" : "transparent" }}>
                      <td style={cell}>
                        <span style={{ color: "#E8C547", fontFamily: "monospace" }}>@{user.usuario}</span>
                        {user.id === adminUser.id && <span style={{ marginLeft: 6, fontSize: 10, color: "#555" }}>(você)</span>}
                      </td>
                      <td style={cell}>{user.nome}</td>
                      <td style={{ ...cell, color: "#666", fontSize: 12 }}>
                        {new Date(user.criado_em).toLocaleDateString("pt-BR")}
                      </td>
                      <td style={{ ...cell, textAlign: "center" }}>
                        <span style={{ color: "#C17B35", fontWeight: 700 }}>{counts[user.id] || 0}</span>
                      </td>
                      <td style={{ ...cell, textAlign: "center" }}>
                        {user.totp_enabled ? badge("rgba(107,143,113,0.2)", "#6B8F71", "Ativo") : badge("rgba(100,100,100,0.15)", "#666", "Inativo")}
                      </td>
                      <td style={{ ...cell, textAlign: "center" }}>
                        {user.is_admin ? badge("rgba(232,197,71,0.15)", "#E8C547", "Admin") : badge("rgba(100,100,100,0.1)", "#888", "Usuário")}
                      </td>
                      <td style={{ ...cell }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            onClick={() => { setResetModal(user); setNovaSenha(""); setResetErro(""); setResetOk(false); }}
                            style={{ background: "#222218", border: "1px solid #333328", borderRadius: 6, color: "#AAA", padding: "5px 10px", cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>
                            Senha
                          </button>
                          {user.id !== adminUser.id && (
                            <>
                              <button
                                onClick={() => handleToggleAdmin(user)} disabled={saving}
                                style={{ background: user.is_admin ? "rgba(200,60,60,0.1)" : "rgba(232,197,71,0.1)", border: `1px solid ${user.is_admin ? "#441111" : "#554400"}`, borderRadius: 6, color: user.is_admin ? "#e07070" : "#E8C547", padding: "5px 10px", cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>
                                {user.is_admin ? "Remover Admin" : "Tornar Admin"}
                              </button>
                              <button
                                onClick={() => setConfirmDelete(user)}
                                style={{ background: "rgba(200,60,60,0.1)", border: "1px solid #441111", borderRadius: 6, color: "#e07070", padding: "5px 10px", cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>
                                Excluir
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} style={{ ...cell, textAlign: "center", color: "#555", padding: 40 }}>Nenhum usuário encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Reset password modal */}
      {resetModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,10,8,0.75)", backdropFilter: "blur(8px)" }} onClick={() => setResetModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1A1A16", border: "1px solid #333328", borderRadius: 16, padding: 32, width: "min(420px,92vw)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, color: "#E8C547", fontFamily: "'Playfair Display',serif" }}>Redefinir senha</h2>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>@{resetModal.usuario}</div>
            {resetOk ? (
              <div style={{ background: "rgba(107,143,113,0.15)", border: "1px solid rgba(107,143,113,0.3)", borderRadius: 8, padding: "14px", color: "#6B8F71", textAlign: "center", fontWeight: 600 }}>Senha alterada com sucesso!</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Input label="NOVA SENHA" type="password" placeholder="Mínimo 6 caracteres" value={novaSenha}
                  onChange={e => { setNovaSenha(e.target.value); setResetErro(""); }} error={resetErro} autoFocus />
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setResetModal(null)} style={{ flex: 1, background: "transparent", border: "1px solid #333328", borderRadius: 8, color: "#888", padding: "11px", cursor: "pointer", fontSize: 14, fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>Cancelar</button>
                  <button onClick={handleResetPass} disabled={saving} style={{ flex: 1, background: "linear-gradient(135deg,#E8C547,#D4A03E)", border: "none", borderRadius: 8, color: "#0E0E0C", padding: "11px", cursor: "pointer", fontSize: 14, fontFamily: "'DM Sans',sans-serif", fontWeight: 700, opacity: saving ? 0.6 : 1 }}>
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,10,8,0.75)", backdropFilter: "blur(8px)" }} onClick={() => setConfirmDelete(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1A1A16", border: "1px solid #441111", borderRadius: 16, padding: 32, width: "min(380px,92vw)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#e07070", fontFamily: "'Playfair Display',serif" }}>Excluir usuário?</h2>
            <p style={{ color: "#888", fontSize: 14, margin: "0 0 24px" }}>
              Isso vai excluir <strong style={{ color: "#E8E4D9" }}>@{confirmDelete.usuario}</strong> e todos os seus lançamentos permanentemente. Essa ação não pode ser desfeita.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, background: "transparent", border: "1px solid #333328", borderRadius: 8, color: "#888", padding: "11px", cursor: "pointer", fontSize: 14, fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} disabled={saving} style={{ flex: 1, background: "rgba(200,60,60,0.15)", border: "1px solid #441111", borderRadius: 8, color: "#e07070", padding: "11px", cursor: "pointer", fontSize: 14, fontFamily: "'DM Sans',sans-serif", fontWeight: 700, opacity: saving ? 0.6 : 1 }}>
                {saving ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [usuario, setUsuario] = useState(() => getSession());

  const handleLogin = (user) => { saveSession(user); setUsuario(user); };
  const handleLogout = () => { clearSession(); setUsuario(null); };

  if (!usuario) return <AuthRouter onLogin={handleLogin}/>;
  return <Dashboard usuario={usuario} onLogout={handleLogout}/>;
}
