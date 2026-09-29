/* CLMIS OFFICIAL WEB APPLICATION
   Connect this frontend to a real Supabase project.
   Never put a Supabase service-role key here.
*/

const SUPABASE_URL = window.CLMIS_SUPABASE_URL || "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = window.CLMIS_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DOM = {
  authView: document.querySelector("#authView"),
  appView: document.querySelector("#appView"),
  loginForm: document.querySelector("#loginForm"),
  loginEmail: document.querySelector("#loginEmail"),
  loginPassword: document.querySelector("#loginPassword"),
  authMessage: document.querySelector("#authMessage"),
  studentRegisterBox: document.querySelector("#studentRegisterBox"),
  registerDialog: document.querySelector("#registerDialog"),
  registerForm: document.querySelector("#registerForm"),
  registerMessage: document.querySelector("#registerMessage"),
  page: document.querySelector("#page"),
  sideNav: document.querySelector("#sideNav"),
  logoutBtn: document.querySelector("#logoutBtn")
};

let state = {
  user: null,
  profile: null,
  role: "student",
  currentPage: "dashboard",
  attempt: null,
  attemptQuestions: [],
  timer: null,
  secondsLeft: 0
};

const domains = [
  "Microsoft Office Skills",
  "File and Folder Management",
  "Typing Skills",
  "Computer Troubleshooting",
  "Internet Browsing and Research"
];

const stageNames = {pre:"Pre-Test",mid:"Mid-Test",post:"Post-Test"};

function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function fmt(v){return v==null?"—":v}
function competency(score){
  if(score==null) return "not_yet_classified";
  if(score>=90) return "advanced";
  if(score>=70) return "intermediate";
  return "basic";
}
function prettyLevel(v){return v==="not_yet_classified"?"Not Yet Classified":v[0].toUpperCase()+v.slice(1)}
function badge(v){return `<span class="badge ${esc(v)}">${esc(prettyLevel(v))}</span>`}
function pct(n){return `${Number(n||0).toFixed(0)}%`}

function setMessage(el,msg,error=false){
  el.textContent=msg||"";
  el.style.color=error?"var(--danger)":"var(--warning)";
}

document.querySelectorAll(".role-tab").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".role-tab").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    state.role=btn.dataset.role;
    DOM.studentRegisterBox.classList.toggle("hidden",state.role!=="student");
  });
});

document.querySelector("#themeBtn").onclick=()=>document.body.classList.toggle("light");
document.querySelector("#accessBtn").onclick=()=>document.querySelector("#accessDialog").showModal();
document.querySelector("#closeAccess").onclick=()=>document.querySelector("#accessDialog").close();
document.querySelector("#closeAccess2").onclick=()=>document.querySelector("#accessDialog").close();
document.querySelector("#largeText").onchange=e=>document.body.classList.toggle("large-text",e.target.checked);
document.querySelector("#reducedMotion").onchange=e=>document.body.classList.toggle("reduce-motion",e.target.checked);

document.querySelector("#registerBtn").onclick=()=>DOM.registerDialog.showModal();
document.querySelector("#closeRegister").onclick=()=>DOM.registerDialog.close();
document.querySelector("#forgotBtn").onclick=async()=>{
  const email=DOM.loginEmail.value.trim();
  if(!email)return setMessage(DOM.authMessage,"Enter your email first.",true);
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.href});
  setMessage(DOM.authMessage,error?error.message:"Password reset instructions sent.");
};

DOM.loginForm.addEventListener("submit",async e=>{
  e.preventDefault();
  setMessage(DOM.authMessage,"Signing in...");
  const email=DOM.loginEmail.value.trim(), password=DOM.loginPassword.value;
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error)return setMessage(DOM.authMessage,error.message,true);
  await loadUser(data.user);
});

DOM.registerForm.addEventListener("submit",async e=>{
  e.preventDefault();
  setMessage(DOM.registerMessage,"Creating account...");
  const email=document.querySelector("#rUser").value.trim();
  const password=document.querySelector("#rPass").value;
  const meta={
    full_name:document.querySelector("#rFullName").value.trim(),
    role:"student"
  };
  const {data,error}=await sb.auth.signUp({email,password,data:meta});
  if(error)return setMessage(DOM.registerMessage,error.message,true);
  if(!data.user)return setMessage(DOM.registerMessage,"Check your email to confirm your account.");
  const id=data.user.id;
  const payload={
    id,
    student_number:document.querySelector("#rStudentNo").value.trim(),
    full_name:meta.full_name,
    age:Number(document.querySelector("#rAge").value),
    gender:document.querySelector("#rGender").value,
    grade_level:document.querySelector("#rGrade").value,
    section:document.querySelector("#rSection").value,
    email,
    role:"student",
    device_ownership:document.querySelector("#rOwnership").value,
    device_used:document.querySelector("#rDevice").value,
    internet_access:document.querySelector("#rInternet").value,
    daily_device_usage:document.querySelector("#rUsage").value,
    computer_experience:document.querySelector("#rExperience").value
  };
  const {error:pe}=await sb.from("profiles").upsert(payload);
  if(pe)return setMessage(DOM.registerMessage,pe.message,true);
  setMessage(DOM.registerMessage,"Account created. Check your email if confirmation is enabled.");
  DOM.registerForm.reset();
});

