from pathlib import Path
import re

BACKEND = 'https://script.google.com/macros/s/AKfycbwGS_m1Rva1zmoJuCXvXFsZKkWyvXFcjwwEE4Hj5-YHX1xBm8aX838RHYE9c-Pc4_M/exec'
DIVISIONS = ['Alaknanda','Chhattarpur','Dwarka','Hauz Khas','Jaffarpur','Janak Puri','Khanpur','Mohan Garden','Mundka','Najafgarh','Nangloi','Nehru Place','New Friends Colony','Nizamuddin','Palam','Punjabi Bagh','R.K. Puram','Saket','Sarita Vihar','Tagore Garden','Uttam Nagar','Vasant Kunj','Vikas Puri']

p = Path('platform-v2.html')
s = p.read_text(encoding='utf-8')
s = re.sub(r'<script\s+src=["\']division-count\.js["\']\s*></script>', '', s, flags=re.I)
s = re.sub(r"const SCRIPT_URL='[^']*';", "const SCRIPT_URL='" + BACKEND + "';", s)

api_re = r"async function api\(body\)\{.*?\}\s*async function load\(\)\{.*?\}"
api_new = """async function api(body){let r=await fetch(SCRIPT_URL,{redirect:'follow',method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),cache:'no-store'});let t=await r.text();return JSON.parse(t.replace(/^\\uFEFF/,'').trim())}
async function load(){try{let r=await fetch(SCRIPT_URL,{method:'GET',redirect:'follow',cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);DATA=await r.json();renderAll()}catch(e){toast('Backend connect नहीं हो पाया');console.error('Backend load failed',e)}}"""
s = re.sub(api_re, lambda m: api_new, s, count=1, flags=re.S)
s = s.replace("d.options=d.options.split('\\n').map(x=>x.trim()).filter(Boolean);", "d.options=d.options.split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean);")
s = s.replace("d.options=d.options.split('\\\\n').map(x=>x.trim()).filter(Boolean);", "d.options=d.options.split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean);")
s = re.sub(r"document\.getElementById\('divisionCount'\)\.textContent=\(DATA\.divisionBreakdown\|\|\[\]\)\.length", "document.getElementById('divisionCount').textContent=23", s)
s = re.sub(r"document\.getElementById\('dashDivisions'\)\.textContent=\(DATA\.divisionBreakdown\|\|\[\]\)\.length", "document.getElementById('dashDivisions').textContent=23", s)

options = '<select id="regDivision"><option value="">Division चुनें...</option>' + ''.join('<option>'+d+'</option>' for d in DIVISIONS) + '</select>'
s = re.sub(r'<select id="regDivision">.*?</select>', options, s, count=1, flags=re.S)
category = '<select id="regCategory"><option value="">Category चुनें...</option><option value="TO">TO</option><option value="LM">LM</option><option value="ALM">ALM</option><option value="अन्य">अन्य</option></select>'
s = re.sub(r'<select id="regCategory">.*?</select>', category, s, count=1, flags=re.S)
p.write_text(s, encoding='utf-8')

q = Path('index.html')
h = q.read_text(encoding='utf-8')
h = h.replace("run();setInterval(run,800);setTimeout(function(){clearInterval(window.__hiTimer)},5000);window.__hiTimer=setInterval(run,800);", "run();var hiTimer=setInterval(run,800);setTimeout(function(){clearInterval(hiTimer)},5000);")
q.write_text(h, encoding='utf-8')
print('site repair complete')
