/* Our Stage V93 - Public event destination bridge
   The server decides whether a response must continue to Seat Studio.
   This bridge keeps the existing public submit flow compatible. */
(()=>{
  "use strict";
  if(typeof seatApi!=="function"||typeof beginSeatSelection!=="function")return;

  let pendingDestination="";

  const originalSeatApi=seatApi;
  seatApi=async function(body,timeoutMs=18000){
    const data=await originalSeatApi(body,timeoutMs);
    if(String(body?.action||"")==="public-create-submission"){
      pendingDestination=String(data?.nextDestination||"").toLowerCase();
    }
    return data;
  };

  const originalBeginSeatSelection=beginSeatSelection;
  beginSeatSelection=async function(session){
    const destination=pendingDestination;
    pendingDestination="";
    if(destination==="submit"){
      try{clearSeatSession()}catch{}
      eventSeatSelecting=false;
      showSubmissionSuccess();
      return;
    }
    return originalBeginSeatSelection(session);
  };
})();
