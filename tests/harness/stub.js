(function(){
  const q = new URLSearchParams(location.search);
  const EU = (q.get("eu")||"").replace(/[^A-Za-z0-9_-]/g,"").slice(0,30);   // com ?eu=<id> o banco é compartilhado entre abas (localStorage) e a identidade é a escolhida
  const CHAVE = "tropa-stub-db";
  let S = {}; const ouvintes = {};
  if (EU){ try{ S = JSON.parse(localStorage.getItem(CHAVE)||"{}"); }catch(e){ S = {}; } }
  const persistir = () => { if (EU){ try{ localStorage.setItem(CHAVE, JSON.stringify(S)); }catch(e){} } };
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const iso = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const mais = n => { const d = new Date(hoje); d.setDate(d.getDate()+n); return d; };
  const me = EU || "teste-1";
  const nome = EU ? (q.get("nome")||EU) : "Gui Teste";
  if (EU){
    const ag = new Date().toISOString();
    if (!S["acessos/"+me]) S["acessos/"+me] = {status:"aceito", indicadoPor:"harness", at:ag};
    if (!S["aprovados/"+me]) S["aprovados/"+me] = {status:"aprovado", at:ag};
  }
  if (q.get("perfil")!=="0" && !(EU && S["data/users/"+me+"/perfil"])){
    S["data/users/"+me+"/perfil"] = {perfil:{
      apelido:"Gui", idade:28, sexo:"m", peso:78, altura:178, objetivo:"10k", temProva:"sim", dataProva:iso(mais(84)),
      corridasSem:3, kmSemana:20, maiorLongao:10, melhorTempo:"", academiaMeses:0, diasSem:4, horasDia:1, melhorHorario:"tarde", sono:7,
      q1:"nao", q2:"nao", q3:"nao", q4:"nao", q5:"nao", q6:"nao", q7:"nao", morte:"nao", ta:"nao", fumo:"nao", fratura:"nao",
      consent1:true, consent2:true, consentAt:new Date().toISOString(), termos:"2026-10-21", menor:false,
      compromisso:{treinos:4, ate:iso(mais(84)), at:new Date().toISOString()},
      assinatura:{plano:"mensal", valor:29.9, cupom:"", status:"teste", at:new Date().toISOString()}
    }, plano:{versao:1, semanas:[]}, viol:[], pausas:[]};   // versão 1 faz o app gerar o plano de novo ao entrar
  }
  persistir();
  const snap = (k) => ({id:k.split("/").pop(), exists:k in S, data:()=>S[k], metadata:{}});
  const avisar = (path) => (ouvintes[path]||[]).forEach(f=>f());
  const col = path => {
    const lista = () => Object.keys(S).filter(k=>k.startsWith(path+"/") && !k.slice(path.length+1).includes("/")).map(snap);
    const api = {
      doc:id=>{ const k = path+"/"+id; return {id, path:k,
        get:async()=>snap(k), set:async v=>{ S[k] = JSON.parse(JSON.stringify(v)); persistir(); avisar(k); avisar(path); },
        update:async v=>{ S[k] = Object.assign(S[k]||{}, v); persistir(); avisar(k); avisar(path); }, delete:async()=>{ delete S[k]; persistir(); avisar(k); avisar(path); },
        onSnapshot:(f)=>{ (ouvintes[k] = ouvintes[k]||[]).push(()=>f(snap(k))); setTimeout(()=>f(snap(k)),0); return ()=>{}; },
        collection:p=>col(k+"/"+p) }; },
      get:async()=>{ const d = lista(); return {docs:d, size:d.length, empty:!d.length}; },
      onSnapshot:(f)=>{ (ouvintes[path] = ouvintes[path]||[]).push(()=>{ const d = lista(); f({docs:d, size:d.length, empty:!d.length}); }); setTimeout(()=>{ const d = lista(); f({docs:d, size:d.length, empty:!d.length}); },0); return ()=>{}; },
      add:async v=>{ const id = "a"+Date.now()+Math.random().toString(36).slice(2,6); S[path+"/"+id] = JSON.parse(JSON.stringify(v)); persistir(); avisar(path); return {id}; }
    };
    api.where = api.orderBy = api.limit = () => api;
    return api;
  };
  const db = {collection:col, doc:p=>{ const i = p.lastIndexOf("/"); return col(p.slice(0,i)).doc(p.slice(i+1)); }};
  window.claude = {use: async svc => {
    if (svc==="db") return db;
    if (svc==="user") return {me:async()=>({id:me, name:nome, avatarUrl:"", isOwner:!EU}), can:async()=>true, profiles:async()=>({})};
    if (svc==="downloads") return {save:async()=>true};
    throw new Error("sem "+svc);   // "sample" (IA) não existe no harness
  }};
  // Outra aba escreveu: recarrega o banco e dispara só os ouvintes dos documentos que mudaram (e da coleção pai).
  if (EU) window.addEventListener("storage", e=>{
    if (e.key!==CHAVE) return;
    const antes = S; try{ S = JSON.parse(e.newValue||"{}"); }catch(x){ return; }
    const mudou = new Set();
    new Set([...Object.keys(antes), ...Object.keys(S)]).forEach(k=>{ if (JSON.stringify(antes[k])!==JSON.stringify(S[k])){ mudou.add(k); mudou.add(k.slice(0, k.lastIndexOf("/"))); } });
    mudou.forEach(avisar);
    window.__STUB.S = S;
  });
  window.__STUB = {S, iso, mais, eu:EU};
})();
