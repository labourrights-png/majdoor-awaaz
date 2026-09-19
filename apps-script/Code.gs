/* MAZDOOR AWAAZ — DIGITAL EMPLOYEE PLATFORM V2
   Replace the deployed Apps Script Code.gs with this file after review.
   IMPORTANT: store ADMIN_KEY and ONESIGNAL_REST_API_KEY in Script Properties.
*/
var MEMBER_ID_PREFIX='AWAAZ-';
var RESP_HEADERS=['Timestamp','MemberID','Naam','Phone','Category','Vendor','Division','JoinYear','Experience','Salary','Demands','PinHash'];
var SHEETS={
  responses:'Responses',messages:'Messages',updates:'Updates',suggestions:'Suggestions',pollVotes:'PollVotes',
  news:'News',demands:'Demands',documents:'Documents',meetings:'Meetings',notifications:'Notifications',polls:'Polls',participation:'Participation',sessions:'AuthSessions',recoveryRequests:'RecoveryRequests'
};
var HEADERS={
  Responses:RESP_HEADERS,
  Messages:['Timestamp','Text','Anonymous'],
  Updates:['Timestamp','Title','Text','Tag','Published'],
  Suggestions:['Timestamp','Phone','Kind','Suggestion'],
  PollVotes:['Timestamp','Phone','Option','PollID'],
  News:['ID','CreatedAt','Date','Category','Headline','Summary','Source','Url','ImageUrl','Published','VideoUrl','AiSummary','Tags','Provider'],
  Demands:['ID','CreatedAt','Title','Problem','Description','Status','EvidenceUrl','UpdatedAt'],
  Documents:['ID','CreatedAt','Title','Category','Description','Url','Date','Published'],
  Meetings:['ID','CreatedAt','DateTime','Title','Location','Mode','Purpose','Status'],
  Notifications:['ID','CreatedAt','Title','Message','Type','Url','Published'],
  Polls:['ID','CreatedAt','Question','OptionsJSON','Active','EndDate'],
  Participation:['Timestamp','Phone','MemberID','Action','ItemID'],
  AuthSessions:['TokenHash','Phone','CreatedAt','ExpiresAt','Revoked'],
  RecoveryRequests:['ID','RequestedAt','Phone','MemberID','Name','Division','Status','AdminNote','ResolvedAt'],
  VideoSubmissions:['ID','CreatedAt','Phone','MemberID','Name','Division','Title','Caption','FileName','MimeType','SizeBytes','DriveFileId','VideoUrl','Status','AdminNote','PublishedAt']
};
function prop_(k){return PropertiesService.getScriptProperties().getProperty(k)||''}
function getAdminKey(){return prop_('ADMIN_KEY')}
function ensureSheet_(ss,name,headers){var sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);if(sh.getLastRow()===0){sh.getRange(1,1,1,headers.length).setValues([headers])}else{var current=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),headers.length)).getValues()[0];headers.forEach(function(h,i){if(!current[i])sh.getRange(1,i+1).setValue(h)})}return sh}
function getDatabase_(){var id=prop_('SPREADSHEET_ID');if(!id)throw new Error('Server configuration missing: SPREADSHEET_ID');return SpreadsheetApp.openById(id)}
function ensureSheets(){var ss=getDatabase_();Object.keys(HEADERS).forEach(function(n){ensureSheet_(ss,n,HEADERS[n])});return ss}
function cleanPhone_(p){return String(p||'').replace(/\D/g,'').slice(-10)}
function validPhone_(p){return /^\d{10}$/.test(cleanPhone_(p))}
function validPin_(p){return /^\d{4}$/.test(String(p||''))}
function hashPin_(pin){var bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(pin),Utilities.Charset.UTF_8);return bytes.map(function(b){var v=b<0?b+256:b;return ('0'+v.toString(16)).slice(-2)}).join('')}
function jsonOut_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
function truthy_(v){return v===true||String(v).toLowerCase()==='true'||String(v)==='1'||String(v).toLowerCase()==='yes'}
function limit_(v,n){return String(v||'').trim().slice(0,n)}
function validUrl_(u){u=String(u||'').trim();if(!u)return true;try{var x=new URL(u);return x.protocol==='http:'||x.protocol==='https:'}catch(e){return false}}
function hashToken_(token){return hashPin_(String(token))}
function newToken_(){return Utilities.getUuid()+'-'+Utilities.getUuid()+'-'+new Date().getTime()}
function issueSession_(phone){var token=newToken_(),now=new Date(),exp=new Date(now.getTime()+7*24*60*60*1000),sh=ensureSheets().getSheetByName('AuthSessions');sh.appendRow([hashToken_(token),cleanPhone_(phone),now,exp,false]);return {token:token,expiresAt:exp.toISOString()}}
function sessionMember_(token){if(!token)throw new Error('Login required');var sh=ensureSheets().getSheetByName('AuthSessions'),last=sh.getLastRow();if(last<2)throw new Error('Session expired');var rows=sh.getRange(2,1,last-1,5).getValues(),h=hashToken_(token),now=new Date();for(var i=rows.length-1;i>=0;i--){if(String(rows[i][0])===h&&!truthy_(rows[i][4])){var exp=new Date(rows[i][3]);if(exp>now){var m=readMember_(rows[i][1]);if(m)return m;}break}}throw new Error('Session expired')}
function requireSession_(d){return sessionMember_(d.sessionToken)}
function revokeSession_(token){if(!token)return;var sh=ensureSheets().getSheetByName('AuthSessions'),last=sh.getLastRow();if(last<2)return;var h=hashToken_(token),rows=sh.getRange(2,1,last-1,5).getValues();for(var i=0;i<rows.length;i++)if(String(rows[i][0])===h){sh.getRange(i+2,5).setValue(true);break}}
function loginGuard_(phone){var key='login:'+cleanPhone_(phone),cache=CacheService.getScriptCache(),raw=cache.get(key);if(!raw)return {locked:false,failed:0};var o=JSON.parse(raw);return {locked:Number(o.lockUntil||0)>Date.now(),failed:Number(o.failed||0),lockUntil:Number(o.lockUntil||0)}}
function recordLoginFailure_(phone){var lock=LockService.getScriptLock();lock.waitLock(5000);try{var key='login:'+cleanPhone_(phone),cache=CacheService.getScriptCache(),s=loginGuard_(phone),failed=s.failed+1,lockUntil=failed>=5?Date.now()+15*60*1000:0;cache.put(key,JSON.stringify({failed:failed,lockUntil:lockUntil}),Math.min(900,failed>=5?900:300));return {failed:failed,locked:!!lockUntil}}finally{lock.releaseLock()}}
function clearLoginFailures_(phone){CacheService.getScriptCache().remove('login:'+cleanPhone_(phone))}
function requireLength_(v,max,label){var s=String(v||'').trim();if(s.length>max)throw new Error(label+' too long');return s}
function pollOptionIndex_(poll,opt){var opts=poll.options||[];var s=String(opt);var idx=Number(s);if(/^\d+$/.test(s)&&idx>=0&&idx<opts.length)return idx;if(opts.indexOf(s)>=0)return opts.indexOf(s);return -1}
function uuid_(){return Utilities.getUuid()}
function findMemberRow_(sh,phone){var p=cleanPhone_(phone),last=sh.getLastRow();if(last<2)return -1;var vals=sh.getRange(2,4,last-1,1).getValues();for(var i=0;i<vals.length;i++)if(cleanPhone_(vals[i][0])===p)return i+2;return -1}
function memberFromRow_(row){return {memberId:row[1],name:row[2],phone:row[3],category:row[4],vendor:row[5],division:row[6],joinYear:row[7],experience:row[8],salary:row[9],demands:row[10]}}
function readMember_(phone,pin){var sh=ensureSheets().getSheetByName('Responses'),r=findMemberRow_(sh,phone);if(r<0)return null;var row=sh.getRange(r,1,1,RESP_HEADERS.length).getValues()[0];if(pin!==undefined&&hashPin_(pin)!==String(row[11]||''))return null;return memberFromRow_(row)}
function requireAdmin_(data){if(!getAdminKey()||String(data.key||'')!==getAdminKey())throw new Error('Admin authentication failed')}
function requireMember_(data){if(!validPhone_(data.phone)||!validPin_(data.pin))throw new Error('Valid mobile and 4-digit PIN required');var m=readMember_(data.phone,data.pin);if(!m)throw new Error('Login required');return m}
function appendParticipation_(phone,memberId,action,itemId){var sh=ensureSheets().getSheetByName('Participation');sh.appendRow([new Date(),phone,memberId,action,itemId||''])}
function rows_(sheetName){var sh=ensureSheets().getSheetByName(sheetName),last=sh.getLastRow(),n=sh.getLastColumn();if(last<2)return [];var vals=sh.getRange(2,1,last-1,n).getValues();return vals.map(function(r){var o={};HEADERS[sheetName].forEach(function(h,i){o[h]=r[i]});return o})}
function published_(sheetName){return rows_(sheetName).filter(function(x){return truthy_(x.Published)})}
function sortDesc_(a,key){return a.sort(function(x,y){return new Date(y[key]||0)-new Date(x[key]||0)})}
function upsert_(sheetName,id,values){var sh=ensureSheets().getSheetByName(sheetName),headers=HEADERS[sheetName],rid=id||uuid_(),last=sh.getLastRow(),row=-1;if(last>=2){var ids=sh.getRange(2,1,last-1,1).getValues();for(var i=0;i<ids.length;i++)if(String(ids[i][0])===String(rid)){row=i+2;break}}if(row<0){values[0]=rid;sh.appendRow(values)}else sh.getRange(row,1,1,headers.length).setValues([values]);return rid}
function deleteById_(sheetName,id){var sh=ensureSheets().getSheetByName(sheetName),last=sh.getLastRow();if(last<2)return false;var ids=sh.getRange(2,1,last-1,1).getValues();for(var i=0;i<ids.length;i++)if(String(ids[i][0])===String(id)){sh.deleteRow(i+2);return true}return false}
function sendPushNotification_(title,message,url){var key=prop_('ONESIGNAL_REST_API_KEY'),app=prop_('ONESIGNAL_APP_ID');if(!key||!app)return {sent:false,reason:'OneSignal properties missing'};try{var payload={app_id:app,included_segments:['All'],headings:{en:title},contents:{en:message}};if(url)payload.url=url;var res=UrlFetchApp.fetch('https://onesignal.com/api/v1/notifications',{method:'post',contentType:'application/json',headers:{Authorization:'Basic '+key},payload:JSON.stringify(payload),muteHttpExceptions:true});return {sent:res.getResponseCode()>=200&&res.getResponseCode()<300,code:res.getResponseCode()}}catch(e){return {sent:false,reason:String(e)}}}
function doPost(e){try{ensureSheets();var d=JSON.parse((e.postData&&e.postData.contents)||'{}'),type=d.type||'';
  if(type==='signature')return saveMember_(d);
  if(type==='saveProfile')return saveProfile_(d);
  if(type==='claimPin')return adminResetPin_(d);
  if(type==='login')return login_(d);
  if(type==='requestRecovery')return requestRecovery_(d);
  if(type==='uploadVideo')return uploadVideo_(d);
  if(type==='profile'){var pm=requireSession_(d);return jsonOut_({success:true,member:pm})}
  if(type==='logout'){revokeSession_(d.sessionToken);return jsonOut_({success:true,message:'Logged out'})}
  if(type==='message'||type==='wall'){var m=requireLength_(d.text||d.message,2000,'Message');if(!m)throw new Error('Message required');ensureSheets().getSheetByName('Messages').appendRow([new Date(),m,!!d.anonymous]);return jsonOut_({success:true,message:'Employee Voice submitted'});}
  if(type==='suggestion'||type==='private'){var sm=requireSession_(d);var st=requireLength_(d.suggestion||d.text,2000,'Suggestion');if(!st)throw new Error('Suggestion required');ensureSheets().getSheetByName('Suggestions').appendRow([new Date(),sm.phone,d.kind||'Suggestion',st]);return jsonOut_({success:true,message:'Private submission received'});}
  if(type==='vote'||type==='poll')return vote_(d);
  if(type==='participation')return participation_(d);
  if(type==='getParticipation')return getParticipation_(d);
  if(type==='refreshNews'){var last=PropertiesService.getScriptProperties().getProperty('NEWS_LAST_SYNC'),fresh=last&&((Date.now()-new Date(last).getTime())<5*60*1000);if(fresh)return jsonOut_({success:true,added:0,lastSync:last,cached:true});var nr=syncNewsFromRSS();return jsonOut_({success:true,added:nr.added||0,lastSync:nr.lastSync||new Date().toISOString()})}if(type==='aggregate'||type==='load'||type==='dashboard')return jsonOut_(aggregate_());
  if(type==='adminGet'){requireAdmin_(d);return adminData_()}
  if(type==='adminResolveRecovery')return adminResolveRecovery_(d);
  if(type==='adminModerateVideo')return adminModerateVideo_(d);
  if(type==='update')return adminSaveUpdate_(d);
  if(type==='adminSaveNews')return adminSaveNews_(d);
  if(type==='adminDeleteNews')return adminDelete_(d,'News');
  if(type==='adminSaveDemand')return adminSaveDemand_(d);
  if(type==='adminDeleteDemand')return adminDelete_(d,'Demands');
  if(type==='adminSaveDocument')return adminSaveDocument_(d);
  if(type==='adminDeleteDocument')return adminDelete_(d,'Documents');
  if(type==='adminSaveMeeting')return adminSaveMeeting_(d);
  if(type==='adminDeleteMeeting')return adminDelete_(d,'Meetings');
  if(type==='adminSavePoll')return adminSavePoll_(d);
  if(type==='adminDeletePoll')return adminDelete_(d,'Polls');
  if(type==='adminSaveNotification')return adminSaveNotification_(d);
  if(type==='adminDeleteNotification')return adminDelete_(d,'Notifications');
  if(type==='adminResetPin')return adminResetPin_(d);
  if(type==='adminUpdateMember')return adminUpdateMember_(d);
  if(type==='adminDeleteMember')return adminDeleteMember_(d);
  if(type==='deleteUpdate')return adminDeleteUpdate_(d);
  throw new Error('Unknown request type');
}catch(err){return jsonOut_({success:false,error:String(err.message||err)})}}
function saveMember_(d){var lock=LockService.getScriptLock();lock.waitLock(5000);try{var ss=ensureSheets(),sh=ss.getSheetByName('Responses'),phone=cleanPhone_(d.phone);if(!validPhone_(phone))throw new Error('Valid 10-digit mobile required');if(!validPin_(d.pin))throw new Error('PIN must be 4 digits');var r=findMemberRow_(sh,phone);if(r>=0)throw new Error('Mobile already registered. Please login.');var name=requireLength_(d.name,100,'Name');var memberId=MEMBER_ID_PREFIX+String(Math.max(1,sh.getLastRow())).padStart(4,'0');sh.appendRow([new Date(),memberId,name,phone,limit_(d.category,30),limit_(d.vendor,100),limit_(d.division,80),limit_(d.joinYear,10),limit_(d.experience,30),limit_(d.salary,30),limit_(d.demands,1000),hashPin_(d.pin)]);var session=issueSession_(phone);return jsonOut_({success:true,message:'Registration successful',member:{memberId:memberId,name:name,phone:phone,division:d.division,category:d.category},sessionToken:session.token,expiresAt:session.expiresAt})}finally{lock.releaseLock()}}
function saveProfile_(d){var m=requireSession_(d),sh=ensureSheets().getSheetByName('Responses'),r=findMemberRow_(sh,m.phone);if(r<0)throw new Error('Member not found');var old=sh.getRange(r,1,1,RESP_HEADERS.length).getValues()[0];var vals=[old[0],old[1],d.name!==undefined?requireLength_(d.name,100,'Name'):old[2],old[3],d.category!==undefined?limit_(d.category,30):old[4],d.vendor!==undefined?limit_(d.vendor,100):old[5],d.division!==undefined?limit_(d.division,80):old[6],d.joinYear!==undefined?limit_(d.joinYear,10):old[7],d.experience!==undefined?limit_(d.experience,30):old[8],d.salary!==undefined?limit_(d.salary,30):old[9],d.demands!==undefined?limit_(d.demands,1000):old[10],old[11]];sh.getRange(r,1,1,RESP_HEADERS.length).setValues([vals]);return jsonOut_({success:true,message:'Profile updated',member:memberFromRow_(vals)})}
function claimPin_(d){return adminResetPin_(d)}
function login_(d){var phone=cleanPhone_(d.phone);if(!validPhone_(phone)||!validPin_(d.pin))return jsonOut_({success:false,message:'Mobile or PIN incorrect'});var g=loginGuard_(phone);if(g.locked)throw new Error('Too many failed attempts. Try again in 15 minutes.');var m=readMember_(phone,d.pin);if(!m){var f=recordLoginFailure_(phone);return jsonOut_({success:false,message:f.locked?'Too many failed attempts. Try again in 15 minutes.':'Mobile or PIN incorrect'})}clearLoginFailures_(phone);var s=issueSession_(phone);return jsonOut_({success:true,message:'Login successful',member:m,sessionToken:s.token,expiresAt:s.expiresAt})}
function vote_(d){var m=requireSession_(d),pollId=String(d.pollId||''),lock=LockService.getScriptLock();if(!pollId)throw new Error('Poll required');lock.waitLock(5000);try{var poll=activePoll_();if(!poll||String(poll.id)!==pollId)throw new Error('Poll expired or inactive');var idx=pollOptionIndex_(poll,d.option);if(idx<0)throw new Error('Invalid poll option');var sh=ensureSheets().getSheetByName('PollVotes'),last=sh.getLastRow();if(last>=2){var rows=sh.getRange(2,1,last-1,4).getValues();for(var i=0;i<rows.length;i++)if(cleanPhone_(rows[i][1])===cleanPhone_(m.phone)&&String(rows[i][3]||'')===pollId)return jsonOut_({success:false,message:'आप इस poll में पहले vote कर चुके हैं।'})}sh.appendRow([new Date(),cleanPhone_(m.phone),String(idx),pollId]);appendParticipation_(m.phone,m.memberId,'pollVote',pollId);return jsonOut_({success:true,message:'Vote submitted'})}finally{lock.releaseLock()}}
function participation_(d){var m=requireSession_(d);appendParticipation_(m.phone,m.memberId,limit_(d.action,80)||'participation',limit_(d.itemId,120));return jsonOut_({success:true,message:'Participation saved'})}
function getParticipation_(d){var m=requireSession_(d),all=rows_('Participation').filter(function(x){return cleanPhone_(x.Phone)===cleanPhone_(m.phone)}).slice(-30).reverse();return jsonOut_({success:true,member:m,items:all})}
function setupVideoUploadFolder(){var props=PropertiesService.getScriptProperties(),existing=props.getProperty('VIDEO_UPLOAD_FOLDER_ID');if(existing){try{return 'Video folder already configured: '+DriveApp.getFolderById(existing).getName()+' ('+existing+')'}catch(e){}}var folder=DriveApp.createFolder('Mazdoor Awaaz - Employee Videos');props.setProperty('VIDEO_UPLOAD_FOLDER_ID',folder.getId());return 'Video folder created and configured: '+folder.getName()+' ('+folder.getId()+')'}
function uploadVideo_(d){var m=requireSession_(d),title=requireLength_(d.title,120,'Video title'),caption=requireLength_(d.caption,1000,'Video caption'),name=limit_(d.fileName,180),mime=String(d.mimeType||'').toLowerCase(),size=Number(d.size||0),b64=String(d.base64||'');if(!title)throw new Error('Video title required');if(!/^video\//.test(mime))throw new Error('Only video files are allowed');if(!size||size>25*1024*1024)throw new Error('Video must be 25 MB or smaller');if(!b64)throw new Error('Video file missing');if(b64.length>36*1024*1024)throw new Error('Video upload payload is too large');var folderId=prop_('VIDEO_UPLOAD_FOLDER_ID');if(!folderId)throw new Error('Video upload folder is not configured');var bytes=Utilities.base64Decode(b64),blob=Utilities.newBlob(bytes,mime,name||('employee-video-'+Date.now()+'.mp4'));var folder=DriveApp.getFolderById(folderId),file=folder.createFile(blob);file.setName(name||file.getName());file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);var url='https://drive.google.com/uc?export=download&id='+encodeURIComponent(file.getId()),sh=ensureSheets().getSheetByName('VideoSubmissions'),id=uuid_();sh.appendRow([id,new Date(),m.phone,m.memberId,m.name,m.division,title,caption,name,mime,size,file.getId(),url,'Pending','', '']);return jsonOut_({success:true,message:'Video upload हो गया। Admin review के बाद Shorts में दिखाई देगा।',id:id,status:'Pending'})}
function adminModerateVideo_(d){requireAdmin_(d);var id=String(d.id||''),action=String(d.action||'').toLowerCase(),sh=ensureSheets().getSheetByName('VideoSubmissions'),last=sh.getLastRow();if(!id)throw new Error('Video ID required');for(var i=2;i<=last;i++){if(String(sh.getRange(i,1).getValue())!==id)continue;var status=action==='approve'?'Published':action==='reject'?'Rejected':'';if(!status)throw new Error('Invalid moderation action');sh.getRange(i,14,1,3).setValues([[status,limit_(d.note,500)||'',action==='approve'?new Date():'']]);return jsonOut_({success:true,message:status==='Published'?'Video published to Shorts.':'Video rejected.'})}throw new Error('Video not found')}
function adminSaveNews_(d){requireAdmin_(d);if(!validUrl_(d.url)||!validUrl_(d.imageUrl)||!validUrl_(d.videoUrl))throw new Error('Only http/https URLs are allowed');var now=new Date(),id=upsert_('News',d.id,[d.id||'',new Date(),d.date||now,limit_(d.category,60)||'कर्मचारी समाचार',limit_(d.headline,200),limit_(d.summary,2000),limit_(d.source,200),d.url||'',d.imageUrl||'',truthy_(d.published),d.videoUrl||'',limit_(d.aiSummary,2000),limit_(d.tags,500),limit_(d.provider,80)||'Admin']);if(truthy_(d.notify))sendPushNotification_('नई खबर',d.headline||'नई खबर उपलब्ध है',d.url||d.videoUrl||'');return jsonOut_({success:true,message:'News saved',id:id})}
function adminSaveDemand_(d){requireAdmin_(d);if(!validUrl_(d.evidenceUrl))throw new Error('Only http/https URLs are allowed');var now=new Date(),id=upsert_('Demands',d.id,[d.id||'',d.createdAt||now,limit_(d.title,200),limit_(d.problem,1000),limit_(d.description,3000),limit_(d.status,30)||'Discussion',d.evidenceUrl||'',now]);return jsonOut_({success:true,message:'Demand saved',id:id})}
function adminSaveDocument_(d){requireAdmin_(d);if(!validUrl_(d.url))throw new Error('Only http/https URLs are allowed');var id=upsert_('Documents',d.id,[d.id||'',new Date(),limit_(d.title,200),limit_(d.category,60),limit_(d.description,2000),d.url||'',d.date||new Date(),truthy_(d.published)]);return jsonOut_({success:true,message:'Document saved',id:id})}
function adminSaveMeeting_(d){requireAdmin_(d);var id=upsert_('Meetings',d.id,[d.id||'',new Date(),d.dateTime||'',d.title||'',d.location||'',d.mode||'',d.purpose||'',d.status||'Scheduled']);return jsonOut_({success:true,message:'Meeting saved',id:id})}
function adminSavePoll_(d){requireAdmin_(d);var opts=Array.isArray(d.options)?d.options:String(d.options||'').split(/\r?\n/).filter(Boolean);var id=upsert_('Polls',d.id,[d.id||'',new Date(),d.question||'',JSON.stringify(opts),truthy_(d.active),d.endDate||'']);return jsonOut_({success:true,message:'Poll saved',id:id})}
function adminSaveNotification_(d){requireAdmin_(d);if(!validUrl_(d.url))throw new Error('Only http/https URLs are allowed');var id=upsert_('Notifications',d.id,[d.id||'',new Date(),limit_(d.title,200),limit_(d.message,2000),limit_(d.type,60)||'Update',d.url||'',truthy_(d.published)]);if(truthy_(d.push)&&truthy_(d.published))sendPushNotification_(d.title||'Update',d.message||'',d.url||'');return jsonOut_({success:true,message:'Notification saved',id:id})}
function adminSaveUpdate_(d){requireAdmin_(d);var sh=ensureSheets().getSheetByName('Updates');sh.appendRow([new Date(),d.title||'Campaign Update',d.text||'',d.tag||'',truthy_(d.published===undefined?true:d.published)]);if(truthy_(d.notify))sendPushNotification_(d.title||'Campaign Update',d.text||'',d.url||'');return jsonOut_({success:true,message:'Update published'})}
function adminDelete_(d,sheet){requireAdmin_(d);return jsonOut_({success:deleteById_(sheet,d.id),message:'Deleted'})}
function adminResetPin_(d){requireAdmin_(d);var phone=cleanPhone_(d.phone);if(!validPin_(d.newPin))throw new Error('PIN must be 4 digits');var sh=ensureSheets().getSheetByName('Responses'),r=findMemberRow_(sh,phone);if(r<0)throw new Error('Member not found');sh.getRange(r,12).setValue(hashPin_(d.newPin));return jsonOut_({success:true,message:'PIN reset'})}
function adminUpdateMember_(d){requireAdmin_(d);var sh=ensureSheets().getSheetByName('Responses'),r=findMemberRow_(sh,d.phone);if(r<0)throw new Error('Member not found');var old=sh.getRange(r,1,1,RESP_HEADERS.length).getValues()[0];['name','category','vendor','division','joinYear','experience','salary','demands'].forEach(function(k){var col={name:3,category:5,vendor:6,division:7,joinYear:8,experience:9,salary:10,demands:11}[k];if(d[k]!==undefined)old[col-1]=d[k]});sh.getRange(r,1,1,RESP_HEADERS.length).setValues([old]);return jsonOut_({success:true,message:'Member updated'})}
function adminDeleteMember_(d){requireAdmin_(d);var sh=ensureSheets().getSheetByName('Responses'),r=findMemberRow_(sh,d.phone);if(r<0)throw new Error('Member not found');var ss=ensureSheets(),del=ss.getSheetByName('DeletedMembers')||ss.insertSheet('DeletedMembers');if(del.getLastRow()===0)del.appendRow(RESP_HEADERS.concat(['DeletedAt']));del.appendRow(sh.getRange(r,1,1,RESP_HEADERS.length).getValues()[0].concat([new Date()]));sh.deleteRow(r);return jsonOut_({success:true,message:'Member archived'})}
function adminDeleteUpdate_(d){requireAdmin_(d);var sh=ensureSheets().getSheetByName('Updates'),row=Number(d.row||0);if(row<2||row>sh.getLastRow())throw new Error('Invalid update row');sh.deleteRow(row);return jsonOut_({success:true,message:'Update deleted'})}
function activePoll_(){var p=rows_('Polls').filter(function(x){return truthy_(x.Active)}).sort(function(a,b){return new Date(b.CreatedAt)-new Date(a.CreatedAt)})[0];if(!p)return null;if(p.EndDate&&new Date(p.EndDate)<new Date())return null;return {id:p.ID,createdAt:p.CreatedAt,question:p.Question,options:JSON.parse(p.OptionsJSON||'[]'),active:true,endDate:p.EndDate}}
function pollResults_(pollId){var sh=ensureSheets().getSheetByName('PollVotes'),last=sh.getLastRow(),out={};if(last<2)return out;sh.getRange(2,1,last-1,4).getValues().forEach(function(r){if(String(r[3]||'legacy')===String(pollId))out[String(r[2])]=(out[String(r[2])]||0)+1});return out}
function publicNews_(){return sortDesc_(published_('News'),'Date').slice(0,80).map(function(x){return {id:x.ID,createdAt:x.CreatedAt,date:x.Date,category:x.Category,headline:x.Headline,summary:x.AiSummary||x.Summary,source:x.Source,url:x.Url,imageUrl:x.ImageUrl,videoUrl:x.VideoUrl||'',tags:x.Tags||'',provider:x.Provider||'News'}})}
function publicShorts_(){return rows_('VideoSubmissions').filter(function(x){return String(x.Status||'').toLowerCase()==='published'&&x.VideoUrl}).sort(function(a,b){return new Date(b.PublishedAt||b.CreatedAt)-new Date(a.PublishedAt||a.CreatedAt)}).slice(0,60).map(function(x){return {id:'employee-'+x.ID,createdAt:x.CreatedAt,date:x.PublishedAt||x.CreatedAt,category:'कर्मचारी वीडियो',headline:x.Title,summary:x.Caption||'कर्मचारी द्वारा साझा किया गया वीडियो',source:x.Name||'कर्मचारी',url:x.VideoUrl,videoUrl:x.VideoUrl,imageUrl:'',tags:'कर्मचारी वीडियो',provider:'Employee Upload'}})}
function publicDemands_(){return sortDesc_(rows_('Demands'),'UpdatedAt').map(function(x){return {id:x.ID,title:x.Title,problem:x.Problem,description:x.Description,status:x.Status,evidenceUrl:x.EvidenceUrl,updatedAt:x.UpdatedAt}})}
function publicDocs_(){return sortDesc_(published_('Documents'),'Date').map(function(x){return {id:x.ID,title:x.Title,category:x.Category,description:x.Description,url:x.Url,date:x.Date}})}
function publicMeetings_(){return rows_('Meetings').map(function(x){return {id:x.ID,dateTime:x.DateTime,title:x.Title,location:x.Location,mode:x.Mode,purpose:x.Purpose,status:x.Status}}).sort(function(a,b){return new Date(a.dateTime)-new Date(b.dateTime)})}
function publicNotifications_(){return sortDesc_(published_('Notifications'),'CreatedAt').slice(0,30).map(function(x){return {id:x.ID,createdAt:x.CreatedAt,title:x.Title,message:x.Message,type:x.Type,url:x.Url}})}
function publicPolls_(){return rows_('Polls').map(function(x){var active=truthy_(x.Active);return {id:x.ID,createdAt:x.CreatedAt,question:x.Question,options:JSON.parse(x.OptionsJSON||'[]'),active:active,endDate:x.EndDate}})}
function publicMessages_(){return rows_('Messages').slice(-50).reverse().map(function(x){return {timestamp:x.Timestamp,text:x.Text,anonymous:truthy_(x.Anonymous)}})}
function publicUpdates_(){return rows_('Updates').filter(function(x){return x.Published===''||truthy_(x.Published)}).slice(-50).reverse().map(function(x){return {timestamp:x.Timestamp,title:x.Title,text:x.Text,tag:x.Tag,published:truthy_(x.Published)}})}
function aggregate_(){var ss=ensureSheets(),resp=ss.getSheetByName('Responses'),last=resp.getLastRow(),count=Math.max(0,last-1),today=0,div={};if(count){var vals=resp.getRange(2,1,count,12).getValues(),todayKey=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');vals.forEach(function(r){if(r[0]&&Utilities.formatDate(new Date(r[0]),Session.getScriptTimeZone(),'yyyy-MM-dd')===todayKey)today++;var d=String(r[6]||'').trim()||'Unknown';div[d]=(div[d]||0)+1})}var divisionBreakdown=Object.keys(div).map(function(k){return {division:k,count:div[k]}}).sort(function(a,b){return b.count-a.count});var ap=activePoll_();return {count:count,todayCount:today,divisionBreakdown:divisionBreakdown,messages:publicMessages_(),updates:publicUpdates_(),news:publicNews_(),newsLastSync:PropertiesService.getScriptProperties().getProperty('NEWS_LAST_SYNC')||'',demands:publicDemands_(),documents:publicDocs_(),meetings:publicMeetings_(),notifications:publicNotifications_(),polls:publicPolls_(),shorts:publicShorts_(),activePoll:ap,activePollResults:ap?pollResults_(ap.id):{},pollResults:pollResults_('legacy')}}
function requestRecovery_(d){var phone=cleanPhone_(d.phone);if(!validPhone_(phone))throw new Error('Valid 10-digit mobile required');var cache=CacheService.getScriptCache(),key='recovery:'+phone;if(cache.get(key))return jsonOut_({success:true,message:'Recovery request already submitted. Please contact admin for verification.'});var sh=ensureSheets().getSheetByName('RecoveryRequests'),member=readMember_(phone),id=uuid_();sh.appendRow([id,new Date(),phone,member?member.memberId:'',member?member.name:'',member?member.division:'','Pending','','']);cache.put(key,'1',600);return jsonOut_({success:true,message:'Recovery request submitted. Admin verification ke baad temporary PIN diya jayega.'})}
function adminResolveRecovery_(d){requireAdmin_(d);var id=String(d.id||'').trim(),action=String(d.action||'').toLowerCase(),sh=ensureSheets().getSheetByName('RecoveryRequests'),last=sh.getLastRow();if(!id)throw new Error('Recovery request ID required');if(action==='approve'){var pin=String(d.newPin||'');if(!validPin_(pin))throw new Error('Temporary PIN must be 4 digits');for(var i=2;i<=last;i++){if(String(sh.getRange(i,1).getValue())===id){var phone=cleanPhone_(sh.getRange(i,3).getValue()),r=findMemberRow_(ensureSheets().getSheetByName('Responses'),phone);if(r<0)throw new Error('Member not found');ensureSheets().getSheetByName('Responses').getRange(r,12).setValue(hashPin_(pin));sh.getRange(i,7,1,3).setValues([['Approved','Temporary PIN issued',new Date()]]);return jsonOut_({success:true,message:'Temporary PIN set. Give this PIN to the verified member.',temporaryPin:pin})}}throw new Error('Recovery request not found')}if(action==='deny'){for(var j=2;j<=last;j++){if(String(sh.getRange(j,1).getValue())===id){sh.getRange(j,7,1,3).setValues([['Denied',limit_(d.note,500)||'Request denied',new Date()]]);return jsonOut_({success:true,message:'Recovery request denied'})}}throw new Error('Recovery request not found')}throw new Error('Invalid recovery action')}
function adminData_(){var a=aggregate_();a.success=true;a.admin=true;a.allMembers=rows_('Responses').map(function(x){return {timestamp:x.Timestamp,memberId:x.MemberID,name:x.Naam,phone:x.Phone,category:x.Category,vendor:x.Vendor,division:x.Division,joinYear:x.JoinYear,experience:x.Experience,salary:x.Salary,demands:x.Demands}});a.suggestions=rows_('Suggestions').slice(-200).reverse();a.allNews=rows_('News').reverse();a.allDemands=rows_('Demands').reverse();a.allDocuments=rows_('Documents').reverse();a.allMeetings=rows_('Meetings').reverse();a.allNotifications=rows_('Notifications').reverse();a.allPolls=rows_('Polls').reverse();a.recoveryRequests=rows_('RecoveryRequests').reverse();a.allVideos=rows_('VideoSubmissions').reverse();return jsonOut_(a)}
function doGet(e){try{var p=(e&&e.parameter)||{};if(String(p.health||'')==='1'){var ss=getDatabase_();return jsonOut_({success:true,backend:'online',spreadsheet:ss.getName(),spreadsheetId:ss.getId(),timestamp:new Date().toISOString()})}ensureSheets();maybeRefreshNews_();var a=aggregate_();if(p.resource==='news')return jsonOut_(a.news);if(p.resource==='demands')return jsonOut_(a.demands);if(p.resource==='documents')return jsonOut_(a.documents);if(p.resource==='meetings')return jsonOut_(a.meetings);if(p.resource==='notifications')return jsonOut_(a.notifications);if(p.resource==='polls')return jsonOut_({polls:a.polls,activePoll:a.activePoll,results:a.activePollResults});if(p.resource==='dashboard')return jsonOut_({count:a.count,todayCount:a.todayCount,divisionBreakdown:a.divisionBreakdown,updates:a.updates.length,news:a.news.length,demands:a.demands.length});return jsonOut_(a)}catch(err){return jsonOut_({success:false,error:String(err.message||err)})}}
/* LIVE NEWS ENGINE
   Sources: Google News RSS + optional YouTube Data API.
   AI: optional Gemini enrichment. API keys live only in Script Properties.
*/
var NEWS_QUERIES=[
  'labour workers India','worker protest strike India','contract workers India',
  'minimum wage workers India','PF ESI EPFO employees India','labour law court India',
  'employee protest India','salary wage workers India','government labour notification India',
  'Delhi worker protest strike','sanitation workers India','factory workers protest India'
];

function stripHtml_(s){return String(s||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim()}
function newsCategory_(title,desc){
  var s=(String(title)+' '+String(desc)).toLowerCase();
  if(/strike|हड़ताल|protest|प्रदर्शन|agitation|धरना|march|आंदोलन/.test(s))return 'विरोध/हड़ताल';
  if(/pf|epfo|esi|esic|social security|pension|बीमा|health insurance|चिकित्सा/.test(s))return 'PF/ESI';
  if(/wage|salary|pay|minimum wage|मजदूरी|वेतन|salary hike|increment|महंगाई भत्ता/.test(s))return 'वेतन/मज़दूरी';
  if(/labour law|labor law|court|tribunal|judgment|supreme court|high court|श्रम कानून|अदालत|कोर्ट/.test(s))return 'कानून/कोर्ट';
  if(/government|govt|ministry|notification|circular|श्रम मंत्रालय|सरकार|अधिसूचना/.test(s))return 'सरकारी अपडेट';
  if(/contract|contractual|outsourc|ठेका|संविदा|temporary|sanitation|textile|factory|worker|workers|श्रमिक/.test(s))return 'श्रमिक';
  if(/employee|कर्मचारी|staff|service condition/.test(s))return 'कर्मचारी समाचार';
  return 'अन्य';
}
function normalizeNewsTitle_(s){return String(s||'').toLowerCase().replace(/https?:\/\/\S+/g,'').replace(/[^a-z0-9\u0900-\u097f]+/g,'').slice(0,180)}
function newsExisting_(sh){
  var out={links:{},titles:{}},last=sh.getLastRow();
  if(last<2)return out;
  var vals=sh.getRange(2,1,last-1,Math.min(14,sh.getLastColumn())).getValues();
  vals.forEach(function(r){if(r[7])out.links[String(r[7])]=true;if(r[4])out.titles[normalizeNewsTitle_(r[4])]=true});
  return out;
}
function rssItems_(xml){
  var doc=XmlService.parse(xml),root=doc.getRootElement(),channel=root.getChild('channel');
  if(!channel)return [];
  return channel.getChildren('item').map(function(it){
    var source=it.getChild('source');
    return {
      headline:stripHtml_(it.getChildText('title')),
      url:String(it.getChildText('link')||'').trim(),
      date:new Date(it.getChildText('pubDate')||new Date()),
      description:stripHtml_(it.getChildText('description')),
      source:source?stripHtml_(source.getText()):'Google News',
      provider:'Google News RSS'
    };
  }).filter(function(x){return x.headline&&x.url});
}
function youtubeItems_(){
  var key=prop_('YOUTUBE_API_KEY');if(!key)return [];
  var qs=['worker protest India','labour strike India','contract workers India','PF ESI workers India','minimum wage India workers'];
  var reqs=qs.map(function(q){
    return {url:'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=date&maxResults=8&regionCode=IN&relevanceLanguage=hi&q='+encodeURIComponent(q)+'&key='+encodeURIComponent(key),method:'get',muteHttpExceptions:true};
  });
  var res=UrlFetchApp.fetchAll(reqs),out=[];
  res.forEach(function(r){
    if(r.getResponseCode()<200||r.getResponseCode()>=300)return;
    try{var d=JSON.parse(r.getContentText());(d.items||[]).forEach(function(v){
      var sn=v.snippet||{},id=v.id&&v.id.videoId;if(!id)return;
      out.push({headline:stripHtml_(sn.title),url:'https://www.youtube.com/watch?v='+id,date:new Date(sn.publishedAt||new Date()),description:stripHtml_(sn.description),source:stripHtml_(sn.channelTitle)||'YouTube',imageUrl:sn.thumbnails&&((sn.thumbnails.high||sn.thumbnails.medium||sn.thumbnails.default)||{}).url||'',videoUrl:'https://www.youtube.com/watch?v='+id,provider:'YouTube'});
    })}catch(e){}
  });
  return out;
}
function geminiEnrichNews_(items){
  var key=prop_('GEMINI_API_KEY');if(!key||!items.length)return [];
  var model=prop_('GEMINI_MODEL')||'gemini-3.6-flash';
  var payloadItems=items.map(function(x,i){return {i:i,title:x.headline,source:x.source,date:x.date.toISOString(),description:x.description||''}});
  var prompt='You are a neutral Hindi news editor. Based ONLY on the supplied metadata, return a JSON array with one object per item: i,category,summary,tags. Summary must be 1-2 factual Hindi sentences, clearly reported/attributed when a claim is unverified. Do not invent facts, numbers, quotes, motives or outcomes. Category must be exactly one of: विरोध/हड़ताल, श्रमिक, वेतन/मज़दूरी, PF/ESI, कानून/कोर्ट, सरकारी अपडेट, कर्मचारी समाचार, अन्य. tags must be a short comma-separated Hindi list. Input:\n'+JSON.stringify(payloadItems);
  try{
    var url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent';
    var res=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',headers:{'x-goog-api-key':key},payload:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',temperature:0.2,maxOutputTokens:4096}},),muteHttpExceptions:true});
    if(res.getResponseCode()<200||res.getResponseCode()>=300)return [];
    var d=JSON.parse(res.getContentText()),txt=d.candidates&&d.candidates[0]&&d.candidates[0].content&&d.candidates[0].content.parts&&d.candidates[0].content.parts[0]&&d.candidates[0].content.parts[0].text;
    if(!txt)return [];
    return JSON.parse(txt);
  }catch(e){return []}
}
function enrichNewsItems_(items){
  var ai=geminiEnrichNews_(items),by={};
  ai.forEach(function(x){if(x&&x.i!==undefined)by[Number(x.i)]=x});
  return items.map(function(x,i){
    var a=by[i]||{},cat=a.category||newsCategory_(x.headline,x.description);
    var summary=a.summary||x.description||('स्रोत: '+x.headline);
    return {headline:x.headline,url:x.url,date:x.date,source:x.source,description:x.description,imageUrl:x.imageUrl||'',videoUrl:x.videoUrl||'',provider:x.provider||'News',category:cat,aiSummary:a.summary||'',tags:a.tags||'' ,summary:summary};
  });
}
function syncNewsFromRSS(){
  var lock=LockService.getScriptLock();if(!lock.tryLock(3000))return {added:0,skipped:0};
  try{
    ensureSheets();
    var sh=ensureSheets().getSheetByName('News'),existing=newsExisting_(sh),feeds=NEWS_QUERIES.map(function(q){
      return {url:'https://news.google.com/rss/search?q='+encodeURIComponent(q)+'&hl=hi-IN&gl=IN&ceid=IN:hi',method:'get',muteHttpExceptions:true};
    });
    var results=UrlFetchApp.fetchAll(feeds),items=[];
    results.forEach(function(r){if(r.getResponseCode()>=200&&r.getResponseCode()<300){try{items=items.concat(rssItems_(r.getContentText()))}catch(e){}}});
    items=items.concat(youtubeItems_());
    var seen={},fresh=[];
    items.sort(function(a,b){return b.date-a.date}).forEach(function(x){
      var k=normalizeNewsTitle_(x.headline),link=x.url;
      if(!k||seen[k]||existing.links[link]||existing.titles[k])return;
      seen[k]=true;fresh.push(x);
    });
    fresh=fresh.slice(0,35);
    var enriched=enrichNewsItems_(fresh),now=new Date();
    enriched.forEach(function(x){
      sh.appendRow([uuid_(),now,x.date,x.category,x.headline,x.summary,x.source,x.url,x.imageUrl,true,x.videoUrl,x.aiSummary,x.tags,x.provider]);
    });
    PropertiesService.getScriptProperties().setProperty('NEWS_LAST_SYNC',new Date().toISOString());
    return {added:enriched.length,skipped:items.length-enriched.length,lastSync:new Date().toISOString()};
  }finally{lock.releaseLock()}
}
function maybeRefreshNews_(){
  var props=PropertiesService.getScriptProperties(),last=props.getProperty('NEWS_LAST_SYNC'),mins=Number(props.getProperty('NEWS_REFRESH_MINUTES')||15);
  if(last&&((Date.now()-new Date(last).getTime())<mins*60000))return;
  try{syncNewsFromRSS()}catch(e){Logger.log('News sync failed: '+e)}
}
function installNewsTrigger(){
  ScriptApp.getProjectTriggers().forEach(function(t){if(t.getHandlerFunction()==='syncNewsFromRSS')ScriptApp.deleteTrigger(t)});
  ScriptApp.newTrigger('syncNewsFromRSS').timeBased().everyHours(1).create();
  return 'News trigger installed';
}

