(function(){
'use strict';
/* ===================== CONFIG ===================== */
const STAGES = ['Prospecção','Primeiro contato','Reunião','Oportunidade','Proposta','Negociação','Associação','Pós-venda'];
const STAGE_CONTATO = 'Apenas contato';
const STAGE_FROM_LIFECYCLE = {lead:'Prospecção',opportunity:'Oportunidade',customer:'Associação'};
const MOTIVOS = ['Sem orçamento','Sem interesse','Não respondeu','Adiou a decisão','Escolheu outro fornecedor','Associação não aprovada','Outro'];
const CATS = ['Associação','Serviços'];
const RESPS = [['pedro','Pedro'],['rafaela','Rafaela'],['ambos','Pedro e Rafaela']];
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DOW = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const K = {registry:'ccibsp:registry', activities:'ccibsp:activities', eventos:'ccibsp:eventos', meta:'ccibsp:meta',
  over:'ccibsp:over', meetover:'ccibsp:meetover', tarefas:'ccibsp:tarefas', interessadas:'ccibsp:interessadas', mous:'ccibsp:mous', renov:'ccibsp:renov'};

let DEALS = [], SNAP = null, APENAS_CONTATO = {}, KPI = null;
let ST = {registry:{}, over:{}, meetover:{}, activities:[], eventos:[], tarefas:[], interessadas:[], mous:[], renov:[], contatos:[],
  filters:{cat:'',resp:'',periodo:'0',busca:''}, tab:'inicio', lastSync:null, negView:'funil', tarefaView:'pendentes', mouFilter:'', intFilter:'', ctPage:0, ctView:'pessoas'};
let CAL = {view:'mes', ref:null, sel:null};

/* ===================== STORAGE ===================== */
function lget(k, fb){ try{ const r=localStorage.getItem(k); return r==null?fb:JSON.parse(r); }catch(e){ return fb; } }
function lset(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){ console.error('storage', k, e); } }
const save = {
  registry:()=>lset(K.registry, ST.registry), over:()=>lset(K.over, ST.over), meetover:()=>lset(K.meetover, ST.meetover),
  activities:()=>lset(K.activities, ST.activities.filter(a=>!a.seed)), eventos:()=>lset(K.eventos, ST.eventos.filter(e=>!e.seed)),
  tarefas:()=>lset(K.tarefas, ST.tarefas), interessadas:()=>lset(K.interessadas, ST.interessadas.filter(i=>!i.seed)),
  mous:()=>lset(K.mous, ST.mous.filter(m=>!m.seed)), renov:()=>lset(K.renov, ST.renov), meta:()=>lset(K.meta,{lastSync:ST.lastSync})
};

/* ===================== UTIL ===================== */
const $ = id => document.getElementById(id);
function uid(){ return 'x'+Math.random().toString(36).slice(2,10); }
function esc(s){ return (s==null?'':String(s)).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function money(v){ return 'US$ '+Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:0}); }
function parseDate(d){ const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(d||''); return m?new Date(+m[1],+m[2]-1,+m[3]):new Date(d); }
function iso(dt){ const p=n=>String(n).padStart(2,'0'); return `${dt.getFullYear()}-${p(dt.getMonth()+1)}-${p(dt.getDate())}`; }
function todayISO(){ return iso(new Date()); }
function addDays(d,n){ const x=parseDate(d); x.setDate(x.getDate()+n); return iso(x); }
function fmtDate(d){ if(!d) return '—'; const dt=parseDate(d); return isNaN(dt)?d:dt.toLocaleDateString('pt-BR'); }
function fmtDM(d){ const m=/^\d{4}-(\d{2})-(\d{2})$/.exec(d||''); return m?`${m[2]}/${m[1]}`:'—'; }
function daysTo(d){ const a=parseDate(d), t=new Date(); return Math.round((new Date(a.getFullYear(),a.getMonth(),a.getDate())-new Date(t.getFullYear(),t.getMonth(),t.getDate()))/86400000); }
function norm(s){ return (s||'').toString().normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(); }
function initials(n){ return (n||'?').replace(/[^\p{L}\p{N} ]/gu,'').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?'; }
function logo(dm,name,size){ size=size||30;
  return `<span class="logo" style="width:${size}px;height:${size}px;font-size:${Math.round(size*.38)}px"><b>${esc(initials(name))}</b>${dm?`<img src="https://www.google.com/s2/favicons?domain=${esc(dm)}&sz=64" alt="" loading="lazy" onload="this.style.opacity=1" onerror="this.remove()">`:''}</span>`; }
function inPeriod(dateStr){ const p=+ST.filters.periodo; if(!p||!dateStr) return true; return daysTo(dateStr) >= -p; }
function toast(msg){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2600); }
function waitAnd(fn){ fn(); }

/* ===================== DATA ACCESS ===================== */
function companies(){ return Object.entries(ST.registry).map(([id,r])=>({id,...r})); }
function co(id){ return ST.registry[id] ? {id,...ST.registry[id]} : null; }
function ov(id){ return ST.over[id] || {}; }
function setOv(id, patch){ ST.over[id] = {...(ST.over[id]||{}), ...patch}; save.over(); }
function stageOf(c){ return (APENAS_CONTATO[c.id] && (!c.stage || c.stage==='Prospecção')) ? STAGE_CONTATO : c.stage; }
function catOf(c){ return ov(c.id).cat || 'Associação'; }
function nameOf(c){ return c.cache.n; }
function byStatus(s){ return companies().filter(c=>c.cache.s===s); }
function meetings(){ return ST.activities.filter(a=>a.tipo==='reuniao'||a.tipo==='evento externo').map(a=>({...a, ...(ST.meetover[a.id]||{})})); }
function meetStatus(a){ if(a.forceStatus) return a.forceStatus; if(a.seed) return (a.dataFim||a.data) < todayISO()?'realizada':'agendada'; return a.status==='agendado'?'agendada':'realizada'; }
function meetKind(a){ return a.categoria || (a.tipo==='evento externo'?'Evento':(a.empresaId?'Comercial':'Institucional')); }
function meetOn(list, d){ return list.filter(a=>a.data && a.data<=d && (a.dataFim||a.data)>=d).sort((a,b)=>(a.horario||'').localeCompare(b.horario||'')); }
function lastContact(c){
  const past = meetings().filter(a=>a.empresaId===c.id && a.data<=todayISO()).map(a=>a.data);
  const dl=dealOfCompany(c); [ov(c.id).ultContato, dl&&ov(dl.id).ultContato, dl&&dl.ult].forEach(x=>{ if(x) past.push(x); });
  return past.sort().pop() || null;
}
function nextAction(c){
  const dl=dealOfCompany(c); const o=Object.assign({},ov(c.id),dl?ov(dl.id):{});
  if(o.proxAcao) return {txt:o.proxAcao, data:o.proxData||null};
  const f = meetings().filter(a=>a.empresaId===c.id && a.data>=todayISO()).sort((a,b)=>a.data.localeCompare(b.data))[0];
  return f ? {txt:'Reunião: '+(f.titulo||''), data:f.data} : null;
}
function evRealizado(e){ return !!e.data && e.data < todayISO(); }
function evProx(){ return ST.eventos.filter(e=>!evRealizado(e)).sort((a,b)=>(a.data||'9999').localeCompare(b.data||'9999')); }
function evReal(){ return ST.eventos.filter(evRealizado).sort((a,b)=>(b.data||'').localeCompare(a.data||'')); }
function tarefaOverdue(t){ return !t.done && t.prazo && t.prazo < todayISO(); }
function tarefaHoje(t){ return !t.done && (!t.prazo || t.prazo <= todayISO()); }
function passF(c){
  const f=ST.filters;
  if(f.cat && catOf(c)!==f.cat) return false;
  if(!respMatch(c.responsavel,f.resp)) return false;
  if(f.busca && !norm(nameOf(c)).includes(norm(f.busca))) return false;
  return true;
}
function matchCompany(name){
  const n=norm(name).trim(); if(!n) return null;
  return companies().find(c=>norm(nameOf(c)).trim()===n) || companies().find(c=>{ const m=norm(nameOf(c)).trim(); return m.length>3 && (m.includes(n)||n.includes(m)); }) || null;
}

/* ===================== SNAPSHOT ===================== */
function applySnapshot(){
  Object.entries(SNAP.companies).forEach(([id,d])=>{
    const ex = ST.registry[id]||{};
    ST.registry[id] = {source:ex.source||'pedro', responsavel:ex.responsavel||'pedro', stage:ex.stage||STAGE_FROM_LIFECYCLE[d.s]||'Prospecção',
      cache:{n:d.n,ind:d.ind,c:d.c,s:d.s,e:d.e,v:+d.v||0,nc:+d.nc||0,nd:+d.nd||0,dm:d.dm,url:d.url,assocType:d.assocType||null,assocStatus:d.assocStatus||null,assocValue:d.assocValue||null,wonNoSync:!!d.wonNoSync,dealUrl:d.dealUrl||null},
      note:d.note||null, lastSynced:SNAP.fetchedAt};
  });
  KPI = SNAP.kpi; ST.lastSync = new Date(SNAP.fetchedAt).getTime(); save.registry(); save.meta();
}

/* ===================== MODAL HELPERS ===================== */
function openModal(title, body, foot, opts){
  opts=opts||{};
  const root=$('modal-root');
  root.innerHTML=`<div class="modal-overlay" id="mo"><div class="modal ${opts.wide?'wide':''}"><div class="modal-head"><h3>${title}</h3><button class="close-x" id="mx">✕</button></div><div class="modal-body">${body}</div><div class="modal-foot">${foot||''}</div></div></div>`;
  const close=()=>{ root.innerHTML=''; };
  $('mx').onclick=close; $('mo').addEventListener('mousedown',e=>{ if(e.target.id==='mo') close(); });
  return close;
}
function fld(id,label,html,full){ return `<div class="fld" ${full?'style="grid-column:1/-1"':''}><label for="${id}">${label}</label>${html}</div>`; }
function inp(id,v,type,ph){ return `<input type="${type||'text'}" id="${id}" value="${esc(v||'')}" placeholder="${esc(ph||'')}">`; }
function sel(id,opts,cur,blank){ return `<select id="${id}">${blank!=null?`<option value="">${esc(blank)}</option>`:''}${opts.map(o=>{const v=Array.isArray(o)?o[0]:o,l=Array.isArray(o)?o[1]:o;return `<option value="${esc(v)}" ${v===cur?'selected':''}>${esc(l)}</option>`}).join('')}</select>`; }
function val(id){ const e=$(id); return e?e.value.trim():''; }
function companyOptions(){ return companies().sort((a,b)=>nameOf(a).localeCompare(nameOf(b))).map(c=>[c.id,nameOf(c)]); }
function catTag(cat){ return `<span class="cat cat-${cat==='Serviços'?'serv':'assoc'}">${esc(cat)}</span>`; }
function respBadge(r){ return r?`<span class="badge-resp">${esc(r==='pedro'?'Pedro':r==='rafaela'?'Rafaela':r==='ambos'?'Pedro + Rafaela':r)}</span>`:''; }
function respMatch(r,f){ return !f || r===f || r==='ambos'; }
function coCell(c, sub){ return `<div class="co-cell">${logo(c.cache.dm,nameOf(c),32)}<div><b>${esc(nameOf(c))}</b>${sub?`<div class="hint">${esc(sub)}</div>`:''}</div></div>`; }
function bindOpen(root){ root.querySelectorAll('[data-open]').forEach(r=>r.addEventListener('click',e=>{ if(e.target.closest('button,select,input,a')) return; openDrawer(r.dataset.open); })); }

/* ===================== NAV ===================== */
const NAV = [
  ['inicio','Início','grid'],['associados','Associados','star'],['renovacoes','Renovações','refresh'],['negociacao','Em negociação','trend'],['perdidos','Negócios perdidos','x'],
  ['contatos','Contatos HubSpot','users'],['eventos','Eventos','flag'],['calendario','Calendário','calendar'],['interessadas','Empresas interessadas','inbox'],
  ['mous','MOUs','file'],['tarefas','Tarefas do dia','check']];
