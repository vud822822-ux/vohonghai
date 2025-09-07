// =================== KIỂM TRA – chọn chương rồi random trong chương đó + GỬI EMAIL ===================
const btnKiemtra = document.getElementById("btnKiemtra");
btnKiemtra.addEventListener("click", startKiemtra);

async function startKiemtra(){
  const baseQs = (window.getQuestions && window.getQuestions()) || [];
  if(!baseQs.length){ alert("Chưa có dữ liệu/đề đang dùng."); return; }

  // Hỏi chương
  const { pickChapters, getQuestionsByChapterSelect } = window.bankAPI;
  const pick = await pickChapters();
  const pool = getQuestionsByChapterSelect(pick.selected);
  if(!pool.length){ alert("Chương này chưa có câu hỏi."); return; }

  const UI = window.UI;
  const { hideMainPanels, removeSidebar, buildSidebar, showResultModal, startSession, endSession } = UI;

  hideMainPanels();
  removeSidebar();

  const content = document.getElementById("content");
  content.innerHTML = "";

  // ===== form thiết lập
  const card = document.createElement("div");
  card.className = "config-card";
  card.innerHTML = `
    <h2 style="margin:0 0 10px 0">Thiết lập bài kiểm tra</h2>
    <div class="form-grid">
      <div class="form-row">
        <label for="num-questions">Số câu (tối đa ${pool.length})</label>
        <input id="num-questions" type="number" min="1" max="${pool.length}" placeholder="Ví dụ: ${Math.min(20,pool.length)}" />
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

      <!-- Khối gửi email -->
      <div class="form-row" style="grid-column:1/-1; margin-top:8px">
        <label style="display:flex; align-items:center; gap:10px; font-size:18px">
          <input id="opt-send-email" type="checkbox" />
          Gửi kết quả cho thầy giáo
        </label>
      </div>
      <div class="form-row">
        <label for="tEmail">Gmail của thầy</label>
        <input id="tEmail" type="email" placeholder="vd: thay@gmail.com" disabled />
      </div>
      <div class="form-row">
        <label for="fullname">Họ và tên</label>
        <input id="fullname" type="text" placeholder="vd: Võ Hồng Hải" disabled />
      </div>
      <div class="form-row">
        <label for="capbac">Cấp bậc</label>
        <input id="capbac" type="text" placeholder="vd: Đại úy" disabled />
      </div>
      <div class="form-row">
        <label for="chucvu">Chức vụ</label>
        <input id="chucvu" type="text" placeholder="vd: Giảng viên" disabled />
      </div>
      <div class="form-row">
        <label>Đơn vị (a b c d)</label>
        <div class="unit-quad">
          <div class="unit-box">a <input id="unitA" type="number" min="0" placeholder="a" disabled /></div>
          <div class="unit-box">b <input id="unitB" type="number" min="0" placeholder="b" disabled /></div>
          <div class="unit-box">c <input id="unitC" type="number" min="0" placeholder="c" disabled /></div>
          <div class="unit-box">d <input id="unitD" type="number" min="0" placeholder="d" disabled /></div>
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

  // email fields
  const elOptSend = card.querySelector("#opt-send-email");
  const elEmail   = card.querySelector("#tEmail");
  const elName    = card.querySelector("#fullname");
  const elRank    = card.querySelector("#capbac");
  const elRole    = card.querySelector("#chucvu");
  const elA       = card.querySelector("#unitA");
  const elB       = card.querySelector("#unitB");
  const elC       = card.querySelector("#unitC");
  const elD       = card.querySelector("#unitD");

  function setEmailFieldsEnabled(on){
    [elEmail, elName, elRank, elRole, elA, elB, elC, elD].forEach(i=>{
      i.disabled = !on;
    });
  }
  elOptSend.addEventListener("change", ()=>{
    setEmailFieldsEnabled(elOptSend.checked);
    validate();
  });

  function isEmail(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s||"").trim()); }

  function validate(){
    const n=+elNum.value, t=+elMins.value;
    let ok = (Number.isInteger(n)&&n>=1&&n<=pool.length && Number.isInteger(t)&&t>=1);
    if(elOptSend.checked){
      // Khi gửi email: cần gmail + họ tên tối thiểu
      ok = ok && isEmail(elEmail.value) && String(elName.value||"").trim().length>0;
      // a,b,c,d không bắt buộc nhưng nếu nhập thì phải là số >=0 (đã dùng input number)
    }
    elBtn.disabled = !ok;
  }
  ["input","change"].forEach(ev=>{
    elNum.addEventListener(ev, validate);
    elMins.addEventListener(ev, validate);
    [elEmail, elName, elRank, elRole, elA, elB, elC, elD].forEach(i=> i.addEventListener(ev, validate));
  });

  elBtn.addEventListener("click", ()=>{
    const N = +elNum.value|0;
    const mins = +elMins.value|0;
    const optChoices = !!elShufChoices.checked;
    const optQuestions = !!elShufQuestions.checked;

    const mailOpt = {
      enabled: !!elOptSend.checked,
      to: elEmail.value.trim(),
      name: elName.value.trim(),
      capbac: elRank.value.trim(),
      chucvu: elRole.value.trim(),
      donvi: buildDonVi(elA.value, elB.value, elC.value, elD.value) // "a12b3c2d14"
    };

    launchExam({
      pool, N, mins, optChoices, optQuestions,
      buildSidebar, showResultModal, startSession, endSession,
      mailOpt
    });
  });
}

function buildDonVi(a,b,c,d){
  const ax = String(a||"").trim(), bx=String(b||"").trim(), cx=String(c||"").trim(), dx=String(d||"").trim();
  const parts = [];
  if(ax) parts.push(`a${ax}`);
  if(bx) parts.push(`b${bx}`);
  if(cx) parts.push(`c${cx}`);
  if(dx) parts.push(`d${dx}`);
  return parts.join("");
}

function clone(x){ return JSON.parse(JSON.stringify(x)); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } }

function launchExam({ pool, N, mins, optChoices, optQuestions, buildSidebar, showResultModal, startSession, endSession, mailOpt }){
  const content = document.getElementById("content");
  content.innerHTML="";
  startSession('kiemtra');

  const base = clone(pool); shuffle(base);
  let qs = base.slice(0, N);
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

    // ====== GỬI EMAIL (nếu bật)
    if(mailOpt?.enabled){
      try{
        const mailData = buildEmailPayload({
          to: mailOpt.to, name: mailOpt.name, capbac: mailOpt.capbac, chucvu: mailOpt.chucvu, donvi: mailOpt.donvi,
          total: qs.length, correct, score10,
          wrongs, questions: qs, answers
        });
        // Mở trình soạn email mặc định (gmail/webmail) bằng mailto:
        openMailto(mailData);
      }catch(e){
        console.warn("Không thể tạo email:", e);
        window.UI.toast?.("Không thể mở trình gửi email. Kiểm tra trình duyệt.");
      }
    }

    showResultModal({ total: qs.length, correct, score10, wrongs });
    endSession();
  }

  function renderSidebarGrid(){ sidebar.renderGrid(currentIndex); }
  function renderSidebar(){ sidebar.render(page, currentIndex); }
  function onJump(i){ currentIndex=i; ensurePage(); renderAll(); }
  function toggleFlag(i){ flags[i]=!flags[i]; renderSidebarGrid(); }
  function renderAll(){ renderSidebar(); renderQuestion(); }

  content.appendChild(wrap);
  renderAll();
}

/* ========= Helpers cho email ========= */
function buildEmailPayload({ to, name, capbac, chucvu, donvi, total, correct, score10, wrongs, questions, answers }){
  const subject = `[KQ Kiểm tra] ${name || 'Học viên'} - ${score10}/10`;

  // Lấy chi tiết câu sai/đúng
  const lines = [];
  lines.push(`Họ và tên: ${name||'-'}`);
  lines.push(`Cấp bậc: ${capbac||'-'}`);
  lines.push(`Chức vụ: ${chucvu||'-'}`);
  lines.push(`Đơn vị: ${donvi||'-'}`);
  lines.push(`Tổng số câu: ${total}`);
  lines.push(`Số câu đúng: ${correct}`);
  lines.push(`Điểm (thang 10): ${score10}`);
  lines.push(``);
  lines.push(`Chi tiết:`);

  questions.forEach((q, i)=>{
    const chosen = answers[i];
    const cidx = q.choices.findIndex(c=>c.isCorrect);
    const chosenText = (chosen!=null) ? q.choices[chosen].text : "(chưa chọn)";
    const chosenLetter = (chosen!=null) ? (q.choices[chosen].letter || String.fromCharCode(65+chosen)) : "-";
    const correctLetter = q.choices[cidx]?.letter || String.fromCharCode(65+cidx);
    const isRight = (chosen!=null && chosen===cidx);

    lines.push(`- Câu ${i+1}: ${q.text}`);
    lines.push(`  Đúng: ${correctLetter}. ${q.choices[cidx]?.text}`);
    lines.push(`  Chọn: ${chosenLetter}. ${chosenText} ${isRight ? '(ĐÚNG)' : '(SAI)'}`);
  });

  const body = lines.join('\n');
  return { to, subject, body };
}

function openMailto({ to, subject, body }){
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  // Dùng window.location để mở mail client. Một số trình duyệt chặn popup, nên location là chắc ăn hơn.
  window.location.href = mailto;
}