DOM.logoutBtn.onclick=()=>sb.auth.signOut();

sb.auth.onAuthStateChange(async(event,session)=>{
  if(session?.user && event!=="PASSWORD_RECOVERY") await loadUser(session.user);
  if(!session){state.user=null;state.profile=null;showAuth();}
});

async function loadUser(user){
  state.user=user;
  const {data,error}=await sb.from("profiles").select("*").eq("id",user.id).single();
  if(error){setMessage(DOM.authMessage,error.message,true);return}
  state.profile=data;
  state.role=data.role;
  showApp();
  renderNav();
  await renderPage();
}

function showAuth(){
  DOM.authView.classList.remove("hidden");
  DOM.appView.classList.add("hidden");
  DOM.logoutBtn.classList.add("hidden");
}
function showApp(){
  DOM.authView.classList.add("hidden");
  DOM.appView.classList.remove("hidden");
  DOM.logoutBtn.classList.remove("hidden");
}

function renderNav(){
  const student=[
    ["dashboard","🏠 Dashboard"],["assessment","📝 Assessment"],["classification","📊 Classification"],
    ["progress","📈 Progress"],["intervention","💡 Intervention"],["profile","👤 Profile"],["notifications","🔔 Notifications"]
  ];
  const staff=[
    ["dashboard","📊 Dashboard"],["students","👥 Students"],["question-bank","🧠 Question Bank"],
    ["schedules","📅 Schedules"],["analytics","📈 Class Analytics"],["interventions","💡 Interventions"],
    ["announcements","📢 Announcements"],["reports","📄 Reports"],["audit","🛡️ Audit Logs"]
  ];
  const admin=[
    ["dashboard","🛠️ Admin Dashboard"],["students","👥 Students"],["teachers","👨‍🏫 Teachers"],
    ["question-bank","🧠 Question Bank"],["schedules","📅 Schedules"],["analytics","📈 Analytics"],
    ["reports","📄 Reports"],["audit","🛡️ Audit Logs"],["settings","⚙️ System Settings"]
  ];
  const items=state.role==="student"?student:state.role==="admin"?admin:staff;
  DOM.sideNav.innerHTML=items.map(([id,label])=>`<button class="nav-btn ${state.currentPage===id?"active":""}" data-page="${id}">${label}</button>`).join("");
  DOM.sideNav.querySelectorAll("button").forEach(b=>b.onclick=async()=>{state.currentPage=b.dataset.page;renderNav();await renderPage()});
}

async function renderPage(){
  if(state.role==="student") return renderStudentPage();
  return renderStaffPage();
}

async function renderStudentPage(){
  const pages={
    dashboard:studentDashboard,assessment:studentAssessment,classification:studentClassification,
    progress:studentProgress,intervention:studentIntervention,profile:studentProfile,notifications:studentNotifications
  };
  DOM.page.innerHTML=await (pages[state.currentPage]||studentDashboard)();
  bindPage();
}

