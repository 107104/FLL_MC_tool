
const DEMO = {
 events:[
  {id:"boulder-2026",name:"Boulder County Qualifier (DEMO)",date:"2026-11-07",venue:"Demo event — replace with verified event data"},
  {id:"state-2026",name:"Colorado Championship (DEMO)",date:"2026-12-05",venue:"Demo event — replace with verified event data"}
 ],
 teams:[
  {number:"12345",name:"Example Robotics",city:"Longmont (demo)",pronunciation:"Verified pronunciation (demo)",bio:"A fictional team that loves building, testing, and improving robots."},
  {number:"67890",name:"The LEGO Legends",city:"Boulder (demo)",pronunciation:"LEE-goh LEH-jundz",bio:"A fictional team focused on creative engineering and teamwork."},
  {number:"24680",name:"Canopy Coders",city:"Fort Collins (demo)",pronunciation:"CAN-oh-pee COH-ders",bio:"A fictional team exploring this season's nature-inspired challenge."},
  {number:"13579",name:"Gear Gardeners",city:"Golden (demo)",pronunciation:"GEER GAR-den-ers",bio:"A fictional team that combines careful testing with imaginative design."}
 ],
 matches:[
  {event:"boulder-2026",number:1,table:"1",runType:"Practice",team1:"12345",team2:"67890",startTime:"09:00"},
  {event:"boulder-2026",number:2,table:"1",runType:"Practice",team1:"24680",team2:"13579",startTime:"09:08"},
  {event:"boulder-2026",number:3,table:"2",runType:"Official 1",team1:"12345",team2:"24680",startTime:"09:16"},
  {event:"boulder-2026",number:4,table:"2",runType:"Official 1",team1:"67890",team2:"13579",startTime:"09:24"},
  {event:"state-2026",number:1,table:"1",runType:"Practice",team1:"12345",team2:"24680",startTime:"09:00"}
 ],
 scripts:{},notes:{},settings:{},cursor:{}
};
let db = loadDB();
let editingTeamNumber = null;
let scriptEditing = false;
function loadDB(){try{const raw=cloudStorage.getItem("coFllGaDb");if(raw){const parsed=JSON.parse(raw);if(parsed&&parsed.events&&parsed.teams&&parsed.matches)return parsed}}catch(e){}return structuredClone(DEMO)}
function saveDB(){cloudStorage.setItem("coFllGaDb",JSON.stringify(db))}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function selectedEvent(){return document.getElementById("eventSelect").value||db.events[0]?.id}
function eventMatches(){return db.matches.filter(m=>m.event===selectedEvent()).sort((a,b)=>{const ar=Number(a.sourceRound??a.number),br=Number(b.sourceRound??b.number);return ar-br||String(a.startTime||'').localeCompare(String(b.startTime||''))||Number(a.table)-Number(b.table)||Number(a.number)-Number(b.number)})}
function matchGroupKey(m){return m.sourceRound!=null?'round:'+m.sourceRound:(m.startTime?'time:'+m.startTime:'match:'+m.number)}
function matchGroups(){const groups=[];for(const m of eventMatches()){const key=matchGroupKey(m);let g=groups.find(x=>x.key===key);if(!g){g={key,matches:[],round:m.sourceRound??m.number,time:m.startTime||''};groups.push(g)}g.matches.push(m)}return groups}
// A 15+ minute interval between round start times is treated as a scheduled gap.
// This is a gap between starts, not necessarily the exact duration of a break.
const BREAK_GAP_MINUTES=15;
function scheduleMinutes(time){
 const m=String(time||'').trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
 if(!m)return null;
 let hour=Number(m[1]),minute=Number(m[2]);if(hour>23||minute>59)return null;
 if(m[3]){hour=hour%12+(m[3].toUpperCase()==='PM'?12:0)}
 return hour*60+minute;
}
function scheduledGap(groups,i){
 if(i<1||i>=groups.length)return null;
 const a=scheduleMinutes(groups[i-1].time),b=scheduleMinutes(groups[i].time);
 if(a===null||b===null)return null;
 const minutes=b-a;
 return minutes>=BREAK_GAP_MINUTES?{minutes,from:groups[i-1].time,to:groups[i].time}:null;
}
let pendingBreakIndex=null;
function closeBreak(){pendingBreakIndex=null;document.getElementById('breakOverlay').classList.add('hidden')}
function navigateRound(i){
 const groups=matchGroups();if(i<0||i>=groups.length)return;
 const current=activeIndex();
 // Show the notice only when advancing across a gap, not on backwards navigation.
 const gap=i===current+1?scheduledGap(groups,i):null;
 if(gap){
  pendingBreakIndex=i;
  document.getElementById('breakTimes').textContent=`${gap.from} → ${gap.to}`;
  document.getElementById('breakDescription').textContent=`There are ${gap.minutes} minutes between scheduled round start times. The next round is Round ${groups[i].round} at ${gap.to}. Check the event schedule for the actual break duration.`;
  document.getElementById('breakOverlay').classList.remove('hidden');
  document.getElementById('continueAfterBreak').focus();
 }else jumpMatch(i);
}
function tableColorClass(table){const n=Number(String(table).trim());return Number.isInteger(n)&&n%2===0?"even-table":"odd-table"}
function team(n){return db.teams.find(t=>String(t.number)===String(n))||{number:String(n||"—"),name:"Unknown team",city:"",pronunciation:"",bio:""}}
function activeIndex(){const gs=matchGroups();const n=db.cursor[selectedEvent()]??0;return Math.max(0,Math.min(n,Math.max(0,gs.length-1)))}
function initEvents(){const sel=document.getElementById("eventSelect");const old=sel.value;sel.innerHTML=db.events.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join("");if(db.events.some(e=>e.id===old))sel.value=old;else if(db.events.length)sel.value=db.events[0].id}
function showTab(tab){document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));["console","scripts","teams","events","missions","data","awards","jokes"].forEach(id=>document.getElementById(id).classList.toggle("hidden",id!==tab));if(tab==="teams")renderTeams();if(tab==="events")renderMatches();if(tab==="jokes")loadJokes();if(tab==="awards"&&typeof refreshAwards==="function")refreshAwards()}
function renderConsole(){
 const groups=matchGroups(),idx=activeIndex(),cur=groups[idx],next=groups[idx+1],e=db.events.find(x=>x.id===selectedEvent());
 const tableLabel=g=>g.matches.map(m=>m.table).join(', ');
 document.getElementById('statCurrent').textContent=cur?`Round ${cur.round}`:'No matches';
 document.getElementById('statCurrentSub').textContent=cur?`${cur.time||'Time not set'} · ${cur.matches.length} table(s)`:'Import a schedule to begin';
 document.getElementById('statNext').textContent=next?`Round ${next.round}`:'End of queue';
 document.getElementById('statNextSub').textContent=next?`${next.time||'Time not set'} · ${next.matches.length} table(s)`:'No upcoming round';
 const playing=cur?cur.matches.flatMap(m=>[m.team1,m.team2].filter(Boolean)):[];
 document.getElementById('statTeams').textContent=playing.length;
 document.getElementById('statTeamsSub').textContent=cur?`Across ${cur.matches.length} active table(s)`:'No active tables';
 document.getElementById('heroMatch').textContent=cur?`Round ${cur.round}`:'No matches loaded';
 document.getElementById('heroMeta').textContent=cur?`${cur.time||'Time not set'} · ${cur.matches.length} table(s) · ${playing.length} teams`:(e?.name||'Select an event');
 document.getElementById('currentTeams').innerHTML=cur?cur.matches.map(m=>`<div class="table-group ${tableColorClass(m.table)}"><h4 class="table-heading">Table ${esc(m.table)} · Match ${esc(m.number)}</h4>${[m.team1,m.team2].filter(Boolean).map(n=>{const t=team(n);return `<div class="teamline"><div class="teamnumber">${esc(t.number)}</div><div class="teaminfo"><div class="teamname">${esc(t.name)}</div><div class="sub">${esc(t.pronunciation||'Pronunciation not entered')}${t.city?' · '+esc(t.city):''}</div>${t.bio?`<div class="sub">${esc(t.bio)}</div>`:''}</div><button class="btn small" data-profile="${esc(t.number)}">Profile</button></div>`}).join('')}</div>`).join(''):'<div class="empty">No round selected. Import a schedule or choose another event.</div>';
 document.querySelectorAll('#currentTeams [data-profile]').forEach(b=>b.addEventListener('click',()=>quickProfile(b.dataset.profile)));
 const key=selectedEvent();const defaultScript=cur?`Welcome to the robot game! ${cur.matches.map(m=>`At Table ${m.table}, please welcome ${team(m.team1).name} and ${team(m.team2).name}.`).join(' ')}`:'Welcome to the FIRST LEGO League Challenge robot game!';
 document.getElementById('scriptText').textContent=db.scripts[key]??defaultScript;
 document.getElementById('queue').innerHTML=groups.slice(Math.max(0,idx-1),Math.min(groups.length,idx+5)).map((g,j)=>{const realIdx=Math.max(0,idx-1)+j;return `<div class="queueitem"><div><strong>${realIdx===idx?'▶ ':''}Round ${esc(g.round)} · ${esc(g.time||'Time TBD')}</strong><div class="sub">Tables ${esc(tableLabel(g))} · ${g.matches.length*2} teams</div>${scheduledGap(groups,realIdx)?'<div class="break-marker">☕ Scheduled gap before this round</div>':''}</div><button class="btn small" data-round="${realIdx}">${realIdx===idx?'Current':'Go to'}</button></div>`}).join('')||'<div class="empty">No matches for this event.</div>';
 document.querySelectorAll('#queue [data-round]').forEach(b=>b.addEventListener('click',()=>navigateRound(Number(b.dataset.round))));
 document.getElementById('gaNotes').value=db.notes[key]||'';
 document.getElementById('freshness').textContent=`${e?.name||'No event selected'} · Local data only · Live sync is not connected.`;
 document.getElementById('freshness').className='notice';
}
function renderTeams(){
 const q=document.getElementById("teamSearch").value.toLowerCase();const list=db.teams.filter(t=>[t.number,t.name,t.city,t.pronunciation,t.bio].join(" ").toLowerCase().includes(q)).sort((a,b)=>String(a.number).localeCompare(String(b.number),undefined,{numeric:true}));
 document.getElementById("teamList").innerHTML=list.map(t=>`<div class="teamprofile"><div><div class="teamname">#${esc(t.number)} · ${esc(t.name)}</div><div class="sub">${esc(t.city||"City not entered")} · ${esc(t.pronunciation||"Pronunciation not entered")}</div>${t.bio?`<p style="margin:8px 0 0;line-height:1.5">${esc(t.bio)}</p>`:""}</div><div class="profile-actions"><button class="btn small" onclick="editTeam('${esc(t.number)}')">Edit</button><button class="btn small" onclick="quickProfile('${esc(t.number)}')">Use in GA</button></div></div>`).join("")||'<div class="empty">No matching teams. Add a profile or change your search.</div>';
}
function renderMatches(){
 const ms=eventMatches();
 document.getElementById("matchTable").innerHTML=ms.length?`<table><thead><tr><th>Match</th><th>Table</th><th>Type</th><th>Time</th><th>Teams</th></tr></thead><tbody>${ms.map(m=>`<tr><td><strong>${esc(m.number)}</strong></td><td><span class="table-color ${tableColorClass(m.table)}" style="--table-accent:${Number(m.table)%2===0?'#1d5fd0':'#c62828'}">${esc(m.table)}</span></td><td>${esc(m.runType)}</td><td>${esc(m.startTime||"—")}</td><td>${esc(m.team1)} ${esc(team(m.team1).name)}<br>${esc(m.team2)} ${esc(team(m.team2).name)}</td></tr>`).join("")}</tbody></table>`:'<div class="empty">No matches imported for this event.</div>';
}
const BOULDER_2025_TEST = {"event":{"id":"boulder-2025-pm","name":"Boulder Qualifier — PM Official (Nov 8, 2025)","date":"2025-11-08","venue":"Boulder, Colorado · historical test data"},"teams":[{"number":"3624","name":"Casa Robotics","city":"","pronunciation":"","bio":""},{"number":"39250","name":"Dawson 3","city":"","pronunciation":"","bio":""},{"number":"45881","name":"Red Team Dawson","city":"","pronunciation":"","bio":""},{"number":"45882","name":"Dawson 4","city":"","pronunciation":"","bio":""},{"number":"45883","name":"Orange Team Dawson","city":"","pronunciation":"","bio":""},{"number":"61020","name":"DreamBotics","city":"","pronunciation":"","bio":""},{"number":"61298","name":"Mesa Elementary","city":"","pronunciation":"","bio":""},{"number":"61299","name":"Fairview PreK-8","city":"","pronunciation":"","bio":""},{"number":"61590","name":"Hulstrom All-Stars","city":"","pronunciation":"","bio":""},{"number":"61957","name":"Colorado STEM Academy","city":"","pronunciation":"","bio":""},{"number":"64939","name":"BroomBuilders","city":"","pronunciation":"","bio":""},{"number":"71823","name":"Fluffy Cheez Its","city":"","pronunciation":"","bio":""},{"number":"71824","name":"Brick Stripe Brigade","city":"","pronunciation":"","bio":""},{"number":"71825","name":"Mesa Elementary Team 2","city":"","pronunciation":"","bio":""},{"number":"71889","name":"Boulder Cyclones","city":"","pronunciation":"","bio":""},{"number":"72179","name":"Archeology Allosauruses","city":"","pronunciation":"","bio":""},{"number":"72180","name":"Indiana Bones","city":"","pronunciation":"","bio":""},{"number":"72416","name":"Dawson Purple","city":"","pronunciation":"","bio":""},{"number":"72440","name":"Dawson Green","city":"","pronunciation":"","bio":""},{"number":"72441","name":"Dawson Chartreuse","city":"","pronunciation":"","bio":""},{"number":"72871","name":"Dawson Burgundy","city":"","pronunciation":"","bio":""},{"number":"73689","name":"A.R.T.W.I.P.","city":"","pronunciation":"","bio":""},{"number":"73690","name":"The Glowing Embers","city":"","pronunciation":"","bio":""},{"number":"74832","name":"PRA Team Phoenix","city":"","pronunciation":"","bio":""}],"matches":[{"event":"boulder-2025-pm","number":1,"table":"1","runType":"Official","team1":"64939","team2":"71823","startTime":"12:40"},{"event":"boulder-2025-pm","number":2,"table":"2","runType":"Official","team1":"72871","team2":"72179","startTime":"12:45"},{"event":"boulder-2025-pm","number":3,"table":"1","runType":"Official","team1":"72416","team2":"71825","startTime":"12:50"},{"event":"boulder-2025-pm","number":4,"table":"2","runType":"Official","team1":"61298","team2":"73689","startTime":"12:55"},{"event":"boulder-2025-pm","number":5,"table":"1","runType":"Official","team1":"61020","team2":"45881","startTime":"13:00"},{"event":"boulder-2025-pm","number":6,"table":"2","runType":"Official","team1":"61590","team2":"71889","startTime":"13:05"},{"event":"boulder-2025-pm","number":7,"table":"1","runType":"Official","team1":"72180","team2":"45882","startTime":"13:10"},{"event":"boulder-2025-pm","number":8,"table":"2","runType":"Official","team1":"71824","team2":"73690","startTime":"13:15"},{"event":"boulder-2025-pm","number":9,"table":"1","runType":"Official","team1":"61957","team2":"39250","startTime":"13:20"},{"event":"boulder-2025-pm","number":10,"table":"2","runType":"Official","team1":"72441","team2":"61299","startTime":"13:25"},{"event":"boulder-2025-pm","number":11,"table":"1","runType":"Official","team1":"3624","team2":"45883","startTime":"13:30"},{"event":"boulder-2025-pm","number":12,"table":"2","runType":"Official","team1":"72440","team2":"74832","startTime":"13:35"},{"event":"boulder-2025-pm","number":14,"table":"1","runType":"Official","team1":"71823","team2":"72179","startTime":"13:45"},{"event":"boulder-2025-pm","number":15,"table":"2","runType":"Official","team1":"64939","team2":"72871","startTime":"13:50"},{"event":"boulder-2025-pm","number":16,"table":"1","runType":"Official","team1":"71825","team2":"73689","startTime":"13:55"},{"event":"boulder-2025-pm","number":17,"table":"2","runType":"Official","team1":"72416","team2":"61298","startTime":"14:00"},{"event":"boulder-2025-pm","number":18,"table":"1","runType":"Official","team1":"45881","team2":"71889","startTime":"14:05"},{"event":"boulder-2025-pm","number":19,"table":"2","runType":"Official","team1":"61020","team2":"61590","startTime":"14:10"},{"event":"boulder-2025-pm","number":20,"table":"1","runType":"Official","team1":"45882","team2":"73690","startTime":"14:15"},{"event":"boulder-2025-pm","number":21,"table":"2","runType":"Official","team1":"72180","team2":"71824","startTime":"14:20"},{"event":"boulder-2025-pm","number":22,"table":"1","runType":"Official","team1":"39250","team2":"61299","startTime":"14:25"},{"event":"boulder-2025-pm","number":23,"table":"2","runType":"Official","team1":"61957","team2":"72441","startTime":"14:30"},{"event":"boulder-2025-pm","number":24,"table":"1","runType":"Official","team1":"45883","team2":"74832","startTime":"14:35"},{"event":"boulder-2025-pm","number":25,"table":"2","runType":"Official","team1":"3624","team2":"72440","startTime":"14:40"},{"event":"boulder-2025-pm","number":27,"table":"1","runType":"Official","team1":"72179","team2":"72871","startTime":"14:50"},{"event":"boulder-2025-pm","number":28,"table":"2","runType":"Official","team1":"71823","team2":"64939","startTime":"14:55"},{"event":"boulder-2025-pm","number":29,"table":"1","runType":"Official","team1":"73689","team2":"61298","startTime":"15:00"},{"event":"boulder-2025-pm","number":30,"table":"2","runType":"Official","team1":"71825","team2":"72416","startTime":"15:05"},{"event":"boulder-2025-pm","number":31,"table":"1","runType":"Official","team1":"71889","team2":"61590","startTime":"15:10"},{"event":"boulder-2025-pm","number":32,"table":"2","runType":"Official","team1":"45881","team2":"61020","startTime":"15:15"},{"event":"boulder-2025-pm","number":33,"table":"1","runType":"Official","team1":"73690","team2":"71824","startTime":"15:20"},{"event":"boulder-2025-pm","number":34,"table":"2","runType":"Official","team1":"45882","team2":"72180","startTime":"15:25"},{"event":"boulder-2025-pm","number":35,"table":"1","runType":"Official","team1":"61299","team2":"72441","startTime":"15:30"},{"event":"boulder-2025-pm","number":36,"table":"2","runType":"Official","team1":"39250","team2":"61957","startTime":"15:35"}]};
function loadBoulderTestData(){
 if(!confirm("Load historical Boulder Qualifier data from Nov 8, 2025? This will add/replace that event and update its 24 team profiles and 34 populated match entries (two numbered slots in the source sheet were blank). Other events and profiles are kept."))return;
 const e=BOULDER_2025_TEST.event;
 const ei=db.events.findIndex(x=>x.id===e.id);
 if(ei>=0)db.events[ei]=e;else db.events.push(e);
 BOULDER_2025_TEST.teams.forEach(t=>{const i=db.teams.findIndex(x=>String(x.number)===String(t.number));if(i>=0)db.teams[i]={...db.teams[i],...t};else db.teams.push(t)});
 db.matches=db.matches.filter(m=>m.event!==e.id).concat(BOULDER_2025_TEST.matches);
 db.cursor[e.id]=0;db.scripts[e.id]="Welcome to the Boulder Qualifier! Please welcome "+team(BOULDER_2025_TEST.matches[0]?.team1).name+" and "+team(BOULDER_2025_TEST.matches[0]?.team2).name+" to Table "+(BOULDER_2025_TEST.matches[0]?.table||"1")+".";
 saveDB();initEvents();document.getElementById("eventSelect").value=e.id;renderAll();document.getElementById("freshness").textContent="Historical test data loaded: 24 teams and 34 populated official match entries from Boulder, Nov 8, 2025. Two numbered slots in the source sheet were blank and were excluded. This is imported workbook data, not a live feed.";document.getElementById("freshness").className="notice success";showTab("console");
}
function renderAll(){initEvents();renderConsole();renderTeams();renderMatches()}
function jumpMatch(i){db.cursor[selectedEvent()]=i;saveDB();renderConsole()}
function quickProfile(n){showTab("teams");document.getElementById("teamSearch").value=String(n);renderTeams()}
function editTeam(n){const t=team(n);editingTeamNumber=String(n);document.getElementById("teamFormCard").classList.remove("hidden");document.getElementById("teamFormTitle").textContent="Edit team profile";document.getElementById("teamNumber").value=t.number;document.getElementById("teamNumber").disabled=true;document.getElementById("teamName").value=t.name;document.getElementById("teamCity").value=t.city||"";document.getElementById("teamPronunciation").value=t.pronunciation||"";document.getElementById("teamBio").value=t.bio||"";document.getElementById("teamFormCard").scrollIntoView({behavior:"smooth",block:"start"})}
function newTeam(){editingTeamNumber=null;document.getElementById("teamForm").reset();document.getElementById("teamNumber").disabled=false;document.getElementById("teamFormTitle").textContent="Add team profile";document.getElementById("teamFormCard").classList.remove("hidden");document.getElementById("teamNumber").focus()}
function parseCSV(text){const rows=[];let row=[],field="",quoted=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'&&quoted&&n==='"'){field+='"';i++}else if(c==='"'){quoted=!quoted}else if(c===','&&!quoted){row.push(field.trim());field=""}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(field.trim());if(row.some(x=>x!==""))rows.push(row);row=[];field=""}else field+=c}if(field.length||row.length){row.push(field.trim());if(row.some(x=>x!==""))rows.push(row)}if(!rows.length)return [];const headers=rows.shift().map(h=>h.trim().toLowerCase().replace(/[\s-]+/g,"_"));return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??""])))}
function download(name,content,type="text/plain"){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function backup(){const ceremonyEvents={};for(let i=0;i<cloudStorage.length;i++){const k=cloudStorage.key(i);if(k.startsWith('coFllCeremonyEvent:'))ceremonyEvents[k]=cloudStorage.getItem(k)}return {version:2,exportedAt:new Date().toISOString(),...db,ceremonyEvents}}
document.querySelectorAll("nav button").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.tab==='scripts'&&typeof ceremonyRefreshEvents==='function'){ceremonyRefreshEvents(selectedEvent());ceremonyPopulate()}showTab(b.dataset.tab)}));
document.getElementById("loadBoulderTest").addEventListener("click",loadBoulderTestData);
document.getElementById("eventSelect").addEventListener("change",()=>{renderConsole();renderMatches()});
document.getElementById("refreshBtn").addEventListener("click",renderConsole);
document.getElementById('continueAfterBreak').addEventListener('click',()=>{const i=pendingBreakIndex;closeBreak();if(i!==null)jumpMatch(i)});
document.getElementById('closeBreak').addEventListener('click',closeBreak);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.getElementById('breakOverlay').classList.contains('hidden'))closeBreak()});
document.getElementById("nextMatch").addEventListener("click",()=>{const ms=matchGroups();if(activeIndex()<ms.length-1){navigateRound(activeIndex()+1)}else alert("You are at the end of this event's match queue.")});
document.getElementById("previousMatch").addEventListener("click",()=>{if(activeIndex()>0)navigateRound(activeIndex()-1)});
document.getElementById("copyScript").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(document.getElementById("scriptText").textContent);document.getElementById("copyScript").textContent="Copied!"}catch(e){alert("Clipboard access is blocked in this browser. Select and copy the script text instead.")}});
document.getElementById("editScript").addEventListener("click",()=>{scriptEditing=true;const ed=document.getElementById("scriptEditor");ed.value=document.getElementById("scriptText").textContent;ed.classList.remove("hidden");document.getElementById("saveScript").hidden=false;document.getElementById("editScript").hidden=true});
document.getElementById("saveScript").addEventListener("click",()=>{db.scripts[selectedEvent()]=document.getElementById("scriptEditor").value;saveDB();scriptEditing=false;document.getElementById("scriptEditor").classList.add("hidden");document.getElementById("saveScript").hidden=true;document.getElementById("editScript").hidden=false;renderConsole()});
document.getElementById("saveNotes").addEventListener("click",()=>{db.notes[selectedEvent()]=document.getElementById("gaNotes").value;saveDB();document.getElementById("noteStatus").textContent="Saved locally."});
document.getElementById("searchTeamsBtn").addEventListener("click",()=>{showTab("teams");document.getElementById("teamSearch").focus()});
document.getElementById("addNoteBtn").addEventListener("click",()=>{document.getElementById("gaNotes").focus();document.getElementById("noteStatus").textContent="Add your note, then select Save notes."});
document.getElementById("exportBtn").addEventListener("click",()=>download("colorado-fll-ga-backup.json",JSON.stringify(backup(),null,2),"application/json"));
document.getElementById("addTeamBtn").addEventListener("click",newTeam);
document.getElementById("cancelTeam").addEventListener("click",()=>document.getElementById("teamFormCard").classList.add("hidden"));
document.getElementById("teamSearch").addEventListener("input",renderTeams);
document.getElementById("teamForm").addEventListener("submit",e=>{e.preventDefault();const n=document.getElementById("teamNumber").value.trim();const item={number:n,name:document.getElementById("teamName").value.trim(),city:document.getElementById("teamCity").value.trim(),pronunciation:document.getElementById("teamPronunciation").value.trim(),bio:document.getElementById("teamBio").value.trim()};if(!n||!item.name)return;if(editingTeamNumber){const i=db.teams.findIndex(t=>String(t.number)===editingTeamNumber);if(i>=0)db.teams[i]={...db.teams[i],...item}}else{const i=db.teams.findIndex(t=>String(t.number)===n);if(i>=0){if(!confirm("That team number already exists. Replace its profile?"))return;db.teams[i]={...db.teams[i],...item}}else db.teams.push(item)}saveDB();document.getElementById("teamFormCard").classList.add("hidden");document.getElementById("teamNumber").disabled=false;renderAll()});
 let pendingAnnouncerImport=null;
