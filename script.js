function recordRowHTML(){
return `
<div class="recordRow"
style="
border:1px solid #ddd;
border-radius:12px;
padding:15px;
margin-bottom:12px;
">

<div style="
display:grid;
grid-template-columns:repeat(6,1fr);
gap:10px;
">

<div>
<label>Date</label>
<input type="date" class="rowDate">
</div>

<div>
<label>Time In</label>
<input
type="text"
class="rowTimeIn"
placeholder="8:00 AM"
onblur="autoFormatTime(this)"
onpaste="handlePaste(event,this)">
</div>

<div>
<label>Time Out</label>
<input
type="text"
class="rowTimeOut"
placeholder="5:00 PM"
onblur="autoFormatTime(this)"
onpaste="handlePaste(event,this)">
</div>

<div>
  <label>Late</label>
  <input
    type="number"
    class="rowLate"
    min="0"
    placeholder="0">
</div>

<div>
  <label>Break</label>
  <input
    type="number"
    class="rowBreak"
    min="0"
    placeholder="0">
</div>

<div>
  <label>MIA</label>
  <input
    type="number"
    class="rowMia"
    min="0"
    placeholder="0">
</div>

</div>

<div style="margin-top:10px;text-align:right;">

<button
type="button"
class="btn-danger"
onclick="this.closest('.recordRow').remove()">

🗑 Remove

</button>

</div>

</div>
`;

}

function addRecordRow(){

recordContainer.insertAdjacentHTML(
"beforeend",
recordRowHTML()
);

}

function addMultipleRecordsLegacy(){

  if(!employeeSelect.value){
    alert("Please select employee.");
    employeeSelect.focus();
    return;
  }

  const emp = employees.find(e => e.name === employeeSelect.value);

  if(!emp){
    alert("Selected employee was not found.");
    return;
  }

  const rows = [...document.querySelectorAll(".recordRow")];

  if(rows.length === 0){
    alert("Please add at least one row.");
    return;
  }

  let added = 0;
  let invalidRow = null;

  for(const row of rows){
    const date = row.querySelector(".rowDate").value.trim();
    const timeInRaw = row.querySelector(".rowTimeIn").value.trim();
    const timeOutRaw = row.querySelector(".rowTimeOut").value.trim();

    // Completely blank rows are allowed and ignored.
    if(!date && !timeInRaw && !timeOutRaw) continue;

    // Skip rows that are incomplete instead of throwing an error.
    if (!date || !timeInRaw || !timeOutRaw) {
    continue;
}

    const in24 = normalizeTimeInput(convertTo24Hour(timeInRaw));
    const out24 = normalizeTimeInput(convertTo24Hour(timeOutRaw));

// Skip rows with invalid time instead of stopping everything.
    if (!in24 || !out24) {
    continue;
}
    const breakMinutes = Math.max(0, Math.floor(+row.querySelector(".rowBreak").value || 0));
    const miaMinutes = Math.max(0, Math.floor(+row.querySelector(".rowMia").value || 0));
    const lateMinutes = Math.max(0, Math.floor(+row.querySelector(".rowLate").value || 0));

    let rawMinutes = calcMinutes(date, in24, out24, breakMinutes / 60);

    if(!Number.isFinite(rawMinutes) || rawMinutes < 0){
      invalidRow = row;
      break;
    }

    let finalMinutes = Math.max(0, Math.round(rawMinutes - miaMinutes - lateMinutes));
    const finalHours = finalMinutes / 60;

    data.unshift({
      name: emp.name,
      date,
      hours: finalHours,
      minutes: finalMinutes,
      break: breakMinutes,
      mia: miaMinutes,
      late: lateMinutes,
      salary: (finalHours * (+emp.rate || 0)).toFixed(2),
      dollar: (finalHours * (+emp.dollarRate || 0)).toFixed(2),
      timeIn: in24,
      timeOut: out24
    });

    added++;
  }

  if(added === 0){
    alert("Please fill in at least one record.");
    return;
  }

  // Save all records
  saveAll();
  render();

// Keep the dates for the next entries
const savedDates = [...document.querySelectorAll(".rowDate")]
    .map(input => input.value);

// Clear only the editable fields
document.querySelectorAll(".recordRow").forEach(row => {
    row.querySelector(".rowTimeIn").value = "";
    row.querySelector(".rowTimeOut").value = "";
    row.querySelector(".rowLate").value = "";
    row.querySelector(".rowBreak").value = "";
    row.querySelector(".rowMia").value = "";
});

// Restore the dates
document.querySelectorAll(".rowDate").forEach((input, i) => {
    input.value = savedDates[i] || "";
});

// Keep employee selected
employeeSelect.focus();

alert(`${added} record(s) saved successfully.`);
}

function closeAddModal(){

addModal.style.display="none";

}

function toggleClearBtn(){
  clearBtn.style.display = searchInput.value ? "block" : "none";
}

function clearSearch(){
  searchInput.value = "";
  toggleClearBtn();
  render();
}

let employees = JSON.parse(localStorage.getItem("employees")) || [];
let data = JSON.parse(localStorage.getItem("payrollData")) || [];
let weeklyIncentives = JSON.parse(localStorage.getItem("weeklyIncentives")) || {};
let editIndex = null;

function incentiveKey(name, cutoff){
  return `${name}||${cutoff}`;
}

function getWeeklyIncentive(name, cutoff){
  const value = weeklyIncentives[incentiveKey(name, cutoff)];
  return Number.isFinite(+value) ? Math.max(0, +value) : 0;
}

function migrateExistingIncentives(){
  // Keep an already-migrated weekly store intact.
  if(Object.keys(weeklyIncentives).length > 0) return;

  const migrated = {};

  data.forEach(d => {
    const cutoff = d.date ? getCutoff(d.date) : "";
    if(!cutoff || !d.name) return;

    // Older builds may have stored the incentive on each daily record.
    const legacyValue = d.incentive ?? d.weeklyIncentive ?? d.salaryBonus ?? d.bonus;
    if(legacyValue === undefined || legacyValue === null || legacyValue === "") return;

    const value = Math.max(0, +legacyValue || 0);
    const key = incentiveKey(d.name, cutoff);

    // A weekly incentive must only be migrated once per employee/cutoff.
    // If legacy daily rows duplicated it, keep the highest value instead of multiplying it.
    migrated[key] = Math.max(migrated[key] || 0, value);
  });

  weeklyIncentives = migrated;
  localStorage.setItem("weeklyIncentives", JSON.stringify(weeklyIncentives));
}

const saveAllLegacy = () => {
  localStorage.setItem("employees", JSON.stringify(employees));
  localStorage.setItem("payrollData", JSON.stringify(data));
  localStorage.setItem("weeklyIncentives", JSON.stringify(weeklyIncentives));
};

const toEST = (d,t="00:00") => new Date(d + " " + t);

/* ================= NEW TIME SYSTEM ================= */

function calcMinutes(date, t1, t2, b=0){
  let s = toEST(date, t1);
  let e = toEST(date, t2);
  if(e < s) e.setDate(e.getDate()+1);
  let totalMinutes = (e - s) / 60000;
  return totalMinutes - (b * 60);
}

function calcHours(date,t1,t2,b=0){
  return calcMinutes(date,t1,t2,b) / 60;
}

