import {
  roundCurrency,
  formatCurrency,
  formatCurrencyWithSymbol,
  formatPercent,
  recalcGrandTotal,
  buildReportModel,
  computeGrandTotalsState,
  lineTotal
} from './calc.js';
import {
  saveBasket,
  loadBasket,
  backupCurrentQuote,
  restoreBackup,
  exportBasketToCsv,
  closeImportSummaryModal,
  handleImportInputChange
} from './storage.js';
import './ui.js';
import './catalogue.js';

window.DefCost = window.DefCost || {};
window.DefCost.state = window.DefCost.state || {};
window.DefCost.api = window.DefCost.api || {};

window.DefCost.api.restoreBackup = restoreBackup;
window.DefCost.api.closeImportSummaryModal = closeImportSummaryModal;
window.DefCost.api.formatCurrency = formatCurrency;
window.DefCost.api.formatCurrencyWithSymbol = formatCurrencyWithSymbol;
window.DefCost.api.saveBasket = saveBasket;
window.DefCost.api.lineTotal = lineTotal;

const catalogueNamespace = window.DefCost.catalogue || {};

const uiNamespace = window.DefCost.ui || {};
const showImportSummaryModal = typeof uiNamespace.showImportSummaryModal === 'function'
  ? uiNamespace.showImportSummaryModal
  : function () {};
const showToast = typeof uiNamespace.showToast === 'function'
  ? uiNamespace.showToast
  : function () {};