async function studentDashboard(){
  const {data:attempts=[]}=await sb.from("assessment_attempts").select("*").eq("student_id",state.user.id).order("started_at");
  const completed=attempts.filter(a=>a.status==="submitted");
  const latest=completed.at(-1);
  const scores=completed.map(a=>Number(a.score));
  const avg=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0;
  const pre=completed.find(a=>a.stage==="pre"), post=completed.find(a=>a.stage==="post");
  const improvement=pre&&post?Number(post.score)-Number(pre.score):0;
  return `
  <div class="page-head"><div><p class="eyebrow">STUDENT DASHBOARD</p><h1>Welcome, ${esc(state.profile.full_name)}</h1><p class="muted">${esc(state.profile.grade_level)} — ${esc(state.profile.section)}</p></div></div>
  <div class="grid four">
    <div class="card stat"><div class="label">Overall Score</div><div class="value accent">${pct(avg)}</div><div class="muted">Based on completed assessments</div></div>
    <div class="card stat"><div class="label">Current Level</div><div class="value">${badge(latest?.competency||"not_yet_classified")}</div></div>
    <div class="card stat"><div class="label">Progress</div><div class="value">${pct(completed.length/3*100)}</div><div class="progress"><span style="width:${completed.length/3*100}%"></span></div></div>
    <div class="card stat"><div class="label">Improvement</div><div class="value ${improvement>=0?"success":"danger-text"}">${improvement>=0?"+":""}${improvement.toFixed(0)} pts</div><div class="muted">Pre-Test to Post-Test</div></div>
  </div>
  <div class="grid two" style="margin-top:16px">
    <div class="card"><h2>Assessment Journey</h2>${["pre","mid","post"].map(s=>{const a=completed.find(x=>x.stage===s);return `<div style="margin:16px 0"><div class="row-between"><strong>${stageNames[s]}</strong><span>${a?pct(a.score):"Not completed"}</span></div><div class="progress"><span style="width:${a?Number(a.score):0}%"></span></div></div>`}).join("")}</div>
    <div class="card"><h2>Quick Actions</h2><div class="grid"><button class="btn primary" data-go="assessment">Take Available Assessment</button><button class="btn secondary" data-go="classification">View Skill Classification</button><button class="btn secondary" data-go="intervention">View My Interventions</button></div></div>
  </div>`;
}

async function studentAssessment(){
  const {data:attempts=[]}=await sb.from("assessment_attempts").select("*").eq("student_id",state.user.id);
  const stages=["pre","mid","post"];
  return `<div class="page-head"><div><p class="eyebrow">ASSESSMENT CENTER</p><h1>Computer Literacy Assessment</h1><p class="muted">20 questions per stage • 5 domains • automatic scoring</p></div></div>
  <div class="grid three">${stages.map(s=>{
    const a=attempts.find(x=>x.stage===s);
    const available=!a || a.status==="authorized_retake";
    return `<div class="card"><p class="eyebrow">${stageNames[s]}</p><h2>${s==="pre"?"Fundamental":s==="mid"?"Developing":"Advanced"}</h2><p class="muted">20 questions • 4 per domain</p>${a?.status==="submitted"?`<p>${badge(a.competency)} <strong>${pct(a.score)}</strong></p>`:`<p class="notice">${available?"Ready when scheduled":"Not yet available"}</p>`}${available?`<button class="btn primary wide start-assessment" data-stage="${s}">${a?"Retake Assessment":"Start Assessment"}</button>`:""}</div>`
  }).join("")}</div>
  <div class="card" style="margin-top:16px"><h2>Assessment Rules</h2><ul><li>Submitted answers cannot be changed.</li><li>Question order and choices may be randomized.</li><li>Results are securely recorded for authorized educational monitoring.</li><li>Your assessment record contains the three stages: Pre-Test, Mid-Test, and Post-Test.</li></ul></div>`;
}

async function startAssessment(stage){
  const {data:existing}=await sb.from("assessment_attempts").select("*").eq("student_id",state.user.id).eq("stage",stage).maybeSingle();
  if(existing?.status==="submitted" && existing?.status!=="authorized_retake") return;
  let attempt=existing;
  if(!attempt){
    const {data,error}=await sb.from("assessment_attempts").insert({student_id:state.user.id,stage,status:"in_progress"}).select().single();
    if(error)return alert(error.message); attempt=data;
  }else if(existing.status==="authorized_retake"){
    const {data,error}=await sb.from("assessment_attempts").update({status:"in_progress",started_at:new Date().toISOString(),submitted_at:null,score:0,correct_count:0,competency:"not_yet_classified"}).eq("id",existing.id).select().single();
    if(error)return alert(error.message);attempt=data;
  }
  const {data:qs,error}=await sb.from("questions").select("id,stage,domain,difficulty,question_text,choices").eq("stage",stage).eq("status","active");
  if(error)return alert(error.message);
  const grouped={};qs.forEach(q=>(grouped[q.domain]??=[]).push(q));
  let selected=[];
  domains.forEach(d=>{selected.push(...(grouped[d]||[]).sort(()=>Math.random()-.5).slice(0,4))});
  selected=selected.sort(()=>Math.random()-.5);
  const rows=selected.map((q,i)=>({attempt_id:attempt.id,question_id:q.id,question_order:i+1,displayed_choices:shuffle(q.choices)}));
  await sb.from("attempt_questions").upsert(rows,{onConflict:"attempt_id,question_id"});
  state.attempt=attempt;state.attemptQuestions=selected.map((q,i)=>({...q,question_order:i+1,selected_answer:null,displayed_choices:rows[i].displayed_choices}));
  state.currentPage="assessment-live";renderNav();await renderLiveAssessment(stage);
}