function formatDuration(minutes){
  minutes = Math.round(minutes || 0);
  let h = Math.floor(minutes / 60);
  let m = minutes % 60;
  return `${h}h ${m}m`;
}

function toMinutes(val){
  return Math.round((+val || 0) * 60);
}

/* ================= EMPLOYEES ================= */

function openEmployeeModal(){renderEmployees();employeeModal.style.display="flex";}
function closeEmployeeModal(){employeeModal.style.display="none";}

function addEmployee(){
  let name=empName.value.trim();
  if(!name)return;
  employees.push({
    name,
    rate:+empRate.value||0,
    dollarRate:+empDollarRate.value||0
  });
  saveAll();renderEmployees();
}

function renderEmployees(){
  empList.innerHTML="";
  employees.forEach((e,i)=>{
    empList.innerHTML+=`<div>${e.name} ₱${e.rate} $${e.dollarRate}
    <button onclick="editEmployee(${i})">Edit</button>
    <button onclick="deleteEmployee(${i})">Delete</button></div>`;
  });
}

function editEmployee(i){
  let e = employees[i];

  let oldName = e.name;

  let newName = prompt("Name", e.name);
  if(!newName) return;

  let newRate = +prompt("₱ Rate", e.rate) || 0;
  let newDollar = +prompt("$ Rate", e.dollarRate) || 0;

  // ✅ Update employee master data
  employees[i] = {
    name: newName,
    rate: newRate,
    dollarRate: newDollar
  };

  // ✅ 🔥 Sync ALL records (name + salary + dollar)
  data.forEach(d => {
    if(d.name === oldName){

      // update name
      d.name = newName;

      // 🔥 ALWAYS recalc using stored minutes (BEST SOURCE)
      let hours = d.minutes / 60;

      d.salary = (hours * newRate).toFixed(2);
      d.dollar = (hours * newDollar).toFixed(2);
    }
  });

  saveAll();
  renderEmployees();
  render();
}

function deleteEmployee(i){
  if(confirm("Delete employee?")){
    employees.splice(i,1);
    saveAll();renderEmployees();render();
  }
}

function normalizeTimeInput(value){
  if(!value) return "";

  value = value.toString().trim().toUpperCase();

  // ✅ Remove seconds from:
  // 11:30:00
  // 11:30:00 AM
  // 11:30:00PM
  value = value.replace(
    /^(\d{1,2}):(\d{2}):\d{2}\s*(AM|PM)?$/,
    (match,h,m,ap) => `${h}:${m}${ap ? " " + ap : ""}`
  );

  // AM / PM format
  let ampm = value.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);

  if(ampm){
    let h = parseInt(ampm[1],10);
    let m = ampm[2] || "00";
    let ap = ampm[3];

    if(h < 1 || h > 12) return "";

    if(ap === "PM" && h !== 12) h += 12;
    if(ap === "AM" && h === 12) h = 0;

    return `${h.toString().padStart(2,'0')}:${m}`;
  }

  // Already HH:MM
  if(/^\d{1,2}:\d{2}$/.test(value)){
    let [h,m] = value.split(":");

    h = parseInt(h,10);

    if(h > 23 || parseInt(m,10) > 59) return "";

    return `${h.toString().padStart(2,'0')}:${m}`;
  }

  // Decimal time
  if(/^\d+(\.\d+)?$/.test(value) && value.includes(".")){
    let num = parseFloat(value);
    let h = Math.floor(num);
    let m = Math.round((num - h) * 60);

    if(h > 23) return "";

    if(m === 60){
      h++;
      m = 0;
    }

    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
  }

  // 600 = 06:00
  if(/^\d{3,4}$/.test(value)){
    let str = value.padStart(4,'0');
    let h = parseInt(str.slice(0,2),10);
    let m = parseInt(str.slice(2),10);

    if(h > 23 || m > 59) return "";

    return `${str.slice(0,2)}:${str.slice(2)}`;
  }

  // 6 = 06:00
  if(/^\d{1,2}$/.test(value)){
    let h = parseInt(value,10);

    if(h > 23) return "";

    return `${h.toString().padStart(2,'0')}:00`;
  }

  return "";
}


function autoFormatTime(input){
  const original = input.value.trim();
  if(!original) return;

  const normalized = normalizeTimeInput(convertTo24Hour(original));
  if(!normalized){
    input.classList.add("input-error");
    return;
  }

  input.value = formatTime(normalized);
  input.classList.remove("input-error");
}

function handlePaste(event, input){
  event.preventDefault();
  const pasted = (event.clipboardData || window.clipboardData).getData("text").trim();
  input.value = pasted;

  setTimeout(() => {
    autoFormatTime(input);
  }, 0);
}

/* ================= ADD ================= */

function openAddModal(){

  if(employees.length === 0){
    alert("Please add employee first.");
    return;
  }

  // Load employee dropdown
  employeeSelect.innerHTML =
    '<option value="">-- Select Employee --</option>';

  employees.forEach(emp => {
    employeeSelect.innerHTML += `
      <option value="${emp.name}">
        ${emp.name}
      </option>
    `;
  });

// Only create rows the first time
if(recordContainer.children.length === 0){
    for(let i = 0; i < 7; i++){
        addRecordRow();
    }
}

  addModal.style.display = "flex";

  setTimeout(() => {
    employeeSelect.focus();
  }, 100);
}

function convertTo24Hour(t){
  if(t == null) return "";
  t = t.toString().trim().toUpperCase();

  let match = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);

  if(match){
    let h = parseInt(match[1], 10);
    let m = match[2] || "00";
    let ap = match[3];

    if(h < 1 || h > 12 || +m > 59) return "";

    if(ap === "PM" && h !== 12) h += 12;
    if(ap === "AM" && h === 12) h = 0;

    return `${h.toString().padStart(2,'0')}:${m}`;
  }

  return t;
}

/* ================= EDIT ================= */

function openEdit(i){
  editIndex = i;
  let d = data[i];

  editName.value = d.name;
  editDate.value = d.date;
  editTimeIn.value = normalizeTimeInput(d.timeIn) || d.timeIn;
  editTimeOut.value = normalizeTimeInput(d.timeOut) || d.timeOut;
  editBreak.value = d.break ? d.break : '';
  editMia.value = d.mia ? d.mia : '';
  editLate.value = d.late ? d.late : '';
  editModal.style.display = "flex";
}

function closeEditModal(){editModal.style.display="none";}