async function readExcelOffline(file){
 const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer);
 const u16=p=>view.getUint16(p,true),u32=p=>view.getUint32(p,true);
 let end=-1;for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--){if(u32(p)===0x06054b50){end=p;break}}
 if(end<0)throw Error('Not a valid XLSX (ZIP) workbook.');
 const entries=new Map();let at=u32(end+16),count=u16(end+10);
 for(let i=0;i<count;i++){
  if(u32(at)!==0x02014b50)throw Error('Invalid workbook ZIP directory.');
  const method=u16(at+10),size=u32(at+20),nameLen=u16(at+28),extra=u16(at+30),comment=u16(at+32),offset=u32(at+42);
  const name=new TextDecoder().decode(bytes.slice(at+46,at+46+nameLen));entries.set(name,{method,size,offset});at+=46+nameLen+extra+comment;
 }
 async function entry(name){const e=entries.get(name);if(!e)throw Error('Workbook is missing '+name);const pos=e.offset;if(u32(pos)!==0x04034b50)throw Error('Invalid workbook ZIP entry.');const start=pos+30+u16(pos+26)+u16(pos+28),data=bytes.slice(start,start+e.size);
  if(e.method===0)return new TextDecoder().decode(data);
  if(e.method!==8)throw Error('Unsupported Excel compression method.');
  if(typeof DecompressionStream==='undefined')throw Error('This browser does not support offline XLSX decompression. Try a current version of Chrome, Edge, or Safari.');
  try{const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));return await new Response(stream).text()}
  catch(err){throw Error('Could not decompress XLSX in this browser: '+err.message)}
 }
 const xml=t=>{const doc=new DOMParser().parseFromString(t,'application/xml');if(doc.querySelector('parsererror'))throw Error('Invalid Excel worksheet XML.');return doc};
 const tags=(el,name)=>Array.from(el.getElementsByTagNameNS('*',name));
 let strings=[];if(entries.has('xl/sharedStrings.xml')){const doc=xml(await entry('xl/sharedStrings.xml'));strings=tags(doc,'si').map(si=>tags(si,'t').map(t=>t.textContent).join(''))}
 const workbook=xml(await entry('xl/workbook.xml'));
 const sheets=tags(workbook,'sheet');if(!sheets.length)throw Error('Workbook has no worksheets.');
 const relMap=new Map();if(entries.has('xl/_rels/workbook.xml.rels')){
  const rels=xml(await entry('xl/_rels/workbook.xml.rels'));
  for(const rel of tags(rels,'Relationship'))relMap.set(rel.getAttribute('Id'),rel.getAttribute('Target'));
 }
 const all={};
 for(let si=0;si<sheets.length;si++){
  const sh=sheets[si],rid=sh.getAttribute('r:id')||sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
  const t=relMap.get(rid);let target=t?(t.startsWith('/')?t.slice(1):'xl/'+t.replace(/^\.\//,'').replace(/^xl\//,'')):`xl/worksheets/sheet${si+1}.xml`;
  if(!entries.has(target))continue;
  const doc=xml(await entry(target)),rows=[];
  for(const row of tags(doc,'row')){
   const record=[];
   for(const cell of tags(row,'c')){
    const ref=cell.getAttribute('r')||'',letters=(ref.match(/^[A-Z]+/i)||[])[0];if(!letters)continue;
    let index=0;for(const c of letters.toUpperCase())index=index*26+c.charCodeAt(0)-64;index--;
    const type=cell.getAttribute('t'),v=tags(cell,'v')[0]?.textContent??'';
    const value=type==='inlineStr'?tags(cell,'t').map(t=>t.textContent).join(''):type==='s'?strings[Number(v)]??'':v;
    record[index]=String(value);
   }
   rows[Number(row.getAttribute('r')||rows.length+1)-1]=record;
  }
  all[sh.getAttribute('name')]=rows;
 }
 return all;
}

 function resetAnnouncerPreview(message="No Excel workbook selected."){pendingAnnouncerImport=null;document.getElementById("announcerPreview").innerHTML="";document.getElementById("announcerImportStatus").textContent=message;document.getElementById("confirmAnnouncerImport").classList.add("hidden");document.getElementById("cancelAnnouncerImport").classList.add("hidden")}
 document.getElementById("downloadCombinedTemplate").addEventListener("click",()=>{const a=document.createElement("a");a.href="data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,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";a.download="fll-announcer-template.xlsx";a.click()});
 function gaSheetRows(sheet){const headers=sheet[0]||[];return sheet.slice(1).map(row=>Object.fromEntries(headers.map((h,i)=>[String(h||'').trim().toLowerCase().replace(/[\s-]+/g,'_'),String(row?.[i]??'').trim()]).filter(([k])=>k)));}
 function gaTime(raw){const v=String(raw??'').trim();if(!v)return '';
  if(/^\d+(\.\d+)?$/.test(v)){const fraction=Number(v)%1;const total=Math.round(fraction*86400);return `${String(Math.floor(total/3600)%24).padStart(2,'0')}:${String(Math.floor(total%3600/60)).padStart(2,'0')}`;}
  return v;
 }
 function gaParseEmcee(rows,runType){const matches=[];
  for(let i=0;i<rows.length;i++){
   const row=rows[i]||[],raw=String(row[0]??'').trim();
   if(!/^\d+(?:\.0+)?$/.test(raw))continue;
   const round=Number(raw),next=rows[i+1]||[],time=gaTime(next[0]);
   // Identify every table from the header row immediately above this round.
   const header=rows[i-1]||[],tables=[];
   for(let col=1;col<Math.max(row.length,header.length);col++){
    const h=String(header[col]??'').trim(),match=h.match(/^(\d+)A$/i);
    if(match){const other=String(header[col+1]??'').trim();if(other.toUpperCase()===match[1]+'B')tables.push({table:match[1],a:col,b:col+1});}
   }
   if(!tables.length){for(let col=1;col+1<row.length;col+=2)tables.push({table:String((col+1)/2),a:col,b:col+1})}
   for(const t of tables){
    const a=String(row[t.a]??'').trim().replace(/\.0+$/,''),b=String(row[t.b]??'').trim().replace(/\.0+$/,'');
    if(!/^\d+$/.test(a)||!/^\d+$/.test(b)||a===b)continue;
    matches.push({number:matches.length+1,sourceRound:round,table:t.table,runType,startTime:time,team1:a,team2:b});
   }
  }
  return matches;
 }
 function gaParseWorkbook(sheets){
  const teamSheet=sheets['Team Info'];
  if(sheets['emcee(am)']||sheets['emcee(pm)']){
   const teams=new Map();
   for(const row of (teamSheet||[]).slice(1)){
    const n=String(row?.[0]??'').trim().replace(/\.0$/,''),name=String(row?.[1]??'').trim();
    if(/^\d+$/.test(n)&&name)teams.set(n,{number:n,name,city:String(row?.[2]??'').trim(),pronunciation:'',bio:''});
   }
   const groups=[];
   for(const [sheetName,suffix,type] of [['emcee(am)','Practice','Practice'],['emcee(pm)','Official','Official']]){
    if(sheets[sheetName]){const matches=gaParseEmcee(sheets[sheetName],type);if(matches.length)groups.push({suffix,matches});}
   }
   if(!groups.length)throw Error('The emcee sheets contain no complete two-team match pairings.');
   const info=sheets['Event Info']||[],name=String(info[0]?.[1]||'Colorado FLL Event').trim();
   return {groups,teams:[...teams.values()],suggestedName:name,format:'Colorado FLL schedule'};
  }
  const first=Object.values(sheets).find(rows=>rows?.[0]?.some(h=>String(h||'').trim().toLowerCase().replace(/[\s-]+/g,'_')==='match_number'));
  if(!first)throw Error('No supported schedule sheets found. Expected emcee(am)/emcee(pm), or a match_number/team1/team2 worksheet.');
  const rows=gaSheetRows(first),matches=[],teams=new Map(),seen=new Set(),errors=[];
  rows.forEach((r,i)=>{const n=String(r.match_number||r.number||'').trim(),a=String(r.team1||'').trim(),b=String(r.team2||'').trim();
   if(!/^\d+$/.test(n)||!a||!b){errors.push(`Row ${i+2}: missing match number or team.`);return;}
   if(a===b||seen.has(n)){errors.push(`Row ${i+2}: repeated team or match number.`);return;}seen.add(n);
   matches.push({number:Number(n),table:r.table||'1',runType:r.run_type||'Official',startTime:r.start_time||'',team1:a,team2:b});
   for(const side of [1,2]){const number=side===1?a:b,p=`team${side}_`,name=(r[p+'name']||'').trim();if(name)teams.set(number,{number,name,city:r[p+'city']||'',pronunciation:r[p+'pronunciation']||'',bio:r[p+'bio']||''});}
  });
  if(errors.length)throw Error(errors.slice(0,5).join(' '));
  if(!matches.length)throw Error('No complete match pairings found.');
  return {groups:[{suffix:'',matches}],teams:[...teams.values()],format:'Standard template'};
 }
 document.getElementById('announcerCsvFile').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;resetAnnouncerPreview();
  try{
   const parsed=gaParseWorkbook(await readExcelOffline(f));pendingAnnouncerImport=parsed;
   if(parsed.suggestedName&&!document.getElementById('announcerEventName').value.trim())document.getElementById('announcerEventName').value=parsed.suggestedName;
   const total=parsed.groups.reduce((n,g)=>n+g.matches.length,0);
   document.getElementById('announcerImportStatus').textContent=`${parsed.format} detected. Ready to import ${total} table matches across ${parsed.groups.length} event(s), with ${parsed.teams.length} named teams. Review below before importing.`;
   document.getElementById('announcerPreview').innerHTML=parsed.groups.map(g=>`<h4>${esc(g.suffix||'Matches')} — ${g.matches.length} matches</h4><table><thead><tr><th>Round</th><th>Table</th><th>Time</th><th>Team 1</th><th>Team 2</th></tr></thead><tbody>${g.matches.slice(0,10).map(m=>`<tr><td>${m.sourceRound??m.number}</td><td>${esc(m.table)}</td><td>${esc(m.startTime)}</td><td>${esc(m.team1)}</td><td>${esc(m.team2)}</td></tr>`).join('')}</tbody></table>${g.matches.length>10?`<p class="sub">Showing 10 of ${g.matches.length} table matches.</p>`:''}`).join('');
   document.getElementById('confirmAnnouncerImport').classList.remove('hidden');document.getElementById('cancelAnnouncerImport').classList.remove('hidden');
  }catch(err){resetAnnouncerPreview('Could not preview Excel workbook: '+err.message);}e.target.value='';
 });
 document.getElementById('cancelAnnouncerImport').addEventListener('click',()=>resetAnnouncerPreview('Preview cancelled.'));
 document.getElementById('confirmAnnouncerImport').addEventListener('click',()=>{
  const data=pendingAnnouncerImport;if(!data)return;
  const base=document.getElementById('announcerEventName').value.trim();if(!base){document.getElementById('announcerImportStatus').textContent='Enter an event name before importing.';return;}
  const names=data.groups.map(g=>base+(g.suffix?' — '+g.suffix:''));
  const ids=names.map(name=>'announcer-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''));
  if(ids.some(id=>db.events.some(e=>e.id===id))&&!confirm('Existing imported events with these names will be replaced. Continue?'))return;
  const date=document.getElementById('announcerEventDate').value;
  data.groups.forEach((g,i)=>{const id=ids[i],event={id,name:names[i],date,venue:'Announcer-uploaded Excel · local data'};
   const existing=db.events.find(e=>e.id===id);if(existing)Object.assign(existing,event);else db.events.push(event);
   db.matches=db.matches.filter(m=>m.event!==id).concat(g.matches.map(m=>({...m,event:id})));db.cursor[id]=0;delete db.scripts[id];
  });
  data.teams.forEach(t=>{const i=db.teams.findIndex(x=>String(x.number)===t.number);if(i<0)db.teams.push(t);else db.teams[i]={...db.teams[i],...Object.fromEntries(Object.entries(t).filter(([k,v])=>k==='number'||v!==''))};});
  saveDB();renderAll();document.getElementById('eventSelect').value=ids[0];renderConsole();renderMatches();
  resetAnnouncerPreview(`Imported ${data.groups.reduce((n,g)=>n+g.matches.length,0)} matches across ${names.length} event(s) and ${data.teams.length} team profiles. Saved locally.`);showTab('console');
 });
document.getElementById("downloadCsvTemplate").addEventListener("click",()=>download("fll-match-template.csv","event,match_number,table,run_type,team1,team2,start_time\nboulder-2026,1,1,Practice,12345,67890,09:00\n","text/csv"));
document.getElementById("csvMatchFile").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{const rows=parseCSV(await f.text());let ok=0,errs=[];rows.forEach((r,i)=>{const num=r.match_number||r.number;const ev=r.event||selectedEvent();if(!num||!r.team1||!r.team2){errs.push(i+2);return}if(!db.events.some(x=>x.id===ev)){const matched=db.events.find(x=>x.name.toLowerCase()===ev.toLowerCase());if(matched)r.event=matched.id;else{errs.push(i+2);return}}db.matches=db.matches.filter(m=>!(m.event===(r.event||ev)&&String(m.number)===String(num)));db.matches.push({event:r.event||ev,number:Number(num),table:r.table||"1",runType:r.run_type||r.runtype||"Official",team1:String(r.team1),team2:String(r.team2),startTime:r.start_time||r.starttime||""});ok++});saveDB();renderAll();alert(`Imported ${ok} match rows.${errs.length?" Could not import CSV row(s): "+errs.join(", ")+". Check event IDs and required columns.":""}`)}catch(err){alert("Could not read that CSV. Check its headers and format.")}e.target.value=""});
document.getElementById("csvTeamFile").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{const rows=parseCSV(await f.text());let count=0;rows.forEach(r=>{const n=r.team_number||r.number;const name=r.team_name||r.name;if(!n||!name)return;const t={number:String(n),name,city:r.city||"",pronunciation:r.pronunciation||"",bio:r.bio||""};const i=db.teams.findIndex(x=>String(x.number)===String(n));if(i>=0)db.teams[i]={...db.teams[i],...t};else db.teams.push(t);count++});saveDB();renderAll();document.getElementById("teamImportStatus").textContent=`Imported/updated ${count} team profiles.`}catch(err){document.getElementById("teamImportStatus").textContent="Could not read CSV; check its headers."}e.target.value=""});
document.getElementById("saveIntegration").addEventListener("click",()=>{db.settings.sourceUrl=document.getElementById("sourceUrl").value.trim();db.settings.sourceNotes=document.getElementById("sourceNotes").value.trim();saveDB();document.getElementById("integrationStatus").textContent="Configuration saved in this browser. No live sync has been enabled."});
document.getElementById("testSource").addEventListener("click",async()=>{const url=document.getElementById("sourceUrl").value.trim();const out=document.getElementById("integrationStatus");if(!url){out.textContent="Enter an authorized endpoint first.";return}out.textContent="Checking endpoint…";try{const res=await fetch(url,{method:"GET",headers:{"Accept":"application/json"}});out.textContent=`Endpoint responded with HTTP ${res.status}. This only checks connectivity; it does not validate an FLL data adapter.`}catch(e){out.textContent="Could not reach endpoint from this browser. It may require authentication, CORS configuration, or a server-side adapter."}});
document.getElementById("fullExport").addEventListener("click",()=>download("colorado-fll-ga-backup.json",JSON.stringify(backup(),null,2),"application/json"));
document.getElementById("restoreFile").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{const obj=JSON.parse(await f.text());if(!obj.events||!obj.teams||!obj.matches)throw Error("invalid");if(!confirm("Restore this backup and replace the current local data? Export a backup first if needed."))return;db={events:obj.events,teams:obj.teams,matches:obj.matches,scripts:obj.scripts||{},notes:obj.notes||{},settings:obj.settings||{},cursor:obj.cursor||{}};if(obj.ceremonyEvents&&typeof obj.ceremonyEvents==='object'){for(const [k,v] of Object.entries(obj.ceremonyEvents)){if(k.startsWith('coFllCeremonyEvent:')&&typeof v==='string')cloudStorage.setItem(k,v)}}saveDB();renderAll();document.getElementById("backupStatus").textContent="Backup restored."}catch(err){alert("That file is not a valid Colorado FLL GA backup.")}e.target.value=""});
document.getElementById("resetDemo").addEventListener("click",()=>{if(confirm("Reset this browser to the original fictional demo data? This replaces local edits.")){db=structuredClone(DEMO);saveDB();renderAll();document.getElementById("backupStatus").textContent="Demo data restored."}});
if(db.settings.sourceUrl)document.getElementById("sourceUrl").value=db.settings.sourceUrl;
if(db.settings.sourceNotes)document.getElementById("sourceNotes").value=db.settings.sourceNotes;
initEvents();renderAll();

