const API_BASE = "https://telehealth.informatikaunimus.site/api";
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const state = {
  page:"dashboard", profile:null, forms:[], history:[], selectedForm:null, formDef:null,
  assessmentId:null, answers:{}, step:0, validation:null, detail:null, status:null,
  settings: {
    ...(JSON.parse(localStorage.getItem("telehealth_settings") || "null") || {}),
    nim:"C2C023174", nama:"Khaula Afifah", kelas:"Informatika E"
  }
};
const content = $("#app-content");
const pageNames = {dashboard:"Dashboard",forms:"Mulai Assessment",history:"Riwayat",results:"Hasil & Status",clarifications:"Klarifikasi",followup:"Tindak Lanjut",uts:"Bukti Fitur UTS",settings:"Pengaturan",instructions:"Petunjuk",assessment:"Isi Assessment",review:"Periksa Jawaban",success:"Konfirmasi"};

function esc(v=""){return String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),3200);}
function getToken(){return state.settings.token.trim();}
function saveSettings(){localStorage.setItem("telehealth_settings",JSON.stringify(state.settings));$("#avatar").textContent=(state.settings.nama||"T").trim().charAt(0).toUpperCase();}
function setConnection(ok,msg){$("#connection-dot").classList.toggle("online",!!ok);$("#connection-text").textContent=msg|| (ok?"Terhubung":"Belum terhubung");}
function setPage(page){
  state.page=page; $("#page-label").textContent=pageNames[page]||"Dashboard";
  $$(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  $("#sidebar").classList.remove("open");$("#overlay").classList.remove("show");
  render();
}
function loading(){content.innerHTML='<div class="loading"><div class="spinner"></div>Memuat data...</div>';}
async function api(path,{method="GET",body,auth=true}={}){
  const headers={"Accept":"application/json"};
  if(auth){if(!getToken())throw new Error("Masukkan Bearer Token terlebih dahulu melalui Pengaturan.");headers.Authorization=`Bearer ${getToken()}`;}
  if(body!==undefined)headers["Content-Type"]="application/json";
  let res;
  try{res=await fetch(API_BASE+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});}
  catch(e){throw new Error("Tidak dapat menghubungi API. Periksa koneksi internet atau akses server.");}
  let json={};try{json=await res.json();}catch{}
  if(!res.ok || json.success===false){const err=new Error(json.message||`Permintaan gagal (${res.status}).`);err.status=res.status;err.errors=json.errors||json.data?.errors||{};throw err;}
  return json;
}
function errText(e){if(e.errors&&Object.keys(e.errors).length)return Object.values(e.errors).join(" ");return e.message||"Terjadi kesalahan.";}
function statusBadge(obj){
  const code=typeof obj==="string"?obj:(obj?.kode||obj?.label||"");
  const label=typeof obj==="string"?obj:(obj?.label||code||"—");
  let cls="";if(/selesai|ditinjau|terkirim|dijawab|disetujui/i.test(code))cls="green";else if(/menunggu|draft|belum_dikirim/i.test(code))cls="blue";else if(/klarifikasi|revisi/i.test(code))cls="orange";else if(/tolak/i.test(code))cls="pink";
  return `<span class="status ${cls}">${esc(label||"—")}</span>`;
}
function head(title,sub="",action=""){return `<div class="page-head"><div><div class="eyebrow">TELEHEALTH</div><h1>${title}</h1>${sub?`<p>${sub}</p>`:""}</div>${action}</div>`;}
function empty(msg="Belum ada data yang tersedia."){return `<div class="empty"><div class="empty-icon">○</div>${esc(msg)}</div>`;}
function dataOf(resp){return resp?.data??resp??{};}
// API dapat mengirim jawaban sebagai object atau array. Ubah ke object
// yang dipakai oleh formulir tanpa menghapus format jawaban yang sudah ada.
function normalizeAnswers(raw){
  if(raw==null)return {};
  if(!Array.isArray(raw))return typeof raw==="object"?{...raw}:{};
  const out={};
  for(const item of raw){
    if(!item||typeof item!=="object")continue;
    const key=item.question_id??item.question_key??item.pertanyaan_id??item.key??item.id;
    if(key!==undefined&&key!==null&&key!==""){
      const value=item.value??item.jawaban??item.answer??item.nilai??item.response;
      if(value!==undefined)out[String(key)]=value;
    }
  }
  return out;
}
function pickArray(resp){const d=dataOf(resp);if(Array.isArray(d))return d;return d.items||d.data||d.assessments||d.forms||[];}