function saveEdit(){

  if(editIndex == null || !data[editIndex]) return;

  const newName = editName.value.trim();
  const newDate = editDate.value;

  if(!newName || !newDate || !editTimeIn.value || !editTimeOut.value){
    alert("Please complete employee, date, time in, and time out.");
    return;
  }

  const emp = employees.find(e => e.name === newName);

  if(!emp){
    alert("Employee not found. Please select a valid employee.");
    return;
  }

  const timeInFixed = normalizeTimeInput(convertTo24Hour(editTimeIn.value));
  const timeOutFixed = normalizeTimeInput(convertTo24Hour(editTimeOut.value));

  if(!timeInFixed || !timeOutFixed){
    alert("Please enter valid time values.");
    return;
  }

  const breakMinutes = Math.max(0, Math.floor(+editBreak.value || 0));
  const miaMinutes = Math.max(0, Math.floor(+editMia.value || 0));
  const lateMinutes = Math.max(0, Math.floor(+editLate.value || 0));

  let rawMinutes = calcMinutes(
    newDate,
    timeInFixed,
    timeOutFixed,
    breakMinutes / 60
  );

  if(!Number.isFinite(rawMinutes)){
    alert("Unable to calculate the selected time range.");
    return;
  }

  const finalMinutes = Math.max(0, Math.round(rawMinutes - miaMinutes - lateMinutes));
  const finalHours = finalMinutes / 60;

  const d = data[editIndex];
  d.name = newName;
  d.date = newDate;
  d.timeIn = timeInFixed;
  d.timeOut = timeOutFixed;
  d.break = breakMinutes;
  d.mia = miaMinutes;
  d.late = lateMinutes;
  d.minutes = finalMinutes;
  d.hours = finalHours;
  d.salary = (finalHours * (+emp.rate || 0)).toFixed(2);
  d.dollar = (finalHours * (+emp.dollarRate || 0)).toFixed(2);

  saveAll();
  render();
  closeEditModal();
}

/* ================= CLEAR ================= */

function openClearModal(){clearModal.style.display="flex";}
function closeClearModal(){clearModal.style.display="none";}
function confirmClear(){data=[];saveAll();render();closeClearModal();}

/* ================= CUTOFF ================= */

function getCutoff(date){
  let d=toEST(date);
  let day=d.getDay();
  let diff=d.getDate()-day+(day===0?-6:1);
  let mon=new Date(d);mon.setDate(diff);
  let sun=new Date(mon);sun.setDate(mon.getDate()+6);
  return mon.toISOString().split("T")[0]+" to "+sun.toISOString().split("T")[0];
}

/* ================= PAYSLIP ================= */

function showPayslip(name, cutoff){

  const incentive = getWeeklyIncentive(name, cutoff);

  window.currentPayslip = {
    name,
    cutoff,
    incentive
  };

  let rows = data
    .filter(d => d.name == name && getCutoff(d.date) == cutoff)
    .sort((a,b) => new Date(a.date) - new Date(b.date));

  let emp = employees.find(e => e.name === name);
  let isDollar = emp && emp.dollarRate > 0;

  let rateDisplay = isDollar
    ? `$${emp.dollarRate}/hr`
    : `₱${emp.rate}/hr`;

  let th = 0, tb = 0, tm = 0, tl = 0, ts = 0, td = 0;
  let tableRows = "";

  rows.forEach(r => {
    let timeInValue = r.timeIn || r.timein || r.inTime || "";
    let timeOutValue = r.timeOut || r.timeout || r.outTime || "";

    th += +r.hours || 0;
    tb += +(r.break || 0);
    tm += +(r.mia || 0);
    tl += +(r.late || 0);
    ts += +(r.salary || 0);
    td += +(r.dollar || 0);

    tableRows += `
      <tr>
        <td>${r.date}</td>
        <td>${formatTime(timeInValue)}</td>
        <td>${formatTime(timeOutValue)}</td>
        <td>${toHHMM(r.hours)}</td>
        <td>${minutesToHHMM(r.late)}</td>
        <td>${minutesToHHMM(r.break)}</td>
        <td>${minutesToHHMM(r.mia)}</td>
        <td>${isDollar ? '$' + (+r.dollar || 0).toFixed(2) : '₱' + (+r.salary || 0).toFixed(2)}</td>
      </tr>`;
  });

  const basePay = isDollar ? td : ts;
  const totalPay = basePay + incentive;
  const money = value => isDollar ? '$' + value.toFixed(2) : '₱' + value.toFixed(2);

  let html = `
    <div class="payslip-header">
      <h2>💼 Payslip</h2>
      <div>Outgrow Payroll System</div>
    </div>
    <div class="payslip-body">
      <div class="payslip-info">
        <div>
          <strong>Employee:</strong> ${name}<br>
          <strong>Rate:</strong> ${rateDisplay}
        </div>
        <div><strong>Cutoff:</strong> ${cutoff}</div>
      </div>
      <table class="payslip-table">
        <tr>
          <th>Date</th><th>Time In</th><th>Time Out</th><th>Hours</th>
          <th>Late</th><th>Break</th><th>MIA</th><th>Pay</th>
        </tr>
        ${tableRows}
      </table>
      <div class="payslip-total">
        <div><strong>Total:</strong> ${toHHMM(th)}</div>
        <div>Break: ${minutesToHHMM(tb)} | MIA: ${minutesToHHMM(tm)} | Late: ${minutesToHHMM(tl)}</div>
        ${incentive > 0 ? `<div><strong>Base Pay:</strong> ${money(basePay)}</div>
        <div><strong>Incentive:</strong> ${money(incentive)}</div>` : ""}
        <div><strong>Net Pay:</strong> ${money(totalPay)}</div>
      </div>
      <div class="payslip-footer">
        <button onclick="downloadPayslipPNG()">🖼 Save PNG</button>
        <button onclick="payslipModal.style.display='none'">Close</button>
      </div>
    </div>`;

  payslipContent.innerHTML = html;
  payslipModal.style.display = "flex";
}

function formatTime(t){
  if(!t) return "-";

  t = t.toString().trim().toUpperCase();

  // Normalize first
  t = normalizeTimeInput(t);

  if(!t) return "-";

  let parts = t.split(":");

  let h = parseInt(parts[0],10);
  let m = parts[1];

  let ampm = h >= 12 ? "PM" : "AM";

  h = h % 12;
  if(h === 0) h = 12;

  return `${h}:${m} ${ampm}`;
}

function toHHMM(val){
  let h = Math.floor(val);
  let m = Math.round((val - h) * 60);

  if(m === 60){
    h++;
    m = 0;
  }

  return `${h}:${m.toString().padStart(2,'0')}`;
}

/* ================= EXPORT ================= */

function buildWeeklyExportRows(cutoff){
  const grouped = {};
  data.forEach(d => {
    if(getCutoff(d.date) !== cutoff) return;
    const key = incentiveKey(d.name, cutoff);
    if(!grouped[key]) grouped[key] = {name:d.name, cutoff, minutes:0};
    grouped[key].minutes += +(d.minutes || 0);
  });
  return Object.values(grouped).sort((a,b)=>a.name.localeCompare(b.name));
}

function weeklyCsv(cutoff){
  const rows = buildWeeklyExportRows(cutoff);
  if(!rows.length) return "";

  let csv = "Employee,Cutoff,Hours,Peso Pay,Dollar Pay,Incentive,Total Pay\n";
  rows.forEach(g=>{
    const emp = employees.find(e => e.name === g.name);
    const hours = g.minutes / 60;
    const hoursFormatted = `${Math.floor(g.minutes/60)}:${String(g.minutes%60).padStart(2,'0')}`;
    const pesoPay = emp && +emp.rate > 0 ? (hours * +emp.rate).toFixed(2) : "";
    const dollarPay = emp && +emp.dollarRate > 0 ? (hours * +emp.dollarRate).toFixed(2) : "";
    const incentive = getWeeklyIncentive(g.name, cutoff);
    const basePay = emp && +emp.dollarRate > 0 ? +dollarPay || 0 : +pesoPay || 0;
    const totalPay = (basePay + incentive).toFixed(2);
    csv += [g.name,g.cutoff,hoursFormatted,pesoPay,dollarPay,incentive.toFixed(2),totalPay].map(csvEscape).join(",") + "\n";
  });
  return csv;
}

