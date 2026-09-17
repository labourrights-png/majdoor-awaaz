(function(){
  'use strict';
  var officialDivisions=[
    'Alaknanda','Chhattarpur','Dwarka','Hauz Khas','Jaffarpur','Janak Puri','Khanpur',
    'Mohan Garden','Mundka','Najafgarh','Nangloi','Nehru Place','New Friends Colony',
    'Nizamuddin','Palam','Punjabi Bagh','R.K. Puram','Saket','Sarita Vihar',
    'Tagore Garden','Uttam Nagar','Vasant Kunj','Vikas Puri'
  ];
  function setText(id,count){
    var el=document.getElementById(id);
    if(el && el.textContent!==count) el.textContent=count;
  }
  function sync(){
    var count=String(officialDivisions.length);
    setText('divisionCount',count);
    setText('dashDivisions',count);
    var list=document.getElementById('divisionList');
    if(list){
      Array.prototype.forEach.call(list.children,function(card){
        var text=(card.textContent||'').trim();
        var visible=officialDivisions.some(function(name){return text.indexOf(name)!==-1;})?'':'none';
        if(card.style.display!==visible) card.style.display=visible;
      });
    }
  }
  function start(){
    sync();
    setInterval(sync,3000);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
