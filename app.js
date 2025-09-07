// =================== CORE APP – nạp file, parse, UI helpers + modal Hướng dẫn ===================
const els = {
  fileInput: document.getElementById("fileInput"),
  btnUpload: document.getElementById("btnUpload"),
  status: document.getElementById("status"),
  menuSection: document.getElementById("menuSection"),
  contentSection: document.getElementById("contentSection"),
  content: document.getElementById("content"),
  toast: document.getElementById("toast"),
  btnOntap: document.getElementById("btnOntap"),
  btnKiemtra: document.getElementById("btnKiemtra"),
};

let QUESTIONS = [];

// ===== Toast
function toast(msg){
  els.toast.textContent = msg;
  els.toast.classList.remove("hidden");
  els.toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>{
    els.toast.classList.remove("show");
    setTimeout(()=>els.toast.classList.add("hidden"), 180);
  }, 3200);
}

// ===== Hướng dẫn modal
const guideModal = document.getElementById("guideModal");
const guideSec = document.querySelector(".guideSection");
document.getElementById("btnGuide")?.addEventListener("click", ()=>{
  guideModal.classList.add("show");
  guideModal.setAttribute("aria-hidden","false");
});
document.getElementById("btnCloseGuide")?.addEventListener("click", closeGuide);
document.getElementById("btnOkGuide")?.addEventListener("click", closeGuide);
function closeGuide(){
  guideModal.classList.remove("show");
  guideModal.setAttribute("aria-hidden","true");
}

// ===== Nạp file
els.btnUpload.addEventListener("click", ()=> els.fileInput.click());
els.fileInput.addEventListener("change", async (e)=>{
  const file = e.target.files?.[0];
  if(!file) return;
  window.__lastFileName = file.name;

  if(typeof mammoth === "undefined"){
    toast("Thiếu thư viện Mammoth. Đặt mammoth.browser.min.js cạnh index.html.");
    e.target.value = "";
    return;
  }

  try{
    const ab = await file.arrayBuffer();
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer: ab });
    parseQuestionsFromHtml(html);
  }catch(err){
    toast("Lỗi đọc file: " + err.message);
  }finally{
    e.target.value = "";
  }
});

// ===== Parse từ HTML
function parseQuestionsFromHtml(html){
  QUESTIONS = [];
  const doc = new DOMParser().parseFromString(html, "text/html");

  const nodes = [];
  doc.body.querySelectorAll("p, li").forEach(node=>{
    const clone = node.cloneNode(true);
    const txt = (clone.textContent||"").replace(/\s+/g," ").trim();
    if(txt) nodes.push(clone);
  });

  const hasBold = (el)=> !!(el && (el.querySelector("strong,b") || [...el.querySelectorAll("*")].some(x=>/bold|700|800|900/i.test(x.style?.fontWeight||""))));
  const compact = el => (el.textContent||"").replace(/\s+/g," ").trim();
  const getAnswerLetterInText = s => (s.match(/đáp\s*án\s*[:：]\s*([A-Da-d])/i)?.[1]||"").toUpperCase()||null;

  let current=null, pendingLetter=null;

  for(const node of nodes){
    const text = compact(node);

    const found = getAnswerLetterInText(text);
    if(found){ pendingLetter = found; continue; }

    const mq = text.match(/^C[âa]u\s*\d+\s*[:.\)]\s*(.*)$/i);
    if(mq){
      if(current){
        if(pendingLetter && !current.choices.some(c=>c.isCorrect)){
          markCorrectByLetter(current, pendingLetter);
        }
        QUESTIONS.push(current);
        pendingLetter=null;
      }
      current = { text:(mq[1]||"").trim(), choices:[] };
      continue;
    }

    if(current){
      const mc = text.match(/^\s*([A-Da-d])\s*[\.\)]\s*(.*)$/);
      if(mc){
        const letter = mc[1].toUpperCase();
        const choiceText = (mc[2]||"").trim();
        const isCorrect = hasBold(node);
        current.choices.push({ text:choiceText, isCorrect, letter });
      }
    }
  }
  if(current){
    if(pendingLetter && !current.choices.some(c=>c.isCorrect)){
      markCorrectByLetter(current, pendingLetter);
    }
    QUESTIONS.push(current);
  }

  const noCorrect=[], tooFew=[];
  QUESTIONS.forEach((q,i)=>{
    if(q.choices.length<2) tooFew.push(i+1);
    if(!q.choices.some(c=>c.isCorrect)) noCorrect.push(i+1);
  });

  if(QUESTIONS.length){
    els.status.innerHTML = `Đã nạp <b>${QUESTIONS.length}</b> câu hỏi — <i>${window.__lastFileName||""}</i>`;
    toast(`Đã nạp ${QUESTIONS.length} câu hỏi`);
    if(tooFew.length) toast(`Câu có ít hơn 2 đáp án: ${tooFew.join(", ")}`);
    if(noCorrect.length) toast(`Chưa nhận diện đáp án đúng ở câu: ${noCorrect.join(", ")}`);
    els.btnOntap.disabled=false;
    els.btnKiemtra.disabled=false;
  }else{
    els.status.textContent = "Không đọc được câu hỏi nào.";
    toast("Không đọc được câu hỏi nào");
  }
}
function markCorrectByLetter(question, letter){
  const idx = question.choices.findIndex(c=>c.letter===letter.toUpperCase());
  if(idx>=0) question.choices = question.choices.map((c,i)=>({...c, isCorrect:i===idx}));
}