function exportCSV(){
  if(data.length === 0){ alert("No records available"); return; }
  const latestDate = data.map(d=>new Date(d.date)).sort((a,b)=>b-a)[0];
  const latestStr = latestDate.getFullYear()+"-"+String(latestDate.getMonth()+1).padStart(2,'0')+"-"+String(latestDate.getDate()).padStart(2,'0');
  const currentCutoff = getCutoff(latestStr);
  const csv = weeklyCsv(currentCutoff);
  if(!csv){ alert("No records found for latest cutoff"); return; }
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}));
  a.download=formatCutoffFilename(currentCutoff);
  a.click();
}

function exportPreviousCutoffCSV(){
  if(data.length === 0){ alert("No records available"); return; }
  const cutoffs=[...new Set(data.map(d=>d.date).filter(Boolean).map(getCutoff))].sort((a,b)=>new Date(a.split(" to ")[0])-new Date(b.split(" to ")[0]));
  if(cutoffs.length < 2){ alert("No previous cutoff available. At least two cutoffs are required."); return; }
  const previousCutoff=cutoffs[cutoffs.length-2];
  const csv=weeklyCsv(previousCutoff);
  if(!csv){ alert("No records found for previous cutoff"); return; }
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}));
  a.download=formatCutoffFilename(previousCutoff);
  a.click();
}

function formatCutoffFilename(cutoff){
  let parts=cutoff.split(" to ");
  if(parts.length!==2) return "weekly_cutoff.csv";
  let start=new Date(parts[0]), end=new Date(parts[1]);
  return `${start.toLocaleString("en-US",{month:"long"})}_${start.getDate()}-${end.getDate()}_cutoff.csv`;
}

function csvEscape(value){
  const s=String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
}

function exportMonthlyCSV(){
  if(data.length===0){ alert("No records available"); return; }
  const latestDate=data.map(d=>d.date).filter(Boolean).sort().at(-1);
  if(!latestDate){ alert("No valid dated records available"); return; }
  const targetMonth=latestDate.slice(0,7), grouped={};

  data.forEach(d=>{
    if(!d.date || d.date.slice(0,7)!==targetMonth) return;
    const key=`${d.name}__${targetMonth}`;
    if(!grouped[key]) grouped[key]={name:d.name,month:targetMonth,minutes:0,late:0,break:0,mia:0,salary:0,dollar:0,cutoffs:new Set()};
    grouped[key].minutes += +(d.minutes||0);
    grouped[key].late += +(d.late||0);
    grouped[key].break += +(d.break||0);
    grouped[key].mia += +(d.mia||0);
    grouped[key].salary += +(d.salary||0);
    grouped[key].dollar += +(d.dollar||0);
    grouped[key].cutoffs.add(getCutoff(d.date));
  });

  const rows=Object.values(grouped);
  if(!rows.length){ alert("No monthly records found"); return; }

  let csv="Employee,Month,Hours,Peso Pay,Dollar Pay,Incentive,Total Pay\n";
  rows.sort((a,b)=>a.name.localeCompare(b.name)).forEach(g=>{
    const emp=employees.find(e=>e.name===g.name);
    const incentive=[...g.cutoffs].reduce((sum,cutoff)=>sum+getWeeklyIncentive(g.name,cutoff),0);
    const basePay=emp && +emp.dollarRate>0 ? g.dollar : g.salary;
    const hoursFormatted=`${Math.floor(g.minutes/60)}:${String(Math.round(g.minutes%60)).padStart(2,'0')}`;
    const pesoPay=emp && +emp.rate>0 ? g.salary.toFixed(2) : "";
    const dollarPay=emp && +emp.dollarRate>0 ? g.dollar.toFixed(2) : "";
    csv += [g.name,g.month,hoursFormatted,pesoPay,dollarPay,incentive.toFixed(2),(basePay+incentive).toFixed(2)].map(csvEscape).join(",")+"\n";
  });

  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}));
  a.download=`${targetMonth}_monthly.csv`;
  a.click();
}

/* ================= DOWNLOAD PNG  ================= */

function downloadPayslipPNG(){

  const element = document.getElementById("payslipContent");
  const footer = element.querySelector(".payslip-footer");

  // 🔥 Apply export layout
  element.classList.add("export-mode");

  // 🔥 Hide buttons
  if(footer) footer.style.display = "none";

  let name = currentPayslip?.name || "Employee";
  let cutoff = currentPayslip?.cutoff || "cutoff";

  name = name.replace(/[^a-zA-Z0-9]/g,"_");
  cutoff = cutoff.replace(/\s+/g,"");

  let filename = `${name}_outgrowsolutions.co_${cutoff}.png`;

  html2canvas(element,{
    scale: 2,
    useCORS: true
  }).then(canvas=>{

    let link=document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();

  }).catch(err => {
    console.error("Payslip PNG export failed:", err);
    alert("Unable to save the payslip PNG.");
  }).finally(() => {
    element.classList.remove("export-mode");
    if(footer) footer.style.display = "";
  });
}

function updateWeeklyIncentive(name, cutoff, value){
  const numeric=Math.max(0, Number(value)||0);
  weeklyIncentives[incentiveKey(name, cutoff)] = numeric;
  localStorage.setItem("weeklyIncentives", JSON.stringify(weeklyIncentives));
  render();
}

/* ================= RENDER ================= */

