/* Auth UX fixes for Majdoor Awaaz. Keeps existing member data and backend API. */
(function(){
  'use strict';
  function addForgotPin(){
    var result=document.getElementById('loginResult');
    if(!result || document.getElementById('forgotPinBox')) return;
    var box=document.createElement('div');
    box.id='forgotPinBox';
    box.style.cssText='margin-top:12px;padding:14px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc;display:none';
    box.innerHTML='<div style="font-weight:800;margin-bottom:6px">🔐 PIN भूल गए?</div>'+
      '<div style="font-size:13px;color:#667085;line-height:1.6">सुरक्षा के लिए PIN reset केवल verification के बाद किया जाएगा। अपना <b>Mobile + Member ID + Name</b> लेकर Admin से PIN reset करवाएँ।</div>'+
      '<button type="button" class="btn light" style="margin-top:10px" id="showResetInfo">Reset process देखें</button>'+
      '<div id="resetInfo" style="display:none;margin-top:10px;font-size:13px;line-height:1.6">1. अपना registered mobile और Member ID रखें।<br>2. Admin verification के बाद नया 4-digit PIN set किया जाएगा।<br>3. PIN किसी के साथ share न करें।</div>';
    result.parentNode.appendChild(box);
    var btn=document.createElement('button');
    btn.type='button'; btn.className='btn light'; btn.style.cssText='margin-top:10px;width:100%';
    btn.textContent='🔑 PIN भूल गए?';
    btn.onclick=function(){box.style.display=box.style.display==='none'?'block':'none'};
    result.parentNode.insertBefore(btn,result.nextSibling);
    document.getElementById('showResetInfo').onclick=function(){var x=document.getElementById('resetInfo');x.style.display=x.style.display==='none'?'block':'none'};
  }
  function improveLogin(){
    if(typeof window.login!=='function' || window.__authFixLogin) return;
    window.__authFixLogin=true;
    window.login=async function(){
      var phone=(document.getElementById('loginPhone')?.value||'').replace(/\D/g,'');
      var pin=(document.getElementById('loginPin')?.value||'').trim();
      var out=document.getElementById('loginResult');
      if(!/^\d{10}$/.test(phone)){if(out)out.textContent='कृपया 10-digit mobile number डालें।';return}
      if(!/^\d{4}$/.test(pin)){if(out)out.textContent='कृपया 4-digit PIN डालें।';return}
      try{
        var r=await api({type:'login',phone:phone,pin:pin});
        if(out)out.textContent=r.message||r.error||'Login failed';
        if(r.success){session={phone:phone,member:r.member};go('me');loadMe();}
      }catch(e){
        console.error(e);
        if(out)out.textContent='Login service से connection नहीं हो पाया। थोड़ी देर बाद फिर कोशिश करें।';
      }
    };
  }
  function init(){addForgotPin();improveLogin();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  setTimeout(init,500);
})();
