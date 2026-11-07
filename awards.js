"use strict";
let awardsEditingId=null,awardsCanEdit=false;
let awardPublishedItems=[],awardPresentIndex=0,awardFontSize=38;
const awEl=id=>document.getElementById(id);
async function refreshAwards(){
 const sel=awEl('awardsEvent'),previous=sel.value;
 let events=[];try{events=JSON.parse(cloudStorage.getItem('coFllGaDb')||'{}').events||[]}catch(e){}
 sel.replaceChildren();for(const e of events){const opt=document.createElement('option');opt.value=e.id;opt.textContent=e.name;sel.appendChild(opt)}
 if(events.some(e=>e.id===previous))sel.value=previous;
 await loadAwards();
}
async function loadAwards(){
 const event_id=awEl('awardsEvent').value,box=awEl('awardsList'),status=awEl('awardsStatus');box.replaceChildren();
 if(!event_id){status.textContent='No event selected.';return}
 try{
 const grants=cloudUser?.role==='ja'?await api('ja-assignments'):[];
 awardsCanEdit=cloudUser?.role==='admin'||(cloudUser?.role==='ja'&&grants.some(x=>x.event_id===event_id));
 awEl('awardEditor').hidden=!awardsCanEdit;
 const items=await api('awards?event_id='+encodeURIComponent(event_id));
 awardPublishedItems=items.filter(a=>a.published);awEl('awardsPresent').disabled=!awardPublishedItems.length;
 status.textContent=items.length+' award(s) available. '+(awardsCanEdit?'You can edit awards for this event.':'Only published awards are shown.');
 for(const a of items){
  const card=document.createElement('div');card.className='teamline';card.style.alignItems='flex-start';
  const detail=document.createElement('div');detail.className='teaminfo';
  const title=document.createElement('strong');title.textContent=a.category+' — '+a.placement;detail.appendChild(title);
  const team=document.createElement('div');team.textContent=(a.team_number?'#'+a.team_number+' · ':'')+a.team_name;detail.appendChild(team);
  if(a.remarks){const r=document.createElement('p');r.textContent=a.remarks;r.style.whiteSpace='pre-wrap';detail.appendChild(r)}
  const tag=document.createElement('small');tag.textContent=a.published?'Published':'Draft (JA only)';detail.appendChild(tag);card.appendChild(detail);
  if(awardsCanEdit){const b=document.createElement('button');b.className='btn small';b.textContent='Edit';b.addEventListener('click',()=>{awardsEditingId=a.id;const f=awEl('awardForm');for(const k of ['category','placement','team_number','team_name','remarks'])f.elements.namedItem(k).value=a[k];f.elements.namedItem('published').checked=!!a.published;awEl('awardEditor').scrollIntoView({behavior:'smooth'})});card.appendChild(b)}
  box.appendChild(card);
 }
 }catch(e){status.textContent='Unable to load awards: '+e.message}
}
function clearAwardForm(){awardsEditingId=null;awEl('awardForm').reset()}
awEl('awardsEvent').addEventListener('change',()=>{clearAwardForm();loadAwards()});
awEl('awardsRefresh').addEventListener('click',refreshAwards);
awEl('awardCancel').addEventListener('click',clearAwardForm);
awEl('awardForm').addEventListener('submit',async e=>{
 e.preventDefault();const f=e.currentTarget;const data={event_id:awEl('awardsEvent').value,published:f.elements.namedItem('published').checked};for(const k of ['category','placement','team_number','team_name','remarks'])data[k]=f.elements.namedItem(k).value.trim();
 try{await api('awards'+(awardsEditingId?'/'+awardsEditingId:''),{method:awardsEditingId?'PUT':'POST',body:JSON.stringify(data)});clearAwardForm();await loadAwards()}catch(err){awEl('awardsStatus').textContent='Could not save award: '+err.message}
});

// Awards presentation deliberately uses published awards only, including for JAs and admins.
function renderAwardPresentation(){
 const a=awardPublishedItems[awardPresentIndex];if(!a)return;
 const e=awEl('awardsEvent');awEl('awardPresentEvent').textContent=e.selectedOptions[0]?.textContent||'Awards ceremony';
 awEl('awardPresentPosition').textContent=a.placement||'';
 awEl('awardPresentTitle').textContent=a.category||'Award';
 awEl('awardPresentTeam').textContent=(a.team_number?'Team '+a.team_number+' · ':'')+(a.team_name||'');
 awEl('awardPresentRemarks').textContent=a.remarks||'';
 awEl('awardPresentCounter').textContent=(awardPresentIndex+1)+' of '+awardPublishedItems.length;
 awEl('awardPresentPrevious').disabled=awardPresentIndex===0;
 awEl('awardPresentNext').disabled=awardPresentIndex>=awardPublishedItems.length-1;
 awEl('awardsPresentation').style.setProperty('--award-font',awardFontSize+'px');
}
function closeAwardPresentation(){const modal=awEl('awardsPresentation');modal.hidden=true;if(document.fullscreenElement===modal)document.exitFullscreen().catch(()=>{});awEl('awardsPresent').focus()}
awEl('awardsPresent').addEventListener('click',async()=>{
 // Refresh from server immediately before displaying, avoiding stale or unpublished data.
 try{const eventId=awEl('awardsEvent').value;const items=await api('awards?event_id='+encodeURIComponent(eventId));awardPublishedItems=items.filter(a=>a.published);if(!awardPublishedItems.length){awEl('awardsStatus').textContent='No published awards to present.';return}awardPresentIndex=0;awEl('awardsPresentation').hidden=false;renderAwardPresentation();awEl('awardPresentNext').focus()}catch(e){awEl('awardsStatus').textContent='Unable to load presentation: '+e.message}
});
awEl('awardPresentPrevious').addEventListener('click',()=>{if(awardPresentIndex>0){awardPresentIndex--;renderAwardPresentation()}});
awEl('awardPresentNext').addEventListener('click',()=>{if(awardPresentIndex<awardPublishedItems.length-1){awardPresentIndex++;renderAwardPresentation()}});
awEl('awardPresentSmaller').addEventListener('click',()=>{awardFontSize=Math.max(22,awardFontSize-4);renderAwardPresentation()});
awEl('awardPresentLarger').addEventListener('click',()=>{awardFontSize=Math.min(72,awardFontSize+4);renderAwardPresentation()});
awEl('awardPresentClose').addEventListener('click',closeAwardPresentation);
awEl('awardPresentFullscreen').addEventListener('click',()=>{const modal=awEl('awardsPresentation');if(document.fullscreenElement===modal)document.exitFullscreen().catch(()=>{});else modal.requestFullscreen?.().catch(()=>{})});
document.addEventListener('keydown',e=>{if(awEl('awardsPresentation').hidden)return;if(e.key==='Escape'){closeAwardPresentation();return}if(['ArrowRight','ArrowLeft'].includes(e.key)){e.preventDefault();const id=e.key==='ArrowRight'?'awardPresentNext':'awardPresentPrevious';awEl(id).click()}});