(function(){
function bindUiState(){
  var globalState = window.DefCost.state = window.DefCost.state || {};
  globalState.getBasket = function(){ return basket; };
  globalState.setBasket = function(next){ basket = Array.isArray(next)?next:[]; return basket; };
  globalState.getSections = function(){ return sections; };
  globalState.setSections = function(next){ sections = Array.isArray(next)?next:[]; return sections; };
  globalState.getActiveSectionId = function(){ return activeSectionId; };
  globalState.setActiveSectionId = function(next){ activeSectionId = next; return activeSectionId; };
  globalState.getCaptureParentId = function(){ return captureParentId; };
  globalState.setCaptureParentId = function(next){ captureParentId = next; return captureParentId; };
  globalState.incrementUid = function(){ uid += 1; return uid; };
  globalState.getUid = function(){ return uid; };
  globalState.getDiscountPercent = function(){ return discountPercent; };
  globalState.setDiscountPercent = function(next){ discountPercent = next; return discountPercent; };
  globalState.getCurrentGrandTotal = function(){ return currentGrandTotal; };
  globalState.setCurrentGrandTotal = function(next){ currentGrandTotal = next; return currentGrandTotal; };
  globalState.getLastBaseTotal = function(){ return lastBaseTotal; };
  globalState.setLastBaseTotal = function(next){ lastBaseTotal = next; return lastBaseTotal; };
  globalState.getGrandTotalsUi = function(){ return grandTotalsUi; };
  globalState.setGrandTotalsUi = function(next){ grandTotalsUi = next; return grandTotalsUi; };
  globalState.getLatestReport = function(){ return latestReport; };
  globalState.setLatestReport = function(next){ latestReport = next; return latestReport; };
  globalState.getSectionSeq = function(){ return sectionSeq; };
  globalState.setSectionSeq = function(next){ sectionSeq = next; return sectionSeq; };
  globalState.grandTotalsEl = grandTotalsEl;
  globalState.grandTotalsWrap = grandTotalsWrap;
  globalState.bBody = bBody;
  globalState.bFoot = bFoot;
  globalState.qbDockIcon = qbDockIcon;
  globalState.qbTitle = qbTitle;
  globalState.renderSectionTabs = renderSectionTabs;
  globalState.updateGrandTotals = updateGrandTotals;
  globalState.buildReportModel = buildReportModel;
  globalState.getSectionById = getSectionById;
  globalState.getSectionNameById = getSectionNameById;
  globalState.cascadeSectionToChildren = cascadeSectionToChildren;
  globalState.setParentSection = setParentSection;
  globalState.updateBasketHeaderOffset = updateBasketHeaderOffset;
  globalState.ensureSectionState = ensureSectionState;
  globalState.persistBasket = persistBasket;
  globalState.Sortable = window.Sortable;
}

var ORDER=[["bannister rail","cat-orange"],["stainless steel grabrail","cat-orange"],["aluminium grabrail, powder coated","cat-orange"],["shower parts","cat-blue"],["plumbing","cat-blue"],["door components","cat-brown"],["fire safety","cat-red"],["anti slip solutions","cat-yellow"],["uncategorised","cat-yellow"]];
var META=(function(){var o={};for(var i=0;i<ORDER.length;i++){o[ORDER[i][0]]={idx:i,cls:ORDER[i][1]};}return o;})();
var FALL=META["uncategorised"];
var PRICE_EX=["Rate Ex. GST","Price Ex. GST","Price","Price Ex Tax","Price ex GST"];
var UNDO_TOAST_MS=60000;
var wb=null,sheetCache={},basket=[],sections=getDefaultSections(),uid=0,sectionSeq=1,activeSectionId=sections[0].id,captureParentId=null;
var tabs=document.getElementById("sheetTabs"),container=document.getElementById("sheetContainer"),sectionTabsEl=document.getElementById("sectionTabs"),grandTotalsEl=document.getElementById("grandTotals"),grandTotalsWrap=document.querySelector('.grand-totals-wrapper');
var discountPercent=0,currentGrandTotal=0,lastBaseTotal=0,grandTotalsUi=null,latestReport=null;
var qbWindow=document.getElementById('catalogWindow'),qbTitlebar=document.getElementById('catalogTitlebar'),qbDockIcon=document.getElementById('catalogDockIcon'),qbMin=document.getElementById('catalogMin'),qbClose=document.getElementById('catalogClose'),qbZoom=document.getElementById('catalogZoom'),qbResizeHandle=document.getElementById('catalogResizeHandle');
var addSectionBtn=document.getElementById("addSectionBtn"),importBtn=document.getElementById('importCsvBtn'),importInput=document.getElementById('importCsvInput'),qbTitle=document.getElementById('qbTitle'),clearQuoteBtn=document.getElementById('clearQuoteBtn');
if(catalogueNamespace&&typeof catalogueNamespace.restoreState==='function'){catalogueNamespace.restoreState({element:qbWindow,dockIcon:qbDockIcon});}
var qbState=window.DefCost.state.catalogue||{};
if(typeof qbState.isOpen==='undefined')qbState.isOpen=true;
qbState.full=!!qbState.full;
qbState.docked=!!qbState.docked;
if(!isFinite(qbState.dockHeight))qbState.dockHeight=getDefaultDockHeight();
if(qbState.scope!=='all')qbState.scope='current';
var lastFreeRect=cloneRect(qbState);
if(!lastFreeRect.w||!lastFreeRect.h){lastFreeRect=cloneRect(defaultUiState());}
var dragInfo=null,resizeInfo=null,prevUserSelect='';
var currentSearchInput=null;
var MAX_RESULTS=500;

function persistBasket(){
  var payload={basket:basket,sections:sections,activeSectionId:activeSectionId,discountPercent:discountPercent};
  var api=window.DefCost&&window.DefCost.api?window.DefCost.api:{};
  if(api&&typeof api.saveBasket==='function'){
    api.saveBasket(payload);
    return;
  }
  saveBasket(payload);
}

function persistBackup(){
  backupCurrentQuote({basket:basket,sections:sections,activeSectionId:activeSectionId,discountPercent:discountPercent});
}

function normalizeSectionName(value){
  return value==null?'':String(value).toLowerCase().trim();
}

function exportQuoteToCsv(opts){
  return exportBasketToCsv({
    basket:basket,
    sections:sections,
    discountPercent:discountPercent,
    showToast:showToast,
    silent:opts&&opts.silent
  });
}
applyQBState(true);
ensureWindowWithinViewport(true);
renderSectionTabs();
 if(qbTitlebar){qbTitlebar.addEventListener('mousedown',startDrag);qbTitlebar.addEventListener('touchstart',startDrag,{passive:false});}
 if(qbMin){qbMin.addEventListener('click',toggleDock);}
 if(qbDockIcon){qbDockIcon.addEventListener('click',restoreFromDock);}
 if(qbClose){qbClose.addEventListener('click',function(){setMinimized(true);});}
 if(qbZoom){qbZoom.addEventListener('click',toggleFull);}
 if(qbResizeHandle){qbResizeHandle.addEventListener('mousedown',startResize);qbResizeHandle.addEventListener('touchstart',startResize,{passive:false});}
if(clearQuoteBtn){clearQuoteBtn.addEventListener('click',showDeleteDialog);}
window.addEventListener('resize',function(){ensureWindowWithinViewport();});
document.addEventListener('keydown',function(ev){
   var key=ev.key||'';
   var lowerKey=typeof key==='string'?key.toLowerCase():'';
   if((ev.metaKey||ev.ctrlKey)&&!ev.altKey&&!ev.shiftKey){
     if(lowerKey==='k'){
       ev.preventDefault();
       if(!qbState||qbState.isOpen===false){
         setMinimized(false);
       }else{
         setMinimized(true);
       }
       return;
     }
     if(lowerKey==='f'){
       ev.preventDefault();
       focusSearchField();
       return;
     }
   }
   if(key==='Escape'||key==='Esc'){
     if(qbState.full){toggleFull();}else if(qbState.isOpen!==false){setMinimized(true);}
   }
 });
function active(n){if(!tabs)return;var kids=tabs.children;for(var i=0;i<kids.length;i++){var b=kids[i];b.classList.toggle('active',b.dataset&&b.dataset.sheet===n);}}
function hydrateFromStorage(){
  var stored=loadBasket();
  if(stored){
    if(Array.isArray(stored.basket)){
      basket=stored.basket;
    }
    if(Array.isArray(stored.sections)&&stored.sections.length){
      sections=stored.sections;
    }
    if(stored.activeSectionId){
      activeSectionId=stored.activeSectionId;
    }
    if(typeof stored.discountPercent!=='undefined'&&isFinite(stored.discountPercent)){
      discountPercent=+stored.discountPercent;
    }
  }
  currentGrandTotal=0;
  lastBaseTotal=0;
  ensureSectionState();
  normalizeBasketItems();
  window.DefCost.ui.renderBasket();
}

function restoreQuoteFromBackup(){
  if(window.DefCost&&window.DefCost.api&&typeof window.DefCost.api.closeImportSummaryModal==='function'){
    window.DefCost.api.closeImportSummaryModal();
  }else{
    closeImportSummaryModal();
  }
  var result=restoreBackup();
  if(!result||!result.success){
    var errorMessage=result&&result.error?result.error:'Unable to restore backup';
    showToast(errorMessage);
    return;
  }
  var data=result.data||{};
  basket=Array.isArray(data.basket)?data.basket:[];
  sections=Array.isArray(data.sections)&&data.sections.length?data.sections:getDefaultSections();
  activeSectionId=data.activeSectionId;
  if(!sections.some(function(sec){return sec.id===activeSectionId;})){
    activeSectionId=sections[0]?sections[0].id:1;
  }
  discountPercent=isFinite(data.discountPercent)?+data.discountPercent:0;
  captureParentId=null;
  currentGrandTotal=0;
  lastBaseTotal=0;
  normalizeBasketItems();
  ensureSectionState();
  window.DefCost.ui.renderBasket();
  showToast('Quote restored from backup');
}
function showIssuesModal(title,messages){
  if(!Array.isArray(messages)||!messages.length) return;
  var existing=document.querySelector('.import-error-modal');
  if(existing&&existing.parentNode){
    existing.parentNode.removeChild(existing);
  }
  var overlay=document.createElement('div');
  overlay.className='qb-modal-backdrop import-error-modal';
  var modal=document.createElement('div');
  modal.className='qb-modal';
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  var heading=document.createElement('h4');
  heading.textContent=title||'Import failed';
  var intro=document.createElement('p');
  intro.textContent='Resolve the following issues and try again:';
  var list=document.createElement('ul');
  for(var i=0;i<messages.length&&i<5;i++){
    var li=document.createElement('li');
    li.textContent=messages[i];
    list.appendChild(li);
  }
  var buttons=document.createElement('div');
  buttons.className='qb-modal-buttons';
  var closeBtn=document.createElement('button');
  closeBtn.type='button';
  closeBtn.textContent='Close';
  closeBtn.classList.add('neutral');
  buttons.appendChild(closeBtn);
  modal.appendChild(heading);
  modal.appendChild(intro);
  modal.appendChild(list);
  modal.appendChild(buttons);
  overlay.appendChild(modal);
  function close(){
    document.removeEventListener('keydown',handleKey,true);
    if(overlay&&overlay.parentNode){
      overlay.parentNode.removeChild(overlay);
    }
  }
  function handleKey(ev){
    if(ev.key==='Escape'||ev.key==='Esc'){
      ev.preventDefault();
      close();
    }
  }
  document.addEventListener('keydown',handleKey,true);
  overlay.addEventListener('click',function(ev){
    if(ev.target===overlay){
      close();
    }
  });
  closeBtn.addEventListener('click',close);
  document.body.appendChild(overlay);
  setTimeout(function(){
    try{closeBtn.focus();}catch(e){}
  },0);
}
function applyImportedModel(model){
  if(!model||!Array.isArray(model.sections)||!model.sections.length){
    showIssuesModal('Import failed',['No section data found in CSV']);
    return;
  }
  var parsedSections=model.sections;
  var newSections=[];
  var newBasket=[];
  var newSectionId=0;
  var newUid=0;
  var parentCount=0;
  var childCount=0;
  var notesCount=0;
  for(var i=0;i<parsedSections.length;i++){
    var src=parsedSections[i];
    newSectionId++;
    var secId=newSectionId;
    var sectionNotes=typeof src.notes==='string'?src.notes:'';
    if(sectionNotes&&sectionNotes.trim()){notesCount++;}
    newSections.push({id:secId,name:src.title||('Section '+secId),notes:sectionNotes});
    var items=Array.isArray(src.items)?src.items:[];
    for(var j=0;j<items.length;j++){
      var item=items[j];
      newUid++;
      var parentId=newUid;
      newBasket.push({id:parentId,pid:null,kind:'line',collapsed:false,sectionId:secId,item:item&&item.name?item.name:'',qty:isFinite(item&&item.qty)?item.qty:0,ex:isFinite(item&&item.price)?item.price:0});
      parentCount++;
      var children=Array.isArray(item&&item.children)?item.children:[];
      childCount+=children.length;
      for(var k=0;k<children.length;k++){
        var child=children[k];
        newUid++;
        newBasket.push({id:newUid,pid:parentId,kind:'sub',sectionId:secId,item:child&&child.name?child.name:'',qty:isFinite(child&&child.qty)?child.qty:0,ex:isFinite(child&&child.price)?child.price:0});
      }
    }
  }
  var summaryData={sections:newSections.length,parents:parentCount,children:childCount,notes:notesCount,totalEx:0};
  basket=newBasket;
  sections=newSections;
  sectionSeq=newSectionId;
  uid=newUid;
  activeSectionId=newSections[0]?newSections[0].id:1;
  captureParentId=null;
  discountPercent=isFinite(model.discount)?model.discount:0;
  currentGrandTotal=0;
  lastBaseTotal=0;
  normalizeBasketItems();
  ensureSectionState();
  window.DefCost.ui.renderBasket();
  if(latestReport&&isFinite(latestReport.grandEx)){
    summaryData.totalEx=latestReport.grandEx;
  }else{
    var fallbackReport=buildReportModel(basket,sections);
    summaryData.totalEx=fallbackReport&&isFinite(fallbackReport.grandEx)?fallbackReport.grandEx:0;
  }
  showImportSummaryModal(summaryData,{onUndo:restoreQuoteFromBackup});
  showToast('✅ Quote imported. Undo?',{onClick:restoreQuoteFromBackup,duration:UNDO_TOAST_MS});
}
function cloneRect(state){if(!state||typeof state!=='object')return{x:0,y:0,w:0,h:0,dockHeight:0};return{x:isFinite(state.x)?+state.x:0,y:isFinite(state.y)?+state.y:0,w:isFinite(state.w)?+state.w:0,h:isFinite(state.h)?+state.h:0,dockHeight:isFinite(state.dockHeight)?+state.dockHeight:0};}
function getDefaultDockHeight(){var winH=window.innerHeight||800;var minDock=240;var base=Math.round((winH||800)*0.35)||minDock;if(!isFinite(base)||base<=0)base=320;var maxDock=Math.max(minDock,winH-96);if(!isFinite(maxDock)||maxDock<minDock)maxDock=Math.max(minDock,480);return Math.min(Math.max(minDock,base),maxDock);}
function defaultUiState(){var winW=window.innerWidth||1200;var winH=window.innerHeight||800;var width=Math.min(1100,Math.max(360,Math.round((winW||0)*0.9)||600));if(!isFinite(width)||width<=0)width=800;if(width>winW&&winW>0)width=winW;var height=Math.round((winH||0)*0.65)||520;height=Math.min(height,Math.round((winH||0)*0.8)||height);if(!isFinite(height)||height<=0)height=Math.min(winH||600,600);if(height>winH&&winH>0)height=winH;var maxX=Math.max(0,(winW||width)-width-32);var y=Math.min(64,Math.max(0,(winH||height)-height));return{x:maxX,y:y,w:width,h:height,isOpen:true,full:false,docked:false,dockHeight:getDefaultDockHeight()};}


function rememberCurrentRect(){if(qbState&&(qbState.full||qbState.docked))return;lastFreeRect=cloneRect(qbState);}
function assignRect(rect){if(!rect)return;if(isFinite(rect.x))qbState.x=rect.x;if(isFinite(rect.y))qbState.y=rect.y;if(isFinite(rect.w)&&rect.w>0)qbState.w=rect.w;if(isFinite(rect.h)&&rect.h>0)qbState.h=rect.h;}
function applyQBState(skipSave){if(!qbWindow)return;var isOpen=qbState.isOpen!==false;var full=!!qbState.full;var docked=!!qbState.docked&&!full;var winH=window.innerHeight||800;
  qbWindow.classList.toggle('qb-full',full);
  qbWindow.classList.toggle('qb-docked',docked);
  qbWindow.classList.toggle('qb-floating',!full&&!docked);
  if(full){qbWindow.style.top='';qbWindow.style.left='';qbWindow.style.right='';qbWindow.style.bottom='';qbWindow.style.width='';qbWindow.style.height='';}
  else if(docked){var minDock=240;var dockMax=Math.max(minDock,winH-96);var dockHeight=isFinite(qbState.dockHeight)?qbState.dockHeight:getDefaultDockHeight();dockHeight=Math.min(Math.max(minDock,dockHeight),dockMax);qbState.dockHeight=dockHeight;qbWindow.style.top='auto';qbWindow.style.left='16px';qbWindow.style.right='16px';qbWindow.style.bottom='16px';qbWindow.style.width='auto';qbWindow.style.height=dockHeight+'px';}
  else{qbWindow.style.width=qbState.w?qbState.w+'px':'';qbWindow.style.height=qbState.h?qbState.h+'px':'';qbWindow.style.top=(isFinite(qbState.y)?qbState.y:0)+'px';qbWindow.style.left=(isFinite(qbState.x)?qbState.x:0)+'px';qbWindow.style.right='auto';qbWindow.style.bottom='auto';}
  if(catalogueNamespace&&typeof catalogueNamespace[isOpen?'open':'close']==='function'){if(isOpen){catalogueNamespace.open({element:qbWindow,dockIcon:qbDockIcon,skipSave:true,skipPosition:full||docked});}else{catalogueNamespace.close({element:qbWindow,dockIcon:qbDockIcon,skipSave:true});}}
  if(!skipSave&&catalogueNamespace&&typeof catalogueNamespace.persistState==='function'){catalogueNamespace.persistState();}}
function ensureWindowWithinViewport(skipSave){if(!qbWindow)return;if(qbState.docked){applyQBState(true);if(!skipSave&&catalogueNamespace&&typeof catalogueNamespace.persistState==='function'){catalogueNamespace.persistState();}return;}if(qbState.full||qbState.isOpen===false)return;var winW=window.innerWidth||qbState.w||800;var winH=window.innerHeight||qbState.h||600;qbState.w=Math.min(Math.max(320,qbState.w||320),winW);qbState.h=Math.min(Math.max(280,qbState.h||280),winH);var maxX=Math.max(0,winW-qbState.w);var maxY=Math.max(0,winH-qbState.h);if(qbState.x>maxX)qbState.x=maxX;if(qbState.y>maxY)qbState.y=maxY;applyQBState(true);if(!skipSave&&catalogueNamespace&&typeof catalogueNamespace.persistState==='function'){catalogueNamespace.persistState();}}

function setMinimized(minimize){if(minimize){if(qbState.full){qbState.full=false;if(lastFreeRect&&lastFreeRect.w){assignRect(lastFreeRect);} }
    else if(!qbState.docked){rememberCurrentRect();}
    qbState.isOpen=false;
  }else{qbState.isOpen=true;}
  applyQBState();
  if(!minimize){focusSearchFieldSoon();}}
function focusSearchField(){if(qbState&&qbState.isOpen===false){setMinimized(false);}if(currentSearchInput&&document.body.contains(currentSearchInput)){try{currentSearchInput.focus({preventScroll:true});}catch(e){currentSearchInput.focus();}currentSearchInput.select();}}
function focusSearchFieldSoon(){setTimeout(function(){focusSearchField();},30);}
function restoreFromDock(){setMinimized(false);}
function toggleDock(){if(qbState.docked){qbState.docked=false;if(lastFreeRect&&lastFreeRect.w){assignRect(lastFreeRect);}else{assignRect(defaultUiState());}qbState.isOpen=true;ensureWindowWithinViewport(true);applyQBState();if(catalogueNamespace&&typeof catalogueNamespace.persistState==='function'){catalogueNamespace.persistState();}return;}rememberCurrentRect();qbState.docked=true;qbState.full=false;qbState.isOpen=true;if(!isFinite(qbState.dockHeight)||qbState.dockHeight<=0){qbState.dockHeight=getDefaultDockHeight();}applyQBState();if(catalogueNamespace&&typeof catalogueNamespace.persistState==='function'){catalogueNamespace.persistState();}}
function toggleFull(){if(qbState.full){qbState.full=false;if(lastFreeRect&&lastFreeRect.w){assignRect(lastFreeRect);}applyQBState();if(catalogueNamespace&&typeof catalogueNamespace.persistState==='function'){catalogueNamespace.persistState();}return;}rememberCurrentRect();qbState.full=true;qbState.docked=false;qbState.isOpen=true;applyQBState();if(catalogueNamespace&&typeof catalogueNamespace.persistState==='function'){catalogueNamespace.persistState();}}
function getPointerCoords(ev){if(ev.touches&&ev.touches.length){return{clientX:ev.touches[0].clientX,clientY:ev.touches[0].clientY};}if(ev.changedTouches&&ev.changedTouches.length){return{clientX:ev.changedTouches[0].clientX,clientY:ev.changedTouches[0].clientY};}return{clientX:ev.clientX,clientY:ev.clientY};}
function isDragHandleTarget(target){if(!target)return true;var node=target;if(node.closest){if(node.closest('#catalogDots'))return false;}while(node&&node!==qbTitlebar){var tag=node.tagName;if(tag&&(tag==='BUTTON'||tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||tag==='LABEL'))return false;node=node.parentNode;}return true;}
function startDrag(ev){if(!qbWindow||qbState.full||qbState.isOpen===false||qbState.docked)return;var target=ev.target||ev.srcElement;if(!isDragHandleTarget(target))return;var coords=getPointerCoords(ev);if(typeof coords.clientX==='undefined')return;if(ev.cancelable)ev.preventDefault();rememberCurrentRect();var rect=qbWindow.getBoundingClientRect();dragInfo={offsetX:coords.clientX-rect.left,offsetY:coords.clientY-rect.top,width:rect.width,height:rect.height};prevUserSelect=document.body.style.userSelect;document.body.style.userSelect='none';document.addEventListener('mousemove',handleDragMove);document.addEventListener('mouseup',endDrag);document.addEventListener('touchmove',handleDragMove,{passive:false});document.addEventListener('touchend',endDrag);document.addEventListener('touchcancel',endDrag);}
function handleDragMove(ev){if(!dragInfo)return;var coords=getPointerCoords(ev);if(typeof coords.clientX==='undefined')return;if(ev.cancelable)ev.preventDefault();var winW=window.innerWidth||dragInfo.width||800;var winH=window.innerHeight||dragInfo.height||600;var width=Math.min(Math.max(320,dragInfo.width||320),winW);var height=Math.min(Math.max(280,dragInfo.height||280),winH);var x=coords.clientX-dragInfo.offsetX;var y=coords.clientY-dragInfo.offsetY;var maxX=Math.max(0,winW-width);var maxY=Math.max(0,winH-height);if(x<0)x=0;if(y<0)y=0;if(x>maxX)x=maxX;if(y>maxY)y=maxY;qbWindow.classList.remove('qb-full');qbWindow.classList.add('qb-floating');qbState.full=false;qbState.isOpen=true;qbState.docked=false;qbState.x=x;qbState.y=y;qbState.w=width;qbState.h=height;qbWindow.style.left=x+'px';qbWindow.style.top=y+'px';qbWindow.style.right='auto';qbWindow.style.bottom='auto';qbWindow.style.display='flex';}
function endDrag(){if(!dragInfo)return;document.body.style.userSelect=prevUserSelect||'';document.removeEventListener('mousemove',handleDragMove);document.removeEventListener('mouseup',endDrag);document.removeEventListener('touchmove',handleDragMove);document.removeEventListener('touchend',endDrag);document.removeEventListener('touchcancel',endDrag);dragInfo=null;if(catalogueNamespace&&typeof catalogueNamespace.persistState==='function'){catalogueNamespace.persistState();}rememberCurrentRect();}
function startResize(ev){if(!qbWindow||qbState.full||qbState.isOpen===false||qbState.docked)return;var coords=getPointerCoords(ev);if(typeof coords.clientX==='undefined')return;if(ev.cancelable)ev.preventDefault();rememberCurrentRect();resizeInfo={startX:coords.clientX,startY:coords.clientY,startW:qbState.w||qbWindow.offsetWidth,startH:qbState.h||qbWindow.offsetHeight};qbState.full=false;qbState.isOpen=true;qbState.docked=false;prevUserSelect=document.body.style.userSelect;document.body.style.userSelect='none';document.addEventListener('mousemove',handleResizeMove);document.addEventListener('mouseup',endResize);document.addEventListener('touchmove',handleResizeMove,{passive:false});document.addEventListener('touchend',endResize);document.addEventListener('touchcancel',endResize);}
function handleResizeMove(ev){if(!resizeInfo)return;var coords=getPointerCoords(ev);if(typeof coords.clientX==='undefined')return;if(ev.cancelable)ev.preventDefault();var winW=window.innerWidth||resizeInfo.startW||800;var winH=window.innerHeight||resizeInfo.startH||600;var deltaX=coords.clientX-resizeInfo.startX;var deltaY=coords.clientY-resizeInfo.startY;var minW=320;var minH=280;var maxW=winW-(isFinite(qbState.x)?qbState.x:0);var maxH=winH-(isFinite(qbState.y)?qbState.y:0);if(!isFinite(maxW)||maxW<minW)maxW=winW;if(!isFinite(maxH)||maxH<minH)maxH=winH;var newW=(resizeInfo.startW||minW)+deltaX;var newH=(resizeInfo.startH||minH)+deltaY;if(newW<minW)newW=minW;if(newH<minH)newH=minH;if(newW>maxW)newW=maxW;if(newH>maxH)newH=maxH;qbState.w=newW;qbState.h=newH;qbWindow.classList.add('qb-floating');qbWindow.classList.remove('qb-full');qbWindow.style.width=newW+'px';qbWindow.style.height=newH+'px';applyQBState(true);}
function endResize(){if(!resizeInfo)return;document.body.style.userSelect=prevUserSelect||'';document.removeEventListener('mousemove',handleResizeMove);document.removeEventListener('mouseup',endResize);document.removeEventListener('touchmove',handleResizeMove);document.removeEventListener('touchend',endResize);document.removeEventListener('touchcancel',endResize);resizeInfo=null;ensureWindowWithinViewport(true);if(catalogueNamespace&&typeof catalogueNamespace.persistState==='function'){catalogueNamespace.persistState();}rememberCurrentRect();}
function escapeHtml(s){s=String(s==null?'':s);return s.replace(/[&<>"']/g,function(m){switch(m){case'&':return'&amp;';case'<':return'&lt;';case'>':return'&gt;';case'"':return'&quot;';default:return'&#39;';}});}
function getDefaultSections(){return [{id:1,name:'Section 1',notes:''}];}
function ensureSectionState(){
  if(!Array.isArray(sections)||!sections.length){
    sections=getDefaultSections();
  }
  var seen={};
  sectionSeq=0;
  for(var i=0;i<sections.length;i++){
    var sec=sections[i];
    if(!sec||typeof sec!=='object'){
      sections.splice(i,1);i--;continue;
    }
    var sid=parseInt(sec.id,10);
    if(!isFinite(sid)||sid<=0||seen[sid]){
      sid=sectionSeq+1;
      sec.id=sid;
    }
    seen[sid]=true;
    if(sid>sectionSeq) sectionSeq=sid;
    if(typeof sec.name!=='string'||!sec.name.trim()){
      sec.name='Section '+sid;
    }else{
      sec.name=sec.name.trim();
    }
    if(typeof sec.notes!=='string'){
      sec.notes='';
    }
  }
  if(!sections.length){
    sections=getDefaultSections();
    sectionSeq=sections[0].id;
  }
  if(sectionSeq<=0){sectionSeq=sections[sections.length-1].id||1;}
  if(typeof activeSectionId==='undefined'||!sections.some(function(sec){return sec.id===activeSectionId;})){
    activeSectionId=sections[0].id;
  }
}
function normalizeBasketItems(){
  uid=0;
  var fallback=sections[0]?sections[0].id:1;
  var parentsById={};
  for(var i=0;i<basket.length;i++){
    var item=basket[i];
    if(!item||typeof item!=='object') continue;
    var iid=+item.id||0;
    if(iid>uid) uid=iid;
    if(!item.pid){
      if(!sections.some(function(sec){return sec.id===item.sectionId;})){
        item.sectionId=fallback;
      }
      if(typeof item.qty==='undefined'||!isFinite(item.qty)){item.qty=1;}
      else if(item.qty<0){item.qty=0;}
      if(typeof item.kind==='undefined') item.kind='line';
      if(typeof item.collapsed==='undefined') item.collapsed=false;
      parentsById[item.id]=item;
    }
  }
  for(var j=0;j<basket.length;j++){
    var child=basket[j];
    if(!child||typeof child!=='object') continue;
    if(child.pid){
      if(typeof child.qty==='undefined'||!isFinite(child.qty)){child.qty=1;}
      else if(child.qty<0){child.qty=0;}
      var parent=parentsById[child.pid];
      if(parent){
        child.sectionId=parent.sectionId;
      }else if(!sections.some(function(sec){return sec.id===child.sectionId;})){
        child.sectionId=fallback;
      }
    }else if(typeof child.qty==='undefined'||!isFinite(child.qty)){
      child.qty=1;
    }else if(child.qty<0){
      child.qty=0;
    }
  }
}
function ensureGrandTotalsUi(){if(!grandTotalsEl||grandTotalsUi)return;if(!grandTotalsEl)return;grandTotalsEl.innerHTML='<table class="grand-totals-table" aria-label="Quote totals"><tbody><tr><th scope="row">Total</th><td class="totals-value" data-role="total-value">0.00</td></tr><tr><th scope="row">Discount (%)</th><td><div class="grand-totals-input"><input type="number" step="0.01" inputmode="decimal" aria-label="Discount percentage" data-role="discount-input"><span>%</span></div></td></tr><tr><th scope="row">Grand Total</th><td><div class="grand-totals-input"><input type="number" min="0" step="0.01" inputmode="decimal" aria-label="Grand total after discount" data-role="grand-total-input"></div></td></tr><tr><th scope="row">GST (10%)</th><td class="totals-value" data-role="gst-value">0.00</td></tr><tr><th scope="row">Grand Total (Incl. GST)</th><td class="totals-value" data-role="grand-incl-value">0.00</td></tr></tbody></table>';
  var discountInput=grandTotalsEl.querySelector('[data-role="discount-input"]');
  var grandTotalInput=grandTotalsEl.querySelector('[data-role="grand-total-input"]');
  grandTotalsUi={container:grandTotalsEl,totalValue:grandTotalsEl.querySelector('[data-role="total-value"]'),discountInput:discountInput,grandTotalInput:grandTotalInput,gstValue:grandTotalsEl.querySelector('[data-role="gst-value"]'),grandInclValue:grandTotalsEl.querySelector('[data-role="grand-incl-value"]')};
  if(discountInput){discountInput.addEventListener('input',handleDiscountChange);}
  if(grandTotalInput){grandTotalInput.addEventListener('input',handleGrandTotalChange);}
}
function handleDiscountChange(){if(!grandTotalsUi)return;var base=latestReport&&isFinite(latestReport.grandEx)?latestReport.grandEx:0;var raw=parseFloat(grandTotalsUi.discountInput.value);if(!isFinite(raw))raw=0;discountPercent=raw;currentGrandTotal=recalcGrandTotal(base,discountPercent);lastBaseTotal=base;updateGrandTotals(latestReport,{preserveGrandTotal:true});persistBasket();}
function handleGrandTotalChange(){if(!grandTotalsUi)return;var base=latestReport&&isFinite(latestReport.grandEx)?latestReport.grandEx:0;var raw=parseFloat(grandTotalsUi.grandTotalInput.value);if(!isFinite(raw))raw=0;raw=Math.max(0,raw);currentGrandTotal=roundCurrency(raw);if(base>0){discountPercent=(1-currentGrandTotal/(base||1))*100;}else{discountPercent=0;}lastBaseTotal=base;updateGrandTotals(latestReport,{preserveGrandTotal:true});persistBasket();}
function updateGrandTotals(report,opts){
  latestReport=report||null;
  if(!grandTotalsEl)return;
  ensureGrandTotalsUi();
  if(!grandTotalsUi)return;
  var state=computeGrandTotalsState({
    report:report,
    basketCount:basket?basket.length:0,
    discountPercent:discountPercent,
    currentGrandTotal:currentGrandTotal,
    lastBaseTotal:lastBaseTotal,
    preserveGrandTotal:!!(opts&&opts.preserveGrandTotal)
  });
  if(!state.hasItems){
    if(grandTotalsWrap) grandTotalsWrap.style.display='none';
    grandTotalsEl.style.display='none';
    if(grandTotalsUi.totalValue)grandTotalsUi.totalValue.textContent=formatCurrency(0);
    if(grandTotalsUi.gstValue)grandTotalsUi.gstValue.textContent=formatCurrency(0);
    if(grandTotalsUi.grandInclValue)grandTotalsUi.grandInclValue.textContent=formatCurrency(0);
    if(grandTotalsUi.discountInput){
      grandTotalsUi.discountInput.disabled=true;
      if(document.activeElement!==grandTotalsUi.discountInput){
        grandTotalsUi.discountInput.value=formatPercent(discountPercent);
      }else{
        grandTotalsUi.discountInput.blur();
      }
    }
    if(grandTotalsUi.grandTotalInput){
      grandTotalsUi.grandTotalInput.disabled=true;
      grandTotalsUi.grandTotalInput.value=formatCurrency(0);
    }
    return;
  }
  if(grandTotalsWrap) grandTotalsWrap.style.display='flex';
  grandTotalsEl.style.display='block';
  currentGrandTotal=state.currentGrandTotal;
  lastBaseTotal=state.lastBaseTotal;
  var base=state.base;
  if(grandTotalsUi.totalValue)grandTotalsUi.totalValue.textContent=formatCurrency(base);
  if(grandTotalsUi.discountInput){
    grandTotalsUi.discountInput.disabled=false;
    if(document.activeElement!==grandTotalsUi.discountInput){
      grandTotalsUi.discountInput.value=formatPercent(discountPercent);
    }
  }
  if(grandTotalsUi.grandTotalInput){
    grandTotalsUi.grandTotalInput.disabled=false;
    if(document.activeElement!==grandTotalsUi.grandTotalInput){
      grandTotalsUi.grandTotalInput.value=formatCurrency(currentGrandTotal);
    }
  }
  if(grandTotalsUi.gstValue)grandTotalsUi.gstValue.textContent=formatCurrency(state.gstAmount);
  if(grandTotalsUi.grandInclValue)grandTotalsUi.grandInclValue.textContent=formatCurrency(state.grandIncl);
}
window.DefCost.api.recalcTotals = updateGrandTotals;
function getSectionById(id){
  for(var i=0;i<sections.length;i++){
    if(sections[i].id===id) return sections[i];
  }
  return null;
}
function getSectionNameById(id){
  var sec=getSectionById(id);
  return sec?sec.name:('Section '+id);
}
function getSectionIndexById(id){
  for(var i=0;i<sections.length;i++){
    if(sections[i].id===id) return i;
  }
  return sections.length;
}
function getParentItemById(id){
  for(var i=0;i<basket.length;i++){
    var item=basket[i];
    if(item && item.id===id && !item.pid){
      return item;
    }
  }
  return null;
}
function cascadeSectionToChildren(parentId,newSectionId){
  for(var i=0;i<basket.length;i++){
    var item=basket[i];
    if(item && item.pid===parentId){
      item.sectionId=newSectionId;
    }
  }
}
function moveParentGroupToSection(parentId,newSectionId){
  if(!basket||!basket.length) return;
  var group=[];
  var removeMap={};
  for(var i=0;i<basket.length;i++){
    var entry=basket[i];
    if(!entry) continue;
    if(entry.id===parentId||entry.pid===parentId){
      group.push(entry);
      removeMap[i]=true;
    }
  }
  if(!group.length) return;
  var remaining=[];
  for(var r=0;r<basket.length;r++){
    if(!removeMap[r]) remaining.push(basket[r]);
  }
  var targetOrder=getSectionIndexById(newSectionId);
  var insertIndex=remaining.length;
  for(var idx=0;idx<remaining.length;){
    var item=remaining[idx];
    if(!item){ idx++; continue; }
    if(!item.pid){
      var itemOrder=getSectionIndexById(item.sectionId);
      if(item.sectionId===newSectionId){
        var after=idx+1;
        while(after<remaining.length && remaining[after].pid===item.id){ after++; }
        insertIndex=after;
        idx=after;
        continue;
      }
      if(itemOrder>targetOrder){
        insertIndex=idx;
        break;
      }
      var skip=idx+1;
      while(skip<remaining.length && remaining[skip].pid===item.id){ skip++; }
      idx=skip;
      continue;
    }
    idx++;
  }
  basket=remaining.slice(0,insertIndex).concat(group,remaining.slice(insertIndex));
}
function setParentSection(parentItem,newSectionId){
  if(!parentItem||parentItem.pid) return;
  if(parentItem.sectionId===newSectionId) return;
  if(!sections.some(function(sec){return sec.id===newSectionId;})) return;
  parentItem.sectionId=newSectionId;
  cascadeSectionToChildren(parentItem.id,newSectionId);
  moveParentGroupToSection(parentItem.id,newSectionId);
  persistBasket();
}
function renderSectionTabs(){
  if(!sectionTabsEl) return;
  ensureSectionState();
  sectionTabsEl.innerHTML='';
  for(var i=0;i<sections.length;i++){
    (function(sec){
      var tab=document.createElement('div');
      tab.className='section-tab'+(sec.id===activeSectionId?' active':'');
      tab.onclick=function(){ if(activeSectionId!==sec.id){ activeSectionId=sec.id; captureParentId=null; window.DefCost.ui.renderBasket(); } };
      var nameSpan=document.createElement('span'); nameSpan.className='section-name'; nameSpan.textContent=sec.name; tab.appendChild(nameSpan);
      var renameBtn=document.createElement('button'); renameBtn.type='button'; renameBtn.textContent='✎'; renameBtn.title='Rename section';
      renameBtn.onclick=function(ev){ ev.stopPropagation(); var newName=prompt('Section name',sec.name); if(newName===null) return; newName=newName.trim(); if(!newName){ showToast('Section name is required'); return; } var newNameNorm=normalizeSectionName(newName); var exists=sections.some(function(other){ return other&&other.id!==sec.id&&normalizeSectionName(other.name)===newNameNorm; }); if(exists){ showToast('A section named “'+newName+'” already exists.'); return; } sec.name=newName; window.DefCost.ui.renderBasket(); showToast('Section renamed'); };
      tab.appendChild(renameBtn);
      if(sections.length>1){
        var delBtn=document.createElement('button'); delBtn.type='button'; delBtn.textContent='✕'; delBtn.title='Delete section';
        delBtn.onclick=function(ev){ ev.stopPropagation(); if(!confirm('Delete section "'+sec.name+'" and all of its items?')) return; removeSection(sec.id); };
        tab.appendChild(delBtn);
      }
      sectionTabsEl.appendChild(tab);
    })(sections[i]);
  }
}

function removeSection(sectionId){
  if(sections.length<=1){
    showToast('At least one section is required.');
    return;
  }
  var remaining=[];
  var deletedName='Section '+sectionId;
  for(var i=0;i<sections.length;i++){
    if(sections[i].id===sectionId){
      deletedName=sections[i].name;
      continue;
    }
    remaining.push(sections[i]);
  }
  sections=remaining;
  var removedParents={};
  for(var i2=0;i2<basket.length;i2++){
    var itm=basket[i2];
    if(itm&&!itm.pid&&itm.sectionId===sectionId){
      removedParents[itm.id]=true;
    }
  }
  var filtered=[];
  for(var j=0;j<basket.length;j++){
    var item=basket[j];
    if(!item) continue;
    if(item.pid){
      if(removedParents[item.pid]) continue;
      filtered.push(item);
      continue;
    }
    if(item.sectionId===sectionId) continue;
    filtered.push(item);
  }
  basket=filtered;
  if(captureParentId && removedParents[captureParentId]){
    captureParentId=null;
  }
  ensureSectionState();
  if(!sections.some(function(sec){return sec.id===activeSectionId;})){
    activeSectionId=sections[0].id;
  }
  normalizeBasketItems();
  window.DefCost.ui.renderBasket();
  showToast('Deleted '+deletedName);
}
hydrateFromStorage();
var darkModeToggle=document.getElementById('darkModeToggle');
if(darkModeToggle){
  darkModeToggle.addEventListener('click',function(){
    document.body.classList.toggle('light');
  });
}
var statusEl=document.getElementById('status');var pickerWrap=document.getElementById('manualLoad');var picker=document.getElementById('xlsxPicker');
function showStatus(html){if(statusEl){statusEl.innerHTML=html;}}
function showPicker(reason){showStatus('<span style="color:#b00">Couldn\'t load <code>Defender Price List.xlsx</code> ('+reason+').</span> You can upload the workbook manually below.');if(pickerWrap)pickerWrap.style.display='block';}
function whenXLSXReady(cb){if(window.XLSX){cb();return;}var s=document.querySelector('script[data-sheetjs]');if(!s){s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.20.3/dist/xlsx.full.min.js';s.setAttribute('data-sheetjs','1');s.onload=function(){cb()};s.onerror=function(){showPicker('SheetJS failed to load')};document.head.appendChild(s);}else{var tries=0;var t=setInterval(function(){if(window.XLSX){clearInterval(t);cb();}else if(++tries>50){clearInterval(t);showPicker('SheetJS failed to load');}},100);}}
function readSheetData(name){if(!wb||!wb.Sheets||!wb.Sheets[name])return{error:'No such sheet.'};var cached=sheetCache[name];if(cached)return cached;var sheet=wb.Sheets[name];if(!sheet)return{error:'No such sheet.'};var rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:""});if(!rows.length){var empty={error:'Empty sheet.'};sheetCache[name]=empty;return empty;}var header=rows[0].map(function(h){return String(h).trim();});var catIdx=header.indexOf("Category");if(catIdx===-1){var missing={error:'No "Category" column in this sheet.'};sheetCache[name]=missing;return missing;}var body=rows.slice(1);var headerMap={};for(var i=0;i<header.length;i++){headerMap[header[i]]=i;}var data={header:header,body:body,catIdx:catIdx,headerMap:headerMap};sheetCache[name]=data;return data;}
function parseAndBuild(buf){try{wb=XLSX.read(buf,{type:'array'});}catch(e){console.error(e);showPicker('invalid file');return;}sheetCache={};var names=Object.keys(wb.Sheets||{});if(!names.length){showPicker('workbook has no sheets');return;}tabs.innerHTML='';container.innerHTML='';showStatus('');if(pickerWrap)pickerWrap.style.display='none';for(var i=0;i<names.length;i++){(function(name,idx){var b=document.createElement('button');b.textContent=name;b.dataset.sheet=name;b.onclick=function(){active(name);draw(name)};if(idx===0){b.classList.add('active');draw(name);}tabs.appendChild(b);})(names[i],i);} }
window.addEventListener('error',function(e){showStatus("<span style='color:#b00'>Error:</span> "+e.message)});
showStatus('Loading <code>Defender Price List.xlsx</code>…');
fetch('./Defender%20Price%20List.xlsx',{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.arrayBuffer();}).then(function(buf){whenXLSXReady(function(){parseAndBuild(buf);});}).catch(function(err){console.error(err);showPicker(err.message||'network error');});
if(picker){picker.addEventListener('change',function(e){var tgt=e&&e.target;var files=tgt&&tgt.files;var f=files&&files[0];if(!f)return;if(f.arrayBuffer){f.arrayBuffer().then(function(ab){whenXLSXReady(function(){parseAndBuild(ab);});});}else{var reader=new FileReader();reader.onload=function(ev){var ab=ev.target.result;whenXLSXReady(function(){parseAndBuild(ab);});};reader.readAsArrayBuffer(f);}});} 
function draw(name){
  if(!wb||!wb.Sheets||!wb.Sheets[name]){container.textContent='No such sheet.';return;}
  var sheetData=readSheetData(name);
  if(!sheetData){container.textContent='No such sheet.';return;}
  if(sheetData.error){container.textContent=sheetData.error;return;}
  var header=sheetData.header;
  var body=Array.isArray(sheetData.body)?sheetData.body:[];
  var catIdx=sheetData.catIdx;
  var headerMap=sheetData.headerMap||{};
  container.innerHTML="";
  var sDiv=document.createElement("div");sDiv.className="search-container";
  var label=document.createElement("label");label.className="search-label";
  var searchId='catalogSearch_'+Date.now();label.setAttribute('for',searchId);label.textContent='Search items:';
  var control=document.createElement("div");control.className="search-control";
  var inp=document.createElement("input");inp.className="search-input";inp.type='search';inp.id=searchId;inp.placeholder='Type to filter...';
  var cancelBtn=document.createElement("button");cancelBtn.type='button';cancelBtn.className='search-cancel';cancelBtn.textContent='Cancel';
  control.appendChild(inp);control.appendChild(cancelBtn);
  sDiv.appendChild(label);sDiv.appendChild(control);
  var scopeToggle=document.createElement('label');scopeToggle.className='search-scope-toggle';
  var scopeCheckbox=document.createElement('input');scopeCheckbox.type='checkbox';scopeCheckbox.checked=qbState&&qbState.scope==='all';
  scopeToggle.appendChild(scopeCheckbox);scopeToggle.appendChild(document.createTextNode('All Tabs'));
  sDiv.appendChild(scopeToggle);
  container.appendChild(sDiv);
  var hint=document.createElement('div');hint.className='search-hint';hint.textContent='Enter = Add first result\u2003Esc = Clear or close';
  container.appendChild(hint);
  var wrap=document.createElement("div");container.appendChild(wrap);
  currentSearchInput=inp;
  function updateCancel(){if(!cancelBtn)return;cancelBtn.classList.toggle('visible',!!inp.value);}
  function clearSearch(){inp.value='';updateCancel();render();}
  function buildEntries(scope){var entries=[];if(scope==='all'){var names=Object.keys((wb&&wb.Sheets)||{});for(var i=0;i<names.length;i++){var sheetName=names[i];var data=readSheetData(sheetName);if(!data||data.error)continue;var rows=Array.isArray(data.body)?data.body:[];for(var j=0;j<rows.length;j++){var row=rows[j];if(!Array.isArray(row))continue;entries.push({row:row,header:data.header,headerMap:data.headerMap,catIdx:data.catIdx,sheet:sheetName});}}}else{for(var k=0;k<body.length;k++){var currentRow=body[k];if(!Array.isArray(currentRow))continue;entries.push({row:currentRow,header:header,headerMap:headerMap,catIdx:catIdx,sheet:name});}}return entries;}
  function render(){updateCancel();var scope=scopeCheckbox.checked?'all':'current';var entries=buildEntries(scope);var rawTerm=(inp.value||'').trim();var termLower=rawTerm.toLowerCase();var hasTerm=!!termLower;var filtered=[];for(var i=0;i<entries.length;i++){var entry=entries[i];var row=entry.row;if(!Array.isArray(row))continue;var match=!hasTerm;if(hasTerm){for(var j=0;j<row.length;j++){var cell=row[j];if(cell==null)continue;if(String(cell).toLowerCase().indexOf(termLower)>-1){match=true;break;}}if(!match&&entry.sheet&&entry.sheet.toLowerCase().indexOf(termLower)>-1){match=true;}}if(match)filtered.push(entry);}var totalMatches=filtered.length;var truncated=false;if(filtered.length>MAX_RESULTS){filtered=filtered.slice(0,MAX_RESULTS);truncated=true;}wrap.innerHTML="";if(!filtered.length){var empty=document.createElement('div');empty.className='search-results-note';empty.textContent=hasTerm?'No matching items.':'No items available in this tab.';wrap.appendChild(empty);return;}var highlightRegex=null;if(hasTerm){try{var safeTerm=termLower.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&');highlightRegex=new RegExp('('+safeTerm+')','gi');}catch(e){highlightRegex=null;}}
    function setCellContent(el,val){var str=val==null?'':String(val);var safe=escapeHtml(str);if(highlightRegex){try{el.innerHTML=safe.replace(highlightRegex,'<span class="highlight">$1</span>');return;}catch(e){}}el.innerHTML=safe;}
    function formatValue(columnName,value){var key=String(columnName||'').toLowerCase();if(/price|gst|rate/.test(key)&&value!==''&&!isNaN(value)){return(+value).toFixed(2);}return value;}
    var scopeAll=scope==='all';
    var groups={};for(var g=0;g<filtered.length;g++){var item=filtered[g];var categoryRaw=item.catIdx>=0&&item.catIdx<item.row.length?item.row[item.catIdx]:'';var cat=categoryRaw!=null?String(categoryRaw).trim():'';if(!cat)cat='Uncategorised';if(!groups[cat])groups[cat]=[];groups[cat].push(item);}var cats=Object.keys(groups).sort(function(a,b){var A=(META[a.toLowerCase()]||FALL).idx;var B=(META[b.toLowerCase()]||FALL).idx;return A-B;});for(var c=0;c<cats.length;c++){var cat=cats[c];var items=groups[cat];if(!items||!items.length)continue;var det=document.createElement("details");det.open=scopeAll||hasTerm;var meta=META[cat.toLowerCase()]||FALL;det.className=meta.cls;var sum=document.createElement("summary");sum.textContent=cat;det.appendChild(sum);var tbl=document.createElement("table");var base=items[0];var displayHeader=base.header.filter(function(_,idx){return idx!==base.catIdx;});var ths=displayHeader.map(function(h){return '<th>'+escapeHtml(h)+'</th>';}).join('');tbl.innerHTML='<thead><tr><th></th>'+ths+'</tr></thead>';var tbody=document.createElement("tbody");tbl.appendChild(tbody);
      items.forEach(function(entry){var tr=document.createElement("tr");var tdAdd=document.createElement("td");var btn=document.createElement("button");btn.className="add-button";btn.textContent="+";btn.addEventListener('click',function(){addItem(entry.row,entry.header);});tdAdd.appendChild(btn);tr.appendChild(tdAdd);displayHeader.forEach(function(columnName,index){var td=document.createElement("td");var headerMapEntry=entry.headerMap||{};var idxInRow=Object.prototype.hasOwnProperty.call(headerMapEntry,columnName)?headerMapEntry[columnName]:-1;var rawValue=idxInRow>-1?entry.row[idxInRow]:'';var formatted=formatValue(columnName,rawValue);var content=document.createElement('div');content.className='item-cell-line';setCellContent(content,formatted);if(scopeAll&&index===0){var wrapper=document.createElement('div');wrapper.className='item-cell-stack';wrapper.appendChild(content);var labelEl=document.createElement('span');labelEl.className='tab-source-label';setCellContent(labelEl,entry.sheet);wrapper.appendChild(labelEl);td.appendChild(wrapper);}else{td.appendChild(content);}if(/price|gst|rate/.test(String(columnName||'').toLowerCase()))td.style.fontWeight='bold';td.addEventListener('click',function(ev){if(ev.target&&ev.target.tagName==='BUTTON')return;var el=ev.currentTarget;var text=(el.textContent||'').trim();if(!text)return;navigator.clipboard.writeText(text).then(function(){el.classList.add("copied-cell");void el.offsetWidth;setTimeout(function(){el.classList.remove("copied-cell");},150);}).catch(function(){});});tr.appendChild(td);});tbody.appendChild(tr);});
      det.appendChild(tbl);wrap.appendChild(det);
    }
    if(truncated){var note=document.createElement('div');note.className='search-results-note';note.textContent='Showing first '+MAX_RESULTS+' of '+totalMatches+' matches. Refine your search to narrow results.';wrap.appendChild(note);}
  }
  inp.addEventListener('input',function(){updateCancel();render();});
  inp.addEventListener('keydown',function(e){var key=e.key||'';if(key==='Escape'||key==='Esc'){if(inp.value){e.preventDefault();e.stopPropagation();clearSearch();try{inp.focus({preventScroll:true});}catch(err){inp.focus();}}return;}if(key==='Enter'){var first=wrap.querySelector('.add-button');if(first){e.preventDefault();first.click();inp.value='';updateCancel();render();try{inp.focus({preventScroll:true});}catch(err){inp.focus();}}}});
  cancelBtn.addEventListener('click',function(){clearSearch();try{inp.focus({preventScroll:true});}catch(e){inp.focus();}});
  scopeCheckbox.addEventListener('change',function(){qbState.scope=scopeCheckbox.checked?'all':'current';if(catalogueNamespace&&typeof catalogueNamespace.persistState==='function'){catalogueNamespace.persistState();}render();try{inp.focus({preventScroll:true});}catch(e){inp.focus();}});
  updateCancel();
  render();
  if(qbState&&qbState.isOpen!==false){focusSearchFieldSoon();}
}
var bBody=document.querySelector('#basketTable tbody'),bFoot=document.querySelector('#basketTable tfoot');
bindUiState();
if(bBody){
  bBody.addEventListener('click',function(e){
    var t=e.target; if(!t) return;
    if(/^(BUTTON|INPUT|TEXTAREA|SELECT|LABEL)$/i.test(t.tagName)) return;
    var td=t.closest ? t.closest('td') : (function(n){while(n&&n.tagName!=='TD'){n=n.parentNode;}return n;})(t);
    if(!td) return; var text=(td.textContent||'').trim(); if(!text) return;
    navigator.clipboard.writeText(text).then(function(){ td.classList.add('copied-cell'); void td.offsetWidth; setTimeout(function(){ td.classList.remove('copied-cell'); },150); }).catch(function(){});
  });
}
var bFootEl=document.querySelector('#basketTable tfoot');
if(bFootEl){
  bFootEl.addEventListener('click',function(e){
    var t=e.target; if(!t) return;
    if(/^(BUTTON|INPUT|TEXTAREA|SELECT|LABEL)$/i.test(t.tagName)) return;
    var td=t.closest ? t.closest('td') : (function(n){while(n&&n.tagName!=='TD'){n=n.parentNode;}return n;})(t);
    if(!td) return; var text=(td.textContent||'').trim(); if(!text) return;
    navigator.clipboard.writeText(text).then(function(){ td.classList.add('copied-cell'); void td.offsetWidth; setTimeout(function(){ td.classList.remove('copied-cell'); },150); }).catch(function(){});
  });
}
if(addSectionBtn){addSectionBtn.addEventListener('click',function(){ensureSectionState();var suggestion='Section '+(sectionSeq+1);var name=prompt('Section name',suggestion);if(name===null)return;name=name.trim();if(!name){showToast('Section name is required');return;}var nameNorm=normalizeSectionName(name);var exists=sections.some(function(sec){return sec&&normalizeSectionName(sec.name)===nameNorm;});if(exists){showToast('A section named “'+name+'” already exists.');return;}var newId=sectionSeq+1;sections.push({id:newId,name:name,notes:''});sectionSeq=newId;activeSectionId=newId;captureParentId=null;window.DefCost.ui.renderBasket();showToast('Section added');});}
if(importBtn&&importInput){
  importBtn.addEventListener('click',function(){
    importInput.value='';
    importInput.click();
  });
  importInput.addEventListener('change',function(ev){
    handleImportInputChange(ev,{
      importInput:importInput,
      Papa:window.Papa,
      backup:persistBackup,
      showIssuesModal:showIssuesModal,
      applyImportedModel:applyImportedModel
    });
  });
}
var addCustomBtn=document.getElementById('addCustomBtn');
if(addCustomBtn){addCustomBtn.addEventListener('click',function(){var nl=null;if(captureParentId){var parent=getParentItemById(captureParentId);if(parent){var parentSection=sections.some(function(sec){return sec.id===parent.sectionId;})?parent.sectionId:activeSectionId;nl={id:++uid,pid:captureParentId,kind:'sub',sectionId:parentSection,item:'Sub item',qty:1,ex:0};}else{captureParentId=null;}}if(!nl){nl={id:++uid,pid:null,kind:'line',collapsed:false,sectionId:activeSectionId,item:'Custom item',qty:1,ex:0};}basket.push(nl);window.DefCost.ui.renderBasket();try{var rows=bBody.querySelectorAll('tr.main-row');if(rows.length){var last=rows[rows.length-1].querySelector('.item-input');if(last)last.focus();}}catch(_){}});}
function updateBasketHeaderOffset(){
  var cont=document.getElementById('basketContainer');
  var sticky=document.getElementById('basketSticky');
  if(!cont||!sticky) return;
  var h=(sticky.offsetHeight||0);
  cont.style.setProperty('--bh', h+'px');
}
window.addEventListener('resize',updateBasketHeaderOffset);
window.addEventListener('load',updateBasketHeaderOffset);
function addItem(row,header){
  var catIdx=header.indexOf("Category");
  var itemCol=-1;
  for(var i=0;i<header.length;i++){
    var key=String(header[i]).toLowerCase();
    if(key==='item'||key==='service / item'||key==='service'){itemCol=i;break;}
  }
  var exIdx=-1;
  for(var i2=0;i2<header.length;i2++){
    if(PRICE_EX.indexOf(header[i2])>-1){exIdx=i2;break;}
  }
  var firstNonEmpty='';
  for(var j=0;j<row.length;j++){
    if(j!==catIdx&&String(row[j]).trim()!==''){firstNonEmpty=row[j];break;}
  }
  var desc=itemCol!==-1?row[itemCol]:firstNonEmpty||'Unnamed Item';
  var exVal=exIdx===-1?NaN:+row[exIdx];
  var newItem=null;
  if(captureParentId){
    var parent=getParentItemById(captureParentId);
    if(parent){
      var parentSection=sections.some(function(sec){return sec.id===parent.sectionId;})?parent.sectionId:activeSectionId;
      newItem={id:++uid,pid:captureParentId,kind:'sub',sectionId:parentSection,item:desc,qty:1,ex:exVal};
    }else{
      captureParentId=null;
    }
  }
  if(!newItem){
    newItem={id:++uid,pid:null,kind:'line',collapsed:false,sectionId:activeSectionId,item:desc,qty:1,ex:exVal};
  }
  basket.push(newItem);
  window.DefCost.ui.renderBasket();
}

function resetQuote(toastMessage){
  basket=[];
  captureParentId=null;
  sections=getDefaultSections();
  ensureSectionState();
  var first=sections[0];
  activeSectionId=first?first.id:1;
  sectionSeq=first?first.id:sectionSeq;
  discountPercent=0;
  currentGrandTotal=0;
  lastBaseTotal=0;
  window.DefCost.ui.renderBasket();
  if(toastMessage){ showToast(toastMessage); }
}
function showDeleteDialog(){
  if(document.querySelector('.qb-modal-backdrop')) return;
  var overlay=document.createElement('div'); overlay.className='qb-modal-backdrop';
  var modal=document.createElement('div'); modal.className='qb-modal'; modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true'); modal.setAttribute('aria-labelledby','qbDeleteTitle');
  var title=document.createElement('h4'); title.id='qbDeleteTitle'; title.textContent='Delete quote?';
  var message=document.createElement('p'); message.textContent='Would you like to export the quote to CSV before deleting?';
  var buttons=document.createElement('div'); buttons.className='qb-modal-buttons';
  var saveBtn=document.createElement('button'); saveBtn.type='button'; saveBtn.textContent='Save CSV';
  var deleteBtn=document.createElement('button'); deleteBtn.type='button'; deleteBtn.textContent='Delete'; deleteBtn.classList.add('danger');
  var cancelBtn=document.createElement('button'); cancelBtn.type='button'; cancelBtn.textContent='Cancel'; cancelBtn.classList.add('neutral');
  buttons.appendChild(saveBtn); buttons.appendChild(deleteBtn); buttons.appendChild(cancelBtn);
  modal.appendChild(title); modal.appendChild(message); modal.appendChild(buttons); overlay.appendChild(modal);
  document.body.appendChild(overlay);
  function closeDialog(){ document.removeEventListener('keydown',handleKey,true); if(overlay&&overlay.parentNode){ overlay.parentNode.removeChild(overlay); } if(clearQuoteBtn){ try{clearQuoteBtn.focus();}catch(e){} } }
  function handleKey(ev){ if(ev.key==='Escape'||ev.key==='Esc'){ ev.preventDefault(); ev.stopPropagation(); closeDialog(); } }
  document.addEventListener('keydown',handleKey,true);
  overlay.addEventListener('click',function(ev){ if(ev.target===overlay){ closeDialog(); }});
  cancelBtn.addEventListener('click',closeDialog);
  saveBtn.addEventListener('click',function(){ var exported=exportQuoteToCsv({silent:true}); resetQuote(exported?'Quote exported and deleted':'Quote deleted'); closeDialog(); });
  deleteBtn.addEventListener('click',function(){ resetQuote('Quote deleted'); closeDialog(); });
  setTimeout(function(){ try{saveBtn.focus();}catch(e){} },0);
}
var exportBtn=document.getElementById("exportCsvBtn");
if(exportBtn){
  exportBtn.onclick=function(){ exportQuoteToCsv(); };
}
window.__wd_main_ok__=true;
})();