async function loadDashboard(){
  loading();
  try{
    const [me,forms,hist]=await Promise.all([
      api(`/me?nim=${encodeURIComponent(state.settings.nim)}`),
      api("/forms"),
      api(`/assessments?nim=${encodeURIComponent(state.settings.nim)}`)
    ]);
    state.profile=dataOf(me);state.forms=pickArray(forms);state.history=pickArray(hist);setConnection(true,"Terhubung");renderDashboard();
  }catch(e){setConnection(false);renderDashboard(e);}
}
function renderDashboard(error){
  const p=state.profile||{},s=p.statistik||{},items=state.history.slice(0,4);
  content.innerHTML=`<div class="fade-in">${head(`Halo, ${esc((state.settings.nama||"").split(" ")[0]||"teman")} 👋`,`Pantau dan kelola self-assessment kesehatanmu.`)}
    ${error?`<div class="notice">${esc(errText(error))} <button class="text-link" data-page="settings">Periksa pengaturan</button></div>`:""}
    <section class="welcome"><div><div class="eyebrow" style="color:#d9e8f6">SELF ASSESSMENT</div><h2>Mulai dari memahami<br>kondisi dirimu.</h2><p>Isi formulir kesehatan dengan mudah dan nyaman.</p><button class="btn" data-page="forms">Mulai Assessment <span>→</span></button></div><div class="welcome-art">✚</div></section>
    <div class="stats">
      ${stat("Total Assessment",s.total??state.history.length,"▤")}${stat("Draft",s.draf??countDraft(),"◷")}${stat("Menunggu Review",s.menunggu??countWaiting(),"◌")}${stat("Selesai Ditinjau",s.sudah_ditinjau??countReviewed(),"✓")}
    </div>
    <div class="two-col">
      <section class="card card-pad"><div class="card-head"><div><h3 class="section-title">Aktivitas Terbaru</h3><p class="section-sub">Riwayat pengisian terakhir</p></div><button class="text-link" data-page="history">Lihat semua →</button></div>
        ${items.length?`<div class="activity">${items.map(activityRow).join("")}</div>`:empty("Belum ada assessment.")}
      </section>
      <section class="card card-pad"><div class="card-head"><div><h3 class="section-title">Profil Pasien</h3><p class="section-sub">Akun yang sedang digunakan</p></div><span class="status blue">${esc(p.id||state.settings.patient)}</span></div>
        <div class="review-row"><span>Nama pasien</span><strong>${esc(p.nama||state.settings.nama||"—")}</strong></div><div class="review-row"><span>No. Rekam Medis</span><strong>${esc(p.no_rm||"—")}</strong></div><div class="review-row"><span>NIM terhubung</span><strong>${esc(state.settings.nim||"—")}</strong></div>
        <div class="notice">Hasil self-assessment bukan merupakan diagnosis medis.</div>
      </section>
    </div></div>`;
}
function stat(label,value,icon){return `<div class="card stat"><div class="stat-top">${label}<span class="stat-icon">${icon}</span></div><strong>${esc(value)}</strong><small>Data berdasarkan NIM kamu</small></div>`;}
function countDraft(){return state.history.filter(x=>/draft|belum_dikirim/i.test(x.status_pengiriman?.kode||x.status_peninjauan?.kode||"")).length;}
function countWaiting(){return state.history.filter(x=>/menunggu|sedang_ditinjau/i.test(x.status_peninjauan?.kode||"")).length;}
function countReviewed(){return state.history.filter(x=>/sudah_ditinjau/i.test(x.status_peninjauan?.kode||"")).length;}
function activityRow(x){return `<div class="activity-row"><div class="activity-icon">▤</div><div class="activity-info"><strong>${esc(x.form_judul||x.form?.judul||x.form_id||"Self-Assessment")}</strong><span>${esc(x.id||"")} · ${esc(formatDate(x.created_at||x.dibuat_pada||x.tanggal))}</span></div>${statusBadge(x.status_peninjauan||x.status_pengiriman)}</div>`;}
function formatDate(v){if(!v)return "Tanggal tidak tersedia";const d=new Date(v);return isNaN(d)?"—":d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"});}

async function loadForms(){loading();try{const r=await api("/forms");state.forms=pickArray(r);renderForms();}catch(e){content.innerHTML=head("Pilih Assessment","") + `<div class="notice">${esc(errText(e))}</div>`;}}
function renderForms(){
  const forms=state.forms;
  content.innerHTML=`<div class="fade-in">${head("Pilih Assessment","Pilih formulir yang ingin kamu isi.")}${forms.length?`<div class="form-grid">${forms.map(f=>`<article class="card form-card"><div class="form-symbol">${f.id==="FRM-GAD7"?"♡":"＋"}</div><h3>${esc(f.judul||f.nama||f.id)}</h3><p>${esc(f.deskripsi||f.keterangan||"Formulir self-assessment kesehatan.")}</p><div class="form-meta">${esc(f.id)} · ${esc(f.estimasi_menit||f.estimasi||"—")} menit</div><button class="btn btn-primary" data-start-form="${esc(f.id)}">Mulai <span>→</span></button></article>`).join("")}</div>`:empty("Belum ada formulir yang tersedia dari API.")}</div>`;
}
async function openInstructions(formId){
  loading();try{const r=await api(`/forms/${encodeURIComponent(formId)}`);state.formDef=dataOf(r);state.selectedForm=formId;renderInstructions();}
  catch(e){content.innerHTML=head("Petunjuk Pengisian") + `<div class="notice">${esc(errText(e))}</div>`;}
}
function renderInstructions(){
  const f=state.formDef||{};const guide=f.petunjuk||f.instructions||[];
  const consent=f.persetujuan||f.consent||"Saya menyatakan bahwa informasi yang saya berikan sesuai dengan kondisi sebenarnya.";
  content.innerHTML=`<div class="fade-in">${head(f.judul||f.title||"Petunjuk Pengisian","Baca petunjuk sebelum memulai.")}<div class="card card-pad" style="max-width:760px">
    <h3 class="section-title">${esc(f.judul||f.title||state.selectedForm)}</h3><p class="muted small">${esc(f.deskripsi||f.description||"Isi pertanyaan sesuai kondisi yang kamu alami.")}</p>
    <div class="notice" style="margin:18px 0">${Array.isArray(guide)?guide.map(x=>`<p>${esc(typeof x==="string"?x:x.teks||x.text||"")}</p>`).join(""):esc(guide)}</div>
    <label class="choice"><input type="checkbox" id="consent"> <span>${esc(typeof consent==="string"?consent:"Saya telah membaca petunjuk dan menyetujui pengisian assessment.")}</span></label>
    <div class="step-actions"><button class="btn btn-ghost" data-page="forms">Kembali</button><button class="btn btn-primary" id="begin-assessment">Mulai Mengisi →</button></div>
  </div></div>`;
}
async function beginAssessment(){
  if(!$("#consent")?.checked){toast("Centang persetujuan terlebih dahulu.");return;}
  try{
    const r=await api("/assessments",{method:"POST",body:{form_id:state.selectedForm,persetujuan:true,mahasiswa:{nim:state.settings.nim,nama:state.settings.nama,kelas:state.settings.kelas},answers:{}}});
    const d=dataOf(r);state.assessmentId=d.id||d.assessment?.id;state.answers=normalizeAnswers(d.answers??d.assessment?.answers);state.step=0;
    if(!state.assessmentId)throw new Error("Draf dibuat, tetapi ID assessment tidak ditemukan pada respons API.");
    await openAssessmentForm();
  }catch(e){toast(errText(e));}
}
async function openAssessmentForm(){
  try{const [def,detail]=await Promise.all([api(`/forms/${encodeURIComponent(state.selectedForm)}`),api(`/assessments/${encodeURIComponent(state.assessmentId)}`)]);
    state.formDef=dataOf(def);const d=dataOf(detail);state.answers=normalizeAnswers(d.answers??d.assessment?.answers??state.answers);renderAssessment();
  }catch(e){toast(errText(e));}
}
function sections(){return (state.formDef?.sections||[]).filter(sec=>isVisible(sec.show_if||sec.tampil_jika,state.answers));}
function isVisible(cond,answers){
  if(!cond)return true;if(cond.any)return cond.any.some(c=>isVisible(c,answers));if(cond.all)return cond.all.every(c=>isVisible(c,answers));
  const v=answers[cond.question],filled=v!==undefined&&v!==null&&v!==""&&!(Array.isArray(v)&&!v.length);
  if("equals"in cond)return v===cond.equals;if("in"in cond)return cond.in.includes(v);if("includes"in cond)return Array.isArray(v)&&v.includes(cond.includes);if("filled"in cond)return filled===cond.filled;return true;
}
function visibleQuestions(section){return (section.questions||[]).filter(q=>isVisible(q.show_if||q.tampil_jika||q.when||q.condition,state.answers));}
function renderAssessment(){
  const secs=sections();const current=secs[state.step]||secs[0];if(!current){content.innerHTML=head("Isi Assessment")+'<div class="notice">Definisi pertanyaan belum tersedia dari API.</div>';return;}
  const qs=visibleQuestions(current);
  const pct=Math.round(((state.step+1)/secs.length)*100);
  content.innerHTML=`<div class="fade-in">${head(state.formDef.judul||state.selectedForm,`Bagian ${state.step+1} dari ${secs.length}`)}
    <div class="card card-pad"><div class="step-head"><strong>${esc(current.judul||current.title||current.nama||"Bagian")}</strong><span>${pct}%</span></div><div class="progress"><span style="width:${pct}%"></span></div></div>
    <div class="question-list" style="margin-top:14px">${qs.map(renderQuestion).join("")}</div>
    <div class="step-actions"><button class="btn btn-ghost" id="prev-step" ${state.step===0?"disabled":""}>← Sebelumnya</button><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button class="btn btn-secondary" id="save-draft">Simpan Draf</button>${state.step<secs.length-1?'<button class="btn btn-primary" id="next-step">Selanjutnya →</button>':'<button class="btn btn-primary" id="to-review">Periksa Jawaban →</button>'}</div></div>
  </div>`;
}
function renderQuestion(q){
  const id=q.id||q.key,label=q.pertanyaan||q.label||q.judul||id, type=q.type||q.tipe||"text", val=state.answers[id], required=q.wajib===true||q.required===true;
  let control="";
  const opts=q.options||q.opsi||q.pilihan||q.choices||q.nilai_opsi||[];
  const optionList=Array.isArray(opts)?opts.map(o=>typeof o==="string"?{value:o,label:o}:{value:o.value??o.nilai??o.kode??o.id,label:o.label??o.teks??o.nama??o.text??o.value}):Object.entries(opts).map(([value,label])=>({value,label}));
  if(["single_choice","radio","select"].includes(type)){
    control=type==="select"?`<select data-answer="${esc(id)}"><option value="">Pilih jawaban</option>${optionList.map(o=>`<option value="${esc(o.value)}" ${val===o.value?"selected":""}>${esc(o.label)}</option>`).join("")}</select>`:
    optionList.map(o=>`<label class="choice ${val===o.value?"selected":""}"><input type="radio" name="${esc(id)}" data-answer="${esc(id)}" value="${esc(o.value)}" ${val===o.value?"checked":""}>${esc(o.label)}</label>`).join("");
  }else if(["multi_choice","checkbox"].includes(type)){
    control=optionList.map(o=>`<label class="choice ${(Array.isArray(val)&&val.includes(o.value))?"selected":""}"><input type="checkbox" data-answer="${esc(id)}" value="${esc(o.value)}" ${(Array.isArray(val)&&val.includes(o.value))?"checked":""}>${esc(o.label)}</label>`).join("");
  }else if(type==="scale"){
    control=optionList.length?optionList.map(o=>`<label class="choice ${(String(val)===String(o.value))?"selected":""}"><input type="radio" name="${esc(id)}" data-answer="${esc(id)}" value="${esc(o.value)}" ${String(val)===String(o.value)?"checked":""}>${esc(o.label)}</label>`).join(""):[1,2,3,4,5].map(n=>`<label class="choice"><input type="radio" name="${esc(id)}" data-answer="${esc(id)}" value="${n}" ${String(val)===String(n)?"checked":""}>${n}</label>`).join("");
  }else if(type==="textarea"){
    control=`<textarea data-answer="${esc(id)}" maxlength="${q.max_length||q.maksimal||q.maxlength||1000}" placeholder="Tulis jawaban...">${esc(val||"")}</textarea>`;
  }else{
    const inputType=type==="number"?"number":type==="date"?"date":"text";
    control=`<input type="${inputType}" data-answer="${esc(id)}" value="${esc(val??"")}" ${(q.min??q.minimum)!=null?`min="${q.min??q.minimum}"`:""} ${(q.max??q.maximum)!=null?`max="${q.max??q.maximum}"`:""} placeholder="${inputType==="text"?"Tulis jawaban...":""}">`;
  }
  return `<article class="card question" data-question="${esc(id)}"><h3>${esc(label)} ${required?'<span class="required">*</span>':""}</h3>${q.data_type?`<div class="q-hint">${q.data_type==="pengukuran"?"Data pengukuran":"Laporan subjektif"}${q.satuan?` · Satuan: ${esc(q.satuan)}`:""}</div>`:""}${q.keterangan||q.hint?`<div class="q-hint">${esc(q.keterangan||q.hint)}</div>`:""}<div class="question-control">${control}</div><div class="question-error" data-error="${esc(id)}"></div></article>`;
}
function questionById(id){
  for(const sec of (state.formDef?.sections||[])){
    const found=(sec.questions||[]).find(q=>(q.id||q.key)===id);
    if(found)return found;
  }
  return null;
}
function readAnswersFromDOM(){
  $$("[data-answer]").forEach(el=>{
    const id=el.dataset.answer, q=questionById(id), type=q?.type||q?.tipe||"";
    if(el.type==="radio"){
      if(el.checked)state.answers[id]=type==="scale"||type==="number"?Number(el.value):el.value;
    }else if(el.type==="checkbox"){
      const group=$$(`[data-answer="${CSS.escape(id)}"]`);
      const checked=group.filter(x=>x.checked).map(x=>x.value);
      const opts=q?.options||q?.opsi||q?.pilihan||[];
      const optionRows=Array.isArray(opts)?opts:[];
      const exclusive=optionRows.find(o=>typeof o==="object"&&(o.value??o.nilai??o.kode??o.id)===checked[0]&&(o.exclusive||o.eksclusive));
      if(exclusive)state.answers[id]=[checked[0]];
      else {
        const exclusiveValues=optionRows.filter(o=>typeof o==="object"&&(o.exclusive||o.eksclusive)).map(o=>o.value??o.nilai??o.kode??o.id);
        state.answers[id]=checked.length>1?checked.filter(v=>!exclusiveValues.includes(v)):checked;
      }
      if(!state.answers[id].length)delete state.answers[id];
    }else if(el.value!=="")state.answers[id]=el.type==="number"?Number(el.value):el.value;
    else delete state.answers[id];
  });
}
function removeHiddenAnswers(){
  const allowed=new Set(sections().flatMap(sec=>visibleQuestions(sec).map(q=>q.id||q.key)));
  for(const key of Object.keys(state.answers)) if(!allowed.has(key)) delete state.answers[key];
}
async function saveDraft(silent=false){
  readAnswersFromDOM();
  removeHiddenAnswers();
  try{await api(`/assessments/${encodeURIComponent(state.assessmentId)}`,{method:"PATCH",body:{answers:state.answers}});if(!silent)toast("Draf berhasil disimpan.");return true;}
  catch(e){toast(errText(e));return false;}
}
async function moveStep(delta){readAnswersFromDOM();removeHiddenAnswers();if(!(await saveDraft(true)))return;state.step=Math.max(0,Math.min(sections().length-1,state.step+delta));renderAssessment();}
async function validateAndReview(){
  readAnswersFromDOM();removeHiddenAnswers();if(!(await saveDraft(true)))return;
  try{
    const r=await api(`/forms/${encodeURIComponent(state.selectedForm)}/validate`,{method:"POST",body:{nim:state.settings.nim,answers:state.answers}});
    state.validation=dataOf(r);
    state.validation.errors=state.validation.errors||r.errors||{};
    if(state.validation.valid===undefined) state.validation.valid=Object.keys(state.validation.errors).length===0;
    renderReview();
  }catch(e){state.validation={valid:false,errors:e.errors||{_global:e.message}};renderReview();}
}
function answerText(v){if(Array.isArray(v))return v.join(", ");if(v===undefined||v===null||v==="")return "Belum diisi";return String(v);}
function renderReview(){
  const errors=state.validation?.errors||{};const rows=sections().map(sec=>`<div class="card card-pad" style="margin-bottom:12px"><div class="card-head"><h3 class="section-title">${esc(sec.judul||sec.title||sec.nama||"Bagian")}</h3><button class="text-link" data-edit-section="${sections().indexOf(sec)}">Ubah</button></div>${visibleQuestions(sec).map(q=>`<div class="review-row"><span>${esc(q.pertanyaan||q.label||q.id)}</span><strong>${esc(answerText(state.answers[q.id]))}</strong></div>`).join("")}</div>`).join("");
  content.innerHTML=`<div class="fade-in">${head("Periksa Jawaban","Pastikan jawabanmu sudah benar sebelum dikirim.")}${Object.keys(errors).length?`<div class="notice"><b>Masih ada jawaban yang perlu diperbaiki.</b>${Object.entries(errors).map(([k,v])=>`<div style="margin-top:5px"><b>${esc(k)}</b>: ${esc(v)}</div>`).join("")}</div>`:""}${rows}<div class="step-actions"><button class="btn btn-ghost" id="back-form">← Kembali</button><button class="btn btn-primary" id="submit-assessment" ${state.validation?.valid===false||Object.keys(errors).length?"disabled":""}>Kirim Assessment →</button></div></div>`;
}
async function submitAssessment(){
  try{await api(`/assessments/${encodeURIComponent(state.assessmentId)}/submit`,{method:"POST"});content.innerHTML=`<div class="fade-in" style="max-width:620px;margin:55px auto;text-align:center"><div class="card card-pad"><div style="font-size:46px;color:#23866b">✓</div><h1 style="font:800 24px Manrope">Assessment terkirim</h1><p class="muted">Formulir berhasil dikirim dan menunggu peninjauan.</p><div class="notice">Nomor assessment: <b>${esc(state.assessmentId)}</b></div><button class="btn btn-primary" data-page="history">Lihat Riwayat</button></div></div>`;toast("Formulir berhasil dikirim.");}
  catch(e){toast(errText(e));if(e.errors){state.validation={errors:e.errors};renderReview();}}
}

async function loadHistory(){
  loading();try{const r=await api(`/assessments?nim=${encodeURIComponent(state.settings.nim)}`);state.history=pickArray(r);renderHistory();}
  catch(e){content.innerHTML=head("Riwayat Assessment","") + `<div class="notice">${esc(errText(e))}</div>`;}
}
function renderHistory(){
  content.innerHTML=`<div class="fade-in">${head("Riwayat Assessment","Daftar pengisian self-assessment kamu.")}<div class="card card-pad"><div class="toolbar"><input id="history-search" placeholder="Cari nomor atau formulir..."><select id="history-filter"><option value="">Semua status</option><option value="draft">Draft</option><option value="menunggu">Menunggu</option><option value="perlu_klarifikasi">Perlu klarifikasi</option><option value="sudah_ditinjau">Selesai ditinjau</option></select></div><div class="table-wrap"><table><thead><tr><th>ASSESSMENT</th><th>TANGGAL</th><th>PENGIRIMAN</th><th>PENINJAUAN</th><th></th></tr></thead><tbody id="history-body">${historyRows(state.history)}</tbody></table></div></div></div>`;
}
function historyRows(rows){if(!rows.length)return `<tr><td colspan="5">${empty("Belum ada riwayat assessment.")}</td></tr>`;return rows.map(x=>`<tr><td><strong>${esc(x.id||"—")}</strong><br><span class="muted">${esc(x.form_judul||x.form?.judul||x.form_id||"Assessment")}</span></td><td>${esc(formatDate(x.created_at||x.dibuat_pada||x.tanggal))}</td><td>${statusBadge(x.status_pengiriman)}</td><td>${statusBadge(x.status_peninjauan)}</td><td>${(x.status_pengiriman?.kode==="draft"||x.status_pengiriman?.kode==="belum_dikirim")?`<button class="btn btn-secondary" data-resume="${esc(x.id)}">Lanjutkan</button>`:`<button class="btn btn-secondary" data-detail="${esc(x.id)}">Detail</button>`}</td></tr>`).join("");}
function filterHistory(){const q=$("#history-search").value.toLowerCase(),f=$("#history-filter").value;const rows=state.history.filter(x=>JSON.stringify(x).toLowerCase().includes(q)&&(!f||JSON.stringify(x).toLowerCase().includes(f)));$("#history-body").innerHTML=historyRows(rows);}
async function resumeDraft(id){
  loading();
  try{
    const r=await api(`/assessments/${encodeURIComponent(id)}`);
    const d=dataOf(r);
    const assessment=d.assessment||d;
    if(!assessment.form?.id && !assessment.form_id) throw new Error("ID formulir tidak ditemukan pada data draft.");
    state.assessmentId=id;
    state.selectedForm=assessment.form?.id||assessment.form_id;
    state.answers=normalizeAnswers(assessment.answers??assessment.jawaban);
    const f=await api(`/forms/${encodeURIComponent(state.selectedForm)}`);
    state.formDef=dataOf(f);
    state.step=0;
    setPage("assessment");
  }catch(e){toast(errText(e));}
}
async function openDetail(id){
  loading();try{const [d,s,h]=await Promise.all([
      api(`/assessments/${encodeURIComponent(id)}`),
      api(`/assessments/${encodeURIComponent(id)}/status`),
      api(`/assessments/${encodeURIComponent(id)}/hasil`).catch(()=>null)
    ]);
    state.detail=dataOf(d);state.status=dataOf(s);state.result=h?dataOf(h):state.detail.hasil||null;
    state.assessmentId=id;renderDetail();}
  catch(e){content.innerHTML=head("Detail Assessment") + `<div class="notice">${esc(errText(e))}</div>`;}
}
function renderDetail(){
  const d=state.detail||{},s=state.status||{},result=state.result||d.hasil||{},answers=d.answers||{};
  const clar=s.klarifikasi_menunggu||d.klarifikasi||[];
  const follow=s.tindak_lanjut||d.tindak_lanjut;
  content.innerHTML=`<div class="fade-in">${head("Detail Assessment",`Nomor ${esc(d.id||state.assessmentId)}`,`<button class="btn btn-ghost" data-page="history">← Kembali</button>`)}
    <div class="two-col"><div class="card card-pad"><h3 class="section-title">Informasi Pengiriman</h3><div class="review-row"><span>Status pengiriman</span>${statusBadge(d.status_pengiriman||s.status_pengiriman)}</div><div class="review-row"><span>Status peninjauan</span>${statusBadge(d.status_peninjauan||s.status_peninjauan)}</div><div class="review-row"><span>Tanggal</span><strong>${esc(formatDate(d.created_at||d.dibuat_pada))}</strong></div><div class="notice">${esc(s.pesan||s.pesan_status||d.pesan_status||"Hasil self-assessment bukan merupakan diagnosis medis.")}</div></div>
    <div class="card card-pad"><h3 class="section-title">Timeline</h3>${(s.timeline||d.timeline||[]).length?`<div class="timeline" style="margin-top:18px">${(s.timeline||d.timeline).map(t=>`<div class="timeline-item"><div class="timeline-dot">•</div><div><strong>${esc(t.event||t.judul||"Pembaruan")}</strong><p>${esc(t.keterangan||"")} · ${esc(formatDate(t.waktu))}</p></div></div>`).join("")}</div>`:empty("Belum ada pembaruan status.")}</div></div>
    <div class="card card-pad" style="margin-top:15px"><h3 class="section-title">Ringkasan Hasil</h3>${result&&Object.keys(result).length?`
      ${result.judul?`<h3 style="font:700 16px Manrope;margin:14px 0">${esc(result.judul)}</h3>`:""}
      ${Array.isArray(result.ringkasan)?result.ringkasan.map(a=>`<div class="review-row"><span>${esc(a.label||a.pertanyaan||a.question_id||"Jawaban")}</span><strong>${esc(a.jawaban_teks||a.jawaban||"Belum diisi")}</strong></div>`).join(""):""}
      ${result.kelengkapan?`<div class="review-row"><span>Kelengkapan</span><strong>${esc(result.kelengkapan.label||result.kelengkapan.status||"—")} · ${esc(result.kelengkapan.persen??"—")}%</strong></div>`:""}
      ${result.skor?`<div class="review-row"><span>Skor</span><strong>${esc(result.skor.total)} / ${esc(result.skor.maks)} · ${esc(result.skor.kategori?.label||"")}</strong></div><p class="muted small">${esc(result.skor.keterangan||"")}</p>`:""}
      ${result.perubahan?.skor?`<div class="review-row"><span>Perubahan skor</span><strong>${esc(result.perubahan.skor.sebelumnya)} → ${esc(result.perubahan.skor.sekarang)} (${esc(result.perubahan.skor.selisih)})</strong></div>`:""}
      ${result.keterbatasan?`<div class="notice">${esc(result.keterbatasan)}</div>`:""}
      ${result.langkah_berikutnya?`<p class="small">${esc(result.langkah_berikutnya)}</p>`:""}
    `:empty("Hasil belum tersedia atau masih menunggu peninjauan.")}</div>
    ${clar.length?`<div class="card card-pad" style="margin-top:15px"><h3 class="section-title">Klarifikasi</h3>${clar.map(c=>`<div class="review-row"><span>${esc(c.id)}</span><strong>${esc(c.pertanyaan||c.pesan)}</strong></div><div class="field"><label>Jawaban</label><textarea id="reply-${esc(c.id)}" placeholder="Tulis jawaban..."></textarea><button class="btn btn-primary" data-reply="${esc(c.id)}">Kirim Jawaban</button></div>`).join("")}</div>`:""}
    ${follow?`<div class="card card-pad" style="margin-top:15px"><h3 class="section-title">Tindak Lanjut</h3><div class="review-row"><span>Arahan</span><strong>${esc(follow.arahan||"—")}</strong></div><div class="review-row"><span>Jenis</span><strong>${esc(follow.jenis?.label||follow.jenis||"—")}</strong></div><div class="review-row"><span>Jadwal</span><strong>${esc(formatDate(follow.jadwal_konsultasi))}</strong></div></div>`:""}
  </div>`;
}
async function sendReply(cid){
  const answer=$(`#reply-${CSS.escape(cid)}`)?.value.trim();if(!answer){toast("Isi jawaban klarifikasi terlebih dahulu.");return;}
  try{await api(`/assessments/${encodeURIComponent(state.assessmentId)}/clarifications/${encodeURIComponent(cid)}/reply`,{method:"POST",body:{jawaban:answer}});toast("Jawaban klarifikasi terkirim.");await openDetail(state.assessmentId);}
  catch(e){toast(errText(e));}
}
async function loadResults(){
  loading();try{const r=await api(`/assessments?nim=${encodeURIComponent(state.settings.nim)}`);state.history=pickArray(r);renderResults();}
  catch(e){content.innerHTML=head("Hasil & Status","") + `<div class="notice">${esc(errText(e))}</div>`;}
}
function renderResults(){
  const rows=state.history.filter(x=>x.id);
  content.innerHTML=`<div class="fade-in">${head("Hasil & Status","Pilih assessment untuk melihat hasil dan perkembangan.")}<div class="card card-pad"><div class="activity">${rows.map(x=>`<div class="activity-row"><div class="activity-icon">▧</div><div class="activity-info"><strong>${esc(x.form_judul||x.form_id||"Assessment")}</strong><span>${esc(x.id)} · ${esc(formatDate(x.created_at||x.dibuat_pada))}</span></div>${statusBadge(x.status_peninjauan)}<button class="btn btn-secondary" data-detail="${esc(x.id)}">Lihat</button></div>`).join("")||empty()}</div></div></div>`;
}
async function loadClarifications(){
  loading();try{const r=await api(`/assessments?nim=${encodeURIComponent(state.settings.nim)}`);state.history=pickArray(r);const details=await Promise.all(state.history.filter(x=>x.id).map(async x=>{try{const z=await api(`/assessments/${encodeURIComponent(x.id)}/status`);return {id:x.id,status:dataOf(z)};}catch{return null;}}));const pending=details.filter(x=>x?.status?.klarifikasi_menunggu?.length);renderClarifications(pending);}
  catch(e){content.innerHTML=head("Klarifikasi","") + `<div class="notice">${esc(errText(e))}</div>`;}
}
function renderClarifications(items){
  $("#clarification-count").hidden=!items.length;$("#clarification-count").textContent=items.length;
  content.innerHTML=`<div class="fade-in">${head("Klarifikasi","Tanggapi pertanyaan tambahan dari petugas.")}<div class="card card-pad">${items.length?items.map(x=>x.status.klarifikasi_menunggu.map(c=>`<div class="review-row"><span>${esc(x.id)} · ${esc(c.id)}</span>${statusBadge(c.status)}</div><p style="font-size:12px;line-height:1.6">${esc(c.pertanyaan||"Permintaan informasi tambahan")}</p><div class="field"><textarea id="clar-${esc(x.id)}-${esc(c.id)}" placeholder="Tulis jawaban..."></textarea><button class="btn btn-primary" data-clarify-assessment="${esc(x.id)}" data-clarify-id="${esc(c.id)}">Kirim Jawaban</button></div>`).join("")).join(""):empty("Tidak ada klarifikasi yang menunggu jawaban.")}</div></div>`;
}
async function sendClarificationFromList(id,cid){const a=$(`#clar-${CSS.escape(id)}-${CSS.escape(cid)}`)?.value.trim();if(!a){toast("Isi jawaban terlebih dahulu.");return;}try{await api(`/assessments/${encodeURIComponent(id)}/clarifications/${encodeURIComponent(cid)}/reply`,{method:"POST",body:{jawaban:a}});toast("Jawaban berhasil dikirim.");loadClarifications();}catch(e){toast(errText(e));}}
async function loadFollowup(){
  loading();try{const r=await api(`/assessments?nim=${encodeURIComponent(state.settings.nim)}`);state.history=pickArray(r);const details=await Promise.all(state.history.filter(x=>x.id).map(async x=>{try{const z=await api(`/assessments/${encodeURIComponent(x.id)}/status`);return {id:x.id,status:dataOf(z)};}catch{return null;}}));const found=details.filter(x=>x?.status?.tindak_lanjut);renderFollowup(found);}
  catch(e){content.innerHTML=head("Tindak Lanjut","") + `<div class="notice">${esc(errText(e))}</div>`;}
}
function renderFollowup(items){content.innerHTML=`<div class="fade-in">${head("Tindak Lanjut","Arahan setelah assessment ditinjau.")}<div class="card card-pad">${items.length?items.map(x=>{const f=x.status.tindak_lanjut;return `<div class="review-row"><span>Assessment</span><strong>${esc(x.id)}</strong></div><div class="review-row"><span>Jenis tindak lanjut</span><strong>${esc(f.jenis?.label||f.jenis||"—")}</strong></div><p style="font-size:12px;line-height:1.7">${esc(f.arahan||"—")}</p><div class="review-row"><span>Jadwal konsultasi</span><strong>${esc(f.jadwal_konsultasi?new Date(f.jadwal_konsultasi).toLocaleString("id-ID"):"Tidak ditentukan")}</strong></div><hr style="border:0;border-top:1px solid var(--line);margin:18px 0">`}).join(""):empty("Belum ada arahan tindak lanjut dari petugas.")}</div></div>`;}

function renderSettings(){
  const s=state.settings;
  content.innerHTML=`<div class="fade-in">${head("Pengaturan","Atur identitas mahasiswa dan koneksi API.")}<div class="settings-layout"><form class="card card-pad" id="settings-form">
    <h3 class="section-title">Identitas Mahasiswa</h3><p class="section-sub" style="margin-bottom:18px">Identitas ini dikirim saat membuat assessment.</p>
    <div class="field"><label>NIM</label><input name="nim" required maxlength="20" value="${esc(s.nim)}"></div>
    <div class="field"><label>Nama Lengkap</label><input name="nama" required maxlength="100" value="${esc(s.nama)}"></div>
    <div class="field"><label>Kelas</label><input name="kelas" required maxlength="20" value="${esc(s.kelas)}"></div>
    <div class="field"><label>Akun Pasien (sesuai token dosen)</label><select name="patient" required><option value="" ${!s.patient?"selected":""} disabled>Pilih akun dari dosen</option><option value="P-001" ${s.patient==="P-001"?"selected":""}>P-001</option><option value="P-002" ${s.patient==="P-002"?"selected":""}>P-002</option><option value="P-003" ${s.patient==="P-003"?"selected":""}>P-003</option></select></div>
    <div class="field"><label>Bearer Token</label><div style="display:flex;gap:7px"><input id="token-input" name="token" type="password" autocomplete="off" placeholder="Masukkan token dari dosen" value="${esc(s.token)}" style="flex:1"><button type="button" class="btn btn-ghost" id="toggle-token">Lihat</button></div><span class="hint">Pilih akun pasien yang memang ditetapkan untukmu oleh dosen. Masukkan token pasangannya; jangan bagikan token atau unggah ke repository publik.</span></div>
    <button class="btn btn-primary" type="submit">Simpan & Uji Koneksi</button>
  </form><aside class="settings-note"><strong>Informasi Koneksi</strong>API Telehealth<br><span style="word-break:break-all">https://telehealth.informatikaunimus.site/api</span><p>Token disimpan pada browser ini agar tidak perlu dimasukkan berulang kali. Token frontend tetap dapat terlihat melalui browser, jadi jangan gunakan token pribadi di website publik.</p><div id="settings-status" class="small">Status: ${getToken()?"Belum diuji":"Token belum diisi"}</div></aside></div></div>`;
}
async function testConnection(){
  if(!state.settings.nim||!state.settings.nama||!state.settings.kelas||!getToken()){
    const msg="Lengkapi NIM, nama, kelas, dan Bearer Token terlebih dahulu.";
    setConnection(false);$("#settings-status").textContent=msg;toast(msg);return;
  }
  try{const r=await api(`/me?nim=${encodeURIComponent(state.settings.nim)}`);state.profile=dataOf(r);setConnection(true,"Terhubung");$("#settings-status").textContent="Koneksi berhasil.";toast("Koneksi API berhasil.");}
  catch(e){setConnection(false);$("#settings-status").textContent=errText(e);toast(errText(e));}
}


async function loadUTS(){
  loading();
  try{
    const r=await api(`/uts/${encodeURIComponent(state.settings.nim)}`);
    renderUTS(dataOf(r));
  }catch(e){
    content.innerHTML=`<div class="fade-in">${head("Bukti Fitur UTS","Pantau fitur yang sudah terdeteksi oleh API.")}<div class="notice">${esc(errText(e))}</div><button class="btn btn-ghost" data-page="settings">Periksa identitas</button></div>`;
  }
}
function renderUTS(d){
  const list=d.bukti_fitur?.daftar||[];
  const achieved=d.bukti_fitur?.tercapai??0,total=d.bukti_fitur?.total??10;
  content.innerHTML=`<div class="fade-in">${head("Bukti Fitur UTS","Fitur tercatat otomatis ketika endpoint digunakan.")}<div class="card card-pad">
    <div class="card-head"><div><h3 class="section-title">Progress Fitur</h3><p class="section-sub">${achieved} dari ${total} fitur terdeteksi</p></div><strong style="font:800 22px Manrope;color:var(--blue)">${total?Math.round(achieved/total*100):0}%</strong></div>
    <div class="progress"><span style="width:${total?achieved/total*100:0}%"></span></div>
    <div style="margin-top:16px">${list.length?list.map(x=>`<div class="activity-row"><div class="activity-icon">${x.tercapai?"✓":"○"}</div><div class="activity-info"><strong>${esc(x.label||x.kode)}</strong><span>${esc(x.kode)}</span></div>${x.tercapai?'<span class="status green">Terdeteksi</span>':'<span class="status">Belum</span>'}</div>`).join(""):empty("Daftar bukti fitur belum tersedia.")}</div>
  </div>
  <div class="card card-pad" style="margin-top:14px"><h3 class="section-title">Status Penilaian</h3><div class="review-row"><span>NIM</span><strong>${esc(d.nim||state.settings.nim)}</strong></div><div class="review-row"><span>Nama</span><strong>${esc(d.nama||state.settings.nama)}</strong></div><div class="review-row"><span>Kelas</span><strong>${esc(d.kelas||state.settings.kelas)}</strong></div><div class="review-row"><span>Status</span>${statusBadge(d.penilaian?.status)}</div>${d.penilaian?.catatan?`<div class="notice">${esc(d.penilaian.catatan)}</div>`:""}</div></div>`;
}
async function render(){
  if(state.page==="dashboard")return loadDashboard();
  if(state.page==="forms")return loadForms();
  if(state.page==="history")return loadHistory();
  if(state.page==="results")return loadResults();
  if(state.page==="clarifications")return loadClarifications();
  if(state.page==="followup")return loadFollowup();
  if(state.page==="uts")return loadUTS();
  if(state.page==="settings")return renderSettings();
  if(state.page==="instructions")return renderInstructions();
  if(state.page==="assessment")return renderAssessment();
  if(state.page==="review")return renderReview();
}
document.addEventListener("click",async e=>{
  const p=e.target.closest("[data-page]");if(p){e.preventDefault();setPage(p.dataset.page);return;}
  const start=e.target.closest("[data-start-form]");if(start){await openInstructions(start.dataset.startForm);setPage("instructions");return;}
  const detail=e.target.closest("[data-detail]");if(detail){await openDetail(detail.dataset.detail);return;}
  const resume=e.target.closest("[data-resume]");if(resume){await resumeDraft(resume.dataset.resume);return;}
  const edit=e.target.closest("[data-edit-section]");if(edit){state.step=Number(edit.dataset.editSection);setPage("assessment");return;}
  const reply=e.target.closest("[data-reply]");if(reply){await sendReply(reply.dataset.reply);return;}
  const clar=e.target.closest("[data-clarify-id]");if(clar){await sendClarificationFromList(clar.dataset.clarifyAssessment,clar.dataset.clarifyId);return;}
  if(e.target.id==="begin-assessment"){await beginAssessment();}
  if(e.target.id==="prev-step")await moveStep(-1);
  if(e.target.id==="next-step")await moveStep(1);
  if(e.target.id==="save-draft")await saveDraft();
  if(e.target.id==="to-review")await validateAndReview();
  if(e.target.id==="back-form"){state.step=sections().length-1;setPage("assessment");}
  if(e.target.id==="submit-assessment")await submitAssessment();
  if(e.target.id==="toggle-token"){const i=$("#token-input");i.type=i.type==="password"?"text":"password";e.target.textContent=i.type==="password"?"Lihat":"Sembunyikan";}
});
document.addEventListener("change",e=>{
  if(e.target.matches("[data-answer]")){
    if(state.page==="assessment"){
      readAnswersFromDOM();
      // Jangan render ulang seluruh formulir saat pengguna memilih jawaban.
      // Render ulang hanya diperlukan setelah menekan tombol navigasi.
    }
    if(e.target.type==="radio"){ $$(`input[type="radio"][name="${CSS.escape(e.target.name)}"]`).forEach(x=>x.closest(".choice")?.classList.toggle("selected",x.checked)); }
    if(e.target.type==="checkbox")e.target.closest(".choice")?.classList.toggle("selected",e.target.checked);
  }
  if(e.target.id==="history-filter")filterHistory();
});
document.addEventListener("input",e=>{
  if(e.target.matches("[data-answer]")&&state.page==="assessment")readAnswersFromDOM();
  if(e.target.id==="history-search")filterHistory();
});
document.addEventListener("submit",async e=>{
  if(e.target.id==="settings-form"){
    e.preventDefault();const fd=new FormData(e.target);
    const nim=String(fd.get("nim")).trim().toUpperCase(),nama=String(fd.get("nama")).trim(),kelas=String(fd.get("kelas")).trim();
    if(!/^[A-Z0-9]{5,20}$/.test(nim)){toast("NIM harus 5–20 karakter huruf/angka.");return;}
    if(nama.length<3||nama.length>100){toast("Nama harus 3–100 karakter.");return;}
    if(!kelas||kelas.length>20){toast("Kelas wajib diisi, maksimal 20 karakter.");return;}
    state.settings={nim,nama,kelas,patient:fd.get("patient"),token:String(fd.get("token")).trim()};
    saveSettings();await testConnection();
  }
});
$("#menu-toggle").addEventListener("click",()=>{$("#sidebar").classList.toggle("open");$("#overlay").classList.toggle("show");});
$("#overlay").addEventListener("click",()=>{$("#sidebar").classList.remove("open");$("#overlay").classList.remove("show");});
saveSettings();setPage("dashboard");