let rulebookPage=9;let rulebookLocalUrl=null;


const CEREMONY_SOURCE = [{"id": "quick-announcements", "name": "Quick Announcements", "group": "Quick", "text": "WELCOME\nWelcome to [Tournament Name]! My name is [Emcee Name], and I will be your Master of Ceremonies.\n\nMATCH START\nTeams, get ready for your 2.5-minute robot game match!\n\nSCHEDULED BREAK\nWe are taking a scheduled break. Our next round begins at [Time].\n\nTHANK YOU\nPlease give our teams, coaches, judges, referees, and volunteers a big round of applause!"}, {"id": "ceremony-2", "name": "Opening Ceremony · Page 2", "group": "Opening", "text": "Opening Ceremony\n\nSpeaker \nDialogue \nBlocking Notes \n \n \nPPT: slide  First \nCanopy \n \n \nA/V: Play some \nfun music as the \nteams take seats \nEmcee \nWelcome to the [Insert Tournament Name]! Today, we are here to \ncelebrate the achievements of the FIRST® LEGO® League \nChallenge teams that are here!\n\nPPT: slide  \nQualifier into\n\nEmcee \nMy name is [insert Emcee Name] and I will be your Master of \nCeremonies.  \nTo kick off todays festivities, we have a welcome message from the \ngroup that puts on all FIRST robotics event across the state: \n \nOn behalf of the Colorado FIRST Board of Directors, thank you to all \nthe participants, mentors, coaches, and volunteers for making this \nyear's Bioglow such a success! Colorado FIRST reaches over 6,000 \nstudents and engages more than 2,000 volunteers to support 40+ \nevents statewide. This year, we’re raising $650K to continue our \nmission of inspiring young minds across Colorado. See the QR code \non the screen if you’d like to donate.  \n \nBecome a sponsor! ​\nRemember Colorado FIRST is a non-profit, thrilled to bring FIRST \nRobotics to your students, and we are looking for local companies to \nhelp sponsor the wonderful events like this one. Please reach out to \nFLL-Challenge Partner Rebecca Parrent if you know of any \ncompanies who may be interested.\n\nPPT: thank you \nslide\n\nPPT: Bioglow \n \n \n \nA/V: Play \nBIOGLOW teaser \nvideo (embedded \nin ppt)\n\nEmcee \nOkay, let’s get this BIOGLOW™ event started! \n \nIn this year’s BIOGLOW Challenge, part of the FIRST® CANOPY \nseason, teams around the world explored the vibrancy of the world’s \necosystems. \n \nHere’s a glimpse at the BIOGLOW Challenge.\n\nEmcee \nThis is an official FIRST LEGO League BIOGLOW tournament.  \nFIRST and The LEGO Group partnered to create our program in \n1998.  FIRST LEGO League started that year with 200 teams. This \nseason, hundreds of thousands of kids in over 100 countries are \nparticipating around the world!  Teams prepared for this tournament \nby working together, and we can’t wait to see what they’ve \naccomplished.\n\nPPT: Bioglow"}, {"id": "ceremony-3", "name": "Opening Ceremony · Page 3", "group": "Opening", "text": "Emcee \nFor the BIOGLOW Innovation Project, teams were challenged to \nidentify and research a problem that puts biodiversity at risk and \ndesign an innovative solution that can help.  \n \nTeams also designed and created a robot to complete the missions \nin the Robot Game. In the Robot Game, teams race against the \nclock to complete as many missions as they can in a \ntwo-and-a-half minute match.\n\nEmcee \nThe Robot Game and Innovation Project are what we do. Our \nFIRST Core Values support how we do what we do. When things \nget tough out there today, you never want to forget about Gracious \nProfessionalism®. It means competing like crazy against the clock, \nbut treating each other with respect. Keep that in mind if you get a \nlittle tired or something goes wrong. We all have more fun – teams, \ncoaches, parents, and volunteers – when we treat each other with \nGracious Professionalism.\n\nEmcee \nLet’s meet our judges! Would all the judges please stand? Judges \nevaluate teams in three areas – Innovation Project, Robot Design, \nand Core Values. [Insert Name of the Judge Advisor] is the Judge \nAdvisor for this tournament. Please give them and all our judges a \nhuge round of applause! \n**If Judges are unable to make it to ceremony say something \nlike: \nWe’d like to recognize some important people today- starting with \nthe  Judge Advisor, [Insert Name of the Judge Advisor] The Judges \nare busy right now working on the awards, so let’s give them a \nround of applause so loud they can hear it!\n\nJudges stand\n\nEmcee \nJudges are great, but what about the folks dressed in the black and \nwhite stripes? Would our referees please stand!? Referees serve \nas the Robot Game officials. [Insert Name of Head Referee] is our \ntournament’s Head Referee. Please give them and our entire \nreferee team a round of applause!\n\nReferees stand\n\nEmcee \nThis tournament is only possible due to the hard work and \ndedication of our volunteers, who have come out in force to \nsupport this tournament. Volunteers please stand, or if you are \nalready standing, please wave! Thank you for your service. Let’s \nhear it for our volunteers! \n \nSpeaking of, we need almost 100 volunteers to help run our State \nChampionship event on 12/5 in Denver.  Reach out to Program \nDelivery Partner Rebecca Parrent with any questions and you can \nsign up through VMS online.  We’re also looking for a regional \nHead Ref, Judge Advisor & Volunteer Coordinator in 2027 to help \nmanage, train, & support the individual events.\n\nPPT: Volunteers"}, {"id": "ceremony-4", "name": "Opening Ceremony · Page 4", "group": "Opening", "text": "Emcee \nWe also want to give a nod to our FIRST LEGO League Global \nSponsors: LEGO Education and The LEGO Foundation, and our \nFIRST LEGO League Challenge Division Sponsors, Rockwell \nAutomation and 3M.  \n \nWe also cannot thank our wonderful local sponsors enough, whose \nsupport has made this tournament possible. They are:\n\nPPT: global \nSponsors \n \n \n \nPPT:local \nSponsors\n\n●​\nGoogle.org \n●​\nCU College of Engineering & Applied Science \n●​\nDaniels Fund \n●​\nGuild \n●​\nAdolph Coors Foundation \n●​\nUs Engineering \n●​\nArcfield \n●​\nGene Haas Foundation \n \nAnd all the companies listed on the screen.\n\nEmcee \nWe also want to give a huge thanks to our host, ______ School! \nAlso thanks to FTC & FRC Teams (if applicable).  \nLet’s be respectful of the spaces here and be sure to keep clean \nup after ourselves wherever we go.\n\nPPT Slide: School \n& FRC/FTC team \nLogos\n\nEmcee \nDid you know Colorado FIRST has a new website? The updated \nsite is focused on providing an easier user experience for \nvolunteers, coaches, and interested parties to find their resources \nfaster and easier.  \nCoaches, the 'Season Resource Center' at the bottom of each \nprogram page is your one stop shop to see information and \ncommunications about your season. \nVisit coloradofirst.org to check it out!\n\nPPT slide: website\n\nEmcee\n\nBesides FLL Challenge there is FLL Explore. In FIRST LEGO \nLeague Explore teams of up to six students, ages 6-10, meet \nthroughout the season using 12 guided meeting sessions to \nexplore a real-world challenge as students research the season’s \ntopic, design, build, and program a motorized LEGO® model using \nLEGO® Education SPIKE™ kit. Learn more by clicking on the QR \ncode on the screen or visiting the FIRST website.\n\nPPT: FLL Explore\n\nEmcee \nOur sponsors look for feedback on how our program impacts \nyouth! Parents, please help us maintain our sponsor support by \nanswering a few questions! Link through the QR code on the \nscreen\n\nPPT: survey\n\nEmcee \nWe want to keep everyone safe here today, so here’s a few items \nwe’d like you to know about as well as some housekeeping items. \nEmcee shares any emergency procedures or housekeeping \ninformation with the audience and informs the audience where to"}, {"id": "ceremony-5", "name": "Opening Ceremony · Page 5", "group": "Opening", "text": "get information.  Some information to keep in mind that you might \nwant to add here:\n\na.​ Maintain respect for the building and others \nb.​ Keep areas clear and free of clutter \nc.​ Schedule information  \nd.​ Clarification about where spectators can visit and\n\nwhere they can’t (like team, coach, and volunteer \nonly areas) \ne.​ Locations of various Outreach Activities (including\n\nFIRST® LEGO® League Explore, if applicable) \nf.​\nWhere the Information table is located \ng.​ How to find the food and vending areas \nh.​ Promote sportsmanship and have fun! \n \n \nEmcee \nTo open this event, please stand for the national anthem …” (insert \nwho by if you have a performer)\n\nA/V:  Play National \nAnthem Flag \nWaving.mov video \nor introduce \nperformer. \n(embedded in \nPPT) \nEmcee \nGood luck teams! Let the games begin!   \n \n \n \nA/V - Play \nenergizing \nmusic \n \nYou can always add a guest speaker (related-Challenge expert or other VIP, i.e. major sponsor \nrepresentative or spokesperson for the host site). The speaker can be placed following the National \nAnthem or later in the ceremonies. Try not to bog down your ceremonies with too many talking heads."}, {"id": "ceremony-6", "name": "Closing Ceremony · Page 6", "group": "Closing", "text": "Closing Ceremony\n\nSpeaker \nDialogue \nBlocking Notes \n \nEmcee\n\nFRC/FTC Demos \n  \nIntroduce teams\n\nAV: ppt While the \njudges are still \ndeliberating, this \nis the time to \nbring up an \nFRC/FTC team \nto demo their \nrobot & talk to \nthe crowd. \n(optional) \n  \n \nEmcee\n\nPPT Slide: \nHi-Fives \nTip: This will take \nalmost a minute \nper team, so in the \ninterest of time, \nyou don’t have to \nwait until Judges \nhave arrived \npost-deliberation.  \n \nAV tech\n\nBefore we hand out the awards, let’s bring all the teams up to get a \nhigh -five and receive their participation pins.   (IF YOU DON’T \nGIVE THE PINS OUT AT REGISTRATION) \n  \nInclude any specific introductions on how teams should come down to get \ntheir pins.\n\nBegin with a High-Five Line. The Emcee can announce each team \nas they move through a line of volunteers to receive their \ntournament medals or other team recognitions.  \nTip: have notecards where you write the team name/number on \nthem and hand to the MC as they come up to receive their pins (this \nway you don’t have to line teams up in a specific order.)\n\nA/V: PLAY \nENERGIZING \nMUSIC\n\nEmcee \nTeams - Congratulations! You have spent countless hours studying, \nresearching, building, and problem-solving, as you worked together with \nyour team during the BIOGLOW, part of the FIRST CANOPY season. \nThe process that got you to this point defines each one of you as a FIRST \nLEGO League Challenge champion and winner, and your pin celebrates \nthis achievement.\n\nPPT slide: \nBioglow\n\nEmce \nWe want to thank our FIRST LEGO League Global Sponsors, LEGO \nEducation and The LEGO Foundation, in addition to Rockwell \nAutomation and 3M, our Challenge Division Sponsors.  \n  \nWe also cannot thank our wonderful local sponsors enough, whose \nsupport has made this tournament possible. They are:\n\nPPT slide: global \nsponsors \n  \n  \n  \nPPT slide: local \nsponsors\n\n●​ Google.org \n●​ CU College of Engineering & Applied Science \n●​ Daniels Fund \n●​ Guild \n●​ Adolph Coors Foundation"}, {"id": "ceremony-7", "name": "Closing Ceremony · Page 7", "group": "Closing", "text": "●​ Us Engineering \n●​ Arcfield \n●​ Gene Haas Foundation​\n\n​\n ​\nAnd all the companies listed on the screen.​\n​\n\nEmcee \nBefore we get to the team awards, we want to take a moment to recognize \nour volunteers. Volunteers – please stand and wave to the crowd! Teams – \nplease give a round of applause for our volunteers. No words can \nadequately express our appreciation for you.\n\nEmcee \nNo tournament can happen without the support, time, and commitment of \nour volunteers. At every tournament, there are those individuals who are \nthe “go-to” people, the “make it happen” people, the “there is no such \nword as impossible” people.   \nOur first award goes to just such a person – a person who put in that extra \nhour, lost that extra sleep, was there when everyone else had gone home.\n\nAV: ppt\n\nEmcee \nThe Volunteer Award: Insert a short paragraph explaining why this \nvolunteer deserves the Volunteer Award at your tournament].\n\nThe Volunteer Award goes to:\n\nAV: ppt\n\nVolunteer Name\n\nSpeaker \nDialogue \nBlocking Notes \nEmcee \nCoaches and mentors – please stand. These are the special volunteers who \nhave spent hours each week with the teams. They have inspired, \nencouraged, and motivated, all the while demonstrating and modeling \nGracious Professionalism®. Teams, take a moment to tell your coaches how \nmuch you appreciate all they have done for you.\n\nEmcee \nNow I would like to present the Coach/Mentor Award. Coaches and \nmentors inspire their teams to do their best, both as individuals and \ntogether. This award goes to the coach or mentor whose leadership and \nguidance is clearly evident and best exemplifies the FIRST® Core Values.\n\nAV: ppt\n\nEmcee \nThis coach’s team said the following about this very special person:\n\nEmcee \n(Insert a short paragraph explaining why this coach or mentor deserves this \naward).\n\nEmcee \nThe Coach/Mentor Award goes to:\n\nAV: ppt\n\nTeam Number \nCoach Name"}, {"id": "ceremony-8", "name": "Closing Ceremony · Page 8", "group": "Closing", "text": "Emcee \nWe will now begin with our required awards. We have X awards to give in \neach category.\n\nEmcee \nLet’s begin with the Core Values Award. \nAV: ppt \nEmcee \nThe Core Values Award: This award celebrates a team that displays \nextraordinary enthusiasm and spirit, knows they can accomplish more \ntogether than they could as individuals, and shows each other and other \nteams respect at all times\n\nEmcee \n(Insert a short paragraph explaining why this team received this \naward).\n\nEmcee \nThe 3rd place Core Values Award goes to:\n\nAV: ppt\n\nTeam Number \nTeam Name\n\nEmcee \n(Insert a short paragraph explaining why this team received this award \nfrom the Judges).\n\nAV: ppt\n\nEmcee \nThe 2nd place Core Values Award goes to:\n\nAV: ppt\n\nTeam Number \nTeam Name\n\nEmcee \n(Insert a short paragraph explaining why this team received this award \nfrom the Judges).\n\nAV: ppt\n\nEmcee \nThe 1st place Core Values Award goes to:\n\nAV: ppt\n\nTeam Number \nTeam Name\n\nEmcee \nNext comes our Innovation Project Award.\n\nAV: ppt\n\nEmcee \nThe Innovation Project Award: This team utilized diverse resources for \ntheir Innovation Project to help them gain a comprehensive understanding \nof the problem they identified, developed a creative, well-researched \nsolution and effectively communicated their findings to judges and the \ncommunity.\n\nEmcee \n(Insert a short paragraph explaining why this team received this \naward).\n\nEmcee \nThe 3rd place Innovation Project Award goes to:\n\nAV: ppt\n\nTeam Number \nTeam Name\n\nEmcee \n(Insert a short paragraph explaining why this team received this award \nfrom the Judges).\n\nAV: ppt\n\nEmcee \nThe 2nd place Innovation Project Award goes to:\n\nAV: ppt\n\nTeam Number \nTeam Name"}, {"id": "ceremony-9", "name": "Closing Ceremony · Page 9", "group": "Closing", "text": "Emcee \n(Insert a short paragraph explaining why this team received this award \nfrom the Judges).\n\nAV: ppt\n\nEmcee \nThe 1st place Innovation Project Award goes to:\n\nAV: ppt\n\nTeam Number \nTeam Name\n\nEmcee \nWe now move to robot awards, beginning with our Robot Design Award. \nAV: ppt\n\nEmcee \nThe Robot Design Award: This team used outstanding programming \nprinciples and solid engineering practices to develop a robot that is \nmechanically sound, durable, efficient, and highly capable of performing \nchallenge missions.\n\nEmcee \n(Insert a short paragraph explaining why this team received this award).\n\nThe 3rd place Robot Design Award goes to:\n\nAV: ppt\n\nEmcee\n\nTeam Number \nTeam Name\n\nEmcee \n(Insert a short paragraph explaining why this team received this award \nfrom the Judges).\n\nAV: ppt\n\nThe 2nd place Robot Design Award goes to:\n\nAV: ppt\n\nEmcee\n\nTeam Number \nTeam Name\n\nEmcee \n(Insert a short paragraph explaining why this team received this award \nfrom the Judges).\n\nAV: ppt\n\nThe 1st place Robot Design Award goes to:\n\nAV: ppt\n\nEmcee\n\nTeam Number \nTeam Name\n\nAnd now to our Robot Performance Award. \nAV: ppt\n\nEmcee\n\nEmcee \nThe Robot Performance Award:  \nThis award celebrates a team that scores the most points during the Robot \nGame. Teams have a chance to compete in at least three 2.5-minute matches \nand their highest score counts.\n\nEmcee \nWith a high score of (Insert score here), the 3rd place Robot Performance \nAward goes to:\n\nAV: ppt\n\nTeam Number \nTeam Name\n\nEmcee \nWith a high score of (Insert score here), the 2nd place Robot Performance \nAward goes to:\n\nAV: ppt\n\nTeam Number \nTeam Name"}, {"id": "ceremony-10", "name": "Closing Ceremony · Page 10", "group": "Closing", "text": "Emcee \nWith a high score of (Insert score here), the 1st place Robot Performance \nAward goes to:\n\nAV: ppt\n\nTeam Number \nTeam Name\n\nEmcee \nBefore we get to the Champion’s Award winner, we have some additional \nawards to distribute to teams.\n\nEmcee \nFirst is Judges Award(s). We have ___ Judges Awards here at ________. \nAV: ppt \nEmcee \nJudges Awards allow judges the freedom to recognize remarkable teams that \nstand out for reasons other than the Core Awards categories.\n\nEmcee \n(Insert a short paragraph explaining why this team received this award). \n  \nEmcee \nThe Judges award for _______ goes to:\n\nAV: ppt\n\nTeam Number \nTeam Name\n\nEmcee \n(Insert a short paragraph explaining why this team received this award). \n  \nEmcee \nThe Judges award for _______ goes to:\n\nAV: ppt\n\nTeam Number \nTeam Name\n\nEmcee \n(Insert a short paragraph explaining why this team received this award). \n  \nEmcee \nThe Judges award for _______ goes to:\n\nAV: ppt\n\nTeam Number \nTeam Name\n\nEmcee \n(Insert a short paragraph explaining why this team received this award). \n  \nEmcee \nThe Judges award for _______ goes to:\n\nAV: ppt\n\nTeam Number \nTeam Name\n\nEmcee \nNext is our Peer Award. \nAV: ppt \nEmcee \nThe Peer Award celebrates a team that has been nominated by their \npeers for their expression of Core Values and Gracious Professionalism.\n\nEmcee \n(Insert a short paragraph explaining why this team received this award). \n  \nEmcee \nThe Peer Award goes to:\n\nAV: ppt\n\nTeam Number \nTeam Name\n\nEmcee \nFinally, we come to our Champion’s Awards. \n  \nEmcee \nThe Champion’s Award celebrates a team that embodies the FIRST LEGO \nLeague experience, by fully embracing our Core Values while achieving\n\nAV: ppt"}, {"id": "ceremony-11", "name": "Closing Ceremony · Page 11", "group": "Closing", "text": "excellence and innovation in Robot Performance, Robot Design, and the \nInnovation Project. \nEmcee \nThe judges had following to say about this stellar team: \n  \n  \n(Insert a short paragraph explaining why this team received this award \nfrom the Judges).\n\nEmcee \nThe 3rd place Champion’s Award goes to:\n\nAV: ppt\n\nFIRST LEGO \nLeague Team \nNumber\n\nFIRST LEGO League Team Name\n\nEmcee \nThe judges had following to say about this stellar team: \n  \n  \n(Insert a short paragraph explaining why this team received this award \nfrom the Judges).\n\nAV: ppt\n\nEmcee \nThe 2nd place Champion’s Award goes to:\n\nAV: ppt\n\nFIRST LEGO \nLeague Team \nNumber\n\nFIRST LEGO League Team Name\n\nEmcee \nI know you are waiting patiently to learn what team has earned the most \ncoveted Champion’s Award. Our Champion’s Award-winning team will receive \nan advancement to the Colorado State Championship, which will be held at \nCU College of Engineering & Applied Science on 12/5.  \nThe following teams, in addition to our Champion’s Award winner, will move \non in competition: (List the team numbers and names of all advancing \nteams, with the exception of the Champion’s Award-winning team).\n\nAV: qualified \nteam ppt \nEmcee \nBefore we announce our final award, let’s take a quick moment to acknowledge \nthose teams who are with us for the last time. Please stand if you are aging out \nof FIRST LEGO League at the end of this season! We want to congratulate you \nfor everything you’ve achieved, and we hope to see you continue your robotics \njourney on a FIRST® Tech Challenge or FIRST® Robotics Competition Team \nnext year! Millions of dollars in scholarship funds are available to participants \nin those programs.\n\nEmcee  \nNow, let’s hear it for our FIRST alumni. If you are a coach, volunteer, or \nsupporter with us today and graduated from a FIRST program, please \nstand. Teams, we hope to see you join these ranks someday!\n\nAV: ppt\n\nEmcee  \nSpeaking of the future, let’s learn more about what next season will \nlook like at FIRST!\n\nAV: play K-8 \nUpdate video \n(is embedded \nin ppt)  \n3:51"}, {"id": "ceremony-12", "name": "Closing Ceremony · Page 12", "group": "Closing", "text": "Emcee  \nFinally, we come to our Final Champion’s Award.\n\nEmcee  \nThe Champion’s Award celebrates a team that embodies the FIRST \nLEGO League experience, by fully embracing our Core Values while \nachieving excellence and innovation in Robot Performance, Robot \nDesign, and the Innovation Project.\n\nAV: ppt\n\nEmcee  \nThe judges had following to say about this stellar team:  \n  \n  \n(Insert a short paragraph explaining why this team received this \naward).\n\nEmcee  \nThe Champion’s Award and the final advancement to the (Name of next \nlevel tournament) goes to:\n\nAV: ppt\n\nFIRST LEGO \nLeague Team \nNumber\n\nFIRST LEGO League Team Name\n\nEmcee  \nFriends, this concludes the Awards Ceremony for this year’s season, \nBIOGLOW, part of the FIRST CANOPY season. Please join me in \ncongratulating all the teams on their fantastic performance! Just as a \nreminder, teams will receive their rubrics via email in the next day or two \n… But, this isn’t goodbye. We hope you can join us next season for more \nSTEM fun! To learn more about our other programs, visit our website at \nwww.firstinspires.org.   \n  \nThank you for being here, and for supporting all of these amazing \nstudents. We look forward to seeing you all again next year!   \n  \nThis concludes our tournament for today, but we’re looking forward to \nseeing you at the State Championship on December 5th. And a reminder \nthat the tournament is open to the public, if any other teams want to \nattend just to observe. And we would love for you to volunteer; we need \na lot of Judges!   \n   \n  \nThank you again for sharing the excitement with us."}];
// Each event has its own edits and uploaded scripts. Existing legacy data is copied
// once into the first event so a previously saved library is not discarded.
const CEREMONY_PREFIX='coFllCeremonyEvent:';
function ceremonyEventId(){return document.getElementById('ceremonyEventSelect')?.value || selectedEvent() || db.events[0]?.id || 'default'}
function ceremonyKey(kind,id=ceremonyEventId()){return CEREMONY_PREFIX+encodeURIComponent(id)+':'+kind}
function ceremonyRead(kind,fallback){try{const v=JSON.parse(cloudStorage.getItem(ceremonyKey(kind)));return v??fallback}catch(e){return fallback}}
function ceremonySaved(){return ceremonyRead('edits',{})}
function ceremonyImports(){const v=ceremonyRead('imports',[]);return Array.isArray(v)?v:[]}
function ceremonyAll(){return CEREMONY_SOURCE.concat(ceremonyImports())}
function ceremonyStoreImports(list){cloudStorage.setItem(ceremonyKey('imports'),JSON.stringify(list))}
function ceremonyStoreEdits(saved){cloudStorage.setItem(ceremonyKey('edits'),JSON.stringify(saved))}
function ceremonySaveVisible(){const item=ceremonyCurrent();if(!item)return;const edits=ceremonySaved();edits[item.id]=document.getElementById('ceremonyText').value;ceremonyStoreEdits(edits)}
function ceremonyRefreshEvents(preferred){const sel=document.getElementById('ceremonyEventSelect');if(!sel)return;const current=preferred||sel.value||selectedEvent();sel.innerHTML=db.events.map(e=>'<option value="'+esc(e.id)+'">'+esc(e.name)+'</option>').join('');if(db.events.some(e=>e.id===current))sel.value=current}
function ceremonyMigrateLegacy(){if(cloudStorage.getItem('coFllCeremonyMigratedV2'))return;const id=db.events[0]?.id||'default';for(const [kind,oldKey] of [['edits','coFllCeremonyScripts'],['imports','coFllImportedScripts']]){const legacy=cloudStorage.getItem(oldKey);if(legacy!==null && cloudStorage.getItem(ceremonyKey(kind,id))===null)cloudStorage.setItem(ceremonyKey(kind,id),legacy)}cloudStorage.setItem('coFllCeremonyMigratedV2','1')}
ceremonyMigrateLegacy();ceremonyRefreshEvents();
document.getElementById('ceremonyEventSelect').addEventListener('change',()=>{ceremonyPopulate()});
// The main event selector and script event selector stay synchronized.
document.getElementById('eventSelect').addEventListener('change',()=>{ceremonySaveVisible();ceremonyRefreshEvents(selectedEvent());ceremonyPopulate()});