function renderLegacy(){

  tbody.innerHTML = "";
  summaryBody.innerHTML = "";
  monthlyBody.innerHTML = "";

  let weekly = {};
  let monthly = {};
  let search = searchInput.value.toLowerCase().trim();

  /* ================= RECORDS TABLE ================= */

  data
  .map((item,index)=>({ item,index }))
  .filter(row=>{
    if(search && !row.item.name.toLowerCase().includes(search)) return false;
    return true;
  })
  .slice(0,7)
  .forEach(row=>{

    let d = row.item;
    let i = row.index;

    tbody.innerHTML += `
      <tr>
        <td>${d.name}</td>
        <td>${d.date}</td>
        <td>${formatDuration(d.minutes)}</td>
        <td>${d.late} min</td>
        <td>${d.break} min</td>
        <td>${d.mia} min</td>
        <td>${(+d.salary || 0) > 0 ? '₱' + (+d.salary).toFixed(2) : '-'}</td>
        <td>${(+d.dollar || 0) > 0 ? '$' + (+d.dollar).toFixed(2) : '-'}</td>
        <td>
          <button onclick="openEdit(${i})">Edit</button>
          <button onclick="if(confirm('Delete?')){data.splice(${i},1);saveAll();render();}">
            Delete
          </button>
        </td>
      </tr>
    `;
  });

  /* ================= SUMMARY + MONTHLY ================= */

  data.forEach(d=>{

    if(search && !d.name.toLowerCase().includes(search)) return;

    let wk = d.name + getCutoff(d.date);

    if(!weekly[wk]){
      weekly[wk] = {
        name:d.name,
        cutoff:getCutoff(d.date),
        minutes:0,
        late:0,
        break:0,
        mia:0,
        salary:0,
        dollar:0
      };
    }

    weekly[wk].minutes += +(d.minutes || 0);
    weekly[wk].late += +(d.late || 0);
    weekly[wk].break += +(d.break || 0);
    weekly[wk].mia += +(d.mia || 0);
    weekly[wk].salary += +(d.salary || 0);
    weekly[wk].dollar += +(d.dollar || 0);

    let mk = d.name + d.date.slice(0,7);

    if(!monthly[mk]){
      monthly[mk] = {
        name:d.name,
        month:d.date.slice(0,7),
        minutes:0,
        late:0,
        break:0,
        mia:0,
        salary:0,
        dollar:0
      };
    }

    monthly[mk].minutes += +(d.minutes || 0);
    monthly[mk].late += +(d.late || 0);
    monthly[mk].break += +(d.break || 0);
    monthly[mk].mia += +(d.mia || 0);
    monthly[mk].salary += +(d.salary || 0);
    monthly[mk].dollar += +(d.dollar || 0);

  });

  /* ================= WEEKLY TABLE ================= */

  Object.values(weekly).forEach(w=>{
    const emp = employees.find(e => e.name === w.name);
    const incentive = getWeeklyIncentive(w.name, w.cutoff);
    const isDollar = emp && +emp.dollarRate > 0;
    const basePay = isDollar ? w.dollar : w.salary;
    const totalPay = basePay + incentive;
    const money = value => isDollar ? '$' + value.toFixed(2) : '₱' + value.toFixed(2);
    const nameArg = JSON.stringify(w.name).replace(/</g,"\u003c");
    const cutoffArg = JSON.stringify(w.cutoff);

    summaryBody.innerHTML += `
      <tr>
        <td>${w.name}</td>
        <td>${w.cutoff}</td>
        <td>${formatDuration(w.minutes)}</td>
        <td>${w.late} min</td>
        <td>${w.break} min</td>
        <td>${w.mia} min</td>
        <td>${w.salary > 0 ? '₱' + w.salary.toFixed(2) : '-'}</td>
        <td>${w.dollar > 0 ? '$' + w.dollar.toFixed(2) : '-'}</td>
        <td style="min-width:150px;">
          <input type="number" min="0" step="0.01"
            value="${incentive ? incentive.toFixed(2) : ''}"
            placeholder="0.00"
            title="Weekly incentive"
            onchange='updateWeeklyIncentive(${nameArg},${cutoffArg},this.value)'
            onkeydown="if(event.key==='Enter'){this.blur();}">
        </td>
        <td><strong>${money(totalPay)}</strong></td>
        <td>
          <button onclick='showPayslip(${nameArg},${cutoffArg})'>Payslip</button>
        </td>
      </tr>`;
  });

  /* ================= MONTHLY TABLE ================= */

  Object.values(monthly).forEach(m=>{
    const emp = employees.find(e => e.name === m.name);
    const cutoffs = [...new Set(data.filter(d => d.name === m.name && d.date.slice(0,7) === m.month).map(d => getCutoff(d.date)))];
    const incentive = cutoffs.reduce((sum, cutoff) => sum + getWeeklyIncentive(m.name, cutoff), 0);
    const isDollar = emp && +emp.dollarRate > 0;
    const basePay = isDollar ? m.dollar : m.salary;
    const totalPay = basePay + incentive;
    const money = value => isDollar ? '$' + value.toFixed(2) : '₱' + value.toFixed(2);

    monthlyBody.innerHTML += `
      <tr>
        <td>${m.name}</td>
        <td>${m.month}</td>
        <td>${formatDuration(m.minutes)}</td>
        <td>${m.late} min</td>
        <td>${m.break} min</td>
        <td>${m.mia} min</td>
        <td>${m.salary > 0 ? '₱' + m.salary.toFixed(2) : '-'}</td>
        <td>${m.dollar > 0 ? '$' + m.dollar.toFixed(2) : '-'}</td>
        <td>${incentive > 0 ? money(incentive) : '-'}</td>
        <td><strong>${money(totalPay)}</strong></td>
      </tr>`;
  });

}

/* ================= SMART VALIDATION + ENTER ================= */

function clearErrors(container){
  container.querySelectorAll("input, select").forEach(el=>{
    el.classList.remove("input-error");
  });
}

function validateFields(fields){
  for(let field of fields){
    if(!field.value){
      field.classList.add("input-error");
      field.focus();
      return false;
    }
  }
  return true;
}

document.querySelectorAll("input, select").forEach(el=>{
  el.addEventListener("input", ()=>{
    el.classList.remove("input-error");
  });
});

/* ================= ADD MODAL - ENTER TO SAVE ALL ================= */

document.addEventListener("keydown", function(e){

  // Only run when Enter is pressed
  if(e.key !== "Enter") return;

  // Only run if Add Record modal is currently open
  if(
    typeof addModal !== "undefined" &&
    getComputedStyle(addModal).display === "flex" &&
    e.target.closest("#addModal")
  ){
    e.preventDefault();

    // Prevent accidental double-save
    if(window.isSavingRecords) return;

    // Employee must be selected
    if(!employeeSelect.value){
      employeeSelect.classList.add("input-error");
      employeeSelect.focus();
      return;
    }

    // Save all filled records
    window.isSavingRecords = true;

    try{
      addMultipleRecords();
    }finally{
      // Small delay prevents rapid Enter presses
      setTimeout(() => {
        window.isSavingRecords = false;
      }, 500);
    }
  }

});

document.querySelectorAll("#editModal input").forEach(el=>{
  el.addEventListener("keydown", function(e){
    if(e.key === "Enter"){
      e.preventDefault();

      clearErrors(editModal);

      let requiredFields = [
        editTimeIn,
        editTimeOut
      ];

      if(validateFields(requiredFields)){
        saveEdit();
      }
    }
  });
});

function minutesToHHMM(mins){
  mins = Math.round(mins || 0);
  let h = Math.floor(mins / 60);
  let m = mins % 60;
  return `${h}h ${m}m`;
}

document.addEventListener("keydown", function(e){
  if(e.key === "Escape"){

    const modals = document.querySelectorAll(".modal");

    modals.forEach(modal => {
      if(getComputedStyle(modal).display === "flex"){
        modal.style.display = "none";
      }
    });

  }
});

/* ================= OUTGROW PAYROLL V2 ================= */

let cutoffLocks = JSON.parse(localStorage.getItem("cutoffLocks")) || {};
let auditLog = JSON.parse(localStorage.getItem("payrollAuditLog")) || [];
employees.forEach(e => { if(typeof e.active !== "boolean") e.active = true; });
saveAll();

