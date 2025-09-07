// =================== ÔN TẬP – chọn chương từ Thư viện đề, sau đó làm như cũ ===================
const btnOntap = document.getElementById("btnOntap");
btnOntap.addEventListener("click", startOntap);

async function startOntap(){
  const baseQs = (window.getQuestions && window.getQuestions()) || [];
  if(!baseQs.length){ alert("Chưa có dữ liệu/đề đang dùng."); return; }

  // Hỏi chương
  const { pickChapters, getQuestionsByChapterSelect } = window.bankAPI;
  const pick = await pickChapters();
  const filtered = getQuestionsByChapterSelect(pick.selected);
  if(!filtered.length){ alert("Chương này chưa có câu hỏi."); return; }

  const UI = window.UI;
  const { hideMainPanels, removeSidebar, buildSidebar, showResultModal, startSession, endSession } = UI;

  hideMainPanels();
  startSession('ontap');

  const content = document.getElementById("content");
  content.innerHTML = "";

  let currentIndex = 0;
  let answers = Array(filtered.length).fill(null);
  let flags = Array(filtered.length).fill(false);
  const pageSize = 25; let page = 0;

  removeSidebar();
  const sidebar = buildSidebar(
    filtered.length, pageSize,
    ()=>page, (p)=>{ page=p; renderSidebar(); },
    (i)=>onJump(i),
    (i)=>toggleFlag(i),
    ()=>answers,
    ()=>flags
  );
  document.body.appendChild(sidebar.root);

  const wrap=document.createElement("div");
  wrap.className="exam-wrap";
  const exam=document.createElement("div");
  exam.className="exam";
  wrap.appendChild(exam);

  function renderQuestion(){
    exam.innerHTML="";
    const q=filtered[currentIndex];

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
    btnPrev.disabled = currentIndex === 0;
    btnNext.disabled = currentIndex === filtered.length - 1;
    btnPrev.addEventListener("click", ()=>{ if(currentIndex>0){currentIndex--; ensurePage(); renderAll();}});
    btnNext.addEventListener("click", ()=>{ if(currentIndex<filtered.length-1){currentIndex++; ensurePage(); renderAll();}});
    nav.appendChild(btnPrev); nav.appendChild(btnNext);
    exam.appendChild(nav);

    const btnSubmit=document.createElement("button");
    btnSubmit.textContent="Nộp bài";
    btnSubmit.className="btn submit";
    btnSubmit.addEventListener("click", submit);
    exam.appendChild(btnSubmit);
  }

  function ensurePage(){
    const start = page*pageSize;
    const end = start + pageSize - 1;
    if(currentIndex < start || currentIndex > end){
      page = Math.floor(currentIndex / pageSize);
    }
  }

  function submit(){
    const missing=[]; answers.forEach((a,i)=>{ if(a===null) missing.push(i+1); });
    if(missing.length){
      const ok = confirm("Bạn chưa chọn đáp án cho các câu: "+missing.join(", ")+". Vẫn nộp?");
      if(!ok) return;
    }

    let correct=0; const wrongs=[];
    filtered.forEach((q,i)=>{
      const chosen = answers[i];
      const cidx = q.choices.findIndex(c=>c.isCorrect);
      const right = (chosen!==null && chosen===cidx);
      if(right) correct++; else wrongs.push({ index:i, qtext:q.text, choices:q.choices, chosen });
    });

    const score10=(correct/filtered.length*10).toFixed(1);
    showResultModal({ total: filtered.length, correct, score10, wrongs });
    endSession();
  }

  function renderSidebarGrid(){ sidebar.renderGrid(currentIndex); }
  function renderSidebar(){ sidebar.render(page, currentIndex); }
  function onJump(idx){ currentIndex=idx; ensurePage(); renderAll(); }
  function toggleFlag(idx){ flags[idx]=!flags[idx]; renderSidebarGrid(); }
  function renderAll(){ renderSidebar(); renderQuestion(); }

  content.appendChild(wrap);
  renderAll();
}