/* ======= Helpers dùng chung ======= */
function hideMainPanels(){
  const fileSec = document.getElementById("fileSection");
  const menuSec = document.getElementById("menuSection");
  const contentSection = document.getElementById("contentSection");

  fileSec.classList.add("hidden"); fileSec.style.display="none";
  menuSec.classList.add("hidden"); menuSec.style.display="none";
  if (guideSec){ guideSec.classList.add("hidden"); guideSec.style.display="none"; } // ẩn hướng dẫn

  contentSection.classList.remove("hidden");
  contentSection.setAttribute("aria-hidden","false");

    // 👇 bật chế độ làm bài: loại bỏ khung panel ngoài
  contentSection.classList.add("exam-mode");
}
function removeSidebar(){ const old = document.querySelector(".sidebar"); if(old) old.remove(); }

function buildSidebar(total, pageSize, getPage, setPage, onJump, onFlag, getAnswers, getFlags){
  const root = document.createElement("div");
  root.className="sidebar";
  const grid = document.createElement("div");
  grid.className="sidebar-grid";
  const pager = document.createElement("div");
  pager.className="sidebar-pager";
  const btnPrev = document.createElement("button");
  btnPrev.className="mini"; btnPrev.textContent="◀ Trước";
  const btnNext = document.createElement("button");
  btnNext.className="mini"; btnNext.textContent="Sau ▶";
  pager.appendChild(btnPrev); pager.appendChild(btnNext);
  root.appendChild(grid); root.appendChild(pager);

  function render(page, activeIndex){
    grid.innerHTML="";
    const answers = (getAnswers&&getAnswers()) || [];
    const flags = (getFlags&&getFlags()) || [];

    const start = page*pageSize;
    const end = Math.min(total, start+pageSize);
    for(let i=start;i<end;i++){
      const cell = document.createElement("div");
      cell.className = "qnum"+(i===activeIndex?" active":"");
      cell.textContent = i+1;

      if(answers[i]!==null){
        const tick=document.createElement("span");
        tick.className="tick"; tick.textContent="✓";
        cell.appendChild(tick);
      }
      if(flags[i]) cell.classList.add("flag");

      cell.addEventListener("click", ()=> onJump(i));
      cell.addEventListener("contextmenu", (ev)=>{ ev.preventDefault(); onFlag(i); });

      grid.appendChild(cell);
    }

    const hasMulti = total>pageSize;
    pager.style.display = hasMulti ? "flex" : "none";
    btnPrev.disabled = (page===0);
    btnNext.disabled = (end>=total);
    btnPrev.onclick = ()=>{ if(page>0) setPage(page-1); };
    btnNext.onclick = ()=>{ if(end<total) setPage(page+1); };
  }
  function renderGrid(activeIndex){ render(getPage(), activeIndex); }
  return { root, render, renderGrid };
}

function showResultModal({ total, correct, score10, wrongs }) {
  const modal = document.getElementById("resultModal");
  const body  = document.getElementById("resultBody");
  const btnClose = document.getElementById("btnCloseResult");
  const btnOk = document.getElementById("btnOkResult");

  // Đổi nhãn nút
  if (btnOk) btnOk.textContent = "Quay về trang chủ";

  // Nội dung kết quả
  let html = `<p><b>Kết quả:</b> ${correct}/${total} câu đúng — Điểm: <b>${score10}/10</b></p>`;
  if (wrongs.length) {
    html += `<h4>Các câu làm sai</h4>`;
    html += wrongs.map(w => `
      <div class="wrong-item">
        <div class="wrong-title">Câu ${w.index + 1}: ${escapeHtml(w.qtext)}</div>
        <div>
          ${w.choices.map((c, ci) => {
            const cls = c.isCorrect ? 'ans correct'
              : (w.chosen === ci ? 'ans chosen-wrong' : 'ans');
            return `<span class="${cls}">${escapeHtml(c.text)}</span>`;
          }).join("")}
        </div>
      </div>
    `).join("");
  } else {
    html += `<p>Tuyệt vời! Bạn không sai câu nào.</p>`;
  }
  body.innerHTML = html;

  // Hiển thị modal
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");

  // Hàm đóng & reset về trang đầu
  function closeAndReset() {
    // Ẩn modal
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");

    // Gỡ listener (tránh nhân đôi lần sau)
    modal.removeEventListener("click", onBackdrop);
    document.removeEventListener("keydown", onEsc);

    // Xóa sidebar & vùng làm bài
    window.UI.removeSidebar?.();
    const content = document.getElementById("content");
    content.innerHTML = "";

    const contentSection = document.getElementById("contentSection");
    contentSection.classList.add("hidden");
    contentSection.classList.remove("exam-mode"); // bỏ style không nền khi làm bài

    // Hiện lại màn hình chính
    const fileSec = document.getElementById("fileSection");
    const menuSec = document.getElementById("menuSection");
    const guideSec = document.querySelector(".guideSection");
    fileSec.classList.remove("hidden"); fileSec.style.display = "";
    menuSec.classList.remove("hidden"); menuSec.style.display = "";
    if (guideSec) { guideSec.classList.remove("hidden"); guideSec.style.display = ""; }
  }

  // Click nút X & nút OK
  if (btnClose) btnClose.onclick = (e) => { e.stopPropagation(); closeAndReset(); };
  if (btnOk) btnOk.onclick = (e) => { e.stopPropagation(); closeAndReset(); };

  // Click nền ngoài để đóng
  function onBackdrop(ev) { if (ev.target === modal) closeAndReset(); }
  modal.addEventListener("click", onBackdrop);

  // Phím ESC để đóng
  function onEsc(ev) { if (ev.key === "Escape") closeAndReset(); }
  document.addEventListener("keydown", onEsc);
}


function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}

/* Expose cho các module */
window.getQuestions = () => QUESTIONS;
window.UI = { hideMainPanels, removeSidebar, buildSidebar, showResultModal, escapeHtml, toast };
