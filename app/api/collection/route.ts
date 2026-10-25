// Legacy ClosetMath endpoints are retired and not exposed through SwapNight.
const retired=()=>Response.json({error:'This endpoint has moved to SwapNight.'},{status:410});
export const GET=retired;
export const POST=retired;
export const DELETE=retired;