function shuffle(arr){return [...arr].sort(()=>Math.random()-.5)}

async function renderLiveAssessment(stage){
  DOM.page.innerHTML=`<div class="page-head"><div><p class="eyebrow">${stageNames[stage]}</p><h1>Assessment in Progress</h1><p class="muted">Your answers are autosaved.</p></div><div class="timer" id="timer">--:--</div></div>
  <form id="assessmentForm">
  ${state.attemptQuestions.map((q,i)=>`<div class="card question"><p class="eyebrow">QUESTION ${i+1} • ${esc(q.domain)}</p><h3>${esc(q.question_text)}</h3>${q.displayed_choices.map(c=>`<label class="choice"><input type="radio" name="q-${q.id}" value="${esc(c)}"> ${esc(c)}</label>`).join("")}</div>`).join("")}
  <button class="btn primary wide" type="submit">Submit Assessment</button>
  </form>`;
  let minutes=30;
  const {data:sched}=await sb.from("assessment_schedules").select("duration_minutes").eq("stage",stage).eq("is_active",true).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(sched?.duration_minutes)minutes=sched.duration_minutes;
  state.secondsLeft=minutes*60;
  clearInterval(state.timer);
  state.timer=setInterval(async()=>{
    state.secondsLeft--;
    const el=document.querySelector("#timer");
    if(el)el.textContent=`${String(Math.floor(state.secondsLeft/60)).padStart(2,"0")}:${String(state.secondsLeft%60).padStart(2,"0")}`;
    if(state.secondsLeft<=0){clearInterval(state.timer);await submitAssessment(stage,true);}
  },1000);
  document.querySelector("#assessmentForm").addEventListener("change",saveAnswer);
  document.querySelector("#assessmentForm").addEventListener("submit",async e=>{e.preventDefault();await submitAssessment(stage,false)});
}

async function saveAnswer(e){
  if(!e.target.matches("input[type=radio]"))return;
  const qid=e.target.name.replace("q-","");
  await sb.from("attempt_questions").update({selected_answer:e.target.value,saved_at:new Date().toISOString()}).eq("attempt_id",state.attempt.id).eq("question_id",qid);
}

async function submitAssessment(stage,expired=false){
  clearInterval(state.timer);
  const {data:answers}=await sb.from("attempt_questions").select("*, questions(*)").eq("attempt_id",state.attempt.id);
  let correct=0;
  const domainCounts={};
  for(const a of answers||[]){
    const right=a.selected_answer===a.questions.correct_answer;
    if(right)correct++;
    domainCounts[a.questions.domain]??={correct:0,total:0};
    domainCounts[a.questions.domain].total++;
    if(right)domainCounts[a.questions.domain].correct++;
    await sb.from("attempt_questions").update({is_correct:right}).eq("id",a.id);
  }
  const total=answers?.length||20, score=correct/total*100, level=competency(score);
  await sb.from("assessment_attempts").update({submitted_at:new Date().toISOString(),score,correct_count:correct,competency:level,status:expired?"expired":"submitted"}).eq("id",state.attempt.id);
  for(const [domain,v] of Object.entries(domainCounts)){
    await sb.from("domain_scores").upsert({attempt_id:state.attempt.id,domain,correct_count:v.correct,question_count:v.total,score:v.correct/v.total*100},{onConflict:"attempt_id,domain"});
  }
  await sb.from("audit_logs").insert({actor_id:state.user.id,action:"assessment_submitted",target_type:"assessment_attempt",target_id:state.attempt.id,metadata:{stage,score}});
  state.currentPage="classification";state.attempt=null;state.attemptQuestions=[];renderNav();await renderPage();
}

