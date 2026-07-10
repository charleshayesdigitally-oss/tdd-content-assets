/* Mustang Creek Community Church — shared page behavior (Church Website Engine v1).
   Mobile menu toggle (keyboard accessible: Enter/Space via native button, Escape closes) + footer year. */
(function(){
  var btn=document.querySelector('.menu-btn'),links=document.querySelector('.navlinks');
  if(btn&&links){
    if(!links.id){links.id='navlinks';}
    btn.setAttribute('aria-expanded','false');
    btn.setAttribute('aria-controls',links.id);
    function setOpen(open){
      links.classList.toggle('open',open);
      btn.setAttribute('aria-expanded',open?'true':'false');
      btn.textContent=open?'✕':'☰';
      btn.setAttribute('aria-label',open?'Close menu':'Menu');
    }
    btn.addEventListener('click',function(){setOpen(!links.classList.contains('open'));});
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&links.classList.contains('open')){setOpen(false);btn.focus();}
    });
    links.addEventListener('click',function(e){if(e.target.tagName==='A'){setOpen(false);}});
  }
  var yr=document.getElementById('yr');
  if(yr){yr.textContent=new Date().getFullYear();}
})();