function ceremonyCurrent(){return ceremonyAll().find(x=>x.id===document.getElementById('ceremonySection').value)}
function ceremonyPopulate(){
 const group=document.getElementById('ceremonyGroup').value, sel=document.getElementById('ceremonySection');
 sel.innerHTML=ceremonyAll().filter(x=>x.group===group).map(x=>'<option value="'+x.id+'">'+x.name+'</option>').join('');ceremonyShow();
}
function ceremonyShow(){const item=ceremonyCurrent();if(!item){document.getElementById('ceremonyText').value='';document.getElementById('ceremonyHeading').textContent='No scripts in this category for this event';return;}document.getElementById('ceremonyHeading').textContent=item.name;const saved=ceremonySaved();document.getElementById('ceremonyText').value=Object.prototype.hasOwnProperty.call(saved,item.id)?saved[item.id]:item.text;document.getElementById('ceremonyStatus').textContent='Source: uploaded Colorado BIOGLOW ceremony template. Edits are local.'}
document.getElementById('ceremonyGroup').addEventListener('change',()=>{ceremonySaveVisible();ceremonyPopulate()});
document.getElementById('ceremonySection').addEventListener('change',ceremonyShow);
document.getElementById('ceremonyText').addEventListener('input',()=>{ceremonySaveVisible();document.getElementById('ceremonyStatus').textContent='Saved automatically for this event.'});
document.getElementById('ceremonySave').addEventListener('click',()=>{const item=ceremonyCurrent();if(!item)return;const saved=ceremonySaved();saved[item.id]=document.getElementById('ceremonyText').value;ceremonyStoreEdits(saved);document.getElementById('ceremonyStatus').textContent='Saved locally.'});
document.getElementById('ceremonyReset').addEventListener('click',()=>{const item=ceremonyCurrent();if(!item||!confirm('Restore the original text for this section?'))return;const saved=ceremonySaved();delete saved[item.id];ceremonyStoreEdits(saved);ceremonyShow()});
document.getElementById('ceremonyCopy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(document.getElementById('ceremonyText').value);document.getElementById('ceremonyStatus').textContent='Copied.'}catch(e){document.getElementById('ceremonyText').select();document.getElementById('ceremonyStatus').textContent='Select and copy the highlighted text.'}});
document.getElementById('ceremonyDownload').addEventListener('click',()=>{const item=ceremonyCurrent();download((item?.id||'ceremony')+'.txt',document.getElementById('ceremonyText').value)});
document.getElementById('ceremonyPrint').addEventListener('click',()=>{const w=window.open('','_blank');if(!w){alert('Allow popups to print.');return;}const item=ceremonyCurrent();const title=item?.name||'Ceremony Script';const t=document.getElementById('ceremonyText').value;w.document.write('<!doctype html><html><head><title>'+esc(title)+'</title><style>body{font:17px/1.6 Arial;padding:32px;max-width:850px;margin:auto}pre{white-space:pre-wrap;font:inherit}</style></head><body><h1>'+esc(title)+'</h1><pre>'+esc(t)+'</pre></body></html>');w.document.close();w.focus();w.print()});
ceremonyPopulate();
(function(){
 const $=id=>document.getElementById(id);let pdfUrl=null;
 function selectImported(id){$('ceremonyGroup').value='Imported';ceremonyPopulate();$('ceremonySection').value=id;ceremonyShow()}
 function clearPdf(){if(pdfUrl){URL.revokeObjectURL(pdfUrl);pdfUrl=null}$('customPdfReference').classList.add('hidden');$('customPdfFrame').removeAttribute('src')}
 async function loadPdfReader(){
  if(window.pdfjsLib)return window.pdfjsLib;
  if(!window.__fllPdfPromise){window.__fllPdfPromise=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
   script.onload=()=>window.pdfjsLib?resolve(window.pdfjsLib):reject(Error('PDF reader failed to initialize'));
   script.onerror=()=>reject(Error('PDF reader could not load. Connect to the internet for PDF import, or upload a DOCX/TXT script.'));
   document.head.appendChild(script);
  }).catch(e=>{window.__fllPdfPromise=null;throw e})}
  return window.__fllPdfPromise;
 }
 function spokenOnly(raw){
  const lines=raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const out=[];let removed=0;
  const cue=/^(?:PPT\s*:|A\/?V\s*:|AV\s*:|blocking notes|speaker\s+dialogue|slide\s*:|play (?:music|video)|judges stand|referees stand|ppt slide\s*:|video embedded|emcee\s*$|av tech\s*$)/i;
  for(let line of lines){
   if(cue.test(line)){removed++;continue}
   line=line.replace(/^(?:Emcee|MC|Host|Announcer)\s*[:–-]\s*/i,'');
   if(!line||/^(?:opening ceremony|closing ceremony|speaker|dialogue|blocking notes)$/i.test(line)){removed++;continue}
   out.push(line);
  }
  return {text:out.join('\n\n'),removed};
 }
 async function pdfText(file){
  const lib=await loadPdfReader();lib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  let pages=[];
  for(let i=1;i<=pdf.numPages;i++){
   const page=await pdf.getPage(i),items=(await page.getTextContent()).items;
   // Reconstruct rows from PDF coordinates so table dialogue is not interleaved with AV cues.
   const rows=[];for(const it of items){const t=(it.str||'').trim();if(!t)continue;const x=it.transform[4],y=it.transform[5];let row=rows.find(r=>Math.abs(r.y-y)<3);if(!row){row={y,parts:[]};rows.push(row)}row.parts.push({x,t})}
   rows.sort((a,b)=>b.y-a.y);
   const width=page.view[2]-page.view[0];
   const tagged=[];
   for(const r of rows){
    r.parts.sort((a,b)=>a.x-b.x);
    // Colorado ceremony template: speaker column, dialogue column, blocking notes column.
    const dialogue=r.parts.filter(v=>v.x>=width*.10&&v.x<=width*.75).map(v=>v.t).join(' ').trim();
    const notes=r.parts.filter(v=>v.x>width*.75).map(v=>v.t).join(' ').trim();
    if(dialogue&&!/^(?:Speaker|Dialogue|Emcee|AV tech|Emce)$/i.test(dialogue))tagged.push('[SAY] '+dialogue);
    if(notes&&!/^(?:Blocking Notes)$/i.test(notes))tagged.push('[NOTE] '+notes);
   }
   pages.push(tagged.join('\n'));
  }
  return {text:pages.join('\n\n'),removed:0};
 }
 async function docxText(file){
  // DOCX is a ZIP archive; reuse the offline ZIP reader's lightweight central-directory approach.
  const b=new Uint8Array(await file.arrayBuffer()),v=new DataView(b.buffer);const u16=p=>v.getUint16(p,true),u32=p=>v.getUint32(p,true);
  let end=-1;for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--){if(u32(i)===0x06054b50){end=i;break}}
  if(end<0)throw Error('Invalid DOCX archive');let at=u32(end+16),n=u16(end+10),entry=null;
  for(let i=0;i<n;i++){if(u32(at)!==0x02014b50)throw Error('Invalid DOCX directory');const nameLen=u16(at+28),extra=u16(at+30),comment=u16(at+32),name=new TextDecoder().decode(b.slice(at+46,at+46+nameLen));if(name==='word/document.xml')entry={method:u16(at+10),size:u32(at+20),offset:u32(at+42)};at+=46+nameLen+extra+comment}
  if(!entry)throw Error('DOCX document text not found');let pos=entry.offset,start=pos+30+u16(pos+26)+u16(pos+28),bytes=b.slice(start,start+entry.size),raw;
  if(entry.method===0)raw=new TextDecoder().decode(bytes);
  else if(entry.method===8){if(!window.DecompressionStream)throw Error('DOCX decompression unavailable in this browser');raw=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()}
  else throw Error('Unsupported DOCX compression');
  const doc=new DOMParser().parseFromString(raw,'application/xml');if(doc.querySelector('parsererror'))throw Error('Invalid DOCX XML');
  const paras=Array.from(doc.getElementsByTagNameNS('*','p'));
  return paras.map(p=>Array.from(p.getElementsByTagNameNS('*','t')).map(t=>t.textContent).join('')).join('\n').trim();
 }
 $('customScriptFile').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;const status=$('customScriptStatus');clearPdf();
  try{
   const ext=file.name.split('.').pop().toLowerCase();let text='';
   if(ext==='txt'||ext==='md')text=spokenOnly(await file.text()).text;
   else if(ext==='docx')text=spokenOnly(await docxText(file)).text;
   else if(ext==='pdf'){
    status.textContent='Extracting spoken dialogue from PDF…';const extracted=await pdfText(file);text=extracted.text;if(!text.trim())throw Error('No selectable text found in PDF. Scanned PDFs require OCR before import.');
    pdfUrl=URL.createObjectURL(file);$('customPdfFrame').src=pdfUrl;$('customPdfReference').classList.remove('hidden');
   }else throw Error('Choose a TXT, MD, DOCX, or PDF file.');
   const title=$('customScriptName').value.trim()||file.name.replace(/\.[^.]+$/,'');
   const id='imported-'+Date.now()+'-'+Math.floor(Math.random()*10000);
   const list=ceremonyImports();list.push({id,name:title,group:'Imported',text,filename:file.name});ceremonyStoreImports(list);
   selectImported(id);status.textContent='Imported '+file.name+'. Dialogue is yellow; notes from the right-hand production column are gray. Reimport older PDFs to restore column-based colors.';
   $('customScriptName').value='';
  }catch(err){status.textContent='Could not import: '+err.message}
  e.target.value='';
 });
 $('deleteCustomScript').addEventListener('click',()=>{
  const item=ceremonyCurrent();if(!item||item.group!=='Imported'){$('customScriptStatus').textContent='Select a script under My uploaded scripts first.';return}
  if(!confirm('Delete "'+item.name+'" from this browser?'))return;
  ceremonyStoreImports(ceremonyImports().filter(x=>x.id!==item.id));const saved=ceremonySaved();delete saved[item.id];ceremonyStoreEdits(saved);clearPdf();ceremonyPopulate();$('customScriptStatus').textContent='Uploaded script deleted.';
 });
})();