async function studentClassification(){
  const {data:attempts=[]}=await sb.from("assessment_attempts").select("*").eq("student_id",state.user.id).eq("status","submitted").order("started_at",{ascending:false});
  const latest=attempts[0];
  let scores=[];
  if(latest){const r=await sb.from("domain_scores").select("*").eq("attempt_id",latest.id);scores=r.data||[]}
  const avg=scores.length?scores.reduce((a,b)=>a+Number(b.score),0)/scores.length:0;
  const mastered=scores.filter(x=>Number(x.score)>=70), improve=scores.filter(x=>Number(x.score)<70);
  return `<div class="page-head"><div><p class="eyebrow">CLASSIFICATION</p><h1>My Computer Literacy Profile</h1><p class="muted">Latest completed assessment</p></div></div>
  <div class="grid three"><div class="card stat"><div class="label">Overall</div><div class="value">${latest?pct(latest.score):"0%"}</div></div><div class="card stat"><div class="label">Competency</div><div class="value">${badge(latest?.competency||"not_yet_classified")}</div></div><div class="card stat"><div class="label">Next Goal</div><div class="value">${latest?nextGoal(Number(latest.score)):"Complete Pre-Test"}</div></div></div>
  <div class="card" style="margin-top:16px"><h2>Skill Areas</h2>${domains.map(d=>{const s=scores.find(x=>x.domain===d);return `<div style="margin:17px 0"><div class="row-between"><strong>${esc(d)}</strong><span>${s?pct(s.score):"—"}</span></div><div class="progress"><span style="width:${s?.score||0}%"></span></div></div>`}).join("")}</div>
  <div class="grid two" style="margin-top:16px"><div class="card"><h2>Mastered Skills</h2>${mastered.length?mastered.map(x=>`<p class="success">✓ ${esc(x.domain)} — ${pct(x.score)}</p>`).join(""):"<p class='muted'>No mastered domains recorded yet.</p>"}</div><div class="card"><h2>Skills Needing Improvement</h2>${improve.length?improve.map(x=>`<p class="warning">⚠ ${esc(x.domain)} — ${pct(x.score)}</p>`).join(""):"<p class='success'>No domain currently below 70%.</p>"}</div></div>`;
}
function nextGoal(s){if(s<70)return `${Math.ceil(70-s)} pts to Intermediate`;if(s<90)return `${Math.ceil(90-s)} pts to Advanced`;return "Advanced achieved"}

async function studentProgress(){
  const {data:attempts=[]}=await sb.from("assessment_attempts").select("*").eq("student_id",state.user.id).order("started_at");
  return `<div class="page-head"><div><p class="eyebrow">PROGRESS TRACKER</p><h1>Assessment Progress</h1></div></div><div class="card"><div class="chart">${["pre","mid","post"].map(s=>{const a=attempts.find(x=>x.stage===s&&x.status==="submitted");const h=a?Math.max(5,Number(a.score)*2):5;return `<div class="bar" style="height:${h}px"><small>${stageNames[s]}<br>${a?pct(a.score):"—"}</small></div>`}).join("")}</div></div><div class="card" style="margin-top:16px"><h2>Assessment History</h2>${table(["Stage","Score","Level","Submitted"],attempts.filter(a=>a.status==="submitted").map(a=>[stageNames[a.stage],pct(a.score),badge(a.competency),new Date(a.submitted_at).toLocaleString()]))}</div>`;
}

async function studentIntervention(){
  const {data=[]}=await sb.from("interventions").select("*").eq("student_id",state.user.id).order("assigned_at",{ascending:false});
  return `<div class="page-head"><div><p class="eyebrow">INTERVENTION</p><h1>My Improvement Plan</h1><p class="muted">Recommendations are linked to areas requiring improvement.</p></div></div>${data.length?`<div class="grid two">${data.map(x=>`<div class="card"><p class="eyebrow">${esc(x.domain)}</p><h2>${esc(x.title)}</h2><p class="muted">${esc(x.description||"")}</p><p>${badge(x.status)}</p>${x.resource_url?`<a class="btn secondary" target="_blank" rel="noopener" href="${esc(x.resource_url)}">Open Learning Resource</a>`:""}${x.status!=="completed"?`<button class="btn primary mark-complete" data-id="${x.id}">Mark Completed</button>`:""}</div>`).join("")}</div>`:`<div class="card"><h2>No interventions assigned</h2><p class="muted">Your intervention recommendations will appear here after assessment results are reviewed.</p></div>`}`;
}

async function studentProfile(){
  const p=state.profile;
  return `<div class="page-head"><div><p class="eyebrow">PROFILE</p><h1>Student Profile</h1></div></div><div class="card"><div class="grid two">${Object.entries({Name:p.full_name,"Student Number":p.student_number,Age:p.age,Gender:p.gender,"Grade Level":p.grade_level,Section:p.section,Email:p.email,"Device Ownership":p.device_ownership,"Device Used":p.device_used,"Internet Access":p.internet_access,"Daily Usage":p.daily_device_usage,"Computer Experience":p.computer_experience}).map(([k,v])=>`<div><div class="muted">${esc(k)}</div><strong>${esc(fmt(v))}</strong></div>`).join("")}</div><hr><button class="btn secondary" id="editProfile">Edit Eligible Profile Details</button></div>`;
}

