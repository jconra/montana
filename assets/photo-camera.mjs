export function validCamera(v){
  return v&&['position','target'].every(k=>Array.isArray(v[k])&&v[k].length===3&&v[k].every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<120000))&&Number.isFinite(v.fov)&&v.fov>=15&&v.fov<=110&&Number.isFinite(v.aspect)&&v.aspect>=.2&&v.aspect<=5&&(v.roll==null||Number.isFinite(v.roll)&&Math.abs(v.roll)<=180)&&Math.hypot(...v.position.map((n,i)=>n-v.target[i]))>.01;
}
export function parseAlignments(data,knownPhotos){
  const rows=data?.format==='montana-photo-alignments'&&data.version===1?data.alignments:data?.format==='montana-photo-camera'&&data.version===1?[data]:null;
  if(!Array.isArray(rows)||!rows.length||rows.length>200)throw Error('Not a Montana camera or alignment file.');
  const seen=new Set();
  for(const row of rows){
    if(!validCamera(row))throw Error('An alignment contains invalid camera values.');
    if(row.photo!=null&&(!knownPhotos.has(row.photo)||seen.has(row.photo)))throw Error('An alignment names an unknown or duplicate reference photo.');
    if(row.photo)seen.add(row.photo);
  }
  return rows;
}
