"use strict";

const D = require("../lib/osc-drive");
const L = require("../lib/leadership-handler");
const {
  admin,
  getAuth,
  getDb,
  sendJson,
  ensurePost,
  readJsonBody,
  requireManager,
  normalizeEmail,
  normalizeDisplayName,
  normalizeRole,
  normalizePermissions,
  ensureRoleCanBeAssigned,
  handleError
} = require("../lib/firebase-admin");

module.exports = async function handler(req, res) {
  if (!ensurePost(req, res)) return;
  let createdUid = "";
  let createdFresh = false;
  let linkedExisting = false;
  let profileRef = null;
  try {
    const actor = await requireManager(req);
    const body = readJsonBody(req);
    const displayName = normalizeDisplayName(body.displayName);
    const email = normalizeEmail(body.email);
    const role = normalizeRole(body.role);
    ensureRoleCanBeAssigned(actor.profile.role, role);

    const password = String(body.password || "");
    if (password.length < 8 || password.length > 128) {
      const e = new Error("Mật khẩu phải từ 8 đến 128 ký tự.");
      e.code = "osc/bad-request";
      throw e;
    }
    const permissions = normalizePermissions(body.permissions, role);
    const id = body.mssv ? L.mssv(body.mssv) : "";
    const term = body.semester ? D.semester(body.semester) : "";
    const positionTitle = body.positionTitle ? L.title(body.positionTitle) : (role==="admin"?"Quản trị viên":"Thành viên BCN");
    if(/^chủ tịch$/i.test(positionTitle))throw D.error("Chức vụ Chủ tịch chỉ dành cho quyền Chủ tịch.","osc/forbidden");
    const auth = getAuth();
    const db = getDb();

    let userRecord = null;
    try {
      userRecord = await auth.getUserByEmail(email);
      linkedExisting = true;
    } catch (error) {
      if (!error || error.code !== "auth/user-not-found") throw error;
    }

    if (!userRecord) {
      userRecord = await auth.createUser({
        email,
        password,
        displayName,
        disabled: false
      });
      createdFresh = true;
    }

    createdUid = userRecord.uid;
    profileRef = db.collection("users").doc(createdUid);
    const profileSnap = await profileRef.get();
    if (profileSnap.exists) {
      const e = new Error("Email này đã có hồ sơ tài khoản trong hệ thống.");
      e.code = "osc/profile-exists";
      throw e;
    }

    const ownerRef=id?db.collection("oscMssvOwners").doc(id):null;
    const historyRef=term?profileRef.collection("oscPositionHistory").doc(term):null;
    await db.runTransaction(async tx=>{
      const old=await tx.get(profileRef);
      if(old.exists)throw D.error("Tài khoản đã có hồ sơ quyền.","osc/profile-exists");
      const owner=ownerRef?await tx.get(ownerRef):null;
      if(owner?.exists&&owner.data()?.uid!==createdUid)throw D.error("MSSV đã được sử dụng.","osc/mssv-exists");
      tx.create(profileRef,{
        displayName,email,role,active:true,permissions,
        ...(id?{mssv:id}:{}),
        ...(term?{positionTitle,positionSemester:term}:{}),
        linkedExistingAuth:linkedExisting,
        createdAt:admin.firestore.FieldValue.serverTimestamp(),
        createdBy:actor.decoded.uid,
        updatedAt:admin.firestore.FieldValue.serverTimestamp(),
        updatedBy:actor.decoded.uid
      });
      if(ownerRef)tx.set(ownerRef,{uid:createdUid,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
      if(historyRef)tx.set(historyRef,{
        semester:term,mssv:id,positionTitle,systemRoleAtTerm:role,
        updatedBy:actor.decoded.uid,updatedAt:admin.firestore.FieldValue.serverTimestamp()
      });
    });

    try {
      await auth.updateUser(createdUid, { displayName, disabled: false });
    } catch (error) {
      try{
        await profileRef.delete();
        if(id){
          const ownerSnap=await ownerRef.get();
          if(ownerSnap.data()?.uid===createdUid)await ownerRef.delete();
        }
        if(historyRef)await historyRef.delete();
      }catch(rollbackError){console.error("profile rollback failed",rollbackError?.code)}
      throw error;
    }

    sendJson(res, 200, {
      ok: true,
      uid: createdUid,
      email,
      role,
      mssv:id,positionTitle:term?positionTitle:"",
      linkedExisting
    });
  } catch (error) {
    if (createdFresh && createdUid) {
      try { await getAuth().deleteUser(createdUid); } catch (rollbackError) { console.error("create auth rollback failed", rollbackError); }
    }
    handleError(res, error);
  }
};
