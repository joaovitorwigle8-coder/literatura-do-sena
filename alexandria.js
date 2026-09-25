let book=null;
let pageIndex=0;
let pagesData=[];
let fs=19;
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));

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

function esc(s){
  return String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
}

function itemHTML(it){
  if(it.type==='part'){
    return '<div class="part-page"><span>PARTE</span><h2>'+esc(it.text)+'</h2></div>';
  }
  if(it.type==='chapter'){
    return '<div class="chapter-page"><span class="chapter-no">'+(it.number==='E'?'EPÍLOGO':'CAPÍTULO '+esc(it.number))+'</span><h2>'+esc(it.title)+'</h2></div>';
  }
  const cls=it.text.startsWith('—')?'dialogue':(it.text.length<55?'short':'');
  return '<p class="'+cls+'">'+esc(it.text)+'</p>';
}

function chapterNameForItem(idx){
  let name='Abertura';
  for(let i=0;i<=idx;i++){
    const it=book.items[i];
    if(it.type==='chapter') name=(it.number==='E'?'Epílogo':'Capítulo '+it.number)+' · '+it.title;
    if(it.type==='part') name=it.text;
  }
  return name;
}

function syncMeasure(){
  const shell=$('#pageShell');
  const paper=$('#pagePaper');
  const measure=$('#measure');
  if(!shell || !paper || !measure) return;
  const cs=getComputedStyle(paper);
  measure.style.width=paper.clientWidth+'px';
  measure.style.height=paper.clientHeight+'px';
  measure.style.padding=cs.padding;
  measure.style.fontFamily=cs.fontFamily;
  measure.style.fontSize=cs.fontSize;
  measure.style.lineHeight=cs.lineHeight;
}

function buildPages(){
  if(!book) return;
  const measure=$('#measure');
  syncMeasure();
  measure.innerHTML='';
  pagesData=[];

  let current={html:[],start:0,end:0,chapter:'Abertura'};
  const flush=()=>{
    if(current.html.length){
      pagesData.push({...current,html:current.html.join('')});
    }
  };

  for(let i=0;i<book.items.length;i++){
    const it=book.items[i];

    if(it.type==='part'){
      flush();
      pagesData.push({html:itemHTML(it),start:i,end:i,chapter:it.text,special:true});
      current={html:[],start:i+1,end:i+1,chapter:chapterNameForItem(i)};
      measure.innerHTML='';
      continue;
    }

    if(it.type==='chapter'){
      flush();
      current={html:[itemHTML(it)],start:i,end:i,chapter:chapterNameForItem(i)};
      measure.innerHTML=current.html.join('');
      continue;
    }

    const html=itemHTML(it);
    if(current.html.length===0){
      current={html:[],start:i,end:i,chapter:chapterNameForItem(i)};
      measure.innerHTML='';
    }

    const test=current.html.concat(html).join('');
    measure.innerHTML=test;

    if(measure.scrollHeight>measure.clientHeight && current.html.length){
      flush();
      current={html:[html],start:i,end:i,chapter:chapterNameForItem(i)};
      measure.innerHTML=html;
    }else{
      current.html.push(html);
      current.end=i;
    }
  }
  flush();

  if(!pagesData.length) pagesData=[{html:'<p>Livro indisponível.</p>',start:0,end:0,chapter:'Livro'}];

  const saved=parseFloat(localStorage.getItem('sena_progress')||'0');
  pageIndex=Math.min(pagesData.length-1,Math.max(0,Math.round(saved*(pagesData.length-1))));
  renderCurrent(false);
  buildTOC();
}

function renderCurrent(animate=true,dir=1){
  const data=pagesData[pageIndex];
  const shell=$('#pageShell');
  if(!data) return;

  if(animate){
    shell.style.transition='transform .18s ease, opacity .18s ease';
    shell.style.transform='translateX('+(dir>0?'-22px':'22px')+') rotateY('+(dir>0?'-4deg':'4deg')+')';
    shell.style.opacity='.2';
    setTimeout(()=>{
      $('#pageContent').innerHTML=data.html;
      updateMeta();
      shell.style.transition='none';
      shell.style.transform='translateX('+(dir>0?'18px':'-18px')+') rotateY('+(dir>0?'3deg':'-3deg')+')';
      requestAnimationFrame(()=>{
        shell.style.transition='transform .24s ease, opacity .24s ease';
        shell.style.transform='translateX(0) rotateY(0)';
        shell.style.opacity='1';
      });
    },160);
  }else{
    $('#pageContent').innerHTML=data.html;
    shell.style.opacity='1';
    shell.style.transform='none';
    updateMeta();
  }
}

function updateMeta(){
  const total=pagesData.length;
  const p=total<=1?0:pageIndex/(total-1);
  const pct=Math.round(p*100);
  const data=pagesData[pageIndex];
  $('#pg').textContent=(pageIndex+1)+' de '+total;
  $('#pct').textContent=pct+'%';
  $('#slider').value=pct;
  $('#folioNum').textContent=pageIndex+1;
  $('#chap').textContent=data.chapter;
  $('#libProgress').textContent=pct+'%';
  $('#miniTrack').style.width=pct+'%';
  localStorage.setItem('sena_progress',String(p));
}