function nowStamp(){
  return new Date().toLocaleString("en-US", {year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
}
function audit(action, detail){
  auditLog.unshift({time:nowStamp(), action, detail});
  auditLog = auditLog.slice(0,500);
  localStorage.setItem("payrollAuditLog", JSON.stringify(auditLog));
}
function saveAll(){
  localStorage.setItem("employees", JSON.stringify(employees));
  localStorage.setItem("payrollData", JSON.stringify(data));
  localStorage.setItem("weeklyIncentives", JSON.stringify(weeklyIncentives));
  localStorage.setItem("cutoffLocks", JSON.stringify(cutoffLocks));
  localStorage.setItem("payrollAuditLog", JSON.stringify(auditLog));
}
function isCutoffLocked(cutoff){ return !!cutoffLocks[cutoff]; }
function cutoffForRecord(index){ return data[index] ? getCutoff(data[index].date) : ""; }

function clearFilters(){
  searchInput.value=""; cutoffFilter.value=""; monthFilter.value=""; statusFilter.value="";
  toggleClearBtn(); render();
}
function populateFilters(){
  const currentCutoff = cutoffFilter.value, currentMonth = monthFilter.value;
  const cutoffs=[...new Set(data.map(d=>d.date).filter(Boolean).map(getCutoff))].sort((a,b)=>new Date(a.split(" to ")[0])-new Date(b.split(" to ")[0])).reverse();
  cutoffFilter.innerHTML='<option value="">All Cutoffs</option>'+cutoffs.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  if(cutoffs.includes(currentCutoff)) cutoffFilter.value=currentCutoff;
  const months=[...new Set(data.map(d=>d.date).filter(Boolean).map(d=>d.slice(0,7)))].sort().reverse();
  monthFilter.innerHTML='<option value="">All Months</option>'+months.map(m=>`<option value="${m}">${m}</option>`).join("");
  if(months.includes(currentMonth)) monthFilter.value=currentMonth;
}
function escapeHtml(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function jsArg(v){return JSON.stringify(v).replace(/</g,"\\u003c");}

function cutoffDates(cutoff){
  if(!cutoff) return [];
  const [a,b]=cutoff.split(" to "); if(!a||!b) return [];
  const start=new Date(a+"T00:00:00"), end=new Date(b+"T00:00:00"), out=[];
  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
    out.push(d.toISOString().slice(0,10));
  }
  return out;
}
function groupStatus(w){
  const incentive=getWeeklyIncentive(w.name,w.cutoff);
  if(isCutoffLocked(w.cutoff)) return "locked";
  if(incentive>0) return "incentive";
  return "complete";
}
function passesFilters(name, month, cutoff){
  const search=searchInput.value.toLowerCase().trim();
  if(search && !name.toLowerCase().includes(search)) return false;
  if(cutoffFilter.value && cutoffFilter.value!==cutoff) return false;
  if(monthFilter.value && monthFilter.value!==month) return false;
  const status=statusFilter.value;
  if(status){
    const s=groupStatus({name,cutoff});
    if(s!==status) return false;
  }
  return true;
}
function passesMonthlyFilters(m){
  const search=searchInput.value.toLowerCase().trim();
  if(search && !m.name.toLowerCase().includes(search)) return false;
  if(monthFilter.value && monthFilter.value!==m.month) return false;
  if(cutoffFilter.value && !m.cutoffs.has(cutoffFilter.value)) return false;
  if(statusFilter.value){
    const match=[...m.cutoffs].some(c=>groupStatus({name:m.name,cutoff:c})===statusFilter.value);
    if(!match) return false;
  }
  return true;
}
function statusBadge(status){
  const map={complete:["Complete","status-ok"],incentive:["🎁 Incentive","status-incentive"],locked:["🔒 Locked","status-lock"]};
  const [label,cls]=map[status]||[status,"status-pill"];
  return `<span class="status-pill ${cls}">${label}</span>`;
}
function formatMoneyForEmployee(emp,peso,dollar){
  return emp && +emp.dollarRate>0 ? "$"+(+dollar||0).toFixed(2) : "₱"+(+peso||0).toFixed(2);
}

function renderDashboard(weekly){
  const active=employees.filter(e=>e.active!==false).length;
  const groups=Object.values(weekly);
  const latest=groups.slice().sort((a,b)=>new Date(b.cutoff.split(" to ")[0])-new Date(a.cutoff.split(" to ")[0]))[0];
  let pesoPayroll=0,dollarPayroll=0,pesoInc=0,dollarInc=0,hours=0;
  if(latest){
    groups.filter(w=>w.cutoff===latest.cutoff).forEach(w=>{
      const emp=employees.find(e=>e.name===w.name), inc=getWeeklyIncentive(w.name,w.cutoff);
      if(emp&&+emp.dollarRate>0){ dollarPayroll+=w.dollar+inc; dollarInc+=inc; }
      else { pesoPayroll+=w.salary+inc; pesoInc+=inc; }
      hours+=w.minutes;
    });
  }
  dashEmployees.textContent=active;
  dashPayroll.textContent=latest?`₱${pesoPayroll.toFixed(2)}${dollarPayroll>0?` / $${dollarPayroll.toFixed(2)}`:""}`:"-";
  dashIncentives.textContent=latest?`₱${pesoInc.toFixed(2)}${dollarInc>0?` / $${dollarInc.toFixed(2)}`:""}`:"-";
  dashHours.textContent=formatDuration(hours);
  dashLocked.textContent=Object.keys(cutoffLocks).filter(k=>cutoffLocks[k]).length;
}
function render(){
  migrateExistingIncentives();
  populateFilters();
  tbody.innerHTML=""; summaryBody.innerHTML=""; monthlyBody.innerHTML="";
  const weeklyMap={}, monthlyMap={};

  data.forEach((d,index)=>{
    const cutoff=getCutoff(d.date), month=(d.date||"").slice(0,7);
    const key=d.name+"||"+cutoff;
    if(!weeklyMap[key]) weeklyMap[key]={name:d.name,cutoff,minutes:0,late:0,break:0,mia:0,salary:0,dollar:0};
    weeklyMap[key].minutes+=+(d.minutes||0); weeklyMap[key].late+=+(d.late||0); weeklyMap[key].break+=+(d.break||0); weeklyMap[key].mia+=+(d.mia||0); weeklyMap[key].salary+=+(d.salary||0); weeklyMap[key].dollar+=+(d.dollar||0);
    const mk=d.name+"||"+month;
    if(!monthlyMap[mk]) monthlyMap[mk]={name:d.name,month,minutes:0,late:0,break:0,mia:0,salary:0,dollar:0,cutoffs:new Set()};
    monthlyMap[mk].minutes+=+(d.minutes||0); monthlyMap[mk].late+=+(d.late||0); monthlyMap[mk].break+=+(d.break||0); monthlyMap[mk].mia+=+(d.mia||0); monthlyMap[mk].salary+=+(d.salary||0); monthlyMap[mk].dollar+=+(d.dollar||0); monthlyMap[mk].cutoffs.add(cutoff);
  });

  const weekly=Object.values(weeklyMap).sort((a,b)=>new Date(b.cutoff.split(" to ")[0])-new Date(a.cutoff.split(" to ")[0])||a.name.localeCompare(b.name));
  const monthly=Object.values(monthlyMap).sort((a,b)=>b.month.localeCompare(a.month)||a.name.localeCompare(b.name));
  renderDashboard(weeklyMap);

  data.map((item,index)=>({item,index})).filter(x=>passesFilters(x.item.name,(x.item.date||"").slice(0,7),getCutoff(x.item.date))).slice(0,20).forEach(({item:d,index:i})=>{
    const locked=isCutoffLocked(getCutoff(d.date));
    tbody.innerHTML+=`<tr><td>${escapeHtml(d.name)}</td><td>${d.date}</td><td>${formatDuration(d.minutes)}</td><td>${d.late} min</td><td>${d.break} min</td><td>${d.mia} min</td><td>${(+d.salary||0)>0?'₱'+(+d.salary).toFixed(2):'-'}</td><td>${(+d.dollar||0)>0?'$'+(+d.dollar).toFixed(2):'-'}</td><td>${locked?statusBadge('locked'):statusBadge('complete')}</td><td>${locked?'<span class="small-muted">Locked</span>':`<button onclick="openEdit(${i})">Edit</button><button onclick="deleteRecord(${i})">Delete</button>`}</td></tr>`;
  });

  weekly.filter(w=>passesFilters(w.name,w.cutoff.split(" to ")[0].slice(0,7),w.cutoff)).forEach(w=>{
    const emp=employees.find(e=>e.name===w.name), inc=getWeeklyIncentive(w.name,w.cutoff), isDollar=emp&&+emp.dollarRate>0, base=isDollar?w.dollar:w.salary,total=base+inc, locked=isCutoffLocked(w.cutoff), stat=groupStatus(w);
    const money=v=>isDollar?'$'+v.toFixed(2):'₱'+v.toFixed(2), nameArg=jsArg(w.name), cutoffArg=jsArg(w.cutoff);
    const gapText="";
    summaryBody.innerHTML+=`<tr><td>${escapeHtml(w.name)}</td><td>${escapeHtml(w.cutoff)} ${locked?statusBadge('locked'):''}${gapText}</td><td>${formatDuration(w.minutes)}</td><td>${w.late} min</td><td>${w.break} min</td><td>${w.mia} min</td><td>${w.salary>0?'₱'+w.salary.toFixed(2):'-'}</td><td>${w.dollar>0?'$'+w.dollar.toFixed(2):'-'}</td><td><input type="number" min="0" step="0.01" value="${inc?inc.toFixed(2):''}" placeholder="0.00" ${locked?'disabled':''} onchange='updateWeeklyIncentive(${nameArg},${cutoffArg},this.value)' onkeydown="if(event.key==='Enter')this.blur();"></td><td><strong>${money(total)}</strong></td><td><button onclick='showPayslip(${nameArg},${cutoffArg})'>Payslip</button><button class="${locked?'btn-success':'btn-lock'}" onclick='toggleCutoffLock(${cutoffArg})'>${locked?'🔓 Unlock':'🔒 Lock'}</button></td></tr>`;
  });

  monthly.filter(passesMonthlyFilters).forEach(m=>{
    const emp=employees.find(e=>e.name===m.name), inc=[...m.cutoffs].reduce((s,c)=>s+getWeeklyIncentive(m.name,c),0), isDollar=emp&&+emp.dollarRate>0, base=isDollar?m.dollar:m.salary, money=v=>isDollar?'$'+v.toFixed(2):'₱'+v.toFixed(2);
    monthlyBody.innerHTML+=`<tr><td>${escapeHtml(m.name)}</td><td>${m.month}</td><td>${formatDuration(m.minutes)}</td><td>${m.late} min</td><td>${m.break} min</td><td>${m.mia} min</td><td>${m.salary>0?'₱'+m.salary.toFixed(2):'-'}</td><td>${m.dollar>0?'$'+m.dollar.toFixed(2):'-'}</td><td>${inc>0?money(inc):'-'}</td><td><strong>${money(base+inc)}</strong></td></tr>`;
  });
}

function deleteRecord(i){
  if(!data[i]) return;
  const cutoff=getCutoff(data[i].date);
  if(isCutoffLocked(cutoff)){alert("This cutoff is locked. Unlock it before editing payroll records.");return;}
  if(confirm("Delete this record?")){ const d=data[i]; data.splice(i,1); audit("Record deleted",`${d.name} • ${d.date}`); saveAll(); render(); }
}
function toggleCutoffLock(cutoff){
  if(isCutoffLocked(cutoff)){
    if(!confirm(`Unlock cutoff ${cutoff}? Payroll records and incentive values can be edited again.`)) return;
    delete cutoffLocks[cutoff]; audit("Cutoff unlocked",cutoff);
  }else{
    if(!confirm(`Finalize and lock cutoff ${cutoff}? This prevents attendance and incentive edits until unlocked.`)) return;
    cutoffLocks[cutoff]={lockedAt:nowStamp()}; audit("Cutoff finalized",cutoff);
  }
  saveAll(); render();
}
function updateWeeklyIncentive(name,cutoff,value){
  if(isCutoffLocked(cutoff)){alert("This cutoff is locked.");render();return;}
  const numeric=Math.max(0,Number(value)||0), key=incentiveKey(name,cutoff), old=getWeeklyIncentive(name,cutoff);
  if(numeric===0) delete weeklyIncentives[key]; else weeklyIncentives[key]=numeric;
  audit("Weekly incentive changed",`${name} • ${cutoff} • ${old?old:0} → ${numeric}`);
  saveAll(); render();
}

function openEdit(i){
  if(data[i] && isCutoffLocked(getCutoff(data[i].date))){alert("This cutoff is locked. Unlock it before editing.");return;}
  editIndex=i; const d=data[i];
  editName.value=d.name; editDate.value=d.date; editTimeIn.value=normalizeTimeInput(d.timeIn)||d.timeIn; editTimeOut.value=normalizeTimeInput(d.timeOut)||d.timeOut; editBreak.value=d.break?d.break:''; editMia.value=d.mia?d.mia:''; editLate.value=d.late?d.late:''; editModal.style.display="flex";
}
function saveEdit(){
  if(editIndex==null||!data[editIndex])return;
  const oldCutoff=getCutoff(data[editIndex].date);
  if(isCutoffLocked(oldCutoff)){alert("This cutoff is locked. Unlock it before editing.");return;}
  const newName=editName.value.trim(), newDate=editDate.value, emp=employees.find(e=>e.name===newName);
  if(!newName||!newDate||!editTimeIn.value||!editTimeOut.value||!emp){alert("Please complete the record.");return;}
  const ti=normalizeTimeInput(convertTo24Hour(editTimeIn.value)),to=normalizeTimeInput(convertTo24Hour(editTimeOut.value)); if(!ti||!to){alert("Please enter valid time values.");return;}
  const br=Math.max(0,Math.floor(+editBreak.value||0)),mia=Math.max(0,Math.floor(+editMia.value||0)),late=Math.max(0,Math.floor(+editLate.value||0));
  const raw=calcMinutes(newDate,ti,to,br/60); if(!Number.isFinite(raw)){alert("Unable to calculate time.");return;}
  const mins=Math.max(0,Math.round(raw-mia-late)),h=mins/60,d=data[editIndex];
  d.name=newName;d.date=newDate;d.timeIn=ti;d.timeOut=to;d.break=br;d.mia=mia;d.late=late;d.minutes=mins;d.hours=h;d.salary=(h*(+emp.rate||0)).toFixed(2);d.dollar=(h*(+emp.dollarRate||0)).toFixed(2);
  audit("Record edited",`${newName} • ${newDate}`);saveAll();render();closeEditModal();
}

function addMultipleRecords(){
  const rows=[...document.querySelectorAll('.recordRow')];
  const lockedDates=rows.map(r=>r.querySelector('.rowDate')?.value).filter(Boolean).filter(d=>isCutoffLocked(getCutoff(d)));
  if(lockedDates.length){alert("One or more selected dates belong to a locked cutoff: "+[...new Set(lockedDates)].join(", "));return;}
  addMultipleRecordsLegacy();
  audit("Attendance records added",`${employeeSelect.value}`);
  saveAll(); render();
}

function addEmployee(){
  const name=empName.value.trim(); if(!name)return;
  if(employees.some(e=>e.name.toLowerCase()===name.toLowerCase())){alert("Employee already exists.");return;}
  employees.push({name,rate:+empRate.value||0,dollarRate:+empDollarRate.value||0,active:true});
  audit("Employee added",name); saveAll(); renderEmployees(); render(); empName.value="";empRate.value="";empDollarRate.value="";
}
function editEmployee(i){
  const e=employees[i]; if(!e)return;
  const hasLockedRecords=data.some(d=>d.name===e.name && isCutoffLocked(getCutoff(d.date)));
  if(hasLockedRecords){alert("This employee has locked payroll cutoffs. Unlock those cutoffs before changing the employee name or rates.");return;}
  const old=e.name,newName=prompt("Name",e.name); if(!newName||newName.trim()===old)return;
  const newRate=+prompt("₱ Rate",e.rate)||0,newDollar=+prompt("$ Rate",e.dollarRate)||0; e.name=newName.trim();e.rate=newRate;e.dollarRate=newDollar;
  data.forEach(d=>{if(d.name===old){d.name=e.name;const h=(d.minutes||0)/60;d.salary=(h*newRate).toFixed(2);d.dollar=(h*newDollar).toFixed(2);}});
  Object.keys(weeklyIncentives).forEach(k=>{if(k.startsWith(old+"||")){const c=k.slice((old+"||").length);weeklyIncentives[incentiveKey(e.name,c)]=weeklyIncentives[k];delete weeklyIncentives[k];}});
  audit("Employee updated",`${old} → ${e.name}`);saveAll();renderEmployees();render();
}
function toggleEmployeeActive(i){
  const e=employees[i]; if(!e)return; e.active=e.active===false; audit(e.active?"Employee activated":"Employee deactivated",e.name); saveAll(); renderEmployees(); render();
}
function deleteEmployee(i){toggleEmployeeActive(i);}
function renderEmployees(){
  empList.innerHTML=employees.map((e,i)=>`<div class="employee-row ${e.active===false?'inactive':''}"><strong>${escapeHtml(e.name)}</strong> ${e.active===false?'<span class="status-pill">Inactive</span>':'<span class="status-pill status-ok">Active</span>'}<div class="small-muted">₱${(+e.rate||0).toFixed(2)}/hr ${+e.dollarRate>0?'• $'+(+e.dollarRate).toFixed(2)+'/hr':''}</div><div class="employee-actions"><button onclick="editEmployee(${i})">Edit</button><button onclick="toggleEmployeeActive(${i})">${e.active===false?'Activate':'Deactivate'}</button><button onclick='showEmployeeHistory(${jsArg(e.name)})'>History</button></div></div>`).join('');
}
function openAddModal(){
  const active=employees.filter(e=>e.active!==false); if(!active.length){alert("Please add or activate an employee first.");return;}
  employeeSelect.innerHTML='<option value="">-- Select Employee --</option>'+active.map(e=>`<option value="${escapeHtml(e.name)}">${escapeHtml(e.name)}</option>`).join('');
  if(recordContainer.children.length===0) for(let i=0;i<7;i++) addRecordRow();
  addModal.style.display="flex";
}

function showEmployeeHistory(name){
  const emp=employees.find(e=>e.name===name), groups=allCutoffGroups().filter(w=>w.name===name).sort((a,b)=>new Date(b.cutoff.split(' to ')[0])-new Date(a.cutoff.split(' to ')[0]));
  const isDollar=emp&&+emp.dollarRate>0; const money=v=>isDollar?'$'+v.toFixed(2):'₱'+v.toFixed(2);
  let total=0; groups.forEach(w=>{total+=(isDollar?w.dollar:w.salary)+getWeeklyIncentive(name,w.cutoff);});
  historyContent.innerHTML=`<h3>👤 ${escapeHtml(name)} — Payroll History</h3><div class="small-muted">Lifetime payroll shown from saved records.</div><table class="history-table"><tr><th>Cutoff</th><th>Hours</th><th>Base Pay</th><th>Incentive</th><th>Total</th><th>Status</th></tr>${groups.map(w=>{const base=isDollar?w.dollar:w.salary,inc=getWeeklyIncentive(name,w.cutoff);return `<tr><td>${w.cutoff}</td><td>${formatDuration(w.minutes)}</td><td>${money(base)}</td><td>${inc?money(inc):'-'}</td><td><strong>${money(base+inc)}</strong></td><td>${isCutoffLocked(w.cutoff)?statusBadge('locked'):statusBadge(inc?'incentive':'complete')}</td></tr>`}).join('')}</table><div class="payslip-total"><strong>Total Historical Pay:</strong> ${money(total)}</div>`;
  historyModal.style.display='flex';
}
function openAuditModal(){
  auditContent.innerHTML=auditLog.length?auditLog.map(x=>`<div class="employee-row"><strong>${escapeHtml(x.action)}</strong><div class="small-muted">${escapeHtml(x.time)}</div><div>${escapeHtml(x.detail)}</div></div>`).join(''):'<p class="small-muted">No audit activity yet.</p>';
  auditModal.style.display='flex';
}
function backupPayroll(){
  const payload={version:2,exportedAt:new Date().toISOString(),employees,data,weeklyIncentives,cutoffLocks,auditLog};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`outgrow_payroll_backup_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);audit("Backup exported","Payroll backup created");
}
function restorePayroll(){restoreFile.value='';restoreFile.click();}
function handleRestoreFile(event){
  const file=event.target.files?.[0]; if(!file)return; const reader=new FileReader();
  reader.onload=()=>{try{const p=JSON.parse(reader.result);if(!Array.isArray(p.employees)||!Array.isArray(p.data))throw new Error('Invalid backup');if(!confirm('Restore this payroll backup? Current browser data will be replaced.'))return;employees=p.employees;data=p.data;weeklyIncentives=p.weeklyIncentives||{};cutoffLocks=p.cutoffLocks||{};auditLog=p.auditLog||[];employees.forEach(e=>{if(typeof e.active!=='boolean')e.active=true;delete e.workDays;});audit("Backup restored",file.name);saveAll();location.reload();}catch(e){alert('Unable to restore backup: '+e.message);}};reader.readAsText(file);
}
function confirmClear(){
  if(!confirm('This will permanently clear all payroll data in this browser. Continue?'))return;
  data=[];employees=[];weeklyIncentives={};cutoffLocks={};auditLog=[];saveAll();render();renderEmployees();closeClearModal();
}

// Use the improved employee modal and keep legacy modal open/close helpers.
function openEmployeeModal(){renderEmployees();employeeModal.style.display='flex';}
function closeEmployeeModal(){employeeModal.style.display='none';}

// Remove legacy schedule data from older versions.
employees.forEach(e=>{delete e.workDays;});
saveAll();

// Initialize V2 state and UI.
render();
toggleClearBtn();