async function studentNotifications(){
  const {data=[]}=await sb.from("notifications").select("*").eq("recipient_id",state.user.id).order("created_at",{ascending:false});
  return `<div class="page-head"><div><p class="eyebrow">NOTIFICATIONS</p><h1>Notifications</h1></div></div><div class="grid">${data.length?data.map(n=>`<div class="card"><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><small class="muted">${new Date(n.created_at).toLocaleString()}</small></div>`).join(""):`<div class="card"><p class="muted">No notifications.</p></div>`}</div>`;
}

async function renderStaffPage(){
  const pages={
    dashboard:staffDashboard,students:staffStudents,"question-bank":questionBank,schedules:staffSchedules,
    analytics:staffAnalytics,interventions:staffInterventions,announcements:staffAnnouncements,reports:staffReports,
    audit:staffAudit,teachers:staffTeachers,settings:staffSettings
  };
  DOM.page.innerHTML=await (pages[state.currentPage]||staffDashboard)();
  bindPage();
}

async function staffDashboard(){
  const [{data:students=[]},{data:attempts=[]}]=await Promise.all([
    sb.from("profiles").select("id,role,section").eq("role","student"),
    sb.from("assessment_attempts").select("score,competency,status,student_id")
  ]);
  const submitted=attempts.filter(a=>a.status==="submitted"), avg=submitted.length?submitted.reduce((a,b)=>a+Number(b.score),0)/submitted.length:0;
  return `<div class="page-head"><div><p class="eyebrow">${state.role.toUpperCase()} DASHBOARD</p><h1>CLMIS Control Center</h1><p class="muted">Live data from registered users and assessment records.</p></div></div>
  <div class="grid four"><div class="card stat"><div class="label">Students</div><div class="value">${students.length}</div></div><div class="card stat"><div class="label">Advanced</div><div class="value success">${submitted.filter(a=>a.competency==="advanced").length}</div></div><div class="card stat"><div class="label">Intermediate</div><div class="value warning">${submitted.filter(a=>a.competency==="intermediate").length}</div></div><div class="card stat"><div class="label">Class Average</div><div class="value accent">${pct(avg)}</div></div></div>
  <div class="grid two" style="margin-top:16px"><div class="card"><h2>System Modules</h2><ul><li>Student monitoring</li><li>Question bank</li><li>Assessment schedules</li><li>Intervention management</li><li>Class analytics</li><li>Reports and exports</li><li>Audit logging</li></ul></div><div class="card"><h2>Security</h2><p class="muted">Role-based access is enforced through Supabase authentication and database Row Level Security. Administrative access is not secured by URL hiding alone.</p></div></div>`;
}

async function staffStudents(){
  const {data=[]}=await sb.from("profiles").select("*").eq("role","student").order("full_name");
  return `<div class="page-head"><div><p class="eyebrow">STUDENT DIRECTORY</p><h1>Students</h1></div><input id="studentSearch" placeholder="Search name, student number, section..."></div>
  <div class="card table-wrap"><table class="table"><thead><tr><th>Name</th><th>Student No.</th><th>Section</th><th>Email</th><th>Action</th></tr></thead><tbody id="studentRows">${data.map(s=>`<tr data-search="${esc((s.full_name+" "+s.student_number+" "+s.section).toLowerCase())}"><td>${esc(s.full_name)}</td><td>${esc(s.student_number||"")}</td><td>${esc(s.grade_level)} – ${esc(s.section)}</td><td>${esc(s.email||"")}</td><td><button class="btn secondary view-student" data-id="${s.id}">View</button></td></tr>`).join("")}</tbody></table></div>`;
}

async function viewStudent(id){
  const {data:p}=await sb.from("profiles").select("*").eq("id",id).single();
  const {data:a=[]}=await sb.from("assessment_attempts").select("*").eq("student_id",id).order("started_at");
  const {data:i=[]}=await sb.from("interventions").select("*").eq("student_id",id);
  DOM.page.innerHTML=`<div class="page-head"><div><p class="eyebrow">INDIVIDUAL STUDENT REPORT</p><h1>${esc(p.full_name)}</h1></div><button class="btn primary" id="printReport">Print / Save PDF</button></div>
  <div class="grid three"><div class="card"><strong>${esc(p.student_number)}</strong><p class="muted">Student Number</p></div><div class="card"><strong>${esc(p.grade_level)} – ${esc(p.section)}</strong><p class="muted">Section</p></div><div class="card"><strong>${esc(p.email||"")}</strong><p class="muted">Email</p></div></div>
  <div class="card" style="margin-top:16px"><h2>Assessment History</h2>${table(["Stage","Score","Level","Status"],a.map(x=>[stageNames[x.stage],pct(x.score),badge(x.competency),x.status]))}</div>
  <div class="card" style="margin-top:16px"><h2>Interventions</h2>${i.length?i.map(x=>`<p>${esc(x.domain)} — ${esc(x.title)} — ${badge(x.status)}</p>`).join(""):"<p class='muted'>None</p>"}</div>`;
  document.querySelector("#printReport").onclick=()=>window.print();
}

