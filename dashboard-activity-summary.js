(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.OSCDashboardActivity=api;
})(typeof window!=="undefined"?window:null,function(){
  "use strict";
  function rows(config,roster,semesterKey){
    const groups=Array.isArray(config?.groups)?config.groups:[];
    const members=(Array.isArray(roster)?roster:[]).filter(
      m=>m&&(!semesterKey||m.semester===semesterKey)
    );
    const total=members.length,items=[];
    groups.forEach((group,gi)=>{
      (Array.isArray(group?.items)?group.items:[]).forEach((activity,ii)=>{
        if(!activity||typeof activity!=="object")return;
        const id=String(activity.id||"");
        const mode=activity.mode||group.mode||"checkbox";
        let joined=0;
        for(const member of members){
          const value=member.scores?.[id];
          if(mode==="number"?Number(value||0)>0:value===true)joined++;
        }
        items.push({
          key:gi+":"+ii,
          id,
          name:String(activity.name||"").trim()||"Hoạt động chưa đặt tên",
          group:String(group?.name||"").trim()||"Nhóm hoạt động",
          date:String(activity.date||"").trim(),
          joined,total,percentage:total?Math.round(joined/total*100):0
        });
      });
    });
    return items;
  }
  return{rows};
});
