(function(){
"use strict";
// OSC BCN account expiry: screen-only 5-second notice; backend and rules enforce immediately.
let checkTimer=null,logoutTimer=null,tickTimer=null,activeUid="",warning=false;
function expiryMs(value){
  if(value==null||value==="")return 0;
  if(typeof value.toMillis==="function")return Number(value.toMillis())||0;
  if(typeof value.toDate==="function")return value.toDate()?.getTime()||0;
  if(typeof value==="string")return Date.parse(value)||0;
  return Number(value)||0;
}
function isExpired(profile,now=Date.now()){
  const ms=expiryMs(profile?.accountExpiresAt);
  return String(profile?.role||"").toLowerCase()==="bcn"&&ms>0&&ms<=now;
}
function stop(){
  clearTimeout(checkTimer);clearTimeout(logoutTimer);clearInterval(tickTimer);
  checkTimer=null;logoutTimer=null;tickTimer=null;activeUid="";warning=false;
  document.getElementById("oscBcnExpiryOverlay")?.remove();
}
async function lockNow(user){
  if(!user)return false;
  try{
    const token=await user.getIdToken();
    const response=await fetch("/api/accounts?operation=expire",{
      method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
      cache:"no-store",body:"{}",signal:AbortSignal.timeout(9000)
    });
    return response.ok;
  }catch(err){
    console.warn("BCN expiry server lock pending retry",String(err?.code||err?.name||"network"));
    return false;
  }
}
function showCountdown(uid){
  if(warning||currentFirebaseUser?.uid!==uid||!isExpired(currentProfile))return;
  warning=true;
  clearTimeout(checkTimer);
  const overlay=document.createElement("div");
  overlay.id="oscBcnExpiryOverlay";
  overlay.setAttribute("role","alertdialog");
  overlay.setAttribute("aria-modal","true");
  overlay.setAttribute("aria-labelledby","oscBcnExpiryTitle");
  const panel=document.createElement("div");panel.className="osc-bcn-expiry-panel";
  const icon=document.createElement("div");icon.className="osc-bcn-expiry-symbol";icon.textContent="!";
  const title=document.createElement("h2");title.id="oscBcnExpiryTitle";title.textContent="Tài khoản BCN đã hết thời hạn";
  const reason=document.createElement("p");reason.textContent="Thời gian được cấp để sử dụng OSC đã kết thúc. Vì lý do bảo mật, tài khoản của bạn sẽ bị khóa và không thể đăng nhập lại cho đến khi Admin gia hạn hoặc mở khóa.";
  const count=document.createElement("p");count.className="osc-bcn-expiry-counter";
  panel.append(icon,title,reason,count);overlay.append(panel);document.body.appendChild(overlay);
  const until=Date.now()+5000;
  const refresh=()=>{count.textContent="Hệ thống sẽ tự động đăng xuất sau "+Math.max(0,Math.ceil((until-Date.now())/1000))+" giây nữa."};
  refresh();
  tickTimer=setInterval(refresh,200);
  logoutTimer=setTimeout(async()=>{
    clearInterval(tickTimer);tickTimer=null;
    if(currentFirebaseUser?.uid!==uid)return stop();
    count.textContent="Đang khóa tài khoản và đăng xuất…";
    const user=currentFirebaseUser;
    await lockNow(user);
    try{await fbAuth.signOut()}catch{}
    stop();
    if(typeof setLoginError==="function")setLoginError("Tài khoản BCN đã hết thời hạn và bị khóa. Vui lòng liên hệ Admin để gia hạn.");
  },5000);
}
function schedule(){
  clearTimeout(checkTimer);checkTimer=null;
  if(warning)return;
  if(!currentFirebaseUser||String(currentProfile?.role||"")!=="bcn")return;
  const expiry=expiryMs(currentProfile.accountExpiresAt);
  if(!expiry)return;
  activeUid=currentFirebaseUser.uid;
  if(expiry<=Date.now())return showCountdown(activeUid);
  checkTimer=setTimeout(()=>{
    if(currentFirebaseUser?.uid===activeUid){
      if(isExpired(currentProfile))showCountdown(activeUid);
      else schedule();
    }
  },Math.min(expiry-Date.now()+25,2147480000));
}
for(const event of ["focus","pageshow"]){
  window.addEventListener(event,()=>{if(currentFirebaseUser?.uid&&isExpired(currentProfile))showCountdown(currentFirebaseUser.uid)});
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&currentFirebaseUser?.uid&&isExpired(currentProfile))showCountdown(currentFirebaseUser.uid)});
window.OSCBCNExpiry={expiryMs,isExpired,lockNow,schedule,stop};
})();