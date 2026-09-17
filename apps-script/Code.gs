/* MAZDOOR AWAAZ — DIGITAL EMPLOYEE PLATFORM V2
   Replace the deployed Apps Script Code.gs with this file after review.
   IMPORTANT: store ADMIN_KEY and ONESIGNAL_REST_API_KEY in Script Properties.
*/
var MEMBER_ID_PREFIX='AWAAZ-';
var RESP_HEADERS=['Timestamp','MemberID','Naam','Phone','Category','Vendor','Division','JoinYear','Experience','Salary','Demands','PinHash'];
var SHEETS={
  responses:'Responses',messages:'Messages',updates:'Updates',suggestions:'Suggestions',pollVotes:'PollVotes',
  news:'News',demands:'Demands',documents:'Documents',meetings:'Meetings',notifications:'Notifications',polls:'Polls',participation:'Participation'
};
var HEADERS={
  Responses:RESP_HEADERS,
  Messages:['Timestamp','Text','Anonymous'],
  Updates:['Timestamp','Title','Text','Tag','Published'],
  Suggestions:['Timestamp','Phone','Kind','Suggestion'],
  PollVotes:['Timestamp','Phone','Option','PollID'],
  News:['ID','CreatedAt','Date','Category','Headline','Summary','Source','Url','ImageUrl','Published'],
  Demands:['ID','CreatedAt','Title','Problem','Description','Status','EvidenceUrl','UpdatedAt'],
  Documents:['ID','CreatedAt','Title','Category','Description','Url','Date','Published'],
  Meetings:['ID','CreatedAt','DateTime','Title','Location','Mode','Purpose','Status'],
  Notifications:['ID','CreatedAt','Title','Message','Type','Url','Published'],
  Polls:['ID','CreatedAt','Question','OptionsJSON','Active','EndDate'],
  Participation:['Timestamp','Phone','MemberID','Action','ItemID']
};
function prop_(k){return PropertiesService.getScriptProperties().getProperty(k)||''}
function getAdminKey(){return prop_('ADMIN_KEY')}
function ensureSheet_(ss,name,headers){var sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);if(sh.getLastRow()===0){sh.getRange(1,1,1,headers.length).setValues([headers])}else{var current=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),headers.length)).getValues()[0];var changed=false;headers.forEach(function(h,i){if(!current[i]){sh.getRange(1,i+1).setValue(h);changed=true}})}return sh}
function ensureSheets(){var ss=SpreadsheetApp.getActiveSpreadsheet();Object.keys(HEADERS).forEach(function(n){ensureSheet_(ss,n,HEADERS[n])});return ss}
function cleanPhone_(p){return String(p||'').replace(/\D/g,'').slice(-10)}
function validPhone_(p){return /^\d{10}$/.test(cleanPhone_(p))}
function validPin_(p){return /^\d{4}$/.test(String(p||''))}
function hashPin_(pin){var bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(pin),Utilities.Charset.UTF_8);return bytes.map(function(b){var v=b<0?b+256:b;return ('0'+v.toString(16)).slice(-2)}).join('')}
function jsonOut_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
function truthy_(v){return v===true||String(v).toLowerCase()==='true'||String(v)==='1'||String(v).toLowerCase()==='yes'}
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
  if(type==='signature'||type==='saveProfile')return saveMember_(d);
  if(type==='claimPin')return claimPin_(d);
  if(type==='login')return login_(d);
  if(type==='profile')return jsonOut_({success:!!readMember_(d.phone,d.pin),member:readMember_(d.phone,d.pin)});
  if(type==='message'||type==='wall'){var m=String(d.text||d.message||'').trim();if(!m)throw new Error('Message required');ensureSheets().getSheetByName('Messages').appendRow([new Date(),m,!!d.anonymous]);return jsonOut_({success:true,message:'Employee Voice submitted'});}
  if(type==='suggestion'||type==='private'){requireMember_(d);ensureSheets().getSheetByName('Suggestions').appendRow([new Date(),cleanPhone_(d.phone),d.kind||'Suggestion',String(d.suggestion||d.text||'').trim()]);return jsonOut_({success:true,message:'Private submission received'});}
  if(type==='vote'||type==='poll')return vote_(d);
  if(type==='participation')return participation_(d);
  if(type==='getParticipation')return getParticipation_(d);
  if(type==='adminGet'){requireAdmin_(d);return adminData_()}
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
function saveMember_(d){var ss=ensureSheets(),sh=ss.getSheetByName('Responses'),phone=cleanPhone_(d.phone);if(!validPhone_(phone))throw new Error('Valid 10-digit mobile required');if(!validPin_(d.pin))throw new Error('PIN must be 4 digits');var r=findMemberRow_(sh,phone),memberId;if(r<0){memberId=MEMBER_ID_PREFIX+String(Math.max(1,sh.getLastRow())).padStart(4,'0');sh.appendRow([new Date(),memberId,String(d.name||'').trim(),phone,d.category||'',d.vendor||'',d.division||'',d.joinYear||'',d.experience||'',d.salary||'',d.demands||'',hashPin_(d.pin)]);return jsonOut_({success:true,message:'Registration successful',member:{memberId:memberId,name:d.name,phone:phone,division:d.division,category:d.category}})}var old=sh.getRange(r,1,1,RESP_HEADERS.length).getValues()[0];var vals=[old[0],old[1],d.name||old[2],phone,d.category||old[4],d.vendor||old[5],d.division||old[6],d.joinYear||old[7],d.experience||old[8],d.salary||old[9],d.demands||old[10],hashPin_(d.pin)];sh.getRange(r,1,1,RESP_HEADERS.length).setValues([vals]);return jsonOut_({success:true,message:'Profile updated',member:memberFromRow_(vals)})}
function claimPin_(d){var m=readMember_(d.phone);if(!m)return jsonOut_({success:false,message:'Member not found'});if(!validPin_(d.pin))return jsonOut_({success:false,message:'PIN must be 4 digits'});var sh=ensureSheets().getSheetByName('Responses'),r=findMemberRow_(sh,d.phone);sh.getRange(r,12).setValue(hashPin_(d.pin));return jsonOut_({success:true,message:'PIN updated'})}
function login_(d){var m=readMember_(d.phone,d.pin);return jsonOut_(m?{success:true,message:'Login successful',member:m}:{success:false,message:'Mobile or PIN incorrect'})}
function vote_(d){var m=requireMember_(d),pollId=d.pollId||'legacy',opt=String(d.option||'');var sh=ensureSheets().getSheetByName('PollVotes'),last=sh.getLastRow();if(last>=2){var rows=sh.getRange(2,1,last-1,4).getValues();for(var i=0;i<rows.length;i++)if(cleanPhone_(rows[i][1])===cleanPhone_(d.phone)&&String(rows[i][3]||'legacy')===String(pollId))return jsonOut_({success:false,message:'आप इस poll में पहले vote कर चुके हैं।'})}sh.appendRow([new Date(),cleanPhone_(d.phone),opt,pollId]);appendParticipation_(d.phone,m.memberId,'pollVote',pollId);return jsonOut_({success:true,message:'Vote submitted'})}
function participation_(d){var m=requireMember_(d);appendParticipation_(d.phone,m.memberId,d.action||'participation',d.itemId||'');return jsonOut_({success:true,message:'Participation saved'})}
function getParticipation_(d){var m=requireMember_(d),all=rows_('Participation').filter(function(x){return cleanPhone_(x.Phone)===cleanPhone_(d.phone)}).slice(-30).reverse();return jsonOut_({success:true,member:m,items:all})}
function adminSaveNews_(d){requireAdmin_(d);var id=upsert_('News',d.id,[d.id||'',new Date(),d.date||new Date(),d.category||'Employee News',d.headline||'',d.summary||'',d.source||'',d.url||'',d.imageUrl||'',truthy_(d.published)]);if(truthy_(d.notify))sendPushNotification_('नई News',d.headline||'नई खबर उपलब्ध है',d.url||'');return jsonOut_({success:true,message:'News saved',id:id})}
function adminSaveDemand_(d){requireAdmin_(d);var now=new Date(),id=upsert_('Demands',d.id,[d.id||'',d.createdAt||now,d.title||'',d.problem||'',d.description||'',d.status||'Discussion',d.evidenceUrl||'',now]);return jsonOut_({success:true,message:'Demand saved',id:id})}
function adminSaveDocument_(d){requireAdmin_(d);var id=upsert_('Documents',d.id,[d.id||'',new Date(),d.title||'',d.category||'',d.description||'',d.url||'',d.date||new Date(),truthy_(d.published)]);return jsonOut_({success:true,message:'Document saved',id:id})}
function adminSaveMeeting_(d){requireAdmin_(d);var id=upsert_('Meetings',d.id,[d.id||'',new Date(),d.dateTime||'',d.title||'',d.location||'',d.mode||'',d.purpose||'',d.status||'Scheduled']);return jsonOut_({success:true,message:'Meeting saved',id:id})}
function adminSavePoll_(d){requireAdmin_(d);var opts=Array.isArray(d.options)?d.options:String(d.options||'').split(/\r?\n/).filter(Boolean);var id=upsert_('Polls',d.id,[d.id||'',new Date(),d.question||'',JSON.stringify(opts),truthy_(d.active),d.endDate||'']);return jsonOut_({success:true,message:'Poll saved',id:id})}
function adminSaveNotification_(d){requireAdmin_(d);var id=upsert_('Notifications',d.id,[d.id||'',new Date(),d.title||'',d.message||'',d.type||'Update',d.url||'',truthy_(d.published)]);if(truthy_(d.push)&&truthy_(d.published))sendPushNotification_(d.title||'Update',d.message||'',d.url||'');return jsonOut_({success:true,message:'Notification saved',id:id})}
function adminSaveUpdate_(d){requireAdmin_(d);var sh=ensureSheets().getSheetByName('Updates');sh.appendRow([new Date(),d.title||'Campaign Update',d.text||'',d.tag||'',truthy_(d.published===undefined?true:d.published)]);if(truthy_(d.notify))sendPushNotification_(d.title||'Campaign Update',d.text||'',d.url||'');return jsonOut_({success:true,message:'Update published'})}
function adminDelete_(d,sheet){requireAdmin_(d);return jsonOut_({success:deleteById_(sheet,d.id),message:'Deleted'})}
function adminResetPin_(d){requireAdmin_(d);var phone=cleanPhone_(d.phone);if(!validPin_(d.newPin))throw new Error('PIN must be 4 digits');var sh=ensureSheets().getSheetByName('Responses'),r=findMemberRow_(sh,phone);if(r<0)throw new Error('Member not found');sh.getRange(r,12).setValue(hashPin_(d.newPin));return jsonOut_({success:true,message:'PIN reset'})}
function adminUpdateMember_(d){requireAdmin_(d);var sh=ensureSheets().getSheetByName('Responses'),r=findMemberRow_(sh,d.phone);if(r<0)throw new Error('Member not found');var old=sh.getRange(r,1,1,RESP_HEADERS.length).getValues()[0];['name','category','vendor','division','joinYear','experience','salary','demands'].forEach(function(k,idx){var col={name:3,category:5,vendor:6,division:7,joinYear:8,experience:9,salary:10,demands:11}[k];if(d[k]!==undefined)old[col-1]=d[k]});sh.getRange(r,1,1,RESP_HEADERS.length).setValues([old]);return jsonOut_({success:true,message:'Member updated'})}
function adminDeleteMember_(d){requireAdmin_(d);var sh=ensureSheets().getSheetByName('Responses'),r=findMemberRow_(sh,d.phone);if(r<0)throw new Error('Member not found');var ss=ensureSheets(),del=ss.getSheetByName('DeletedMembers')||ss.insertSheet('DeletedMembers');if(del.getLastRow()===0)del.appendRow(RESP_HEADERS.concat(['DeletedAt']));del.appendRow(sh.getRange(r,1,1,RESP_HEADERS.length).getValues()[0].concat([new Date()]));sh.deleteRow(r);return jsonOut_({success:true,message:'Member archived'})}
function adminDeleteUpdate_(d){requireAdmin_(d);var sh=ensureSheets().getSheetByName('Updates'),row=Number(d.row||0);if(row<2||row>sh.getLastRow())throw new Error('Invalid update row');sh.deleteRow(row);return jsonOut_({success:true,message:'Update deleted'})}
function activePoll_(){var p=rows_('Polls').filter(function(x){return truthy_(x.Active)}).sort(function(a,b){return new Date(b.CreatedAt)-new Date(a.CreatedAt)})[0];if(!p)return null;if(p.EndDate&&new Date(p.EndDate)<new Date())return null;return {id:p.ID,createdAt:p.CreatedAt,question:p.Question,options:JSON.parse(p.OptionsJSON||'[]'),active:true,endDate:p.EndDate}}
function pollResults_(pollId){var sh=ensureSheets().getSheetByName('PollVotes'),last=sh.getLastRow(),out={};if(last<2)return out;sh.getRange(2,1,last-1,4).getValues().forEach(function(r){if(String(r[3]||'legacy')===String(pollId))out[String(r[2])]=(out[String(r[2])]||0)+1});return out}
function publicNews_(){return sortDesc_(published_('News'),'Date').slice(0,50).map(function(x){return {id:x.ID,createdAt:x.CreatedAt,date:x.Date,category:x.Category,headline:x.Headline,summary:x.Summary,source:x.Source,url:x.Url,imageUrl:x.ImageUrl}})}
function publicDemands_(){return sortDesc_(rows_('Demands'),'UpdatedAt').map(function(x){return {id:x.ID,title:x.Title,problem:x.Problem,description:x.Description,status:x.Status,evidenceUrl:x.EvidenceUrl,updatedAt:x.UpdatedAt}})}
function publicDocs_(){return sortDesc_(published_('Documents'),'Date').map(function(x){return {id:x.ID,title:x.Title,category:x.Category,description:x.Description,url:x.Url,date:x.Date}})}
function publicMeetings_(){return rows_('Meetings').map(function(x){return {id:x.ID,dateTime:x.DateTime,title:x.Title,location:x.Location,mode:x.Mode,purpose:x.Purpose,status:x.Status}}).sort(function(a,b){return new Date(a.dateTime)-new Date(b.dateTime)})}
function publicNotifications_(){return sortDesc_(published_('Notifications'),'CreatedAt').slice(0,30).map(function(x){return {id:x.ID,createdAt:x.CreatedAt,title:x.Title,message:x.Message,type:x.Type,url:x.Url}})}
function publicPolls_(){return rows_('Polls').map(function(x){var active=truthy_(x.Active);return {id:x.ID,createdAt:x.CreatedAt,question:x.Question,options:JSON.parse(x.OptionsJSON||'[]'),active:active,endDate:x.EndDate}})}
function publicMessages_(){return rows_('Messages').slice(-50).reverse().map(function(x){return {timestamp:x.Timestamp,text:x.Text,anonymous:truthy_(x.Anonymous)}})}
function publicUpdates_(){return rows_('Updates').filter(function(x){return x.Published===''||truthy_(x.Published)}).slice(-50).reverse().map(function(x){return {timestamp:x.Timestamp,title:x.Title,text:x.Text,tag:x.Tag,published:truthy_(x.Published)}})}
function aggregate_(){var ss=ensureSheets(),resp=ss.getSheetByName('Responses'),last=resp.getLastRow(),count=Math.max(0,last-1),today=0,div={};if(count){var vals=resp.getRange(2,1,count,12).getValues(),todayKey=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');vals.forEach(function(r){if(r[0]&&Utilities.formatDate(new Date(r[0]),Session.getScriptTimeZone(),'yyyy-MM-dd')===todayKey)today++;var d=String(r[6]||'').trim()||'Unknown';div[d]=(div[d]||0)+1})}var divisionBreakdown=Object.keys(div).map(function(k){return {division:k,count:div[k]}}).sort(function(a,b){return b.count-a.count});var ap=activePoll_();return {count:count,todayCount:today,divisionBreakdown:divisionBreakdown,messages:publicMessages_(),updates:publicUpdates_(),news:publicNews_(),demands:publicDemands_(),documents:publicDocs_(),meetings:publicMeetings_(),notifications:publicNotifications_(),polls:publicPolls_(),activePoll:ap,activePollResults:ap?pollResults_(ap.id):{},pollResults:pollResults_('legacy')}}
function adminData_(){var a=aggregate_();a.admin=true;a.allMembers=rows_('Responses').map(function(x){return {timestamp:x.Timestamp,memberId:x.MemberID,name:x.Naam,phone:x.Phone,category:x.Category,vendor:x.Vendor,division:x.Division,joinYear:x.JoinYear,experience:x.Experience,salary:x.Salary,demands:x.Demands}});a.suggestions=rows_('Suggestions').slice(-200).reverse();a.allNews=rows_('News').reverse();a.allDemands=rows_('Demands').reverse();a.allDocuments=rows_('Documents').reverse();a.allMeetings=rows_('Meetings').reverse();a.allNotifications=rows_('Notifications').reverse();a.allPolls=rows_('Polls').reverse();return jsonOut_(a)}
function doGet(e){try{ensureSheets();var p=e.parameter||{};if(p.loginPhone){var m=readMember_(p.loginPhone,p.loginPin);return jsonOut_(m?{success:true,member:m}:{success:false,message:'Invalid login'})}if(p.resource){var a=aggregate_();if(p.resource==='news')return jsonOut_(a.news);if(p.resource==='demands')return jsonOut_(a.demands);if(p.resource==='documents')return jsonOut_(a.documents);if(p.resource==='meetings')return jsonOut_(a.meetings);if(p.resource==='notifications')return jsonOut_(a.notifications);if(p.resource==='polls')return jsonOut_({polls:a.polls,activePoll:a.activePoll,results:a.activePollResults});if(p.resource==='dashboard')return jsonOut_({count:a.count,todayCount:a.todayCount,divisionBreakdown:a.divisionBreakdown,updates:a.updates.length,news:a.news.length,demands:a.demands.length});}return jsonOut_(aggregate_())}catch(err){return jsonOut_({success:false,error:String(err.message||err)})}}
/* Optional daily RSS import. It creates UNPUBLISHED drafts for admin review.
   Create a time-driven Apps Script trigger for syncNewsFromRSS if desired. */
function syncNewsFromRSS(){ensureSheets();var feed='https://news.google.com/rss/search?q=labour+workers+India&hl=en-IN&gl=IN&ceid=IN:en',xml=UrlFetchApp.fetch(feed).getContentText(),doc=XmlService.parse(xml),root=doc.getRootElement(),channel=root.getChild('channel'),items=channel?channel.getChildren('item'):[];var sh=ensureSheets().getSheetByName('News');items.slice(0,20).forEach(function(it){var title=it.getChildText('title')||'',link=it.getChildText('link')||'',date=it.getChildText('pubDate')||new Date(),source=it.getChild('source');var src=source?source.getText():'Google News';var exists=false;if(sh.getLastRow()>1){var links=sh.getRange(2,8,sh.getLastRow()-1,1).getValues();exists=links.some(function(r){return String(r[0])===link})}if(!exists)sh.appendRow([uuid_(),new Date(),new Date(date),'Labour News',title,'Imported RSS item — verify before publishing',src,link,'',false])})}
