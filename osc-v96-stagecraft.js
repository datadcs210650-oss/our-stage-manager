/* OUR STAGE CLUB — V96 Stagecraft progressive UI enhancements.
   Accessibility/presentation only. No Firebase/Auth/API logic. */
(function(){
"use strict";
if(window.__OSC_V96_STAGECRAFT__)return;
window.__OSC_V96_STAGECRAFT__=true;
var contexts={
dashboard:"Tổng hợp nhanh tình hình học kỳ và các hành động thường dùng.",
attention:"Cảnh báo và dữ liệu cần xử lý trong phạm vi quyền của bạn.",
manage:"Điểm danh, điểm hoạt động, QR và trạng thái đồng hành.",
memberList:"Quản lý danh sách thành viên, import và xuất dữ liệu.",
info:"Hồ sơ thành viên, thống kê hoạt động và lịch sử theo học kỳ.",
divisions:"Theo dõi phân ban và mức độ hoạt động của từng nhóm.",
finance:"Theo dõi thu, chi, quỹ và trạng thái đóng quỹ.",
events:"Quản lý biểu mẫu, QR, vé, check-in và phản hồi sự kiện.",
operations:"Điều hành trực tiếp, đặt phòng và quyền tạm thời.",
ticketStudio:"Thiết kế và quản lý vé sự kiện.",
memberQr:"Tạo và quản lý mã QR thành viên.",
lookupPortal:"Cấu hình cổng tra cứu dữ liệu thành viên.",
freeLookup:"Tạo cổng tra cứu độc lập cho từng nhu cầu.",
myAccount:"Thông tin tài khoản và phiên làm việc hiện tại.",
approvals:"Duyệt các yêu cầu đang chờ xử lý.",
audit:"Theo dõi nhật ký thay đổi và công cụ import.",
trash:"Khôi phục hoặc xóa dữ liệu đã chuyển vào thùng rác.",
accounts:"Quản lý tài khoản BCN và phân quyền truy cập.",
settings:"Thiết lập học kỳ, cấu hình hệ thống và khóa dữ liệu."
};
function q(s,r){return (r||document).querySelector(s)}
function qa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
function activeTab(){var b=q(".nav button[data-tab].active");return b?b.dataset.tab:"dashboard"}
function updateContext(){
var block=q(".topbar-title-block");if(!block)return;
var el=q(".v96-page-context",block);if(!el){el=document.createElement("span");el.className="v96-page-context";block.appendChild(el)}
var tab=activeTab();el.textContent=contexts[tab]||"Không gian quản trị OUR STAGE CLUB.";
qa(".nav button[data-tab]").forEach(function(b){if(b.dataset.tab===tab)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});
var t=q("#pageTitle");if(t&&t.textContent.trim())document.title=t.textContent.trim()+" — Our Stage Club Manager";
}
function addSkip(){
if(q(".v96-skip-link"))return;var main=q(".main");if(!main)return;
if(!main.id)main.id="mainContent";if(!main.hasAttribute("tabindex"))main.setAttribute("tabindex","-1");
var a=document.createElement("a");a.className="v96-skip-link";a.href="#"+main.id;a.textContent="Bỏ qua menu, đến nội dung chính";
a.addEventListener("click",function(){setTimeout(function(){main.focus({preventScroll:true})},0)});document.body.prepend(a);
}
function labels(){
qa("button").forEach(function(b){if(b.hasAttribute("aria-label"))return;var tx=(b.textContent||"").replace(/\s+/g," ").trim();var tt=b.getAttribute("title");if(!tx&&tt)b.setAttribute("aria-label",tt)});
var n=q("#notificationBtn");if(n&&!n.hasAttribute("aria-label"))n.setAttribute("aria-label","Mở trung tâm thông báo");
var s=q("#manualSyncBtn");if(s&&!s.hasAttribute("aria-label"))s.setAttribute("aria-label","Đồng bộ dữ liệu mới nhất");
}
function keys(){document.addEventListener("keydown",function(e){var t=e.target;var editing=t&&(/INPUT|TEXTAREA|SELECT/.test(t.tagName)||t.isContentEditable);if(editing)return;if(e.key==="["&&!e.metaKey&&!e.ctrlKey&&!e.altKey){var b=q("#sidebarToggleBtn");if(b){e.preventDefault();b.click()}}})}
function watch(){var nav=q(".nav");if(!nav)return;new MutationObserver(function(){queueMicrotask(updateContext)}).observe(nav,{subtree:true,attributes:true,attributeFilter:["class"]});document.addEventListener("click",function(e){if(e.target.closest&&e.target.closest(".nav button[data-tab]"))setTimeout(updateContext,0)},true)}
function init(){addSkip();labels();keys();watch();updateContext();document.documentElement.classList.add("v96-stagecraft-ready")}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();