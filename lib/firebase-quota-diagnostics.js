"use strict";

// Cloud Monitoring can answer 403 for multiple unrelated reasons. Never expose
// the raw Google API body, access tokens, or Vercel credential values to clients.
function classifyMonitoringFailure({httpStatus=0,message="",googleReason="",googleStatus=""}={}){
  const raw=[googleReason,googleStatus,message].filter(Boolean).join(" ");
  const detail=raw.toLowerCase();
  if(/billing[_ -]*(disabled|not[_ -]*enabled|required)|billing account.*(disabled|not.*enabled)|requires billing|billing.*(is|must be|to be).*enabled|cloud billing.*disabled|billing check failed/.test(detail)){
    return {code:"BILLING_REQUIRED",description:"Google Cloud yêu cầu bật Cloud Billing để đọc chỉ số bằng Service Account này. Hãy kiểm tra trạng thái Billing của đúng dự án; không tự nâng cấp gói khi chưa muốn phát sinh chi phí."};
  }
  if(/service[_ -]*disabled|api.*has not been used|api.*not been used|api.*(is|was).*disabled|monitoring\.googleapis\.com.*disabled|service.*has been disabled/.test(detail)){
    return {code:"MONITORING_API_DISABLED",description:"Cloud Monitoring API chưa được bật cho dự án đang truy vấn, hoặc thay đổi vừa bật chưa có hiệu lực. Hãy kiểm tra Project ID trong Vercel và API của chính dự án đó."};
  }
  if(/access[_ -]*token[_ -]*scope[_ -]*insufficient|insufficient authentication scopes|authentication.*scope|access token.*scope/.test(detail)){
    return {code:"AUTH_SCOPE_MISSING",description:"Access token của Service Account thiếu OAuth scope đọc Monitoring. Cần kiểm tra cách backend lấy token, không cấp thêm quyền Owner."};
  }
  if(/serviceusage\.services\.use|service[_ -]*usage.*permission|consumer.*(permission|quota project)/.test(detail)){
    return {code:"SERVICE_USAGE_DENIED",description:"Google Cloud từ chối quyền sử dụng dịch vụ của dự án. Hãy kiểm tra dự án nhận request và cấu hình Service Usage; không thay đổi quyền quản trị hàng loạt."};
  }
  if(/monitoring\.timeseries\.list|monitoring viewer|permission.*denied|iam_permission_denied|iam.*denied/.test(detail)){
    return {code:"MONITORING_PERMISSION_DENIED",description:"Google từ chối quyền monitoring.timeSeries.list. Kiểm tra Service Account Vercel thực sự dùng có đúng email đang được cấp Monitoring Viewer trong dự án Firebase không."};
  }
  if(httpStatus===404||/project.*(not found|does not exist)/.test(detail)){
    return {code:"PROJECT_NOT_FOUND",description:"Không tìm thấy dự án Google Cloud để đọc Monitoring. Kiểm tra FIREBASE_PROJECT_ID trên Vercel."};
  }
  if(httpStatus===429||/resource_exhausted/.test(detail)){
    return {code:"MONITORING_RATE_LIMIT",description:"Cloud Monitoring đang giới hạn số yêu cầu. Hãy thử lại sau ít phút."};
  }
  if(httpStatus===403)return {code:"GOOGLE_FORBIDDEN",description:"Google Cloud Monitoring từ chối yêu cầu (403) nhưng chưa xác định được nguyên nhân. Hãy kiểm tra Cloud Run/Vercel Runtime Logs để biết thông báo Google trả về."};
  return {code:"MONITORING_UNAVAILABLE",description:"Chưa thể lấy số liệu Cloud Monitoring. Kiểm tra trạng thái dịch vụ và Runtime Logs, sau đó thử làm mới."};
}
module.exports={classifyMonitoringFailure};
