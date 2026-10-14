"use strict";
// Use Vietnam calendar dates, not server UTC or the user's computer timezone.
const ZONE="Asia/Ho_Chi_Minh";
function vnToday(now=Date.now()){
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(now));
 const p=k=>parts.find(x=>x.type===k)?.value||"";
 return p("year")+"-"+p("month")+"-"+p("day");
}
function assertNotPast(date,now=Date.now()){
 const today=vnToday(now);
 if(typeof date!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)||date<today){
  const e=new Error("Không thể đặt hoặc chuyển lịch phòng về ngày đã qua (giờ Việt Nam). Vui lòng chọn từ "+today+" trở đi.");
  e.code="osc/room-past-date";
  throw e;
 }
 return date;
}
module.exports={vnToday,assertNotPast};
