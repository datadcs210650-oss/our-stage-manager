"use strict";
const D=require("../lib/osc-drive");
const {getDb,admin}=D;
const origin="https://ourstageclubmanager.vercel.app";
function go(res,result){
  res.setHeader("Cache-Control","no-store, max-age=0");
  res.setHeader("Referrer-Policy","no-referrer");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("Location",origin+"/?tab=driveHub&drive="+encodeURIComponent(result));
  res.statusCode=303;res.end();
}
module.exports=async function(req,res){
  if(req.method!=="GET"){res.statusCode=405;res.end();return}
  try{
    if(req.query?.error) return go(res,"cancelled");
    const nonce=String(req.query?.state||""),code=String(req.query?.code||"");
    if(!/^[A-Za-z0-9_-]{35,90}$/.test(nonce)||!code||code.length>3000)return go(res,"error");
    // OAuth login-CSRF defense: nonce must originate from this browser session.
    const cookie=String(req.headers?.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("osc_drive_oauth="));
    const cookieHash=cookie?cookie.slice("osc_drive_oauth=".length):"";
    res.setHeader("Set-Cookie","osc_drive_oauth=; Path=/api/drive-oauth-callback; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
    const expected=D.hash(nonce);
    if(!/^[a-f0-9]{64}$/.test(cookieHash)||
       !D.crypto.timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(cookieHash,"hex")))
      return go(res,"error");
    const ref=getDb().collection(D.OAUTH_STATES).doc(expected);
    const accepted=await getDb().runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists||snap.data()?.used===true||
        Number(snap.data()?.expiresMs||0)<Date.now())return false;
      const uid=snap.data()?.uid;
      const user=await tx.get(getDb().collection("users").doc(String(uid||"")));
      if(!user.exists||user.data()?.active!==true||user.data()?.role!=="superadmin")return false;
      tx.update(ref,{used:true,usedAt:admin.firestore.FieldValue.serverTimestamp()});
      return true;
    });
    if(!accepted)return go(res,"expired");
    if(!D.configured())return go(res,"unconfigured");
    const auth=await D.tokenExchange({code,grant_type:"authorization_code",redirect_uri:D.CALLBACK});
    if(!auth.refresh_token)return go(res,"no-refresh-token");
    const profileResponse=await fetch("https://www.googleapis.com/oauth2/v3/userinfo",{
      headers:{"Authorization":"Bearer "+auth.access_token},
      signal:AbortSignal.timeout(15000)
    });
    if(!profileResponse.ok)return go(res,"error");
    const profile=await profileResponse.json();
    const email=String(profile.email||"").toLowerCase().trim();
    if(profile.email_verified!==true||!email||email.length>254)return go(res,"error");
    const old=await D.connection();
    // Prevent silently replacing a club archive with someone else's private Drive.
    if(old.data?.ownerEmail&&old.data.ownerEmail!==email)return go(res,"account-mismatch");
    const rootId=old.data?.rootFolderId||(
      await D.drive("POST","files",{access:auth.access_token,
        body:{name:"OUR STAGE CLUB — Kho tài liệu",mimeType:D.FOLDER},
        query:{fields:"id,name"}})
    ).id;
    if(!rootId)return go(res,"error");
    await old.ref.set({
      ownerEmail:email,
      rootFolderId:rootId,
      encryptedRefreshToken:D.encrypt(auth.refresh_token),
      connectedAt:admin.firestore.FieldValue.serverTimestamp(),
      oauthScope:D.SCOPE
    },{merge:true});
    return go(res,"connected");
  }catch(e){
    // No authorization codes, access tokens, refresh tokens or sessions in logs.
    console.error("OSC Drive OAuth callback failed",String(e?.code||"unknown"));
    return go(res,"error");
  }
};