// =================== CORE APP – parse Word, Thư viện đề, Chương, modal, session ===================
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
  bankSelect: document.getElementById("bankSelect"),
  btnUseBank: document.getElementById("btnUseBank"),
  btnDeleteBank: document.getElementById("btnDeleteBank"),
};

let CURRENT_BANK = null;   // {id, name, chapters:[], questions:[{text,choices[],chapter}]}
let QUESTIONS = [];        // alias: CURRENT_BANK?.questions

/* -------- Toast -------- */
function toast(msg){
  els.toast.textContent = msg;
  els.toast.classList.remove("hidden");
  els.toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>{
    els.toast.classList.remove("show");
    setTimeout(()=>els.toast.classList.add("hidden"), 180);
  }, 2600);
}

/* -------- Hướng dẫn modal -------- */
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

/* -------- Session guard -------- */
let __session = { active:false, mode:null };
function startSession(mode){
  __session.active = true; __session.mode = mode;
  window.addEventListener("beforeunload", beforeUnloadGuard);
  document.getElementById("contentSection").classList.add("exam-mode");
}
function endSession(){
  __session.active = false; __session.mode = null;
  window.removeEventListener("beforeunload", beforeUnloadGuard);
  document.getElementById("contentSection").classList.remove("exam-mode");
}
function beforeUnloadGuard(e){ if(!__session.active) return; e.preventDefault(); e.returnValue=""; }

/* -------- LocalStorage: ngân hàng đề -------- */
const LS_BANKS = "quiz_banks_v1";
function loadBanks(){
  try{ return JSON.parse(localStorage.getItem(LS_BANKS)||"[]"); }catch{ return []; }
}
function saveBanks(banks){ try{ localStorage.setItem(LS_BANKS, JSON.stringify(banks)); }catch{} }
function addBank(bank){ const banks=loadBanks(); banks.push(bank); saveBanks(banks); return banks; }
function deleteBank(id){
  let banks=loadBanks().filter(b=>b.id!==id); saveBanks(banks);
  if(CURRENT_BANK?.id===id){ CURRENT_BANK=null; QUESTIONS=[]; }
  return banks;
}
function populateBankSelect(){
  const banks = loadBanks();
  els.bankSelect.innerHTML = "";
  if(!banks.length){
    const op = document.createElement("option");
    op.value=""; op.textContent="(Thư viện trống)";
    els.bankSelect.appendChild(op);
    els.btnUseBank.disabled = true;
    els.btnDeleteBank.disabled = true;
    return;
  }
  banks.forEach(b=>{
    const op=document.createElement("option");
    op.value=b.id; op.textContent=`${b.name} (${b.questions.length} câu)`;
    els.bankSelect.appendChild(op);
  });
  els.btnUseBank.disabled = false;
  els.btnDeleteBank.disabled = false;
}
populateBankSelect();

els.bankSelect.addEventListener("change", ()=>{
  const id = els.bankSelect.value;
  const banks = loadBanks();
  const found = banks.find(b=>b.id===id);
  if(found){
    setCurrentBank(found);
    toast(`Đã chọn đề: ${found.name}`);
  }
});
els.btnUseBank.addEventListener("click", ()=>{
  const id = els.bankSelect.value;
  const banks = loadBanks();
  const found = banks.find(b=>b.id===id);
  if(!found){ toast("Chưa chọn đề."); return; }
  setCurrentBank(found);
  els.status.innerHTML = `Đang dùng đề: <b>${CURRENT_BANK.name}</b> — <i>${CURRENT_BANK.questions.length}</i> câu, ${CURRENT_BANK.chapters.length} chương.`;
  els.btnOntap.disabled=false; els.btnKiemtra.disabled=false;
});
els.btnDeleteBank.addEventListener("click", ()=>{
  const id = els.bankSelect.value;
  if(!id){ toast("Chưa chọn đề."); return; }
  if(!confirm("Xóa đề này khỏi thư viện?")) return;
  deleteBank(id);
  populateBankSelect();
  els.status.textContent = "Đã xóa đề khỏi thư viện.";
  els.btnOntap.disabled=true; els.btnKiemtra.disabled=true;
});

