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

function addMultipleRecords(){

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

    if(!date || !timeInRaw || !timeOutRaw){
      invalidRow = row;
      break;
    }

    const in24 = normalizeTimeInput(convertTo24Hour(timeInRaw));
    const out24 = normalizeTimeInput(convertTo24Hour(timeOutRaw));

    if(!in24 || !out24){
      invalidRow = row;
      break;
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

  if(invalidRow){
    alert("One of the filled rows has a missing or invalid date/time.");
    invalidRow.querySelector("input")?.focus();
    return;
  }

  if(added === 0){
    alert("Please fill in at least one record.");
    return;
  }

  saveAll();
  closeAddModal();
  render();
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
let editIndex = null;

const saveAll = () => {
  localStorage.setItem("employees", JSON.stringify(employees));
  localStorage.setItem("payrollData", JSON.stringify(data));
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

  // Always reset the multiple-record form
  recordContainer.innerHTML = "";

  // Always create exactly 7 rows
  for(let i = 0; i < 7; i++){
    addRecordRow();
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

  window.currentPayslip = {
    name,
    cutoff
  };

  let rows = data
    .filter(d => d.name == name && getCutoff(d.date) == cutoff)
    .sort((a,b) => new Date(a.date) - new Date(b.date));

  let emp = employees.find(e => e.name === name);
  let isDollar = emp && emp.dollarRate > 0;

  let rateDisplay = isDollar
    ? `$${emp.dollarRate}/hr`
    : `₱${emp.rate}/hr`;

  let th = 0, tb = 0, tm = 0, tl = 0, ts = 0;

  let tableRows = "";

  rows.forEach(r => {

    // 🔥 FIX OLD RECORDS WITH NO SAVED TIME
    let timeInValue = r.timeIn || r.timein || r.inTime || "";
    let timeOutValue = r.timeOut || r.timeout || r.outTime || "";

    th += +r.hours || 0;
    tb += +(r.break || 0);
    tm += +(r.mia || 0);
    tl += +(r.late || 0);
    ts += +(r.salary || 0);

    tableRows += `
      <tr>
        <td>${r.date}</td>
        <td>${formatTime(timeInValue)}</td>
        <td>${formatTime(timeOutValue)}</td>
        <td>${toHHMM(r.hours)}</td>
        <td>${minutesToHHMM(r.late)}</td>
        <td>${minutesToHHMM(r.break)}</td>
        <td>${minutesToHHMM(r.mia)}</td>
        <td>
          ${isDollar
            ? '$' + (+r.dollar || 0).toFixed(2)
            : '₱' + (+r.salary || 0).toFixed(2)}
        </td>
      </tr>
    `;
  });

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
        <div>
          <strong>Cutoff:</strong> ${cutoff}
        </div>
      </div>

      <table class="payslip-table">
        <tr>
          <th>Date</th>
          <th>Time In</th>
          <th>Time Out</th>
          <th>Hours</th>
          <th>Late</th>
          <th>Break</th>
          <th>MIA</th>
          <th>Pay</th>
        </tr>
        ${tableRows}
      </table>

      <div class="payslip-total">
        <div><strong>Total:</strong> ${toHHMM(th)}</div>
        <div>
          Break: ${minutesToHHMM(tb)} |
          MIA: ${minutesToHHMM(tm)} |
          Late: ${minutesToHHMM(tl)}
        </div>
        <div>
          <strong>Net Pay:</strong>
          ${isDollar
            ? '$' + rows.reduce((a,b)=>a+(+b.dollar||0),0).toFixed(2)
            : '₱' + ts.toFixed(2)}
        </div>
      </div>

      <div class="payslip-footer">
        <button onclick="downloadPayslipPNG()">🖼 Save PNG</button>
        <button onclick="payslipModal.style.display='none'">Close</button>
      </div>

    </div>
  `;

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

function exportCSV(){

  if(data.length === 0){
    alert("No records available");
    return;
  }

  // ✅ Get latest date from records
  let latestDate = data
    .map(d => new Date(d.date))
    .sort((a,b)=>b-a)[0];

  let latestStr =
    latestDate.getFullYear() + "-" +
    String(latestDate.getMonth()+1).padStart(2,'0') + "-" +
    String(latestDate.getDate()).padStart(2,'0');

  let currentCutoff = getCutoff(latestStr);

  let grouped = {};

  data.forEach(d => {

    let cutoff = getCutoff(d.date);

    // ✅ ONLY LATEST CUTOFF (not today's)
    if(cutoff !== currentCutoff) return;

    let key = d.name + cutoff;

    if(!grouped[key]){
      grouped[key] = {
        name: d.name,
        cutoff: cutoff,
        minutes: 0
      };
    }

    grouped[key].minutes += +(d.minutes || 0);
  });

  if(Object.keys(grouped).length === 0){
    alert("No records found for latest cutoff");
    return;
  }

  let csv = "Employee,Cutoff,Hours,Peso Pay,Dollar Pay\n";

  Object.values(grouped)
  .sort((a,b)=>a.name.localeCompare(b.name))
  .forEach(g=>{

    let emp = employees.find(e => e.name === g.name);

    let hours = g.minutes / 60;

    let h = Math.floor(g.minutes / 60);
    let m = g.minutes % 60;
    let hoursFormatted = `${h}:${m.toString().padStart(2,'0')}`;

    let pesoPay = "";
    let dollarPay = "";

    if(emp){
      if(emp.rate > 0){
        pesoPay = (hours * emp.rate).toFixed(2);
      }
      if(emp.dollarRate > 0){
        dollarPay = (hours * emp.dollarRate).toFixed(2);
      }
    }

    csv += `${g.name},${g.cutoff},${hoursFormatted},${pesoPay},${dollarPay}\n`;
  });

  let a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8;"})
  );

  // ✅ filename
  a.download = formatCutoffFilename(currentCutoff);

  a.click();
}

function formatCutoffFilename(cutoff){
  let parts = cutoff.split(" to ");
  if(parts.length !== 2) return "weekly_cutoff.csv";

  let start = new Date(parts[0]);
  let end = new Date(parts[1]);

  let month = start.toLocaleString("en-US",{month:"long"});
  let startDay = start.getDate();
  let endDay = end.getDate();

  // ✅ ALWAYS use start month only
  return `${month}_${startDay}-${endDay}_cutoff.csv`;
}

function csvEscape(value){
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportMonthlyCSV(){

  if(data.length === 0){
    alert("No records available");
    return;
  }

  const latestDate = data
    .map(d => d.date)
    .filter(Boolean)
    .sort()
    .at(-1);

  if(!latestDate){
    alert("No valid dated records available");
    return;
  }

  const targetMonth = latestDate.slice(0, 7);
  const grouped = {};

  data.forEach(d => {
    if(!d.date || d.date.slice(0, 7) !== targetMonth) return;

    const key = `${d.name}__${targetMonth}`;

    if(!grouped[key]){
      grouped[key] = {
        name: d.name,
        month: targetMonth,
        minutes: 0
      };
    }

    grouped[key].minutes += +(d.minutes || 0);
  });

  if(Object.keys(grouped).length === 0){
    alert("No monthly records found");
    return;
  }

  let csv = "Employee,Month,Hours,Peso Pay,Dollar Pay\n";

  Object.values(grouped)
    .sort((a,b) => a.name.localeCompare(b.name))
    .forEach(g => {
      const emp = employees.find(e => e.name === g.name);
      const hours = g.minutes / 60;
      const h = Math.floor(g.minutes / 60);
      const m = Math.round(g.minutes % 60);
      const hoursFormatted = `${h}:${m.toString().padStart(2,'0')}`;

      const pesoPay = emp && +emp.rate > 0 ? (hours * +emp.rate).toFixed(2) : "";
      const dollarPay = emp && +emp.dollarRate > 0 ? (hours * +emp.dollarRate).toFixed(2) : "";

      csv += [
        csvEscape(g.name),
        csvEscape(g.month),
        csvEscape(hoursFormatted),
        csvEscape(pesoPay),
        csvEscape(dollarPay)
      ].join(",") + "\n";
    });

  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + csv], {type:"text/csv;charset=utf-8;"})
  );

  const a = document.createElement("a");
  a.href = url;
  a.download = `${targetMonth}_monthly.csv`;
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 0);
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

/* ================= RENDER ================= */

function render(){

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
        <td>
          <button onclick="showPayslip('${w.name}','${w.cutoff}')">
            Payslip
          </button>
        </td>
      </tr>
    `;
  });

  /* ================= MONTHLY TABLE ================= */

  Object.values(monthly).forEach(m=>{

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
      </tr>
    `;
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

render();
toggleClearBtn();