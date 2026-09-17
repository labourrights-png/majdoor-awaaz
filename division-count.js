(function(){
  'use strict';
  var officialDivisions=[
    'Alaknanda','Chhattarpur','Dwarka','Hauz Khas','Jaffarpur','Janak Puri','Khanpur',
    'Mohan Garden','Mundka','Najafgarh','Nangloi','Nehru Place','New Friends Colony',
    'Nizamuddin','Palam','Punjabi Bagh','R.K. Puram','Saket','Sarita Vihar',
    'Tagore Garden','Uttam Nagar','Vasant Kunj','Vikas Puri'
  ];
  function sync(){
    var count=String(officialDivisions.length);
    var home=document.getElementById('divisionCount');
    var dash=document.getElementById('dashDivisions');
    if(home) home.textContent=count;
    if(dash) dash.textContent=count;
    var list=document.getElementById('divisionList');
    if(list){
      Array.prototype.forEach.call(list.children,function(card){
        var text=(card.textContent||'').trim();
        card.style.display=officialDivisions.some(function(name){return text.indexOf(name)!==-1;})?'':'none';
      });
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',sync); else sync();
  new MutationObserver(sync).observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(sync,500);
  setTimeout(sync,1500);
})();