/* -------- Nạp file -------- */
els.btnUpload.addEventListener("click", ()=> els.fileInput.click());
els.fileInput.addEventListener("change", async (e)=>{
  const file = e.target.files?.[0];
  if(!file) return;

  if(typeof mammoth === "undefined"){
    toast("Thiếu thư viện Mammoth. Đặt mammoth.browser.min.js cạnh index.html.");
    e.target.value = ""; return;
  }
  try{
    const ab = await file.arrayBuffer();
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer: ab });
    const bank = buildBankFromHtml(html, file.name);
    if(!bank.questions.length){ toast("Không đọc được câu hỏi nào."); return; }
    const banks = addBank(bank);
    populateBankSelect();
    setCurrentBank(bank);
    els.status.innerHTML = `Đã nạp & lưu <b>${bank.questions.length}</b> câu — <i>${bank.name}</i> (${bank.chapters.length} chương).`;
    els.btnOntap.disabled=false; els.btnKiemtra.disabled=false;
    toast("Đã thêm vào Thư viện đề.");
  }catch(err){
    toast("Lỗi đọc file: " + err.message);
  }finally{
    e.target.value = "";
  }
});

/* -------- Parse HTML thành ngân hàng đề (nhận diện chương) -------- */
function buildBankFromHtml(html, name="Đề mới"){
  const doc = new DOMParser().parseFromString(html, "text/html");

  // gom các đoạn có text
  const nodes = [];
  doc.body.querySelectorAll("p, li").forEach(node=>{
    const clone = node.cloneNode(true);
    const txt = (clone.textContent||"").replace(/\s+/g," ").trim();
    if(txt) nodes.push(clone);
  });

  const hasBold = (el) => {
    if(!el) return false;
    if(el.querySelector("strong,b")) return true;
    const all=[el, ...el.querySelectorAll("*")];
    return all.some(x => /bold|700|800|900/i.test(x.style?.fontWeight||""));
  };
  const compact = el => (el.textContent||"").replace(/\s+/g," ").trim();
  const getAnswerLetterInText = s => (s.match(/đáp\s*án\s*[:：]\s*([A-Da-d])/i)?.[1]||"").toUpperCase()||null;

  let currentQ=null, pendingLetter=null, currentChapter="Chung";
  const questions=[];

  for(const node of nodes){
    const text = compact(node);

    // Chương: "Chương 1: ..." hoặc "CHƯƠNG ..."
    const mch = text.match(/^Chương\s*\d*\s*[:.\-]?\s*(.+)$/i);
    if(mch){
      currentChapter = `Chương: ${mch[1].trim()}`;
      continue;
    }

    // Dòng "Đáp án: X"
    const found = getAnswerLetterInText(text);
    if(found){ pendingLetter = found; continue; }

    // Câu hỏi
    const mq = text.match(/^C[âa]u\s*\d+\s*[:.\)]\s*(.*)$/i);
    if(mq){
      if(currentQ){
        if(pendingLetter && !currentQ.choices.some(c=>c.isCorrect)){
          markCorrectByLetter(currentQ, pendingLetter);
        }
        questions.push(currentQ);
        pendingLetter=null;
      }
      currentQ = { text:(mq[1]||"").trim(), choices:[], chapter: currentChapter };
      continue;
    }

    // Đáp án
    if(currentQ){
      const mc = text.match(/^\s*([A-Da-d])\s*[\.\)]\s*(.*)$/);
      if(mc){
        const letter = mc[1].toUpperCase();
        const choiceText = (mc[2]||"").trim();
        const isCorrect = hasBold(node);
        currentQ.choices.push({ text:choiceText, isCorrect, letter });
        continue;
      }
    }
  }
  if(currentQ){
    if(pendingLetter && !currentQ.choices.some(c=>c.isCorrect)){
      markCorrectByLetter(currentQ, pendingLetter);
    }
    questions.push(currentQ);
  }

  // hậu kiểm
  const noCorrect=[], tooFew=[];
  questions.forEach((q,i)=>{
    if(q.choices.length<2) tooFew.push(i+1);
    if(!q.choices.some(c=>c.isCorrect)) noCorrect.push(i+1);
  });
  if(noCorrect.length) toast(`Chưa nhận diện đáp án đúng: câu ${noCorrect.join(", ")}`);
  if(tooFew.length) toast(`Câu có <2 đáp án: ${tooFew.join(", ")}`);

  const chapters = [...new Set(questions.map(q=>q.chapter))];

  return {
    id: `bank_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    name, chapters, questions
  };
}
function markCorrectByLetter(q, letter){
  const idx = q.choices.findIndex(c=>c.letter===letter.toUpperCase());
  if(idx>=0) q.choices = q.choices.map((c,i)=>({...c, isCorrect:i===idx}));
}

/* -------- Chọn chương (modal) -------- */
const chapterModal = document.getElementById("chapterModal");
const chapterList = document.getElementById("chapterList");
document.getElementById("btnCloseChapter")?.addEventListener("click", closeChapterModal);
function closeChapterModal(){
  chapterModal.classList.remove("show");
  chapterModal.setAttribute("aria-hidden","true");
  chapterList.innerHTML="";
}
function openChapterModal(chapters){
  chapterList.innerHTML="";
  // Tất cả
  const wrapAll=document.createElement("label");
  wrapAll.className="ch-item";
  wrapAll.innerHTML=`<input type="radio" name="chap" value="__ALL__" checked /> <b>Tất cả các chương</b>`;
  chapterList.appendChild(wrapAll);
  chapters.forEach((ch, i)=>{
    const item=document.createElement("label");
    item.className="ch-item";
    item.innerHTML = `<input type="radio" name="chap" value="${escapeHtml(ch)}" /> ${escapeHtml(ch)}`;
    chapterList.appendChild(item);
  });
  chapterModal.classList.add("show");
  chapterModal.setAttribute("aria-hidden","false");
}
function getSelectedChapter(){
  const input = chapterList.querySelector('input[name="chap"]:checked');
  return input ? input.value : "__ALL__";
}
document.getElementById("btnOkChapter")?.addEventListener("click", ()=>{
  // chỉ đóng; logic lấy giá trị nằm trong pickChapters()
  if(typeof window.__afterPickCh === "function"){
    const val = getSelectedChapter();
    window.__afterPickCh(val);
    window.__afterPickCh = null;
  }
  closeChapterModal();
});

/* -------- API chọn chương cho Ôn tập / Kiểm tra -------- */
async function pickChapters(){
  return new Promise(resolve=>{
    if(!CURRENT_BANK){ toast("Chưa có đề đang dùng."); resolve({ list: [], selected: "__ALL__" }); return; }
    openChapterModal(CURRENT_BANK.chapters||[]);
    window.__afterPickCh = (val)=> resolve({ list: CURRENT_BANK.chapters||[], selected: val });
  });
}

/* -------- Helpers dùng chung (đã có từ trước) -------- */
function hideMainPanels(){
  const fileSec = document.getElementById("fileSection");
  const menuSec = document.getElementById("menuSection");
  const contentSection = document.getElementById("contentSection");

  fileSec.classList.add("hidden"); fileSec.style.display="none";
  menuSec.classList.add("hidden"); menuSec.style.display="none";
  if (guideSec){ guideSec.classList.add("hidden"); guideSec.style.display="none"; }

  contentSection.classList.remove("hidden");
  contentSection.setAttribute("aria-hidden","false");
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

/* -------- Modal kết quả (giữ bản đã fix) -------- */
function showResultModal({ total, correct, score10, wrongs }) {
  const modal = document.getElementById("resultModal");
  const body  = document.getElementById("resultBody");
  const btnClose = document.getElementById("btnCloseResult");
  const btnOk = document.getElementById("btnOkResult");
  if (btnOk) btnOk.textContent = "Quay về trang chủ";

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

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");

  function closeAndReset() {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    modal.removeEventListener("click", onBackdrop);
    document.removeEventListener("keydown", onEsc);

    removeSidebar();
    const content = document.getElementById("content");
    content.innerHTML = "";

    const contentSection = document.getElementById("contentSection");
    contentSection.classList.add("hidden");
    contentSection.classList.remove("exam-mode");

    endSession();

    const fileSec = document.getElementById("fileSection");
    const menuSec = document.getElementById("menuSection");
    const guideSec = document.querySelector(".guideSection");
    fileSec.classList.remove("hidden"); fileSec.style.display = "";
    menuSec.classList.remove("hidden"); menuSec.style.display = "";
    if (guideSec) { guideSec.classList.remove("hidden"); guideSec.style.display = ""; }
  }

  if (btnClose) btnClose.onclick = (e)=>{ e.stopPropagation(); closeAndReset(); };
  if (btnOk) btnOk.onclick = (e)=>{ e.stopPropagation(); closeAndReset(); };

  function onBackdrop(ev){ if (ev.target === modal) closeAndReset(); }
  function onEsc(ev){ if (ev.key === "Escape") closeAndReset(); }
  modal.addEventListener("click", onBackdrop);
  document.addEventListener("keydown", onEsc);
}

/* -------- APIs export cho modules -------- */
function setCurrentBank(bank){
  CURRENT_BANK = bank;
  QUESTIONS = bank.questions;
}
function getQuestions(){ return QUESTIONS||[]; }
function getChapters(){ return CURRENT_BANK?.chapters || []; }
function getQuestionsByChapterSelect(chVal){
  const qs = getQuestions();
  if(!qs.length) return [];
  if(chVal==="__ALL__") return qs.slice();
  return qs.filter(q=>q.chapter===chVal);
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}

window.getQuestions = getQuestions;
window.bankAPI = { getChapters, pickChapters, getQuestionsByChapterSelect };
window.UI = { hideMainPanels, removeSidebar, buildSidebar, showResultModal, escapeHtml, toast, startSession, endSession };
