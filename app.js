let book=null,page=0,total=1,fs=18;
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
async function loadBook(){
  const parts=[];
  for(let i=1;i<=5;i++){
    const r=await fetch('./data/c'+i+'.txt',{cache:'no-store'});
    if(!r.ok) throw new Error('Falha ao carregar parte '+i);
    parts.push((await r.text()).trim());
  }
  const bin=Uint8Array.from(atob(parts.join('')),c=>c.charCodeAt(0));
  const ds=new DecompressionStream('gzip');
  const txt=await new Response(new Blob([bin]).stream().pipeThrough(ds)).text();
  return JSON.parse(txt);
}
function esc(s){return String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}
function render(){
  $('#pages').innerHTML=book.items.map((it,i)=>{
    if(it.type==='part') return '<section class="part" data-a="'+i+'">'+esc(it.text)+'</section>';
    if(it.type==='chapter') return '<h2 class="chapter" data-a="'+i+'"><small>'+(it.number==='E'?'':'Capítulo '+it.number)+'</small>'+esc(it.title)+'</h2>';
    const cls=it.text.startsWith('—')?'dialogue':(it.text.length<55?'short':'');
    return '<p class="'+cls+'" data-a="'+i+'">'+esc(it.text)+'</p>';
  }).join('');
  $('#toc').innerHTML=book.items.map((it,i)=>{
    if(it.type!=='chapter') return '';
    return '<button data-j="'+i+'">'+(it.number==='E'?'Epílogo':'Capítulo '+it.number)+' — '+esc(it.title)+'</button>';
  }).join('');
  $$('[data-j]').forEach(b=>b.onclick=()=>{jump(Number(b.dataset.j));$('#panel').classList.remove('open');});
  $('#loading').textContent='Livro pronto para leitura';
}
function step(){return $('#vp').clientWidth+parseFloat(getComputedStyle($('#pages')).columnGap||50);}
function paginate(){
  const old=total>1?page/(total-1):0;
  $('#pages').style.transform='translateX(0)';
  total=Math.max(1,Math.ceil($('#pages').scrollWidth/step()));
  go(Math.round(old*(total-1)),false);
}
function go(n,anim=true){
  page=Math.max(0,Math.min(total-1,n));
  $('#pages').style.transition=anim?'transform .2s ease':'none';
  $('#pages').style.transform='translateX('+(-page*step())+'px)';
  const p=total<=1?0:page/(total-1);
  localStorage.setItem('sena_progress',String(p));
  $('#pg').textContent=(page+1)+' de '+total;
  $('#pct').textContent=Math.round(p*100)+'%';
  $('#slider').value=Math.round(p*100);
  $('#libProgress').textContent=Math.round(p*100)+'% lido';
  chapterLabel();
}
function chapterLabel(){
  const x=page*step()+30; let last='';
  $$('.chapter').forEach(e=>{if(e.offsetLeft<=x+50) last=e.textContent.trim().replace(/\s+/g,' ');});
  if(last) $('#chap').textContent=last;
}
function jump(i){const e=document.querySelector('[data-a="'+i+'"]');if(e)go(Math.floor(e.offsetLeft/step()));}
function setTheme(t){
  document.body.classList.remove('night','sepia');
  if(t!=='paper')document.body.classList.add(t);
  localStorage.setItem('sena_theme',t);
  $$('[data-theme]').forEach(b=>b.classList.toggle('on',b.dataset.theme===t));
}
function setFont(f){
  document.documentElement.style.setProperty('--font',f==='sans'?'Arial,Helvetica,sans-serif':'Georgia,"Times New Roman",serif');
  localStorage.setItem('sena_font',f);
  $$('[data-font]').forEach(b=>b.classList.toggle('on',b.dataset.font===f));
  setTimeout(paginate,40);
}
$('#open').onclick=()=>{
  if(!book)return;
  $('#library').classList.remove('on');$('#reader').classList.add('on');
  setTimeout(()=>{paginate();const p=parseFloat(localStorage.getItem('sena_progress')||'0');go(Math.round(p*(total-1)),false);},60);
};
$('#back').onclick=()=>{$('#reader').classList.remove('on');$('#library').classList.add('on');};
$('#aa').onclick=()=>$('#panel').classList.toggle('open');
$('#minus').onclick=()=>{fs=Math.max(14,fs-1);document.documentElement.style.setProperty('--fs',fs+'px');localStorage.setItem('sena_fs',fs);setTimeout(paginate,40);};
$('#plus').onclick=()=>{fs=Math.min(28,fs+1);document.documentElement.style.setProperty('--fs',fs+'px');localStorage.setItem('sena_fs',fs);setTimeout(paginate,40);};
$$('[data-theme]').forEach(b=>b.onclick=()=>setTheme(b.dataset.theme));
$$('[data-font]').forEach(b=>b.onclick=()=>setFont(b.dataset.font));
$('#slider').oninput=e=>go(Math.round((e.target.value/100)*(total-1)),false);
window.onkeydown=e=>{if($('#reader').classList.contains('on')){if(e.key==='ArrowRight')go(page+1);if(e.key==='ArrowLeft')go(page-1);}};
let sx=0,sy=0;
$('#vp').ontouchstart=e=>{sx=e.changedTouches[0].clientX;sy=e.changedTouches[0].clientY;};
$('#vp').ontouchend=e=>{
  const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;
  if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy))go(page+(dx<0?1:-1));
  else{const x=e.changedTouches[0].clientX;if(x>innerWidth*.72)go(page+1);else if(x<innerWidth*.28)go(page-1);}
};
window.onresize=()=>setTimeout(paginate,100);
(async()=>{
  try{
    fs=Number(localStorage.getItem('sena_fs')||18);
    document.documentElement.style.setProperty('--fs',fs+'px');
    setTheme(localStorage.getItem('sena_theme')||'paper');
    setFont(localStorage.getItem('sena_font')||'serif');
    const p=parseFloat(localStorage.getItem('sena_progress')||'0');
    $('#libProgress').textContent=Math.round(p*100)+'% lido';
    book=await loadBook();
    render();
    $('#open').disabled=false;
    $('#open').textContent=p>0?'Continuar leitura':'Começar leitura';
  }catch(err){
    console.error(err);
    $('#loading').textContent='Não foi possível carregar o livro. Atualize a página.';
  }
})();