// Dylan's Joke Corner: separate admin-managed server resource, never a bypass login.
let jokeItems=[],jokeEditing=null;
async function loadJokes(){
 const list=document.getElementById('jokeList');
 document.getElementById('jokeAdmin').classList.toggle('hidden',cloudRole!=='admin');
 try{jokeItems=await api('jokes');renderJokes()}catch(e){list.textContent='Could not load jokes: '+e.message}
}
function renderJokes(){
 const list=document.getElementById('jokeList');list.replaceChildren();
 if(!jokeItems.length){list.textContent='No jokes yet. Ask an administrator to add one.';return}
 jokeItems.forEach(j=>{
  const item=document.createElement('div');item.className='teamline';
  const content=document.createElement('div');content.className='teaminfo';
  const q=document.createElement('div');q.className='teamname';q.textContent=j.setup;
  const a=document.createElement('div');a.className='sub';a.style.cssText='font-size:15px;margin-top:8px';a.textContent=j.punchline;
  content.append(q,a);item.append(content);
  if(cloudRole==='admin'){
   const edit=document.createElement('button');edit.className='btn small';edit.textContent='Edit';edit.onclick=()=>{jokeEditing=j.id;document.getElementById('jokeQuestion').value=j.setup;document.getElementById('jokeAnswer').value=j.punchline;document.getElementById('jokeSave').textContent='Save changes';document.getElementById('jokeQuestion').focus()};
   const del=document.createElement('button');del.className='btn small danger';del.textContent='Delete';del.onclick=async()=>{if(!confirm('Delete this joke?'))return;try{await api('jokes/'+j.id,{method:'DELETE'});await loadJokes()}catch(e){document.getElementById('jokeStatus').textContent=e.message}};
   item.append(edit,del);
  }
  list.append(item);
 });
}
function resetJokeForm(){jokeEditing=null;document.getElementById('jokeForm').reset();document.getElementById('jokeSave').textContent='Add joke'}
document.getElementById('jokeCancel').addEventListener('click',resetJokeForm);
document.getElementById('jokeForm').addEventListener('submit',async e=>{
 e.preventDefault();if(cloudRole!=='admin')return;
 const status=document.getElementById('jokeStatus');
 try{await api(jokeEditing===null?'jokes':'jokes/'+jokeEditing,{method:jokeEditing===null?'POST':'PUT',body:JSON.stringify({setup:document.getElementById('jokeQuestion').value.trim(),punchline:document.getElementById('jokeAnswer').value.trim()})});resetJokeForm();status.textContent='Saved for all announcers.';await loadJokes()}catch(err){status.textContent='Could not save: '+err.message}
});
