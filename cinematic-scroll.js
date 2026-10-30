/* Gentle wheel inertia on desktop, using the browser's real scroll position.
   Touch, keyboard, scrollbars, embedded controls and reduced motion stay native. */
(() => {
  'use strict';
  const root=document.documentElement;
  const pointer=matchMedia('(hover: hover) and (pointer: fine)');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let current=window.scrollY,target=current,limit=0,raf=0,last=0;
  const enabled=()=>pointer.matches&&!reduced.matches&&!root.classList.contains('still');
  const clamp=value=>Math.max(0,Math.min(limit,value));
  function refresh(){
    limit=Math.max(0,root.scrollHeight-window.innerHeight);
    target=clamp(target);
    if(!raf)current=target=window.scrollY;
  }
  function cancel(){
    if(raf)cancelAnimationFrame(raf);
    raf=0;current=target=window.scrollY;
  }
  function animate(now){
    raf=0;
    if(!enabled()||document.hidden){cancel();return;}
    const dt=Math.min(64,Math.max(1,now-last));last=now;
    current+=(target-current)*(1-Math.exp(-dt/110));
    if(Math.abs(target-current)<.4)current=target;
    window.scrollTo({top:current,behavior:'instant'});
    if(current!==target)raf=requestAnimationFrame(animate);
  }
  function kick(){if(!raf){last=performance.now();raf=requestAnimationFrame(animate);}}
  function nativeArea(node,delta){
    if(node?.closest?.('input,textarea,select,[contenteditable="true"],#bookStage,[data-native-scroll]'))return true;
    for(let el=node;el&&el!==document.body&&el!==root;el=el.parentElement){
      if(el.scrollHeight<=el.clientHeight+1)continue;
      const overflow=getComputedStyle(el).overflowY;
      if(!/auto|scroll/.test(overflow))continue;
      if(delta<0?el.scrollTop>0:el.scrollTop+el.clientHeight<el.scrollHeight-1)return true;
    }
    return false;
  }
  function onWheel(event){
    if(!enabled()||document.hidden||event.defaultPrevented||event.ctrlKey||event.metaKey||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
    if(root.classList.contains('preload')&&!root.classList.contains('loaded'))return;
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?window.innerHeight:1);
    if(!delta)return;
    if(nativeArea(event.target,delta)){cancel();return;}
    event.preventDefault();
    if(!raf)current=target=window.scrollY;
    // A notch moves the browser's normal distance; bursts are limited so a fast flick cannot skip a whole chapter.
    const step=Math.max(-240,Math.min(240,delta));
    target=clamp(Math.max(current-window.innerHeight*.85,Math.min(current+window.innerHeight*.85,target+step)));
    kick();
  }
  function to(y){
    if(!enabled()){cancel();window.scrollTo({top:clamp(y),behavior:'auto'});return;}
    current=window.scrollY;target=clamp(y);kick();
  }
  function destination(node){
    let y=node.getBoundingClientRect().top+window.scrollY;
    if(['about','how-it-works','membership','faq','start'].includes(node.id)){
      const header=document.getElementById('hdr');y-=(header?.getBoundingClientRect().height||80)+16;
    }
    return clamp(y);
  }
  window.addEventListener('wheel',onWheel,{passive:false});
  window.addEventListener('scroll',()=>{
    // Follow external navigation and native scrollbar/keyboard changes.
    if(!raf||Math.abs(window.scrollY-current)>2)cancel();
  },{passive:true});
  document.addEventListener('keydown',event=>{
    if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' ','Escape'].includes(event.key))cancel();
  });
  document.addEventListener('pointerdown',cancel,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
  document.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    const link=event.target.closest?.('a[href^="#"]');
    if(!link||link.hasAttribute('download')||link.target==='_blank')return;
    const hash=link.getAttribute('href');if(hash.length<2)return;
    let node;try{node=document.getElementById(decodeURIComponent(hash.slice(1)));}catch{return;}
    if(!node)return;
    event.preventDefault();to(destination(node));
    history.pushState(null,'',hash);node.setAttribute('tabindex','-1');node.focus({preventScroll:true});
  });
  window.addEventListener('resize',refresh);
  window.addEventListener('load',refresh);
  window.addEventListener('pairlum-landing-change',refresh);
  pointer.addEventListener('change',cancel);reduced.addEventListener('change',cancel);
  if(document.fonts)document.fonts.ready.then(refresh);
  new ResizeObserver(refresh).observe(document.body);
  refresh();
  window.PairlumScroll={to,cancel,refresh,destination};
})();