async function questionBank(){
  const {data=[]}=await sb.from("questions").select("*").order("created_at",{ascending:false});
  return `<div class="page-head"><div><p class="eyebrow">QUESTION BANK</p><h1>Assessment Questions</h1><p class="muted">Teachers can add, edit, activate/deactivate, categorize, and manage questions.</p></div><button class="btn primary" id="newQuestion">+ Add Question</button></div>
  <div class="card table-wrap"><table class="table"><thead><tr><th>Question</th><th>Stage</th><th>Domain</th><th>Difficulty</th><th>Status</th><th>Action</th></tr></thead><tbody>${data.map(q=>`<tr><td>${esc(q.question_text)}</td><td>${stageNames[q.stage]}</td><td>${esc(q.domain)}</td><td>${esc(q.difficulty)}</td><td>${esc(q.status)}</td><td><button class="btn secondary edit-question" data-id="${q.id}">Edit</button></td></tr>`).join("")}</tbody></table></div>`;
}

async function staffSchedules(){
  const {data=[]}=await sb.from("assessment_schedules").select("*").order("created_at",{ascending:false});
  return `<div class="page-head"><div><p class="eyebrow">ASSESSMENT SCHEDULING</p><h1>Schedules</h1></div><button class="btn primary" id="newSchedule">+ New Schedule</button></div><div class="card table-wrap">${table(["Stage","Title","Start","End","Duration","Active"],data.map(x=>[stageNames[x.stage],esc(x.title),fmt(x.starts_at),fmt(x.ends_at),x.duration_minutes?x.duration_minutes+" min":"Default",x.is_active?"Yes":"No"]))}</div>`;
}

async function staffAnalytics(){
  const {data=[]}=await sb.from("domain_scores").select("domain,score");
  const by={};domains.forEach(d=>by[d]=[]);
  data.forEach(x=>{if(by[x.domain])by[x.domain].push(Number(x.score))});
  const avgs=domains.map(d=>[d,by[d].length?by[d].reduce((a,b)=>a+b,0)/by[d].length:0]);
  return `<div class="page-head"><div><p class="eyebrow">CLASS ANALYTICS</p><h1>Performance Overview</h1></div></div>
  <div class="card"><h2>Domain Averages</h2><div class="chart">${avgs.map(([d,v])=>`<div class="bar" style="height:${Math.max(5,v*2)}px"><small>${esc(d.replace(" Skills","").replace(" and "," & "))}<br>${pct(v)}</small></div>`).join("")}</div></div>
  <div class="card" style="margin-top:16px"><h2>Class Performance Heatmap</h2><div class="heat">${avgs.map(([d,v])=>`<div class="heat-cell" style="background:rgba(85,183,255,${Math.max(.06,v/140)})"><strong>${pct(v)}</strong><br><small>${esc(d)}</small></div>`).join("")}</div></div>`;
}

async function staffInterventions(){
  const {data=[]}=await sb.from("interventions").select("*,profiles!interventions_student_id_fkey(full_name,student_number)").order("assigned_at",{ascending:false});
  return `<div class="page-head"><div><p class="eyebrow">INTERVENTION MANAGEMENT</p><h1>Student Intervention Plans</h1></div><button class="btn primary" id="assignIntervention">+ Assign Intervention</button></div><div class="card table-wrap">${table(["Student","Domain","Intervention","Status","Assigned"],data.map(x=>[esc(x.profiles?.full_name||""),esc(x.domain),esc(x.title),badge(x.status),new Date(x.assigned_at).toLocaleString()]))}</div>`;
}

async function staffAnnouncements(){
  const {data=[]}=await sb.from("announcements").select("*").order("created_at",{ascending:false});
  return `<div class="page-head"><div><p class="eyebrow">ANNOUNCEMENTS</p><h1>School System Notices</h1></div><button class="btn primary" id="newAnnouncement">+ New Announcement</button></div><div class="grid">${data.map(x=>`<div class="card"><h2>${esc(x.title)}</h2><p>${esc(x.body)}</p><small class="muted">${new Date(x.created_at).toLocaleString()}</small></div>`).join("")}</div>`;
}

