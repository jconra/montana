// The stones edging the grass island at the drive's Y, measured on the May drone mosaic. Replaces the earlier hand-placed border records, one of which sat in open grass.
export const ISLAND_STONES=[[-13.6,6.3,.42],[-14.3,7.5,.42],[-14.7,8.5,.46],[-14.75,9.7,.68],[-14.6,11,.4],[-14.45,11.9,.3],[-14.1,12.7,.28],[-15,6.7,.28]];
const SHAPES=['rock/27','rock/43','rock/11','rock/61'];
export function applyRockBorders(objects){
 const added=objects.added.filter(o=>!o.id.startsWith('added:border-stone-'));
 ISLAND_STONES.forEach(([x,z,s],i)=>added.push({id:'added:island-stone-'+i,asset:SHAPES[i%4],x,z,offset:0,rotation:[0,i*1.9,0],scale:[s,s*.75,s*.9],tint:1}));
 return {...objects,added};
}