function go(n,animate=true){
  const next=Math.max(0,Math.min(pagesData.length-1,n));
  if(next===pageIndex && animate) return;
  const dir=next>=pageIndex?1:-1;
  pageIndex=next;
  renderCurrent(animate,dir);
}

function buildTOC(){
  $('#toc').innerHTML=book.items.map((it,i)=>{
    if(it.type!=='chapter') return '';
    const label=it.number==='E'?'Epílogo':'Capítulo '+it.number;
    return '<button data-j="'+i+'"><b>'+label+'</b><br>'+esc(it.title)+'</button>';
  }).join('');
  $$('[data-j]').forEach(btn=>{
    btn.onclick=()=>{
      const target=Number(btn.dataset.j);
      const p=pagesData.findIndex(x=>x.start<=target && x.end>=target);
      if(p>=0) go(p,false);
      $('#panel').classList.remove('open');
    };
  });
}

function setTheme(t){
  document.body.classList.remove('reader-sepia','reader-night');
  if(t==='sepia') document.body.classList.add('reader-sepia');
  if(t==='night') document.body.classList.add('reader-night');
  localStorage.setItem('sena_theme',t);
  $$('[data-theme]').forEach(b=>b.classList.toggle('on',b.dataset.theme===t));
  if($('#reader').classList.contains('on')) setTimeout(buildPages,40);
}

function setFont(f){
  document.documentElement.style.setProperty('--reader-font',f==='sans'?'Arial,Helvetica,sans-serif':'Georgia,"Times New Roman",serif');
  localStorage.setItem('sena_font',f);
  $$('[data-font]').forEach(b=>b.classList.toggle('on',b.dataset.font===f));
  if($('#reader').classList.contains('on')) setTimeout(buildPages,40);
}

function resizeText(delta){
  fs=Math.max(15,Math.min(26,fs+delta));
  document.documentElement.style.setProperty('--reader-size',fs+'px');
  localStorage.setItem('sena_fs',String(fs));
  if($('#reader').classList.contains('on')) setTimeout(buildPages,60);
}

$('#open').onclick=()=>{
  if(!book) return;
  $('#library').classList.remove('on');
  $('#reader').classList.add('on');
  setTimeout(()=>{
    buildPages();
  },70);
};

$('#back').onclick=()=>{
  $('#reader').classList.remove('on');
  $('#library').classList.add('on');
  $('#panel').classList.remove('open');
};

$('#prev').onclick=()=>go(pageIndex-1);
$('#next').onclick=()=>go(pageIndex+1);
$('#aa').onclick=()=>$('#panel').classList.toggle('open');
$('#closePanel').onclick=()=>$('#panel').classList.remove('open');
$('#minus').onclick=()=>resizeText(-1);
$('#plus').onclick=()=>resizeText(1);
$$('[data-theme]').forEach(b=>b.onclick=()=>setTheme(b.dataset.theme));
$$('[data-font]').forEach(b=>b.onclick=()=>setFont(b.dataset.font));
$('#slider').oninput=e=>{
  const p=Number(e.target.value)/100;
  go(Math.round(p*(pagesData.length-1)),false);
};

window.addEventListener('keydown',e=>{
  if(!$('#reader').classList.contains('on')) return;
  if(e.key==='ArrowRight' || e.key==='PageDown') go(pageIndex+1);
  if(e.key==='ArrowLeft' || e.key==='PageUp') go(pageIndex-1);
  if(e.key==='Escape') $('#panel').classList.remove('open');
});

let touchX=0,touchY=0;
$('#pageShell').addEventListener('touchstart',e=>{
  touchX=e.changedTouches[0].clientX;
  touchY=e.changedTouches[0].clientY;
},{passive:true});
$('#pageShell').addEventListener('touchend',e=>{
  const dx=e.changedTouches[0].clientX-touchX;
  const dy=e.changedTouches[0].clientY-touchY;
  if(Math.abs(dx)>42 && Math.abs(dx)>Math.abs(dy)){
    go(pageIndex+(dx<0?1:-1));
  }
},{passive:true});

let resizeTimer;
window.addEventListener('resize',()=>{
  clearTimeout(resizeTimer);
  resizeTimer=setTimeout(()=>{
    if($('#reader').classList.contains('on')) buildPages();
  },180);
});

(async()=>{
  try{
    fs=Number(localStorage.getItem('sena_fs')||19);
    document.documentElement.style.setProperty('--reader-size',fs+'px');
    setTheme(localStorage.getItem('sena_theme')||'paper');
    setFont(localStorage.getItem('sena_font')||'serif');

    const saved=parseFloat(localStorage.getItem('sena_progress')||'0');
    const pct=Math.round(saved*100);
    $('#libProgress').textContent=pct+'%';
    $('#miniTrack').style.width=pct+'%';

    book=await loadBook();
    $('#open').disabled=false;
    $('#open span').textContent=saved>0?'Continuar leitura':'Entrar no livro';
    $('#loading').textContent='Acervo disponível';
  }catch(err){
    console.error(err);
    $('#loading').textContent='Não foi possível carregar o livro. Atualize a página.';
  }
})();