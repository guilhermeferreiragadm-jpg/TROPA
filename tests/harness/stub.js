(function(){
  const S = {}, ouvintes = {};
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const iso = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const mais = n => { const d = new Date(hoje); d.setDate(d.getDate()+n); return d; };
  const q = new URLSearchParams(location.search);
  const me = "teste-1";
  if (q.get("perfil")!=="0"){
    S["data/users/"+me+"/perfil"] = {perfil:{
      apelido:"Gui", idade:28, sexo:"m", peso:78, altura:178, objetivo:"10k", temProva:"sim", dataProva:iso(mais(84)),
      corridasSem:3, kmSemana:20, maiorLongao:10, melhorTempo:"", academiaMeses:0, diasSem:4, horasDia:1, melhorHorario:"tarde", sono:7,
      q1:"nao", q2:"nao", q3:"nao", q4:"nao", q5:"nao", q6:"nao", q7:"nao", morte:"nao", ta:"nao", fumo:"nao", fratura:"nao",
      consent1:true, consent2:true, consentAt:new Date().toISOString(), termos:"2026-10-21", menor:false,
      compromisso:{treinos:4, ate:iso(mais(84)), at:new Date().toISOString()},
      assinatura:{plano:"mensal", valor:29.9, cupom:"", status:"teste", at:new Date().toISOString()}
    }, plano:{versao:1, semanas:[]}, viol:[], pausas:[]};   // versão 1 faz o app gerar o plano de novo ao entrar
  }
  const snap = (k) => ({id:k.split("/").pop(), exists:k in S, data:()=>S[k], metadata:{}});
  const avisar = (path) => (ouvintes[path]||[]).forEach(f=>f());
  const col = path => {
    const lista = () => Object.keys(S).filter(k=>k.startsWith(path+"/") && !k.slice(path.length+1).includes("/")).map(snap);
    const api = {
      doc:id=>{ const k = path+"/"+id; return {id, path:k,
        get:async()=>snap(k), set:async v=>{ S[k] = JSON.parse(JSON.stringify(v)); avisar(k); avisar(path); },
        update:async v=>{ S[k] = Object.assign(S[k]||{}, v); avisar(k); }, delete:async()=>{ delete S[k]; avisar(k); },
        onSnapshot:(f)=>{ (ouvintes[k] = ouvintes[k]||[]).push(()=>f(snap(k))); setTimeout(()=>f(snap(k)),0); return ()=>{}; },
        collection:p=>col(k+"/"+p) }; },
      get:async()=>{ const d = lista(); return {docs:d, size:d.length, empty:!d.length}; },
      onSnapshot:(f)=>{ (ouvintes[path] = ouvintes[path]||[]).push(()=>{ const d = lista(); f({docs:d, size:d.length, empty:!d.length}); }); setTimeout(()=>{ const d = lista(); f({docs:d, size:d.length, empty:!d.length}); },0); return ()=>{}; },
      add:async v=>{ const id = "a"+Date.now(); S[path+"/"+id] = v; return {id}; }
    };
    api.where = api.orderBy = api.limit = () => api;
    return api;
  };
  const db = {collection:col, doc:p=>{ const i = p.lastIndexOf("/"); return col(p.slice(0,i)).doc(p.slice(i+1)); }};
  window.claude = {use: async nome => {
    if (nome==="db") return db;
    if (nome==="user") return {me:async()=>({id:me, name:"Gui Teste", avatarUrl:"", isOwner:true}), can:async()=>true, profiles:async()=>({})};
    if (nome==="downloads") return {save:async()=>true};
    throw new Error("sem "+nome);   // "sample" (IA) não existe no harness
  }};
  window.__STUB = {S, iso, mais};
})();