const ICONS = {
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  star:'<path d="M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7-5.4-4.7 7.1-.7z"/>',
  trend:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  x:'<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  users:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15 14.2c2.9.3 5 2.6 5 5.8"/>',
  flag:'<line x1="5" y1="21" x2="5" y2="3"/><path d="M5 4h13l-3 4.5L18 13H5"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>',
  inbox:'<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
  file:'<path d="M6 2h8l5 5v15H6z"/><path d="M14 2v5h5M9 13h7M9 17h7"/>',
  refresh:'<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
  check:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/>'};
function svg(n){ return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`; }
function badgeFor(id){
  if(id==='tarefas'){ const n=ST.tarefas.filter(tarefaHoje).length; return n?`<span class="nav-badge">${n}</span>`:''; }
  return '';
}
const TITLES = {
  inicio:['Início','O que precisa da sua atenção hoje'],
  associados:['Gestão de associados','Empresas associadas desenvolvidas pela Regional São Paulo'],
  negociacao:['Empresas em negociação','Proposta enviada ou além, direto do HubSpot'],
  renovacoes:['Renovações','Próximas renovações e quem não renovou'],
  perdidos:['Negócios perdidos','Quem não avançou e por quê'],
  contatos:['Contatos HubSpot','Pessoas e empresas ainda sem negociação'],
  eventos:['Eventos','Realizados e próximos'],
  calendario:['Calendário Regional SP','Reuniões e compromissos (Outlook/Teams)'],
  interessadas:['Empresas interessadas','Formulário de interesse e conversão'],
  mous:['MOUs','Uma pasta por empresa'],
  tarefas:['Tarefas do dia','O que não for concluído continua aqui, marcado como atrasado']
};
function renderNav(){
  const nav=$('nav');
  nav.innerHTML=NAV.map(([id,l,ic])=>`<div class="nav-item ${ST.tab===id?'active':''}" data-tab="${id}" title="${l}">${svg(ic)}<span>${l}</span>${badgeFor(id)}</div>`).join('');
  nav.querySelectorAll('.nav-item').forEach(el=>el.onclick=()=>go(el.dataset.tab));
}
function go(t){ ST.tab=t; try{ location.hash=t; }catch(e){} render(); window.scrollTo(0,0); }
const RENDER = {};
function render(){
  renderNav();
  const [t,s]=TITLES[ST.tab]; $('page-title').textContent=t; $('page-sub').textContent=s;
  $('sync-tag').textContent = ST.lastSync ? 'HubSpot: '+new Date(ST.lastSync).toLocaleDateString('pt-BR') : 'HubSpot não carregado';
  $('tabs').innerHTML='<div class="tab active" id="view"></div>';
  RENDER[ST.tab]($('view'));
}

/* ===================== NEGÓCIOS (deals do HubSpot) ===================== */
const NEG_STAGES = ['Proposta enviada / Em negociação','Proposta aceita','Ficha preenchida / assinada','Boleto enviado / Aguardando pagamento'];
const STAGE_GROUP = {'964257956':['neg',0],'964257957':['neg',1],'presentationscheduled':['neg',2],'contractsent':['neg',3],'967869211':['neg',0],'967869212':['neg',1],'967869213':['neg',2],'967869214':['neg',2],'967931040':['neg',3],
  'closedwon':['won'],'967869215':['won'],'closedlost':['lost'],'967869216':['lost'],'1271175298':['renov'],'appointmentscheduled':['first'],'967869210':['first']};
function dKind(d){ return d.kind||(STAGE_GROUP[d.etapaId]||['other'])[0]; }
function dCol(d){ const o=ov(d.id); return o.col!=null?o.col:(d.col!=null?d.col:(STAGE_GROUP[d.etapaId]||[0,0])[1]); }
function dealsOf(k){ return DEALS.filter(d=>dKind(d)===k); }
function dCat(d){ return ov(d.id).cat||d.cat||(d.pipeline==='Serviços'?'Serviços':'Associação'); }
function dResp(d){ return ov(d.id).resp||'pedro'; }
function ckey(n){ return norm(n).replace(/[^a-z0-9]/g,''); }
function dCo(d){ return matchCompany(d.nome); }
function dealOfCompany(c){ const k=ckey(nameOf(c)); return DEALS.find(d=>ckey(d.nome)===k && dKind(d)!=='lost') || null; }
function passD(d){ const f=ST.filters; if(f.cat&&dCat(d)!==f.cat) return false; if(!respMatch(dResp(d),f.resp)) return false; if(f.busca&&!norm(d.nome).includes(norm(f.busca))) return false; return true; }
function dedupe(list){ const m=new Map(); list.forEach(d=>{ const k=ckey(d.nome), o=m.get(k); if(!o||(d.fecha||'')>(o.fecha||'')) m.set(k,d); }); return [...m.values()]; }
function renovOf(d){ return ST.renov.find(r=>r.dealId===d.id||ckey(r.empresaNome)===ckey(d.nome)); }
function naoRenovou(d){ const r=renovOf(d); return !!r&&r.status==='Não renovou'; }
function associados(){ const won=dedupe(dealsOf('won')).filter(d=>!naoRenovou(d)); const have=new Set(won.map(d=>ckey(d.nome)));
  const extra=DEALS.filter(d=>dKind(d)==='renov'&&ST.renov.some(r=>r.dealId===d.id)&&!have.has(ckey(d.nome))); return won.concat(extra); }
function perdidos(){ const live=new Set(DEALS.filter(d=>['neg','won','renov'].includes(dKind(d))).map(d=>ckey(d.nome))); return dedupe(dealsOf('lost')).filter(d=>!live.has(ckey(d.nome))); }
function negociacoes(){ return dealsOf('neg'); }
function dLast(d){ const c=dCo(d); const a=[ov(d.id).ultContato,d.ult]; if(c) a.push(lastContact(c)); return a.filter(Boolean).sort().pop()||null; }
function dNext(d){ const o=ov(d.id); if(o.proxAcao) return {txt:o.proxAcao,data:o.proxData||null}; const c=dCo(d); return c?nextAction(c):null; }
function dealCell(d){ const c=dCo(d); return `<div class="co-cell">${logo(c?c.cache.dm:null,d.nome,32)}<div><b>${esc(d.nome)}</b>${c&&c.cache.ind?`<div class="hint">${esc(c.cache.ind)}</div>`:''}</div></div>`; }
function dealUrl(d){ return `https://app.hubspot.com/contacts/${'48321673'}/record/0-3/${d.id}`; }
function bindDeals(el){
  el.querySelectorAll('[data-deal]').forEach(r=>r.addEventListener('click',e=>{ if(e.target.closest('button,select,input,a')) return; openDealDetail(r.dataset.deal); }));
  el.querySelectorAll('[data-dedit]').forEach(b=>b.onclick=()=>openDealEdit(b.dataset.dedit));
}

/* ===================== INÍCIO ===================== */
function kpi(label,value,sub,tab,cls){ return `<div class="kpi-card ${cls||''}" data-go="${tab}"><div class="label">${label}</div><div class="value mono">${value}</div><div class="sub">${sub||''}</div></div>`; }
function renovAlert(){ const open=ST.renov.filter(r=>r.status==='Próxima'); return {vencidas:open.filter(r=>r.dataRenovacao&&daysTo(r.dataRenovacao)<0), proximas:open.filter(r=>!r.dataRenovacao||daysTo(r.dataRenovacao)>=0)}; }
RENDER.inicio = function(el){
  const assoc=associados(), neg=negociacoes(), lost=perdidos();
  const nAssoc=neg.filter(d=>dCat(d)==='Associação').length, nServ=neg.length-nAssoc;
  const ms=meetings(), futuras=ms.filter(a=>meetStatus(a)==='agendada');
  const pend=ST.tarefas.filter(tarefaHoje), late=ST.tarefas.filter(tarefaOverdue);
  const mousProc=ST.mous.filter(m=>m.status==='Em processo').length, ra=renovAlert(), naoRen=ST.renov.filter(r=>r.status==='Não renovou').length;
  const nx=evProx().find(e=>e.data), dd=nx?daysTo(nx.data):null;
  const stagesN=NEG_STAGES.map((n,i)=>[n,neg.filter(d=>dCol(d)===i).length]), maxN=Math.max(1,...stagesN.map(x=>x[1]));
  const leads=companies().filter(c=>c.cache.s==='lead').length;
  const parts=[['Associados',assoc.length,'#2F9E6E'],['Em negociação',neg.length,'#E8A33D'],['Sem negociação',leads,'#93A0B2'],['Perdidos',lost.length,'#D64550']], tot=parts.reduce((a,p)=>a+p[1],0)||1;
  let acc=0; const grad=parts.map(([,n,c])=>{ const a=acc/tot*100; acc+=n; return `${c} ${a}% ${acc/tot*100}%`; }).join(',');
  const hero=`<div class="hero"><div class="hero-main"><div class="hero-hi">${new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</div>
    <div class="quick"><input type="text" id="q-task" placeholder="Nova tarefa para hoje… (Enter para adicionar)"><button class="btn btn-accent" id="q-add">Adicionar</button></div>
    <div class="hero-stats"><span><b>${pend.length}</b> tarefa(s) para hoje</span><span class="${late.length?'late':''}"><b>${late.length}</b> atrasada(s)</span><span><b>${futuras.length}</b> reunião(ões) agendada(s)</span></div></div>
    ${nx?`<div class="hero-ev" data-go2="eventos">${nx.flyer?`<img src="${esc(nx.flyer)}" alt="">`:''}<div><div class="hint" style="color:#cbd5e6">Próximo evento</div><b>${esc(nx.nome)}</b><div class="count mono">${dd===0?'hoje':dd+' dias'}</div><div class="hint" style="color:#cbd5e6">${fmtDate(nx.data)} · ${esc(nx.local||'')}</div></div></div>`:''}</div>
  <div class="two-col charts"><div class="panel"><div class="panel-head"><h3>Funil de negociações</h3><button class="link-btn" data-go="negociacao">abrir →</button></div><div class="panel-body">${stagesN.map(([n,v])=>`<div class="bar-row" data-go="negociacao"><span>${n}</span><div class="bar"><i style="width:${v/maxN*100}%"></i></div><b class="mono">${v}</b></div>`).join('')}</div></div>
  <div class="panel"><div class="panel-head"><h3>Panorama das empresas</h3></div><div class="panel-body donut-wrap"><div class="donut" style="background:conic-gradient(${grad})"><span class="mono">${tot}</span></div><div>${parts.map(([l,n,c])=>`<div class="lg"><i style="background:${c}"></i>${l} <b class="mono">${n}</b></div>`).join('')}</div></div></div></div>`;
  el.innerHTML=hero+`<div class="kpi-grid">
    ${kpi('Associados concluídos',assoc.length,'pela Regional SP','associados','good')}
    ${kpi('Em negociação',neg.length,'proposta enviada ou além','negociacao','accent')}
    ${kpi('Negociações de Associação',nAssoc,'','negociacao','')}
    ${kpi('Negócios perdidos',lost.length,'','perdidos',lost.length?'warn':'')}
    ${kpi('Renovações',ra.proximas.length+ra.vencidas.length,(ra.vencidas.length?ra.vencidas.length+' vencida(s) · ':'')+naoRen+' não renovou','renovacoes',ra.vencidas.length||naoRen?'warn':'accent')}
    ${kpi('Próximos eventos',evProx().length,evProx()[0]?('próximo: '+(evProx()[0].data?fmtDM(evProx()[0].data):'data a definir')):'nenhum','eventos','accent')}
    ${kpi('Reuniões agendadas',futuras.length,'a partir de hoje','calendario','')}
    ${kpi('MOUs em processo',mousProc,'','mous','')}
    ${kpi('Tarefas pendentes hoje',pend.length,late.length?late.length+' atrasada(s)':'em dia','tarefas',late.length?'warn':'good')}
  </div>
  <div class="two-col">
    <div class="panel"><div class="panel-head"><h3>Tarefas de hoje e atrasadas</h3><button class="link-btn" data-go="tarefas">abrir →</button></div><div class="panel-body">${tarefaListHtml(pend.sort(tarefaSort).slice(0,8),true)||'<div class="empty">Nada pendente para hoje 🎉</div>'}</div></div>
    <div class="panel"><div class="panel-head"><h3>Renovações em foco</h3><button class="link-btn" data-go="renovacoes">abrir →</button></div><div class="panel-body">${renovMini()}</div></div>
  </div>
  <div class="two-col">
    <div class="panel"><div class="panel-head"><h3>Agenda dos próximos 7 dias</h3><button class="link-btn" data-go="calendario">abrir →</button></div><div class="panel-body">${agendaHtml(7)}</div></div>
    <div class="panel"><div class="panel-head"><h3>Próximos eventos</h3><button class="link-btn" data-go="eventos">abrir →</button></div><div class="panel-body">${evProx().slice(0,4).map(ev=>`<div class="mini-row"><span class="k"><b class="mono">${ev.data?fmtDM(ev.data):'a definir'}</b> · ${esc(ev.nome)}</span><span class="v" style="font-weight:400">${esc(ev.local||ev.dataPrevista||'')}</span></div>`).join('')||'<div class="empty">Nenhum evento agendado.</div>'}</div></div>
  </div>`;
  el.querySelectorAll('[data-go]').forEach(c=>c.onclick=()=>go(c.dataset.go));
  el.querySelectorAll('[data-go2]').forEach(c=>c.onclick=()=>go(c.dataset.go2));
  wireQuick(el); wireTarefaList(el);
};
function renovMini(){
  const items=ST.renov.filter(r=>r.status==='Próxima').sort((a,b)=>(a.dataRenovacao||'9999').localeCompare(b.dataRenovacao||'9999')).slice(0,4);
  const nr=ST.renov.filter(r=>r.status==='Não renovou');
  return items.map(r=>`<div class="mini-row clickable-row" data-go="renovacoes"><span class="k">${esc(r.empresaNome)} · <b class="mono">${r.dataRenovacao?fmtDM(r.dataRenovacao):'—'}</b></span><span class="v">${renovTag(r)}</span></div>`).join('')
   + (nr.length?`<div class="mini-row clickable-row" data-go="renovacoes"><span class="k">Não renovaram</span><span class="v" style="font-weight:400">${nr.map(r=>esc(r.empresaNome)).join(', ')}</span></div>`:'') || '<div class="empty">Nenhuma renovação cadastrada.</div>';
}
function agendaHtml(n){
  const end=addDays(todayISO(),n), list=meetings().filter(a=>a.data && (a.dataFim||a.data)>=todayISO() && a.data<=end).sort((a,b)=>a.data.localeCompare(b.data)||(a.horario||'').localeCompare(b.horario||''));
  return list.length? list.map(a=>`<div class="mini-row clickable-row" data-meet="${a.id}"><span class="k"><b class="mono">${fmtDM(a.data)}</b> ${a.horario||''} · ${esc(a.titulo||a.empresaNome)}</span><span class="v" style="font-weight:400">${esc(a.local||'')}</span></div>`).join('') : '<div class="empty">Sem reuniões nos próximos 7 dias.</div>';
}

/* ===================== ASSOCIADOS ===================== */
RENDER.associados = function(el){
  const list=associados().filter(passD).sort((a,b)=>a.nome.localeCompare(b.nome));
  el.innerHTML=`<div class="panel"><div class="panel-head"><h3>Associados (${list.length})</h3><span class="hint">quem não renovou fica na aba Renovações</span></div><div class="panel-body">
  ${list.length?`<div class="tbl-wrap"><table><thead><tr><th>Empresa</th><th>Modalidade</th><th>Data de conclusão</th><th>Valor</th><th>Renovação</th><th>Situação</th><th>Resp.</th><th></th></tr></thead><tbody>
  ${list.map(d=>{ const o=ov(d.id), r=renovOf(d), nao=false;
    return `<tr class="clickable" data-deal="${d.id}"><td>${dealCell(d)}${dCat(d)==='Serviços'?'<span class="cat cat-serv" style="margin-top:4px">Serviço</span>':''}</td><td>${esc(d.tipo||'—')}</td><td>${fmtDate(o.dataConclusao||(dKind(d)==='won'?d.fecha:r&&r.desde))}</td><td class="mono">${d.valor!=null?money(d.valor):'—'}</td><td>${r?renovTag(r):'<span class="hint">—</span>'}</td><td><span class="tag ${nao?'tag-late':'tag-ok'}">${nao?'Não renovou':'Ativa'}</span></td><td>${respBadge(dResp(d))}</td><td><button class="btn btn-ghost btn-sm" data-dedit="${d.id}">Editar</button></td></tr>`; }).join('')}
  </tbody></table></div>`:'<div class="empty">Nenhum associado com os filtros atuais.</div>'}</div></div>`;
  bindDeals(el);
};

/* ===================== RENOVAÇÕES ===================== */
function renovTag(r){
  if(r.status==='Renovada') return '<span class="tag tag-ok">Renovada</span>';
  if(r.status==='Não renovou') return '<span class="tag tag-late">Não renovou</span>';
  if(!r.dataRenovacao) return '<span class="tag tag-soon">Próxima</span>';
  const d=daysTo(r.dataRenovacao);
  return d<0?`<span class="tag tag-late">vencida há ${-d}d</span>`:d<=30?`<span class="tag tag-soon">em ${d} dias</span>`:`<span class="tag tag-ok">em ${d} dias</span>`;
}
RENDER.renovacoes = function(el){
  const f=ST.filters.busca?norm(ST.filters.busca):'';
  const all=ST.renov.filter(r=>!f||norm(r.empresaNome).includes(f));
  const prox=all.filter(r=>r.status==='Próxima').sort((a,b)=>(a.dataRenovacao||'9999').localeCompare(b.dataRenovacao||'9999'));
  const nao=all.filter(r=>r.status==='Não renovou'), ren=all.filter(r=>r.status==='Renovada');
  const risco=prox.reduce((a,r)=>a+(r.valor||0),0), perda=nao.reduce((a,r)=>a+(r.valor||0),0);
  const card=r=>{ const c=r.empresaId?co(r.empresaId):null; return `<div class="ren-card ${r.status==='Não renovou'?'lost':r.status==='Renovada'?'ok':''}"><div class="co-cell">${logo(c?c.cache.dm:r.dm,r.empresaNome,38)}<div><b>${esc(r.empresaNome)}</b><div class="hint">${esc(r.modalidade||'')} ${r.valor!=null?'· '+money(r.valor):''}</div></div><span style="margin-left:auto">${renovTag(r)}</span></div>
    <div class="ren-dates">${r.dataRenovacao?`<span>Renovação: <b class="mono">${fmtDate(r.dataRenovacao)}</b></span>`:''}${r.desde?`<span>Associada desde <b class="mono">${fmtDate(r.desde)}</b></span>`:''}</div>
    ${r.obs?`<div class="hint">${esc(r.obs)}</div>`:''}
    <div class="ren-actions">${r.status==='Próxima'?`<button class="btn btn-ghost btn-sm" data-rset="${r.id}|Renovada">Renovou</button><button class="btn btn-ghost btn-sm" data-rset="${r.id}|Não renovou">Não renovou</button>`:`<button class="btn btn-ghost btn-sm" data-rset="${r.id}|Próxima">Reabrir</button>`}<button class="btn btn-ghost btn-sm" data-redit="${r.id}">Editar</button></div></div>`; };
  const sec=(t,arr,cls)=>`<div class="panel"><div class="panel-head"><h3>${t} (${arr.length})</h3></div><div class="panel-body">${arr.length?`<div class="ren-grid">${arr.map(card).join('')}</div>`:'<div class="empty">Nada por aqui.</div>'}</div></div>`;
  el.innerHTML=`<div class="kpi-grid"><div class="kpi-card accent"><div class="label">Próximas renovações</div><div class="value mono">${prox.length}</div><div class="sub">${money(risco)} em jogo</div></div>
    <div class="kpi-card ${prox.some(r=>r.dataRenovacao&&daysTo(r.dataRenovacao)<0)?'warn':''}"><div class="label">Vencidas sem renovar</div><div class="value mono">${prox.filter(r=>r.dataRenovacao&&daysTo(r.dataRenovacao)<0).length}</div><div class="sub">precisam de ação</div></div>
    <div class="kpi-card good"><div class="label">Renovadas</div><div class="value mono">${ren.length}</div></div>
    <div class="kpi-card warn"><div class="label">Não renovaram</div><div class="value mono">${nao.length}</div><div class="sub">${money(perda)} perdidos</div></div></div>
    <div class="head-actions" style="margin-bottom:12px"><button class="btn btn-accent btn-sm" id="ren-new">+ Registrar renovação</button></div>
    ${sec('Próximas renovações',prox)}${sec('Não renovaram',nao)}${ren.length?sec('Renovadas',ren):''}`;
  $('ren-new').onclick=()=>openRenovModal();
  el.querySelectorAll('[data-rset]').forEach(b=>b.onclick=()=>{ const [id,s]=b.dataset.rset.split('|'); const r=ST.renov.find(x=>x.id===id); r.status=s; save.renov(); render(); });
  el.querySelectorAll('[data-redit]').forEach(b=>b.onclick=()=>openRenovModal(b.dataset.redit));
};
function openRenovModal(id){
  const r=id?ST.renov.find(x=>x.id===id):{status:'Próxima'};
  const close=openModal(id?'Editar renovação':'Registrar renovação',
   `<div class="form-grid">${fld('r-nome','Empresa',inp('r-nome',r.empresaNome),true)}${fld('r-st','Situação',sel('r-st',['Próxima','Renovada','Não renovou'],r.status))}${fld('r-data','Data da renovação',inp('r-data',r.dataRenovacao,'date'))}
   ${fld('r-desde','Associada desde',inp('r-desde',r.desde,'date'))}${fld('r-mod','Modalidade',inp('r-mod',r.modalidade,'text','Institucional, Standard, Premium'))}${fld('r-val','Valor (US$)',inp('r-val',r.valor,'number'))}${fld('r-obs','Observações',`<textarea id="r-obs">${esc(r.obs)}</textarea>`,true)}</div>`,
   `${id?'<button class="btn btn-ghost danger" id="r-del">Excluir</button>':''}<button class="btn btn-ghost" id="r-c">Cancelar</button><button class="btn btn-primary" id="r-s">Salvar</button>`);
  $('r-c').onclick=close; if(id) $('r-del').onclick=()=>{ ST.renov=ST.renov.filter(x=>x.id!==id); save.renov(); close(); render(); };
  $('r-s').onclick=()=>{
    const nome=val('r-nome'); if(!nome){ toast('Informe a empresa'); return; }
    const m=matchCompany(nome);
    const o={...r,id:id||uid(),empresaNome:nome,empresaId:r.empresaId||(m?m.id:null),status:val('r-st'),dataRenovacao:val('r-data')||null,desde:val('r-desde')||null,modalidade:val('r-mod'),valor:val('r-val')?+val('r-val'):null,obs:val('r-obs')};
    if(id) ST.renov=ST.renov.map(x=>x.id===id?o:x); else ST.renov.push(o);
    save.renov(); close(); render();
  };
}

/* ===================== NEGOCIAÇÃO ===================== */
RENDER.negociacao = function(el){
  const neg=negociacoes().filter(passD).sort((a,b)=>dCol(b)-dCol(a)||a.nome.localeCompare(b.nome));
  const tgl=`<span class="pill-btn ${ST.negView==='funil'?'active':''}" data-nv="funil">Funil (arraste)</span> <span class="pill-btn ${ST.negView==='lista'?'active':''}" data-nv="lista">Lista</span>`;
  el.innerHTML=`<div class="panel"><div class="panel-head"><h3>Em negociação (${neg.length})</h3><div class="head-actions">${tgl}</div></div>
  <div class="panel-body"><p class="hint" style="margin:0 0 12px">Só entram negócios com proposta enviada ou além, direto do HubSpot (pipelines Associações e Serviços).</p>${ST.negView==='lista'?negTable(neg):funil(neg)}</div></div>`;
  el.querySelectorAll('[data-nv]').forEach(b=>b.onclick=()=>{ ST.negView=b.dataset.nv; render(); });
  bindDeals(el);
  el.querySelectorAll('[data-drag]').forEach(c=>c.addEventListener('dragstart',e=>{ e.dataTransfer.setData('text/plain',c.dataset.drag); c.classList.add('dragging'); }));
  el.querySelectorAll('[data-col]').forEach(col=>{
    col.addEventListener('dragover',e=>{ e.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave',()=>col.classList.remove('over'));
    col.addEventListener('drop',e=>{ e.preventDefault(); const id=e.dataTransfer.getData('text/plain'); if(DEALS.some(d=>d.id===id)){ setOv(id,{col:+col.dataset.col}); toast('Movida para "'+NEG_STAGES[+col.dataset.col]+'" (só no painel)'); render(); } });
  });
};
function negTable(list){
  if(!list.length) return '<div class="empty">Nenhuma negociação com os filtros atuais.</div>';
  return `<div class="tbl-wrap"><table class="wide"><thead><tr><th>Empresa</th><th>Tipo</th><th>Contato</th><th>Etapa</th><th>Valor</th><th>Previsão</th><th>Último contato</th><th>Próxima ação</th><th>Resp.</th><th></th></tr></thead><tbody>
  ${list.map(d=>{ const o=ov(d.id), lc=dLast(d), na=dNext(d), late=na&&na.data&&na.data<todayISO();
   return `<tr class="clickable row-${dCat(d)==='Serviços'?'serv':'assoc'}" data-deal="${d.id}"><td>${dealCell(d)}</td><td>${catTag(dCat(d))}${d.tipo?`<div class="hint">${esc(d.tipo)}</div>`:''}</td><td>${esc(o.contatoPrincipal||'—')}</td><td>${esc(NEG_STAGES[dCol(d)])}</td><td class="mono">${d.valor!=null?money(d.valor):'—'}</td><td>${fmtDate(d.fecha)}</td><td>${lc?fmtDate(lc):'<span class="hint">—</span>'}</td><td>${na?`${esc(na.txt)}<div class="hint ${late?'late':''}">${na.data?fmtDate(na.data):''}</div>`:'<span class="hint">definir</span>'}</td><td>${respBadge(dResp(d))}</td><td><button class="btn btn-ghost btn-sm" data-dedit="${d.id}">Editar</button></td></tr>`; }).join('')}
  </tbody></table></div>`;
}
function funil(list){
  const cols=NEG_STAGES.map((st,i)=>{ const items=list.filter(d=>dCol(d)===i);
    return `<div class="kanban-col" data-col="${i}"><h4><span>${st}</span><span class="mono">${items.length}</span></h4>${items.map(d=>`<div class="kanban-card" draggable="true" data-drag="${d.id}" data-deal="${d.id}"><div class="co-cell">${logo((dCo(d)||{cache:{}}).cache.dm,d.nome,24)}<div class="co-name">${esc(d.nome)}</div></div><div class="kc-meta">${catTag(dCat(d))}<span class="mono">${d.valor!=null?money(d.valor):''}</span></div></div>`).join('')}</div>`; }).join('');
  return `<div class="kanban kanban4">${cols}</div>`;
}

/* ===================== PERDIDOS ===================== */
RENDER.perdidos = function(el){
  const list=perdidos().filter(passD).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  const sem=list.filter(d=>!ov(d.id).motivo).length;
  el.innerHTML=`<div class="panel"><div class="panel-head"><h3>Negócios perdidos (${list.length})</h3><span class="hint">${sem} sem motivo registrado</span></div><div class="panel-body">
  ${list.length?`<div class="tbl-wrap"><table><thead><tr><th>Empresa</th><th>Tipo de oportunidade</th><th>Valor</th><th>Perdido em</th><th>Motivo da perda</th><th>Observação</th><th></th></tr></thead><tbody>
  ${list.map(d=>{ const o=ov(d.id); return `<tr class="clickable" data-deal="${d.id}"><td>${dealCell(d)}</td><td>${catTag(dCat(d))}</td><td class="mono">${d.valor!=null?money(d.valor):'—'}</td><td>${fmtDate(d.fecha)}</td>
   <td><select class="mini-sel" data-motivo="${d.id}"><option value="">— escolher —</option>${MOTIVOS.map(m=>`<option ${m===o.motivo?'selected':''}>${m}</option>`).join('')}</select></td><td class="hint">${esc(o.motivoObs||'')}</td><td><button class="btn btn-ghost btn-sm" data-dedit="${d.id}">Editar</button></td></tr>`; }).join('')}
  </tbody></table></div>`:'<div class="empty">Nenhum negócio perdido.</div>'}</div></div>`;
  bindDeals(el);
  el.querySelectorAll('[data-motivo]').forEach(s=>s.onchange=()=>{ setOv(s.dataset.motivo,{motivo:s.value}); toast('Motivo salvo'); render(); });
};

/* ===================== DEAL: detalhe e edição ===================== */
function openDealDetail(id){
  const d=DEALS.find(x=>x.id===id); if(!d) return; const c=dCo(d), o=ov(id), k=dKind(d), na=dNext(d), r=renovOf(d);
  const row=(a,b)=>b?`<div class="mini-row"><span class="k">${a}</span><span class="v" style="font-weight:400">${b}</span></div>`:'';
  const close=openModal(esc(d.nome),
   `${row('Tipo',catTag(dCat(d))+' '+esc(d.tipo||''))}${row('Situação',{neg:'Em negociação — '+esc(NEG_STAGES[dCol(d)]||''),won:'Negócio fechado',lost:'Negócio perdido',renov:'Próxima renovação',first:'Primeiro contato'}[k])}${row('Valor',d.valor!=null?money(d.valor):'')}${row(k==='neg'?'Previsão de fechamento':k==='lost'?'Perdido em':'Data',fmtDate(d.fecha))}
    ${row('Contato',esc(o.contatoPrincipal||''))}${row('Interesse',esc(o.interesse||''))}${row('Último contato',dLast(d)?fmtDate(dLast(d)):'')}${row('Próxima ação',na?esc(na.txt)+(na.data?' · '+fmtDate(na.data):''):'')}${row('Motivo da perda',esc(o.motivo||''))}${row('Renovação',r?renovTag(r):'')}${row('Responsável',respBadge(dResp(d)))}`,
   `<a class="btn btn-ghost" href="${dealUrl(d)}" target="_blank" rel="noopener">HubSpot ↗</a>${c?'<button class="btn btn-ghost" id="dd-co">Ver empresa</button>':''}<button class="btn btn-ghost" id="dd-task">+ Tarefa</button><button class="btn btn-primary" id="dd-edit">Editar</button>`);
  $('dd-edit').onclick=()=>{ close(); openDealEdit(id); };
  $('dd-task').onclick=()=>{ close(); openTarefaModal({link:c?{k:'emp',id:c.id,label:d.nome}:null}); };
  const b=$('dd-co'); if(b) b.onclick=()=>{ close(); openDrawer(c.id); };
}
function openDealEdit(id){
  const d=DEALS.find(x=>x.id===id); if(!d) return; const o=ov(id), k=dKind(d);
  const close=openModal('Acompanhamento — '+esc(d.nome),
   `<div class="form-grid">${fld('e-resp','Responsável',sel('e-resp',RESPS,dResp(d)))}${fld('e-cat','Tipo',sel('e-cat',CATS,dCat(d)))}${fld('e-contato','Pessoa de contato',inp('e-contato',o.contatoPrincipal))}${fld('e-interesse','Serviço / modalidade de interesse',inp('e-interesse',o.interesse||d.tipo||''),true)}
    ${fld('e-ult','Último contato',inp('e-ult',o.ultContato||d.ult,'date'))}${fld('e-proxd','Data da próxima ação',inp('e-proxd',o.proxData,'date'))}${fld('e-prox','Próxima ação',inp('e-prox',o.proxAcao),true)}
    ${k==='won'?fld('e-dc','Data de conclusão da associação',inp('e-dc',o.dataConclusao||d.fecha,'date')):''}
    ${k==='lost'?fld('e-mot','Motivo da perda',sel('e-mot',MOTIVOS,o.motivo,'— escolher —'))+fld('e-motobs','Observação',inp('e-motobs',o.motivoObs)):''}</div>
    <p class="hint">Tipo, valor e etapa vêm do HubSpot. Para mudar a etapa de verdade, altere lá.</p>`,
   `<button class="btn btn-ghost" id="e-cancel">Cancelar</button><button class="btn btn-primary" id="e-save">Salvar</button>`);
  $('e-cancel').onclick=close;
  $('e-save').onclick=()=>{
    const p={resp:val('e-resp'),cat:val('e-cat'),contatoPrincipal:val('e-contato'),interesse:val('e-interesse'),ultContato:val('e-ult'),proxAcao:val('e-prox'),proxData:val('e-proxd')};
    if($('e-dc')) p.dataConclusao=val('e-dc'); if($('e-mot')){ p.motivo=val('e-mot'); p.motivoObs=val('e-motobs'); }
    setOv(id,p); close(); render();
  };
}

/* ===================== EDIT COMPANY ===================== */
function openCompanyEdit(id){
  const c=co(id), o=ov(id), s=c.cache.s;
  const close=openModal('Acompanhamento — '+esc(nameOf(c)),
   `<div class="form-grid">
    ${fld('e-cat','Tipo de negociação',sel('e-cat',CATS,catOf(c)))}
    ${fld('e-resp','Responsável',sel('e-resp',RESPS,c.responsavel))}
    ${fld('e-contato','Pessoa de contato',inp('e-contato',o.contatoPrincipal))}
    ${fld('e-interesse','Serviço / modalidade de interesse',inp('e-interesse',o.interesse))}
    ${fld('e-stage','Etapa',sel('e-stage',[STAGE_CONTATO].concat(STAGES),stageOf(c)))}
    ${fld('e-ult','Último contato',inp('e-ult',o.ultContato,'date'))}
    ${fld('e-prox','Próxima ação',inp('e-prox',o.proxAcao),true)}
    ${fld('e-proxd','Data da próxima ação',inp('e-proxd',o.proxData,'date'))}
    ${s==='customer'?fld('e-dc','Data de conclusão da associação',inp('e-dc',o.dataConclusao,'date'))+fld('e-ativa','Situação',sel('e-ativa',[['ativa','Ativa'],['concluida','Concluída']],o.assocAtiva||'ativa')):''}
    ${s==='lost'?fld('e-mot','Motivo da perda',sel('e-mot',MOTIVOS,o.motivo,'— escolher —'))+fld('e-motobs','Observação',inp('e-motobs',o.motivoObs)):''}
   </div><p class="hint">Status (Associado, Em negociação, Perdido) vem do negócio no HubSpot e muda quando o HubSpot mudar.</p>`,
   `<button class="btn btn-ghost" id="e-cancel">Cancelar</button><button class="btn btn-primary" id="e-save">Salvar</button>`);
  $('e-cancel').onclick=close;
  $('e-save').onclick=()=>{
    const p={cat:val('e-cat'),contatoPrincipal:val('e-contato'),interesse:val('e-interesse'),ultContato:val('e-ult'),proxAcao:val('e-prox'),proxData:val('e-proxd')};
    if($('e-dc')){ p.dataConclusao=val('e-dc'); p.assocAtiva=val('e-ativa'); }
    if($('e-mot')){ p.motivo=val('e-mot'); p.motivoObs=val('e-motobs'); }
    setOv(id,p); ST.registry[id].responsavel=val('e-resp'); ST.registry[id].stage=val('e-stage'); save.registry();
    close(); render();
  };
}
function openAddCompany(prefill){
  prefill=prefill||{};
  const close=openModal('Adicionar empresa',
   `<p class="hint">Antes de criar, o painel confere se a empresa já existe, para não duplicar. Se ela não estiver no HubSpot, cadastre lá também.</p><div class="form-grid">
    ${fld('a-n','Nome da empresa',inp('a-n',prefill.nome),true)}${fld('a-dm','Site (ex.: empresa.com.br)',inp('a-dm',prefill.dm))}${fld('a-ind','Setor',inp('a-ind',''))}
    ${fld('a-s','Status',sel('a-s',[['opportunity','Em negociação'],['lead','Prospecção']],'opportunity'))}${fld('a-cat','Tipo',sel('a-cat',CATS,prefill.cat||'Associação'))}</div>`,
   `<button class="btn btn-ghost" id="a-cancel">Cancelar</button><button class="btn btn-primary" id="a-save">Cadastrar</button>`);
  $('a-cancel').onclick=close;
  $('a-save').onclick=()=>{
    const n=val('a-n'); if(!n){ toast('Informe o nome'); return; }
    const dup=matchCompany(n);
    if(dup){ close(); toast('Já existe: '+nameOf(dup)); openDrawer(dup.id); return; }
    const id=uid();
    ST.registry[id]={source:'manual',responsavel:'rafaela',stage:'Primeiro contato',cache:{n,ind:val('a-ind'),c:'',s:val('a-s'),nc:0,nd:0,v:0,dm:val('a-dm')||null,url:null},note:null};
    setOv(id,{cat:val('a-cat')}); save.registry(); close(); render();
    if(prefill.onCreated) prefill.onCreated(id);
  };
}

/* ===================== DRAWER ===================== */
function openDrawer(id){
  const c=co(id); if(!c) return;
  const o=ov(id), root=$('drawer-root'), s=c.cache.s;
  const cts=ST.contatos.filter(x=>x.empresaId===id||norm(x.empresa)===norm(nameOf(c)));
  const ms=meetings().filter(a=>a.empresaId===id).sort((a,b)=>b.data.localeCompare(a.data));
  const ts=ST.tarefas.filter(t=>t.link&&t.link.id===id);
  const mou=ST.mous.find(m=>m.empresaId===id);
  root.innerHTML=`<div class="drawer-overlay" id="dov"></div><div class="drawer">
   <div class="drawer-head"><div class="eyebrow">${(()=>{ const dl=dealOfCompany(c); if(dl){ return {neg:'Em negociação',won:'Associado',renov:'Renovação',first:'Primeiro contato'}[dKind(dl)]||'—'; } return APENAS_CONTATO[id]?'Apenas contato':'Sem negociação'; })()} · ${esc(c.cache.ind||'setor não informado')}</div>
   <div class="co-cell">${logo(c.cache.dm,nameOf(c),44)}<h3>${esc(nameOf(c))}</h3></div>
   <div class="hint">${esc(c.cache.c||'')} ${c.cache.dm?'· '+esc(c.cache.dm):''}</div>
   <div class="head-actions" style="margin-top:10px">${c.cache.url?`<a class="btn btn-ghost btn-sm" href="${esc(c.cache.url)}" target="_blank" rel="noopener">HubSpot ↗</a>`:''}<button class="btn btn-ghost btn-sm" id="d-edit">Editar acompanhamento</button><button class="btn btn-accent btn-sm" id="d-task">+ Tarefa</button></div></div>
   <div class="drawer-section"><h4>Resumo</h4>
    <div class="mini-row"><span class="k">Tipo</span><span class="v">${catTag(catOf(c))}</span></div>
    <div class="mini-row"><span class="k">Etapa</span><span class="v">${esc(stageOf(c))}</span></div>
    <div class="mini-row"><span class="k">Responsável</span><span class="v">${esc(c.responsavel)}</span></div>
    <div class="mini-row"><span class="k">Modalidade / valor</span><span class="v">${esc(c.cache.assocType||'—')} ${c.cache.assocValue!=null?'· '+money(c.cache.assocValue):''}</span></div>
    <div class="mini-row"><span class="k">Último contato</span><span class="v">${fmtDate(lastContact(c))}</span></div>
    <div class="mini-row"><span class="k">Próxima ação</span><span class="v">${nextAction(c)?esc(nextAction(c).txt):'—'}</span></div>
    ${o.motivo?`<div class="mini-row"><span class="k">Motivo da perda</span><span class="v">${esc(o.motivo)}</span></div>`:''}
    ${c.note?`<div class="hint" style="margin-top:6px">${esc(c.note)}</div>`:''}</div>
   <div class="drawer-section"><h4>Contatos (${cts.length})</h4>${cts.map(x=>`<div class="ct-line"><b>${esc(x.nome||'—')}</b> <span class="hint">${esc(x.cargo)}</span><div class="hint">${esc(x.email)} ${esc(x.tel)}</div></div>`).join('')||'<div class="hint">Sem contatos na base local. Há '+c.cache.nc+' no HubSpot.</div>'}</div>
   <div class="drawer-section"><h4>Reuniões</h4>${ms.map(a=>`<div class="mini-row clickable-row" data-meet="${a.id}"><span class="k">${fmtDate(a.data)} · ${esc(a.titulo||'')}</span><span class="v" style="font-weight:400">${meetStatus(a)}</span></div>`).join('')||'<div class="hint">Nenhuma reunião ligada a esta empresa.</div>'}<button class="btn btn-ghost btn-sm" id="d-meet" style="margin-top:8px">+ Reunião</button></div>
   <div class="drawer-section"><h4>Tarefas</h4>${tarefaListHtml(ts,true)||'<div class="hint">Sem tarefas ligadas.</div>'}</div>
   <div class="drawer-section"><h4>MOU</h4>${mou?`<div class="mini-row clickable-row" data-mou="${mou.id}"><span class="k">${esc(mou.status)}</span><span class="v">abrir</span></div>`:'<button class="btn btn-ghost btn-sm" id="d-mou">+ Criar pasta de MOU</button>'}</div>
  </div>`;
  const close=()=>{ root.innerHTML=''; };
  $('dov').onclick=close;
  $('d-edit').onclick=()=>{ close(); const dl=dealOfCompany(c); if(dl) openDealEdit(dl.id); else openCompanyEdit(id); };
  $('d-task').onclick=()=>{ close(); openTarefaModal({link:{k:'emp',id,label:nameOf(c)}}); };
  $('d-meet').onclick=()=>{ close(); openMeetingModal(id); };
  const dm=$('d-mou'); if(dm) dm.onclick=()=>{ close(); openMouModal(null,id); };
  root.querySelectorAll('[data-meet]').forEach(r=>r.onclick=()=>{ const a=meetings().find(x=>x.id===r.dataset.meet); if(a){ close(); openMeetingDetail(a); } });
  root.querySelectorAll('[data-mou]').forEach(r=>r.onclick=()=>{ close(); openMouDetail(r.dataset.mou); });
  wireTarefaList(root,close);
}

/* ===================== CONTATOS ===================== */
function semNegociacao(){
  const live=new Set(DEALS.filter(d=>['neg','won','renov'].includes(dKind(d))).map(d=>ckey(d.nome)));
  return companies().filter(c=>(c.cache.s==='lead'||APENAS_CONTATO[c.id]) && !live.has(ckey(nameOf(c)))).sort((a,b)=>(APENAS_CONTATO[b.id]?1:0)-(APENAS_CONTATO[a.id]?1:0)||nameOf(a).localeCompare(nameOf(b)));
}
RENDER.contatos = function(el){
  const q=norm(ST.filters.busca), PAGE=40;
  const tgl=`<span class="pill-btn ${ST.ctView==='pessoas'?'active':''}" data-cv2="pessoas">Pessoas</span> <span class="pill-btn ${ST.ctView==='empresas'?'active':''}" data-cv2="empresas">Empresas sem negociação</span>`;
  let body='', title='';
  if(ST.ctView==='empresas'){
    const list=semNegociacao().filter(c=>!q||norm(nameOf(c)).includes(q));
    title=`Empresas sem negociação (${list.length})`;
    body=`<p class="hint" style="margin:0 0 10px">Prospecção e "apenas contato": relacionamento sem proposta enviada. Quando virar proposta no HubSpot, a empresa passa para Em negociação.</p>
    <div class="tbl-wrap"><table><thead><tr><th>Empresa</th><th>Situação</th><th>Setor</th><th>País</th><th>Contatos</th><th>Resp.</th><th></th></tr></thead><tbody>
    ${list.map(c=>`<tr class="clickable" data-open="${c.id}"><td>${coCell(c)}</td><td><span class="tag ${APENAS_CONTATO[c.id]?'tag-navy':'tag-lead'}">${APENAS_CONTATO[c.id]?'Apenas contato':'Prospecção'}</span></td><td>${esc(c.cache.ind||'—')}</td><td>${esc(c.cache.c||'—')}</td><td>${c.cache.nc}</td><td>${respBadge(c.responsavel)}</td><td>${c.cache.url?`<a class="lnk" href="${esc(c.cache.url)}" target="_blank" rel="noopener">HubSpot ↗</a>`:''}</td></tr>`).join('')||'<tr><td colspan="7" class="empty">Nenhuma empresa.</td></tr>'}
    </tbody></table></div>`;
  } else {
    let list=ST.contatos.filter(x=>!q||norm(x.empresa+' '+x.nome+' '+x.email+' '+x.cargo).includes(q)).sort((a,b)=>a.empresa.localeCompare(b.empresa)||a.nome.localeCompare(b.nome));
    const pages=Math.max(1,Math.ceil(list.length/PAGE)); if(ST.ctPage>=pages) ST.ctPage=0;
    const view=list.slice(ST.ctPage*PAGE,ST.ctPage*PAGE+PAGE);
    title=`Contatos (${list.length})`;
    body=`<div class="tbl-wrap"><table><thead><tr><th>Empresa</th><th>Nome</th><th>Cargo</th><th>E-mail</th><th>Telefone</th><th>Origem</th></tr></thead><tbody>
    ${view.map(x=>`<tr><td><div class="co-cell">${logo(x.dm,x.empresa,28)}<div>${x.empresaId?`<a href="#" class="lnk" data-open="${x.empresaId}">${esc(x.empresa)}</a>`:esc(x.empresa)}</div></div></td><td><b>${esc(x.nome||'—')}</b></td><td>${esc(x.cargo)}</td><td>${x.email?`<a class="lnk" href="mailto:${esc(x.email)}">${esc(x.email)}</a>`:''}</td><td>${esc(x.tel)}</td><td>${esc(x.origem)}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">Nenhum contato encontrado.</td></tr>'}
    </tbody></table></div>
    <div class="pager"><button class="btn btn-ghost btn-sm" id="pg-p" ${ST.ctPage===0?'disabled':''}>‹</button><span class="hint">página ${ST.ctPage+1} de ${pages}</span><button class="btn btn-ghost btn-sm" id="pg-n" ${ST.ctPage>=pages-1?'disabled':''}>›</button></div>
    <p class="hint">${ST.contatos.length} contatos das empresas acompanhadas, trazidos do HubSpot e do Outlook. Peça ao Claude para atualizar a base.</p>`;
  }
  el.innerHTML=`<div class="panel"><div class="panel-head"><h3>${title}</h3><div class="head-actions">${tgl}</div></div><div class="panel-body">${body}</div></div>`;
  el.querySelectorAll('[data-cv2]').forEach(b=>b.onclick=()=>{ ST.ctView=b.dataset.cv2; render(); });
  const pp=$('pg-p'), pn=$('pg-n'); if(pp) pp.onclick=()=>{ ST.ctPage--; render(); }; if(pn) pn.onclick=()=>{ ST.ctPage++; render(); };
  el.querySelectorAll('a[data-open]').forEach(a=>a.onclick=e=>{ e.preventDefault(); openDrawer(a.dataset.open); });
  bindOpen(el);
};

/* ===================== EVENTOS ===================== */
function eventoCard(ev, done){
  const line=(k,v)=>v?`<div class="ev-line"><span class="ev-k">${k}</span>${esc(v)}</div>`:'';
  const quando=[ev.data?'':ev.dataPrevista, ev.horario, ev.local].filter(Boolean).join(' · ');
  return `<div class="evento-card ${done?'done':''}" data-evdet="${ev.id}">${ev.flyer?`<img class="ev-flyer" src="${esc(ev.flyer)}" alt="" loading="lazy">`:''}
   <div class="ev-date mono">${ev.data?fmtDM(ev.data):'Nov'}<span class="ev-year">${ev.data?ev.data.slice(0,4):'a definir'}</span></div>
   <div class="ev-name">${esc(ev.nome)}</div>${quando?`<div class="ev-line">${esc(quando)}</div>`:''}
   ${ev.programacao?`<div class="ev-line"><span class="ev-k">Programação</span>${ev.programacao.length} itens · clique para ver</div>`:''}${line('Objetivo',ev.objetivo)}${line('Formato',ev.formato)}${line('Organização / parceiros',ev.parceiros)}${line('Temas',ev.temas)}${line('Programação',ev.painel)}
   ${line('Responsáveis',ev.responsaveis)}${line('Status da organização',ev.statusOrg)}${line('Pendências',ev.pendencias)}
   ${line('Empresas participantes',ev.empresasParticipantes)}${line('Participantes',ev.numParticipantes)}${line('Descrição',ev.descricao)}${line('Resultados',ev.resultado)}${line('Observações',ev.observacoes)}
   ${ev.tag?`<div class="ev-tag"><span class="tag ${ev.tag==='Em definição'?'tag-navy':'tag-ok'}">${esc(ev.tag)}</span></div>`:''}</div>`;
}
RENDER.eventos = function(el){
  const p=evProx().filter(e=>inPeriod(e.data)||!e.data), r=evReal().filter(e=>inPeriod(e.data));
  el.innerHTML=`<div class="panel"><div class="panel-head"><h3>Próximos eventos (${p.length})</h3><button class="btn btn-accent btn-sm" id="ev-new">+ Novo evento</button></div><div class="panel-body">${p.length?`<div class="evento-grid">${p.map(e=>eventoCard(e,false)).join('')}</div>`:'<div class="empty">Nenhum evento agendado.</div>'}</div></div>
  <div class="panel"><div class="panel-head"><h3>Eventos realizados (${r.length})</h3></div><div class="panel-body">${r.length?`<div class="evento-grid">${r.map(e=>eventoCard(e,true)).join('')}</div>`:'<div class="empty">Nenhum evento realizado no período.</div>'}</div></div>`;
  $('ev-new').onclick=()=>openEventoModal();
  el.querySelectorAll('[data-evdet]').forEach(c=>c.onclick=()=>openEventoDetail(c.dataset.evdet));
};
function openEventoDetail(id){
  const e=ST.eventos.find(x=>x.id===id); if(!e) return;
  const row=(k,v)=>v?`<div class="mini-row"><span class="k">${k}</span><span class="v" style="font-weight:400">${esc(v)}</span></div>`:'';
  const done=evRealizado(e);
  const close=openModal(esc(e.nome),
   `<div class="ev-detail">${e.flyer?`<img class="ev-flyer-big" src="${esc(e.flyer)}" alt="Flyer">`:''}<div class="ev-detail-main">
    <div class="ev-badges"><span class="tag ${done?'tag-ok':'tag-soon'}">${done?'Realizado':(e.data?daysTo(e.data)+' dias':'Data a definir')}</span>${e.data?`<span class="mono">${fmtDate(e.data)}</span>`:''}</div>
    ${row('Horário',e.horario)}${row('Local',e.local)}${row('Formato',e.formato)}${row('Organização',e.parceiros)}${row('Objetivo',e.objetivo)}${row('Responsáveis',e.responsaveis)}${row('Status da organização',e.statusOrg)}${row('Pendências',e.pendencias)}${row('Empresas participantes',e.empresasParticipantes)}${row('Participantes',e.numParticipantes)}${row('Descrição',e.descricao)}${row('Resultados',e.resultado)}${row('Observações',e.observacoes)}
    ${e.programacao?`<h4 class="sub-h">Programação</h4><div class="timeline">${e.programacao.map(p=>`<div class="tl-row"><div class="tl-h mono">${esc(p.h)}</div><div><b>${esc(p.t)}</b>${p.s?`<div class="hint">${esc(p.s)}</div>`:''}</div></div>`).join('')}</div>`:''}
    </div></div>`,
   `<button class="btn btn-ghost" id="ed-task">+ Tarefa</button><button class="btn btn-ghost" id="ed-edit">Editar</button><button class="btn btn-primary" id="ed-ok">Fechar</button>`,{wide:true});
  $('ed-ok').onclick=close; $('ed-edit').onclick=()=>{ close(); openEventoModal(id); };
  $('ed-task').onclick=()=>{ close(); openTarefaModal({link:{k:'eve',id:e.id,label:e.nome}}); };
}
function openEventoModal(id){
  const e=id?ST.eventos.find(x=>x.id===id):{}, v=k=>e[k]||'';
  const close=openModal(id?'Editar evento':'Novo evento',
   `<div class="form-grid">${fld('v-nome','Nome',inp('v-nome',v('nome')),true)}${fld('v-data','Data',inp('v-data',v('data'),'date'))}${fld('v-hor','Horário',inp('v-hor',v('horario'),'text','10h às 13h'))}${fld('v-loc','Local',inp('v-loc',v('local')))}${fld('v-for','Formato',inp('v-for',v('formato')))}
   ${fld('v-obj','Objetivo',inp('v-obj',v('objetivo')),true)}${fld('v-par','Organização / parceiros',inp('v-par',v('parceiros')),true)}${fld('v-resp','Responsáveis',inp('v-resp',v('responsaveis')))}${fld('v-org','Status da organização',inp('v-org',v('statusOrg'),'text','Ex.: sala reservada, convites pendentes'))}
   ${fld('v-pen','Pendências',`<textarea id="v-pen">${esc(v('pendencias'))}</textarea>`,true)}${fld('v-emp','Empresas participantes',inp('v-emp',v('empresasParticipantes')),true)}${fld('v-desc','Descrição',`<textarea id="v-desc">${esc(v('descricao'))}</textarea>`,true)}${fld('v-res','Resultados',`<textarea id="v-res">${esc(v('resultado'))}</textarea>`,true)}</div>`,
   `${id&&!e.seed?'<button class="btn btn-ghost danger" id="v-del">Excluir</button>':''}<button class="btn btn-ghost" id="v-c">Cancelar</button><button class="btn btn-primary" id="v-s">Salvar</button>`,{wide:true});
  $('v-c').onclick=close;
  if(id&&$('v-del')) $('v-del').onclick=()=>{ ST.eventos=ST.eventos.filter(x=>x.id!==id); save.eventos(); close(); render(); };
  $('v-s').onclick=()=>{
    const o={...e,id:id||uid(),nome:val('v-nome')||'Evento sem nome',data:val('v-data')||null,horario:val('v-hor'),local:val('v-loc'),formato:val('v-for'),objetivo:val('v-obj'),parceiros:val('v-par'),responsaveis:val('v-resp'),statusOrg:val('v-org'),pendencias:val('v-pen'),empresasParticipantes:val('v-emp'),descricao:val('v-desc'),resultado:val('v-res')};
    if(e.seed){ const d={...o}; delete d.seed; ST.over['ev:'+id]=d; save.over(); ST.eventos=ST.eventos.map(x=>x.id===id?{...o,seed:true}:x); close(); render(); return; }
    if(id) ST.eventos=ST.eventos.map(x=>x.id===id?o:x); else ST.eventos.push(o);
    save.eventos(); close(); render();
  };
}

/* ===================== CALENDÁRIO ===================== */
function calNav(n){
  const d=parseDate(CAL.ref||todayISO());
  if(CAL.view==='mes'){ d.setDate(1); d.setMonth(d.getMonth()+n); } else d.setDate(d.getDate()+(CAL.view==='semana'?7*n:n));
  CAL.ref=iso(d); CAL.sel=null; render();
}
RENDER.calendario = function(el){
  if(!CAL.ref) CAL.ref=todayISO();
  const all=meetings(), ref=parseDate(CAL.ref);
  const label = CAL.view==='mes'?`${MESES[ref.getMonth()]} ${ref.getFullYear()}` : CAL.view==='semana'? (()=>{ const s=weekStart(CAL.ref); return `${fmtDM(s)} – ${fmtDM(addDays(s,6))}`; })() : fmtDate(CAL.ref)+' · '+DOW[ref.getDay()];
  el.innerHTML=`<div class="panel"><div class="panel-head"><h3>Calendário</h3><div class="head-actions">
   ${['mes','semana','dia'].map(v=>`<span class="pill-btn ${CAL.view===v?'active':''}" data-cv="${v}">${{mes:'Mês',semana:'Semana',dia:'Dia'}[v]}</span>`).join('')}<button class="btn btn-accent btn-sm" id="cal-new">+ Reunião</button></div></div>
   <div class="panel-body"><div class="cal-head"><button class="btn btn-ghost btn-sm" id="cp">‹</button><h4>${label}</h4><button class="btn btn-ghost btn-sm" id="cn">›</button><button class="btn btn-ghost btn-sm" id="ch">Hoje</button></div>
   ${CAL.view==='mes'?calMonth(all):CAL.view==='semana'?calWeek(all):calDay(all)}
   <div class="cal-legend"><span class="cal-ev agendada">agendada</span><span class="cal-ev realizada">realizada</span><span class="cal-ev ext">evento externo</span><span class="hint">Fonte: agenda Outlook/Teams, atualizada por pedido ao Claude.</span></div>
   ${CAL.sel&&CAL.view==='mes'?calDayDetail(all,CAL.sel):''}</div></div>`;
  el.querySelectorAll('[data-cv]').forEach(b=>b.onclick=()=>{ CAL.view=b.dataset.cv; render(); });
  $('cp').onclick=()=>calNav(-1); $('cn').onclick=()=>calNav(1); $('ch').onclick=()=>{ CAL.ref=todayISO(); CAL.sel=todayISO(); render(); };
  $('cal-new').onclick=()=>openMeetingModal(null,CAL.sel||null);
  el.querySelectorAll('[data-day]').forEach(c=>c.onclick=()=>{ CAL.sel=c.dataset.day; if(CAL.view!=='mes') CAL.ref=c.dataset.day; render(); });
  el.querySelectorAll('[data-meet]').forEach(c=>c.onclick=e=>{ e.stopPropagation(); const a=all.find(x=>x.id===c.dataset.meet); if(a) openMeetingDetail(a); });
};
function weekStart(d){ const x=parseDate(d); x.setDate(x.getDate()-x.getDay()); return iso(x); }
function evChip(a){ return `<div class="cal-ev ${meetStatus(a)} ${a.tipo==='evento externo'?'ext':''}" data-meet="${a.id}" title="${esc(a.titulo||a.empresaNome)}">${a.horario?`<b>${a.horario}</b> `:''}${esc(a.titulo||a.empresaNome)}</div>`; }
function calMonth(all){
  const ref=parseDate(CAL.ref), y=ref.getFullYear(), m=ref.getMonth(), p=n=>String(n).padStart(2,'0'), today=todayISO();
  const start=new Date(y,m,1).getDay(), days=new Date(y,m+1,0).getDate(); let cells='';
  for(let i=0;i<start;i++) cells+='<div class="cal-cell empty"></div>';
  for(let d=1;d<=days;d++){ const k=`${y}-${p(m+1)}-${p(d)}`, ms=meetOn(all,k);
    cells+=`<div class="cal-cell ${k===today?'today':''} ${k===CAL.sel?'sel':''}" data-day="${k}"><div class="cal-d">${d}</div>${ms.slice(0,3).map(evChip).join('')}${ms.length>3?`<div class="cal-more">+${ms.length-3}</div>`:''}</div>`; }
  return `<div class="cal-grid">${DOW.map(d=>`<div class="cal-dow">${d}</div>`).join('')}${cells}</div>`;
}
function calWeek(all){
  const s=weekStart(CAL.ref), today=todayISO();
  return `<div class="cal-week">${[0,1,2,3,4,5,6].map(i=>{ const k=addDays(s,i), ms=meetOn(all,k);
    return `<div class="cal-wcol ${k===today?'today':''}" data-day="${k}"><div class="cal-wh"><span>${DOW[i]}</span><b>${k.slice(8)}</b></div>${ms.map(evChip).join('')||'<div class="hint">—</div>'}</div>`; }).join('')}</div>`;
}
function calDay(all){ return calDayDetail(all,CAL.ref,true); }
function calDayDetail(all,d,full){
  const ms=meetOn(all,d);
  return `<div class="cal-day-detail"><h4>${fmtDate(d)} · ${DOW[parseDate(d).getDay()]}</h4>${ms.map(a=>`<div class="day-item clickable-row" data-meet="${a.id}"><div class="mono">${a.horario||'—'}${a.horarioFim?'–'+a.horarioFim:''}</div><div><b>${esc(a.titulo||a.empresaNome)}</b><div class="hint">${esc([a.empresaNome,meetKind(a),a.local].filter(Boolean).join(' · '))}${a.responsavel?' · '+({pedro:'Pedro',rafaela:'Rafaela',ambos:'Pedro + Rafaela'}[a.responsavel]||''):''}${a.linkTeams?' · <a href="'+esc(a.linkTeams)+'" target="_blank" rel="noopener" class="lnk">Teams</a>':''}</div>${a.notas?`<div class="hint">${esc(a.notas)}</div>`:''}</div><span class="tag ${meetStatus(a)==='agendada'?'tag-soon':'tag-lead'}">${meetStatus(a)}</span></div>`).join('')||'<div class="hint">Nada neste dia.</div>'}</div>`;
}
function openMeetingDetail(a){
  const row=(k,v)=>v?`<div class="mini-row"><span class="k">${k}</span><span class="v" style="font-weight:400">${v}</span></div>`:'';
  const close=openModal(esc(a.titulo||a.empresaNome),
   `${row('Empresa',esc(a.empresaNome))}${row('Quando',esc(fmtDate(a.data)+(a.dataFim?' – '+fmtDate(a.dataFim):'')+' '+(a.horario||'')+(a.horarioFim?'–'+a.horarioFim:'')))}${row('Local',esc(a.local))}${row('Tipo',esc(meetKind(a)))}${row('Responsável',a.responsavel?respBadge(a.responsavel):'')}${row('Status',meetStatus(a))}${row('Participantes',esc(a.participantes))}${a.linkTeams?row('Teams',`<a class="lnk" href="${esc(a.linkTeams)}" target="_blank" rel="noopener">Entrar na reunião</a>`):''}${row('Notas',esc(a.notas))}
    <h4 class="sub-h">Completar registro</h4><div class="form-grid">${fld('d-cat','Tipo',sel('d-cat',['Institucional','Comercial','Evento'],meetKind(a)))}${fld('d-part','Participantes',inp('d-part',a.participantes))}${fld('d-link','Link do Teams',inp('d-link',a.linkTeams))}${fld('d-resp','Responsável',sel('d-resp',RESPS,a.responsavel||'pedro'))}${fld('d-st','Situação',sel('d-st',[['','Automática'],['realizada','Realizada'],['agendada','Agendada']],a.forceStatus||''))}${fld('d-notas','Notas / resultado',`<textarea id="d-notas">${esc(a.notas)}</textarea>`,true)}</div>`,
   `${a.empresaId&&ST.registry[a.empresaId]?'<button class="btn btn-ghost" id="d-co">Abrir empresa</button>':''}${a.seed?'':'<button class="btn btn-ghost danger" id="d-del">Excluir</button>'}<button class="btn btn-ghost" id="d-task2">+ Tarefa</button><button class="btn btn-primary" id="d-save">Salvar</button>`);
  $('d-save').onclick=()=>{ ST.meetover[a.id]={categoria:val('d-cat'),participantes:val('d-part'),linkTeams:val('d-link'),notas:val('d-notas'),forceStatus:val('d-st'),responsavel:val('d-resp')}; save.meetover(); close(); render(); };
  $('d-task2').onclick=()=>{ close(); openTarefaModal({link:{k:'reu',id:a.id,label:a.titulo||a.empresaNome}}); };
  const dc=$('d-co'); if(dc) dc.onclick=()=>{ close(); openDrawer(a.empresaId); };
  const dd=$('d-del'); if(dd) dd.onclick=()=>{ ST.activities=ST.activities.filter(x=>x.id!==a.id); save.activities(); close(); render(); };
}
function openMeetingModal(companyId, date){
  const close=openModal('Nova reunião',
   `<div class="form-grid">${fld('m-emp','Empresa (cadastrada)',sel('m-emp',companyOptions(),companyId,'— sem empresa / outra —'))}${fld('m-tit','Título',inp('m-tit','','text','Ex.: Reunião de alinhamento'))}
   ${fld('m-data','Data',inp('m-data',date||todayISO(),'date'))}${fld('m-hor','Horário',inp('m-hor','','time'))}${fld('m-cat','Tipo',sel('m-cat',['Comercial','Institucional','Evento'],'Comercial'))}${fld('m-loc','Local',inp('m-loc','','text','Teams, escritório...'))}
   ${fld('m-link','Link do Teams',inp('m-link'))}${fld('m-resp','Responsável',sel('m-resp',RESPS,'pedro'))}${fld('m-part','Participantes',inp('m-part'),true)}${fld('m-st','Situação',sel('m-st',[['agendado','Agendada'],['realizada','Realizada']],'agendado'))}${fld('m-notas','Notas',`<textarea id="m-notas"></textarea>`,true)}</div>
   <p class="hint">Reuniões criadas no Outlook/Teams entram aqui quando o Claude atualizar a agenda.</p>`,
   `<button class="btn btn-ghost" id="m-c">Cancelar</button><button class="btn btn-primary" id="m-s">Salvar</button>`,{wide:true});
  $('m-c').onclick=close;
  $('m-s').onclick=()=>{
    const emp=val('m-emp'), nome=emp?nameOf(co(emp)):'';
    if(!val('m-tit') && !emp){ toast('Informe título ou empresa'); return; }
    ST.activities.push({id:uid(),tipo:'reuniao',empresaId:emp||null,empresaNome:nome,titulo:val('m-tit')||('Reunião: '+nome),data:val('m-data'),horario:val('m-hor'),local:val('m-loc'),categoria:val('m-cat'),linkTeams:val('m-link'),participantes:val('m-part'),notas:val('m-notas'),responsavel:val('m-resp'),status:val('m-st')});
    save.activities(); close(); render();
  };
}

/* ===================== TAREFAS ===================== */
function wireQuick(el){
  const add=()=>{ const i=el.querySelector('#q-task'); if(!i||!i.value.trim()) return; ST.tarefas.push({id:uid(),titulo:i.value.trim(),prazo:todayISO(),prio:'media',done:false,doneAt:null,criada:todayISO(),link:null}); save.tarefas(); render(); setTimeout(()=>{ const n=document.querySelector('#q-task'); if(n) n.focus(); },30); };
  const b=el.querySelector('#q-add'); if(b) b.onclick=add;
  const i=el.querySelector('#q-task'); if(i) i.addEventListener('keydown',e=>{ if(e.key==='Enter') add(); });
}
function tarefaSort(a,b){ const pr={alta:0,media:1,baixa:2}; const ka=a.prazo||'9999', kb=b.prazo||'9999'; return ka.localeCompare(kb)||(pr[a.prio]-pr[b.prio]); }
function tarefaRow(t,compact){
  const od=tarefaOverdue(t), n=od?-daysTo(t.prazo):0;
  return `<div class="task ${t.done?'done':''} ${od?'late':''}"><input type="checkbox" data-tk="${t.id}" ${t.done?'checked':''}><div class="task-main"><div class="task-t">${esc(t.titulo)}</div>
   <div class="task-m">${od?`<span class="tag tag-late">atrasada ${n}d</span>`:t.prazo===todayISO()&&!t.done?'<span class="tag tag-soon">hoje</span>':''}${t.prazo?`<span class="hint">prazo ${fmtDate(t.prazo)}</span>`:'<span class="hint">sem prazo</span>'}
   <span class="prio prio-${t.prio}">${{alta:'alta',media:'média',baixa:'baixa'}[t.prio]}</span>${t.link?`<a href="#" class="lnk" data-tl="${t.link.k}|${t.link.id}">${esc(t.link.label)}</a>`:''}${t.done&&t.doneAt?`<span class="hint">concluída em ${fmtDate(t.doneAt)}</span>`:''}</div></div>
   ${compact?'':`<button class="icon-btn" data-tdel="${t.id}" title="Excluir">✕</button>`}</div>`;
}
function tarefaListHtml(list,compact){ return list.map(t=>tarefaRow(t,compact)).join(''); }
function wireTarefaList(root,after){
  root.querySelectorAll('[data-tk]').forEach(cb=>cb.onchange=()=>{ const t=ST.tarefas.find(x=>x.id===cb.dataset.tk); if(!t) return; t.done=cb.checked; t.doneAt=cb.checked?todayISO():null; save.tarefas(); render(); });
  root.querySelectorAll('[data-tdel]').forEach(b=>b.onclick=()=>{ ST.tarefas=ST.tarefas.filter(x=>x.id!==b.dataset.tdel); save.tarefas(); render(); });
  root.querySelectorAll('[data-tl]').forEach(a=>a.onclick=e=>{ e.preventDefault(); const [k,id]=a.dataset.tl.split('|'); if(after) after();
    if(k==='emp') openDrawer(id); else if(k==='reu'){ const m=meetings().find(x=>x.id===id); if(m) openMeetingDetail(m); } else go('eventos'); });
  root.querySelectorAll('[data-meet]').forEach(c=>{ if(!c.onclick) c.onclick=()=>{ const a=meetings().find(x=>x.id===c.dataset.meet); if(a) openMeetingDetail(a); }; });
  root.querySelectorAll('[data-open]').forEach(r=>{ if(!r.onclick) r.onclick=()=>openDrawer(r.dataset.open); });
}
RENDER.tarefas = function(el){
  const pend=ST.tarefas.filter(t=>!t.done).filter(t=>inPeriod(t.prazo)||tarefaOverdue(t)).sort(tarefaSort);
  const done=ST.tarefas.filter(t=>t.done).sort((a,b)=>(b.doneAt||'').localeCompare(a.doneAt||''));
  const late=pend.filter(tarefaOverdue), hoje=pend.filter(t=>!tarefaOverdue(t)&&(!t.prazo||t.prazo===todayISO())), prox=pend.filter(t=>t.prazo&&t.prazo>todayISO());
  const grp=(t,l,arr,cls)=>arr.length?`<div class="task-group ${cls||''}"><h4>${t} <span class="mono">${arr.length}</span></h4>${tarefaListHtml(arr)}</div>`:'';
  el.innerHTML=`<div class="quick qpanel"><input type="text" id="q-task" placeholder="Nova tarefa para hoje… (Enter para adicionar)"><button class="btn btn-accent" id="q-add">Adicionar</button></div><div class="panel"><div class="panel-head"><h3>Tarefas</h3><div class="head-actions"><span class="pill-btn ${ST.tarefaView==='pendentes'?'active':''}" data-tv="pendentes">Pendentes (${ST.tarefas.filter(t=>!t.done).length})</span><span class="pill-btn ${ST.tarefaView==='concluidas'?'active':''}" data-tv="concluidas">Concluídas (${done.length})</span><button class="btn btn-accent btn-sm" id="t-new">+ Tarefa</button></div></div><div class="panel-body">
  ${ST.tarefaView==='pendentes'?(grp('Atrasadas','',late,'g-late')+grp('Hoje / sem prazo','',hoje)+grp('Próximas','',prox)||'<div class="empty">Nenhuma tarefa pendente. 🎉</div>'):(done.length?tarefaListHtml(done):'<div class="empty">Ainda não há tarefas concluídas.</div>')}
  </div></div>`;
  el.querySelectorAll('[data-tv]').forEach(b=>b.onclick=()=>{ ST.tarefaView=b.dataset.tv; render(); });
  $('t-new').onclick=()=>openTarefaModal();
  wireQuick(el); wireTarefaList(el);
};
function openTarefaModal(pre){
  pre=pre||{};
  const links=[['','— sem vínculo —']].concat(companyOptions().map(([i,n])=>['emp|'+i+'|'+n,'Empresa: '+n]),
    meetings().filter(a=>a.data>=addDays(todayISO(),-14)).sort((a,b)=>a.data.localeCompare(b.data)).map(a=>['reu|'+a.id+'|'+(a.titulo||a.empresaNome),'Reunião: '+fmtDM(a.data)+' '+(a.titulo||a.empresaNome)]),
    ST.eventos.map(e=>['eve|'+e.id+'|'+e.nome,'Evento: '+e.nome]));
  const cur = pre.link ? links.find(l=>l[0].startsWith(pre.link.k+'|'+pre.link.id+'|')) : null;
  const close=openModal('Nova tarefa',
   `<div class="form-grid">${fld('t-tit','Tarefa',inp('t-tit','','text','O que precisa ser feito?'),true)}${fld('t-prazo','Prazo',inp('t-prazo',pre.prazo||todayISO(),'date'))}${fld('t-prio','Prioridade',sel('t-prio',[['alta','Alta'],['media','Média'],['baixa','Baixa']],'media'))}${fld('t-link','Vincular a',sel('t-link',links,cur?cur[0]:''),true)}</div>`,
   `<button class="btn btn-ghost" id="t-c">Cancelar</button><button class="btn btn-primary" id="t-s">Adicionar</button>`);
  $('t-c').onclick=close; setTimeout(()=>{ const i=$('t-tit'); if(i) i.focus(); },30);
  $('t-s').onclick=()=>{
    if(!val('t-tit')){ toast('Descreva a tarefa'); return; }
    const l=val('t-link').split('|');
    ST.tarefas.push({id:uid(),titulo:val('t-tit'),prazo:val('t-prazo')||null,prio:val('t-prio'),done:false,doneAt:null,criada:todayISO(),link:l[0]?{k:l[0],id:l[1],label:l.slice(2).join('|')}:null});
    save.tarefas(); close(); render();
  };
}

/* ===================== INTERESSADAS ===================== */
const INT_STATUS=['Nova','Em contato','Convertida','Descartada'];
RENDER.interessadas = function(el){
  let list=ST.interessadas.filter(i=>inPeriod(i.data)).filter(i=>!ST.filters.busca||norm(i.empresa).includes(norm(ST.filters.busca)));
  if(ST.intFilter) list=list.filter(i=>i.status===ST.intFilter);
  list.sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  el.innerHTML=`<div class="panel"><div class="panel-head"><h3>Empresas interessadas (${list.length})</h3><div class="head-actions">
   <select id="if-st" class="mini-sel"><option value="">Todos os status</option>${INT_STATUS.map(s=>`<option ${s===ST.intFilter?'selected':''}>${s}</option>`).join('')}</select><button class="btn btn-accent btn-sm" id="if-new">+ Registrar interesse</button></div></div><div class="panel-body">
  ${list.length?`<div class="tbl-wrap"><table><thead><tr><th>Empresa</th><th>Contato</th><th>Recebido em</th><th>Interesse</th><th>Pedido</th><th>Status</th><th>Resp.</th><th></th></tr></thead><tbody>
  ${list.map(i=>{ const c=i.empresaId?co(i.empresaId):null; return `<tr><td><div class="co-cell">${logo(c?c.cache.dm:i.dm,i.empresa,28)}<div><b>${esc(i.empresa)}</b>${c?`<div class="hint">já na base</div>`:''}</div></div></td><td>${esc(i.contato)}<div class="hint">${esc(i.email)}</div></td><td>${fmtDate(i.data)}</td><td>${catTag(i.tipo==='Serviços'?'Serviços':'Associação')}</td><td class="hint">${esc(i.descricao)}</td>
   <td><select class="mini-sel" data-ist="${i.id}">${INT_STATUS.map(s=>`<option ${s===i.status?'selected':''}>${s}</option>`).join('')}</select></td><td>${respBadge(i.resp)}</td>
   <td>${i.status==='Convertida'?'':`<button class="btn btn-ghost btn-sm" data-conv="${i.id}">Converter</button>`} ${i.seed?'':`<button class="icon-btn" data-idel="${i.id}">✕</button>`}</td></tr>`; }).join('')}</tbody></table></div>`
  :'<div class="empty">Nenhum interesse registrado. Quando alguém preencher o formulário, registre aqui ou peça ao Claude para trazer do HubSpot.</div>'}</div></div>`;
  $('if-st').onchange=e=>{ ST.intFilter=e.target.value; render(); }; $('if-new').onclick=()=>openInteresseModal();
  el.querySelectorAll('[data-ist]').forEach(s=>s.onchange=()=>{ const i=ST.interessadas.find(x=>x.id===s.dataset.ist); i.status=s.value; save.interessadas(); render(); });
  el.querySelectorAll('[data-idel]').forEach(b=>b.onclick=()=>{ ST.interessadas=ST.interessadas.filter(x=>x.id!==b.dataset.idel); save.interessadas(); render(); });
  el.querySelectorAll('[data-conv]').forEach(b=>b.onclick=()=>convertInteresse(b.dataset.conv));
};
function openInteresseModal(){
  const close=openModal('Registrar interesse',
   `<div class="form-grid">${fld('i-emp','Empresa',inp('i-emp'),true)}${fld('i-con','Contato',inp('i-con'))}${fld('i-mail','E-mail',inp('i-mail','','email'))}${fld('i-data','Data recebido',inp('i-data',todayISO(),'date'))}${fld('i-tipo','Tipo de interesse',sel('i-tipo',['Associação','Serviços','Evento','Outro'],'Associação'))}
   ${fld('i-resp','Responsável',sel('i-resp',RESPS,'pedro'))}${fld('i-desc','Descrição do pedido',`<textarea id="i-desc"></textarea>`,true)}</div>`,
   `<button class="btn btn-ghost" id="i-c">Cancelar</button><button class="btn btn-primary" id="i-s">Salvar</button>`);
  $('i-c').onclick=close;
  $('i-s').onclick=()=>{
    if(!val('i-emp')){ toast('Informe a empresa'); return; }
    const m=matchCompany(val('i-emp'));
    ST.interessadas.push({id:uid(),empresa:val('i-emp'),empresaId:m?m.id:null,contato:val('i-con'),email:val('i-mail'),data:val('i-data'),tipo:val('i-tipo'),descricao:val('i-desc'),status:'Nova',resp:val('i-resp')});
    save.interessadas(); close(); render(); if(m) toast('Empresa já existe na base: '+nameOf(m));
  };
}
function convertInteresse(id){
  const i=ST.interessadas.find(x=>x.id===id); if(!i) return;
  const finish=cid=>{ i.empresaId=cid; i.status='Convertida'; save.interessadas(); setOv(cid,{cat:i.tipo==='Serviços'?'Serviços':'Associação',contatoPrincipal:ov(cid).contatoPrincipal||i.contato,interesse:ov(cid).interesse||i.descricao}); render(); toast('Convertida em negociação'); };
  const ex=i.empresaId?co(i.empresaId):matchCompany(i.empresa);
  if(ex){ finish(ex.id); return; }
  openAddCompany({nome:i.empresa,cat:i.tipo==='Serviços'?'Serviços':'Associação',onCreated:finish});
}

/* ===================== MOUs ===================== */
const MOU_ST=['Concluído/Assinado','Em processo','Pendente','Não avançou'];
const MOU_CLS={'Concluído/Assinado':'tag-ok','Em processo':'tag-soon','Pendente':'tag-lead','Não avançou':'tag-late'};
RENDER.mous = function(el){
  let list=ST.mous.filter(m=>!ST.filters.busca||norm(m.empresaNome).includes(norm(ST.filters.busca)));
  if(ST.mouFilter) list=list.filter(m=>m.status===ST.mouFilter);
  el.innerHTML=`<div class="panel"><div class="panel-head"><h3>MOUs (${list.length})</h3><div class="head-actions"><select id="mf" class="mini-sel"><option value="">Todos</option>${MOU_ST.map(s=>`<option ${s===ST.mouFilter?'selected':''}>${s}</option>`).join('')}</select><button class="btn btn-accent btn-sm" id="mou-new">+ Nova pasta de MOU</button></div></div><div class="panel-body">
  ${list.length?`<div class="mou-grid">${list.map(m=>{ const c=m.empresaId?co(m.empresaId):null; return `<div class="mou-card" data-mou="${m.id}"><div class="co-cell">${logo(c?c.cache.dm:m.dm,m.empresaNome,38)}<div><b>${esc(m.empresaNome)}</b><div><span class="tag ${MOU_CLS[m.status]}">${esc(m.status)}</span></div></div></div>
   <div class="hint">Início das conversas: ${m.inicio?fmtDate(m.inicio):'—'}</div><div class="hint">${esc(m.pessoas||'')}</div><div class="hint">${(m.historico||[]).length} registro(s) · ${(m.docs||[]).length} documento(s)</div></div>`; }).join('')}</div>`
  :'<div class="empty">Nenhum MOU cadastrado ainda. Crie uma pasta por empresa para guardar o histórico e os documentos.</div>'}</div></div>`;
  $('mf').onchange=e=>{ ST.mouFilter=e.target.value; render(); }; $('mou-new').onclick=()=>openMouModal();
  el.querySelectorAll('[data-mou]').forEach(c=>c.onclick=()=>openMouDetail(c.dataset.mou));
};
function openMouModal(id,companyId){
  const m=id?ST.mous.find(x=>x.id===id):{empresaId:companyId||''};
  const close=openModal(id?'Editar MOU':'Nova pasta de MOU',
   `<div class="form-grid">${fld('o-emp','Empresa cadastrada',sel('o-emp',companyOptions(),m.empresaId,'— outra / nova —'))}${fld('o-nome','Nome (se não cadastrada)',inp('o-nome',m.empresaId?'':m.empresaNome))}
   ${fld('o-st','Status',sel('o-st',MOU_ST,m.status||'Em processo'))}${fld('o-ini','Início das conversas',inp('o-ini',m.inicio,'date'))}${fld('o-pes','Pessoas envolvidas',inp('o-pes',m.pessoas),true)}</div>`,
   `<button class="btn btn-ghost" id="o-c">Cancelar</button><button class="btn btn-primary" id="o-s">Salvar</button>`);
  $('o-c').onclick=close;
  $('o-s').onclick=()=>{
    const cid=val('o-emp'), nome=cid?nameOf(co(cid)):val('o-nome'); if(!nome){ toast('Escolha ou informe a empresa'); return; }
    if(!id && ST.mous.some(x=>norm(x.empresaNome)===norm(nome))){ toast('Já existe pasta de MOU para '+nome); return; }
    const o={...m,id:id||uid(),empresaId:cid||null,empresaNome:nome,status:val('o-st'),inicio:val('o-ini'),pessoas:val('o-pes'),historico:m.historico||[],docs:m.docs||[]};
    if(id) ST.mous=ST.mous.map(x=>x.id===id?o:x); else ST.mous.push(o);
    save.mous(); close(); render();
  };
}
function openMouDetail(id){
  const m=ST.mous.find(x=>x.id===id); if(!m) return;
  const close=openModal('MOU — '+esc(m.empresaNome),
   `<div class="mini-row"><span class="k">Status</span><span class="v"><span class="tag ${MOU_CLS[m.status]}">${esc(m.status)}</span></span></div>
    <div class="mini-row"><span class="k">Início das conversas</span><span class="v">${m.inicio?fmtDate(m.inicio):'—'}</span></div>
    <div class="mini-row"><span class="k">Pessoas envolvidas</span><span class="v" style="font-weight:400">${esc(m.pessoas||'—')}</span></div>
    <h4 class="sub-h">Histórico</h4>${(m.historico||[]).slice().reverse().map(h=>`<div class="hist"><span class="mono">${fmtDate(h.data)}</span> ${esc(h.texto)}</div>`).join('')||'<div class="hint">Sem registros.</div>'}
    <div class="inline-form"><input type="date" id="h-d" value="${todayISO()}"><input type="text" id="h-t" placeholder="O que aconteceu?"><button class="btn btn-ghost btn-sm" id="h-add">Adicionar</button></div>
    <h4 class="sub-h">Documentos</h4>${(m.docs||[]).map((d,i)=>`<div class="hist"><a class="lnk" href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.nome)}</a> <button class="icon-btn" data-ddel="${i}">✕</button></div>`).join('')||'<div class="hint">Cole o link do documento (SharePoint, Drive).</div>'}
    <div class="inline-form"><input type="text" id="d-n" placeholder="Nome do documento"><input type="url" id="d-u" placeholder="https://..."><button class="btn btn-ghost btn-sm" id="d-add">Adicionar</button></div>`,
   `<button class="btn btn-ghost danger" id="o-del">Excluir pasta</button><button class="btn btn-ghost" id="o-ed">Editar dados</button><button class="btn btn-primary" id="o-ok">Fechar</button>`,{wide:true});
  const again=()=>{ save.mous(); close(); render(); openMouDetail(id); };
  $('o-ok').onclick=close; $('o-ed').onclick=()=>{ close(); openMouModal(id); };
  $('o-del').onclick=()=>{ ST.mous=ST.mous.filter(x=>x.id!==id); save.mous(); close(); render(); };
  $('h-add').onclick=()=>{ if(!val('h-t')) return; (m.historico=m.historico||[]).push({data:val('h-d'),texto:val('h-t')}); again(); };
  $('d-add').onclick=()=>{ if(!val('d-u')) return; (m.docs=m.docs||[]).push({nome:val('d-n')||'Documento',url:val('d-u')}); again(); };
  document.querySelectorAll('[data-ddel]').forEach(b=>b.onclick=()=>{ m.docs.splice(+b.dataset.ddel,1); again(); });
}

/* ===================== INFO / FILTROS / INIT ===================== */
function openSyncInfo(){
  const close=openModal('Como os dados são atualizados',
   `<p><b>HubSpot, Outlook/Teams e formulário</b> são lidos por mim (Claude) a pedido e gravados em <code>data/*.json</code>. Depois do commit no GitHub, o Vercel publica sozinho.</p>
    <p class="hint" style="background:#F8F9FB;padding:10px;border-radius:8px">"Atualize o dashboard da Regional SP: HubSpot, agenda e contatos"</p>
    <p><b>Tarefas, MOUs, interessadas, motivos de perda e ajustes</b> ficam salvos neste navegador (localStorage) e não aparecem no computador da Rafaela. Para compartilhar entre vocês em tempo real, o próximo passo é ligar um banco (Supabase, grátis), que eu configuro.</p>`,
   `<button class="btn btn-primary" id="si-ok">Entendi</button>`);
  $('si-ok').onclick=close;
}
function wireTop(){
  $('f-cat').onchange=e=>{ ST.filters.cat=e.target.value; render(); };
  $('f-resp').onchange=e=>{ ST.filters.resp=e.target.value; render(); };
  $('f-periodo').onchange=e=>{ ST.filters.periodo=e.target.value; render(); };
  let bt; $('f-busca').addEventListener('input',e=>{ clearTimeout(bt); bt=setTimeout(()=>{ ST.filters.busca=e.target.value; ST.ctPage=0; render(); },250); });
  $('btn-sync-all').onclick=openSyncInfo;
  $('btn-quick-task').onclick=()=>openTarefaModal();
  window.addEventListener('hashchange',()=>{ const h=location.hash.slice(1); if(RENDER[h]&&h!==ST.tab){ ST.tab=h; render(); } });
}
async function fj(path){ try{ const r=await fetch(path,{cache:'no-store'}); return r.ok?await r.json():null; }catch(e){ console.warn(path,e); return null; } }
async function init(){
  ST.registry=lget(K.registry,{}); ST.over=lget(K.over,{}); ST.meetover=lget(K.meetover,{});
  ST.activities=lget(K.activities,[]); ST.eventos=lget(K.eventos,[]); ST.tarefas=lget(K.tarefas,[]);
  ST.interessadas=lget(K.interessadas,[]); ST.mous=lget(K.mous,[]); ST.lastSync=(lget(K.meta,{})||{}).lastSync||null;
  // migração: reuniões v1 registradas à mão mantêm os campos
  const [snap,ac,ev,re,ct,it,mo,ng,rn]=await Promise.all(['snapshot','apenas-contato','eventos','reunioes','contatos','interessadas','mous','negocios','renovacoes'].map(n=>fj('data/'+n+'.json')));
  ST.renov=lget(K.renov,[]);
  if(ng){ DEALS=ng.deals||[]; ST.lastSync=new Date(ng.fetchedAt).getTime(); }
  if(rn){ const done=lget('ccibsp:renseed',[]); let ch=false; rn.forEach(x=>{ if(!done.includes(x.id)){ if(!ST.renov.some(y=>y.id===x.id)) ST.renov.push({...x}); done.push(x.id); ch=true; } }); if(ch){ lset('ccibsp:renseed',done); save.renov(); } }
  if(snap){ SNAP=snap; applySnapshot(); } else $('error-banner-holder').innerHTML='<div class="error-banner"><div><b>Não foi possível carregar data/snapshot.json</b>Confira se o arquivo foi publicado.</div></div>';
  (ac||[]).forEach(x=>{ APENAS_CONTATO[x.id]=true; });
  if(ev) ST.eventos=ev.map(e=>({...e,...(ST.over['ev:'+e.id]||{}),seed:true})).concat(ST.eventos.filter(e=>!e.seed));
  if(re) ST.activities=re.map(m=>({...m,seed:true})).concat(ST.activities.filter(a=>!a.seed));
  ST.contatos=ct||[];
  if(it&&it.length) ST.interessadas=it.map(x=>({...x,seed:true})).concat(ST.interessadas.filter(x=>!x.seed));
  if(mo&&mo.length){ const done=lget('ccibsp:mouseed',[]); let ch=false;
    mo.forEach(x=>{ if(!done.includes(x.id)){ if(!ST.mous.some(y=>y.id===x.id)) ST.mous.push({...x}); done.push(x.id); ch=true; } });
    if(ch){ lset('ccibsp:mouseed',done); save.mous(); } }
  const h=(location.hash||'').slice(1); if(RENDER[h]) ST.tab=h;
  wireTop(); render();
}
init();
})();
