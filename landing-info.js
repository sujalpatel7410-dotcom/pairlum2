(() => {
  'use strict';
  document.querySelectorAll('#faq details').forEach(detail=>detail.addEventListener('toggle',()=>{
    window.dispatchEvent(new Event('pairlum-layout-change'));
    window.PairlumScroll?.refresh();
  }));
  const button=document.getElementById('copyPairlumLink'),field=document.getElementById('pairlumShareUrl'),whatsapp=document.getElementById('sharePairlumWhatsApp'),status=document.getElementById('shareStatus');
  if(!button||!field||!whatsapp||!status)return;
  // Share only the public origin and campaign tags, never a visitor's query or email.
  const url=new URL('/',location.origin);url.searchParams.set('utm_source','partner');url.searchParams.set('utm_medium','share');
  field.value=url.href;
  whatsapp.href='https://wa.me/?text='+encodeURIComponent('I found Pairlum—a shared space for couples living apart. '+url.href);
  button.addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(url.href);status.textContent='Link copied. Share it with your person.';}
    catch{field.focus();field.select();status.textContent='Select and copy the link below to share it.';}
  });
})();
