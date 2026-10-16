"use strict";

// Preserve the four original account API contracts and individual authorization
// checks while using a single Vercel Function. The only new responsibility
// of this entrypoint is to dispatch an explicitly allowlisted operation.
const {sendJson}=require("../lib/firebase-admin");
const ROUTES=Object.freeze({
  create:()=>require("../lib/account-create"),
  update:()=>require("../lib/account-update"),
  password:()=>require("../lib/account-password"),
  delete:()=>require("../lib/account-delete")
});

module.exports=async function handler(req,res){
  const operation=req?.query?.operation;
  if(typeof operation!=="string"||!Object.prototype.hasOwnProperty.call(ROUTES,operation)){
    return sendJson(res,404,{ok:false,error:"Thao tác tài khoản không tồn tại."});
  }
  // Keep method/error/auth rules inside each original handler, unchanged.
  // In particular, deletion and password reset still require a recent login.
  return ROUTES[operation]()(req,res);
};