async function staffReports(){
  return `<div class="page-head"><div><p class="eyebrow">REPORT CENTER</p><h1>Reports & Exports</h1><p class="muted">Generate printable reports or export current authorized data.</p></div></div>
  <div class="grid three"><div class="card"><h2>Class CSV</h2><p class="muted">Export student and assessment records.</p><button class="btn primary" id="exportCSV">Export CSV</button></div><div class="card"><h2>Printable Report</h2><p class="muted">Select a student from the directory and print/save as PDF.</p><button class="btn secondary" data-go="students">Open Students</button></div><div class="card"><h2>Analytics</h2><p class="muted">View class competency and domain performance.</p><button class="btn secondary" data-go="analytics">Open Analytics</button></div></div>`;
}

async function staffAudit(){
  const {data=[]}=await sb.from("audit_logs").select("*").order("created_at",{ascending:false}).limit(200);
  return `<div class="page-head"><div><p class="eyebrow">SECURITY</p><h1>Audit Logs</h1><p class="muted">Records important authenticated system actions.</p></div></div><div class="card table-wrap">${table(["Action","Actor","Target","Time"],data.map(x=>[esc(x.action),esc(x.actor_id||""),esc(x.target_type||""),new Date(x.created_at).toLocaleString()]))}</div>`;
}

async function staffTeachers(){
  const {data=[]}=await sb.from("profiles").select("*").eq("role","teacher").order("full_name");
  return `<div class="page-head"><div><p class="eyebrow">TEACHER MANAGEMENT</p><h1>Teachers</h1></div></div><div class="card table-wrap">${table(["Name","Email","Section"],data.map(x=>[esc(x.full_name),esc(x.email||""),esc(x.section||"")]))}</div>`;
}

async function staffSettings(){
  return `<div class="page-head"><div><p class="eyebrow">SYSTEM SETTINGS</p><h1>CLMIS Settings</h1></div></div><div class="grid two"><div class="card"><h2>Classification</h2><p>Advanced: 90–100%</p><p>Intermediate: 70–89%</p><p>Basic: below 70%</p></div><div class="card"><h2>Assessment Structure</h2><p>Pre-Test: 20 items</p><p>Mid-Test: 20 items</p><p>Post-Test: 20 items</p><p>Five domains × four questions.</p></div></div>`;
}

function table(headers,rows){
  return `<div class="table-wrap"><table class="table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function bindPage(){
  document.querySelectorAll("[data-go]").forEach(b=>b.onclick=async()=>{state.currentPage=b.dataset.go;renderNav();await renderPage()});
  document.querySelectorAll(".start-assessment").forEach(b=>b.onclick=()=>startAssessment(b.dataset.stage));
  document.querySelectorAll(".mark-complete").forEach(b=>b.onclick=async()=>{await sb.from("interventions").update({status:"completed",completed_at:new Date().toISOString()}).eq("id",b.dataset.id);await renderPage()});
  document.querySelectorAll(".view-student").forEach(b=>b.onclick=()=>viewStudent(b.dataset.id));
  const search=document.querySelector("#studentSearch");
  if(search)search.oninput=()=>document.querySelectorAll("#studentRows tr").forEach(r=>r.style.display=r.dataset.search.includes(search.value.toLowerCase())?"":"none");
  const print=document.querySelector("#printReport");if(print)print.onclick=()=>window.print();
  const exportBtn=document.querySelector("#exportCSV");if(exportBtn)exportBtn.onclick=exportClassCSV;
}

async function exportClassCSV(){
  const [{data:p=[]},{data:a=[]}]=await Promise.all([
    sb.from("profiles").select("student_number,full_name,grade_level,section,email").eq("role","student"),
    sb.from("assessment_attempts").select("student_id,stage,score,competency,status")
  ]);
  const map={};p.forEach(x=>map[x.id]=x);
  const rows=[["Student Number","Full Name","Grade","Section","Email","Stage","Score","Competency","Status"]];
  for(const x of a){const s=map[x.student_id]||{};rows.push([s.student_number,s.full_name,s.grade_level,s.section,s.email,x.stage,x.score,x.competency,x.status])}
  const csv=rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv"}),url=URL.createObjectURL(blob),aEl=document.createElement("a");
  aEl.href=url;aEl.download="CLMIS_Class_Report.csv";aEl.click();URL.revokeObjectURL(url);
}

document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){document.querySelectorAll("dialog[open]").forEach(d=>d.close())}
});

(async()=>{
  if(SUPABASE_URL.includes("YOUR_")){
    setMessage(DOM.authMessage,"Connect CLMIS to your Supabase project in app.js before using the live system.",true);
  }
  const {data}=await sb.auth.getSession();
  if(data.session) await loadUser(data.session.user);
})();
