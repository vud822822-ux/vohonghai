// =================== KIỂM TRA – thiết lập, random, timer, sidebar phải 5x5 + cờ ===================
const btnKiemtra = document.getElementById("btnKiemtra");
btnKiemtra.addEventListener("click", startKiemtra);

function startKiemtra(){
  const bank = (window.getQuestions && window.getQuestions()) || [];
  if(!bank.length){ alert("Chưa có dữ liệu."); return; }

  const { hideMainPanels, removeSidebar, buildSidebar, showResultModal } = window.UI;
  hideMainPanels();
  removeSidebar();

  const content = document.getElementById("content");
  content.innerHTML = "";

  // Thiết lập
  const card = document.createElement("div");
  card.className = "config-card";
  card.innerHTML = `
    <h2 style="margin:0 0 10px 0">Thiết lập bài kiểm tra</h2>
    <div class="form-grid">
      <div class="form-row">
        <label for="num-questions">Số câu (tối đa ${bank.length})</label>
        <input id="num-questions" type="number" min="1" max="${bank.length}" placeholder="Ví dụ: 20" />
      </div>
      <div class="form-row">
        <label for="time-mins">Thời gian (phút)</label>
        <input id="time-mins" type="number" min="1" max="999" placeholder="Ví dụ: 30" />
      </div>
      <div class="form-row" style="grid-column:1/-1">
        <label>Tùy chọn</label>
        <div class="checks">
          <label style="display:flex;align-items:center;gap:8px">
            <input id="opt-shuffle-choices" type="checkbox" />
            Đảo đáp án trong câu
          </label>
          <label style="display:flex;align-items:center;gap:8px">
            <input id="opt-shuffle-questions" type="checkbox" />
            Đảo thứ tự các câu
          </label>
        </div>
      </div>
    </div>
    <div class="actions">
      <button id="btnCreateExam" class="btn create" disabled>Tạo bài kiểm tra</button>
    </div>
  `;
  content.appendChild(card);

  const elNum = card.querySelector("#num-questions");
  const elMins = card.querySelector("#time-mins");
  const elBtn = card.querySelector("#btnCreateExam");
  const elShufChoices = card.querySelector("#opt-shuffle-choices");
  const elShufQuestions = card.querySelector("#opt-shuffle-questions");

  function validate(){
    const n=+elNum.value, t=+elMins.value;
    elBtn.disabled = !(Number.isInteger(n)&&n>=1&&n<=bank.length && Number.isInteger(t)&&t>=1);
  }
  ["input","change"].forEach(ev=>{
    elNum.addEventListener(ev, validate);
    elMins.addEventListener(ev, validate);
  });

  elBtn.addEventListener("click", ()=>{
    const N = +elNum.value|0;
    const mins = +elMins.value|0;
    const optChoices = !!elShufChoices.checked;
    const optQuestions = !!elShufQuestions.checked;
    launchExam({ bank, N, mins, optChoices, optQuestions, buildSidebar, showResultModal });
  });
}

/* Utils */
function clone(x){ return JSON.parse(JSON.stringify(x)); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } }

/* Run exam */
function launchExam({ bank, N, mins, optChoices, optQuestions, buildSidebar, showResultModal }){
  window.UI.removeSidebar();

  const content = document.getElementById("content");
  content.innerHTML="";

  const pool = clone(bank); shuffle(pool);
  let qs = pool.slice(0, N);
  if(optQuestions) shuffle(qs);
  if(optChoices){
    qs = qs.map(q=>{
      const arr = q.choices.map((c,idx)=>({ ...c, __i:idx }));
      shuffle(arr);
      return { ...q, choices: arr.map(({__i, ...rest})=>rest) };
    });
  }

  let currentIndex=0;
  let answers = Array(qs.length).fill(null);
  let flags = Array(qs.length).fill(false);
  const pageSize=25; let page=0;

  // timer
  const timer = document.getElementById("globalTimer");
  timer.classList.remove("hidden");
  let remaining = mins*60, timerId=null;
  function fmt(s){ const m=Math.floor(s/60), ss=s%60; return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; }
  function tick(){
    timer.textContent = `Thời gian còn lại: ${fmt(remaining)}`;
    remaining--;
    if(remaining<0){ clearInterval(timerId); timer.classList.add("hidden"); submit(true); }
  }
  tick(); timerId=setInterval(tick,1000);

  // sidebar
  const sidebar = buildSidebar(
    qs.length, pageSize,
    ()=>page, (p)=>{ page=p; renderSidebar(); },
    (i)=>onJump(i),
    (i)=>toggleFlag(i),
    ()=>answers,
    ()=>flags
  );
  document.body.appendChild(sidebar.root);

  // exam view
  const wrap=document.createElement("div");
  wrap.className="exam-wrap";
  const exam=document.createElement("div");
  exam.className="exam";
  wrap.appendChild(exam);

  function renderQuestion(){
    exam.innerHTML="";
    const q=qs[currentIndex];

    const title=document.createElement("h3");
    title.textContent=`Câu ${currentIndex+1}: ${q.text}`;
    exam.appendChild(title);

    q.choices.forEach((c,ci)=>{
      const lab=document.createElement("label");
      lab.className="choice";
      const inp=document.createElement("input");
      inp.type="radio"; inp.name="q"; inp.value=ci;
      if(answers[currentIndex]===ci) inp.checked=true;
      inp.addEventListener("change", ()=>{ answers[currentIndex]=ci; renderSidebarGrid(); });
      lab.appendChild(inp);
      lab.append(c.text);
      exam.appendChild(lab);
    });

    const nav=document.createElement("div");
    nav.className="exam-nav";
    const btnPrev=document.createElement("button");
    btnPrev.textContent="◀ Quay lại"; btnPrev.className="btn";
    const btnNext=document.createElement("button");
    btnNext.textContent="Tiếp theo ▶"; btnNext.className="btn";

    btnPrev.disabled = currentIndex===0;
    btnNext.disabled = currentIndex===qs.length-1;

    btnPrev.addEventListener("click", ()=>{ if(currentIndex>0){ currentIndex--; ensurePage(); renderAll(); }});
    btnNext.addEventListener("click", ()=>{ if(currentIndex<qs.length-1){ currentIndex++; ensurePage(); renderAll(); }});

    nav.appendChild(btnPrev); nav.appendChild(btnNext);
    exam.appendChild(nav);

    // Nút nộp bài trực tiếp trong .exam
    const btnSubmit=document.createElement("button");
    btnSubmit.textContent="Nộp bài";
    btnSubmit.className="btn submit";
    btnSubmit.addEventListener("click", ()=>submit(false));
    exam.appendChild(btnSubmit);
  }

  function ensurePage(){
    const start = page*pageSize, end=start+pageSize-1;
    if(currentIndex<start || currentIndex> end) page = Math.floor(currentIndex/pageSize);
  }

  function submit(auto=false){
    if(timerId){ clearInterval(timerId); timerId=null; }
    timer.classList.add("hidden");

    const missing=[]; answers.forEach((a,i)=>{ if(a===null) missing.push(i+1); });
    if(!auto && missing.length){
      const ok = confirm("Bạn chưa chọn đáp án cho các câu: "+missing.join(", ")+". Vẫn nộp?");
      if(!ok) return;
    }

    let correct=0; const wrongs=[];
    qs.forEach((q,i)=>{
      const chosen = answers[i];
      const cidx = q.choices.findIndex(c=>c.isCorrect);
      const right = (chosen!==null && chosen===cidx);
      if(right) correct++; else wrongs.push({ index:i, qtext:q.text, choices:q.choices, chosen });
    });

    const score10=(correct/qs.length*10).toFixed(1);
    showResultModal({ total: qs.length, correct, score10, wrongs });
  }

  function renderSidebarGrid(){ sidebar.renderGrid(currentIndex); }
  function renderSidebar(){ sidebar.render(page, currentIndex); }
  function onJump(i){ currentIndex=i; ensurePage(); renderAll(); }
  function toggleFlag(i){ flags[i]=!flags[i]; renderSidebarGrid(); }
  function renderAll(){ renderSidebar(); renderQuestion(); }

  content.appendChild(wrap);
  renderAll();
}
